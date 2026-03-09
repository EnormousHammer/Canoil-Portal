# Create MO: Lot/Serial Selection + Sage SO Linking – Implementation Plan

**Purpose:** Make Create MO use **existing** lot numbers and serial numbers (select from list, not free text), and properly link to Sage Sales Orders for invoicing.  
**Date:** March 2026

---

## 1. User Requirements (Summary)

| Requirement | Current State | Target State |
|-------------|---------------|--------------|
| **Lot Number** | Free-text input | **Dropdown/list of existing lots** for the build item |
| **Serial Number** | Not in Create MO | **Dropdown/list of existing serials** for the build item |
| **Source of lots/serials** | N/A | Created when receiving product (PO receive) or creating own (portal/MISys) |
| **Sales Order linking** | Optional free-text SO # | **Select from Sage SOs** – link SO first so items can be linked; accountants can invoice |
| **Data source** | Parsed PDFs, MISys headers | **Sage G Drive** (tsalordr, tsoline) + **MISys Full Company Data** (lots/serials) |

---

## 2. Existing Codebase – What We Have

### 2.1 Sage Connections (Already Working)

| Source | Service | API | Data |
|--------|---------|-----|------|
| **Sage 50 Live DB** | `sage_service.py` | `GET /api/sage/sales-orders`, `GET /api/sage/sales-orders/:id` | tsalordr, tsoline (order + lines) |
| **Sage G Drive CSV** | `sage_gdrive_service.py` | `GET /api/sage/gdrive/sales-orders` | tsalordr, tsoline (headers only in current `get_sales_orders`) |

**Sage G Drive tables loaded:** `tcustomr`, `tvendor`, `tinvent`, `tinvbyln`, `tinvext`, `tinvprc`, `tinvinfo`, `tsalordr`, `tsoline`, `titrec`, `titrline`, `tprclist`, `tcustr`.

**Item mapping:** Sage `tinvent.sPartCode` = MISys `Item No.` (used in `get_item_by_part_code`, `get_item_pricing`).

**Gap:** `sage_gdrive_service.get_sales_orders()` returns **headers only**. No API returns SO **with line items** from G Drive. `sage_service.get_sales_order(order_id)` returns order + lines from **live DB** only.

### 2.2 Lot/Serial Data (MISys Full Company Data)

| Source | JSON Key | Fields | Purpose |
|--------|----------|--------|---------|
| **MISLBINQ** | `MISLBINQ.json` | `Item No.`, `Location No.`, `Bin No.`, `Lot No.`, `On Hand` | Lot qty by bin |
| **MISLTD** | `LotSerialDetail.json` | `Lot No.`, `Serial No.`, `Parent Item No.`, `Item No.`, `Expiration Date`, `Quantity` | Lot/serial detail |
| **MISLHIST** | `MISLHIST.json` | `Lot No.`, `Parent Item No.`, `Transaction Date`, `User`, `Quantity` | Lot history |

**Existing view builder:** `itemLotSummaryViewBuilder.ts` – `buildItemLotSummaryView(data, itemNo)` returns:
- `lots`: `{ lotNo, onHandByLocBin, totalQty, lastMoveDate, expiry, serialCount }[]`
- `serialRows`: `{ lotNo, serialNo, qty, description, status, expiry }[]`

**Lots/serials are created when:**
- Receiving product (PO receive → lot assigned)
- Creating own (portal adjustments, MO completion with lot)

### 2.3 Create MO Modal (Current)

- **File:** `frontend/src/components/CreateMOModal.tsx`
- **SO source:** `ParsedSalesOrders.json`, `SalesOrderHeaders.json`, `SalesOrderDetails.json` (parsed PDFs + MISys export) – **not Sage**
- **Lot/Batch:** Free-text inputs; auto-filled from SO `batch_number` or recent MO `Batch No.`
- **No serial number field**

### 2.4 Create MO Backend

- **Endpoint:** `POST /api/manufacturing-orders`
- **Accepts:** `build_item_no`, `quantity`, `due_date`, `batch_number`, `lot_number`, `expiry_date`, `sales_order_no`, `description`
- **Stores:** `Batch No.`, `Lot No.`, `Expiry Date`, `Sales Order No.` on MO record (portal_store)

---

## 3. Implementation Plan

### Phase A: Lot/Serial Selection in Create MO (No Free Text)

**Goal:** Replace free-text Lot/Batch/Serial with **dropdowns of existing lots and serials** for the selected build item.

#### A1. Backend: Expose Lots/Serials for Item (Optional – can do frontend-only)

**Option A (recommended):** Use existing `data` in CreateMOModal – it already has `MISLBINQ.json`, `LotSerialDetail.json`, `MISLHIST.json` from Full Company Data. No new API needed.

**Option B:** Add `GET /api/items/:itemNo/lots` and `GET /api/items/:itemNo/serials` if we want server-side filtering. Not required if `data` is passed to CreateMOModal.

#### A2. Frontend: Reuse `buildItemLotSummaryView`

- When user selects **Build Item**, call `buildItemLotSummaryView(data, form.build_item_no)`.
- Extract `lots` and `serialRows` for that item.

#### A3. Create MO Modal – Replace Inputs with Selects

| Field | Before | After |
|-------|--------|-------|
| Batch Number | Free text | **Dropdown** – list existing lots for build item (or "Create new" if allowed later) |
| Lot Number | Free text | **Dropdown** – same as batch; lots from MISLBINQ + LotSerialDetail + MISLHIST |
| Serial Number | (none) | **Dropdown** – list existing serials for build item from LotSerialDetail |
| Expiry Date | Free date | **Auto-filled** when lot selected (from LotSerialDetail) or manual override |

**UX:**
- Build Item selected first → Lot/Serial dropdowns populate.
- If no lots exist for item: show message "No lots on hand for this item. Create lot when receiving or completing MO."
- Allow "—" or empty = no lot/serial (for items not lot-tracked).
- Serial optional (many items are lot-only, not serialized).

#### A4. Validation

- If item is lot-tracked (has lots in system), require lot selection (or explicit "Create new" flow – Phase B).
- Serial: optional unless business rule requires it.

---

### Phase B: Sage Sales Order Linking (SO-First Flow)

**Goal:** Create MO from Sage SO – select SO first, then SO lines drive build item; link MO to SO for invoicing.

#### B1. Backend: Sage G Drive – SO with Lines

**Add to `sage_gdrive_service.py`:**

```python
def get_sales_order_with_lines(so_number: str = None, so_id: int = None) -> dict:
    """Return single SO header + lines. Match by sSONum or lId."""
    tables = _tables()
    so_df = tables.get("tsalordr")
    lines_df = tables.get("tsoline")
    inv_df = tables.get("tinvent")
    cust_df = tables.get("tcustomr")
    # ... filter SO, join lines (lSOId), join tinvent for sPartCode (MISys Item No.)
    # Return: { order: {...}, lines: [{ lInventId, sPartCode, nLineNum, dQty, sName, ... }] }
```

**Add API:** `GET /api/sage/gdrive/sales-orders/:so_number` or `?so_number=2707` – returns SO + lines with `sPartCode` (MISys item mapping).

#### B2. Backend: Sage Live DB (Alternative)

`sage_service.get_sales_order(order_id)` already returns order + lines. Use when Sage 50 live connection is available. Map `lInventId` → `sPartCode` via tinvent join (already in sage_service for item name).

#### B3. Create MO Modal – "Create from Sage SO"

**New quick-start option:** "From Sage Sales Order"

- Fetch Sage SOs: `GET /api/sage/gdrive/sales-orders` (or live `/api/sage/sales-orders` when available).
- User picks SO (e.g. SO 2707).
- Modal fetches `GET /api/sage/gdrive/sales-orders?so_number=2707` (or equivalent) → gets lines.
- Lines show: Item (sPartCode), Qty, Description. User picks line(s) or first line auto-fills.
- Build Item = selected line's item (sPartCode = MISys Item No.).
- Quantity = line qty.
- Sales Order # = SO number (auto-filled, read-only).
- Customer, Ship Date from SO header.

**Item mapping:** Sage `sPartCode` matches MISys `Item No.` (used in MO Sage tab, pricing).

#### B4. Store SO Link on MO

- Backend already stores `Sales Order No.` on MO.
- **Optional:** Add `Sales Order Detail No.` (line number) for SO line linkage – future Phase for invoicing line-level matching.

---

### Phase C: Data Flow Summary

```
Create MO Modal
├── Quick start: From Sage SO | From Parsed SO | From Recent MO
├── Build Item (searchable, BOM items)
├── Quantity, Due Date
├── Lot Number (dropdown – existing lots for build item)
├── Serial Number (dropdown – existing serials for build item)
├── Expiry Date (auto from lot or manual)
├── Sales Order # (auto from SO flow, or manual)
└── Description
```

**Data sources:**
- Lots/Serials: `data` (MISLBINQ, LotSerialDetail, MISLHIST) – from Full Company Data.
- Sage SOs: `GET /api/sage/gdrive/sales-orders` + new `get_sales_order_with_lines(so_number)`.
- Parsed SOs: Same as today (ParsedSalesOrders, SalesOrderHeaders/Details).

---

## 4. File Changes

| File | Change |
|------|--------|
| `frontend/src/components/CreateMOModal.tsx` | Replace batch/lot/serial inputs with dropdowns; add lot/serial from `buildItemLotSummaryView`; add "From Sage SO" quick start; fetch Sage SOs + SO with lines |
| `frontend/src/views/itemLotSummaryViewBuilder.ts` | Export helper or reuse `buildItemLotSummaryView` – no change if already exported |
| `backend/sage_gdrive_service.py` | Add `get_sales_order_with_lines(so_number)` |
| `backend/app.py` | Add `GET /api/sage/gdrive/sales-orders/<so_number>` or `?so_number=` query param |
| `docs/CREATE_MO_LOT_SERIAL_SAGE_SO_PLAN.md` | This plan |

---

## 5. Implementation Order

1. **Phase A – Lot/Serial dropdowns** (no new API)
   - In CreateMOModal, when `build_item_no` is set, call `buildItemLotSummaryView(data, build_item_no)`.
   - Replace Batch/Lot inputs with dropdown (select from `lots`).
   - Add Serial dropdown (select from `serialRows`).
   - Auto-fill Expiry when lot selected.
   - Show message when no lots: "No lots on hand. Create when receiving or completing MO."

2. **Phase B – Sage SO with lines**
   - Add `get_sales_order_with_lines()` to sage_gdrive_service.
   - Add API route.
   - In CreateMOModal, add "From Sage SO" – fetch SO list, pick SO, fetch SO with lines, auto-fill.
   - Ensure SO # is stored on MO.

3. **Phase C – Polish**
   - Handle "Create new lot" flow if needed (Phase 2 – separate story).
   - Add Serial Number to backend if not already stored.

---

## 6. Edge Cases

| Case | Handling |
|------|----------|
| Build item has no lots | Show message; allow "—" (no lot) or block create until lot exists |
| Build item has no serials | Serial dropdown empty; optional field |
| Sage G Drive not loaded | Show "Sage SOs unavailable" – fall back to Parsed SO only |
| Sage live DB available | Prefer live `get_sales_order` for SO with lines |
| SO line item not in MISys | Show warning; allow create with manual item entry |
| Item is lot-tracked but user skips lot | Validation: require lot for lot-tracked items |

---

## 7. Success Criteria

- [ ] Lot Number dropdown lists **existing lots** for the build item (no free text).
- [ ] Serial Number dropdown lists **existing serials** for the build item.
- [ ] Expiry date auto-fills when lot selected.
- [ ] "From Sage SO" quick start populates Build Item, Qty, SO # from Sage.
- [ ] MO stores Sales Order No. for accountant invoicing.
- [ ] No mock data; all from backend/G Drive.
- [ ] Graceful handling when no lots/serials or Sage unavailable.

---

## 8. Out of Scope (Future)

- "Create new lot" from Create MO (user creates lot elsewhere first).
- Sales Order Detail No. (line-level) for precise invoicing.
- Transfer to Sales (Tier 5).

---

*Last updated: March 2026*
