#!/usr/bin/env python3
"""
Get REAL column names from MISys database. NO GUESSING.
Run this on a machine with VPN/network access to 192.168.1.11.
Output: exact column names for MIITEM, MIILOC, MIILOCQT - use these for mapping.
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def main():
    try:
        import pymssql
    except ImportError:
        print("ERROR: pymssql not installed. Run: pip install pymssql")
        print("Then run this script from a machine with VPN access to 192.168.1.11")
        return 1

    host = os.environ.get('MISYS_SQL_HOST', '192.168.1.11')
    user = os.environ.get('MISYS_SQL_USER', 'sa')
    password = os.environ.get('MISYS_SQL_PASSWORD', 'MISys_SBM1')
    database = os.environ.get('MISYS_SQL_DATABASE', 'CANOILCA')

    print("=" * 60)
    print("MISys REAL schema - column names from database")
    print("=" * 60)
    print(f"Connecting to {host} / {database}...")

    try:
        conn = pymssql.connect(
            server=host,
            user=user,
            password=password,
            database=database,
            login_timeout=15,
        )
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Ensure you're on VPN and can reach 192.168.1.11")
        return 1

    cursor = conn.cursor()

    tables = ['MIITEM', 'MIILOC', 'MIILOCQT']
    for table in tables:
        print(f"\n--- {table} ---")
        try:
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = %s
                ORDER BY ORDINAL_POSITION
            """, (table,))
            rows = cursor.fetchall()
            if rows:
                cols = [r[0] for r in rows]
                print(f"Columns ({len(cols)}): {', '.join(cols)}")
                # Stock-related columns
                qty_cols = [c for c in cols if any(x in c.lower() for x in ['qty', 'qstk', 'qwip', 'qres', 'qord', 'stock', 'hand', 'order', 'wip', 'res'])]
                if qty_cols:
                    print(f"  Qty/stock related: {qty_cols}")
            else:
                print(f"  (table not found or empty)")
        except Exception as e:
            print(f"  Error: {e}")

    # Sample row from MIILOCQT (if exists) to see actual values
    print("\n--- MIILOCQT sample row (first row) ---")
    try:
        cursor.execute("SELECT TOP 1 * FROM MIILOCQT")
        row = cursor.fetchone()
        if row:
            cols = [d[0] for d in cursor.description]
            print("Keys:", cols)
            for i, c in enumerate(cols):
                print(f"  {c}: {row[i]}")
        else:
            print("  (no rows)")
    except Exception as e:
        print(f"  Error (table may not exist): {e}")

    # Sample row from MIILOC
    print("\n--- MIILOC sample row (first row with qty) ---")
    try:
        cursor.execute("SELECT TOP 1 * FROM MIILOC WHERE qtyOnHand > 0 OR qStk > 0")
        row = cursor.fetchone()
        if row:
            cols = [d[0] for d in cursor.description]
            print("Keys:", cols)
            for i, c in enumerate(cols):
                print(f"  {c}: {row[i]}")
        else:
            cursor.execute("SELECT TOP 1 * FROM MIILOC")
            row = cursor.fetchone()
            if row:
                cols = [d[0] for d in cursor.description]
                print("Keys:", cols)
                for i, c in enumerate(cols):
                    print(f"  {c}: {row[i]}")
            else:
                print("  (no rows)")
    except Exception as e:
        print(f"  Error: {e}")

    # MIITEM sample - stock fields
    print("\n--- MIITEM sample (first item, stock-related fields) ---")
    try:
        cursor.execute("SELECT TOP 1 itemId, totQStk, totQWip, totQRes, totQOrd FROM MIITEM")
        row = cursor.fetchone()
        if row:
            cols = [d[0] for d in cursor.description]
            print("Keys:", cols)
            for i, c in enumerate(cols):
                print(f"  {c}: {row[i]}")
        else:
            print("  (no rows)")
    except Exception as e:
        print(f"  Error (trying alternate columns): {e}")
        try:
            cursor.execute("SELECT TOP 1 * FROM MIITEM")
            row = cursor.fetchone()
            if row:
                cols = [d[0] for d in cursor.description]
                qty_like = [c for c in cols if any(x in c.lower() for x in ['qty', 'qstk', 'stock', 'tot'])]
                print("All columns:", cols)
                print("Stock-like:", qty_like)
        except Exception as e2:
            print(f"  {e2}")

    conn.close()
    print("\n" + "=" * 60)
    print("Copy the column names above into full_company_data_converter.py")
    print("=" * 60)
    return 0


if __name__ == '__main__':
    sys.exit(main())
