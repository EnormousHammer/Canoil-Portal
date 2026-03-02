"""
Audit trail service. Logs who/what/when/before/after for every mutation.
Writes to core.audit_log in the portal's own Postgres DB.
"""
import json
from datetime import datetime, timezone


def log_change(user_email, action, entity_type, entity_id,
               before=None, after=None, user_id=None, ip_address=None):
    """Record an audit log entry. Gracefully no-ops if DB is unavailable."""
    try:
        import db_service
        if not db_service.is_available():
            return None

        from psycopg2.extras import Json

        return db_service.insert_returning(
            """INSERT INTO core.audit_log
               (user_id, user_email, action, entity_type, entity_id,
                before_value, after_value, ip_address)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, ts""",
            (user_id, user_email, action, entity_type, str(entity_id),
             Json(before) if before else None,
             Json(after) if after else None,
             ip_address)
        )
    except Exception as e:
        print(f"[audit] Failed to log: {e}")
        return None


def log_from_request(action, entity_type, entity_id, before=None, after=None):
    """Log using the current Flask request context for user and IP."""
    try:
        from flask import request, g
        user = getattr(g, "current_user", None) or {}
        ip = request.remote_addr if request else None
        return log_change(
            user_email=user.get("email", "unknown"),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
            user_id=user.get("id"),
            ip_address=ip,
        )
    except Exception as e:
        print(f"[audit] log_from_request failed: {e}")
        return None


def get_audit_log(entity_type=None, entity_id=None, user_email=None,
                  action=None, date_from=None, date_to=None,
                  limit=100, offset=0):
    """Query audit log with optional filters."""
    try:
        import db_service
        conditions = []
        params = []

        if entity_type:
            conditions.append("entity_type = %s")
            params.append(entity_type)
        if entity_id:
            conditions.append("entity_id = %s")
            params.append(str(entity_id))
        if user_email:
            conditions.append("user_email = %s")
            params.append(user_email)
        if action:
            conditions.append("action = %s")
            params.append(action)
        if date_from:
            conditions.append("ts >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("ts <= %s")
            params.append(date_to)

        where = " AND ".join(conditions) if conditions else "TRUE"
        params.extend([limit, offset])

        rows = db_service.fetch_all(
            f"SELECT * FROM core.audit_log WHERE {where} ORDER BY ts DESC LIMIT %s OFFSET %s",
            params
        )
        count_row = db_service.fetch_one(
            f"SELECT COUNT(*) as total FROM core.audit_log WHERE {where}",
            params[:-2]
        )
        return {
            "entries": rows,
            "total": count_row["total"] if count_row else 0,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        return {"entries": [], "total": 0, "error": str(e)}
