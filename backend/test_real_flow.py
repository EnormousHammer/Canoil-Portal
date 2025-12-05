#!/usr/bin/env python3
"""
REAL PRODUCTION FLOW TEST - Shows EXACTLY what happens
"""
import sys
import os
import re
sys.path.insert(0, '.')

print("="*80)
print("REAL PRODUCTION FLOW TEST")
print("="*80)

# EXACT email that failed
email = """Actuation Plus LLC purchase order number 8931 (Canoil sales order 3085 attached) is ready to go out the door:

3 drums of MOV Extra 0, batch number CCL-25337
1 drum of MOV Long Life 0, batch number WH5B16G031

720 kg total net weight

On 1 pallet 45×45×40 inches
"""

print("\n📧 INPUT EMAIL:")
print(email)

# Expected results
EXPECTED = {
    'MOV Extra 0': {'batch': 'CCL-25337', 'qty': 3},
    'MOV Long Life 0': {'batch': 'WH5B16G031', 'qty': 1},
}

print("\n✅ EXPECTED RESULTS:")
for product, data in EXPECTED.items():
    print(f"   {product}: Batch={data['batch']}, Qty={data['qty']}")

# ============================================================
# STEP 1: Test the regex patterns directly
# ============================================================
print("\n" + "="*60)
print("STEP 1: TEST REGEX PATTERNS")
print("="*60)

# This is the exact pattern from logistics_automation.py line 1243
batch_pattern = r'batch\s*number\s*([A-Za-z0-9\-]+)'

lines = email.split('\n')
for line in lines:
    if 'batch' in line.lower():
        match = re.search(batch_pattern, line, re.IGNORECASE)
        if match:
            print(f"   Line: {line.strip()}")
            print(f"   Extracted batch: '{match.group(1)}'")
            
            # Check if correct
            for product, data in EXPECTED.items():
                if product.lower() in line.lower():
                    if match.group(1) == data['batch']:
                        print(f"   ✅ CORRECT for {product}")
                    else:
                        print(f"   ❌ WRONG! Expected {data['batch']}, got {match.group(1)}")

# ============================================================
# STEP 2: Parse with fallback parser
# ============================================================
print("\n" + "="*60)
print("STEP 2: FALLBACK PARSER OUTPUT")
print("="*60)

from logistics_automation import parse_email_fallback
result = parse_email_fallback(email)

print(f"\n   SO Number: {result.get('so_number')}")
print(f"   Company: {result.get('company_name')}")
print(f"   Items count: {len(result.get('items', []))}")

print("\n   ITEMS:")
for i, item in enumerate(result.get('items', []), 1):
    desc = item.get('description', '')
    batch = item.get('batch_number', '')
    qty = item.get('quantity', '')
    
    print(f"\n   Item {i}:")
    print(f"      Description: {desc}")
    print(f"      Batch: {batch}")
    print(f"      Quantity: {qty}")
    
    # Verify
    for product, data in EXPECTED.items():
        if product.lower() in desc.lower():
            if batch == data['batch']:
                print(f"      ✅ BATCH CORRECT")
            else:
                print(f"      ❌ BATCH WRONG! Expected {data['batch']}")
            if str(qty) == str(data['qty']):
                print(f"      ✅ QTY CORRECT")
            else:
                print(f"      ❌ QTY WRONG! Expected {data['qty']}")

# ============================================================
# STEP 3: Parse SO PDF
# ============================================================
print("\n" + "="*60)
print("STEP 3: SO PDF PARSING")
print("="*60)

from raw_so_extractor import parse_sales_order_pdf
import io, contextlib

so_path = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production\Scheduled\salesorder_3085.pdf'
if not os.path.exists(so_path):
    so_path = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\Completed and Closed\2025\12\salesorder_3085.pdf'
    
if not os.path.exists(so_path):
    print(f"   ❌ SO file not found!")
else:
    f = io.StringIO()
    with contextlib.redirect_stdout(f):
        so_data = parse_sales_order_pdf(so_path)
    
    print(f"\n   SO Number: {so_data.get('so_number')}")
    print(f"   Customer: {so_data.get('customer_name')}")
    print(f"\n   SO ITEMS (before batch assignment):")
    for item in so_data.get('items', []):
        print(f"      - {item.get('description')}")

# ============================================================
# STEP 4: Batch matching logic (EXACT code from logistics_automation.py)
# ============================================================
print("\n" + "="*60)
print("STEP 4: BATCH MATCHING LOGIC")
print("="*60)

email_items = result.get('items', [])
so_items = so_data.get('items', [])

# Build the mapping (exact code from logistics_automation.py)
email_items_by_desc = {}
for email_item in email_items:
    desc = (email_item.get('description') or '').upper().strip()
    batch = (email_item.get('batch_number') or '').strip()
    if desc and batch:
        email_items_by_desc[desc] = {'batch_number': batch}
        print(f"   Mapped: '{desc}' → Batch: {batch}")

print(f"\n   Matching to SO items:")

for so_item in so_items:
    so_desc = so_item.get('description', '').upper().strip()
    matched = False
    
    # Method 1: Exact match
    if so_desc in email_items_by_desc:
        match_info = email_items_by_desc[so_desc]
        so_item['batch_number'] = match_info['batch_number']
        print(f"\n   SO: '{so_desc}'")
        print(f"      Method: EXACT MATCH")
        print(f"      Assigned Batch: {match_info['batch_number']}")
        matched = True
    
    # Method 2: Contained match  
    if not matched:
        for email_desc, match_info in email_items_by_desc.items():
            if email_desc in so_desc:
                so_item['batch_number'] = match_info['batch_number']
                print(f"\n   SO: '{so_desc}'")
                print(f"      Method: CONTAINED ('{email_desc}' in '{so_desc}')")
                print(f"      Assigned Batch: {match_info['batch_number']}")
                matched = True
                break
    
    if matched:
        # Verify
        for product, data in EXPECTED.items():
            if product.upper() in so_desc:
                if so_item['batch_number'] == data['batch']:
                    print(f"      ✅ CORRECT")
                else:
                    print(f"      ❌ WRONG! Expected {data['batch']}")
    elif 'PALLET' not in so_desc and 'CHARGE' not in so_desc:
        print(f"\n   SO: '{so_desc}' - NO MATCH")

# ============================================================
# FINAL SUMMARY
# ============================================================
print("\n" + "="*80)
print("FINAL VERIFICATION")
print("="*80)

errors = []
for so_item in so_items:
    so_desc = so_item.get('description', '').upper()
    batch = so_item.get('batch_number', '')
    
    for product, data in EXPECTED.items():
        if product.upper() in so_desc:
            if batch != data['batch']:
                errors.append(f"{product}: got '{batch}', expected '{data['batch']}'")

if errors:
    print(f"\n❌ {len(errors)} ERROR(S):")
    for e in errors:
        print(f"   - {e}")
else:
    print("\n✅ ALL BATCH NUMBERS CORRECTLY ASSIGNED!")
    print("\n   Final SO Items:")
    for item in so_items:
        desc = item.get('description', '')
        batch = item.get('batch_number', 'NOT SET')
        if 'PALLET' not in desc.upper() and 'CHARGE' not in desc.upper():
            print(f"      {desc}: Batch={batch}")

