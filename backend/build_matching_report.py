"""
Step 1: Understand the MILOGD/MILOGH data and map to the Oct 2025 reference format.
"""
import csv, os
from collections import Counter
from datetime import datetime

base = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys\March 3, 2026"

# MILOGD has the dollar amounts
print("=" * 70)
print("  MILOGD.CSV - Transaction Details (has $$ amounts)")
print("=" * 70)
rows = []
with open(os.path.join(base, "MILOGD.CSV"), 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append(r)

print(f"Total rows: {len(rows)}")
print(f"Columns: {list(rows[0].keys())}")

# Show samples
print("\nFirst 3 rows:")
for r in rows[:3]:
    print(f"  date={r.get('tranDate')}  user={r.get('userId')}  entry={r.get('entry')}  detail={r.get('detail')}  type={r.get('type')}  item={r.get('itemId')}  loc={r.get('locId')}  crAmnt={r.get('crAmnt')}  drAmnt={r.get('drAmnt')}  ref={r.get('reference')}")

# Transaction types
types = Counter()
for r in rows:
    types[r.get('type')] += 1
print(f"\nTransaction types: {dict(sorted(types.items(), key=lambda x: -x[1]))}")

# Date range
dates = sorted(set(r.get('tranDate') for r in rows if r.get('tranDate')))
print(f"Date range: {dates[0]} to {dates[-1]}")

# Filter to Jan and Feb 2026
jan_rows = [r for r in rows if r.get('tranDate', '').startswith('2026') and r.get('tranDate', '') >= '20260101' and r.get('tranDate', '') <= '20260131']
feb_rows = [r for r in rows if r.get('tranDate', '').startswith('2026') and r.get('tranDate', '') >= '20260201' and r.get('tranDate', '') <= '20260228']
print(f"\nJan 2026 transactions: {len(jan_rows)}")
print(f"Feb 2026 transactions: {len(feb_rows)}")

# Jan type breakdown
jan_types = Counter()
for r in jan_rows:
    jan_types[r.get('type')] += 1
print(f"Jan types: {dict(sorted(jan_types.items(), key=lambda x: -x[1]))}")

feb_types = Counter()
for r in feb_rows:
    feb_types[r.get('type')] += 1
print(f"Feb types: {dict(sorted(feb_types.items(), key=lambda x: -x[1]))}")

# Now check MILOGH for the header info (has comment/description)
print("\n" + "=" * 70)
print("  MILOGH.CSV - Transaction Headers")
print("=" * 70)
hrows = []
with open(os.path.join(base, "MILOGH.CSV"), 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for r in reader:
        hrows.append(r)
print(f"Total rows: {len(hrows)}")
print(f"Columns: {list(hrows[0].keys())}")

# Show samples
print("\nFirst 3 rows:")
for r in hrows[:3]:
    print(f"  date={r.get('tranDate')}  user={r.get('userId')}  entry={r.get('entry')}  type={r.get('type')}  item={r.get('itemId')}  loc={r.get('locId')}  qty={r.get('qty')}  comment={r.get('comment')}")

# MILOGH types
htypes = Counter()
for r in hrows:
    htypes[r.get('type')] += 1
print(f"\nMILOGH types: {dict(sorted(htypes.items(), key=lambda x: -x[1]))}")

# Now let's match to the October reference
# Reference has: ST- Stock Transfers, PO- Purchase Orders
# Reference Transaction column = "CAROLINA / 31" format = userId / entry
# Let's check unique userIds
users = Counter()
for r in jan_rows:
    users[r.get('userId')] += 1
print(f"\nJan userIds: {dict(sorted(users.items(), key=lambda x: -x[1]))}")

# Sample Jan ST (type that matches Stock Transfers)
print("\n--- Sample Jan transactions by type ---")
for t in sorted(jan_types.keys()):
    samples = [r for r in jan_rows if r.get('type') == t][:2]
    for r in samples:
        print(f"  type={t}  date={r.get('tranDate')}  user={r.get('userId')}  entry={r.get('entry')}  item={r.get('itemId')[:25]}  loc={r.get('locId')}  cr={r.get('crAmnt')}  dr={r.get('drAmnt')}  ref={r.get('reference')}")

# Map MISys log types to reference categories
# Type 1 = Issue (MO component issue)
# Type 2 = Receipt (MO receipt/completion)
# Type 3 = PO Receipt
# Type 4 = Adjustment/Transfer
# etc.
print("\n--- Mapping MISys types to reference categories ---")
MISYS_LOG_TYPES = {
    '1': 'IS- Issues',
    '2': 'RC- Receipts',
    '3': 'PO- Purchase Orders',
    '4': 'AD- Adjustments',
    '5': 'ST- Stock Transfers',
    '6': 'WO- Work Orders',
    '7': 'SA- Sales/Shipments',
    '8': 'RV- Reversals',
    '9': 'PI- Physical Inventory',
}
for t, label in MISYS_LOG_TYPES.items():
    count_jan = sum(1 for r in jan_rows if r.get('type') == t)
    count_feb = sum(1 for r in feb_rows if r.get('type') == t)
    if count_jan or count_feb:
        print(f"  Type {t} ({label}): Jan={count_jan}, Feb={count_feb}")
