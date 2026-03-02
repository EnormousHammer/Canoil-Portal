"""
Portal PostgreSQL database service.
Provides connection pooling and query helpers for the portal's own Postgres DB.
All portal writes go here — NEVER to Sage 50 (which is strictly read-only).
"""
import os
import json
from datetime import datetime, date
from decimal import Decimal
from contextlib import contextmanager
from threading import Lock

try:
    import psycopg2
    import psycopg2.pool
    import psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

_pool = None
_pool_lock = Lock()


def _get_database_url():
    return os.environ.get("DATABASE_URL", "")


def get_pool():
    global _pool
    if not PG_AVAILABLE:
        return None
    db_url = _get_database_url()
    if not db_url:
        return None
    with _pool_lock:
        if _pool is None or _pool.closed:
            try:
                _pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=1, maxconn=10, dsn=db_url
                )
                print("[db_service] PostgreSQL connection pool created")
            except Exception as e:
                print(f"[db_service] Failed to create pool: {e}")
                _pool = None
    return _pool


def is_available():
    pool = get_pool()
    if pool is None:
        return False
    try:
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            return True
        finally:
            pool.putconn(conn)
    except Exception:
        return False


@contextmanager
def get_conn():
    pool = get_pool()
    if pool is None:
        raise RuntimeError("PostgreSQL not available (no DATABASE_URL or psycopg2 missing)")
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


@contextmanager
def get_cursor(dict_cursor=True):
    with get_conn() as conn:
        factory = psycopg2.extras.RealDictCursor if dict_cursor else None
        with conn.cursor(cursor_factory=factory) as cur:
            yield cur


def _json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def row_to_dict(row):
    if row is None:
        return None
    result = dict(row)
    for k, v in result.items():
        if isinstance(v, (datetime, date)):
            result[k] = v.isoformat()
        elif isinstance(v, Decimal):
            result[k] = float(v)
    return result


def rows_to_list(rows):
    return [row_to_dict(r) for r in rows] if rows else []


def execute(sql, params=None):
    with get_cursor(dict_cursor=False) as cur:
        cur.execute(sql, params)
        return cur.rowcount


def fetch_one(sql, params=None):
    with get_cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return row_to_dict(row)


def fetch_all(sql, params=None):
    with get_cursor() as cur:
        cur.execute(sql, params)
        return rows_to_list(cur.fetchall())


def insert_returning(sql, params=None):
    with get_cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return row_to_dict(row)


def run_schema_file(filepath):
    with get_conn() as conn:
        with conn.cursor() as cur:
            with open(filepath, "r", encoding="utf-8") as f:
                cur.execute(f.read())
    print(f"[db_service] Schema file applied: {filepath}")


def ensure_schema():
    db_dir = os.path.join(os.path.dirname(__file__), "db")
    schema_files = sorted(
        f for f in os.listdir(db_dir)
        if f.endswith(".sql")
    )
    for sf in schema_files:
        try:
            run_schema_file(os.path.join(db_dir, sf))
        except Exception as e:
            print(f"[db_service] Error applying {sf}: {e}")


def status():
    """Return a dict describing DB availability."""
    available = is_available()
    return {
        "pg_available": PG_AVAILABLE,
        "database_url_set": bool(_get_database_url()),
        "connected": available,
    }
