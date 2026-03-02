"""
Full MRP engine. Time-phased planning with lead times, safety stock, lot sizing.
Reads demand from portal SOs + Sage SOs. Writes planned orders to portal PostgreSQL only.

SAGE 50 IS 100% READ-ONLY — NEVER WRITE TO SAGE.
"""
import math
from datetime import date, timedelta
from collections import defaultdict

import db_service
import audit_service


def _get_item_params(items_data):
    """Extract MRP-relevant parameters from MISys Items.json data."""
    params = {}
    for item in (items_data or []):
        ino = item.get("Item No.") or item.get("item_no")
        if not ino:
            continue
        params[ino] = {
            "item_no": ino,
            "lead_days": _num(item.get("Lead (Days)") or item.get("Lead") or 0),
            "lot_size": _num(item.get("Lot Size") or 0),
            "reorder_level": _num(item.get("Reorder Level") or 0),
            "reorder_qty": _num(item.get("Reorder Quantity") or 0),
            "safety_stock": _num(item.get("Minimum") or 0),
            "maximum": _num(item.get("Maximum") or 0),
            "on_hand": _num(item.get("Stock") or item.get("On Hand") or 0),
            "on_order": _num(item.get("On Order") or 0),
        }
    return params


def _num(val):
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _get_so_demand(portal_sos=None, sage_sos=None):
    """Build demand by item from open SOs.
    portal_sos: from core.sales_order_lines. sage_sos: READ from Sage."""
    demand = defaultdict(list)

    for line in (portal_sos or []):
        item = line.get("item_no")
        qty_remaining = _num(line.get("qty_ordered", 0)) - _num(line.get("qty_shipped", 0))
        need_date = line.get("delivery_date") or line.get("required_date")
        if item and qty_remaining > 0:
            demand[item].append({
                "qty": qty_remaining,
                "need_date": need_date or date.today().isoformat(),
                "source": "portal_so",
            })

    for so in (sage_sos or []):
        for line in (so.get("lines") or []):
            item = line.get("item_no") or line.get("sPartCode")
            qty = _num(line.get("qty_ordered") or line.get("dQty") or 0)
            shipped = _num(line.get("qty_shipped") or line.get("dShipped") or 0)
            remaining = qty - shipped
            if item and remaining > 0:
                need_date = so.get("required_date") or so.get("dtReqDate")
                demand[item].append({
                    "qty": remaining,
                    "need_date": str(need_date) if need_date else date.today().isoformat(),
                    "source": "sage_so",
                })

    return demand


def _apply_lot_sizing(net_qty, lot_size):
    """Apply lot sizing rule. Returns order quantity."""
    if lot_size <= 0:
        return net_qty
    return math.ceil(net_qty / lot_size) * lot_size


def run_mrp(items_data, portal_so_lines=None, sage_sos=None, run_by="system"):
    """Execute a full MRP run. Returns the run record and planned orders."""
    item_params = _get_item_params(items_data)
    demand = _get_so_demand(portal_so_lines, sage_sos)

    today = date.today()
    planned_orders = []

    all_items = set(list(item_params.keys()) + list(demand.keys()))

    for item_no in sorted(all_items):
        ip = item_params.get(item_no, {})
        on_hand = ip.get("on_hand", 0)
        on_order = ip.get("on_order", 0)
        safety_stock = ip.get("safety_stock", 0)
        lead_days = int(ip.get("lead_days", 0)) or 7
        lot_size = ip.get("lot_size", 0)
        reorder_qty = ip.get("reorder_qty", 0)

        item_demand = demand.get(item_no, [])
        total_demand = sum(d["qty"] for d in item_demand)

        available = on_hand + on_order
        net_requirement = total_demand + safety_stock - available

        if net_requirement <= 0:
            continue

        order_qty = _apply_lot_sizing(net_requirement, lot_size)
        if reorder_qty > 0:
            order_qty = max(order_qty, reorder_qty)

        earliest_need = today
        for d in item_demand:
            try:
                nd = date.fromisoformat(str(d["need_date"])[:10])
                if nd < earliest_need or earliest_need == today:
                    earliest_need = nd
            except (ValueError, TypeError):
                pass

        order_date = earliest_need - timedelta(days=lead_days)
        if order_date < today:
            order_date = today

        supplier_no = _get_preferred_supplier(item_no)

        planned_orders.append({
            "item_no": item_no,
            "qty": order_qty,
            "need_date": earliest_need.isoformat(),
            "order_date": order_date.isoformat(),
            "supplier_no": supplier_no,
            "net_requirement": net_requirement,
            "demand_qty": total_demand,
            "on_hand": on_hand,
            "on_order": on_order,
            "safety_stock": safety_stock,
        })

    run_record = _save_run(planned_orders, run_by)
    return run_record


def _get_preferred_supplier(item_no):
    """Find preferred supplier from core.supplier_items."""
    try:
        row = db_service.fetch_one(
            "SELECT supl_id FROM core.supplier_items WHERE item_id = %s LIMIT 1",
            (item_no,)
        )
        return row["supl_id"] if row else None
    except Exception:
        return None


def _save_run(planned_orders, run_by):
    """Persist MRP run and planned orders to DB."""
    try:
        from psycopg2.extras import Json
        run = db_service.insert_returning(
            """INSERT INTO core.mrp_runs (run_by, planned_order_count, summary)
               VALUES (%s, %s, %s) RETURNING *""",
            (run_by, len(planned_orders), Json({"items_analyzed": len(planned_orders)}))
        )

        for po in planned_orders:
            db_service.execute(
                """INSERT INTO core.mrp_planned_orders
                   (run_id, item_no, qty, need_date, order_date, supplier_no)
                   VALUES (%s,%s,%s,%s,%s,%s)""",
                (run["id"], po["item_no"], po["qty"],
                 po["need_date"], po["order_date"], po.get("supplier_no"))
            )

        run["planned_orders"] = planned_orders
        audit_service.log_from_request("MRP_RUN", "MRP", run["id"],
                                       after={"planned_count": len(planned_orders)})
        return run
    except Exception as e:
        return {"status": "error", "error": str(e), "planned_orders": planned_orders}


def get_run(run_id):
    run = db_service.fetch_one("SELECT * FROM core.mrp_runs WHERE id = %s", (run_id,))
    if run:
        run["planned_orders"] = db_service.fetch_all(
            "SELECT * FROM core.mrp_planned_orders WHERE run_id = %s ORDER BY need_date",
            (run_id,)
        )
    return run


def get_latest_run():
    run = db_service.fetch_one("SELECT * FROM core.mrp_runs ORDER BY id DESC LIMIT 1")
    if run:
        run["planned_orders"] = db_service.fetch_all(
            "SELECT * FROM core.mrp_planned_orders WHERE run_id = %s ORDER BY need_date",
            (run["id"],)
        )
    return run


def convert_to_po(planned_order_id, created_by="portal"):
    """Convert a planned order to an actual PO."""
    po = db_service.fetch_one(
        "SELECT * FROM core.mrp_planned_orders WHERE id = %s", (planned_order_id,)
    )
    if not po:
        return {"error": "Planned order not found"}
    if po["status"] != "planned":
        return {"error": f"Already {po['status']}"}

    import portal_store
    po_no = f"MRP-{planned_order_id:05d}"
    portal_store.add_created_po({
        "PO No.": po_no,
        "Supplier No.": po["supplier_no"] or "",
        "Item No.": po["item_no"],
        "Qty": float(po["qty"]),
        "Order Date": po["order_date"],
        "_source": "mrp",
    })

    db_service.execute(
        """UPDATE core.mrp_planned_orders
           SET status = 'converted', converted_po_no = %s
           WHERE id = %s""",
        (po_no, planned_order_id)
    )
    audit_service.log_from_request("MRP_CONVERT", "MRP_PLANNED_ORDER", planned_order_id,
                                   after={"po_no": po_no})
    return {"converted_po_no": po_no, "planned_order_id": planned_order_id}
