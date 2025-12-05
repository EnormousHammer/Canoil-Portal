#!/usr/bin/env python3
"""Test that templates are filled correctly with parsed SO data - Multiple SOs"""
import sys
import os
sys.path.insert(0, '.')

from raw_so_extractor import parse_sales_order_pdf
from commercial_invoice_html_generator import generate_commercial_invoice_html
from packing_slip_html_generator import generate_packing_slip_html
from bs4 import BeautifulSoup
import io
import contextlib

# Test cases with different customer types
test_cases = [
    (r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\Completed and Closed\2025\12\salesorder_3086_R1.pdf', 
     'AXEL FRANCE (International)', {'consignee': 'AXEL', 'destination': 'FRANCE'}),
    (r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production\Scheduled\salesorder_3091.pdf', 
     'Chalmers & Kubeck (USA)', {'consignee': 'CHALMERS', 'destination': 'USA'}),
    (r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production\Scheduled\salesorder_3064.pdf', 
     'Big Red Oil (Canada PICKUP)', {'consignee': 'CANOIL', 'destination': 'CANADA'}),  # Ship to is PICKUP at Canoil
    (r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production\Scheduled\salesorder_3004_R1.pdf', 
     'AEC Group (USA)', {'consignee': 'AEC', 'destination': 'USA'}),
]

print("="*80)
print("COMPREHENSIVE TEMPLATE FILLING TEST")
print("="*80)

success_count = 0
fail_count = 0
all_errors = []

for pdf_path, name, expected in test_cases:
    if not os.path.exists(pdf_path):
        print(f"\n[SKIP] {name} - File not found")
        continue
    
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    
    errors = []
    
    try:
        # Suppress debug output
        f = io.StringIO()
        with contextlib.redirect_stdout(f):
            so_data = parse_sales_order_pdf(pdf_path)
        
        if not so_data:
            errors.append("Failed to parse SO")
        else:
            # Generate Commercial Invoice
            items = so_data.get('items', [])
            
            f = io.StringIO()
            with contextlib.redirect_stdout(f):
                ci_html = generate_commercial_invoice_html(so_data, items)
            
            soup = BeautifulSoup(ci_html, 'html.parser')
            
            # Check consignee field
            consignee_field = soup.find(id='consigneeInfo')
            consignee_value = (consignee_field.string or consignee_field.get_text()) if consignee_field else ''
            
            if expected['consignee'].upper() in consignee_value.upper():
                print(f"  ✅ CI Consignee contains '{expected['consignee']}'")
            else:
                errors.append(f"CI Consignee missing '{expected['consignee']}' - got: {consignee_value[:50]}...")
                print(f"  ❌ CI Consignee missing '{expected['consignee']}'")
            
            # Check destination field
            dest_field = soup.find(id='finalDestination')
            dest_value = dest_field.get('value', '') if dest_field else ''
            
            if expected['destination'].upper() in dest_value.upper():
                print(f"  ✅ CI Destination contains '{expected['destination']}'")
            else:
                errors.append(f"CI Destination missing '{expected['destination']}' - got: {dest_value}")
                print(f"  ❌ CI Destination missing '{expected['destination']}'")
            
            # Check Packing Slip
            f = io.StringIO()
            with contextlib.redirect_stdout(f):
                ps_html = generate_packing_slip_html(so_data, {}, items)
            
            soup_ps = BeautifulSoup(ps_html, 'html.parser')
            
            # Check SO number in packing slip
            ps_so_field = soup_ps.find(id='packing-slip-so-number') or soup_ps.find(id='so-number')
            so_num = so_data.get('so_number', '')
            
            # Look for SO number anywhere in the HTML
            if so_num and so_num in ps_html:
                print(f"  ✅ Packing Slip has SO# {so_num}")
            else:
                errors.append(f"Packing Slip missing SO# {so_num}")
                print(f"  ❌ Packing Slip missing SO# {so_num}")
            
            # Check items in packing slip
            product_items = [i for i in items if 'pallet' not in str(i.get('description', '')).lower() 
                           and 'charge' not in str(i.get('description', '')).lower()
                           and 'freight' not in str(i.get('description', '')).lower()]
            
            if len(product_items) > 0:
                first_item_desc = product_items[0].get('description', '')
                # Check if first item appears in packing slip
                if first_item_desc and any(word in ps_html for word in first_item_desc.split()[:2]):
                    print(f"  ✅ Packing Slip has items")
                else:
                    errors.append(f"Packing Slip missing items")
                    print(f"  ❌ Packing Slip missing items")
            
            # Summary for this SO
            if not errors:
                print(f"  ✅ ALL CHECKS PASSED for {name}")
                success_count += 1
            else:
                print(f"  ❌ {len(errors)} error(s) for {name}")
                fail_count += 1
                all_errors.extend([(name, e) for e in errors])
                
    except Exception as e:
        errors.append(f"Exception: {str(e)[:100]}")
        fail_count += 1
        all_errors.append((name, str(e)[:100]))
        print(f"  ❌ Exception: {str(e)[:50]}...")

print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"✅ Passed: {success_count}")
print(f"❌ Failed: {fail_count}")

if all_errors:
    print("\nALL ERRORS:")
    for name, error in all_errors:
        print(f"  - {name}: {error}")
else:
    print("\n🎉 ALL TEMPLATE FILLING TESTS PASSED!")
