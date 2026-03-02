"""
AP/AR/GL view service. Combines portal invoices + Sage data for
aging buckets, payment tracking, and GL summary.

SAGE 50 IS 100% READ-ONLY — NEVER WRITE TO SAGE.
Sage data is only read via SELECT queries. All portal data lives in PostgreSQL.
"""
from datetime import date, timedelta

import db_service


def ar_aging():
    """Accounts Receivable aging from portal invoices + Sage receipts (READ-ONLY).
    Returns aging buckets: current, 30, 60, 90, 120+."""
    today = date.today()
    buckets = {"current": 0, "30": 0, "60": 0, "90": 0, "120_plus": 0}
    details = []

    try:
        invoices = db_service.fetch_all(
            """SELECT i.*, c.name as customer_name
               FROM core.invoices i
               LEFT JOIN core.customers c ON c.id = i.customer_id
               WHERE i.status IN ('sent', 'draft')
               ORDER BY i.due_date"""
        )

        for inv in invoices:
            due = inv.get("due_date")
            if not due:
                continue
            if isinstance(due, str):
                due = date.fromisoformat(due[:10])

            days_overdue = (today - due).days
            amount = float(inv.get("total", 0))

            if days_overdue <= 0:
                bucket = "current"
            elif days_overdue <= 30:
                bucket = "30"
            elif days_overdue <= 60:
                bucket = "60"
            elif days_overdue <= 90:
                bucket = "90"
            else:
                bucket = "120_plus"

            buckets[bucket] += amount
            details.append({
                "invoice_no": inv["invoice_no"],
                "customer": inv.get("customer_name"),
                "amount": amount,
                "due_date": str(due),
                "days_overdue": max(0, days_overdue),
                "bucket": bucket,
            })
    except Exception as e:
        print(f"[financial] AR portal error: {e}")

    sage_ar = _sage_ar_data()

    for k in buckets:
        buckets[k] = round(buckets[k], 2)

    return {
        "buckets": buckets,
        "total_outstanding": round(sum(buckets.values()), 2),
        "details": details,
        "sage_receipts": sage_ar,
    }


def ap_aging():
    """Accounts Payable aging from portal PO receives + Sage vendor payments (READ-ONLY)."""
    today = date.today()
    buckets = {"current": 0, "30": 0, "60": 0, "90": 0, "120_plus": 0}
    details = []

    try:
        pos = db_service.fetch_all(
            """SELECT p.*, s.name as supplier_name
               FROM core.purchase_orders p
               LEFT JOIN core.suppliers s ON s.supl_id = p.supl_id
               WHERE p.status NOT IN ('Closed', 'Cancelled')
               ORDER BY p.promised_date"""
        )

        for po in pos:
            promised = po.get("promised_date")
            if not promised:
                continue
            if isinstance(promised, str):
                promised = date.fromisoformat(promised[:10])

            days_overdue = (today - promised).days
            lines = db_service.fetch_all(
                "SELECT SUM(ext_cost) as total FROM core.purchase_order_lines WHERE poh_id = %s AND poh_rev = %s",
                (po["poh_id"], po["poh_rev"])
            )
            amount = float(lines[0]["total"]) if lines and lines[0]["total"] else 0

            if days_overdue <= 0:
                bucket = "current"
            elif days_overdue <= 30:
                bucket = "30"
            elif days_overdue <= 60:
                bucket = "60"
            elif days_overdue <= 90:
                bucket = "90"
            else:
                bucket = "120_plus"

            buckets[bucket] += amount
            details.append({
                "po_no": po["poh_id"],
                "supplier": po.get("supplier_name"),
                "amount": amount,
                "promised_date": str(promised),
                "days_overdue": max(0, days_overdue),
                "bucket": bucket,
            })
    except Exception as e:
        print(f"[financial] AP portal error: {e}")

    for k in buckets:
        buckets[k] = round(buckets[k], 2)

    return {
        "buckets": buckets,
        "total_outstanding": round(sum(buckets.values()), 2),
        "details": details,
    }


def gl_summary():
    """General Ledger summary. READ from Sage taccount via existing endpoint."""
    try:
        import sage_service
        accounts = sage_service.get_accounts()

        summary = {
            "assets": [],
            "liabilities": [],
            "equity": [],
            "revenue": [],
            "expenses": [],
        }

        for acct in (accounts or []):
            acct_type = str(acct.get("type") or acct.get("nAcctType") or "").strip()
            name = acct.get("name") or acct.get("sName") or ""
            balance = float(acct.get("balance") or acct.get("dYts") or 0)

            entry = {"name": name, "balance": round(balance, 2)}

            if acct_type in ("1", "Asset"):
                summary["assets"].append(entry)
            elif acct_type in ("2", "Liability"):
                summary["liabilities"].append(entry)
            elif acct_type in ("3", "Equity"):
                summary["equity"].append(entry)
            elif acct_type in ("4", "Revenue"):
                summary["revenue"].append(entry)
            elif acct_type in ("5", "Expense"):
                summary["expenses"].append(entry)

        return {
            "summary": summary,
            "total_assets": round(sum(a["balance"] for a in summary["assets"]), 2),
            "total_liabilities": round(sum(a["balance"] for a in summary["liabilities"]), 2),
            "total_revenue": round(sum(a["balance"] for a in summary["revenue"]), 2),
            "total_expenses": round(sum(a["balance"] for a in summary["expenses"]), 2),
        }
    except Exception as e:
        return {"error": str(e)}


def _sage_ar_data():
    """Read AR data from Sage receipts (READ-ONLY)."""
    try:
        import sage_service
        receipts = sage_service.get_receipts()
        return receipts[:50] if receipts else []
    except Exception:
        return []
