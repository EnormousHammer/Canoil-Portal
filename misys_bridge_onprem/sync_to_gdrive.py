"""
MISys → Google Drive CSV Sync
==============================
Queries ALL MISys SQL tables and writes them as CSV files into a new
timestamped folder on the G: drive. The Canoil Portal app automatically
picks up the latest folder on next data load.

Every table from the CANOILCA database is exported as-is (raw SQL column
names, no renaming). This gives the backend full access to everything.

REQUIREMENTS:
  - Python 3.8+
  - pyodbc  (auto-installed)
  - VPN connected to office network (or on-site)
  - G: drive mounted (Google Drive for Desktop)

USAGE:
  python sync_to_gdrive.py              # run now
  python sync_to_gdrive.py --dry-run    # test SQL connection only, no writes
  python sync_to_gdrive.py --tables MIITEM MIPOH   # specific tables only

SCHEDULE (Windows Task Scheduler):
  Program:  python
  Args:     "G:\\...\\sync_to_gdrive.py"
  Start in: G:\\...\\misys_bridge_onprem\\
  Trigger:  Daily at 11:00 PM
"""

import os
import sys
import csv
import time
import argparse
import shutil
from datetime import datetime
from pathlib import Path


def _ensure_package(pkg, import_name=None):
    """Install a package if it's not already available."""
    import importlib, subprocess
    try:
        importlib.import_module(import_name or pkg)
    except ImportError:
        print(f"  [setup] Installing {pkg}...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', pkg, '--quiet'])


_ensure_package('python-dotenv', 'dotenv')
_ensure_package('pyodbc')

import pyodbc

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Fix Windows console encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ── Config ────────────────────────────────────────────────────────────────────

MISYS_SQL_HOST     = os.environ.get('MISYS_SQL_HOST',     '192.168.1.11')
MISYS_SQL_USER     = os.environ.get('MISYS_SQL_USER',     'sa')
MISYS_SQL_PASSWORD = os.environ.get('MISYS_SQL_PASSWORD', 'MISys_SBM1')
MISYS_SQL_DATABASE = os.environ.get('MISYS_SQL_DATABASE', 'CANOILCA')

GDRIVE_FULL_COMPANY = Path(
    r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys"
)

# How many old timestamped folders to keep (older ones are deleted)
KEEP_LAST_N_FOLDERS = 7

# Tables to always skip (system/temp tables that have no useful data)
SKIP_TABLES = set()

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_connection_string() -> str:
    return (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={MISYS_SQL_HOST};"
        f"DATABASE={MISYS_SQL_DATABASE};"
        f"UID={MISYS_SQL_USER};"
        f"PWD={MISYS_SQL_PASSWORD};"
        f"TrustServerCertificate=yes;"
        f"Connect Timeout=15;"
    )


def get_connection():
    """Open a pyodbc connection. Tries ODBC 17 then ODBC 13 as fallback."""
    drivers_to_try = [
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 13 for SQL Server",
        "SQL Server",
    ]
    last_err = None
    for driver in drivers_to_try:
        try:
            conn_str = (
                f"DRIVER={{{driver}}};"
                f"SERVER={MISYS_SQL_HOST};"
                f"DATABASE={MISYS_SQL_DATABASE};"
                f"UID={MISYS_SQL_USER};"
                f"PWD={MISYS_SQL_PASSWORD};"
                f"TrustServerCertificate=yes;"
                f"Connect Timeout=15;"
            )
            return pyodbc.connect(conn_str, timeout=15)
        except Exception as e:
            last_err = e
    raise RuntimeError(f"Could not connect with any ODBC driver. Last error: {last_err}")


def test_connection():
    """Test the MISys SQL connection. Returns (success: bool, message: str)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM MIITEM")
        cnt = cursor.fetchone()[0]
        conn.close()
        return True, f"Connected to {MISYS_SQL_DATABASE} on {MISYS_SQL_HOST}. MIITEM has {cnt:,} rows."
    except Exception as e:
        return False, str(e)


def get_all_table_names(conn) -> list:
    """Return all user table names in the database, sorted."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
    """)
    return [row[0] for row in cursor.fetchall()]


def dump_table_to_csv(conn, table_name: str, out_path: Path) -> int:
    """
    SELECT * from table_name and write to out_path as UTF-8 CSV.
    Returns row count. Returns 0 if table is empty or an error occurs.
    """
    try:
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM [{table_name}]")
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        if not rows:
            return 0

        with open(out_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(columns)
            for row in rows:
                writer.writerow([_fmt(v) for v in row])

        return len(rows)
    except Exception as e:
        print(f"    [warn] {table_name}: {e}")
        return -1  # error indicator


def _fmt(val):
    """Format a value for CSV output."""
    if val is None:
        return ''
    if isinstance(val, bool):
        return str(val)
    return val


def make_full_company_folder_name() -> str:
    """Returns: March 3, 2026_14-30"""
    now = datetime.now()
    return now.strftime("%B {d}, %Y_%H-%M").format(d=now.day)


def _is_dated(name: str) -> bool:
    """Check if folder name looks like a timestamped export folder."""
    import re
    # Matches: "March 3, 2026_12-33" or "2026-03-03_12-33"
    return bool(re.match(r'^(January|February|March|April|May|June|July|August|September|October|November|December|\d{4})', name))


def cleanup_old_folders(base: Path, keep: int):
    """Delete oldest dated folders, keeping only the last N."""
    folders = sorted(
        [f for f in base.iterdir() if f.is_dir() and _is_dated(f.name)],
        reverse=True  # newest first
    )
    to_delete = folders[keep:]
    for folder in to_delete:
        try:
            shutil.rmtree(folder)
            print(f"  [cleanup] Deleted old folder: {folder.name}")
        except Exception as e:
            print(f"  [cleanup] Could not delete {folder.name}: {e}")


def _write_manifest(folder: Path, tables_written: list, tables_empty: list, tables_error: list, ts: datetime):
    """Write a summary file into the synced folder."""
    total_rows = sum(r for _, r in tables_written)
    with open(folder / "_sync_manifest.txt", 'w', encoding='utf-8') as f:
        f.write(f"Synced at:      {ts.isoformat()}\n")
        f.write(f"SQL server:     {MISYS_SQL_HOST}\n")
        f.write(f"Database:       {MISYS_SQL_DATABASE}\n")
        f.write(f"Tables written: {len(tables_written)}\n")
        f.write(f"Tables empty:   {len(tables_empty)}\n")
        f.write(f"Tables error:   {len(tables_error)}\n")
        f.write(f"Total rows:     {total_rows:,}\n")
        f.write("\n--- Written tables (name: rows) ---\n")
        for name, rows in sorted(tables_written):
            f.write(f"  {name}: {rows:,} rows\n")
        if tables_empty:
            f.write("\n--- Empty tables (0 rows) ---\n")
            for name in sorted(tables_empty):
                f.write(f"  {name}\n")
        if tables_error:
            f.write("\n--- Tables with errors ---\n")
            for name in sorted(tables_error):
                f.write(f"  {name}\n")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Sync ALL MISys SQL tables -> Google Drive CSVs')
    parser.add_argument('--dry-run', action='store_true',
                        help='Test SQL connection only, do not write any files')
    parser.add_argument('--tables', nargs='+', metavar='TABLE',
                        help='Only sync specific tables (e.g. --tables MIITEM MIPOH)')
    parser.add_argument('--output', type=str, default=None,
                        help='Override output base folder path')
    args = parser.parse_args()

    print("=" * 60)
    print("  MISys -> Google Drive CSV Sync  (ALL TABLES)")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 1. Connect
    print(f"\n[1/4] Connecting to {MISYS_SQL_HOST} / {MISYS_SQL_DATABASE} ...")
    ok, msg = test_connection()
    if not ok:
        print(f"  ERROR: {msg}")
        print("  Make sure VPN is connected and MISys server is reachable.")
        sys.exit(1)
    print(f"  OK: {msg}")

    if args.dry_run:
        print("\n[dry-run] Connection OK. Skipping file writes.")
        return

    # 2. Get table list
    print("\n[2/4] Discovering tables ...")
    conn = get_connection()
    if args.tables:
        all_tables = [t.upper() for t in args.tables]
        print(f"  Syncing {len(all_tables)} specified tables.")
    else:
        all_tables = get_all_table_names(conn)
        all_tables = [t for t in all_tables if t not in SKIP_TABLES]
        print(f"  Found {len(all_tables)} tables in {MISYS_SQL_DATABASE}.")

    # 3. Verify G: drive
    base = Path(args.output) if args.output else GDRIVE_FULL_COMPANY
    if not base.exists():
        print(f"\n  ERROR: Destination folder not found:")
        print(f"  {base}")
        print("  Make sure Google Drive for Desktop is running and G: is mounted.")
        conn.close()
        sys.exit(1)

    # 4. Create timestamped folder and write CSVs
    folder_name = make_full_company_folder_name()
    out_folder = base / folder_name
    out_folder.mkdir(parents=True, exist_ok=True)
    print(f"\n[3/4] Writing CSVs to: {folder_name}")
    print(f"      Path: {out_folder}\n")

    t0 = time.time()
    tables_written = []   # [(name, row_count), ...]
    tables_empty   = []   # [name, ...]
    tables_error   = []   # [name, ...]

    for i, table_name in enumerate(all_tables, 1):
        csv_path = out_folder / f"{table_name}.CSV"
        row_count = dump_table_to_csv(conn, table_name, csv_path)

        if row_count > 0:
            tables_written.append((table_name, row_count))
            print(f"  [{i:3d}/{len(all_tables)}] {table_name:<20} {row_count:>8,} rows")
        elif row_count == 0:
            tables_empty.append(table_name)
            print(f"  [{i:3d}/{len(all_tables)}] {table_name:<20}   (empty)")
        else:
            tables_error.append(table_name)
            # warning already printed by dump_table_to_csv

    conn.close()

    # 5. Write manifest
    now = datetime.now()
    _write_manifest(out_folder, tables_written, tables_empty, tables_error, now)

    elapsed = time.time() - t0
    total_rows = sum(r for _, r in tables_written)
    print(f"\n  Written : {len(tables_written)} tables / {total_rows:,} rows")
    print(f"  Empty   : {len(tables_empty)} tables")
    if tables_error:
        print(f"  Errors  : {len(tables_error)} tables")
    print(f"  Time    : {elapsed:.1f}s")

    # 6. Cleanup old folders
    print(f"\n[4/4] Cleaning up old folders (keeping last {KEEP_LAST_N_FOLDERS}) ...")
    cleanup_old_folders(base, KEEP_LAST_N_FOLDERS)

    print(f"\nDONE: Sync complete.")
    print(f"  Folder: {folder_name}")
    print(f"  App will use this folder on next data load.\n")


if __name__ == '__main__':
    main()
