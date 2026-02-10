# Canoil Portal / ERP: Full Company Data Import – What’s Needed

## 1. Where the full company data is

**Local path (Google Drive for Desktop / shared drive):**  
`G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data as of 02_10_2026`

- This is the **MISys "Export All Company Data"** output (folder date = 2026-02-10).
- The same data is available in **Google Drive** (that path is the local mount of a Google Drive folder).
- **Backend on Render** has no `G:\`; it must use the **Google Drive API** to read the same folder.
- **Drive-relative path (for API):** `MiSys/Misys Extracted Data/Full Company Data as of 02_10_2026`
- **Backend config:** The app defines `GDRIVE_FULL_COMPANY_DATA` (local) and `FULL_COMPANY_DATA_DRIVE_PATH` (for API) in `backend/app.py` so import code can use them for easy fetching.

Contents: **multiple CSV (and possibly Excel) files**, one per MISys table (Item, Purchase Order, Bill of Materials, Manufacturing Order, Serial/Lot Tracking Log Header, Serial/Lot Tracking History, etc.).

---

## 2. How the app works today (don’t break it)

- **Backend:** Cloud (Render). **Data source:** Google Drive via API (same shared drive; different folder from Full Company Data).
- **App expects:** Specific **JSON files** with fixed names, e.g.:
  - `CustomAlert5.json` (item master + stock)
  - `ManufacturingOrderHeaders.json`, `ManufacturingOrderDetails.json`
  - `BillOfMaterialDetails.json` / `MIBOMD.json`
  - `PurchaseOrders.json`, `PurchaseOrderDetails.json` (or MIPOH/MIPOD)
  - `WorkOrders` / `WorkOrderDetails`, `SalesOrders`, etc.
- **Current data path** the backend uses (e.g. "latest" folder under "API Extractions") is **not** the Full Company Data folder. So we need either:
  - **Option A:** Import: read Full Company Data (CSV/Excel) → convert → **write** these JSON files into the folder the app already reads from (same structure, same names), or
  - **Option B:** Add a "data source mode" that reads from the Full Company Data folder and serves the same JSON shape from there (without changing the existing folder).

Either way, the **frontend and existing API contracts stay the same**; only where the backend gets the data changes (or how that folder is populated).

---

## 3. What’s needed in the copy repo (Canoil-Portal-ERP)

### 3.1 Backend (Render, same as this app)

- **Read Full Company Data folder via Google Drive API**
  - Use `FULL_COMPANY_DATA_DRIVE_PATH` (see `app.py`) for the folder path in Drive.
  - List files in that folder; read CSV (and .xlsx if present).
  - Handle encoding (e.g. UTF-8), delimiter, headers.

- **Table → "app entity" mapping**
  - Map each **MISys export file/table** to the **JSON "file"** the app expects (e.g. `Item` → `CustomAlert5.json`, `Manufacturing Order Header` → `ManufacturingOrderHeaders.json`). Document or config: which CSV/Excel file corresponds to which app entity.

- **Column → field mapping**
  - Map CSV/Excel **column names** to the **exact field names** the app uses (e.g. `Item No.`, `Stock`, `WIP`, `Reserve`, `On Order` for items). The app and `misys.ts` / `fieldMappings.ts` define those names; the export may use different headers (e.g. `ItemNo`), so a mapping layer is required.

- **Convert and serve (or write)**
  - Convert parsed CSV/Excel rows → the JSON structure the app expects (same keys, types).
  - Either:
    - **Import mode:** Write those JSON files to the **existing** app data folder in Google Drive (so the current "load data" flow stays unchanged), or
    - **Direct read mode:** When "use Full Company Data" is selected, read from the Full Company Data folder, convert in memory (or cache), and serve the same `/api/data` (or equivalent) response shape.

- **Validation**
  - Required columns present, basic types (numbers, dates), no duplicate keys where it matters. Log errors and row counts; optional dry-run.

- **Config**
  - Full Company Data folder path is in `app.py` (`GDRIVE_FULL_COMPANY_DATA`, `FULL_COMPANY_DATA_DRIVE_PATH`). Optionally: "use Full Company Data" vs "use existing API Extractions" (if you keep both).

### 3.2 Serial/Lot and item-related data

- Export includes **Serial/Lot Tracking Log Header** and **Serial/Lot Tracking History** (and possibly other lot/serial tables). They are **item-related** (linked by Item No.).
- **Short term:** At least map and import (or expose) these so the backend can read them; store or serve in a clear structure (e.g. by item, lot/serial, quantity, document, date).
- **Later:** Add UI in the ERP app for "inventory by lot" or "lot history" if you want that in the copy repo.

### 3.3 Frontend (optional for first step)

- No change **required** if the backend keeps serving the same JSON and same API.
- **Useful later:** A small "Data source" or "Import" section (e.g. in settings or admin): choose "Use Full Company Data as of 02_10_2026" (or run "Import from Full Company Data"), show status and last run result.

### 3.4 What to have in the repo for the new chat

- **This brief** (so the AI knows the path, that backend is on Render and uses Google Drive API, and that Full Company Data is in that folder).
- **List of app entities and their JSON file names** (from this app: CustomAlert5, ManufacturingOrderHeaders, etc.) so mapping is explicit.
- **One sample:** One CSV from `Full Company Data as of 02_10_2026` (e.g. Item or Purchase Order) – column list and 1–2 sample rows – so the new chat can define the exact column → field mapping.
- **Google Drive folder id or full path** for `Full Company Data as of 02_10_2026` (as used in the API), if you have it; otherwise use `FULL_COMPANY_DATA_DRIVE_PATH` from `app.py`.

---

## 4. One-sentence summary for the new chat

**"In Canoil-Portal-ERP we need the backend (same cloud/Render + Google Drive API) to read the MISys Full Company Data from the folder defined by `FULL_COMPANY_DATA_DRIVE_PATH` in `app.py` (or local `GDRIVE_FULL_COMPANY_DATA`), parse the CSVs (and Excel if present), map tables and columns to the JSON structure and file names the app already uses, then either write that JSON to the existing app data folder or serve it from that source so the app works without changes; and treat Serial/Lot tables as item-related."**
