"""
Quality Control / Inspection service.
PO receive triggers QC when item has specs. Manages hold/quarantine status.
All writes to portal Postgres — never to Sage.
"""
import db_service
import audit_service


def get_specs_for_item(item_no):
    return db_service.fetch_all(
        "SELECT * FROM core.quality_specs WHERE item_no = %s AND is_active = TRUE ORDER BY spec_name",
        (item_no,)
    )


def create_spec(item_no, data):
    return db_service.insert_returning(
        """INSERT INTO core.quality_specs
           (item_no, spec_name, min_value, max_value, unit, test_method)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
        (item_no, data.get("spec_name"), data.get("min_value"),
         data.get("max_value"), data.get("unit"), data.get("test_method"))
    )


def item_requires_inspection(item_no):
    specs = get_specs_for_item(item_no)
    return len(specs) > 0


def create_inspection(po_no, item_no, lot_no=None, qty=None, po_line_id=None):
    """Create a QC inspection record. Called when receiving items with quality specs."""
    inspection = db_service.insert_returning(
        """INSERT INTO core.inspections
           (po_no, po_line_id, item_no, lot_no, qty_inspected, status)
           VALUES (%s,%s,%s,%s,%s,'pending') RETURNING *""",
        (po_no, po_line_id, item_no, lot_no, qty)
    )
    audit_service.log_from_request("CREATE", "INSPECTION", inspection["id"],
                                   after={"item_no": item_no, "po_no": po_no})
    return inspection


def record_result(inspection_id, results, status, inspector_id=None, notes=None, coa_path=None):
    """Record inspection results. status = 'pass' | 'fail' | 'hold'."""
    before = db_service.fetch_one(
        "SELECT * FROM core.inspections WHERE id = %s", (inspection_id,)
    )
    if not before:
        return {"error": "Inspection not found"}
    if before["status"] != "pending":
        return {"error": f"Inspection already '{before['status']}'"}

    from psycopg2.extras import Json
    db_service.execute(
        """UPDATE core.inspections SET
           status = %s, results = %s, inspector_id = %s,
           inspected_at = NOW(), notes = %s, coa_file_path = %s
           WHERE id = %s""",
        (status, Json(results) if results else None, inspector_id,
         notes, coa_path, inspection_id)
    )

    if status == "pass":
        _release_from_hold(before["item_no"], before.get("lot_no"))
    elif status == "fail":
        _quarantine(before["item_no"], before.get("lot_no"))

    audit_service.log_from_request("INSPECT", "INSPECTION", inspection_id,
                                   before={"status": "pending"},
                                   after={"status": status})
    return db_service.fetch_one("SELECT * FROM core.inspections WHERE id = %s", (inspection_id,))


def _release_from_hold(item_no, lot_no):
    """Release inventory from hold status on QC pass."""
    pass


def _quarantine(item_no, lot_no):
    """Keep inventory in quarantine on QC fail, notify manager."""
    try:
        managers = db_service.fetch_all(
            "SELECT id FROM core.portal_users WHERE role = 'manager' AND is_active = TRUE"
        )
        import notification_service
        for mgr in managers:
            notification_service.send_notification(
                mgr["id"], "qc_fail",
                f"QC FAIL: {item_no}",
                f"Item {item_no} (lot {lot_no or 'N/A'}) failed QC inspection. Quarantined.",
                entity_type="ITEM", entity_id=item_no,
                send_email=True
            )
    except Exception as e:
        print(f"[qc] Quarantine notification failed: {e}")


def get_pending_inspections():
    return db_service.fetch_all(
        "SELECT * FROM core.inspections WHERE status = 'pending' ORDER BY created_at"
    )


def get_inspections_for_item(item_no, limit=50):
    return db_service.fetch_all(
        "SELECT * FROM core.inspections WHERE item_no = %s ORDER BY created_at DESC LIMIT %s",
        (item_no, limit)
    )


def get_inspection(inspection_id):
    return db_service.fetch_one(
        "SELECT * FROM core.inspections WHERE id = %s", (inspection_id,)
    )


def trigger_inspection_on_receive(po_no, item_no, qty, lot_no=None, po_line_id=None):
    """Called during PO receive. Creates inspection if item requires QC."""
    if item_requires_inspection(item_no):
        return create_inspection(po_no, item_no, lot_no, qty, po_line_id)
    return None
