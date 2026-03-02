"""
Shipment service. Ship against SOs, auto-deduct inventory, track partial shipments.
All writes go to portal Postgres. Sage is never written to.
"""
import db_service
import audit_service


def create_shipment(data, created_by="portal"):
    shipment = db_service.insert_returning(
        """INSERT INTO core.shipments
           (so_no, ship_date, carrier, tracking_no, status, notes, created_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        (data.get("so_no"), data.get("ship_date"), data.get("carrier"),
         data.get("tracking_no"), "draft", data.get("notes"), created_by)
    )

    for line in data.get("lines", []):
        db_service.execute(
            """INSERT INTO core.shipment_lines
               (shipment_id, so_line_id, item_no, qty_shipped, lot_no)
               VALUES (%s,%s,%s,%s,%s)""",
            (shipment["id"], line.get("so_line_id"), line.get("item_no"),
             line.get("qty_shipped", 0), line.get("lot_no"))
        )

    audit_service.log_from_request("CREATE", "SHIPMENT", shipment["id"], after=data)
    return shipment


def confirm_shipment(shipment_id):
    """Confirm a shipment: deduct inventory and update SO line shipped qty."""
    shipment = get_shipment(shipment_id)
    if not shipment:
        return {"error": "Shipment not found"}
    if shipment["status"] != "draft":
        return {"error": f"Shipment is already '{shipment['status']}'"}

    lines = db_service.fetch_all(
        "SELECT * FROM core.shipment_lines WHERE shipment_id = %s",
        (shipment_id,)
    )

    for line in lines:
        item_no = line["item_no"]
        qty = float(line["qty_shipped"] or 0)
        if qty <= 0:
            continue

        db_service.execute(
            """UPDATE core.inventory_by_location
               SET qty_on_hand = GREATEST(0, qty_on_hand - %s)
               WHERE item_id = %s""",
            (qty, item_no)
        )

        if line.get("so_line_id"):
            db_service.execute(
                """UPDATE core.sales_order_lines
                   SET qty_shipped = qty_shipped + %s
                   WHERE id = %s""",
                (qty, line["so_line_id"])
            )

    db_service.execute(
        "UPDATE core.shipments SET status = 'confirmed', updated_at = NOW() WHERE id = %s",
        (shipment_id,)
    )

    audit_service.log_from_request("CONFIRM", "SHIPMENT", shipment_id,
                                   before={"status": "draft"},
                                   after={"status": "confirmed", "lines": len(lines)})
    return get_shipment(shipment_id)


def get_shipment(shipment_id):
    ship = db_service.fetch_one(
        "SELECT * FROM core.shipments WHERE id = %s", (shipment_id,)
    )
    if ship:
        ship["lines"] = db_service.fetch_all(
            "SELECT * FROM core.shipment_lines WHERE shipment_id = %s",
            (shipment_id,)
        )
    return ship


def list_shipments(so_no=None, status=None, limit=100, offset=0):
    conditions = []
    params = []
    if so_no:
        conditions.append("so_no = %s")
        params.append(so_no)
    if status:
        conditions.append("status = %s")
        params.append(status)
    where = " AND ".join(conditions) if conditions else "TRUE"
    params.extend([limit, offset])
    return db_service.fetch_all(
        f"SELECT * FROM core.shipments WHERE {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        params
    )


def get_so_fulfillment(so_no):
    """Get fulfillment status per SO line: qty_ordered, qty_shipped, qty_remaining."""
    return db_service.fetch_all(
        """SELECT sol.id, sol.line_no, sol.item_no, sol.qty_ordered, sol.qty_shipped,
                  (sol.qty_ordered - sol.qty_shipped) as qty_remaining
           FROM core.sales_order_lines sol
           JOIN core.sales_orders so ON so.id = sol.so_id
           WHERE so.so_no = %s ORDER BY sol.line_no""",
        (so_no,)
    )
