import json, csv
from collections import Counter, defaultdict

def sf(v):
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip()
    if not s or s == 'None' or s == 'False': return 0.0
    try: return float(s.replace(',', '').replace('$', ''))
    except: return 0.0

MISYS_TYPES = {
    0: "Assembled (Finished Goods)",
    1: "Raw Material",
    2: "Subassembly",
    3: "Purchased",
    4: "Phantom",
    5: "Service/Labor",
}

# ======================== JANUARY ========================
with open(r'G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\2026-01-27\CustomAlert5.json', 'r', encoding='utf-8') as f:
    jan = json.load(f)

print("=" * 75)
print("  JANUARY 2026 - BREAKDOWN BY ITEM TYPE")
print("=" * 75)

jan_by_type = defaultdict(lambda: {'total': 0, 'has_stock': 0, 'has_value': 0, 'qty': 0, 'value': 0})
for item in jan:
    itype_raw = item.get('Item Type', '')
    try:
        itype = int(itype_raw) if itype_raw != '' else -1
    except:
        itype = -1
    label = MISYS_TYPES.get(itype, f"Type {itype}")

    stock = sf(item.get('Stock'))
    cost = sf(item.get('Recent Cost')) or sf(item.get('Unit Cost')) or sf(item.get('Average Cost'))
    val = stock * cost

    jan_by_type[label]['total'] += 1
    if stock > 0:
        jan_by_type[label]['has_stock'] += 1
        jan_by_type[label]['qty'] += stock
    if val > 0:
        jan_by_type[label]['has_value'] += 1
        jan_by_type[label]['value'] += val

print(f"\n  {'Item Type':<35} {'Total':>6} {'On Hand':>8} {'With $$':>8} {'Total Qty':>14} {'Total Value':>16}")
print(f"  {'-'*35} {'-'*6} {'-'*8} {'-'*8} {'-'*14} {'-'*16}")
grand_total_items = 0
grand_has_stock = 0
grand_value = 0
for label in sorted(jan_by_type.keys()):
    d = jan_by_type[label]
    grand_total_items += d['total']
    grand_has_stock += d['has_stock']
    grand_value += d['value']
    print(f"  {label:<35} {d['total']:>6} {d['has_stock']:>8} {d['has_value']:>8} {d['qty']:>14,.2f} ${d['value']:>15,.2f}")
print(f"  {'TOTAL':<35} {grand_total_items:>6} {grand_has_stock:>8} {'':>8} {'':>14} ${grand_value:>15,.2f}")

# ======================== FEBRUARY ========================
rows = []
with open(r'G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys\Feb 23, 2026\MIITEM.CSV', 'r', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        rows.append(r)

print("\n\n" + "=" * 75)
print("  FEBRUARY 2026 - BREAKDOWN BY ITEM TYPE")
print("=" * 75)

feb_by_type = defaultdict(lambda: {'total': 0, 'has_stock': 0, 'has_value': 0, 'qty': 0, 'value': 0})
for row in rows:
    itype_raw = (row.get('type') or '').strip().strip('"')
    try:
        itype = int(itype_raw) if itype_raw != '' else -1
    except:
        itype = -1
    label = MISYS_TYPES.get(itype, f"Type {itype}")

    stock = sf(row.get('totQStk'))
    cost = sf(row.get('cLast')) or sf(row.get('itemCost')) or sf(row.get('cAvg'))
    val = stock * cost

    feb_by_type[label]['total'] += 1
    if stock > 0:
        feb_by_type[label]['has_stock'] += 1
        feb_by_type[label]['qty'] += stock
    if val > 0:
        feb_by_type[label]['has_value'] += 1
        feb_by_type[label]['value'] += val

print(f"\n  {'Item Type':<35} {'Total':>6} {'On Hand':>8} {'With $$':>8} {'Total Qty':>14} {'Total Value':>16}")
print(f"  {'-'*35} {'-'*6} {'-'*8} {'-'*8} {'-'*14} {'-'*16}")
grand_total_items = 0
grand_has_stock = 0
grand_value = 0
for label in sorted(feb_by_type.keys()):
    d = feb_by_type[label]
    grand_total_items += d['total']
    grand_has_stock += d['has_stock']
    grand_value += d['value']
    print(f"  {label:<35} {d['total']:>6} {d['has_stock']:>8} {d['has_value']:>8} {d['qty']:>14,.2f} ${d['value']:>15,.2f}")
print(f"  {'TOTAL':<35} {grand_total_items:>6} {grand_has_stock:>8} {'':>8} {'':>14} ${grand_value:>15,.2f}")

# Show samples of each type WITH stock
print("\n\n" + "=" * 75)
print("  SAMPLE ITEMS BY TYPE (Feb, items with stock on hand)")
print("=" * 75)
for itype_num in [0, 1, 2, 3]:
    label = MISYS_TYPES.get(itype_num, f"Type {itype_num}")
    print(f"\n  --- {label} ---")
    count = 0
    for row in rows:
        try:
            t = int((row.get('type') or '0').strip().strip('"'))
        except:
            t = -1
        if t != itype_num:
            continue
        stock = sf(row.get('totQStk'))
        if stock <= 0:
            continue
        cost = sf(row.get('cLast')) or sf(row.get('itemCost')) or sf(row.get('cAvg'))
        ino = (row.get('itemId') or '').strip().strip('"')
        desc = (row.get('descr') or '').strip().strip('"')[:40]
        uom = (row.get('uOfM') or '').strip().strip('"')
        print(f"    {ino:<28} {desc:<40} {uom:<6} Qty={stock:>10,.2f}  ${stock*cost:>12,.2f}")
        count += 1
        if count >= 5:
            break
