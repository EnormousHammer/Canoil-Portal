# MISys CSV Pages & Drilldown Specification

**Core principle:** Every screen is a filtered view of one or more MISys CSV tables. Every drilldown uses a real key from the CSV and opens a page powered by real rows from another CSV. Never fabricate or summarize data unless explicitly computed.

---

## 1. Item Page (entry point)

**When user clicks an item (`itemId`):**

| Source | Purpose |
|--------|--------|
| **MIITEM.CSV** | Base master record |
| **MIITEMX.CSV** | Notes/docs |
| **MIITEMA.CSV** | Alternates |

**Key:** `itemId` (exists in nearly every table)

---

## 2. Stock Tab (where quantities come from)

**Location-level quantities:** **MIILOCQT.CSV** — Key: `itemId` — Shows qty by `locId`

**Bin-level quantities:** **MIBINQ.CSV** — Key: `itemId` — Fields: `locId`, `binId`, `qty`

**Lot-level quantities:** **MISLBINQ.CSV** — Key: `prntItemId` — Fields: `lotId` + bin + qty

**Drilldowns:**

| Click | Action |
|-------|--------|
| `locId` | Filter MIILOCQT by that `locId` |
| `binId` | Filter MIBINQ by that bin |
| `lotId` | Open **Lot Page** |

---

## 3. Lot Page (critical)

**When clicking a lot number:**

**Lot identity:** MISLHIST.CSV (lot master), MISLNH.CSV (lot header definition)

**Lot movements:** MISLTH.CSV (lot transaction header), MISLTD.CSV (lot transaction detail)

**Join rule:** Match on `tranDate` + `userId` + `entry` + `detail`

**Show:** Lot ID, Parent item (`prntItemId`), First movement date (creation), First `userId` (who created), All movement rows sorted descending, Current qty from MISLBINQ

**Drilldowns:** If lot row has MO reference → MO page; PO reference → PO page

---

## 4. Stock Movement Tab

**Not lot-based — inventory-log based.**

| Source | Purpose |
|--------|--------|
| **MILOGH.CSV** | Master movement log |
| **MILOGD.CSV** | Detail |
| **MILOGB.CSV** | Bin breakdown |

**Key:** `itemId`

**Show:** `tranDate`, `userId`, `qty`, `locId`, `comment`, `type`

**Drilldowns:**

| Click | Go to |
|-------|--------|
| `tranDate` / `entry` | Transaction page |
| `userId` | User info (MIUSER.CSV) |
| `locId` | Location page |
| any `itemId` | Item page |

---

## 5. Manufacturing Order Page

**When clicking an MO (`mohId`):**

| Source | Purpose |
|--------|--------|
| **MIMOH.CSV** | Header |
| **MIMOMD.CSV** | Materials consumed (`partId` = component, `buildItem` = finished good) |
| **MIMORD.CSV** | Routing |
| **MIMOWR.CSV**, **MIMOWC.CSV**, **MIMOWCC.CSV** | Work center / routing detail |

**Drilldowns:** Component item → Item page; Finished item → Item page; Work center → Work center page

---

## 6. Purchase Order Page

**When clicking a PO:**

| Source | Purpose |
|--------|--------|
| **MIPOH.CSV** | Header |
| **MIPOD.CSV** | Lines |
| **MIPORCVR.CSV** | Receipts |
| **MISUPL.CSV** | Supplier |

**Drilldowns:** Supplier → Supplier page; Item → Item page; Receipt → Receipt detail

---

## 7. Supplier Page

**Source:** MISUPL.CSV

**Supplier → item relationships:** Join MIPOH (`suplId`) → MIPOD (`poId`, `poRev`) → `itemId`

---

## 8. BOM Where Used

**Source:** MIBOMD.CSV, MIBOMH.CSV

**Find where item is used:** Filter MIBOMD by `partId = :itemId`, join MIBOMH on `bomId`

**Drilldown:** Parent assembly → Item page; BOM → BOM page

---

## 9. Work Orders

**Source:** MIWOH.CSV, MIWOD.CSV — Same structure as MO but different module.

---

## 10. Cost Page

**Snapshot:** MIITEM.`itemCost`

**History:** MIICST.CSV — Fields: `transDate`, `cost`, `qRecd`, `qUsed`, `poId` (if exists), `locId`

**Drilldowns:** `poId` → PO page; `locId` → Location page

---

## 11. User / Audit Tracking

**Source:** MIUSER.CSV — Every table has `userId`. Join `table.userId` → MIUSER.`userId` for full name, role, etc.

---

## 12. Tax / Rates (Currency)

**Tax:** MITXRATE.CSV, MITXCLS.CSV, MITXGRP.CSV

**Currency:** If no currency column in PO header, use system base (e.g. CAD). If currency exists per PO, display per PO. Never auto-convert unless `fxRate` exists.

---

## Drilldown rule summary

| Clicked field | Go to | Powered by |
|---------------|--------|------------|
| `itemId` | Item Page | MIITEM |
| `lotId` | Lot Page | MISLTD + MISLTH |
| `mohId` | MO Page | MIMOH |
| `wohId` | WO Page | MIWOH |
| `poId` | PO Page | MIPOH |
| `suplId` | Supplier | MISUPL |
| `tranDate` + `entry` | Transaction Page | MILOGH |
| `locId` | Location View | MIILOCQT |
| `binId` | Bin View | MIBINQ |

---

## Important: no “magic summary table”

- Everything is built by: **filtering by key** (e.g. `itemId`), **joining via keys**, **sorting by `tranDate`**.
- Never merge tables unless join keys match exactly.
- MISys data is event-driven; the portal should be event-driven too.

---

## Final instruction

**Do not build “tabs.”** Build:

- **Independent data pages**
- Each powered by one or more CSVs
- Connected through keys

**If a key does not exist in the CSV, you cannot drill to it.** That is the rule.
