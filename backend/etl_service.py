"""
ETL automation service. Wraps the existing CLI ETL script to run on-demand
or on a schedule from the portal backend.
"""
import os
import sys
import threading
from datetime import datetime
from pathlib import Path

_last_run = None
_last_status = None
_running = False
_lock = threading.Lock()

FULL_COMPANY_DATA_PATHS = [
    r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys",
]


def _find_latest_subfolder(base_path):
    if not os.path.isdir(base_path):
        return None
    subs = []
    for entry in os.scandir(base_path):
        if entry.is_dir():
            subs.append(entry.path)
    if not subs:
        return base_path
    subs.sort(key=lambda p: os.path.getctime(p), reverse=True)
    return subs[0]


def _find_data_folder():
    for base in FULL_COMPANY_DATA_PATHS:
        folder = _find_latest_subfolder(base)
        if folder and os.path.isdir(folder):
            return folder
    return None


def run_etl(triggered_by="manual"):
    """Run ETL from Full Company Data folder -> Postgres staging -> core.
    Returns dict with status."""
    global _last_run, _last_status, _running

    with _lock:
        if _running:
            return {"status": "already_running", "last_run": _last_run}
        _running = True

    try:
        import db_service
        if not db_service.is_available():
            _last_status = {"status": "error", "error": "PostgreSQL not available"}
            return _last_status

        folder = _find_data_folder()
        if not folder:
            _last_status = {"status": "error", "error": "No Full Company Data folder found"}
            return _last_status

        db_service.execute(
            """INSERT INTO core.etl_runs (source_path, triggered_by)
               VALUES (%s, %s)""",
            (folder, triggered_by)
        )

        backend_dir = Path(__file__).resolve().parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        from db.etl_full_company_to_postgres import load_staging, upsert_core
        from full_company_data_converter import load_from_folder
        import psycopg2

        data, err = load_from_folder(folder)
        if err or not data:
            error_msg = err or "no data loaded"
            db_service.execute(
                """UPDATE core.etl_runs SET status='failed', finished_at=NOW(),
                   error_message=%s WHERE id=(SELECT MAX(id) FROM core.etl_runs)""",
                (error_msg,)
            )
            _last_status = {"status": "error", "error": error_msg}
            return _last_status

        db_url = os.environ.get("DATABASE_URL", "")
        conn = psycopg2.connect(db_url)
        try:
            load_staging(conn, data, source_file_default="auto_etl")
            upsert_core(conn)
        finally:
            conn.close()

        now = datetime.utcnow().isoformat() + "Z"
        _last_run = now

        db_service.execute(
            """UPDATE core.etl_runs SET status='completed', finished_at=NOW()
               WHERE id=(SELECT MAX(id) FROM core.etl_runs)"""
        )

        _last_status = {
            "status": "completed",
            "folder": folder,
            "finished_at": now,
            "triggered_by": triggered_by,
        }
        return _last_status

    except Exception as e:
        error_msg = str(e)
        try:
            import db_service
            db_service.execute(
                """UPDATE core.etl_runs SET status='failed', finished_at=NOW(),
                   error_message=%s WHERE id=(SELECT MAX(id) FROM core.etl_runs)""",
                (error_msg,)
            )
        except Exception:
            pass
        _last_status = {"status": "error", "error": error_msg}
        return _last_status
    finally:
        with _lock:
            _running = False


def run_etl_async(triggered_by="scheduled"):
    """Run ETL in a background thread."""
    t = threading.Thread(target=run_etl, args=(triggered_by,), daemon=True)
    t.start()
    return {"status": "started", "triggered_by": triggered_by}


def get_status():
    """Return latest ETL run status."""
    try:
        import db_service
        if db_service.is_available():
            row = db_service.fetch_one(
                "SELECT * FROM core.etl_runs ORDER BY id DESC LIMIT 1"
            )
            if row:
                return {"last_run": row, "running": _running}
    except Exception:
        pass
    return {"last_run": _last_status, "running": _running}
