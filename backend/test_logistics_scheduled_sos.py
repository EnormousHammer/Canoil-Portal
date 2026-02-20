#!/usr/bin/env python3
"""
Test logistics validation against a pool of Scheduled SOs.
Builds synthetic emails from SO items and runs process-email to verify the fix.

REQUIREMENTS:
  1. Backend running: cd backend && python app.py  (or start_server.py)
  2. OPENAI_API_KEY set in .env (for SO parsing + email parsing)
  3. G: drive mounted OR so_cache populated (for SO PDFs)

RUN: cd backend && python test_logistics_scheduled_sos.py
"""
import os
import re
import sys
import json
import glob
import requests

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SCHEDULED_PATH = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production\Scheduled'
API_URL = 'http://localhost:5002/api/logistics/process-email'
MAX_SOS = 15  # Limit for quick run; increase for full pool


def get_scheduled_so_numbers():
    """Get SO numbers from Scheduled folder or cache."""
    so_numbers = set()
    
    # Try cache first (faster, no G: drive needed)
    cache_path = os.path.join(os.path.dirname(__file__), 'so_cache', 'cache_metadata.json')
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            entries = data.get('entries', []) if isinstance(data, dict) else []
            for entry in entries:
                path = entry.get('path', '') if isinstance(entry, dict) else ''
                if 'Scheduled' in path and 'salesorder_' in path.lower():
                    m = re.search(r'salesorder_(\d+)', path, re.I)
                    if m:
                        so_numbers.add(m.group(1))
        except Exception as e:
            print(f"  [WARN] Cache read failed: {e}")
    
    # Fallback: glob Scheduled folder
    if not so_numbers and os.path.exists(SCHEDULED_PATH):
        for f in glob.glob(os.path.join(SCHEDULED_PATH, 'salesorder_*.pdf')):
            m = re.search(r'salesorder_(\d+)', os.path.basename(f), re.I)
            if m:
                so_numbers.add(m.group(1))
    
    sorted_nums = sorted(so_numbers, key=lambda x: int(x))[:MAX_SOS]
    # Always include SO 3139 (Georgia Western - the fix target) if in pool
    if '3139' in so_numbers and '3139' not in sorted_nums:
        sorted_nums = ['3139'] + [n for n in sorted_nums if n != '3139'][:MAX_SOS - 1]
    return sorted_nums


def build_synthetic_email(so_number, so_items):
    """Build email content that GPT can parse - matches SO items exactly."""
    lines = [f"Sales Order {so_number} ready to ship.", ""]
    for item in so_items:
        desc = item.get('description') or ''
        qty = item.get('quantity') or item.get('ordered') or item.get('Ordered Qty') or 0
        unit = (item.get('unit') or 'units').upper()
        unit_plural = unit if unit.endswith('S') else unit + 's'
        try:
            qty_num = float(str(qty).replace(',', ''))
        except (ValueError, TypeError):
            qty_num = 1
        lines.append(f"{int(qty_num)} {unit_plural} of {desc}")
    return "\n".join(lines)


def test_single_so(so_number):
    """Test one SO: fetch it, build synthetic email, POST to process-email."""
    # First, we need SO items to build the email. Process-email will fetch SO from system.
    # So we build a generic email - but GPT might parse it differently. Let's use a simpler approach:
    # Build email from SO items. We need to parse the SO first to get items.
    from raw_so_extractor import parse_sales_order_pdf
    
    # Find SO file
    so_file = None
    if os.path.exists(SCHEDULED_PATH):
        for f in glob.glob(os.path.join(SCHEDULED_PATH, f'*{so_number}*.pdf')):
            if re.search(rf'salesorder_{so_number}[_\s]', os.path.basename(f), re.I) or os.path.basename(f) == f'salesorder_{so_number}.pdf':
                so_file = f
                break
        if not so_file:
            for f in glob.glob(os.path.join(SCHEDULED_PATH, '*.pdf')):
                if f'salesorder_{so_number}' in os.path.basename(f).lower():
                    so_file = f
                    break
    
    if not so_file or not os.path.exists(so_file):
        return {'ok': False, 'error': f'SO file not found for {so_number}'}
    
    try:
        so_data = parse_sales_order_pdf(so_file)
    except Exception as e:
        return {'ok': False, 'error': f'Parse failed: {e}'}
    
    if not so_data:
        return {'ok': False, 'error': 'Parse returned empty'}
    
    items = so_data.get('items', [])
    if not items:
        return {'ok': False, 'error': 'SO has no items'}
    
    # Filter out non-product lines
    product_items = []
    for it in items:
        desc = (it.get('description') or '').upper()
        if any(skip in desc for skip in ['FREIGHT', 'CHARGE', 'PALLET CHARGE', 'BROKERAGE']):
            continue
        product_items.append(it)
    
    if not product_items:
        return {'ok': False, 'error': 'SO has no product items'}
    
    email_content = build_synthetic_email(so_number, product_items)
    
    try:
        resp = requests.post(API_URL, json={'email_content': email_content}, timeout=90)
    except requests.exceptions.ConnectionError:
        return {'ok': False, 'error': 'Backend not running (Connection refused)'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    
    if resp.status_code != 200:
        return {'ok': False, 'error': f'HTTP {resp.status_code}', 'body': resp.text[:200]}
    
    result = resp.json()
    status = result.get('status', '')
    validation = result.get('validation_details', {})
    items_check = validation.get('items_check', {})
    
    if status == 'Error':
        err = result.get('error', 'Unknown error')
        return {'ok': False, 'error': err}
    
    # Check item validation
    all_matched = items_check.get('status') == 'passed'
    unmatched = items_check.get('unmatched_items', [])
    qty_mismatches = items_check.get('quantity_mismatches', [])

    # Build clear error message
    err_msg = None
    if not all_matched:
        if items_check.get('status') == 'warning':
            err_msg = items_check.get('message', 'No items to validate')
        elif unmatched:
            err_msg = f"Unmatched: {[u.get('email_item') for u in unmatched]}"
        elif qty_mismatches:
            err_msg = f"Qty mismatch: {[q.get('quantity_details') for q in qty_mismatches]}"
        else:
            err_msg = items_check.get('message', str(unmatched or qty_mismatches or 'Unknown'))

    return {
        'ok': all_matched and status != 'Error',
        'status': status,
        'items_matched': items_check.get('matched_items', 0),
        'items_total': len(product_items),
        'unmatched': unmatched,
        'error': err_msg,
        'validation': items_check
    }


def main():
    print("=" * 70)
    print("LOGISTICS VALIDATION TEST - Scheduled SOs Pool")
    print("=" * 70)
    print(f"API: {API_URL}")
    print(f"Max SOs: {MAX_SOS}")
    print()
    
    so_numbers = get_scheduled_so_numbers()
    if not so_numbers:
        print("No scheduled SOs found. Check G: drive or so_cache.")
        return 1
    
    print(f"Testing {len(so_numbers)} SOs: {', '.join(so_numbers)}")
    print()
    
    passed = 0
    failed = 0
    results = []
    
    for so_num in so_numbers:
        r = test_single_so(so_num)
        results.append((so_num, r))
        if r.get('ok'):
            passed += 1
            print(f"  SO {so_num}: PASS ({r.get('items_matched', '?')}/{r.get('items_total', '?')} items)")
        else:
            failed += 1
            err = r.get('error') or r.get('unmatched') or 'Unknown'
            print(f"  SO {so_num}: FAIL - {err}")
    
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total:  {passed + failed}")
    
    if failed > 0:
        print("\nFailed SOs:")
        for so_num, r in results:
            if not r.get('ok'):
                print(f"  - SO {so_num}: {r.get('error', r.get('unmatched', 'N/A'))}")
    
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
