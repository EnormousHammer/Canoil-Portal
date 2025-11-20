# Smart Loading Solution for Cloud Run 32MB Limit

## Problem Solved
- **Before:** Loading ALL 30+ files = 65.68MB compressed ❌
- **After:** Load only essentials, lazy load rest = Each request < 32MB ✅

---

## How It Works

### **Initial Load (`/api/data`)** - ~5-10MB compressed
Loads ONLY critical files:
```
✅ CustomAlert5.json       - Inventory items (CRITICAL)
✅ MIILOC.json             - Locations (CRITICAL)  
✅ SalesOrderHeaders.json  - Sales orders (CRITICAL)
✅ SalesOrderDetails.json  - Order details (CRITICAL)
```

### **On-Demand Loading (`/api/data/lazy-load`)**
Files organized into groups, load when needed:

**Manufacturing Group:**
- ManufacturingOrderHeaders.json
- ManufacturingOrderDetails.json
- ManufacturingOrderRoutings.json
- MIMOH.json, MIMOMD.json, MIMORD.json

**BOM Group:**
- BillsOfMaterial.json
- BillOfMaterialDetails.json
- MIBOMH.json, MIBOMD.json

**Purchasing Group:**
- PurchaseOrders.json
- PurchaseOrderDetails.json
- MIPOH.json, MIPOD.json, etc.

**Jobs Group:**
- Jobs.json, JobDetails.json
- MIJOBH.json, MIJOBD.json

**Work Orders Group:**
- WorkOrders.json, WorkOrderDetails.json
- MIWOH.json, MIWOD.json, MIBORD.json

**Items Group:**
- Items.json
- MIITEM.json

---

## Testing the Solution

### Test 1: Check Initial Load Size
```powershell
.\TEST_REAL_COMPRESSED_SIZE.ps1
```

**Expected:** ~5-15MB (should be WELL under 32MB)

### Test 2: Manual Test
```powershell
# Start backend
cd backend
python app.py

# In browser, go to:
http://localhost:5002/api/data
```

You should see only 4 files loaded + metadata about available lazy load groups.

### Test 3: Test Lazy Loading
```powershell
# Load a specific group
curl -X POST http://localhost:5002/api/data/lazy-load `
  -H "Content-Type: application/json" `
  -d '{"groups": ["manufacturing"]}'

# Or load specific files
curl -X POST http://localhost:5002/api/data/lazy-load `
  -H "Content-Type: application/json" `
  -d '{"files": ["PurchaseOrders.json", "Items.json"]}'
```

---

## Frontend Usage (Next Step)

The frontend needs to be updated to:

1. **Load initial data** (`/api/data`) - fast, small
2. **Lazy load groups** as user navigates:
   - User clicks "Manufacturing" → Load manufacturing group
   - User clicks "Purchasing" → Load purchasing group
   - User clicks "Jobs" → Load jobs group

### Example Frontend Code:
```typescript
// Initial load
const initialData = await fetch('/api/data');

// Later, when user needs manufacturing data
const mfgData = await fetch('/api/data/lazy-load', {
  method: 'POST',
  body: JSON.stringify({ groups: ['manufacturing'] })
});

// Merge into existing data
Object.assign(data, mfgData.data);
```

---

## Benefits

✅ **Each request < 32MB** - Fits Cloud Run limit
✅ **Fast initial load** - Only 4 files vs 30+
✅ **Load only what's needed** - Save bandwidth
✅ **Better UX** - App loads quickly, data streams in
✅ **Scalable** - Can add more files without hitting limits

---

## Deploy to Cloud Run

Once tested locally:

```powershell
.\DEPLOY_FIX_CLOUD_RUN.ps1
```

Each endpoint will be well under 32MB limit!

---

## Summary

**Smart approach:** Load essentials first, lazy load the rest!

This is how modern apps work (Netflix, YouTube, etc.) - they don't load everything at once!

