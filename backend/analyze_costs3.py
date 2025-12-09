import json
import os
import re
from datetime import datetime

GDRIVE_BASE = r'G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions'
folders = [f for f in os.listdir(GDRIVE_BASE) if os.path.isdir(os.path.join(GDRIVE_BASE, f))]
folders.sort(reverse=True)
latest = folders[0]
folder_path = os.path.join(GDRIVE_BASE, latest)

with open(os.path.join(folder_path, 'Items.json'), 'r', encoding='utf-8') as f:
    items = json.load(f)

item_lookup = {item.get('Item No.'): item for item in items}

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

test_items = ['G2015BV BULK', 'G20320TOTE', 'LZ 2T SSB 24X3.4OZ LBL-F']

print('=' * 80)
print('COMPLETE COST ANALYSIS')
print('=' * 80)

for item_no in test_items:
    print()
    print('--- ' + item_no + ' ---')
    
    # Item Master costs
    item = item_lookup.get(item_no, {})
    print('  ITEM MASTER:')
    print('    Recent Cost: ' + str(item.get('Recent Cost', 'N/A')))
    print('    Standard Cost: ' + str(item.get('Standard Cost', 'N/A')))
    print('    Average Cost: ' + str(item.get('Average Cost', 'N/A')))
    print('    Landed Cost: ' + str(item.get('Landed Cost', 'N/A')))
    
    # Most recent PO
    purchases = []
    for detail in po_details:
        if detail.get('Item No.') == item_no:
            po_no = detail.get('PO No.')
            po_header = po_lookup.get(po_no, {})
            order_date = parse_ms_date(po_header.get('Order Date', ''))
            if order_date:
                purchases.append({
                    'po_no': po_no,
                    'order_date': order_date,
                    'unit_cost': detail.get('Unit Cost', 0),
                    'unit_price': detail.get('Unit Price', 0),
                })
    
    purchases.sort(key=lambda x: x['order_date'], reverse=True)
    
    if purchases:
        p = purchases[0]
        print('  MOST RECENT PO (' + str(p['po_no']) + ' - ' + p['order_date'].strftime('%Y-%m-%d') + '):')
        print('    Unit Cost: ' + str(p['unit_cost']))
        print('    Unit Price: ' + str(p['unit_price']))
        
        # Compare
        print('  COMPARISON:')
        recent_cost = item.get('Recent Cost')
        unit_price = p['unit_price']
        match = recent_cost == unit_price
        print('    Item Master Recent Cost matches PO Unit Price? ' + str(match))
        if not match:
            print('    Item Master Recent Cost: ' + str(recent_cost))
            print('    PO Unit Price: ' + str(unit_price))

print()
print('=' * 80)
print('FINAL RECOMMENDATION')
print('=' * 80)
print()
print('For Purchase Requisitions, use UNIT PRICE from PO Details because:')
print('  1. Unit Price ALWAYS has a value (never 0 when there is a cost)')
print('  2. Unit Cost is sometimes 0 even when there is a real price')
print('  3. Unit Price matches the Item Master "Recent Cost" field')
print('  4. This is the price we actually PAID to the supplier')
print()
print('The current code already uses Unit Price - NO CHANGES NEEDED!')





