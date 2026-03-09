# MISys Production Workflow – MO Page Integration Plan

**Purpose:** Integrate the MISys Manufacturing Production workflow diagram (Work Order / Mfg. Order) into the Canoil Portal MO page.  
**Date:** March 2026

---

## 1. Current State

### MO Page Today (`activeSection === 'manufacturing-orders'`)

| Component | Location | Purpose |
|-----------|----------|---------|
| Header | `RevolutionaryCanoilHub.tsx` ~2637 | Dark premium header, KPIs (Total, In Production, Awaiting Release, Completed, Past Due) |
| Filters | ~2770 | Search, Status, Customer, Sort, Create MO |
| MO Table | ~2760 | List of manufacturing orders with drill-down |
| MO Detail Modal | ~3200+ | Release, Issue, Complete actions; Related Orders; Components tab |

**Data source:** `ManufacturingOrderHeaders.json`, `ManufacturingOrderDetails.json` (from backend / G Drive).

**Existing actions:**
- Release (Status 0 → 1)
- Issue materials (Status 1 → 2)
- Complete (with qty + lot)

---

## 2. Target: MISys Workflow (from reference images)

### Work Order (Standard BOMs)

```
Entry Points (left):
  • Create Order
  • Process Sales Orders
  • Create Production Orders from MRP

Flow:
  Create Order → Release Order → Print Order → Print Pick List ─┬→ Process Order → Transfer To Sales → Close Order
                                                               └→ Process Shop Op ─┘
  Process Sales Orders ──────────────────────────────────────→ Print Order
  Create Production Orders from MRP ──────────────────────────→ Print Order
```

### Mfg. Order (Build to Order)

```
Entry Points:
  • Create Order
  • Process Sales Orders
  • Create Production Orders from MRP

Flow:
  Create Order → Release Order → Print Order → Substitute Alternates ─┬→ Print Pick List ─┬→ Process Order → Transfer To Sales ─┬→ Close Order
                                                                     └→ Print Traveler ─┘                    └→ Process Shop Op ─┘
  Process Sales Orders ───────────────────────────────────────────→ Print Order
  Create Production Orders from MRP ───────────────────────────────→ Print Order
```

**No Job Shop tab** – Only Work Order and Mfg. Order (Build to Order).

### Complete Step Checklist (Nothing Hidden)

**Work Order (Standard BOMs) – all steps:**
1. Create Order (entry)
2. Process Sales Orders (entry)
3. Create Production Orders from MRP (entry)
4. Release Order
5. Print Order
6. Print Pick List
7. Process Order
8. Process Shop Op
9. Transfer To Sales
10. Close Order

**Mfg. Order (Build to Order) – all steps:**
1. Create Order (entry)
2. Process Sales Orders (entry)
3. Create Production Orders from MRP (entry)
4. Release Order
5. Print Order
6. Substitute Alternates
7. Print Pick List
8. Print Traveler
9. Process Order
10. Process Shop Op
11. Transfer To Sales
12. Close Order

---

## 3. Integration Plan

### Phase 1: Workflow Diagram via Button (Modal/Overlay)

**Placement:** A **button** on the MO page (e.g. in the header next to Export/Refresh) – **not** on the home/dashboard.

**Behavior:**
- Click button → Opens a **modal/overlay** with the full workflow diagram.
- Diagram is **always fully visible** when modal is open – nothing hidden, no collapsible sections.
- Modal has its own close (X) to return to the MO page.

**Structure:**
1. **Button** – "Production Workflow" or "View MISys Workflow" in the MO page header (next to Export, Refresh).
2. **Modal** – Full-screen or large overlay showing the diagram.
3. **Tabs** – "Work Order (Standard BOMs)", "Mfg. Order (Build to Order)" only (no Job Shop).
4. **Flowchart** – Pure HTML/CSS/SVG (no new libraries). All steps visible, arrows for flow.
5. **Icons** – Use existing `lucide-react` icons (FileText, Printer, CheckCircle, etc.).

**Implementation:**
- State: `showMoWorkflowModal` (boolean), `moWorkflowTab` ('work-order' | 'build-to-order').
- Responsive: horizontal scroll inside modal on small screens.

---

### Phase 2: Wire Steps to Existing Functionality

| Workflow Step | Portal Action | Notes |
|---------------|---------------|-------|
| **Create Order** | Open Create MO modal | `setShowCreateMOModal(true)` |
| **Release Order** | MO detail → Release button | Already exists |
| **Print Order** | (Future) Print MO / Traveler | No backend yet; show placeholder or link to MISys |
| **Print Pick List** | (Future) Print pick list | Same as above |
| **Print Traveler** | (Future) Print traveler | Same as above |
| **Substitute Alternates** | (Future) BOM substitution | Tier 2+ feature |
| **Process Order** | MO detail → Issue / Complete | Already exists |
| **Process Shop Op** | (Future) Shop floor ops | Not in portal yet |
| **Transfer To Sales** | (Future) SO transfer | Tier 5 in MISYS_FEATURE_IMPLEMENTATION_PLAN |
| **Close Order** | MO detail → Complete (full qty) | Implicit via Complete |
| **Process Sales Orders** | Navigate to Production Schedule or SO Entry | `setActiveSection('production-schedule')` or SO Entry |
| **Create Production Orders from MRP** | Navigate to Shortage / MRP | `setActiveSection('inventory')` + Shortage, or future MRP page |

**Clickable nodes:**
- Steps that map to existing actions → trigger that action or navigation (and close modal if appropriate).
- Steps without backend → show tooltip: "Available in MISys desktop" or "Coming soon".

**Nothing hidden:** All workflow steps are visible in the modal. No collapsed sections, no "show more".

---

## 4. File Changes

| File | Change |
|------|--------|
| `frontend/src/components/RevolutionaryCanoilHub.tsx` | Add workflow section, state, and diagram JSX |
| (Optional) `frontend/src/components/MISysProductionWorkflow.tsx` | Extract diagram into a reusable component |

**No changes to:**
- `package.json` (no new dependencies)
- Backend
- Data structures

---

## 5. Workflow Node Design (CSS)

- **Entry point nodes:** Distinct style (e.g., orange/amber border).
- **Process nodes:** Standard violet/slate.
- **Terminal node (Close Order):** Green checkmark style.
- **Arrows:** SVG or CSS `border` + `transform` for simple arrows.
- **Help icons:** `?` tooltip per step (as in MISys) – all steps show help on hover.

---

## 6. Data Alignment

- All MO data continues to come from backend (G Drive).
- Workflow is **reference/guidance only** – no mock data.
- Step labels match MISys terminology for consistency.

---

## 7. Implementation Order

1. Add "Production Workflow" button to MO page header (next to Export, Refresh).
2. Add modal state `showMoWorkflowModal` and modal overlay.
3. Implement Work Order (Standard BOMs) flowchart in modal – all steps visible.
4. Implement Mfg. Order (Build to Order) flowchart in modal – all steps visible (Substitute Alternates, Print Pick List, Print Traveler).
5. Add tabs: Work Order | Mfg. Order (Build to Order) only.
6. Wire Create Order → Create MO modal (close workflow modal first).
7. Wire Process Sales Orders → Production Schedule / SO Entry.
8. Wire Create Production Orders from MRP → Inventory Shortage.
9. Add tooltips for steps without portal actions.

---

## 8. Success Criteria

- Button on MO page opens workflow modal (not on dashboard/home).
- Full diagram visible in modal – nothing hidden.
- Two tabs only: Work Order (Standard BOMs), Mfg. Order (Build to Order).
- Create Order opens Create MO modal.
- Entry points (Process Sales Orders, Create from MRP) navigate to relevant sections.
- No mock data; no new dependencies.
- Existing MO table, filters, and detail modal unchanged.

---

## 9. Out of Scope (for now)

- Print Order / Print Pick List / Print Traveler (MISys desktop only).
- Substitute Alternates (Tier 2+).
- Process Shop Op (shop floor module).
- Transfer To Sales (Tier 5).

---

## 10. Next Step

Confirm this plan. Once approved, implementation will follow Phase 1 → Phase 2 in order.
