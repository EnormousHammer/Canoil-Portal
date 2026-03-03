import json, csv

def sf(v):
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip()
    if not s or s == 'None': return 0.0
    try: return float(s.replace(',', '').replace('$', ''))
    except: return 0.0

# January
with open(r'G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\2026-01-27\CustomAlert5.json', 'r', encoding='utf-8') as f:
    jan = json.load(f)

print("=" * 65)
print("  JANUARY - WHERE ARE ALL THE ITEMS?")
print("=" * 65)
print(f"  Total items in MISys item master:  {len(jan)}")

pos = [i for i in jan if sf(i.get('Stock')) > 0]
zero = [i for i in jan if sf(i.get('Stock')) == 0]
pos_cost = [i for i in pos if sf(i.get('Recent Cost')) or sf(i.get('Unit Cost')) or sf(i.get('Average Cost'))]
pos_nocost = [i for i in pos if not (sf(i.get('Recent Cost')) or sf(i.get('Unit Cost')) or sf(i.get('Average Cost')))]

print(f"  Items WITH stock on hand (>0):     {len(pos)}")
print(f"    - with unit cost on file:        {len(pos_cost)}  --> these have $$ value")
print(f"    - NO cost in system:             {len(pos_nocost)}  --> stock but $0 cost")
print(f"  Items with ZERO stock:             {len(zero)}  --> nothing in warehouse")

print(f"\n  Examples of ZERO-STOCK items (no inventory on hand):")
count = 0
for i in zero:
    ino = str(i.get('Item No.') or '')
    desc = str(i.get('Description') or '')[:35]
    if ino and count < 8:
        print(f"    {ino:<28} {desc:<36} Stock = 0")
        count += 1
print(f"    ... plus {len(zero) - 8} more items with zero stock")

print(f"\n  Examples of items WITH stock but NO cost:")
for i in pos_nocost[:5]:
    ino = str(i.get('Item No.') or '')
    s = sf(i.get('Stock'))
    print(f"    {ino:<28} Stock = {s:>10,.2f}   Cost = $0.00")

# February
rows = []
with open(r'G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys\Feb 23, 2026\MIITEM.CSV', 'r', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        rows.append(r)

print("\n" + "=" * 65)
print("  FEBRUARY - WHERE ARE ALL THE ITEMS?")
print("=" * 65)
print(f"  Total items in MISys item master:  {len(rows)}")
fpos = [r for r in rows if sf(r.get('totQStk')) > 0]
fzero = [r for r in rows if sf(r.get('totQStk')) == 0]
fpos_cost = [r for r in fpos if sf(r.get('cLast')) or sf(r.get('itemCost')) or sf(r.get('cAvg'))]
fpos_nocost = [r for r in fpos if not (sf(r.get('cLast')) or sf(r.get('itemCost')) or sf(r.get('cAvg')))]
print(f"  Items WITH stock on hand (>0):     {len(fpos)}")
print(f"    - with unit cost on file:        {len(fpos_cost)}  --> these have $$ value")
print(f"    - NO cost in system:             {len(fpos_nocost)}  --> stock but $0 cost")
print(f"  Items with ZERO stock:             {len(fzero)}  --> nothing in warehouse")

# What if we include items WITH stock regardless of cost?
print("\n" + "=" * 65)
print("  YOUR OPTIONS FOR THE REPORT")
print("=" * 65)
print(f"\n  Option 1 (current): Only items with stock > 0")
print(f"    Jan: {len(pos)} items    Feb: {len(fpos)} items")
print(f"    This = what is physically in the warehouse right now")
print(f"\n  Option 2: All items with stock > 0 OR has a cost on file")
jan_opt2 = [i for i in jan if sf(i.get('Stock')) > 0 or sf(i.get('Recent Cost')) or sf(i.get('Unit Cost'))]
feb_opt2 = [r for r in rows if sf(r.get('totQStk')) > 0 or sf(r.get('cLast')) or sf(r.get('itemCost'))]
print(f"    Jan: {len(jan_opt2)} items    Feb: {len(feb_opt2)} items")
print(f"    This = everything that has stock OR has ever had a cost")
print(f"\n  Option 3: ALL items in MISys (including zero stock)")
print(f"    Jan: {len(jan)} items    Feb: {len(rows)} items")
print(f"    This = the full item master, most rows will show 0 qty")
print(f"\n  For a month-end inventory on hand report, Option 1 is")
print(f"  standard - you only report what you physically have.")
