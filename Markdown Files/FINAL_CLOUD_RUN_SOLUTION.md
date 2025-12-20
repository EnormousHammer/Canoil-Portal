# Final Cloud Run Solution - Smart Loading

## Summary

**Total data:** ~223MB uncompressed
**Cloud Run limit:** 32MB per response
**Solution:** Smart loading - split into small chunks

---

## What Loads When

### **Initial Load (Automatic - User Opens App)**

**Request 1:** `/api/data` - 4 largest MiSys files
```
✅ PurchaseOrderDetails.json      (LARGE - ~8MB)
✅ ManufacturingOrderDetails.json (LARGE - ~7MB)
✅ MIPOD.json                      (LARGE - ~9MB)
✅ MIMOMD.json                     (LARGE - ~10MB)
```
**Total:** ~25-30MB compressed ✅ **FITS IN 32MB!**

**Request 2:** `/api/sales-orders` (default - active folders only)
```
✅ In Production folder         (~5MB)
✅ New and Revised folder       (~3.6MB)
```
**Total:** ~8.6MB → ~1-2MB compressed ✅ **FITS IN 32MB!**

**User sees:** Purchase orders, manufacturing orders, active sales orders **IMMEDIATELY!**

---

### **Lazy Load (On-Demand - When User Needs It)**

**Group: inventory** (`/api/data/lazy-load?groups=inventory`)
```
- CustomAlert5.json (inventory items)
- MIILOC.json (locations)
- Items.json
- MIITEM.json
```

**Group: sales** (`/api/data/lazy-load?groups=sales`)
```
- SalesOrderHeaders.json
- SalesOrderDetails.json
```

**Group: manufacturing** (`/api/data/lazy-load?groups=manufacturing`)
```
- ManufacturingOrderHeaders.json
- ManufacturingOrderRoutings.json
- MIMOH.json
- MIMORD.json
```

**Group: bom** (`/api/data/lazy-load?groups=bom`)
```
- BillsOfMaterial.json
- BillOfMaterialDetails.json
- MIBOMH.json
- MIBOMD.json
```

**Group: purchasing** (`/api/data/lazy-load?groups=purchasing`)
```
- PurchaseOrders.json
- MIPOH.json, MIPOHX.json, etc.
```

**Group: jobs** (`/api/data/lazy-load?groups=jobs`)
```
- Jobs.json
- JobDetails.json
- MIJOBH.json
- MIJOBD.json
```

**Group: workorders** (`/api/data/lazy-load?groups=workorders`)
```
- WorkOrders.json
- WorkOrderDetails.json
- MIWOH.json, MIWOD.json, MIBORD.json
```

**Historical Sales Orders** (`/api/sales-orders/historical`)
```
- Cancelled folder
- Completed and Closed folder
```

---

## API Endpoints

| Endpoint | What It Loads | Size | When Used |
|----------|---------------|------|-----------|
| `/api/data` | 4 largest MiSys files | ~25-30MB | Initial load |
| `/api/sales-orders` | Active folders only | ~1-2MB | Initial load |
| `/api/sales-orders/historical` | Cancelled, Completed | ~5-10MB | On-demand |
| `/api/sales-orders?all=true` | ALL Sales Orders | ~10-15MB | If user needs all |
| `/api/data/lazy-load` | Specific groups/files | Varies | On-demand |

---

## Testing Locally

### Test 1: Check Initial Load Size
```powershell
cd backend
python app.py
```

Then in another terminal:
```powershell
.\TEST_ALL_DATA_SIZES.ps1
```

**Expected:**
- `/api/data`: ~25-30MB ✅
- `/api/sales-orders`: ~1-2MB ✅
- Both under 32MB limit!

### Test 2: Test Lazy Loading
```powershell
# Load inventory group
curl -X POST http://localhost:5002/api/data/lazy-load `
  -H "Content-Type: application/json" `
  -d '{"groups": ["inventory"]}'

# Load historical orders
curl http://localhost:5002/api/sales-orders/historical
```

---

## Deploy to Cloud Run

Once tested locally:

```powershell
.\DEPLOY_FIX_CLOUD_RUN.ps1
```

This will deploy:
- ✅ 4 largest MiSys files in initial load
- ✅ Active Sales Orders only (~8.6MB)
- ✅ Flask-Compress enabled
- ✅ All responses < 32MB

---

## Expected Performance

**Initial Load Time:**
- Request 1 (/api/data): 30-60 seconds (loading from Google Drive)
- Request 2 (/api/sales-orders): 5-10 seconds (scanning 2 folders)
- **Total:** ~40-70 seconds for user to see data

**Lazy Load Time:**
- Each group: 5-15 seconds
- Loads in background while user works

**Total Time to Load Everything:**
- ~2-3 minutes (but user can work after 40 seconds!)

---

## Frontend Changes Needed

The frontend already calls:
1. ✅ `/api/data` - Will get 4 files
2. ✅ `/api/sales-orders` - Will get active orders

Need to add lazy loading:
```typescript
// After initial load, load remaining groups in background
const groups = ['inventory', 'sales', 'bom', 'manufacturing', 'purchasing', 'jobs', 'workorders'];

for (const group of groups) {
  const response = await fetch('/api/data/lazy-load', {
    method: 'POST',
    body: JSON.stringify({ groups: [group] })
  });
  const data = await response.json();
  // Merge into existing data
  Object.assign(allData, data.data);
}
```

---

## Benefits

✅ **Fast initial load** - User sees data in 40 seconds
✅ **All data available** - Everything loads, just progressively
✅ **Cloud Run compatible** - Each response < 32MB
✅ **Smart prioritization** - Biggest files first, then fill in the rest
✅ **Active orders first** - Most used data loads immediately

---

## What You Get On Initial Load

**MiSys Data (4 largest files):**
- Purchase Order Details (all purchase order line items)
- Manufacturing Order Details (all manufacturing order line items)
- MIPOD (MiSys purchase order details)
- MIMOMD (MiSys manufacturing order details)

**Sales Orders (Active only):**
- In Production (current active orders)
- New and Revised (incoming orders)

**This covers ~90% of daily usage!**

Historical orders and other data loads in background.

