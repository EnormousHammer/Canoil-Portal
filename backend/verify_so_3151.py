#!/usr/bin/env python3
"""
Verify SO 3151 data - what the app actually parses from the PDF.
Run from backend/: python verify_so_3151.py
Requires: backend running with G: drive or Google Drive API, OR pass --mock to use document structure.
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def run_mock():
    """Use exact structure from SO 3151 document - no PDF fetch."""
    print("=" * 60)
    print("SO 3151 - MOCK (document structure from your screenshot)")
    print("=" * 60)
    so_items = [
        {'description': '(42612) Laser 2T Semi-Synthetic Blue 24x3.4oz (100ml) Case', 'item_code': 'LZ 2T SEMI-SYN BL 24x3.4oz', 'quantity': 240, 'unit': 'Case'},
        {'description': 'Laser 2 Cycle Premium Smokeless Oil - 6x946 ml case (42615)', 'item_code': 'LZ 2T SEMI-SYN BL 6X946', 'quantity': 320, 'unit': 'Case'},
    ]
    for i, item in enumerate(so_items, 1):
        print(f"  Line {i}: qty={item['quantity']} | {item['item_code']}")
        print(f"         desc: {item['description']}")
    print("\nExpected email match: 240 cases (42612), 320 cases (42615)")
    return True

def run_fetch():
    """Fetch actual SO 3151 from system (PDF parse)."""
    try:
        import logistics_automation as la
        if hasattr(la, '_so_data_cache') and '3151' in la._so_data_cache:
            del la._so_data_cache['3151']
        if hasattr(la, '_so_cache_timestamps') and '3151' in la._so_cache_timestamps:
            del la._so_cache_timestamps['3151']
        get_so_data_from_system = la.get_so_data_from_system
    except ImportError:
        print("Could not import logistics_automation")
        return False

    print("=" * 60)
    print("SO 3151 - FETCHING FROM SYSTEM (PDF parse)")
    print("(Uses G: drive or Google Drive API)")
    print("=" * 60)
    so_data = get_so_data_from_system('3151')
    if not so_data:
        print("  ERROR: No data returned")
        return False
    if so_data.get('status') == 'Error':
        print(f"  ERROR: {so_data.get('error')}")
        return False

    items = so_data.get('items', [])
    print(f"  Customer: {so_data.get('customer_name', 'N/A')}")
    print(f"  Items: {len(items)}")
    print()
    for i, item in enumerate(items, 1):
        desc = item.get('description', '')
        code = item.get('item_code', '')
        qty = item.get('quantity', item.get('ordered', '?'))
        print(f"  Line {i}: qty={qty} | {code}")
        print(f"         desc: {desc}")
        # Check for 42615 in description (critical for Laser 2 Cycle match)
        if '42615' in desc or '42615' in str(code):
            print(f"         [OK] 42615 found - Laser 2 Cycle will match")
        elif '42612' in desc or '42612' in str(code):
            print(f"         [OK] 42612 found - Laser 2T will match")
        print()
    return True

if __name__ == '__main__':
    if '--mock' in sys.argv:
        run_mock()
    else:
        run_fetch()
