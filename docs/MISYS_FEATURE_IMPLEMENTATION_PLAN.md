# MiSys Feature Implementation Plan – Full Parity

**Purpose:** Implement ALL MiSys Manufacturing features in the Canoil Portal, in working order.  
**Date:** March 2026

---

## Implementation Order (Dependencies)

Features are ordered so each builds on the previous. Backend must be implemented before frontend.

---

## TIER 1: Foundation (Already Working)

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 1.1 | **Adjust Stock** (add/remove) | `POST /api/inventory/adjustment` | InventoryActionsModal → Adjust tab | ✅ Done |
| 1.2 | **Move Stock** (transfer between locations) | `POST /api/inventory/transfer` | InventoryActionsModal → Transfer tab | ✅ Done |
| 1.3 | **Reorder Settings** (min/max/reorder) | `PATCH /api/items/:id/reorder` | InventoryActionsModal → Reorder tab | ✅ Done |
| 1.4 | **Receive against PO** | `POST /api/purchase-orders/:po/receive` | PO detail → Receive | ✅ Done |
| 1.5 | **Shortage (MRP)** | `GET /api/shortage` | Inventory → Shortage button | ✅ Done |
| 1.6 | **Auto-create PO from shortage** | `POST /api/mrp/auto-create-po` | Inventory → Auto-create PO | ✅ Done |
| 1.7 | **BOM Planning & Explosion** | BOM view from data | Inventory → BOM tab | ✅ Done |
| 1.8 | **Lot History** | `GET /api/lot-history`, `GET /api/inventory/by-lot` | Inventory → Lot history | ✅ Done |
| 1.9 | **Inventory Log** (transaction search) | portalEvents + LotSerialHistory | Inventory → Inventory Log | ✅ Done |
| 1.10 | **Add to PR Cart** | PR generation service | BOM cart, Quick Add | ✅ Done |

---

## TIER 2: Reserve & Allocation (Stock Control)

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 2.1 | **Reserve Stock** | Add `portal_store.reserve_transactions`, `add_reserve()`, `add_relieve_reserve()` | New tab in InventoryActionsModal: Reserve/Relieve | 🔲 To build |
| 2.2 | **Relieve Reserve** | Same as 2.1 | Same | 🔲 To build |
| 2.3 | **Allocate Stock** | Add `portal_store.allocations`, `add_allocation()`, `add_deallocation()` | New tab: Allocate/Deallocate | 🔲 To build |
| 2.4 | **Deallocate Stock** | Same as 2.3 | Same | 🔲 To build |

**Data model (portal_store):**
- `reserve_transactions`: `[{ item_no, location, qty, type: 'reserve'|'relieve', ref?, at }]`
- `allocations`: `[{ item_no, location, qty, ref (MO/SO/Job), type: 'allocate'|'deallocate', at }]`

**apply_to_data:** Reduce available = onHand - reserve - allocated. Reserve/allocated come from portal_store overlays.

---

## TIER 3: Scrap & Dispense (Item Transfers)

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 3.1 | **Scrap Stock** | Add `portal_store.scrap_transactions`, `add_scrap()`, `add_recover()` | New tab: Scrap/Recover | 🔲 To build |
| 3.2 | **Recover Stock** (unscrap) | Same as 3.1 | Same | 🔲 To build |
| 3.3 | **Dispense Stock** | Can map to Adjust (negative) + reason "Dispense" OR dedicated endpoint | New tab or extend Adjust with type | 🔲 To build |
| 3.4 | **Return Stock** (from dispense) | Adjust (positive) + reason "Return" | Same | 🔲 To build |

**Note:** Dispense/Return may be semantic variants of Adjust. Implement as Adjust with reason codes first; add dedicated endpoints if needed.

---

## TIER 4: Assembly Operations

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 4.1 | **Assemble Stock** | Add `portal_store.assembly_transactions`. Consume BOM components (reduce Stock), add finished good (increase Stock). | New modal: Assemble – select parent item, qty, location | 🔲 To build |
| 4.2 | **Disassemble Stock** | Reverse: reduce finished good, add components per BOM | New modal: Disassemble | 🔲 To build |
| 4.3 | **Assemble/Disassemble WIP** | Same logic but apply to WIP instead of Stock | Extend 4.1/4.2 with WIP flag | 🔲 To build |
| 4.4 | **Reserve/Relieve Assembly** | Reserve components for an assembly (before actual build) | Extend Reserve with assembly ref | 🔲 To build |

**Dependencies:** BOM data must exist. `buildBOMView` / explosion logic already in place.

---

## TIER 5: Supplier & Sales Transfers

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 5.1 | **Receive from Supplier** (no PO) | Add `portal_store.supplier_receives` – blind receive | New action: Receive (no PO) | 🔲 To build |
| 5.2 | **Return to Supplier** | Negative receive or dedicated return | New action: Return to Supplier | 🔲 To build |
| 5.3 | **Sales Transfer – Specific Item** | Deduct stock, link to SO line | New action: Ship/Sales transfer | 🔲 To build |
| 5.4 | **Sales Transfer – Assembly Components** | Ship components as kit (BOM explosion) | Extend 5.3 | 🔲 To build |
| 5.5 | **Sales Transfer – Range of Items** | Bulk ship multiple items | Extend 5.3 | 🔲 To build |

---

## TIER 6: Stock Check & Batch

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 6.1 | **Stock Check** | Snapshot current stock by item/location; compare to physical | `GET /api/inventory/stock-check` (snapshot), compare UI | 🔲 To build |
| 6.2 | **Stock Status** | Read-only view of Stock/WIP/Reserve/Allocated by location | Already in Item modal Stock tab; ensure Reserve/Allocated shown | 🔲 Verify/enhance |
| 6.3 | **Batch Check – Edit Batch** | Edit lot/batch attributes | Add batch edit if lot data exists | 🔲 To build |
| 6.4 | **Batch Check – Check Batch** | Validate batch against specs | QC-style check; may need spec data | 🔲 To build |

---

## TIER 7: Planning & MRP (Advanced)

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 7.1 | **Shortages Today** | Already: `GET /api/shortage` | Already | ✅ Done |
| 7.2 | **Future Shortages** | Extend shortage with date horizon; use MRP engine | New view: shortage by week | 🔲 To build |
| 7.3 | **What If Today** | Hypothetical: apply transfers/builds, then run shortage | `POST /api/mrp/what-if` with scenario | 🔲 To build |
| 7.4 | **Future What If** | Same with date range | Extend 7.3 | 🔲 To build |
| 7.5 | **Buyer's Advice** | Manual demand input → feeds MRP | New UI: create buyer's advice | 🔲 To build |
| 7.6 | **Create MRP from Buyer's Advice** | `mrp_engine.run_mrp()` with buyer's advice as demand | Wire to MRP run | 🔲 To build |
| 7.7 | **Create POs from MRP** | Already: `POST /api/mrp/auto-create-po`; extend for planned orders | Wire planned orders → PO | 🔲 To build |
| 7.8 | **Create Work Orders from MRP** | MRP output → create WO records | New: WO creation from MRP | 🔲 To build |

**Note:** `mrp_engine.py` exists with `run_mrp()`. Need to wire `/api/mrp/run`, persist planned orders, and add UI.

---

## TIER 8: MO/WO Completion (Enhancements)

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| 8.1 | **MO Release** | `portal_store.add_mo_update(..., status='Released')` | MO detail → Release button | 🔲 Verify |
| 8.2 | **MO Complete** (with lot) | `add_mo_completion_lot`, `add_mo_event` | MO detail → Complete | 🔲 Verify |
| 8.3 | **WO Release** | `add_wo_update(..., status=...)` | WO detail → Release | 🔲 Verify |
| 8.4 | **WO Complete** (with scrap) | `add_wo_update(..., completed, scrap)` | WO detail → Complete | ✅ Exists |
| 8.5 | **MO Issue Components** | Deduct components when MO starts; add `mo_events` | MO → Issue materials | 🔲 To build |

---

## Implementation Checklist (Per Feature)

For each feature:

1. **Backend**
   - [ ] Add `portal_store` functions (if new data)
   - [ ] Add `apply_to_data` logic to merge portal mutations
   - [ ] Add Flask route(s)
   - [ ] Add to `portalEvents` for Inventory Log (if transaction)

2. **Frontend**
   - [ ] Add UI (modal, tab, or button)
   - [ ] Wire to API
   - [ ] Call `onRefreshData` / refresh on success
   - [ ] Show in Inventory Log if applicable

3. **Test**
   - [ ] Manual test: perform action, refresh, verify data
   - [ ] Verify no mock data (per project rules)

---

## File Reference

| Component | Path |
|-----------|------|
| Portal store | `backend/portal_store.py` |
| Flask routes | `backend/app.py` |
| Inventory actions modal | `frontend/src/components/InventoryActionsModal.tsx` |
| Inventory section | `frontend/src/components/RevolutionaryCanoilHub.tsx` (activeSection === 'inventory') |
| MRP engine | `backend/mrp_engine.py` |
| Data indexes | `frontend/src/data/indexes.ts` |
| Item view | `frontend/src/views/itemViewBuilder.ts` |

---

## Next Steps

1. **Start with Tier 2** (Reserve/Relieve, Allocate/Deallocate) – extends stock control without changing core flows.
2. **Then Tier 3** (Scrap/Recover) – simple delta-style transactions.
3. **Then Tier 4** (Assemble/Disassemble) – requires BOM explosion; higher impact.
4. Proceed through Tiers 5–8 in order.

---

*Last updated: March 2026*
