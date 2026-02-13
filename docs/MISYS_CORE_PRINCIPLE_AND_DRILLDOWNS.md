# MISys Core Principle & Drilldown Rules

**Status: Authoritative reference for the Canoil Portal.**  
Every screen and every drilldown must follow this. No fabricated data; no drill without a real key.

---

## CORE PRINCIPLE

Every screen in the system must be:

- **A filtered view of one or more of the MISys CSV tables.**

Every drilldown must:

- **Use a real key from the CSV**
- **Open a page powered by real rows from another CSV**
- **Never fabricate or summarize data unless explicitly computed**

There is no “magic summary table.” Everything is built by:

- Filtering by keys (e.g. `itemId`)
- Joining via keys
- Sorting by `tranDate` (or equivalent)

MISys data is event-driven. The portal should be event-driven too.

**Rule:** If a key does not exist in the CSV, you cannot drill to it.

---

## 1. ITEM PAGE (entry point)

**When user clicks an item (`itemId`):**

| Source | Purpose |
|--------|--------|
| **MIITEM.CSV** | Base master record |
| **MIITEMX.CSV** | Notes/docs |
| **MIITEMA.CSV** | Alternates |

**Key:** `itemId`  
That key exists in nearly every table.

---

## 2. STOCK TAB (where quantities come from)

| Level | Source | Key | Notes |
|-------|--------|-----|--------|
| **Location** | **MIILOCQT.CSV** | `itemId` | Qty by `locId` |
| **Bin** | **MIBINQ.CSV** | `itemId` | Fields: `locId`, `binId`, qty |
| **Lot** | **MISLBINQ.CSV** | `prntItemId` | Fields: `lotId`, bin, qty |

**Drilldowns:**

- Click **locId** → filter MIILOCQT by that `locId`
- Click **binId** → filter MIBINQ by that bin
- Click **lotId** → open **LOT PAGE**

---

## 3. LOT PAGE (critical)

**When clicking a lot number:**

| Purpose | Source |
|--------|--------|
| Lot identity | **MISLHIST.CSV**, **MISLNH.CSV** (lot header) |
| Lot movements | **MISLTH.CSV** (lot transaction header), **MISLTD.CSV** (lot transaction detail) |

**Join rule:** Match on `tranDate` + `userId` + `entry` + `detail`.

**Show:**

- Lot ID
- Parent item (`prntItemId`)
- First movement date → creation date
- First `userId` → who created
- All movement rows sorted descending
- Current qty from **MISLBINQ**

**Drilldowns:**

- Lot row has **MO reference** → drill to **MO page**
- Lot row has **PO reference** → drill to **PO page**

---

## 4. STOCK MOVEMENT TAB

**Not lot-based. Inventory-log based.**

| Source | Role |
|--------|------|
| **MILOGH.CSV** | Master movement log |
| **MILOGD.CSV** | Detail |
| **MILOGB.CSV** | Bin breakdown |

**Key:** `itemId`

**Show:** `tranDate`, `userId`, qty, `locId`, comment, type

**Drilldowns:**

- Click `tranDate`/entry → transaction page
- Click `userId` → user info (**MIUSER.CSV**)
- Click `locId` → location page
- Click any `itemId` → item page

---

## 5. MANUFACTURING ORDER PAGE

**When clicking an MO (`mohId`):**

| Purpose | Source |
|--------|--------|
| Header | **MIMOH.CSV** |
| Materials consumed | **MIMOMD.CSV** (`partId` = component, `buildItem` = finished good) |
| Routing | **MIMORD.CSV**, **MIMOWR.CSV**, **MIMOWC.CSV**, **MIMOWCC.CSV** |

**Drilldowns:**

- Click component item → item page
- Click finished item → item page
- Click work center → work center page

---

## 6. PURCHASE ORDER PAGE

**When clicking a PO:**

| Purpose | Source |
|--------|--------|
| Header | **MIPOH.CSV** |
| Lines | **MIPOD.CSV** |
| Receipts | **MIPORCVR.CSV** |
| Supplier | **MISUPL.CSV** |

**Drilldowns:**

- Click supplier → supplier page
- Click item → item page
- Click receipt → receipt detail

---

## 7. SUPPLIER PAGE

| Source | Purpose |
|--------|--------|
| **MISUPL.CSV** | Supplier master |

**Supplier → item relationships:**  
Join **MIPOH** (`suplId`) → **MIPOD** (`poId`, `poRev`) → `itemId`

---

## 8. BOM WHERE USED

| Source | Use |
|--------|-----|
| **MIBOMD.CSV** | Component usage |
| **MIBOMH.CSV** | BOM header |

**Logic:** `SELECT * FROM MIBOMD WHERE partId = :itemId` JOIN **MIBOMH** on `bomId`.

**Drilldown:**

- Click parent assembly → item page
- Click BOM → BOM page

---

## 9. WORK ORDERS

| Source | Role |
|--------|------|
| **MIWOH.CSV** | Header |
| **MIWOD.CSV** | Detail |

Same structure as MO but different module.

---

## 10. COST PAGE

| Purpose | Source |
|--------|--------|
| Snapshot | **MIITEM** `itemCost` |
| History | **MIICST.CSV** |

**MIICST fields:** `transDate`, cost, `qRecd`, `qUsed`, `poId` (if exists), `locId`

**Drilldowns:**

- Click `poId` → PO page
- Click `locId` → location page

---

## 11. USER / AUDIT TRACKING

| Source | Use |
|--------|-----|
| **MIUSER.CSV** | User master |

Every table has `userId`. Join `table.userId` → **MIUSER.userId** to show full name, role, etc.

---

## 12. TAX / RATES (currency)

| Area | Source |
|------|--------|
| Tax | **MITXRATE.CSV**, **MITXCLS.CSV**, **MITXGRP.CSV** |
| Currency | If no currency column in PO header → use system base (e.g. CAD). If currency exists per PO → display per PO. **Never auto-convert unless `fxRate` exists.** |

---

## DRILLDOWN RULE SUMMARY

| Clicked field | Go to | Powered by |
|---------------|--------|------------|
| `itemId` | Item page | MIITEM |
| `lotId` | Lot page | MISLTD + MISLTH |
| `mohId` | MO page | MIMOH |
| `wohId` | WO page | MIWOH |
| `poId` | PO page | MIPOH |
| `suplId` | Supplier page | MISUPL |
| `tranDate` + entry | Transaction page | MILOGH |
| `locId` | Location view | MIILOCQT |
| `binId` | Bin view | MIBINQ |

---

## FINAL INSTRUCTION

You do **not** build “tabs” in isolation.

You build:

1. **Independent data pages**
2. Each powered by **exactly one or more CSVs**
3. **Connected through keys**

If a key does not exist in the CSV, you cannot drill to it.  
That is the rule.
