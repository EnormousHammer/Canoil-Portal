"""
Raw MISys Tables Loader
=======================
Reads every CSV file from a Full Company Data folder and returns them
as a plain dict: { "MIITEM": [...rows...], "MIACCT": [...rows...], ... }

This is the "read everything" counterpart to full_company_data_converter.py.
No column remapping, no filtering — raw SQL data exactly as exported.

Usage:
    from raw_tables_loader import load_raw_tables

    tables, err = load_raw_tables("/path/to/Full Company Data/March 3, 2026_14-30")
    # tables["MIITEM"]  -> list of dicts with raw MISys column names
    # tables["MIACCT"]  -> list of dicts
    # etc.
"""

import os
import csv
import io
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Files to skip when scanning a folder
_SKIP_STEMS = {"_sync_manifest", "_manifest", "desktop", "thumbs"}


def _read_csv_file(file_path: Path) -> tuple:
    """
    Read a single CSV file. Returns (stem, rows) where rows is a list of dicts.
    Returns (stem, None) on error.
    """
    stem = file_path.stem.upper()
    try:
        # Try UTF-8 with BOM first (our sync writes utf-8-sig), fall back to cp1252
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
            try:
                with open(file_path, "r", encoding=encoding, newline="") as f:
                    reader = csv.DictReader(f)
                    rows = []
                    for row in reader:
                        # Strip whitespace from keys and values
                        clean = {k.strip(): (v.strip() if isinstance(v, str) else v)
                                 for k, v in row.items() if k is not None}
                        rows.append(clean)
                    return stem, rows
            except UnicodeDecodeError:
                continue
        return stem, None
    except Exception as e:
        print(f"[raw_tables_loader] Error reading {file_path.name}: {e}")
        return stem, None


def load_raw_tables(folder_path, parallel: bool = True) -> tuple:
    """
    Load all CSV files from folder_path into a dict of { TABLE_NAME: [rows] }.

    Args:
        folder_path: str or Path to the data folder
        parallel: use ThreadPoolExecutor for faster loading (default True)

    Returns:
        (tables_dict, error_message)
        tables_dict is None on failure, error_message is None on success.
    """
    folder = Path(folder_path)
    if not folder.exists():
        return None, f"Folder not found: {folder}"
    if not folder.is_dir():
        return None, f"Not a directory: {folder}"

    csv_files = [
        f for f in folder.iterdir()
        if f.suffix.upper() == ".CSV"
        and f.stem.upper() not in _SKIP_STEMS
    ]

    if not csv_files:
        return {}, None  # empty folder, not an error

    tables = {}
    errors = []

    if parallel and len(csv_files) > 4:
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(_read_csv_file, f): f for f in csv_files}
            for future in as_completed(futures):
                stem, rows = future.result()
                if rows is not None:
                    tables[stem] = rows
                else:
                    errors.append(stem)
    else:
        for f in csv_files:
            stem, rows = _read_csv_file(f)
            if rows is not None:
                tables[stem] = rows
            else:
                errors.append(stem)

    if errors:
        print(f"[raw_tables_loader] Could not read {len(errors)} files: {errors}")

    return tables, None


def get_table_summary(tables: dict) -> dict:
    """
    Returns a summary dict: { TABLE_NAME: row_count }
    Useful for the /api/raw-tables/summary endpoint.
    """
    return {name: len(rows) for name, rows in tables.items()}


def find_latest_folder(base_path) -> Path | None:
    """
    Find the most recently modified timestamped folder under base_path.
    Returns the Path or None if none found.
    """
    import re
    base = Path(base_path)
    if not base.exists():
        return None

    dated_dirs = [
        d for d in base.iterdir()
        if d.is_dir() and re.match(
            r'^(January|February|March|April|May|June|July|August|September|October|November|December|\d{4})',
            d.name
        )
    ]
    if not dated_dirs:
        return None

    # Sort by modification time, most recent first
    return sorted(dated_dirs, key=lambda d: d.stat().st_mtime, reverse=True)[0]
