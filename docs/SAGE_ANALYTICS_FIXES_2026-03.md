# Sage Analytics Fixes — March 2026

**Purpose:** Internal documentation for real company data. All figures verified against actual Sage CSV exports on G Drive.

---

## Data Source (Verified)

**Path:** `G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From SAGE`

**Latest export folder:** `March 11, 2026_06-18 PM` (by LastWriteTime)

**Other date folders present:** March 6, March 4, March 3 (multiple)

---

## titrec.CSV — Invoice/Transaction Headers

**File:** `titrec.CSV` in the latest date subfolder

**Key columns (verified):** `lId`, `dtASDate`, `lVenCusId`, `dInvAmt`, `bReversal`, `bReversed`

**Fiscal year logic:** Sage 50 fiscal year = April 1 – March 31. FY2026 = Apr 1 2025 – Mar 31 2026.

**Row counts (dInvAmt > 0 only — invoiced revenue transactions):**

| Fiscal Year | Rows |
|-------------|------|
| FY2011 | 422 |
| FY2012 | 572 |
| FY2013 | 734 |
| FY2014 | 945 |
| FY2015 | 1,000 |
| FY2016 | 962 |
| FY2017 | 1,195 |
| FY2018 | 1,555 |
| FY2019 | 1,851 |
| FY2020 | 2,280 |
| FY2021 | 2,636 |
| FY2022 | 3,856 |
| FY2023 | 3,715 |
| FY2024 | 3,638 |
| FY2025 | 3,090 |
| FY2026 | 1,900 |

**Date range in data:** 2010-06-07 to 2026-03-11

**Conclusion:** FY2023, FY2024, FY2025 all have data. Empty sections were caused by backend bugs, not missing data.

---

## titrline.CSV — Transaction Line Items

**File:** `titrline.CSV` in the same folder

**Key columns (verified):** `lITRecId` (links to titrec.lId), `lInventId`, `dQty`, `dPrice`, `dAmt`, `dCost`, `dRev`, `bReversal`

**Note:** CSVs may have UTF-8 BOM on the first column. The backend uses `utf-8-sig` so `lITRecId` matches correctly.

---

## Root Causes & Fixes

### 1. titrline join column (Best Movers, Sales by Product, Margin Analysis)

**Bug:** Code looked for `lTransId`, `lRecId`, `lTitRecId`. The actual column in titrline is **`lITRecId`** (links to titrec.lId).

**Fix:** Added `lITRecId` as the first candidate in `_find_col()` in `sage_gdrive_service.py`.

**Impact:** Best Movers, Sales by Product, and Margin Analysis now filter correctly by fiscal year.

---

### 2. Cloud API folder structure

**Bug:** Drive API searched the base folder first. CSVs are in date subfolders (e.g. `March 11, 2026_06-18 PM`).

**Fix:** Load from the latest date subfolder first (by modifiedTime), then fall back to base.

**Impact:** Cloud (Render) loads the correct Sage data from Drive.

---

### 3. Sage Browser — live MySQL unreachable on production

**Bug:** Sage Browser uses live Sage 50 MySQL at 192.168.1.11. Render/Vercel cannot reach that internal IP.

**Fix:** Frontend fallback to G Drive when live Sage fails:
- customers → `/api/sage/gdrive/customers`
- inventory → `/api/sage/gdrive/inventory`
- orders → `/api/sage/gdrive/sales-orders`

Vendors, accounts, receipts still require live Sage (no G Drive API for those).

**Impact:** Sage Browser works on production using G Drive data when live MySQL is unavailable.

---

### 4. UTF-8 BOM on first column

**Bug:** Some Sage CSVs have UTF-8 BOM. The first column can appear as `\ufefflITRecId`, so `lITRecId` was not matched.

**Fix:** Use `utf-8-sig` when reading CSVs (local and API). This strips BOM so column names match.

---

## Margin Analysis

**Formula:** `margin % = (revenue - COGS) / revenue × 100`

**Source:** titrline `dAmt` (revenue), `dCost` (COGS), joined to titrec by `lITRecId` for fiscal year filter.

**Logic:**
- Excludes `lInventId = 0` (non-inventory lines)
- Fiscal year filter when year is selected
- Reversals (negative amounts) included for net margin
- Rounding: 1 decimal place

---

### 5. Top Customers — Wrong/False Data (March 12, 2026)

**Bug:** Top Customers showed companies "we haven't sold to in years" with incorrect revenue. Root causes:
- **titrec** contains both AR (customer) and AP (vendor) transactions; `lVenCusId` can be customer OR vendor ID
- Reversals (`bReversal`, `bReversed`) were not excluded — could double-count or skew amounts
- Vendor IDs from PO transactions were being matched to customer IDs, inflating/incorrecting revenue

**Fix:** In `_customer_revenue_from_titrec`, `_customer_last_sale_from_titrec`, and `get_monthly_revenue`:
1. Exclude reversals: filter `bReversal=0` and `bReversed=0`
2. Only include rows where `lVenCusId` exists in `tcustomr` (customer IDs only — excludes vendor IDs from PO transactions)
3. In `get_top_customers`: exclude customers whose last sale was >2 fiscal years ago (stale/inactive)

**Impact:** Top Customers, KPIs, Monthly Revenue, and Best Movers now show only AR customer invoices with correct revenue. Inactive customers are filtered out.

---

## Files Changed

| File | Changes |
|------|---------|
| `backend/sage_gdrive_service.py` | lITRecId join, subfolder-first API load, utf-8-sig for BOM; reversal exclusion; valid-customer filter; recency filter |
| `frontend/src/components/ERPPortal.tsx` | Sage Browser G Drive fallback, sCustomerName alias, sales_orders extraction |
