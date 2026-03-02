"""
Approval workflow service. Configurable multi-step chains with thresholds.
Writes to portal Postgres — never to Sage.
"""
import db_service
import audit_service


def check_rules(entity_type, entity_data):
    """Check if any workflow rules match for this entity.
    Returns list of required approvals, or empty if none needed."""
    rules = db_service.fetch_all(
        """SELECT * FROM core.workflow_rules
           WHERE entity_type = %s AND is_active = TRUE
           ORDER BY sequence""",
        (entity_type,)
    )

    matched = []
    for rule in rules:
        cond = rule.get("condition") or {}
        if _evaluate_condition(cond, entity_data):
            matched.append(rule)

    return matched


def _evaluate_condition(condition, data):
    """Evaluate a JSONB condition against entity data.
    Supports: amount_gt, amount_lt, status_eq, priority_eq."""
    if not condition:
        return True

    for key, expected in condition.items():
        if key == "amount_gt":
            actual = float(data.get("total") or data.get("amount") or 0)
            if actual <= float(expected):
                return False
        elif key == "amount_lt":
            actual = float(data.get("total") or data.get("amount") or 0)
            if actual >= float(expected):
                return False
        elif key == "status_eq":
            if data.get("status") != expected:
                return False
        elif key == "priority_eq":
            if data.get("priority") != expected:
                return False

    return True


def request_approval(entity_type, entity_id, rule_id=None, requested_by=None):
    """Create an approval request."""
    return db_service.insert_returning(
        """INSERT INTO core.approval_requests
           (entity_type, entity_id, rule_id, requested_by)
           VALUES (%s,%s,%s,%s) RETURNING *""",
        (entity_type, str(entity_id), rule_id, requested_by)
    )


def submit_for_approval(entity_type, entity_id, entity_data, requested_by=None):
    """Check rules and create approval requests as needed.
    Returns list of created approval requests, or empty if auto-approved."""
    rules = check_rules(entity_type, entity_data)
    if not rules:
        return []

    requests = []
    for rule in rules:
        req = request_approval(entity_type, entity_id, rule["id"], requested_by)
        requests.append(req)

    audit_service.log_from_request("SUBMIT_FOR_APPROVAL", entity_type, entity_id,
                                   after={"rules_matched": len(rules)})
    return requests


def approve(approval_id, decided_by, comments=None):
    before = db_service.fetch_one(
        "SELECT * FROM core.approval_requests WHERE id = %s", (approval_id,)
    )
    if not before:
        return {"error": "Approval request not found"}
    if before["status"] != "pending":
        return {"error": f"Already {before['status']}"}

    db_service.execute(
        """UPDATE core.approval_requests
           SET status = 'approved', decided_by = %s, decided_at = NOW(), comments = %s
           WHERE id = %s""",
        (decided_by, comments, approval_id)
    )
    audit_service.log_from_request("APPROVE", before["entity_type"], before["entity_id"],
                                   before={"status": "pending"},
                                   after={"status": "approved", "decided_by": decided_by})
    return db_service.fetch_one("SELECT * FROM core.approval_requests WHERE id = %s", (approval_id,))


def reject(approval_id, decided_by, comments=None):
    before = db_service.fetch_one(
        "SELECT * FROM core.approval_requests WHERE id = %s", (approval_id,)
    )
    if not before:
        return {"error": "Approval request not found"}
    if before["status"] != "pending":
        return {"error": f"Already {before['status']}"}

    db_service.execute(
        """UPDATE core.approval_requests
           SET status = 'rejected', decided_by = %s, decided_at = NOW(), comments = %s
           WHERE id = %s""",
        (decided_by, comments, approval_id)
    )
    audit_service.log_from_request("REJECT", before["entity_type"], before["entity_id"],
                                   before={"status": "pending"},
                                   after={"status": "rejected", "decided_by": decided_by})
    return db_service.fetch_one("SELECT * FROM core.approval_requests WHERE id = %s", (approval_id,))


def get_pending(user_role=None):
    """Get all pending approvals, optionally filtered by approver role."""
    if user_role:
        return db_service.fetch_all(
            """SELECT ar.*, wr.approver_role, wr.description as rule_description
               FROM core.approval_requests ar
               LEFT JOIN core.workflow_rules wr ON wr.id = ar.rule_id
               WHERE ar.status = 'pending' AND wr.approver_role = %s
               ORDER BY ar.created_at""",
            (user_role,)
        )
    return db_service.fetch_all(
        """SELECT ar.*, wr.approver_role, wr.description as rule_description
           FROM core.approval_requests ar
           LEFT JOIN core.workflow_rules wr ON wr.id = ar.rule_id
           WHERE ar.status = 'pending'
           ORDER BY ar.created_at"""
    )


def get_history(entity_type=None, entity_id=None, limit=100):
    conditions = []
    params = []
    if entity_type:
        conditions.append("entity_type = %s")
        params.append(entity_type)
    if entity_id:
        conditions.append("entity_id = %s")
        params.append(str(entity_id))
    where = " AND ".join(conditions) if conditions else "TRUE"
    params.append(limit)
    return db_service.fetch_all(
        f"""SELECT * FROM core.approval_requests
            WHERE {where} ORDER BY created_at DESC LIMIT %s""",
        params
    )


def create_rule(data):
    from psycopg2.extras import Json
    return db_service.insert_returning(
        """INSERT INTO core.workflow_rules
           (entity_type, condition, approver_role, sequence, description)
           VALUES (%s,%s,%s,%s,%s) RETURNING *""",
        (data.get("entity_type"), Json(data.get("condition", {})),
         data.get("approver_role", "manager"),
         data.get("sequence", 1), data.get("description"))
    )


def list_rules():
    return db_service.fetch_all(
        "SELECT * FROM core.workflow_rules ORDER BY entity_type, sequence"
    )
