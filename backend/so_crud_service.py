"""
Sales Order CRUD service. Creates/edits SOs in portal Postgres.
Sage SOs are read-only and shown alongside portal SOs with a source flag.
"""
import db_service
import audit_service


def _next_so_no():
    row = db_service.fetch_one(
        "SELECT so_no FROM core.sales_orders WHERE source='portal' ORDER BY id DESC LIMIT 1"
    )
    if row and row["so_no"]:
        try:
            num = int(row["so_no"].replace("PSO-", ""))
            return f"PSO-{num + 1:05d}"
        except ValueError:
            pass
    return "PSO-00001"


def create_so(data, created_by="portal"):
    so_no = data.get("so_no") or _next_so_no()
    row = db_service.insert_returning(
        """INSERT INTO core.sales_orders
           (so_no, customer_id, customer_name, order_date, required_date,
            ship_date, status, priority, currency_code, subtotal, tax, total,
            notes, special_instructions, source, created_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'portal',%s)
           RETURNING *""",
        (so_no, data.get("customer_id"), data.get("customer_name"),
         data.get("order_date"), data.get("required_date"),
         data.get("ship_date"), data.get("status", "draft"),
         data.get("priority", "normal"), data.get("currency_code", "CAD"),
         data.get("subtotal", 0), data.get("tax", 0), data.get("total", 0),
         data.get("notes"), data.get("special_instructions"), created_by)
    )

    for i, line in enumerate(data.get("lines", []), start=1):
        db_service.execute(
            """INSERT INTO core.sales_order_lines
               (so_id, line_no, item_no, description, qty_ordered,
                unit_price, ext_price, uom, delivery_date)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (row["id"], i, line.get("item_no"), line.get("description"),
             line.get("qty_ordered", 0), line.get("unit_price", 0),
             line.get("ext_price", 0), line.get("uom"),
             line.get("delivery_date"))
        )

    audit_service.log_from_request("CREATE", "SO", so_no, after=data)
    return row


def update_so(so_no, data):
    before = get_so(so_no)
    if not before:
        return None

    if before.get("source") != "portal":
        return {"error": "Cannot edit Sage/MISys SOs — they are read-only"}

    db_service.execute(
        """UPDATE core.sales_orders SET
           customer_name = COALESCE(%s, customer_name),
           required_date = COALESCE(%s, required_date),
           ship_date = COALESCE(%s, ship_date),
           priority = COALESCE(%s, priority),
           notes = COALESCE(%s, notes),
           special_instructions = COALESCE(%s, special_instructions),
           subtotal = COALESCE(%s, subtotal),
           tax = COALESCE(%s, tax),
           total = COALESCE(%s, total),
           updated_at = NOW()
           WHERE so_no = %s""",
        (data.get("customer_name"), data.get("required_date"),
         data.get("ship_date"), data.get("priority"),
         data.get("notes"), data.get("special_instructions"),
         data.get("subtotal"), data.get("tax"), data.get("total"), so_no)
    )
    audit_service.log_from_request("UPDATE", "SO", so_no, before=before, after=data)
    return get_so(so_no)


def update_so_status(so_no, new_status):
    VALID_TRANSITIONS = {
        "draft": ["confirmed", "cancelled"],
        "confirmed": ["released", "cancelled"],
        "released": ["shipped", "cancelled"],
        "shipped": ["invoiced"],
        "invoiced": ["closed"],
    }
    so = get_so(so_no)
    if not so:
        return {"error": "SO not found"}
    if so.get("source") != "portal":
        return {"error": "Cannot change status of Sage/MISys SOs"}

    current = so["status"]
    allowed = VALID_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        return {"error": f"Cannot transition from '{current}' to '{new_status}'. Allowed: {allowed}"}

    db_service.execute(
        "UPDATE core.sales_orders SET status = %s, updated_at = NOW() WHERE so_no = %s",
        (new_status, so_no)
    )
    audit_service.log_from_request("STATUS_CHANGE", "SO", so_no,
                                   before={"status": current},
                                   after={"status": new_status})
    return get_so(so_no)


def get_so(so_no):
    so = db_service.fetch_one(
        "SELECT * FROM core.sales_orders WHERE so_no = %s", (so_no,)
    )
    if so:
        so["lines"] = db_service.fetch_all(
            "SELECT * FROM core.sales_order_lines WHERE so_id = %s ORDER BY line_no",
            (so["id"],)
        )
    return so


def list_sos(status=None, limit=100, offset=0):
    conditions = []
    params = []
    if status:
        conditions.append("status = %s")
        params.append(status)
    where = " AND ".join(conditions) if conditions else "TRUE"
    params.extend([limit, offset])
    return db_service.fetch_all(
        f"SELECT * FROM core.sales_orders WHERE {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        params
    )


def delete_so(so_no):
    so = get_so(so_no)
    if not so:
        return {"error": "SO not found"}
    if so.get("source") != "portal":
        return {"error": "Cannot delete Sage/MISys SOs"}
    if so["status"] != "draft":
        return {"error": "Can only delete draft SOs"}

    db_service.execute("DELETE FROM core.sales_orders WHERE so_no = %s", (so_no,))
    audit_service.log_from_request("DELETE", "SO", so_no, before=so)
    return {"deleted": so_no}
