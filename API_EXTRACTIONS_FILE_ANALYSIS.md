# API Extractions Folder - File Usage Analysis
**Date:** 2025-11-05  
**Location:** `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\2025-11-05`

## Files Actually in Folder (38 files)

### ✅ Files That Exist AND Are Loaded by Code:
1. `BillsOfMaterial.json` ✅
2. `BillOfMaterialDetails.json` ✅
3. `CustomAlert5.json` ✅ (ESSENTIAL - loaded initially)
4. `Items.json` ✅
5. `Jobs.json` ✅
6. `JobDetails.json` ✅
7. `ManufacturingOrderDetails.json` ✅ (ESSENTIAL - loaded initially)
8. `ManufacturingOrderHeaders.json` ✅
9. `MIITEM.json` ✅
10. `MIBOMD.json` ✅
11. `MIBOMH.json` ✅
12. `MIJOBD.json` ✅
13. `MIJOBH.json` ✅
14. `MIMOH.json` ✅
15. `MIMOMD.json` ✅ (ESSENTIAL - loaded initially)
16. `MIPOC.json` ✅
17. `MIPOCV.json` ✅
18. `MIPOD.json` ✅ (ESSENTIAL - loaded initially)
19. `MIPODC.json` ✅
20. `MIPOH.json` ✅
21. `MIPOHX.json` ✅
22. `MIWOD.json` ✅
23. `MIWOH.json` ✅
24. `PurchaseOrderDetails.json` ✅ (ESSENTIAL - loaded initially)
25. `PurchaseOrders.json` ✅
26. `PurchaseOrderAdditionalCosts.json` ✅
27. `PurchaseOrderAdditionalCostsTaxes.json` ✅
28. `PurchaseOrderDetailAdditionalCosts.json` ✅
29. `PurchaseOrderExtensions.json` ✅
30. `WorkOrderDetails.json` ✅
31. `WorkOrders.json` ✅

### ❌ Files That Exist BUT Are NOT Loaded by Code:
1. `BillOfMaterialRoutingDetails.json` ❌ (2 bytes - empty)
2. `Items_default_keys.json` ❌ (1,208 bytes)
3. `Items_qty_keys.json` ❌ (2 bytes - empty)
4. `Items_union_keys.json` ❌ (1,348 bytes)
5. `Items_with_stock.json` ❌ (175,898 bytes - **HAS DATA!**)
6. `ManufacturingOrderRoutings.json` ❌ (2 bytes - empty)
7. `MIBORD.json` ❌ (2 bytes - empty)
8. `MIMORD.json` ❌ (2 bytes - empty)

### ⚠️ Files Code Expects BUT Don't Exist in This Folder:
1. `MIILOC.json` ❌ **MISSING** - Code expects this for inventory location data, but it doesn't exist. Code has fallback to `CustomAlert5.json` for stock data.
2. `SalesOrderHeaders.json` ⚠️ (These are in separate Sales_CSR drive - expected)
3. `SalesOrderDetails.json` ⚠️ (These are in separate Sales_CSR drive - expected)

## Summary

### Total Files in Folder: **38 JSON files**

### Files Actually Used: **31 files** (82%)
- **5 files** loaded initially (essential)
- **26 files** available for lazy-loading

### Files NOT Used: **8 files** (18%)
- **5 files** are empty (2 bytes each) - `BillOfMaterialRoutingDetails.json`, `Items_qty_keys.json`, `ManufacturingOrderRoutings.json`, `MIBORD.json`, `MIMORD.json`
- **3 files** have data but aren't loaded:
  - `Items_default_keys.json` (1,208 bytes) - Metadata/schema file
  - `Items_union_keys.json` (1,348 bytes) - Metadata/schema file
  - `Items_with_stock.json` (175,898 bytes) - Contains 2,594 items but only has "Description" field (appears to be a filtered/processed version, likely redundant)

### Files Code Expects But Missing: **3 files**
- `MIILOC.json` - Expected for inventory location data
- `SalesOrderHeaders.json` - In separate Sales_CSR drive (expected)
- `SalesOrderDetails.json` - In separate Sales_CSR drive (expected)

## Key Findings

1. **Most files are used** - 82% of files in the folder are actually loaded by the app
2. **Empty files are ignored** - 5 empty files (2 bytes each) are correctly not loaded
3. **Potential data loss** - `Items_with_stock.json` (175KB) exists but is never loaded - might contain useful stock data
4. **Metadata files ignored** - `Items_default_keys.json` and `Items_union_keys.json` appear to be metadata/schema files, not data files

## Recommendation

`Items_with_stock.json` appears to be a filtered version with only Description fields (2,594 items), so it's likely redundant with `CustomAlert5.json` which contains complete item data. No action needed.

## Final Answer

**82% of files are used (31 out of 38 files)**

- **5 files** loaded on app startup (essential)
- **26 files** loaded on-demand (lazy-load)
- **8 files** NOT used (5 empty, 3 metadata/filtered versions)
- **1 file** expected but missing: `MIILOC.json` (code has fallback to `CustomAlert5.json`)

## Impact of Missing MIILOC.json

The code expects `MIILOC.json` for detailed location-specific inventory data (stock by location, WIP, reserved quantities). However:
- ✅ Code handles this gracefully - uses `CustomAlert5.json` as fallback
- ✅ Stock data is still available from `CustomAlert5.json` 
- ⚠️ Location-specific breakdowns may be limited (uses "Pick Sequence" as location instead of actual location IDs)

