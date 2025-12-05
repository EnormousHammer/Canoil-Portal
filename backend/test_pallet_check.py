#!/usr/bin/env python3
"""Verify Pallet charge does NOT get a batch number"""
import sys
import os
import io
import contextlib
sys.path.insert(0, '.')

from logistics_automation import parse_email_fallback
from raw_so_extractor import parse_sales_order_pdf

email = """Actuation Plus LLC purchase order number 8931 (Canoil sales order 3085 attached) is ready to go out the door:

3 drums of MOV Extra 0, batch number CCL-25337
1 drum of MOV Long Life 0, batch number WH5B16G031

720 kg total net weight

On 1 pallet 45×45×40 inches
"""

print("="*60)
print("PALLET CHARGE BATCH TEST")
print("="*60)

# Parse
email_data = parse_email_fallback(email)
so_path = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\Completed and Closed\2025\12\salesorder_3085.pdf'
f = io.StringIO()
with contextlib.redirect_stdout(f):
    so_data = parse_sales_order_pdf(so_path)

# Build email batch map
email_items_by_desc = {}
for email_item in email_data.get('items', []):
    desc = (email_item.get('description') or '').upper().strip()
    batch = (email_item.get('batch_number') or '').strip()
    if desc and batch:
        email_items_by_desc[desc] = batch

# Match batches to SO items (same logic as production)
for so_item in so_data.get('items', []):
    so_desc = so_item.get('description', '').upper().strip()
    matched = False
    
    # Method 1: Exact match
    if so_desc in email_items_by_desc:
        so_item['batch_number'] = email_items_by_desc[so_desc]
        matched = True
    
    # Method 2: Contained match
    if not matched:
        for email_desc, batch in email_items_by_desc.items():
            if email_desc in so_desc:
                so_item['batch_number'] = batch
                matched = True
                break

print("\nALL SO ITEMS WITH BATCH STATUS:")
print("-" * 60)

errors = []
for item in so_data.get('items', []):
    desc = item.get('description', '')
    batch = item.get('batch_number', '')
    
    print(f"\n   {desc}")
    print(f"      Batch: '{batch}' (empty = no batch)")
    
    # CRITICAL CHECK: Pallet should NOT have batch
    if 'pallet' in desc.lower():
        if batch:
            print(f"      ❌ ERROR: Pallet should NOT have batch number!")
            errors.append(f"Pallet has batch '{batch}' but should be empty")
        else:
            print(f"      ✅ CORRECT - Pallet has no batch")
    
    # Products should have correct batches
    elif 'MOV Extra 0' in desc:
        if batch == 'CCL-25337':
            print(f"      ✅ CORRECT")
        else:
            print(f"      ❌ WRONG! Expected CCL-25337")
            errors.append(f"MOV Extra 0: got '{batch}', expected 'CCL-25337'")
    
    elif 'MOV Long Life 0' in desc:
        if batch == 'WH5B16G031':
            print(f"      ✅ CORRECT")
        else:
            print(f"      ❌ WRONG! Expected WH5B16G031")
            errors.append(f"MOV Long Life 0: got '{batch}', expected 'WH5B16G031'")

print("\n" + "="*60)
if errors:
    print(f"❌ {len(errors)} ERROR(S):")
    for e in errors:
        print(f"   - {e}")
else:
    print("✅ ALL ITEMS CORRECT - Pallet has NO batch, products have correct batches!")

