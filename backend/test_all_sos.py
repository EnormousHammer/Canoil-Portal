#!/usr/bin/env python3
"""Test SO parsing on multiple SO types"""
import sys
import os
import glob
sys.path.insert(0, '.')
from raw_so_extractor import parse_sales_order_pdf

# Find a variety of SOs from different folders
so_files = []

# Scheduled SOs
scheduled_path = r'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production\Scheduled'
if os.path.exists(scheduled_path):
    files = glob.glob(os.path.join(scheduled_path, 'salesorder_*.pdf'))
    so_files.extend([(f, f'Scheduled - {os.path.basename(f)}') for f in files[:5]])

# Completed SOs from Nov & Dec 2025
for month in ['11', '12']:
    completed_path = rf'G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\Completed and Closed\2025\{month}'
    if os.path.exists(completed_path):
        files = glob.glob(os.path.join(completed_path, 'salesorder_*.pdf'))
        so_files.extend([(f, f'Completed {month}/2025 - {os.path.basename(f)}') for f in files[:3]])

print("="*80)
print(f"COMPREHENSIVE SO PARSING TEST - Testing {len(so_files)} SOs")
print("="*80)

success_count = 0
fail_count = 0
issues = []

for pdf_path, name in so_files:
    if not os.path.exists(pdf_path):
        continue
        
    print(f"\n{'='*60}")
    print(f"TESTING: {name}")
    print(f"{'='*60}")
    
    try:
        # Suppress debug output for cleaner results
        import io
        import contextlib
        
        f = io.StringIO()
        with contextlib.redirect_stdout(f):
            result = parse_sales_order_pdf(pdf_path)
        
        if result:
            so_num = result.get("so_number", "???")
            customer = result.get("customer_name", "???")
            
            ba = result.get('billing_address', {})
            sa = result.get('shipping_address', {})
            
            billing_full = ba.get("full_address", "")
            shipping_full = sa.get("full_address", "")
            
            print(f"SO#: {so_num} | Customer: {customer[:30]}...")
            
            # Check for issues
            so_issues = []
            
            # Issue: MO in address
            import re
            if re.search(r'\bMOs?\s+\d+', billing_full) or re.search(r'\bMOs?\s+\d+', shipping_full):
                so_issues.append("MO reference in address")
            if 'Child MO' in billing_full or 'Child MO' in shipping_full:
                so_issues.append("Child MO in address")
                
            # Issue: Phone in address
            if re.search(r'\(\d{3}\)', billing_full) or re.search(r'\(\d{3}\)', shipping_full):
                so_issues.append("Phone number in address")
                
            # Issue: Empty address
            if not billing_full.strip():
                so_issues.append("Empty billing address")
            if not shipping_full.strip():
                so_issues.append("Empty shipping address")
            
            # Issue: Very short company name
            if len(ba.get('company', '')) < 3:
                so_issues.append("Missing/short billing company")
            if len(sa.get('company', '')) < 3:
                so_issues.append("Missing/short shipping company")
            
            print(f"  BILLING: {ba.get('company', 'N/A')[:40]}")
            print(f"  SHIPPING: {sa.get('company', 'N/A')[:40]}")
            
            if so_issues:
                print(f"  ⚠️ ISSUES: {', '.join(so_issues)}")
                issues.append((name, so_issues))
                fail_count += 1
            else:
                print(f"  ✅ PASS")
                success_count += 1
        else:
            print(f"  ❌ FAILED TO PARSE")
            fail_count += 1
            issues.append((name, ["Parse failed"]))
            
    except Exception as e:
        print(f"  ❌ ERROR: {str(e)[:50]}")
        fail_count += 1
        issues.append((name, [str(e)[:50]]))

print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"✅ Passed: {success_count}")
print(f"❌ Failed: {fail_count}")
print(f"Total: {success_count + fail_count}")

if issues:
    print("\nISSUES FOUND:")
    for name, issue_list in issues:
        print(f"  - {name}: {', '.join(issue_list)}")
