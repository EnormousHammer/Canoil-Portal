# Canoil Portal — Data Source Map (Cloud)

**All data works on cloud.** This app gets data from **3 sources only**:

---

## 1. MISys Data → Full Company Data From Misys

| Location | Cloud Path (Google Drive API) |
|----------|------------------------------|
| **Local** | `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From Misys\{YYYY-MM-DD}` |
| **Cloud** | `MiSys/Misys Extracted Data/Full Company Data From Misys` (latest subfolder by creation time) |

**What it provides:**
- Items (MIITEM.CSV → Items.json)
- Stock by location (MIILOCQT.CSV → MIILOCQT.json)
- BOM, MOs, POs, Jobs, Lots, Costs, Suppliers, etc.

**How it loads on cloud:** `google_drive_service.find_latest_full_company_data_folder()` → `full_company_data_converter.load_from_drive_api()`

---

## 2. Sage Data → Full Company Data From SAGE

| Location | Cloud Path (Google Drive API) |
|----------|------------------------------|
| **Local** | `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From SAGE\{YYYY-MM-DD}` |
| **Cloud** | `MiSys/Misys Extracted Data/Full Company Data From SAGE` (latest subfolder) |

**What it provides:**
- Customers (tcustomr), Vendors (tvendor)
- Inventory (tinvent), Stock by location (tinvbyln)
- Sales orders (tsalordr, tsoline), Invoices (titrec, titrline)
- Pricing (tinvprc, tprclist), etc.

**How it loads on cloud:** `sage_gdrive_service._find_latest_sage_folder_api()` → loads CSVs via Google Drive API

---

## 3. Sales Orders (PDF/Word) → Google Drive

| Location | Cloud Path (Google Drive API) |
|----------|------------------------------|
| **Local** | `G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders` |
| **Cloud** | `Sales_CSR/Customer Orders/Sales Orders` |

**What it provides:**
- Parsed Sales Orders (ParsedSalesOrders.json) — extracted from PDF/Word docs
- Status folders (e.g. Pending, Shipped)

**How it loads on cloud:** Google Drive API lists files in folder → downloads → parses PDF/Word

---

## Summary Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              Google Drive (Shared: IT_Automation)         │
                    └─────────────────────────────────────────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ Full Company Data   │    │ Full Company Data   │    │ Sales_CSR/          │
│ From Misys         │    │ From SAGE           │    │ Customer Orders/    │
│                     │    │                     │    │ Sales Orders        │
│ MIITEM, MIILOCQT,   │    │ tinvent, tinvbyln,  │    │                     │
│ MIBOMD, MIPOH,      │    │ tsalordr, tsoline,  │    │ PDF + Word docs     │
│ MILOGH, etc.        │    │ tcustomr, tvendor   │    │ → ParsedSalesOrders │
└──────────┬──────────┘    └──────────┬──────────┘    └──────────┬──────────┘
           │                          │                          │
           │    full_company_          │    sage_gdrive_          │    so_optimizer
           │    data_converter         │    service               │    / raw_so_extractor
           ▼                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         /api/data (merged response)                          │
│  Items.json, MIILOCQT.json, ParsedSalesOrders.json, MPS.json, etc.          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What Is NOT a Data Source

- **CustomAlert5** — Not a separate source. If `CustomAlert5.CSV` exists in Full Company Data MISys folder, it maps to Items.json (alternate MISys export filename). The app does not use a separate "CustomAlert5" folder.
- **API Extractions** — Legacy fallback folder. Primary source is Full Company Data From Misys. API Extractions is only used when Full Company Data fails to load.

---

## Environment Variables (Cloud)

| Variable | Purpose |
|----------|---------|
| `FULL_COMPANY_DATA_DRIVE_PATH` | MISys folder path (default: `MiSys/Misys Extracted Data/Full Company Data From Misys`) |
| `SAGE_GDRIVE_DRIVE_PATH` | Sage folder path (default: `MiSys/Misys Extracted Data/Full Company Data From SAGE`) |
| `GOOGLE_DRIVE_SALES_ORDERS_PATH` | Sales orders path (default: `Sales_CSR/Customer Orders/Sales Orders`) |
| `GOOGLE_DRIVE_SHARED_DRIVE_NAME` | Shared drive name (default: `IT_Automation`) |
