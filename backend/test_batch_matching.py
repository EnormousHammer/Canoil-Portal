#!/usr/bin/env python3
"""Test that batch numbers are correctly matched to the right items in ALL templates"""
import sys
import os
import json
import io
import contextlib
sys.path.insert(0, '.')

from logistics_automation import parse_email_with_gpt4
from raw_so_extractor import parse_sales_order_pdf
from new_bol_generator import populate_new_bol_html, filter_actual_items, extract_batch_numbers
from packing_slip_html_generator import generate_packing_slip_html
from bs4 import BeautifulSoup

# The Axel France email
test_email = """Hi Haron,

Received, please find the detailed information below:

AXEL FRANCE-USD purchase order number 29354 (Canoil sales order 3086 attached) is ready to go out the door:

8 drums of MOV Long Life 0, batch number WH5B16G031
2 drums of MOV Long Life 2, batch number WH3H10G002

1,800 kg total net weight

On 3 pallets, 45×45×40 inches each
"""

expected = {
    'MOV Long Life 0': 'WH5B16G031',
    'MOV Long Life 2': 'WH3H10G002',
}

print("="*80)
print("COMPREHENSIVE BATCH NUMBER TEST - ALL TEMPLATES")
print("="*80)

errors = []

# Step 1: Parse email
print("\n>> STEP 1: Parse Email")
f = io.StringIO()
with contextlib.redirect_stdout(f):
    email_data = parse_email_with_gpt4(test_email)

print(f"   Items extracted: {len(email_data.get('items', []))}")
for item in email_data.get('items', []):
    print(f"     - {item.get('description')}: Batch={item.get('batch_number')}")

# Step 2: Parse SO PDF
print("\n>> STEP 2: Parse SO PDF")
so_path = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\Completed and Closed\2025\12\salesorder_3086_R1.pdf'

f = io.StringIO()
with contextlib.redirect_stdout(f):
    so_data = parse_sales_order_pdf(so_path)

# Step 3: Match email batches to SO items
print("\n>> STEP 3: Match Email Batches to SO Items")
email_items_by_desc = {}
for email_item in email_data.get('items', []):
    desc = (email_item.get('description') or '').upper().strip()
    batch = (email_item.get('batch_number') or '').strip()
    if desc and batch:
        email_items_by_desc[desc] = batch

for so_item in so_data.get('items', []):
    so_desc = so_item.get('description', '').upper().strip()
    for email_desc, batch in email_items_by_desc.items():
        if email_desc in so_desc or so_desc in email_desc:
            so_item['batch_number'] = batch
            print(f"   ✅ Matched: {so_item.get('description')} → {batch}")
            break

# Step 4: Test BOL Template
print("\n>> STEP 4: Check BOL Template")
f = io.StringIO()
with contextlib.redirect_stdout(f):
    bol_html = populate_new_bol_html(so_data, email_data)

soup = BeautifulSoup(bol_html, 'html.parser')
tbody = soup.find('tbody')
if tbody:
    rows = tbody.find_all('tr')
    for row in rows[:2]:  # First 2 rows should be items
        cells = row.find_all('td')
        if len(cells) >= 2:
            desc_cell = cells[1].find('input')
            if desc_cell:
                desc_value = desc_cell.get('value', '')
                for product, exp_batch in expected.items():
                    if product.upper() in desc_value.upper():
                        if exp_batch in desc_value:
                            print(f"   BOL: ✅ {product} has correct batch {exp_batch}")
                        else:
                            print(f"   BOL: ❌ {product} MISSING batch {exp_batch}")
                            errors.append(f"BOL: {product} missing batch {exp_batch}")

# Step 5: Test Packing Slip Template
print("\n>> STEP 5: Check Packing Slip Template")
items = filter_actual_items(so_data.get('items', []))

f = io.StringIO()
with contextlib.redirect_stdout(f):
    ps_html = generate_packing_slip_html(so_data, {}, items)

soup_ps = BeautifulSoup(ps_html, 'html.parser')
for i in range(1, 6):
    field = soup_ps.find(id=f'item_description_{i}')
    if field:
        desc_value = field.get('value', '')
        if desc_value:
            for product, exp_batch in expected.items():
                if product.upper() in desc_value.upper():
                    if exp_batch in desc_value:
                        print(f"   Packing Slip: ✅ {product} has correct batch {exp_batch}")
                    else:
                        print(f"   Packing Slip: ❌ {product} MISSING batch {exp_batch}")
                        errors.append(f"Packing Slip: {product} missing batch {exp_batch}")

# Final Summary
print("\n" + "="*80)
print("FINAL SUMMARY")
print("="*80)

if errors:
    print(f"❌ {len(errors)} BATCH ERROR(S):")
    for e in errors:
        print(f"   - {e}")
else:
    print("✅ ALL BATCH NUMBERS CORRECTLY FILLED IN ALL TEMPLATES!")
    print("   - BOL: ✅")
    print("   - Packing Slip: ✅")
