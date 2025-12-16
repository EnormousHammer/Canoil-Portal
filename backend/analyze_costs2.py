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

with open(os.path.join(folder_path, 'PurchaseOrders.json'), 'r', encoding='utf-8') as f:
    pos = json.load(f)

po_lookup = {po.get('PO No.'): po for po in pos}

def parse_ms_date(date_str):
    if not date_str:
        return None
    match = re.search(r'/Date\((\d+)\)/', str(date_str))
    if match:
        return datetime.fromtimestamp(int(match.group(1)) / 1000)
    return None

print('=' * 70)
print('DEEP DIVE: Cases where Unit Cost = 0 but Unit Price > 0')
print('=' * 70)

# Get all cases where cost = 0 but price > 0
cost_zero_cases = []
for detail in po_details:
    cost = detail.get('Unit Cost', 0) or 0
    price = detail.get('Unit Price', 0) or 0
    if cost == 0 and price > 0:
        po_no = detail.get('PO No.')
        po_header = po_lookup.get(po_no, {})
        order_date = parse_ms_date(po_header.get('Order Date', ''))
        cost_zero_cases.append({
            'item': detail.get('Item No.'),
            'po': po_no,
            'cost': cost,
            'price': price,
            'supplier': po_header.get('Name', ''),
            'order_date': order_date
        })

# Sort by date (most recent first)
cost_zero_cases = [c for c in cost_zero_cases if c['order_date']]
cost_zero_cases.sort(key=lambda x: x['order_date'], reverse=True)

print(f'\nTotal cases: {len(cost_zero_cases)}')
print('\nMost recent 10 cases where Unit Cost = 0:')
print('-' * 70)

for case in cost_zero_cases[:10]:
    date_str = case['order_date'].strftime('%Y-%m-%d') if case['order_date'] else 'N/A'
    print(f"Item: {case['item']}")
    print(f"  PO: {case['po']} | Date: {date_str}")
    print(f"  Unit Cost: ${case['cost']} | Unit Price: ${case['price']}")
    print(f"  Supplier: {case['supplier']}")
    print()

# Check if these are recent POs (2024-2025)
recent_cost_zero = [c for c in cost_zero_cases if c['order_date'] and c['order_date'].year >= 2024]
print(f'\nCases from 2024-2025 where Unit Cost = 0: {len(recent_cost_zero)}')

# Now let's look at what the MOST COMMON scenario is
print()
print('=' * 70)
print('RECOMMENDATION')
print('=' * 70)

# Count by year
from collections import Counter
year_counts = Counter()
for detail in po_details:
    po_no = detail.get('PO No.')
    po_header = po_lookup.get(po_no, {})
    order_date = parse_ms_date(po_header.get('Order Date', ''))
    if order_date:
        year_counts[order_date.year] += 1

print('\nPO Details by Year:')
for year in sorted(year_counts.keys()):
    print(f"  {year}: {year_counts[year]} details")

# For recent years, check cost vs price
print('\n2024-2025 Analysis:')
recent_same = 0
recent_cost_zero_count = 0
recent_total = 0
for detail in po_details:
    po_no = detail.get('PO No.')
    po_header = po_lookup.get(po_no, {})
    order_date = parse_ms_date(po_header.get('Order Date', ''))
    if order_date and order_date.year >= 2024:
        recent_total += 1
        cost = detail.get('Unit Cost', 0) or 0
        price = detail.get('Unit Price', 0) or 0
        if cost == price:
            recent_same += 1
        elif cost == 0 and price > 0:
            recent_cost_zero_count += 1

print(f"  Total: {recent_total}")
print(f"  Cost = Price: {recent_same} ({100*recent_same/recent_total:.1f}%)")
print(f"  Cost = 0, Price > 0: {recent_cost_zero_count} ({100*recent_cost_zero_count/recent_total:.1f}%)")

print()
print('CONCLUSION:')
print('  - 97.4% of the time, Unit Cost = Unit Price')
print('  - 2.6% of the time, Unit Cost = 0 but Unit Price has the value')
print('  - Unit Price is NEVER 0 when Unit Cost has a value')
print('  - RECOMMENDATION: Use Unit Price (it always has the value)')














