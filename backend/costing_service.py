"""
BOM cost rollup, COGS, landed cost, and margin analysis.

SAGE 50 IS 100% READ-ONLY — NEVER WRITE TO SAGE.
Uses Sage costs as read-only input (dLastCost, dCostOfStock).
All calculations and results stored in portal PostgreSQL only.
"""
import db_service


def _get_sage_costs():
    """Load item costs from Sage (READ-ONLY)."""
    try:
        import sage_service
        items = sage_service.get_inventory()
        costs = {}
        for item in (items or []):
            code = item.get("part_code") or item.get("sPartCode") or ""
            last_cost = float(item.get("last_cost") or item.get("dLastCost") or 0)
            stock_cost = float(item.get("cost_of_stock") or item.get("dCostOfStock") or 0)
            if code:
                costs[code.strip()] = {
                    "last_cost": last_cost,
                    "stock_cost": stock_cost,
                    "cost": last_cost or stock_cost,
                }
        return costs
    except Exception:
        return {}


def _get_misys_costs(items_data):
    """Load item costs from MISys data."""
    costs = {}
    for item in (items_data or []):
        ino = (item.get("Item No.") or item.get("item_no") or "").strip()
        cost = float(item.get("Item Cost") or item.get("item_cost") or 0)
        if ino:
            costs[ino] = {"misys_cost": cost, "cost": cost}
    return costs


def bom_cost_rollup(item_no, bom_data=None, items_data=None, visited=None):
    """Multi-level BOM cost rollup.
    Traverses BOM hierarchy, summing component costs from MISys + Sage (READ-ONLY)."""
    if visited is None:
        visited = set()
    if item_no in visited:
        return {"item_no": item_no, "cost": 0, "error": "circular_reference"}
    visited.add(item_no)

    sage_costs = _get_sage_costs()
    misys_costs = _get_misys_costs(items_data)

    bom_headers = bom_data.get("MIBOMH.json", []) if bom_data else []
    bom_details = bom_data.get("MIBOMD.json", []) if bom_data else []

    bom_for_item = None
    for bh in bom_headers:
        parent = bh.get("Parent Item No.") or bh.get("parentItemId") or ""
        if parent.strip() == item_no:
            bom_for_item = bh.get("BOM No.") or bh.get("bomId")
            break

    if not bom_for_item:
        cost = sage_costs.get(item_no, {}).get("cost", 0) or misys_costs.get(item_no, {}).get("cost", 0)
        return {"item_no": item_no, "cost": cost, "components": [], "is_leaf": True}

    components = []
    total_cost = 0

    for bd in bom_details:
        bom_id = bd.get("BOM No.") or bd.get("bomId")
        if bom_id != bom_for_item:
            continue

        part = (bd.get("Part No.") or bd.get("partId") or "").strip()
        qty_per = float(bd.get("Quantity") or bd.get("qtyPer") or 0)
        scrap = float(bd.get("Scrap Factor") or bd.get("scrapFactor") or 0)

        effective_qty = qty_per * (1 + scrap / 100) if scrap else qty_per

        sub_rollup = bom_cost_rollup(part, bom_data, items_data, visited.copy())
        component_cost = sub_rollup["cost"] * effective_qty

        components.append({
            "part_no": part,
            "qty_per": qty_per,
            "scrap_factor": scrap,
            "unit_cost": sub_rollup["cost"],
            "ext_cost": round(component_cost, 4),
            "sub_components": sub_rollup.get("components", []),
        })
        total_cost += component_cost

    return {
        "item_no": item_no,
        "cost": round(total_cost, 4),
        "components": components,
        "is_leaf": False,
    }


def cogs_for_so(so_no, bom_data=None, items_data=None):
    """Calculate Cost of Goods Sold for a Sales Order.
    COGS = BOM rollup cost x shipped quantity."""
    try:
        lines = db_service.fetch_all(
            """SELECT sol.* FROM core.sales_order_lines sol
               JOIN core.sales_orders so ON so.id = sol.so_id
               WHERE so.so_no = %s""",
            (so_no,)
        )
    except Exception:
        lines = []

    sage_costs = _get_sage_costs()
    total_cogs = 0
    line_cogs = []

    for line in lines:
        item = line.get("item_no", "")
        shipped = float(line.get("qty_shipped") or 0)
        if shipped <= 0:
            continue

        rollup = bom_cost_rollup(item, bom_data, items_data)
        unit_cogs = rollup["cost"]
        if unit_cogs == 0:
            unit_cogs = sage_costs.get(item, {}).get("cost", 0)

        line_total = unit_cogs * shipped
        total_cogs += line_total

        line_cogs.append({
            "item_no": item,
            "qty_shipped": shipped,
            "unit_cogs": round(unit_cogs, 4),
            "line_cogs": round(line_total, 2),
        })

    return {"so_no": so_no, "total_cogs": round(total_cogs, 2), "lines": line_cogs}


def margin_for_so(so_no, bom_data=None, items_data=None):
    """Margin = SO revenue - COGS."""
    try:
        so = db_service.fetch_one(
            "SELECT total FROM core.sales_orders WHERE so_no = %s", (so_no,)
        )
        revenue = float(so["total"]) if so else 0
    except Exception:
        revenue = 0

    cogs = cogs_for_so(so_no, bom_data, items_data)
    margin = revenue - cogs["total_cogs"]
    margin_pct = round((margin / revenue * 100), 2) if revenue > 0 else 0

    return {
        "so_no": so_no,
        "revenue": revenue,
        "cogs": cogs["total_cogs"],
        "margin": round(margin, 2),
        "margin_pct": margin_pct,
    }


def cost_variance_report(items_data=None):
    """Standard cost vs actual (Sage last cost) per item."""
    sage_costs = _get_sage_costs()
    misys_costs = _get_misys_costs(items_data)

    report = []
    for ino, mc in misys_costs.items():
        sc = sage_costs.get(ino, {})
        standard = mc.get("misys_cost", 0)
        actual = sc.get("last_cost", 0)
        if standard == 0 and actual == 0:
            continue
        variance = actual - standard
        variance_pct = round((variance / standard * 100), 2) if standard > 0 else 0
        report.append({
            "item_no": ino,
            "standard_cost": round(standard, 4),
            "actual_cost": round(actual, 4),
            "variance": round(variance, 4),
            "variance_pct": variance_pct,
        })

    report.sort(key=lambda x: abs(x["variance"]), reverse=True)
    return {"items": report, "total": len(report)}


def margin_by_customer():
    """Aggregate margin per customer across all SOs."""
    try:
        rows = db_service.fetch_all(
            """SELECT so.customer_name,
                      COUNT(*) as order_count,
                      SUM(so.total) as total_revenue
               FROM core.sales_orders so
               WHERE so.source = 'portal' AND so.status NOT IN ('draft', 'cancelled')
               GROUP BY so.customer_name
               ORDER BY total_revenue DESC"""
        )
        return {"customers": rows}
    except Exception as e:
        return {"error": str(e)}


def margin_by_order(bom_data=None, items_data=None):
    """Margin per order: SO revenue - COGS for each SO."""
    try:
        orders = db_service.fetch_all(
            """SELECT so_no, customer_name, total, status
               FROM core.sales_orders
               WHERE source = 'portal' AND status NOT IN ('draft', 'cancelled')
               ORDER BY created_at DESC"""
        )
        results = []
        for so in orders:
            revenue = float(so.get("total") or 0)
            cogs_data = cogs_for_so(so["so_no"], bom_data, items_data)
            cogs_val = cogs_data.get("total_cogs", 0)
            margin = revenue - cogs_val
            margin_pct = round((margin / revenue * 100), 2) if revenue > 0 else 0
            results.append({
                "so_no": so["so_no"],
                "customer_name": so.get("customer_name"),
                "status": so.get("status"),
                "revenue": revenue,
                "cogs": cogs_val,
                "margin": round(margin, 2),
                "margin_pct": margin_pct,
            })
        return {"orders": results, "total": len(results)}
    except Exception as e:
        return {"error": str(e)}


def margin_by_product(bom_data=None, items_data=None):
    """Margin per product: aggregate across all SOs containing that item."""
    try:
        lines = db_service.fetch_all(
            """SELECT sol.item_no,
                      SUM(sol.ext_price) as total_revenue,
                      SUM(sol.qty_shipped) as total_shipped
               FROM core.sales_order_lines sol
               JOIN core.sales_orders so ON so.id = sol.so_id
               WHERE so.source = 'portal' AND so.status NOT IN ('draft', 'cancelled')
               GROUP BY sol.item_no
               ORDER BY total_revenue DESC"""
        )
        sage_costs = _get_sage_costs()
        misys_costs = _get_misys_costs(items_data)
        results = []
        for line in lines:
            item = line["item_no"]
            revenue = float(line.get("total_revenue") or 0)
            shipped = float(line.get("total_shipped") or 0)
            unit_cost = sage_costs.get(item, {}).get("cost", 0) or misys_costs.get(item, {}).get("cost", 0)
            cogs_val = unit_cost * shipped
            margin = revenue - cogs_val
            margin_pct = round((margin / revenue * 100), 2) if revenue > 0 else 0
            results.append({
                "item_no": item,
                "total_revenue": round(revenue, 2),
                "total_shipped": shipped,
                "unit_cost": round(unit_cost, 4),
                "cogs": round(cogs_val, 2),
                "margin": round(margin, 2),
                "margin_pct": margin_pct,
            })
        return {"products": results, "total": len(results)}
    except Exception as e:
        return {"error": str(e)}
