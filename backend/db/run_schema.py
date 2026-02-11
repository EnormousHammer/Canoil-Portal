#!/usr/bin/env python3
"""
Apply the Postgres schema (01_schema.sql) to the database given by DATABASE_URL.

Usage:
  Set DATABASE_URL (e.g. postgresql://user:pass@localhost:5432/canoil_misys)
  Then from repo root or backend:
    python -m db.run_schema
  Or:
    python backend/db/run_schema.py

Requires: psycopg2 or psycopg2-binary (pip install psycopg2-binary), or psql on PATH.
"""

import os
import sys
from pathlib import Path

# Resolve path to this script and 01_schema.sql
SCRIPT_DIR = Path(__file__).resolve().parent
SCHEMA_FILE = SCRIPT_DIR / "01_schema.sql"


def run_with_psycopg2(url: str) -> bool:
    try:
        import psycopg2
    except ImportError:
        return False
    sql = SCHEMA_FILE.read_text(encoding="utf-8", errors="replace")
    conn = psycopg2.connect(url)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print("Schema applied successfully (psycopg2).")
        return True
    except Exception as e:
        conn.rollback()
        print("Error applying schema:", e, file=sys.stderr)
        raise
    finally:
        conn.close()


def run_with_psql(url: str) -> bool:
    """Run psql -f 01_schema.sql using subprocess. URL must be acceptable to psql."""
    import subprocess
    # psql expects libpq connection string; postgresql:// is fine
    env = os.environ.copy()
    env["PGDATABASE"] = ""  # clear so URL is used
    cmd = ["psql", url, "-f", str(SCHEMA_FILE)]
    try:
        subprocess.run(cmd, check=True, env=env)
        print("Schema applied successfully (psql).")
        return True
    except FileNotFoundError:
        return False
    except subprocess.CalledProcessError as e:
        print("psql failed:", e, file=sys.stderr)
        raise


def main() -> None:
    if not SCHEMA_FILE.exists():
        print("Schema file not found:", SCHEMA_FILE, file=sys.stderr)
        sys.exit(1)

    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print(
            "Set DATABASE_URL to your Postgres connection string, e.g.:\n"
            "  postgresql://user:password@localhost:5432/canoil_misys",
            file=sys.stderr,
        )
        sys.exit(1)

    if run_with_psycopg2(url):
        return
    if run_with_psql(url):
        return

    print(
        "Could not run schema: install psycopg2 (pip install psycopg2-binary) or run manually:\n"
        f"  psql -d your_db -f {SCHEMA_FILE}",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
