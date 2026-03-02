"""
Notification and alert service. Email + in-app notifications with escalation.
All writes to portal Postgres — never to Sage.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

import db_service


SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "portal@canoilcanadaltd.com")


def send_notification(user_id, notif_type, title, message,
                      entity_type=None, entity_id=None, send_email=False):
    """Create in-app notification and optionally send email."""
    notif = db_service.insert_returning(
        """INSERT INTO core.notifications
           (user_id, type, title, message, entity_type, entity_id)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
        (user_id, notif_type, title, message, entity_type, entity_id)
    )

    if send_email:
        user = db_service.fetch_one(
            "SELECT email FROM core.portal_users WHERE id = %s", (user_id,)
        )
        if user and user.get("email"):
            _send_email(user["email"], title, message)

    return notif


def get_notifications(user_id, unread_only=False, limit=50, offset=0):
    if unread_only:
        return db_service.fetch_all(
            """SELECT * FROM core.notifications
               WHERE user_id = %s AND is_read = FALSE
               ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            (user_id, limit, offset)
        )
    return db_service.fetch_all(
        """SELECT * FROM core.notifications
           WHERE user_id = %s
           ORDER BY created_at DESC LIMIT %s OFFSET %s""",
        (user_id, limit, offset)
    )


def get_unread_count(user_id):
    row = db_service.fetch_one(
        "SELECT COUNT(*) as count FROM core.notifications WHERE user_id = %s AND is_read = FALSE",
        (user_id,)
    )
    return row["count"] if row else 0


def mark_read(notification_id):
    db_service.execute(
        "UPDATE core.notifications SET is_read = TRUE WHERE id = %s",
        (notification_id,)
    )
    return {"marked_read": notification_id}


def mark_all_read(user_id):
    count = db_service.execute(
        "UPDATE core.notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
        (user_id,)
    )
    return {"marked_count": count}


# -- Alert Rules --

def create_alert_rule(data, created_by=None):
    from psycopg2.extras import Json
    return db_service.insert_returning(
        """INSERT INTO core.alert_rules
           (rule_type, threshold, notify_users, notify_email,
            escalate_after_hours, description, created_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        (data.get("rule_type"), Json(data.get("threshold", {})),
         Json(data.get("notify_users", [])),
         data.get("notify_email", False),
         data.get("escalate_after_hours"),
         data.get("description"), created_by)
    )


def update_alert_rule(rule_id, data):
    from psycopg2.extras import Json
    db_service.execute(
        """UPDATE core.alert_rules SET
           threshold = COALESCE(%s, threshold),
           notify_users = COALESCE(%s, notify_users),
           notify_email = COALESCE(%s, notify_email),
           escalate_after_hours = COALESCE(%s, escalate_after_hours),
           description = COALESCE(%s, description),
           is_active = COALESCE(%s, is_active)
           WHERE id = %s""",
        (Json(data["threshold"]) if "threshold" in data else None,
         Json(data["notify_users"]) if "notify_users" in data else None,
         data.get("notify_email"), data.get("escalate_after_hours"),
         data.get("description"), data.get("is_active"), rule_id)
    )
    return db_service.fetch_one("SELECT * FROM core.alert_rules WHERE id = %s", (rule_id,))


def list_alert_rules():
    return db_service.fetch_all("SELECT * FROM core.alert_rules ORDER BY id")


def check_alerts():
    """Periodic alert check. Called by scheduler. Evaluates all active rules."""
    rules = db_service.fetch_all(
        "SELECT * FROM core.alert_rules WHERE is_active = TRUE"
    )

    alerts_triggered = 0
    for rule in rules:
        try:
            rule_type = rule.get("rule_type")
            threshold = rule.get("threshold") or {}

            if rule_type == "low_stock":
                alerts_triggered += _check_low_stock(rule, threshold)
            elif rule_type == "overdue_po":
                alerts_triggered += _check_overdue_po(rule, threshold)
            elif rule_type == "pending_approval":
                alerts_triggered += _check_stale_approvals(rule, threshold)
        except Exception as e:
            print(f"[notifications] Alert check error for rule {rule.get('id')}: {e}")

    return alerts_triggered


def _check_low_stock(rule, threshold):
    min_qty = float(threshold.get("min_qty", 10))
    items = db_service.fetch_all(
        """SELECT item_id, SUM(qty_on_hand) as total_qty
           FROM core.inventory_by_location
           GROUP BY item_id
           HAVING SUM(qty_on_hand) < %s""",
        (min_qty,)
    )
    count = 0
    for item in items:
        for uid in (rule.get("notify_users") or []):
            send_notification(
                uid, "low_stock",
                f"Low stock: {item['item_id']}",
                f"Item {item['item_id']} has {item['total_qty']} units (below {min_qty})",
                entity_type="ITEM", entity_id=item["item_id"],
                send_email=rule.get("notify_email", False)
            )
            count += 1
    return count


def _check_overdue_po(rule, threshold):
    days = int(threshold.get("days_overdue", 7))
    pos = db_service.fetch_all(
        """SELECT poh_id, poh_rev, supl_id, promised_date
           FROM core.purchase_orders
           WHERE status NOT IN ('Closed', 'Cancelled')
             AND promised_date < CURRENT_DATE - INTERVAL '%s days'""",
        (days,)
    )
    count = 0
    for po in pos:
        for uid in (rule.get("notify_users") or []):
            send_notification(
                uid, "overdue_po",
                f"Overdue PO: {po['poh_id']}",
                f"PO {po['poh_id']} from {po['supl_id']} is overdue (promised {po['promised_date']})",
                entity_type="PO", entity_id=po["poh_id"],
                send_email=rule.get("notify_email", False)
            )
            count += 1
    return count


def _check_stale_approvals(rule, threshold):
    hours = int(threshold.get("stale_hours", 48))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    approvals = db_service.fetch_all(
        """SELECT * FROM core.approval_requests
           WHERE status = 'pending' AND created_at < %s""",
        (cutoff,)
    )
    count = 0
    for ar in approvals:
        for uid in (rule.get("notify_users") or []):
            send_notification(
                uid, "pending_approval",
                f"Stale approval: {ar['entity_type']} {ar['entity_id']}",
                f"Approval request for {ar['entity_type']} {ar['entity_id']} has been pending for over {hours}h",
                entity_type=ar["entity_type"], entity_id=ar["entity_id"],
                send_email=rule.get("notify_email", False)
            )
            count += 1
    return count


def _send_email(to_addr, subject, body):
    """Send an email notification. Silently fails if SMTP not configured."""
    if not SMTP_HOST or not SMTP_USER:
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = to_addr
        msg["Subject"] = f"[Canoil Portal] {subject}"
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to_addr, msg.as_string())
        return True
    except Exception as e:
        print(f"[notifications] Email send failed: {e}")
        return False
