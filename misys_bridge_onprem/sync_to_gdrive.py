"""
MISys → Google Drive CSV Sync
==============================
Queries all MISys SQL tables and writes them as CSV files into a new
timestamped folder on the G: drive. The Canoil Portal app automatically
picks up the latest folder on next data load.

REQUIREMENTS:
  - Python 3.8+
  - pyodbc  (pip install pyodbc)
  - VPN connected to office network (or on-site)
  - G: drive mounted (Google Drive for Desktop)

USAGE:
  python sync_to_gdrive.py              # run now
  python sync_to_gdrive.py --dry-run    # test SQL connection only, no file writes

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

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Add script directory to path so misys_service.py can be found
sys.path.insert(0, str(Path(__file__).parent))
import misys_service

# Fix Windows console encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ── Config ────────────────────────────────────────────────────────────────────

GDRIVE_FULL_COMPANY = Path(
    r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys"
)

# How many old folders to keep (older ones are deleted automatically)
KEEP_LAST_N_FOLDERS = 7

# ── Helpers ───────────────────────────────────────────────────────────────────

def make_folder_name() -> str:
    """Returns timestamped folder name: 2026-03-03_14-30  (for API Extractions)"""
    return datetime.now().strftime("%Y-%m-%d_%H-%M")


def make_full_company_folder_name() -> str:
    """Returns human-readable timestamped folder name: March 3, 2026_14-30  (for Full Company Data)"""
    return datetime.now().strftime("%B %-d, %Y_%H-%M") if sys.platform != 'win32' \
        else datetime.now().strftime("%B {d}, %Y_%H-%M").format(d=datetime.now().day)


def write_table_csv(folder: Path, table_name: str, rows: list, aliases: dict) -> int:
    """Write a list of row-dicts to a CSV file. Returns row count."""
    if not rows:
        return 0

    # Use human-readable column aliases if available, otherwise raw keys
    raw_keys = list(rows[0].keys())

    # Build filename from first alias target (e.g. Items.json → MIITEM.csv)
    csv_filename = f"{table_name}.csv"
    out_path = folder / csv_filename

    with open(out_path, 'w', newline='', encoding='utf-8-sig') as f:
        # Header: use alias values (human names) if provided, else raw SQL column names
        if aliases:
            # aliases = {sql_col: human_name, ...}  — invert to get header order
            header = [aliases.get(k, k) for k in raw_keys]
        else:
            header = raw_keys

        writer = csv.writer(f)
        writer.writerow(header)
        for row in rows:
            writer.writerow([_fmt(row.get(k)) for k in raw_keys])

    return len(rows)


def _fmt(val):
    """Format a value for CSV output."""
    if val is None:
        return ''
    if isinstance(val, bool):
        return str(val)
    return val


def _write_manifest(folder: Path, table_count: int, total_rows: int, ts: datetime):
    """Write a small summary file into the synced folder."""
    with open(folder / "_sync_manifest.txt", 'w') as f:
        f.write(f"Synced at:   {ts.isoformat()}\n")
        f.write(f"Tables:      {table_count}\n")
        f.write(f"Total rows:  {total_rows:,}\n")
        f.write(f"SQL server:  {os.environ.get('MISYS_SQL_HOST', '192.168.1.11')}\n")
        f.write(f"Database:    {os.environ.get('MISYS_SQL_DATABASE', 'CANOILCA')}\n")


def cleanup_old_folders(base: Path, keep: int):
    """Delete oldest dated folders, keeping only the last N."""
    folders = sorted(
        [f for f in base.iterdir() if f.is_dir() and _is_dated(f.name)],
        reverse=True  # newest first
    )
    to_delete = folders[keep:]
    for folder in to_delete:
        try:
            import shutil
            shutil.rmtree(folder)
            print(f"  [cleanup] Deleted old folder: {folder.name}")
        except Exception as e:
            print(f"  [cleanup] Could not delete {folder.name}: {e}")


def _is_dated(name: str) -> bool:
    """Check if folder name looks like a date: 2026-03-03 or 2026-03-03_14-30"""
    import re
    return bool(re.match(r'^\d{4}-\d{2}-\d{2}', name))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Sync MISys SQL → Google Drive CSVs')
    parser.add_argument('--dry-run', action='store_true',
                        help='Test SQL connection only, do not write any files')
    parser.add_argument('--output', type=str, default=None,
                        help='Override output base folder path')
    args = parser.parse_args()

    print("=" * 60)
    print("  MISys -> Google Drive CSV Sync")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 1. Test SQL connection
    print("\n[1/4] Testing MISys SQL connection...")
    ok, msg = misys_service.test_connection()
    if not ok:
        print(f"  ❌ Connection failed: {msg}")
        print("  Make sure VPN is connected and MISys server is reachable.")
        sys.exit(1)
    print(f"  ✅ {msg}")

    if args.dry_run:
        print("\n[dry-run] Connection OK. Skipping file writes.")
        return

    # 2. Load all data from MISys SQL
    print("\n[2/4] Loading all MISys tables...")
    t0 = time.time()
    data, err = misys_service.load_all_data()
    elapsed = time.time() - t0

    if data is None or err:
        print(f"  ❌ Failed to load data: {err}")
        sys.exit(1)

    table_count = sum(1 for v in data.values() if isinstance(v, list) and len(v) > 0)
    total_rows  = sum(len(v) for v in data.values() if isinstance(v, list))
    print(f"  ✅ Loaded {table_count} tables / {total_rows:,} rows in {elapsed:.1f}s")

    # 3. Verify G: drive is mounted — Full Company Data is the required destination
    if not GDRIVE_FULL_COMPANY.exists():
        print(f"\n  ERROR: Full Company Data folder not found:")
        print(f"  {GDRIVE_FULL_COMPANY}")
        print("  Make sure Google Drive for Desktop is running and G: is mounted.")
        sys.exit(1)

    tables_def = getattr(misys_service, '_TABLES', {})
    now = datetime.now()
    fc_folder_name = make_full_company_folder_name()

    # ── PRIMARY: Full Company Data (always) ───────────────────────────────────
    # Folder name: "March 3, 2026_12-33"  File names: MIITEM.CSV (matches manual MISys export)
    fc_folder = GDRIVE_FULL_COMPANY / fc_folder_name
    fc_folder.mkdir(parents=True, exist_ok=True)
    print(f"\n[3/4] Writing to Full Company Data -> {fc_folder}")

    fc_written = 0
    for table_name, rows in data.items():
        if not isinstance(rows, list) or not rows:
            continue
        csv_path = fc_folder / f"{table_name}.CSV"
        with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            for row in rows:
                writer.writerow({k: _fmt(v) for k, v in row.items()})
        fc_written += 1

    _write_manifest(fc_folder, fc_written, total_rows, now)
    print(f"  OK: {fc_written} CSV files written to: {fc_folder_name}")

    # 4. Cleanup old Full Company Data folders
    print(f"\n[4/4] Cleaning up old folders (keeping last {KEEP_LAST_N_FOLDERS})...")
    cleanup_old_folders(GDRIVE_FULL_COMPANY, KEEP_LAST_N_FOLDERS)

    total_time = time.time() - t0
    print(f"\nDONE: Sync complete in {total_time:.1f}s")
    print(f"  Saved to: {GDRIVE_FULL_COMPANY}")
    print(f"  Folder  : {fc_folder_name}")
    print(f"  App will use this folder on next data load.\n")


if __name__ == '__main__':
    main()
