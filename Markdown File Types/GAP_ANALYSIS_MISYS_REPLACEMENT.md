# Complete Gap Analysis Report: Canoil Portal → Modern MISys Replacement

**Date:** March 1, 2026  
**Purpose:** Identify every gap between the current Canoil Portal and a full ERP replacement for MISys Manufacturing.

---

## 1. DATABASE & PERSISTENCE (Currently: JSON files)

### What exists:
- PostgreSQL schema in `db/01_schema.sql` with 25+ staging tables and 15+ core tables
- ETL script `etl_full_company_to_postgres.py` that loads from CSV → staging → core
- `portal_store.json` holding all mutations (MOs, POs, inventory, BOM, WOs)

### What's missing:

| Gap | Detail |
|-----|--------|
| No runtime DB connection | `app.py` never imports psycopg2 or connects to Postgres |
| Mutations are ephemeral | `portal_store.json` resets on Render redeploy |
| No SO tables | `core.sales_orders` and `core.sales_order_lines` don't exist |
| No customer table | `core.customers` doesn't exist |
| No work order tables | Schema explicitly excludes them |
| No audit log table | `core.audit_log` doesn't exist |
| No GL/AP/AR tables | No financial tables at all |
| ETL is CLI-only | Never runs automatically; manual `python -m db.etl_full_company_to_postgres` |

---

## 2. AUTHENTICATION & RBAC (Currently: Hardcoded admin)

### What exists:
- Hardcoded in `App.tsx`: `isLoggedIn = true`, `user = admin@canoilcanadaltd.com`, `isAdmin: true`
- MISys user data (`MIUSER.json`) with 12 users (user_id, name, email, is_active)
- `core.users` table in the Postgres schema (from MIUSER)

### What's missing:

| Gap | Detail |
|-----|--------|
| No login page | No username/password or SSO |
| No JWT/session | No token validation on any endpoint |
| No auth middleware | Every API endpoint is open |
| No roles/permissions | No viewer/operator/manager/admin distinction |
| No portal user table | `core.users` is MISys users, not portal users |
| User on mutations is client-provided | Backend trusts `body.user` without verification |

---

## 3. AUDIT TRAIL (Currently: Partial timestamps)

### What exists:

| Mutation | Has Timestamp | Has User |
|----------|:------------:|:--------:|
| MO events | Yes (`ts`) | Yes (from request body) |
| PO receives | Yes (`at`) | Yes (from request body) |
| Inventory adjustments | Yes (`at`) | No (hardcoded "portal") |
| Location transfers | Yes (`at`) | No (hardcoded "portal") |
| MO completion lots | Yes (`at`) | No |
| Created MOs | No | No |
| MO status updates | No | No |
| WO updates | No | No |
| Created POs | No | No |
| BOM edits | No | No |
| Item overrides | No | No |

### What's missing:
A proper `audit_log` table with who/what/when/before/after for every change.

---

## 4. SALES ORDER CRUD (Currently: Read-only)

### What exists:
- SO PDFs served from Google Drive (`Sales_CSR/Customer Orders/Sales Orders`)
- PDF parsing via `raw_so_extractor.py` extracting: SO number, customer, dates, items, addresses, terms
- `CleanIntelligentSOEntry.tsx` has a create form but `handleApproveSO()` only shows `alert('✅ Sales Order created successfully!')` — no backend call
- `SalesOrderHeaders.json` and `SalesOrderDetails.json` exist in mappings but are empty arrays
- **🟢 Sage 50 Integration:** 4,734 sales orders with line items available read-only via `GET /api/sage/sales-orders` and `GET /api/sage/sales-orders/:id`

### What's missing:

| Gap | Detail |
|-----|--------|
| No `POST /api/sales-orders` | Cannot create SOs |
| No `PUT /api/sales-orders/<so_no>` | Cannot edit SOs |
| No SO persistence | No `created_sos` in portal_store |
| No SO status workflow | No open → confirmed → shipped → invoiced |
| Frontend form is disconnected | Form exists but doesn't call backend |

---

## 5. MRP ENGINE (Currently: Basic shortage)

### What exists:
- Shortage formula: `shortage = max(0, reorder_level - (on_hand + open_po))`
- Auto-create PO from shortage (`POST /api/mrp/auto-create-po`)
- Item data has: Lead (Days), Lot Size, Reorder Level, Reorder Quantity, Minimum, Maximum
- Supplier-item data has: Lead Time, Minimum Qty

### What's missing:

| Gap | Detail |
|-----|--------|
| No time-phased planning | No demand buckets by week/month |
| No demand from SOs | Shortage doesn't consider open SO demand |
| Lead time not used | Items have lead time but MRP ignores it |
| No safety stock logic | Safety stock fields exist but aren't used |
| No lot sizing rules | Lot Size field exists but not applied |
| No planned order generation | Just creates POs immediately, no planning horizon |
| No MRP run history | No record of when MRP was run and what it suggested |

---

## 6. CUSTOMER MASTER (Currently: None → Partially filled by Sage)

### What exists:
- Customer names derived from MOs (`Customer` field) and parsed SO PDFs (`customer_name`)
- Customer IDs in `MIMOH.json` (`custId`) and `MIJOBH.json` (`custId`)
- No `MICUST.json` or dedicated customer file from MISys
- **🟢 Sage 50 Integration:** 353 customers available read-only via `GET /api/sage/customers` and `GET /api/sage/customers/:id` — includes name, contact, address, city, province, phone, email, website, credit limit, YTD amounts, inactive flag, and recent sales orders

### What's missing:

| Gap | Detail | Sage 50 Status |
|-----|--------|:--------------:|
| No customer master table | No `core.customers` | 🟢 Read from Sage |
| No customer CRUD | Can't create, edit, or view customer records | ⚠️ Read-only from Sage |
| No customer contacts | No contact management | 🟡 Single contact from Sage |
| No customer addresses | Only parsed from SO PDFs | 🟢 Full address from Sage |
| No payment terms per customer | No net-30/60/90 | 🟡 `nNetDay` field available |
| No credit limits | No credit management | 🟢 `dCrLimit` field available |
| No customer pricing | No customer-specific price lists | ❌ Not in Sage integration |

---

## 7. SUPPLIER MASTER (Currently: Read-only → Supplemented by Sage)

### What exists:
- `MISUPL.json` with: Supplier No., Name, Address, City, State, Zip, Country, Phone, Contact, Currency, Terms, Email, Website, Notes
- `MIQSUP.json` (supplier-item): Supplier No., Item No., Lead Time, Min Qty
- Used in Purchase Requisition service for supplier lookup
- **🟢 Sage 50 Integration:** 478 vendors available read-only via `GET /api/sage/vendors` and `GET /api/sage/vendors/:id` — includes name, contact, address, phone, email, website, YTD amounts, inactive flag

### What's missing:

| Gap | Detail | Sage 50 Status |
|-----|--------|:--------------:|
| No supplier CRUD | Read-only from MISys export | ⚠️ Still read-only (Sage too) |
| No supplier performance tracking | No on-time delivery, quality scores | ❌ Not available |
| No multiple contacts per supplier | Only one contact field | ❌ Same in Sage |

---

## 8. COSTING (Currently: Display only)

### What exists:
- Items have: Recent Cost, Standard Cost, Average Cost, Landed Cost, Unit Cost
- PO lines have: Unit Cost, Extended Cost
- PO headers have: Additional costs (freight etc.) via MIPOCV/MIPODC
- Cost history: `MIICST.json` with cost, landed cost, extended cost, qty received/used/WIP
- Basic profit analytics in enterprise analytics
- **🟢 Sage 50 Integration:** Inventory items include `dLastCost`, `dCostOfStock`; pricing tiers via `GET /api/sage/inventory/:id`

### What's missing:

| Gap | Detail |
|-----|--------|
| No BOM cost rollup | `Cost Rollup Enabled` field exists but no logic |
| No cost variance reporting | Standard vs actual not compared |
| No landed cost calculation | Landed cost data exists but not computed |
| No cost-of-goods-sold | No COGS tracking per SO |
| No margin analysis per order | Only aggregate analytics |

---

## 9. INVOICING & FINANCIALS (Currently: Proforma only → Partially filled by Sage)

### What exists:
- Proforma Invoice generator from SO data → Excel template
- Commercial Invoice generator (customs document, not financial)
- PO data has `Invoiced`, `Total Invoiced`, `Billed Amount` fields from MISys
- **🟢 Sage 50 Integration:**
  - Chart of Accounts: 278 accounts via `GET /api/sage/accounts` (with type filtering)
  - Receipts & Payments: 5,433 records via `GET /api/sage/receipts` (date/entity filtering)
  - Sales Transactions: 332 records in Sage `trcsal` table
  - Purchase Transactions: 63 records in Sage `trcpur` table
  - Journal Entries: 3,122 records in Sage `tjourent` table
  - Dashboard summary with top customers and YTD order totals via `GET /api/sage/dashboard`

### What's missing:

| Gap | Detail | Sage 50 Status |
|-----|--------|:--------------:|
| No real invoices | No tax invoice generation | ⚠️ Sage has transaction data (read-only) |
| No Accounts Receivable | No AR aging, payment tracking | 🟡 Receipt data available from Sage |
| No Accounts Payable | No AP aging, payment tracking | 🟡 Payment data available from Sage |
| No General Ledger | No GL, chart of accounts | 🟢 278 accounts from Sage |
| No payment terms logic | No aging calculations | ❌ Must be built |
| No multi-currency conversion | Currency fields exist but no FX logic | ❌ Must be built |

---

## 10. APPROVAL WORKFLOWS (Currently: Direct action)

### What exists:
- MO: Create → Release → Complete (direct, no approval)
- PO: Create → Receive (direct, no approval)
- PR modal says "This will be connected to your approval workflow" but no implementation
- Status fields from MISys displayed but not enforced

### What's missing:

| Gap | Detail |
|-----|--------|
| No workflow engine | No configurable approval chains |
| No PO dollar thresholds | No "PO > $5000 needs manager approval" |
| No approval notifications | No email/in-app notification to approvers |
| No approval history | No record of who approved what |

---

## 11. QUALITY CONTROL (Currently: Minimal)

### What exists:
- COA (Certificate of Analysis) in logistics document checklists
- Inspection fields in schema: `iqStk`, `iqWIP`, `iqRes`, `iqOrd` (inspection stock/WIP/reserve)
- `_analyze_quality_metrics()` in enterprise analytics returns placeholder

### What's missing:

| Gap | Detail |
|-----|--------|
| No QC module | No inspection workflow |
| No inspection on receipt | PO receive doesn't trigger QC |
| No COA management | COA referenced but not generated/tracked |
| No quality specs per item | No specifications, tolerances |
| No hold/quarantine status | No inventory hold for QC |

---

## 12. SHIPPING & RECEIVING (Currently: Document generation)

### What exists:
- Full logistics document suite: BOL, packing slip, commercial invoice, TSCA, DG declarations
- Email parsing → SO lookup → document generation (GPT-4o powered)
- Multi-SO support, partial shipment flag, batch number matching, HTS codes
- Folder structure: `Company/Year/Month/OrderFolder`

### What's missing:

| Gap | Detail |
|-----|--------|
| No shipment records | No formal "shipment" entity in the database |
| No inventory deduction on ship | Documents generated but stock not reduced |
| No carrier tracking | No tracking numbers, no carrier API integration |
| No ship-against-SO | No linking shipments to SO lines with quantities |
| No partial shipment tracking | Flag exists but no quantity tracking per shipment |
| No receiving workflow | PO receive exists but no inspection/staging |

---

## 13. NOTIFICATIONS & ALERTS (Currently: In-app toasts only)

### What exists:
- Toast notifications (success, error, warning, info)
- Sync banner when new SOs available
- Low stock items identified and displayed on dashboard
- Stock conflict alerts in StockAllocationTracker

### What's missing:

| Gap | Detail |
|-----|--------|
| No email alerts | No automated email for low stock, overdue POs, etc. |
| No configurable alert rules | No user-defined thresholds |
| No notification center | No persistent notification list |
| No escalation | No auto-escalation when alerts are ignored |

---

## 14. FRONTEND (Currently: Solid)

### What exists:
- React 18 + TypeScript + Vite + Tailwind CSS + Lucide icons
- Responsive breakpoints (sm, md, lg, xl)
- Mobile meta tags (`apple-mobile-web-app-capable`)
- Clean component architecture

### What's missing:

| Gap | Detail |
|-----|--------|
| No PWA | No service worker, no offline mode |
| No component library | Custom components only (no Shadcn, etc.) |
| No form validation library | No Zod/Yup schema validation |

---

## 15. SAGE 50 ACCOUNTING INTEGRATION (🟢 LIVE — March 2026)

This is a **new capability** not part of the original MISys system. The portal now connects directly to the live Sage 50 Quantum Accounting 2026 database for Canoil Canada Ltd.

### Connection:
- **Database:** MySQL on `192.168.1.11:13540`, database `simply`
- **Access:** Strictly **READ-ONLY** (3 independent safety layers)
- **Dependency:** `PyMySQL >= 1.1.0` (pure Python, no ODBC required)

### Data available from Sage:

| Data | Records | Endpoint |
|------|--------:|----------|
| Customers | 353 | `GET /api/sage/customers` |
| Vendors | 478 | `GET /api/sage/vendors` |
| Inventory / Products | 616 | `GET /api/sage/inventory` |
| Chart of Accounts | 278 | `GET /api/sage/accounts` |
| Sales Orders | 4,734 | `GET /api/sage/sales-orders` |
| Sales Order Lines | 12,737 | (included in order detail) |
| Receipts / Payments | 5,433 | `GET /api/sage/receipts` |
| Dashboard summary | — | `GET /api/sage/dashboard` |

### Write protection (3 layers):
1. **MySQL session:** `SET SESSION TRANSACTION READ ONLY` on every connection
2. **Python SQL guard:** `ReadOnlyCursor` blocks all non-SELECT statements
3. **No commit path:** `autocommit=False`, `commit()` never called

### Files:
| File | Purpose |
|------|---------|
| `backend/sage_service.py` | Connection handling, read-only guards, all query functions |
| `backend/app.py` | Flask endpoints under `/api/sage/*` (lines 7676–7862) |
| `backend/.env` | Credentials (`SAGE_DB_HOST`, `SAGE_DB_PORT`, `SAGE_DB_USER`, `SAGE_DB_PASSWORD`, `SAGE_DB_NAME`) |
| `backend/requirements.txt` | `PyMySQL>=1.1.0` |
| `Markdown File Types/SAGE_50_INTEGRATION.md` | Full technical documentation |

### Gaps Sage fills (read-only):

| Gap Area | What Sage Provides | Remaining Gap |
|----------|-------------------|---------------|
| Customer Master | 353 customers with contacts, addresses, credit limits, YTD | No CRUD — create/edit must still go through Sage 50 directly |
| Supplier/Vendor | 478 vendors with contacts, addresses, YTD | No CRUD — same as above |
| Sales Orders | 4,734 orders with line items, customer joins | No create/edit from portal |
| Inventory | 616 items with stock levels, costs, pricing | No adjustments from portal |
| Chart of Accounts | 278 accounts with balances | Read-only view |
| Receipts/Payments | 5,433 transaction records | Read-only view |
| Dashboard | Top customers, 30-day and yearly order summaries | Display only |

---

## 16. SAGE 50 → PORTAL INTEGRATION STRATEGY (How to use Sage like MISys)

MISys provided manufacturing data (MOs, BOMs, inventory, suppliers). Sage 50 provides accounting data (customers, sales orders, GL, receipts/payments). The goal is to weave Sage data into the existing portal sections so it feels like one system, not two disconnected data sources.

### The bridge: Matching keys between MISys and Sage

| MISys Field | Sage 50 Field | Table | Link Purpose |
|-------------|--------------|-------|-------------|
| `Customer` (on MO) | `sName` | `tcustomr` | MO → Sage customer → credit, terms, YTD |
| `custId` (on MO/Job) | `lId` | `tcustomr` | Direct ID match (if IDs align) |
| SO number (parsed PDFs) | `sSONum` | `tsalordr` | SO PDF → Sage order → line items, totals |
| Item No. (MISys) | `sPartCode` | `tinvent` | MISys item → Sage stock levels, costs, pricing |
| Supplier No. (MISys) | Vendor `sName`/`lId` | `tvendor` | MISys supplier → Sage vendor → AP, YTD |

**First step before anything else:** Run a matching analysis to confirm which keys align between the two systems and which need a manual mapping table.

---

### 16.1 Manufacturing Orders (MOs) + Sage

Currently MOs show customer name, items, quantities, and status. Sage can enrich every MO with:

| Enhancement | Sage Source | How |
|-------------|-----------|-----|
| **Customer financial profile on MO** | `tcustomr` → credit limit, YTD sales, payment terms (`nNetDay`) | Match MO customer name → Sage customer; show credit/terms alongside MO |
| **Material cost from Sage** | `tinvent` / `tinvbyln` → `dLastCost`, `dCostOfStock` | Match MO BOM items by part code → pull live Sage costs → show actual cost per MO |
| **MO profitability** | Sage SO total vs. MO material costs | SO order value (from `tsalordr.dTotal`) minus MO material costs = estimated margin |
| **Customer order history on MO** | `tsalordr` WHERE `lCusId` matches | Show "this customer has X orders worth $Y this year" on MO detail |

**Implementation:** New backend endpoint `GET /api/mo/:mo_no/sage-enrichment` that takes the MO's customer and items, queries Sage, and returns the enrichment data. Frontend adds a "Sage Accounting" tab/panel on MO detail view.

---

### 16.2 Reports + Sage

Current reports use only MISys/G Drive data. Sage unlocks financial reporting:

| Report | What Sage Adds | Sage Tables |
|--------|---------------|-------------|
| **Monthly Sales Report** | Actual sales order totals, top customers by revenue, order count trends | `tsalordr`, `tcustomr` |
| **Cost Analysis Report** | Live inventory costs, cost-of-stock totals, last-cost vs standard-cost variance | `tinvent`, `tinvbyln`, `tinvprc` |
| **Customer Revenue Report** | YTD revenue per customer, credit utilization, payment behavior | `tcustomr` (dAmtYtd, dCrLimit), `trcpthdr` |
| **Vendor Spend Report** | YTD spend per vendor, payment history | `tvendor` (dAmtYtd), `trcpthdr` |
| **AR Aging** | Outstanding receipts by date range | `trcpthdr` filtered by date |
| **GL Summary** | Account balances, YTD vs prior year | `taccount` (dYts, dYtc, dYtsLY, dYtcLY) |
| **Inventory Valuation** | Total stock value (qty × cost) across all items | `tinvbyln` (dInStock × dCostStk) |

**Implementation:** New `sage_reports.py` service with functions like `get_monthly_sales_summary(year, month)`, `get_customer_revenue_report()`, `get_inventory_valuation()`. Wire into the existing Report Maker section or a new "Financial Reports" section.

---

### 16.3 Month-End + Sage

Month-end is where Sage data matters most. The portal can generate a month-end package pulling from both systems:

| Month-End Item | MISys Data | Sage Data | Combined View |
|----------------|-----------|-----------|--------------|
| **Production Summary** | MO count, completed MOs, output quantities | — | "We made X units across Y MOs" |
| **Revenue Summary** | — | SO totals for the month (`tsalordr` by `dtSODate`) | "We booked $X in sales orders" |
| **Material Cost Summary** | BOM quantities consumed | Sage inventory costs (`dLastCost`) | "Materials consumed cost $X" |
| **Gross Margin** | MO output | SO revenue minus material costs | "Estimated gross margin: X%" |
| **Inventory Position** | MISys on-hand, on-order | Sage stock levels, cost of stock | Reconciliation: do they match? |
| **AR Position** | — | Receipts/payments for the month | "Collected $X, outstanding $Y" |
| **AP Position** | POs received this month | Sage vendor payments | "Received $X in goods, paid $Y" |
| **GL Snapshot** | — | Account balances as of month-end | Key accounts: cash, AR, AP, revenue, COGS |
| **Top 10 Customers** | — | Sage dashboard top customers | Revenue concentration |
| **Open Orders Carried Forward** | Open MOs, open POs | Open SOs in Sage (unfilled) | Backlog entering next month |

**Implementation:** New endpoint `GET /api/reports/month-end?year=2026&month=2` that queries both MISys data (from G Drive/portal_store) and Sage data, merges them into a single month-end package. Frontend renders it as a printable/exportable month-end report.

---

### 16.4 Integration sequence (what to build and in what order)

| Step | What | Why First |
|------|------|-----------|
| **1. Key matching analysis** | Script that compares MISys customer names ↔ Sage customer names, MISys item numbers ↔ Sage part codes | Can't link anything until we know which keys match |
| **2. Sage enrichment on MO detail** | Show Sage customer info + item costs alongside existing MO data | Immediate value — every MO gets financial context |
| **3. Inventory reconciliation view** | Side-by-side: MISys on-hand vs Sage stock levels for each item | Reveals data discrepancies between the two systems |
| **4. Monthly financial reports** | Sales summary, customer revenue, vendor spend, GL snapshot from Sage | Month-end reporting becomes possible |
| **5. Full month-end package** | Combined MISys + Sage month-end report | Replaces manual month-end spreadsheets |
| **6. Sage browser in portal** | Dedicated UI sections for browsing Sage customers, vendors, inventory, orders, accounts | Full visibility into accounting data without opening Sage 50 |

---

## Priority Implementation Roadmap

Based on impact and dependency order:

### Phase 1: Foundation (Makes it a real system)

| Item | Detail |
|------|--------|
| **PostgreSQL runtime connection** | Wire `app.py` to Postgres, migrate `portal_store` mutations to DB |
| **Authentication & RBAC** | Login page, JWT tokens, role-based permissions |
| **Audit trail** | Every mutation gets who/what/when/before/after |
| **Sage key matching** | Script to map MISys customers/items to Sage customers/part codes |

### Phase 2: Core ERP Completion (MISys parity + Sage enrichment)

| Item | Detail |
|------|--------|
| **Sales Order CRUD** | Create, edit, status workflow (wire existing frontend form) |
| **Customer Master** | CRUD with contacts, addresses, terms — Sage 50 provides read baseline |
| **Sage enrichment on MOs** | Customer financials + material costs from Sage on every MO |
| **Inventory reconciliation** | MISys vs Sage side-by-side stock comparison |
| **Full MRP Engine** | Time-phased, lead times, safety stock, lot sizing |
| **Shipment transactions** | Ship against SO, deduct inventory, track shipments |

### Phase 3: Business Process + Financial Reporting

| Item | Detail |
|------|--------|
| **Monthly financial reports** | Sales, customer revenue, vendor spend, GL from Sage |
| **Month-end package** | Combined MISys + Sage report (production + financials) |
| **Approval Workflows** | Configurable chains for PO, MO, PR |
| **BOM Cost Rollup** | Multi-level cost calculation using Sage costs |
| **Notifications & Alerts** | Email alerts, configurable rules |
| **QC / Inspection** | Receive inspection, hold/release, COA tracking |

### Phase 4: Full ERP + Sage Browser

| Item | Detail |
|------|--------|
| **Sage browser UI** | Portal sections for browsing Sage customers, vendors, inventory, accounts, orders |
| **Real Invoicing** | Generate invoices from shipped SOs |
| **AP/AR views** | Payment tracking, aging reports from Sage receipt data |
| **Costing & Margin** | COGS, variance analysis, margin per order using Sage costs |

---

*Last updated: March 1, 2026*
