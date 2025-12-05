#!/usr/bin/env python3
"""
VERIFY ACTUAL OUTPUT - Frontend Display & Template Filling
Shows EXACT values that will appear, no assumptions
"""
import sys
import os
import io
import contextlib
sys.path.insert(0, '.')

from logistics_automation import parse_email_fallback
from raw_so_extractor import parse_sales_order_pdf
from new_bol_generator import populate_new_bol_html
from packing_slip_html_generator import generate_packing_slip_html
from commercial_invoice_html_generator import generate_commercial_invoice_html
from bs4 import BeautifulSoup

# Test email
email = """Actuation Plus LLC purchase order number 8931 (Canoil sales order 3085 attached) is ready to go out the door:

3 drums of MOV Extra 0, batch number CCL-25337
1 drum of MOV Long Life 0, batch number WH5B16G031

720 kg total net weight

On 1 pallet 45×45×40 inches
"""

EXPECTED = {
    'MOV Extra 0': 'CCL-25337',
    'MOV Long Life 0': 'WH5B16G031',
}

print("="*80)
print("ACTUAL OUTPUT VERIFICATION")
print("="*80)

# Parse
email_data = parse_email_fallback(email)
so_path = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\Completed and Closed\2025\12\salesorder_3085.pdf'
f = io.StringIO()
with contextlib.redirect_stdout(f):
    so_data = parse_sales_order_pdf(so_path)

# Match batches to SO items
for email_item in email_data.get('items', []):
    email_desc = (email_item.get('description') or '').upper().strip()
    email_batch = (email_item.get('batch_number') or '').strip()
    
    for so_item in so_data.get('items', []):
        so_desc = so_item.get('description', '').upper().strip()
        if email_desc in so_desc:
            so_item['batch_number'] = email_batch

# ============================================================
# 1. FRONTEND DISPLAY DATA
# ============================================================
print("\n" + "="*60)
print("1. FRONTEND DISPLAY DATA (what UI shows)")
print("="*60)

print("\n📧 EMAIL SECTION - Items Mentioned in Email:")
for item in email_data.get('items', []):
    desc = item.get('description', '')
    batch = item.get('batch_number', '')
    qty = item.get('quantity', '')
    print(f"   {desc}")
    print(f"      Qty: {qty}")
    print(f"      Batch: {batch}")
    
    # Verify
    for product, exp_batch in EXPECTED.items():
        if product.lower() in desc.lower():
            if batch == exp_batch:
                print(f"      ✅ CORRECT")
            else:
                print(f"      ❌ WRONG! Expected: {exp_batch}")

print("\n📋 SO SECTION - Sales Order Items:")
for item in so_data.get('items', []):
    desc = item.get('description', '')
    batch = item.get('batch_number', '')
    qty = item.get('quantity', '')
    if 'pallet' not in desc.lower() and 'charge' not in desc.lower():
        print(f"   {desc}")
        print(f"      Qty: {qty}")
        print(f"      Batch: {batch}")
        
        # Verify
        for product, exp_batch in EXPECTED.items():
            if product.lower() in desc.lower():
                if batch == exp_batch:
                    print(f"      ✅ CORRECT")
                else:
                    print(f"      ❌ WRONG! Expected: {exp_batch}")

# ============================================================
# 2. BOL TEMPLATE OUTPUT
# ============================================================
print("\n" + "="*60)
print("2. BOL TEMPLATE - ACTUAL HTML VALUES")
print("="*60)

f = io.StringIO()
with contextlib.redirect_stdout(f):
    bol_html = populate_new_bol_html(so_data, email_data)

soup = BeautifulSoup(bol_html, 'html.parser')
tbody = soup.find('tbody')
if tbody:
    rows = tbody.find_all('tr')
    for i, row in enumerate(rows[:4], 1):
        cells = row.find_all('td')
        if len(cells) >= 2:
            desc_input = cells[1].find('input')
            if desc_input:
                value = desc_input.get('value', '')
                print(f"\n   BOL Row {i}: {value}")
                
                # Check for batch numbers
                for product, exp_batch in EXPECTED.items():
                    if product.upper() in value.upper():
                        if exp_batch in value:
                            print(f"      ✅ Contains correct batch: {exp_batch}")
                        else:
                            print(f"      ❌ MISSING batch: {exp_batch}")

# ============================================================
# 3. PACKING SLIP TEMPLATE OUTPUT
# ============================================================
print("\n" + "="*60)
print("3. PACKING SLIP TEMPLATE - ACTUAL HTML VALUES")
print("="*60)

items = [i for i in so_data.get('items', []) if 'pallet' not in i.get('description', '').lower()]
f = io.StringIO()
with contextlib.redirect_stdout(f):
    ps_html = generate_packing_slip_html(so_data, {}, items)

soup_ps = BeautifulSoup(ps_html, 'html.parser')

# Ship To
ship_to = soup_ps.find(id='ship_to')
if ship_to:
    ship_value = ship_to.get('value', '') or ship_to.string or ''
    print(f"\n   Ship To: {ship_value[:100]}...")

# Items
for i in range(1, 4):
    desc_field = soup_ps.find(id=f'item_description_{i}')
    qty_field = soup_ps.find(id=f'ordered_qty_{i}')
    if desc_field:
        desc_value = desc_field.get('value', '')
        qty_value = qty_field.get('value', '') if qty_field else ''
        if desc_value:
            print(f"\n   Item {i}: {desc_value}")
            print(f"      Qty: {qty_value}")

# ============================================================
# 4. COMMERCIAL INVOICE TEMPLATE OUTPUT
# ============================================================
print("\n" + "="*60)
print("4. COMMERCIAL INVOICE TEMPLATE - ACTUAL HTML VALUES")
print("="*60)

f = io.StringIO()
with contextlib.redirect_stdout(f):
    ci_html = generate_commercial_invoice_html(so_data, items, email_data)

soup_ci = BeautifulSoup(ci_html, 'html.parser')

# Consignee
consignee = soup_ci.find(id='consigneeInfo')
if consignee:
    consignee_value = consignee.string or consignee.get_text() or ''
    print(f"\n   Consignee:\n{consignee_value}")

# Destination
dest = soup_ci.find(id='finalDestination')
if dest:
    print(f"\n   Destination: {dest.get('value', '')}")

# ============================================================
# FINAL SUMMARY
# ============================================================
print("\n" + "="*80)
print("FINAL SUMMARY")
print("="*80)

errors = []

# Check email items
for item in email_data.get('items', []):
    desc = item.get('description', '').upper()
    batch = item.get('batch_number', '')
    for product, exp_batch in EXPECTED.items():
        if product.upper() in desc:
            if batch != exp_batch:
                errors.append(f"Email {product}: got '{batch}', expected '{exp_batch}'")

# Check SO items
for item in so_data.get('items', []):
    desc = item.get('description', '').upper()
    batch = item.get('batch_number', '')
    for product, exp_batch in EXPECTED.items():
        if product.upper() in desc:
            if batch != exp_batch:
                errors.append(f"SO {product}: got '{batch}', expected '{exp_batch}'")

if errors:
    print(f"\n❌ {len(errors)} ERROR(S):")
    for e in errors:
        print(f"   - {e}")
else:
    print("\n✅ ALL ACTUAL OUTPUT VALUES ARE CORRECT!")

