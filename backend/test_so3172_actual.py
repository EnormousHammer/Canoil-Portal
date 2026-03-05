#!/usr/bin/env python3
"""
Verify SO 3172: Run actual extractor and matching logic with REAL data.
No guessing - see exactly what the system returns.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

# SO 3172 path from conversation
SO_3172_PATH = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production\Scheduled\salesorder_3172_GRTP SRI-USD_PO 0602-26.pdf"

def main():
    if not os.path.exists(SO_3172_PATH):
        print(f"ERROR: PDF not found: {SO_3172_PATH}")
        print("Run this on a machine with G: drive mounted.")
        return 1

    from raw_so_extractor import parse_sales_order_pdf
    from logistics_automation import _core_product_for_matching, _packaging_type_for_matching, _packaging_compatible

    print("=" * 60)
    print("SO 3172 - ACTUAL EXTRACTOR OUTPUT")
    print("=" * 60)

    so_data = parse_sales_order_pdf(SO_3172_PATH)
    if not so_data:
        print("ERROR: Extractor returned None")
        return 1

    items = so_data.get('items', [])
    print(f"\nSO items count: {len(items)}")
    for i, it in enumerate(items, 1):
        desc = it.get('description', '')
        qty = it.get('quantity', '')
        code = it.get('item_code', '')
        print(f"  Item {i}: desc='{desc}' qty={qty} code='{code}'")

    # Email items (from user's test - what GPT would extract)
    email_items = [
        "Canoil H1 Food & Beverage #2 pail",
        "Canoil H1 Food & Beverage #2 master box - 30 x 400g",
    ]

    print("\n" + "=" * 60)
    print("MATCHING SIMULATION (email vs SO)")
    print("=" * 60)

    so_item_names = [it.get('description', '').upper() for it in items]
    so_item_names = [d for d in so_item_names if d and 'FREIGHT' not in d and 'CHARGE' not in d and 'BROKERAGE' not in d]

    for email_desc in email_items:
        item_desc = email_desc.upper().strip()
        print(f"\nEmail: '{item_desc}'")
        email_core = _core_product_for_matching(item_desc)
        email_pkg = _packaging_type_for_matching(item_desc)
        print(f"  -> core='{email_core}' pkg={email_pkg}")

        for so_desc in so_item_names:
            so_core = _core_product_for_matching(so_desc)
            so_pkg = _packaging_type_for_matching(so_desc)
            core_match = email_core and so_core and (email_core in so_core or so_core in email_core or email_core == so_core)
            pkg_ok = _packaging_compatible(email_pkg, so_pkg)
            print(f"  vs SO '{so_desc[:50]}...'")
            print(f"     so_core='{so_core}' so_pkg={so_pkg}")
            print(f"     core_match={core_match} pkg_ok={pkg_ok} -> MATCH={core_match and pkg_ok}")

    return 0

if __name__ == '__main__':
    sys.exit(main())
