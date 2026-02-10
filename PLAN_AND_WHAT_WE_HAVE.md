# Plan & What We Have – Canoil Portal

**Purpose:** Check this before making changes. Work is not only in Production Schedule – the app has multiple areas and existing plans.

---

## Top-level app structure (App.tsx)

| App | Component | Data source |
|-----|-----------|-------------|
| **Canoil Operations** | `RevolutionaryCanoilHub` | `data` from App (GDrive loader + `data['MPS.json']` merged on refresh) |
| **Production Schedule** | `ProductionScheduleMPS` | **Own fetch** via `mpsDataService.fetchMPSData()` (MPS backend: port 5003 / Render) |

- Header tabs switch between these two. Production Schedule does **not** receive the main `data` prop; it calls its own API.

---

## What the Operations Hub contains (RevolutionaryCanoilHub)

- **Dashboard** – cards for Inventory & BOM, Manufacturing Orders, Purchase Orders, Sales Orders, Logistics, AI Command Center, Report Maker, Email, Work Orders, SO Entry, Intelligence, and a **Production Schedule** card (“Open Production Schedule” → sets `activeSection('production-schedule')`).
- **Sections:** `dashboard`, `inventory`, `manufacturing-orders`, `purchase-orders`, `orders`, `logistics`, `ai-command`, `report-maker`, `email-assistant`, `work-orders`, `so-entry`, `intelligence`, `production-schedule` (section set by card; confirm where this section’s content is rendered).
- **Data:** All from App’s `data` (e.g. `CustomAlert5.json`, `ManufacturingOrderHeaders.json`, `BillsOfMaterial.json`, `SalesOrders.json`, etc.).
- **Production Schedule card:** Uses MO counts from `data['ManufacturingOrderHeaders.json']`; button sets `activeSection('production-schedule')`. Full Gantt experience is the **separate app** (ProductionScheduleMPS) via the header “Production Schedule” tab.

---

## Production / schedule–related components

| Component | Used where | Data |
|-----------|------------|------|
| **ProductionScheduleMPS** | App when `activeApp === 'production-schedule'` | `fetchMPSData()` (MPS backend) |
| **ProductionSchedule** | `RevolutionaryCanoilHub_clean.tsx` only | `data` (incl. MPS from `data`) |
| **EnterpriseProductionCalendar** | `RevolutionaryCanoilHub` (imported) | Passed from Hub (likely `data`) |
| **InteractiveProductionSchedule** | Grep: not in App/Hub render | – |
| **TimelineProductionSchedule** | Grep: not in App/Hub render | – |
| **SimpleProductionCalendar** | Grep: not in App/Hub render | – |
| **VisualProductionDashboard** | Grep: not in App/Hub render | – |

So the **live** production schedule UX is: header tab → **ProductionScheduleMPS** (own API). The Hub shows MO stats and a card that switches section to `production-schedule`; the full timeline is the separate app.

---

## Existing plan docs (read these first)

1. **SEAMLESS_INTEGRATION_PLAN.md** (Markdown File Types)  
   - Data validation, safe access to MO/PO/BOM, error boundaries.  
   - Backend returns many files (e.g. ManufacturingOrderHeaders, PurchaseOrders); frontend should validate and use safe access, not assume “empty”.

2. **FRONTEND_DATA_FLOW_ANALYSIS.md** (Markdown File Types)  
   - “Current system works – don’t break it.”  
   - Use **minimal, surgical** changes; understand data flow (App → GDrive loader → `data` → components).  
   - No big rewrites; fix real issues (e.g. runtime validation, user feedback when data missing).

3. **ENTERPRISE_BOM_MASTER_PLAN.md** (Markdown File Types)  
   - BOM planning, SO linkage, “disconnected from SO” issues, AI assistant, phases.  
   - Affects BOM Planning in the Hub, not only Production Schedule.

4. **SO_BOM_VERIFICATION_PLAN.md** (Markdown File Types)  
   - SO/BOM verification, material availability before committing to customers.

5. **DIRECTORY_STRUCTURE_EXPLANATION.md** (root)  
   - Real project is under `canoil-portal/` (backend + frontend). Parent folder is container/docs.

---

## Data flow summary

- **Operations:** App loads via `GDriveDataLoader.loadAllData()` → `data` (34+ files) → RevolutionaryCanoilHub and its sections. MPS is also merged into `data['MPS.json']` on load/refresh for the Hub.
- **Production Schedule (full app):** ProductionScheduleMPS uses **only** `mpsDataService.fetchMPSData()` (MPS backend URL from env or default). It does **not** use App’s `data` prop.

So improvements to “production” can touch:

- **ProductionScheduleMPS** (filters, KPIs, Gantt, etc.).
- **RevolutionaryCanoilHub** (dashboard Production Schedule card, MO stats, any embedded calendar/schedule).
- **BOM Planning** in the Hub (ENTERPRISE_BOM_MASTER_PLAN, SO_BOM_VERIFICATION_PLAN).
- **Data validation / safe access** (SEAMLESS_INTEGRATION_PLAN, FRONTEND_DATA_FLOW_ANALYSIS) across components that use `data`.

---

## Rule of thumb

- **Before changing only Production Schedule:** Read the plan docs above and this file. Decide whether the change belongs in ProductionScheduleMPS, the Hub (dashboard/sections/BOM), or both, and whether it should use App’s `data` or the MPS API.
- **Stability:** Per FRONTEND_DATA_FLOW_ANALYSIS and project rules – minimal changes, understand the flow, don’t break what works.

---

*Last updated: Feb 2026*
