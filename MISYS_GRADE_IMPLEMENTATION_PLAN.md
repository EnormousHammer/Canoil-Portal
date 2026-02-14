# MISys-Grade Implementation Plan

**Goal:** Achieve MISys-grade parity (1–5), then move to "better than MISys."

**Data rule:** All data from backend/G Drive. No mock data. Respect existing structures.

---

## Current State (as of this plan)

| # | Area | Status | Notes |
|---|------|--------|------|
| 1 | PO Receiving + Landed Cost | ✅ Done | Receiving tab, lot/location, open qty, landed allocation |
| 2 | Inventory Ledger | ✅ Done | Global ledger, MO/PO drill-ins |
| 3 | Lot/Serial Trace | ⚠️ Partial | Lot history exists; forward/backward needs consumption |
| 4 | Sales Order structure | ❌ Not built | Structured SO lines, allocation, pegging |
| 5 | Inventory Valuation | ⚠️ Partial | Cost history exists; FIFO layers, period snapshots missing |

---

## Build Order (Recommended)

### Phase A: Ledger & Drill-Ins (Foundation)

**Goal:** Make every number explainable. Low effort, high payoff.

| Task | Effort | Dependencies | Deliverable |
|------|--------|--------------|-------------|
| A1. Item filter on Inventory Ledger | S | None | Filter ledger by item when clicking from Item modal |
| A2. PO filter on ledger | S | None | Filter ledger by PO when clicking from PO |
| A3. Item → Ledger link | S | A1 | "View in Ledger" button in Item modal |
| A4. PO → Receipts ledger | S | None | Already have Receiving tab; ensure it's the "receipts ledger" |

**Files:** `RevolutionaryCanoilHub.tsx`, `transactionIndexes.ts`, `transactionExplorerBuilder.ts`

---

### Phase B: Lot/Serial Trace (Forward + Backward)

**Goal:** Raw lot → where it went; finished lot → which raw lots consumed.

**Data sources:**
- **MILOGH:** Movement log (item, qty, date, ref, lot)
- **LotSerialHistory / MISLTH:** Lot movements
- **MIMOMD:** MO component lines (consumption by BOM)
- **Portal:** `po_receives`, `mo_completion_lots` (lot, item, qty)

**Consumption events:** When MO completes with backflush, we consume components. We need to record:
- `consumption_events`: `{ moNo, buildItemNo, buildLotNo, componentItemNo, componentLotNo, qty, at }`
- Derive from: MO completion + BOM explosion + lot assignment (or infer from ledger)

| Task | Effort | Dependencies | Deliverable |
|------|--------|--------------|-------------|
| B1. Portal consumption events | M | None | Add `consumption_events` to portal_store; emit on MO complete (backflush) |
| B2. Forward trace: raw lot → MOs/shipments | M | B1, MILOGH | Lot trace page: "Where did this lot go?" (MO completions, shipments) |
| B3. Backward trace: finished lot → raw lots | M | B1, BOM | Lot trace page: "Which raw lots went into this lot?" (BOM + consumption) |
| B4. Lot trace page enhancements | S | B2, B3 | UI: Forward/Backward tabs, clear lineage |

**Data model (consumption):**
```json
{
  "moNo": "MO12345",
  "buildItemNo": "FIN-001",
  "buildLotNo": "L-0001",
  "componentItemNo": "RAW-001",
  "componentLotNo": "L-RAW-01",
  "qty": 10,
  "at": "2026-02-14T15:00:00Z"
}
```

**Files:** `portal_store.py`, `app.py`, `lotTraceViewBuilder.ts`, `RevolutionaryCanoilHub.tsx`

---

### Phase C: Sales Order Structure

**Goal:** Structured SO lines (item, qty, dates), allocation, SO → MO pegging.

**Data sources:**
- **MISys:** SO export (if exists) – check Full Company Data export
- **G Drive:** SalesOrdersByStatus, RealSalesOrders, PDF-derived SOs
- **Current:** SO data is PDF/Drive; no structured lines

**Approach:** Create structure even if source is incomplete. Show "Not in snapshot" when missing.

| Task | Effort | Dependencies | Deliverable |
|------|--------|--------------|-------------|
| C1. SO data model | M | None | `SalesOrderHeaders.json`, `SalesOrderDetails.json` (or equivalent) |
| C2. Converter: SO CSV → JSON | M | C1 | Map MISys SO export (if present) → app structure |
| C3. SO list + detail modal | M | C1 | SO list, SO modal with lines (item, qty, dates) |
| C4. Allocation/reservation | L | C3 | Reserve qty against SO lines (from available stock) |
| C5. SO → MO pegging | L | C3, MO | "Suggested MO" from SO line; link SO line to MO |

**SO structure (target):**
```json
{
  "SalesOrderHeaders": [{ "soNo": "SO1234", "customer": "...", "orderDate": "...", "status": "..." }],
  "SalesOrderDetails": [{ "soNo": "SO1234", "lineNo": 1, "itemNo": "FIN-001", "qty": 100, "requiredDate": "...", "allocatedQty": 0 }]
}
```

**Files:** `full_company_data_converter.py`, `RevolutionaryCanoilHub.tsx`, new `soViewBuilder.ts`

---

### Phase D: Inventory Valuation (FIFO snapshot)

**Goal:** Cost layers, item cost history, period snapshots (month-end).

**Data sources:**
- **MIICST:** Item cost history (already used)
- **MILOGH:** Movements (receipt, issue, adjust) – for cost layer flow
- **Portal:** PO receives (with cost), MO completions

**Approach:** Build cost layers from transactions. FIFO = consume oldest receipt first.

| Task | Effort | Dependencies | Deliverable |
|------|--------|--------------|-------------|
| D1. Cost layer model | M | None | `{ itemNo, location?, lot?, qty, unitCost, date, source }` |
| D2. Build layers from ledger | L | D1, MILOGH, po_receives | Receipts add layers; issues consume FIFO |
| D3. Item cost history (enhance) | S | None | Already have MIICST; add "effective cost" from layers |
| D4. Period snapshot (month-end) | L | D2 | Snapshot: layers at date X; valuation report |
| D5. Valuation report UI | M | D4 | Report: Item, Qty, Unit Cost, Extended; by period |

**Files:** `views/` (new valuation builder), `backend/` (snapshot logic if server-side), `RevolutionaryCanoilHub.tsx`

---

### Phase E: "Better Than MISys"

**After 1–5 are done:**

| Task | Effort | Description |
|------|--------|-------------|
| E1. Smart shortage planning (MRP-lite) | L | Net requirements: demand (SO) − supply (PO, MO) − on hand |
| E2. Auto MO suggestions | M | From SO pegging + shortage; suggest MO for build item |
| E3. G Drive OCR → structured SO/PO | L | Parse PDFs → SO/PO structure; merge with manual |
| E4. Modern UI + fast search | M | Search across items, POs, MOs, SOs; audit dashboards |

---

## Implementation Order (Best ROI)

```
1. Phase A (Ledger drill-ins)     → 1–2 days   → Every number explainable
2. Phase B (Lot trace)            → 3–5 days  → Forward/backward lineage
3. Phase C (SO structure)         → 4–6 days  → Structured demand, pegging
4. Phase D (Valuation)             → 4–6 days  → FIFO, snapshots, reports
5. Phase E (Better than MISys)    → Ongoing    → MRP-lite, auto MO, OCR
```

---

## Data Readiness Checklist

| Data | Source | Status |
|------|--------|--------|
| MILOGH | Full Company Data | ✅ Converted |
| LotSerialHistory | Full Company Data | ✅ Converted |
| MIICST | Full Company Data | ✅ Converted |
| BOM (MIBOMH/D) | Full Company Data | ✅ Converted |
| MO (MIMOH/MIMOMD) | Full Company Data | ✅ Converted |
| PO (MIPOH/MIPOD) | Full Company Data | ✅ Converted |
| Sales Orders | PDF/Drive only | ❌ No structured export |
| Consumption events | Not in MISys export | ❌ Must create in portal |

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| SO data doesn't exist in MISys export | Build structure; use PDF/Drive as source; show "Not in snapshot" |
| Consumption events not in MILOGH | Use portal overlay (MO complete backflush); infer from BOM + lot |
| FIFO requires full receipt history | Use MILOGH + po_receives; build layers incrementally |
| Lot assignment on MO complete | Optional; can trace without lot-level consumption initially |

---

## Next Step

**Recommend:** Start with **Phase A** (Ledger drill-ins). It's fast, uses existing data, and makes the ledger the "truth engine" for Item, MO, and PO.

Then **Phase B** (Lot trace) for traceability.

Then **Phase C** (SO structure) for demand visibility and pegging.
