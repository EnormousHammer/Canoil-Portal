# ERP System vs Sage Data — Full Audit

**Purpose:** Ensure no misleading numbers. Map every ERP data point to its source and flag discrepancies.

**Date:** March 12, 2026

---

## 1. Data Source Summary

| Source | Type | Tables / Files | Used By |
|--------|------|----------------|---------|
| **Sage G Drive CSV** | Exported CSVs from Sage 50 | tcustomr, tsalordr, tsoline, titrec, titrline, tinvent, tinvext, tcustr, etc. | ERP Portal (most sections), AI Command Center Sage panel |
| **Sage 50 MySQL** | Live database (192.168.1.11) | same tables, live | Sage Browser, SO lookup fallback |
| **MISys / G Drive JSON** | Full Company Data From Misys | Items.json, SalesOrderHeaders, ParsedSalesOrders, etc. | AI Command Center Enterprise Analytics, MRP |

---

## 2. ERP Portal Section-by-Section Audit

### 2.1 Overview

| Data Point | Source | Endpoint | Notes |
|------------|--------|----------|-------|
| Record counts (customers, SOs, etc.) | Sage G Drive | `GET /api/sage/gdrive/status` | Row counts from cached CSV load. **Real.** |
| Last loaded time | Sage G Drive | same | When cache was last refreshed. |
| Mode (Cloud vs Local) | Sage G Drive | same | Where data was loaded from. |

**Risk:** None. Counts are from actual loaded CSVs.

---

### 2.2 Customers

| Data Point | Source | Endpoint | Notes |
|------------|--------|----------|-------|
| Customer list | Sage G Drive | `GET /api/sage/gdrive/customers` | tcustomr.CSV |
| YTD sales (dAmtYtd) | Sage G Drive | same | Sage's fiscal YTD field from export |
| Last sale (dtLastSal) | Sage G Drive | same | From export |

**Risk:** None. All from tcustomr.

---

### 2.3 Sales Orders

| Data Point | Source | Endpoint | Notes |
|------------|--------|----------|-------|
| Order list | Sage G Drive | `GET /api/sage/gdrive/sales-orders` | tsalordr, tsoline |
| Customer, total, status | Sage G Drive | same | From export |

**Risk:** None. All from tsalordr/tsoline.

---

### 2.4 Financials — AR & Invoices

| Data Point | Source | Endpoint | Notes |
|------------|--------|----------|-------|
| AR aging | Sage G Drive | `GET /api/sage/gdrive/analytics/ar-aging` | tcustr (primary) or titrec fallback |
| Recent invoices | Sage G Drive | `GET /api/sage/gdrive/analytics/recent-invoices` | titrec (last 100 by date) |

**Risk:** AR can be empty if tcustr/titrec lack balance columns (dBalance, dBalDue, etc.) or column names differ. Diagnostic message added when empty.

---

### 2.5 Financials — Margin Analysis

| Data Point | Source | Endpoint | Notes |
|------------|--------|----------|-------|
| Revenue, COGS, margin % | Sage G Drive | `GET /api/sage/gdrive/analytics/sales-by-product?limit=500` | titrline (dAmt, dCost) |

**⚠️ MISLEADING RISK:** Margin Analysis calls **without `year`** → **all-time** data. UI says "all-time, X items" in the Blended Margin card. But:
- **Sage Analytics** Sales by Product tab has fiscal year selector.
- **Margin Analysis** has no year selector and always shows all-time.
- If user expects current-year margins, they will see different (larger) numbers.

**Recommendation:** Add fiscal year selector to Margin Analysis, or clearly label "All-time (not fiscal year)" at top.

---

### 2.6 Sage Analytics

| Data Point | Source | Endpoint | Fiscal Year Filter |
|------------|--------|----------|--------------------|
| KPIs (YTD revenue, prior year, YoY) | Sage G Drive | `GET /api/sage/gdrive/analytics/kpis?year=` | ✅ Yes |
| Top customers | Sage G Drive | `GET /api/sage/gdrive/analytics/top-customers?year=` | ✅ Yes |
| Best movers | Sage G Drive | `GET /api/sage/gdrive/analytics/best-movers?year=` | ✅ Yes |
| Monthly revenue | Sage G Drive | `GET /api/sage/gdrive/analytics/monthly-revenue?year=` | ✅ Yes |
| Sales by product | Sage G Drive | `GET /api/sage/gdrive/analytics/sales-by-product?year=` | ✅ Yes (when year passed) |

**Current FY:** Uses Sage's built-in fields (dAmtYtd, dLastYrAmt, dYTDUntSld from tcustomr/tinvext) — Sage's own fiscal YTD.

**Other FYs:** Aggregates from titrec/titrline filtered by fiscal year (Apr 1 – Mar 31).

**Risk:** Historical years (FY2025, FY2024, etc.) depend on titrec having correct dates. Date format fix (MM/DD/YYYY support) applied. If dates still wrong, no data.

---

### 2.7 Sage Browser

| Data Point | Source | Endpoint | Notes |
|------------|--------|----------|-------|
| Customers, vendors, inventory, etc. | **Sage 50 MySQL** | `GET /api/sage/customers`, `/api/sage/vendors`, etc. | **Different source than G Drive** |

**⚠️ CROSS-SOURCE RISK:** Sage Browser uses **live MySQL**; ERP Customers uses **G Drive CSV**. If G Drive export is stale, numbers will differ:
- ERP Customers: snapshot from last export
- Sage Browser: live data

**Recommendation:** Add badge "Live Sage 50" vs "Sage G Drive snapshot" so users know which is which.

---

### 2.8 Item Mapping

| Data Point | Source | Endpoint | Notes |
|------------|--------|----------|-------|
| MiSys items | MISys / G Drive | data prop | Items.json, MIITEM |
| Sage items | Sage G Drive | `GET /api/sage/gdrive/inventory` | tinvent |
| Mapping table | Backend | `GET /api/sage/item-mapping` | Stored mappings |

**Risk:** None for misleading numbers. Mapping is operational, not financial.

---

## 3. AI Command Center — Dual Analytics

### 3.1 Sage Analytics Panel (Sage tab)

| Data | Source | Endpoint |
|------|--------|----------|
| KPIs, monthly revenue, top customers, best movers | Sage G Drive | `/api/sage/gdrive/analytics/*` |

**Risk:** None. Same as ERP Sage Analytics.

---

### 3.2 Enterprise Analytics (Generated from data prop)

| Data | Source | Notes |
|------|--------|-------|
| Total revenue | SalesOrders.json, RealSalesOrders, ParsedSalesOrders, SalesOrderHeaders | **NOT Sage** |
| Monthly trends | Same | Order totals, not invoiced amounts |
| Top customers | Same | From order data |
| Inventory value | Items.json, MIITEM | MISys inventory |

**⚠️ MISLEADING RISK:** Enterprise Analytics uses **MISys/G Drive Sales Orders** (parsed PDFs, order headers), **not Sage invoiced revenue**. Differences:
- **Sage revenue** = invoiced amounts (titrec, titrline) — what actually got billed
- **Enterprise revenue** = order totals from SO documents — may include unshipped, cancelled, or different amounts

If both panels are visible, users could see two different "revenue" numbers and not know which is authoritative.

**Recommendation:** Add clear labels: "Sage: Invoiced revenue (FY)" vs "Enterprise: Order totals (from SO documents)".

---

## 4. Sage G Drive Backend Logic (Summary)

| Function | Current FY | Other FYs | Tables |
|----------|------------|-----------|--------|
| KPIs | `dAmtYtd`, `dLastYrAmt` from tcustomr | `_customer_revenue_from_titrec(year)` | tcustomr, titrec |
| Top customers | Same | Same | tcustomr, titrec |
| Best movers | `dYTDUntSld` from tinvext | `_item_stats_from_titrline(year)` | tinvext, titrline |
| Monthly revenue | titrec filtered by FY | `_fiscal_year_date_range(year)` | titrec |
| Sales by product | Same | titrline via titrec join | titrline, titrec |

**Date format:** `_normalize_date_to_iso()` handles YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY.

---

## 5. Checklist: Potential Misleading Numbers

| # | Issue | Location | Severity | Fix | Status |
|---|-------|----------|----------|-----|--------|
| 1 | Margin Analysis = all-time, not fiscal year | Financials → Margins | Medium | Add FY selector | ✅ Done |
| 2 | Sage Browser vs ERP Customers = different sources | Sage Browser vs Customers | Low | Add source badges | ✅ Done |
| 3 | Enterprise Analytics vs Sage = different revenue | AI Command Center | High | Label "Order totals" vs "Invoiced" | ✅ Done |
| 4 | AR aging empty | Financials → AR | Medium | Check tcustr/titrec columns; diagnostic shown | — |
| 5 | Historical FY no data | Sage Analytics | Medium | Date format fix; verify titrec has history | ✅ Done |

---

## 6. Verification Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/sage/gdrive/status` | Row counts, cache status |
| `GET /api/sage/gdrive/debug/columns` | Column names for titrec, tcustr, etc. |
| `GET /api/sage/gdrive/debug/fiscal-years` | Available years, date range, sample dates |

---

## 7. Data Flow Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    ERP Portal / AI Command Center        │
                    └─────────────────────────────────────────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ /api/sage/*         │    │ /api/sage/gdrive/*   │    │ data prop           │
│ (Sage 50 MySQL)     │    │ (Sage G Drive CSV)   │    │ (MISys JSON)        │
│                     │    │                     │    │                     │
│ Sage Browser only   │    │ ERP: Overview,       │    │ AI: Enterprise      │
│ Live data           │    │ Customers, SOs,      │    │ Analytics           │
│                     │    │ Financials,          │    │ Order totals        │
│                     │    │ Sage Analytics       │    │ (NOT invoiced)      │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

---

## 8. Conclusion

**Real Sage data:** All ERP sections except Sage Browser use Sage G Drive CSV. Sage Browser uses live MySQL. Both are real Sage data; they can differ if G Drive export is stale.

**Fiscal year:** Sage Analytics KPIs, top customers, best movers, monthly revenue, and sales-by-product (when year selected) are filtered by fiscal year (Apr–Mar). Margin Analysis is **all-time** (no year filter).

**Non-Sage:** AI Command Center Enterprise Analytics uses MISys/G Drive Sales Orders — order totals, not Sage invoiced amounts. Label clearly to avoid confusion.
