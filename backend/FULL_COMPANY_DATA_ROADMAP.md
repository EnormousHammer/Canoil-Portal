# Full Company Data – Roadmap (where your export goes)

**Single source of truth:** Your MISys **Full Company Data** export. The app is built to use this. No separate “API extractions” are required for inventory, POs, MOs, BOM, work orders, or lot/serial—everything comes from the export folder.

**Folder:** `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data as of 02_10_2026`

Put your MISys **Export All Company Data** CSV or Excel files in that folder. File names are matched case-insensitively (e.g. `MIITEM.CSV` or `miitem.csv` both work).

### How to see the data in the portal

1. **Export** from MISys into the folder above (or the same path on your shared Drive). Use **Item.csv**, **Items.csv**, **MIITEM.csv**, or **CustomAlert5.csv** for inventory (any one works).
2. **Run the backend** on a machine that can see that folder (or use Google Drive API with the same path). The app loads Full Company Data by default when the folder has files.
3. **Open the portal** and refresh if needed. Go to **Operations Hub → Inventory** and click an item. The item modal should show Master (type, stocking unit, etc.), Stock (on hand, WIP, reserve, min/max/reorder), Costs, POs, Mfg Orders, and other tabs from your data.
4. If a tab is empty, check that the corresponding export file is in the folder (e.g. **MISLTH.csv** for Stock Movement, **MISLTD.csv** for SL Numbers). Column headers are matched case-insensitively. The portal loads them and maps columns into the app. This doc is the **roadmap**: which file → which app data, and which export column names → which app field names.

---

## File name → App data

| Your export file (name without extension) | Feeds these app data keys (portal uses these) |
|------------------------------------------|-----------------------------------------------|
| **Item**, **Items**, **MIITEM**, or **CustomAlert5** | `CustomAlert5.json`, `Items.json` (inventory items). Any of these file names work. |
| **MIILOC** | `MIILOC.json` (item locations) |
| **MIBOMH** | `BillsOfMaterial.json`, `MIBOMH.json` |
| **MIBOMD** | `BillOfMaterialDetails.json`, `MIBOMD.json` (BOM Where Used, BOM tab) |
| **MIMOH** | `ManufacturingOrderHeaders.json`, `MIMOH.json` |
| **MIMOMD** | `ManufacturingOrderDetails.json`, `MIMOMD.json` |
| **MIPOH** | `PurchaseOrders.json`, `MIPOH.json` |
| **MIPOD** | `PurchaseOrderDetails.json`, `MIPOD.json` |
| **MIWOH** | `WorkOrders.json`, `MIWOH.json`, `WorkOrderHeaders.json` |
| **MIWOD** | `WorkOrderDetails.json`, `MIWOD.json` |
| **MIMORD** | `ManufacturingOrderRoutings.json`, `MIMORD.json` |
| **MIPOC** / **MIPOHX** | `PurchaseOrderExtensions.json` |
| **MIPOCV** | `PurchaseOrderAdditionalCosts.json`, `MIPOCV.json` |
| **MIPODC** | `PurchaseOrderDetailAdditionalCosts.json`, `MIPODC.json` |
| **MIJOBH** | `Jobs.json`, `MIJOBH.json` |
| **MIJOBD** | `JobDetails.json`, `MIJOBD.json` |
| **MISLTH** | `LotSerialHistory.json` |
| **MISLTD** | `LotSerialDetail.json` |

**Allowed extensions:** `.csv`, `.xlsx`, `.xls`

If your MISys export uses different file names (e.g. `Items.csv` instead of `Item.csv`), either rename the file to one of the names above or add a mapping in `full_company_data_converter.py` (FULL_COMPANY_MAPPINGS).

---

## Item modal tabs ↔ Full Company Data

| Tab in item popup | Source (export file → app data) |
|-------------------|----------------------------------|
| **Master** | Item / MIITEM → CustomAlert5, Items |
| **Stock** | Item / MIITEM, MIILOC |
| **Costs** | Item / MIITEM (Unit / Standard / Recent cost) |
| **Purchase Orders** | MIPOH, MIPOD → PurchaseOrders, PurchaseOrderDetails |
| **Mfg Orders** | MIMOH, MIMOMD → ManufacturingOrderHeaders, ManufacturingOrderDetails |
| **Sales Orders** | Separate source (e.g. Sales_CSR or SO export if added) |
| **BOM Where Used** | MIBOMD → BillOfMaterialDetails |
| **Work Orders** | MIWOH, MIWOD → WorkOrders, WorkOrderDetails |
| **Stock Movement** | **MISLTH** → LotSerialHistory.json |
| **Suppliers** | Derived from POs (MIPOH, MIPOD) – vendors who have ordered this item |
| **Manufacturers** | Not yet in converter (add export file mapping if you have it) |
| **Alternates** | Not yet in converter (add export file mapping if you have it) |
| **Activity** | Not yet in converter (add export file mapping if you have it) |
| **Notes** | Not yet in converter (needs backend store or export) |
| **History** | Not yet in converter (needs audit export or backend) |
| **SL Numbers** | **MISLTD** → LotSerialDetail.json |

---

## Column roadmap (export column → app field)

For each file, the converter looks at the **first row as column headers**. Each header is mapped to an app field. Matching is **case-insensitive** and ignores extra spaces. Below: **Export column** (what may appear in your CSV/Excel) → **App field** (what the portal uses).

### Item / MIITEM → CustomAlert5.json, Items.json

The converter accepts both **MISys export column names** (from your CSV) and display-style names. Export columns (what MISys writes) are listed first.

| Export column (any of these) | → App field |
|------------------------------|-------------|
| itemId | Item No. |
| descr | Description |
| type | Item Type |
| uOfM | Stocking Units |
| poUOfM | Purchasing Units |
| totQStk | Stock |
| totQWip | WIP |
| totQRes | Reserve |
| totQOrd | On Order |
| **minLvl** (export) / minQty | Minimum |
| **maxLvl** (export) / maxQty | Maximum |
| **ordLvl** (export) / reordPoint | Reorder Level |
| **ordQty** (export) / reordQty | Reorder Quantity |
| **lotSz** (export) | Lot Size |
| **cLast** (export) | Recent Cost |
| **cStd** (export) | Standard Cost |
| **cAvg** (export) | Average Cost |
| **cLand** (export) | Landed Cost |
| unitCost / itemCost | Unit Cost |
| stdCost, avgCost, landedCost | (same) |
| uConvFact | Units Conversion Factor |
| revId | Current BOM Revision |
| locId, suplId, mfgId, status | Location No., Supplier No., Manufacturer No., Status |

### MIBOMD → BillOfMaterialDetails.json (BOM Where Used tab)

| Export column | → App field |
|---------------|-------------|
| bomItem, BOM Item | Parent Item No. |
| bomRev, BOM Rev | Revision No. |
| partId, Part Id | Component Item No. |
| qty, Qty | Required Quantity |
| leadTime, Lead (Days) | Lead (Days) |
| Comment | Comment |
| operNo, Operation No. | Operation No. |
| srcLoc, Source Location | Source Location |
| Line | Line |
| Detail Type | Detail Type |
| Uniquifier | Uniquifier |

### MIPOH → PurchaseOrders.json

| Export column | → App field |
|---------------|-------------|
| pohId, poNo | PO No. |
| supId, supplierNo | Supplier No. |
| ordDt, orderDate | Order Date |
| poStat, status, PO Status | Status |
| totalAmt, totalAmount | Total Amount |
| Name | Name |
| Contact, Buyer, Terms, Ship Via, FOB, Freight | (same) |
| Close Date, Location No., Expedited Date | (same) |
| Total Ordered, Total Received | (same) |
| Invoice No., Rate, Rate Date, Tax Group | (same) |

### MIPOD → PurchaseOrderDetails.json

| Export column | → App field |
|---------------|-------------|
| pohId, poNo | PO No. |
| partId, itemId | Item No. |
| ordQty, ordered | Ordered |
| recvQty, received | Received |
| unitCost, Unit Cost, Cost, Price | Unit Cost / Unit Price |
| lineNo, Line No., PO Detail No. | Line No. |
| Description | Description |
| Real Due Date, Initial Due Date, Promised Date | Required Date |
| Extended Price, Location No., Comment | (same) |
| Job No., Last Received Date | (same) |
| Manufacturing Order No. | (same) |

### MIMOH → ManufacturingOrderHeaders.json

| Export column | → App field |
|---------------|-------------|
| mohId | Mfg. Order No. |
| buildItem | Build Item No. |
| bomItem, bomRev | BOM Item, BOM Rev |
| moStat | Status |
| ordQty | Ordered |
| relOrdQty | Release Order Quantity |
| ordDt, startDt, endDt, releaseDt, closeDt | Order Date, Start Date, Completion Date, Release Date, etc. |
| customer, custId | Customer |
| soShipDt | Sales Order Ship Date |

### MIMOMD → ManufacturingOrderDetails.json

| Export column | → App field |
|---------------|-------------|
| mohId | Mfg. Order No. |
| partId | Component Item No. |
| reqQty | Required Quantity |
| compQty | Completed |

### MIWOH → WorkOrders.json

| Export column | → App field |
|---------------|-------------|
| wohId | Work Order No. |
| jobId | Job No. |
| woStat | Status |
| releaseDt | Release Date |
| descr | Description |
| locId | Location No. |
| soId | Sales Order No. |

### MIWOD → WorkOrderDetails.json

| Export column | → App field |
|---------------|-------------|
| wohId | Work Order No. |
| jobId | Job No. |
| partId, itemId | Item No. |
| ordQty | Ordered |
| compQty | Completed |
| mohId | Manufacturing Order No. |
| soId | Sales Order No. |

### MIILOC → MIILOC.json

| Export column | → App field |
|---------------|-------------|
| itemId | Item No. |
| locId | Location No. |
| qStk, qWIP, qRes, qOrd | qStk, qWIP, qRes, qOrd |

### MIBOMH → BillsOfMaterial.json

| Export column | → App field |
|---------------|-------------|
| bomItem, BOM Item | Parent Item No. |
| bomRev, BOM Rev | Revision No. |
| mult | Build Quantity |
| descr | Description |

### Jobs (MIJOBH, MIJOBD), PO costs (MIPOCV, MIPODC), extensions (MIPOC, MIPOHX), routings (MIMORD), lot/serial (MISLTH, MISLTD)

See `full_company_data_converter.py` → `FULL_COMPANY_MAPPINGS` for the full column map. The logic is: **every key in the mapping = an export column name we accept; the value = the app field name we write.**

---

## Summary

1. **Put** CSV/Excel from MISys “Export All Company Data” into  
   `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data as of 02_10_2026`.
2. **File names** must match the table above (e.g. `Item.csv` or `MIITEM.csv`, `MIBOMD.csv`, `MIPOH.csv`, `MIPOD.csv`).
3. **Column headers** in each file are mapped by the roadmap above; matching is case-insensitive and strips spaces.
4. **App data** is then loaded by the portal from this folder (when the backend can see the path). No mock data—all from your export.

To add or change a mapping, edit `backend/full_company_data_converter.py` → `FULL_COMPANY_MAPPINGS` and, if you want, add the same to this roadmap.
