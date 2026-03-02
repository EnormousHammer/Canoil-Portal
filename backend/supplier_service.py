"""
Supplier Master enhancement service. CRUD + performance tracking + multi-contact.
Writes to portal Postgres. Sage vendor data is READ-ONLY enrichment.
"""
import db_service
import audit_service


def update_supplier(supplier_no, data):
    """Update supplier info in core.suppliers (from 01_schema.sql)."""
    before = db_service.fetch_one(
        "SELECT * FROM core.suppliers WHERE supl_id = %s", (supplier_no,)
    )
    db_service.execute(
        """UPDATE core.suppliers SET
           name = COALESCE(%s, name),
           phone = COALESCE(%s, phone),
           email = COALESCE(%s, email),
           address = COALESCE(%s, address),
           updated_at = NOW()
           WHERE supl_id = %s""",
        (data.get("name"), data.get("phone"), data.get("email"),
         data.get("address"), supplier_no)
    )
    audit_service.log_from_request("UPDATE", "SUPPLIER", supplier_no,
                                   before=before, after=data)
    return db_service.fetch_one(
        "SELECT * FROM core.suppliers WHERE supl_id = %s", (supplier_no,)
    )


def add_contact(supplier_no, data):
    return db_service.insert_returning(
        """INSERT INTO core.supplier_contacts
           (supplier_no, name, role, phone, email, is_primary)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
        (supplier_no, data.get("name"), data.get("role"),
         data.get("phone"), data.get("email"),
         data.get("is_primary", False))
    )


def get_contacts(supplier_no):
    return db_service.fetch_all(
        "SELECT * FROM core.supplier_contacts WHERE supplier_no = %s ORDER BY is_primary DESC, id",
        (supplier_no,)
    )


def add_performance_record(supplier_no, data):
    return db_service.insert_returning(
        """INSERT INTO core.supplier_performance
           (supplier_no, po_no, on_time, quality_score, notes, evaluated_by)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
        (supplier_no, data.get("po_no"), data.get("on_time"),
         data.get("quality_score"), data.get("notes"),
         data.get("evaluated_by"))
    )


def get_performance(supplier_no, limit=50):
    return db_service.fetch_all(
        """SELECT * FROM core.supplier_performance
           WHERE supplier_no = %s ORDER BY evaluation_date DESC LIMIT %s""",
        (supplier_no, limit)
    )


def get_performance_summary(supplier_no):
    return db_service.fetch_one(
        """SELECT
             COUNT(*) as total_evaluations,
             AVG(quality_score) as avg_quality,
             COUNT(*) FILTER (WHERE on_time = TRUE) as on_time_count,
             COUNT(*) FILTER (WHERE on_time = FALSE) as late_count,
             ROUND(100.0 * COUNT(*) FILTER (WHERE on_time = TRUE) / NULLIF(COUNT(*), 0), 1) as on_time_pct
           FROM core.supplier_performance WHERE supplier_no = %s""",
        (supplier_no,)
    )
