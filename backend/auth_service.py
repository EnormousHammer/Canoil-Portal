"""
Authentication & RBAC service for the Canoil Portal.
JWT-based auth with 4 roles: viewer, operator, manager, admin.
Users stored in core.portal_users in the portal's own Postgres DB.
"""
import os
import json
import functools
from datetime import datetime, timedelta, timezone

from flask import request, jsonify, g

try:
    import jwt as pyjwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False

JWT_SECRET = os.environ.get("JWT_SECRET", "canoil-portal-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "24"))

ROLE_HIERARCHY = {
    "viewer": 0,
    "operator": 1,
    "manager": 2,
    "admin": 3,
}

PUBLIC_ENDPOINTS = {
    "/api/auth/login",
    "/api/health",
    "/api/warmup",
}


def hash_password(plain):
    if not BCRYPT_AVAILABLE:
        raise RuntimeError("bcrypt not installed")
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(plain, hashed):
    if not BCRYPT_AVAILABLE:
        return False
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id, email, role, display_name=""):
    if not JWT_AVAILABLE:
        raise RuntimeError("PyJWT not installed")
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": display_name,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token):
    if not JWT_AVAILABLE:
        return None
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.InvalidTokenError:
        return None


def get_current_user():
    """Extract current user from g context (set by middleware)."""
    return getattr(g, "current_user", None)


def auth_middleware():
    """Flask before_request middleware. Validates JWT and sets g.current_user."""
    if request.method == "OPTIONS":
        return None

    path = request.path.rstrip("/")
    if path in PUBLIC_ENDPOINTS or path.startswith("/api/auth/login"):
        return None

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        g.current_user = _fallback_user()
        return None

    token = auth_header[7:]
    payload = decode_token(token)
    if payload is None:
        return jsonify({"error": "Invalid or expired token"}), 401

    g.current_user = {
        "id": payload.get("sub"),
        "email": payload.get("email", ""),
        "role": payload.get("role", "viewer"),
        "name": payload.get("name", ""),
    }
    return None


def _fallback_user():
    """Until auth is fully enforced, allow unauthenticated access as admin."""
    return {
        "id": 0,
        "email": "admin@canoilcanadaltd.com",
        "role": "admin",
        "name": "Admin User",
    }


def require_role(min_role):
    """Decorator that requires a minimum role level."""
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if user is None:
                return jsonify({"error": "Authentication required"}), 401
            user_level = ROLE_HIERARCHY.get(user.get("role", "viewer"), 0)
            required_level = ROLE_HIERARCHY.get(min_role, 0)
            if user_level < required_level:
                return jsonify({"error": f"Role '{min_role}' or higher required"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


# -- DB operations for portal_users --

def get_user_by_email(email):
    try:
        import db_service
        return db_service.fetch_one(
            "SELECT * FROM core.portal_users WHERE email = %s AND is_active = TRUE",
            (email.lower().strip(),)
        )
    except Exception:
        return None


def create_user(email, password, display_name, role="viewer"):
    import db_service
    pw_hash = hash_password(password)
    return db_service.insert_returning(
        """INSERT INTO core.portal_users (email, password_hash, display_name, role)
           VALUES (%s, %s, %s, %s) RETURNING *""",
        (email.lower().strip(), pw_hash, display_name, role)
    )


def update_last_login(user_id):
    try:
        import db_service
        db_service.execute(
            "UPDATE core.portal_users SET last_login_at = NOW() WHERE id = %s",
            (user_id,)
        )
    except Exception:
        pass


def list_users():
    try:
        import db_service
        return db_service.fetch_all(
            "SELECT id, email, display_name, role, is_active, created_at, last_login_at FROM core.portal_users ORDER BY id"
        )
    except Exception:
        return []


def login(email, password):
    """Authenticate and return token + user info, or error dict."""
    user = get_user_by_email(email)
    if not user:
        return {"error": "Invalid email or password"}, 401

    if not check_password(password, user["password_hash"]):
        return {"error": "Invalid email or password"}, 401

    token = create_token(user["id"], user["email"], user["role"], user["display_name"])
    update_last_login(user["id"])

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["display_name"],
            "role": user["role"],
        }
    }, 200


def seed_users_from_misys(misys_users_json):
    """Seed portal users from MISys MIUSER.json data. Skips existing."""
    import db_service
    if not db_service.is_available():
        return []

    seeded = []
    for u in (misys_users_json or []):
        email = (u.get("Email") or u.get("email") or "").strip().lower()
        name = (u.get("Name") or u.get("name") or u.get("User Name") or "").strip()
        if not email:
            continue
        existing = get_user_by_email(email)
        if existing:
            continue
        try:
            new_user = create_user(email, "changeme123", name, role="operator")
            seeded.append(new_user)
        except Exception as e:
            print(f"[auth] Failed to seed user {email}: {e}")
    return seeded
