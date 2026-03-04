#!/usr/bin/env python3
"""
Get REAL column headers from Full Company Data CSV files. NO GUESSING.
Run this when you have the export folder locally (G: drive or same path).
Output: exact column names from MIITEM.CSV and MIILOCQT.CSV - use these for mapping.
"""
import os
import sys

# Default path - Full Company Data From Misys
DEFAULT_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys"

def main():
    base = os.environ.get('FULL_COMPANY_DATA_PATH', DEFAULT_BASE)
    if not os.path.isdir(base):
        print(f"Folder not found: {base}")
        print("Set FULL_COMPANY_DATA_PATH to your Full Company Data parent folder")
        return 1

    # Find latest subfolder - prefer YYYY-MM-DD date folders
    subdirs = [d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))]
    if not subdirs:
        print(f"No subfolders in {base}")
        return 1
    # Prefer date folders (YYYY-MM-DD), else alphabetical
    date_folders = [d for d in subdirs if len(d) == 10 and d[4] == '-' and d[7] == '-' and d.replace('-', '').isdigit()]
    latest = sorted(date_folders)[-1] if date_folders else sorted(subdirs)[-1]
    folder = os.path.join(base, latest)
    print("=" * 60)
    print("REAL CSV headers from Full Company Data")
    print("=" * 60)
    print(f"Folder: {folder}\n")

    for fname in ['MIITEM.CSV', 'MIILOCQT.CSV', 'MIILOC.CSV']:
        path = os.path.join(folder, fname)
        if not os.path.isfile(path):
            # Try case-insensitive
            for x in os.listdir(folder):
                if x.upper() == fname.upper():
                    path = os.path.join(folder, x)
                    break
        if not os.path.isfile(path):
            print(f"--- {fname} --- NOT FOUND")
            continue
        print(f"--- {fname} ---")
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            first = f.readline()
        headers = [h.strip().strip('"') for h in first.split(',')]
        print(f"Columns ({len(headers)}): {headers}")
        qty_like = [h for h in headers if any(x in h.lower() for x in ['qty', 'qstk', 'stock', 'hand', 'order', 'wip', 'res'])]
        if qty_like:
            print(f"  Qty/stock related: {qty_like}")
        print()
    print("=" * 60)
    print("Use these EXACT column names in full_company_data_converter.py")
    print("=" * 60)
    return 0


if __name__ == '__main__':
    sys.exit(main())
