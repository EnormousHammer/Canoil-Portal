# Canoil Postgres schema — MISys replacement (v1)

This folder contains the **PostgreSQL schema** for a modern MISys-style data layer: staging (raw CSV as JSONB) and core (typed, normalized tables) plus a unified activity view.

**Scope:** Items, Stock (location/bin), Movements, Lots/Serial, BOM, Manufacturing Orders, Purchasing, Suppliers, Cost History, Users.  
**Excluded:** Work Orders, Tax, MO Routing/Workcenters.

---

## Items and the rest of the app (current status)

- **Items** are already implemented in the portal: Full Company Data (CSV) → `full_company_data_converter.py` → `MIITEM.json` / `Items.json` / `CustomAlert5.json` → frontend. The same converter also loads **Stock** (MIILOCQT, MIBINQ), **Movements** (MILOGH), **Lots** (MISLHIST, LotSerialHistory), **BOM** (MIBOMH, MIBOMD), **MO** (MIMOH, MIMOMD), **PO** (MIPOH, MIPOD), **Suppliers** (MISUPL), **Cost** (MIICST), and **Users** (MIUSER). So all sections are fed from one Full Company Data source; the item modal and drilldowns use this data.
- The **Postgres schema + ETL** implement the same sections for when you use a database: run `01_schema.sql`, then run the ETL to load a Full Company Data folder into staging and core (items first, then the rest in dependency order).

## Implementation order: Items first, then the rest

When filling the database (or adding new features), use this order:

| Phase | Module | Core tables | Purpose |
|-------|--------|-------------|---------|
| **1** | **Items** | `items`, `item_notes`, `item_alternates` | Entry point; everything else joins to items. |
| 2 | Stock | `inventory_by_location`, `inventory_by_bin` | Location/bin quantities (Stock tab). |
| 3 | Movements | `inventory_txn_header`, `inventory_txn_line`, `inventory_txn_breakdown` | Stock Movement tab (MILOGH/MILOGD/MILOGB). |
| 4 | Lots | `lots`, `lot_movements` | Lot page, SL Numbers tab. |
| 5 | BOM | `boms`, `bom_components` | BOM tab, Where Used. |
| 6 | Manufacturing | `manufacturing_orders`, `mo_materials` | MO page, Mfg Orders tab. |
| 7 | Purchasing | `purchase_orders`, `purchase_order_lines`, `suppliers`, `supplier_items` | PO page, Suppliers tab. |
| 8 | Cost & Users | `item_cost_history`, `users` | Cost tab, audit/user display. |

The schema defines **what to fill in after items**; ETL and UI can be built phase by phase against these tables.

---

## What’s missing (as of last update)

All previously listed gaps have been implemented:

- **Converter:** MILOGD, MILOGB, MISLNH, MISLND, MIQSUP are in `full_company_data_converter.py` (FULL_COMPANY_MAPPINGS + skeleton). MISLTD was already present (LotSerialDetail).
- **ETL staging:** mislbinq_raw, mibinh_raw, milogd_raw, milogb_raw, misltd_raw, mislnh_raw, mislnd_raw, mipohx_raw, miqsup_raw are all loaded in `etl_full_company_to_postgres.py` → `load_staging()`.
- **ETL core:** inventory_txn_line (from milogd_raw), inventory_txn_breakdown (from milogb_raw), supplier_items (from miqsup_raw), purchase_orders.raw_ext (from mipohx_raw), and lots created_date/created_by/balance_qty (computed from lot_movements) are populated in `upsert_core()`.

**Still out of scope by design:** Work Orders, Tax, MO routing/workcenters. Add later if required.

---

## Quick start

### 1. Create a Postgres database

```bash
createdb canoil_misys
```

### 2. Apply the schema

**Option A — psql:**

```bash
psql -d canoil_misys -f backend/db/01_schema.sql
```

**Option B — Python script (uses `DATABASE_URL`):**

```bash
cd backend
set DATABASE_URL=postgresql://user:pass@localhost:5432/canoil_misys
python db/run_schema.py
```

### 3. Load data (all sections: items + stock + movements + lots + BOM + MO + PO + suppliers + cost + users)

After the schema is applied, run the ETL to load a Full Company Data folder into staging and core:

```bash
cd backend
set DATABASE_URL=postgresql://user:pass@localhost:5432/canoil_misys
python db/etl_full_company_to_postgres.py "G:\path\to\Full Company Data as of 02_10_2026"
```

Requires `psycopg2` or `psycopg2-binary`. The ETL loads every section (not just items): items, item_notes, item_alternates, inventory_by_location, inventory_by_bin, inventory_txn_header, inventory_txn_line, inventory_txn_breakdown, lots (with created_date/created_by/balance_qty), lot_movements, boms, bom_components, manufacturing_orders, mo_materials, suppliers, supplier_items, purchase_orders (including raw_ext from MIPOHX), purchase_order_lines, item_cost_history, users.

---

## Schema layout

| Layer   | Purpose |
|--------|---------|
| `core.app_config` | Global config (e.g. `baseCurrency` = CAD). |
| `staging.*_raw`   | One table per CSV family. Full row in `data` (JSONB); key columns (item_id, loc_id, etc.) extracted for indexing. |
| `core.*`         | Typed tables: items, item_notes, item_alternates, inventory_by_location, inventory_by_bin, inventory_txn_*, lots, lot_movements, boms, bom_components, manufacturing_orders, mo_materials, suppliers, supplier_items, purchase_orders, purchase_order_lines, item_cost_history, users. |
| `core.v_activity_timeline` | View: unified activity (inventory txn, lot moves, MO, PO). |

---

## ETL order (staging → core)

1. **Load CSV rows into staging**  
   For each CSV: insert into the matching `staging.*_raw` table with full row as `data` (JSONB) and extracted keys (e.g. `item_id`, `loc_id`) for indexes.

2. **Upsert into core** (in dependency order):
   - `core.users` ← `staging.miuser_raw`
   - `core.items` ← `staging.miitem_raw`
   - `core.item_notes` ← `staging.miitemx_raw`
   - `core.item_alternates` ← `staging.miitema_raw`
   - `core.inventory_by_location` ← `staging.miilocqt_raw`
   - `core.inventory_by_bin` ← `staging.mibinq_raw`
   - `core.inventory_txn_*` ← `staging.milogh_raw` + `milogd_raw` + `milogb_raw`
   - `core.lots` + `core.lot_movements` ← `misltd_raw` joined to `mislth_raw` on (tran_date, user_id, entry, detail)
   - `core.boms` + `core.bom_components` ← `mibomh_raw` + `mibomd_raw`
   - `core.manufacturing_orders` + `core.mo_materials` ← `mimoh_raw` + `mimomd_raw`
   - `core.suppliers` + `core.supplier_items` ← `misupl_raw` + `miqsup_raw`
   - `core.purchase_orders` + `core.purchase_order_lines` ← `mipoh_raw` + `mipohx_raw` + `mipod_raw`
   - `core.item_cost_history` ← `staging.miicst_raw`

3. **Lots:** set `created_date` / `created_by` from earliest movement per `prnt_lot_id`; set `balance_qty` = sum(qty_in) − sum(qty_out).

4. **Currency:** if the export has no currency field, set `currency_code` from `core.app_config` where `key = 'baseCurrency'` for PO and cost history.

---

## Staging ↔ CSV mapping

| CSV (MISys export) | Staging table        | Key columns extracted |
|--------------------|----------------------|------------------------|
| MIITEM.CSV         | staging.miitem_raw   | item_id |
| MIITEMX.CSV        | staging.miitemx_raw  | item_id |
| MIITEMA.CSV        | staging.miitema_raw  | item_id, alt_item_id |
| MIILOCQT.CSV       | staging.miilocqt_raw | item_id, loc_id |
| MIBINQ.CSV         | staging.mibinq_raw   | item_id, loc_id, bin_id |
| MISLBINQ.CSV       | staging.mislbinq_raw | prnt_item_id, lot_id, loc_id, bin_id |
| MIBINH.CSV         | staging.mibinh_raw   | item_id, loc_id, bin_id, tran_date, entry |
| MILOGH.CSV         | staging.milogh_raw   | item_id, loc_id, user_id, tran_date, entry |
| MILOGD.CSV         | staging.milogd_raw   | item_id, tran_date, entry, detail |
| MILOGB.CSV         | staging.milogb_raw   | item_id, tran_date, entry, detail |
| MISLTH.CSV         | staging.mislth_raw   | prnt_item_id, lot_id, user_id, tran_date, entry, detail |
| MISLTD.CSV         | staging.misltd_raw   | prnt_item_id, prnt_lot_id, user_id, tran_date, entry, detail |
| MISLHIST.CSV       | staging.mislhist_raw | prnt_item_id, lot_id |
| MISLNH.CSV         | staging.mislnh_raw   | prnt_item_id, lot_id |
| MISLND.CSV         | staging.mislnd_raw   | prnt_item_id, lot_id |
| MIBOMH.CSV         | staging.mibomh_raw   | bom_id, parent_item_id |
| MIBOMD.CSV         | staging.mibomd_raw   | bom_id, part_id |
| MIMOH.CSV          | staging.mimoh_raw    | moh_id, build_item_id, loc_id |
| MIMOMD.CSV         | staging.mimomd_raw   | moh_id, part_id |
| MIPOH.CSV          | staging.mipoh_raw    | poh_id, poh_rev, supl_id |
| MIPOHX.CSV         | staging.mipohx_raw   | poh_id, poh_rev |
| MIPOD.CSV          | staging.mipod_raw    | poh_id, poh_rev, pod_id, item_id |
| MISUPL.CSV         | staging.misupl_raw   | supl_id |
| MIQSUP.CSV         | staging.miqsup_raw   | supl_id, item_id |
| MIICST.CSV         | staging.miicst_raw   | item_id, loc_id, trans_date, seq_no |
| MIUSER.CSV         | staging.miuser_raw   | user_id |

---

## Relation to the portal

The Canoil portal today uses **Google Drive / Full Company Data** (CSV → JSON in memory via `full_company_data_converter.py`). This Postgres schema is the **target model** when you add a database backend: same concepts (items, POs, MOs, lots, etc.) with staging for traceability and core for querying and drilldowns. See `docs/MISYS_CSV_PAGES_SPEC.md` for drilldown rules (itemId → Item page, lotId → Lot page, etc.).

**In short:** Items are the entry point; this schema is the blueprint for the **rest of the app** to fill in (stock, movements, lots, BOM, MO, PO, suppliers, cost, users) once items are in place.
