import json
import os
import re
from datetime import datetime

GDRIVE_BASE = r'G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions'
folders = [f for f in os.listdir(GDRIVE_BASE) if os.path.isdir(os.path.join(GDRIVE_BASE, f))]
folders.sort(reverse=True)
latest = folders[0]

folder_path = os.path.join(GDRIVE_BASE, latest)

with open(os.path.join(folder_path, 'PurchaseOrderDetails.json'), 'r', encoding='utf-8') as f:
    po_details = json.load(f)

# Analyze Unit Cost vs Unit Price across ALL PO details
total = 0
same = 0
cost_zero = 0
price_zero = 0
both_zero = 0
cost_higher = 0
price_higher = 0

print('=' * 70)
print('ANALYSIS: Unit Cost vs Unit Price across ALL PO Details')
print('=' * 70)

examples_cost_zero = []
examples_different = []

for detail in po_details:
    total += 1
    cost = detail.get('Unit Cost', 0) or 0
    price = detail.get('Unit Price', 0) or 0
    
    if cost == price:
        same += 1
    elif cost == 0 and price > 0:
        cost_zero += 1
        if len(examples_cost_zero) < 5:
            examples_cost_zero.append({
                'item': detail.get('Item No.'),
                'po': detail.get('PO No.'),
                'cost': cost,
                'price': price
            })
    elif price == 0 and cost > 0:
        price_zero += 1
    elif cost == 0 and price == 0:
        both_zero += 1
    elif cost > price:
        cost_higher += 1
        if len(examples_different) < 5:
            examples_different.append({
                'item': detail.get('Item No.'),
                'po': detail.get('PO No.'),
                'cost': cost,
                'price': price,
                'diff': 'cost > price'
            })
    else:
        price_higher += 1
        if len(examples_different) < 5:
            examples_different.append({
                'item': detail.get('Item No.'),
                'po': detail.get('PO No.'),
                'cost': cost,
                'price': price,
                'diff': 'price > cost'
            })

print(f'Total PO Details: {total}')
print(f'Same (Cost = Price): {same} ({100*same/total:.1f}%)')
print(f'Cost is 0, Price > 0: {cost_zero} ({100*cost_zero/total:.1f}%)')
print(f'Price is 0, Cost > 0: {price_zero} ({100*price_zero/total:.1f}%)')
print(f'Both are 0: {both_zero} ({100*both_zero/total:.1f}%)')
print(f'Cost > Price: {cost_higher}')
print(f'Price > Cost: {price_higher}')

if examples_cost_zero:
    print()
    print('Examples where Unit Cost = 0 but Unit Price > 0:')
    for ex in examples_cost_zero:
        print(f"  {ex['item']} (PO {ex['po']}): Cost=${ex['cost']}, Price=${ex['price']}")

if examples_different:
    print()
    print('Examples where Cost != Price (both > 0):')
    for ex in examples_different:
        print(f"  {ex['item']} (PO {ex['po']}): Cost=${ex['cost']}, Price=${ex['price']} ({ex['diff']})")

# Now check what the current code is using
print()
print('=' * 70)
print('CHECKING CURRENT PR SERVICE CODE')
print('=' * 70)

# Read the current code
with open('purchase_requisition_service.py', 'r', encoding='utf-8') as f:
    code = f.read()

if 'Unit Cost' in code:
    print('Current code uses: Unit Cost')
elif 'Unit Price' in code:
    print('Current code uses: Unit Price')
else:
    print('Could not determine which field the code uses')

# Find the exact line
import re
match = re.search(r"'(Unit (?:Cost|Price))'", code)
if match:
    print(f"Found field reference: {match.group(1)}")


















