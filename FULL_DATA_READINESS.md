# Full Company Data – How MISys Fits and Are We Ready?

## How MISys operates (and how we use it)

- **MISys** = the ERP. It holds items, BOMs, manufacturing orders, purchase orders, work orders, jobs, routings, lot/serial, etc.
- **“Export All Company Data”** = MISys exports that data to a folder of **CSVs (and sometimes Excel)** – one file per table (e.g. `MIITEM.csv`, `MIPOH.csv`, `MIPOD.csv`).
- **Column names** in those files can be MISys internal (e.g. `itemId`, `mohId`, `supId`) or display names (e.g. `Item No.`, `Supplier No.`, `Order Date`). We map them in `backend/full_company_data_converter.py` to the **exact field names the portal uses** (e.g. `Item No.`, `PO No.`, `Total Amount`, `Buyer`, `Terms`, `Ship Via`, `FOB`, `Freight`, `Unit Cost`, `Required Date`).
- **Our flow:** User clicks **“Load”** next to “Full Company Data” in the header → backend reads the Full Company Data folder (local path or Google Drive API), converts only the files we know how to map, returns the same JSON shape the app already uses → **all existing UI works** (Inventory, BOM, MO, PO, WO, shortage, create PO, receive, release/complete MO/WO, lot history).

So: we don’t run MISys; we **consume its export** and turn it into the portal’s data model.

---

## What we can take from Full Company Data today

| Full Company Data file | App data (what the UI uses) | Status |
|------------------------|-----------------------------|--------|
| **MIITEM** / Item | CustomAlert5.json, Items.json (items, stock, reorder, costs, Item Type) | ✅ Converted |
| **MIILOC** | MIILOC.json (inventory by location) | ✅ Converted |
| **MIBOMH** | BillsOfMaterial.json, MIBOMH.json | ✅ Converted |
| **MIBOMD** | BillOfMaterialDetails.json, MIBOMD.json | ✅ Converted |
| **MIMOH** | ManufacturingOrderHeaders.json, MIMOH.json | ✅ Converted |
| **MIMOMD** | ManufacturingOrderDetails.json, MIMOMD.json | ✅ Converted |
| **MIPOH** | PurchaseOrders.json, MIPOH.json (incl. Buyer, Terms, Ship Via, FOB, Freight, Status, Total, etc.) | ✅ Converted |
| **MIPOD** | PurchaseOrderDetails.json, MIPOD.json (incl. Unit Cost, Description, Required Date, Extended Price) | ✅ Converted |
| **MIWOH** | WorkOrders.json, WorkOrderHeaders.json | ✅ Converted |
| **MIWOD** | WorkOrderDetails.json, MIWOD.json | ✅ Converted |
| **MISLTH** | LotSerialHistory.json | ✅ Converted |
| **MISLTD** | LotSerialDetail.json | ✅ Converted |
| **MIMORD** | ManufacturingOrderRoutings.json, MIMORD.json (work centers, operations) | ✅ Converted |
| **MIPOC** / **MIPOHX** | PurchaseOrderExtensions.json (PO extension key/value) | ✅ Converted |
| **MIPOCV** | PurchaseOrderAdditionalCosts.json (header-level additional costs) | ✅ Converted |
| **MIPODC** | PurchaseOrderDetailAdditionalCosts.json (line-level additional costs) | ✅ Converted |
| **MIJOBH** | Jobs.json, MIJOBH.json | ✅ Converted |
| **MIJOBD** | JobDetails.json, MIJOBD.json | ✅ Converted |

So for **items, inventory by location, BOM, MO, PO (including extensions and additional costs), WO, Jobs, MO routings, and lot/serial**, the app **can take full data** from these CSVs. The UI (Inventory with Raw/Assembled/Formula and Lot history, BOM, MO, PO with full supplier/cost/header, WO, shortage, create PO with full header + costs, receive, release/complete MO/WO) works with that data.

---

## What we don’t take from Full Company Data (yet)

| Area | Full Company Data file(s) | Status |
|------|---------------------------|--------|
| **Sales orders** | Not in standard “Export All Company Data” we use | ❌ SO from PDF/Drive only |
| **Suppliers/Vendors master** | If MISys exports a vendor table (e.g. MISUP) | ❌ Not mapped |

Sales Orders come from PDF/Drive scanning. A vendors master can be added in `full_company_data_converter.py` when you have the CSV.

---

## Are we ready? – Checklist

- **Converter**
  - All core and extended tables: MIITEM, MIILOC, MIBOMH, MIBOMD, MIMOH, MIMOMD, MIPOH, MIPOD, MIWOH, MIWOD, MISLTH, MISLTD, **MIMORD**, **MIPOC**, **MIPOHX**, **MIPOCV**, **MIPODC**, **MIJOBH**, **MIJOBD**.
  - MIPOH: full header (PO No., Supplier, Order Date, Status, Total Amount, Buyer, Terms, Ship Via, FOB, Freight, Contact, Close Date, Currency, Tax/Invoice fields).
  - MIPOD: full lines (Item No., Ordered, Received, Unit Cost, Unit Price, Line No., Description, Required Date, Extended Price, Comment, Job No., etc.).
  - PO extensions (MIPOC/MIPOHX) → PurchaseOrderExtensions.json; header additional costs (MIPOCV) → PurchaseOrderAdditionalCosts.json; line additional costs (MIPODC) → PurchaseOrderDetailAdditionalCosts.json. PO details “Additional Costs” tab shows all three and line-level table + totals.
  - MIMORD → ManufacturingOrderRoutings.json (MO routings). MIJOBH → Jobs.json, MIJOBD → JobDetails.json.
- **App data shape**
  - `get_empty_app_data_structure()` in `app.py` includes all keys the UI and converter use (including LotSerialHistory.json, LotSerialDetail.json).
- **Merge with portal actions**
  - Full Company Data load runs `_merge_portal_store(full_data)` so portal-created POs/MOs, receives, WO updates, inventory adjustments, and lot history are applied on top of the export.
- **UI**
  - Inventory: filters (All, Low stock, Out of stock, Raw, Assembled, Formula), Lot history tool, shortage, BOM cart, receive against PO with optional lot.
  - PO: full header (supplier, terms, ship, cost, freight, etc.) in list and details modal; Create PO with full form + supplier picker + line costs + totals; receive by line.
  - MO: create, release, complete, backflush; WO: release, complete.
  - Data source: default = API Extractions (G: or Drive); “Load” next to “Full Company Data” = load from Full Company Data folder and convert.

So: **we are ready** for Full Company Data for **items, BOM, MO (with routings), PO (with extensions and additional costs), WO, Jobs, and lot/serial**. No half measures: all mapped MISys export tables are converted and surfaced in the UI where applicable. For a given MISys export, put the CSVs in the Full Company Data folder (local or Drive), click “Load” next to “Full Company Data”, and the app will use that data end-to-end. Column names in the CSVs must match what the converter expects (or be added to the mapping in `full_company_data_converter.py`).

---

## How to test Full Company Data

1. Put the MISys export CSVs in:  
   `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data as of 02_10_2026`  
   (or set `FULL_COMPANY_DATA_DRIVE_PATH` and use the Drive API).
2. In the app header, click **“Load”** next to **“Full Company Data”**.
3. Check: Inventory (counts, Raw/Assembled/Formula, Lot history), BOM, MO, PO (list + detail + create + receive), Work Orders (list + release/complete). All should use the loaded data; portal actions (create PO, receive, etc.) merge on top.

If a column in the export doesn’t appear in the app, add it to the appropriate mapping in `backend/full_company_data_converter.py` (export column name → app field name).
