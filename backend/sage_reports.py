"""
Sage financial reporting service.

SAGE 50 IS 100% READ-ONLY — NEVER WRITE TO SAGE.
All queries are SELECT-only from Sage 50 MySQL.
Results are computed in Python, not stored back to Sage.
"""


def _get_sage():
    try:
        import sage_service
        return sage_service
    except ImportError:
        return None


def get_monthly_sales_summary(year, month):
    """Monthly SO totals, order count, top customers. READ from Sage tsalordr, tcustomr."""
    sage = _get_sage()
    if not sage:
        return {"error": "Sage not available"}

    try:
        orders = sage.get_sales_orders(
            date_from=f"{year}-{month:02d}-01",
            date_to=f"{year}-{month:02d}-28"
        )
        total_revenue = sum(float(o.get("total") or o.get("dTotal") or 0) for o in orders)
        order_count = len(orders)

        customer_totals = {}
        for o in orders:
            cname = o.get("customer_name") or o.get("sName") or "Unknown"
            customer_totals[cname] = customer_totals.get(cname, 0) + float(o.get("total") or o.get("dTotal") or 0)

        top_customers = sorted(customer_totals.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "year": year,
            "month": month,
            "total_revenue": round(total_revenue, 2),
            "order_count": order_count,
            "top_customers": [{"name": c[0], "total": round(c[1], 2)} for c in top_customers],
        }
    except Exception as e:
        return {"error": str(e)}


def get_customer_revenue_report():
    """YTD per customer, credit utilization. READ from Sage tcustomr."""
    sage = _get_sage()
    if not sage:
        return {"error": "Sage not available"}

    try:
        customers = sage.get_customers()
        report = []
        for c in customers:
            ytd = float(c.get("ytd_sales") or c.get("dAmtYtd") or 0)
            credit = float(c.get("credit_limit") or c.get("dCrLimit") or 0)
            utilization = round((ytd / credit * 100), 1) if credit > 0 else 0
            report.append({
                "name": c.get("name") or c.get("sName"),
                "ytd_sales": round(ytd, 2),
                "credit_limit": round(credit, 2),
                "credit_utilization_pct": utilization,
            })
        report.sort(key=lambda x: x["ytd_sales"], reverse=True)
        return {"customers": report, "total": len(report)}
    except Exception as e:
        return {"error": str(e)}


def get_vendor_spend_report():
    """YTD per vendor. READ from Sage tvendor."""
    sage = _get_sage()
    if not sage:
        return {"error": "Sage not available"}

    try:
        vendors = sage.get_vendors()
        report = []
        for v in vendors:
            ytd = float(v.get("ytd_purchases") or v.get("dAmtYtd") or 0)
            report.append({
                "name": v.get("name") or v.get("sName"),
                "ytd_spend": round(ytd, 2),
            })
        report.sort(key=lambda x: x["ytd_spend"], reverse=True)
        return {"vendors": report, "total": len(report)}
    except Exception as e:
        return {"error": str(e)}


def get_gl_snapshot():
    """Account balances. READ from Sage taccount."""
    sage = _get_sage()
    if not sage:
        return {"error": "Sage not available"}

    try:
        accounts = sage.get_accounts()
        return {"accounts": accounts, "total": len(accounts)}
    except Exception as e:
        return {"error": str(e)}


def get_inventory_valuation():
    """Total stock value. READ from Sage tinvbyln (dInStock * dCostStk)."""
    sage = _get_sage()
    if not sage:
        return {"error": "Sage not available"}

    try:
        items = sage.get_inventory()
        total_value = 0
        item_values = []
        for item in items:
            qty = float(item.get("in_stock") or item.get("dInStock") or 0)
            cost = float(item.get("cost_of_stock") or item.get("dCostOfStock") or
                        item.get("last_cost") or item.get("dLastCost") or 0)
            value = qty * cost
            total_value += value
            if value > 0:
                item_values.append({
                    "part_code": item.get("part_code") or item.get("sPartCode"),
                    "description": item.get("description") or item.get("sDesc"),
                    "qty": qty,
                    "unit_cost": round(cost, 4),
                    "total_value": round(value, 2),
                })

        item_values.sort(key=lambda x: x["total_value"], reverse=True)
        return {
            "total_valuation": round(total_value, 2),
            "item_count": len(item_values),
            "items": item_values[:50],
        }
    except Exception as e:
        return {"error": str(e)}


def get_ar_aging():
    """Outstanding receipts by date. READ from Sage trcpthdr."""
    sage = _get_sage()
    if not sage:
        return {"error": "Sage not available"}

    try:
        receipts = sage.get_receipts()
        return {"receipts": receipts[:100], "total": len(receipts)}
    except Exception as e:
        return {"error": str(e)}


def get_month_end_package(year, month):
    """Combined MISys + Sage month-end report (10 sections).
    MISys data from portal DB/G Drive, Sage data all READ-ONLY."""
    package = {
        "year": year,
        "month": month,
        "sections": {}
    }

    sales = get_monthly_sales_summary(year, month)
    package["sections"]["revenue_summary"] = sales

    inventory = get_inventory_valuation()
    package["sections"]["inventory_valuation"] = inventory

    gl = get_gl_snapshot()
    package["sections"]["gl_snapshot"] = gl

    ar = get_ar_aging()
    package["sections"]["ar_position"] = ar

    customers = get_customer_revenue_report()
    package["sections"]["customer_revenue"] = customers

    vendors = get_vendor_spend_report()
    package["sections"]["vendor_spend"] = vendors

    try:
        import db_service
        if db_service.is_available():
            mo_stats = db_service.fetch_one(
                """SELECT
                     COUNT(*) as total_mos,
                     COUNT(*) FILTER (WHERE status = 2) as completed_mos,
                     SUM(qty_completed) as total_output
                   FROM core.manufacturing_orders
                   WHERE created_date >= %s AND created_date < %s""",
                (f"{year}-{month:02d}-01",
                 f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01")
            )
            package["sections"]["production_summary"] = mo_stats or {}

            open_mos = db_service.fetch_one(
                "SELECT COUNT(*) as count FROM core.manufacturing_orders WHERE status < 2"
            )
            open_pos = db_service.fetch_one(
                "SELECT COUNT(*) as count FROM core.purchase_orders WHERE status != 'Closed'"
            )
            package["sections"]["open_orders"] = {
                "open_mos": open_mos.get("count", 0) if open_mos else 0,
                "open_pos": open_pos.get("count", 0) if open_pos else 0,
            }
    except Exception:
        package["sections"]["production_summary"] = {}
        package["sections"]["open_orders"] = {}

    return package
