/* ============================================================
   Canoil Modern MISys Replacement — Postgres Schema (v1)
   Scope: Items, Stock (Location/Bin), Movements, Lots/Serial,
          BOM, Manufacturing Orders, Purchasing, Suppliers,
          Cost History, Users/Audit
   Explicitly EXCLUDED: Work Orders, Tax, MO Routing/Workcenters
   ============================================================

   DESIGN NOTES (for Cursor/dev team):
   1) We cannot hardcode every CSV column name because MISys exports
      vary, but we CAN store each row losslessly in staging as JSONB,
      then ETL into typed "core" tables with stable columns.
   2) Keep raw data forever in staging for traceability.
   3) Core tables include:
      - normalized IDs
      - drilldown keys
      - computed/typed numeric fields
   4) Use base currency config (CAD by default) in app config table.
*/

BEGIN;

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- Schemas ----------
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS core;

-- ============================================================
-- 0) GLOBAL CONFIG (currency, app settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS core.app_config (
  key               TEXT PRIMARY KEY,
  value             JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed example: base currency (your UI should allow changing)
INSERT INTO core.app_config(key, value)
VALUES ('baseCurrency', '"CAD"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 1) STAGING LAYER (lossless)
--    Store every CSV row as JSONB + some common extracted keys.
-- ============================================================

CREATE TABLE IF NOT EXISTS staging.miitem_raw (
  id                BIGSERIAL PRIMARY KEY,
  source_file       TEXT NOT NULL DEFAULT 'MIITEM.CSV',
  row_num           INTEGER NOT NULL,
  item_id           TEXT,
  data              JSONB NOT NULL,
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS miitem_raw_item_id_idx ON staging.miitem_raw (item_id);
CREATE INDEX IF NOT EXISTS miitem_raw_data_gin ON staging.miitem_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.miitemx_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIITEMX.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS miitemx_raw_item_id_idx ON staging.miitemx_raw (item_id);
CREATE INDEX IF NOT EXISTS miitemx_raw_data_gin ON staging.miitemx_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.miitema_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIITEMA.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  alt_item_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS miitema_raw_item_id_idx ON staging.miitema_raw (item_id);
CREATE INDEX IF NOT EXISTS miitema_raw_alt_item_id_idx ON staging.miitema_raw (alt_item_id);
CREATE INDEX IF NOT EXISTS miitema_raw_data_gin ON staging.miitema_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.miilocqt_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIILOCQT.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  loc_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS miilocqt_raw_item_loc_idx ON staging.miilocqt_raw (item_id, loc_id);
CREATE INDEX IF NOT EXISTS miilocqt_raw_data_gin ON staging.miilocqt_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mibinq_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIBINQ.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  loc_id TEXT,
  bin_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mibinq_raw_item_loc_bin_idx ON staging.mibinq_raw (item_id, loc_id, bin_id);
CREATE INDEX IF NOT EXISTS mibinq_raw_data_gin ON staging.mibinq_raw USING GIN (data);

-- Lot-level quantities by bin (MISLBINQ)
CREATE TABLE IF NOT EXISTS staging.mislbinq_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MISLBINQ.CSV',
  row_num INTEGER NOT NULL,
  prnt_item_id TEXT,
  lot_id TEXT,
  loc_id TEXT,
  bin_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mislbinq_raw_item_lot_idx ON staging.mislbinq_raw (prnt_item_id, lot_id);
CREATE INDEX IF NOT EXISTS mislbinq_raw_lot_idx ON staging.mislbinq_raw (lot_id);
CREATE INDEX IF NOT EXISTS mislbinq_raw_data_gin ON staging.mislbinq_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mibinh_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIBINH.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  loc_id TEXT,
  bin_id TEXT,
  tran_date TEXT,
  entry TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mibinh_raw_item_idx ON staging.mibinh_raw (item_id);
CREATE INDEX IF NOT EXISTS mibinh_raw_loc_bin_idx ON staging.mibinh_raw (loc_id, bin_id);
CREATE INDEX IF NOT EXISTS mibinh_raw_tran_idx ON staging.mibinh_raw (tran_date, entry);
CREATE INDEX IF NOT EXISTS mibinh_raw_data_gin ON staging.mibinh_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.milogh_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MILOGH.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  loc_id TEXT,
  user_id TEXT,
  tran_date TEXT,
  entry TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS milogh_raw_item_idx ON staging.milogh_raw (item_id);
CREATE INDEX IF NOT EXISTS milogh_raw_loc_idx ON staging.milogh_raw (loc_id);
CREATE INDEX IF NOT EXISTS milogh_raw_user_idx ON staging.milogh_raw (user_id);
CREATE INDEX IF NOT EXISTS milogh_raw_tran_entry_idx ON staging.milogh_raw (tran_date, entry);
CREATE INDEX IF NOT EXISTS milogh_raw_data_gin ON staging.milogh_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.milogd_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MILOGD.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  tran_date TEXT,
  entry TEXT,
  detail TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS milogd_raw_item_idx ON staging.milogd_raw (item_id);
CREATE INDEX IF NOT EXISTS milogd_raw_tran_entry_detail_idx ON staging.milogd_raw (tran_date, entry, detail);
CREATE INDEX IF NOT EXISTS milogd_raw_data_gin ON staging.milogd_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.milogb_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MILOGB.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  tran_date TEXT,
  entry TEXT,
  detail TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS milogb_raw_item_idx ON staging.milogb_raw (item_id);
CREATE INDEX IF NOT EXISTS milogb_raw_tran_entry_detail_idx ON staging.milogb_raw (tran_date, entry, detail);
CREATE INDEX IF NOT EXISTS milogb_raw_data_gin ON staging.milogb_raw USING GIN (data);

-- Lot/Serial movement + masters
CREATE TABLE IF NOT EXISTS staging.mislth_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MISLTH.CSV',
  row_num INTEGER NOT NULL,
  prnt_item_id TEXT,
  lot_id TEXT,
  user_id TEXT,
  tran_date TEXT,
  entry TEXT,
  detail TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mislth_raw_prnt_item_idx ON staging.mislth_raw (prnt_item_id);
CREATE INDEX IF NOT EXISTS mislth_raw_lot_idx ON staging.mislth_raw (lot_id);
CREATE INDEX IF NOT EXISTS mislth_raw_join_idx ON staging.mislth_raw (tran_date, user_id, entry, detail);
CREATE INDEX IF NOT EXISTS mislth_raw_data_gin ON staging.mislth_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.misltd_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MISLTD.CSV',
  row_num INTEGER NOT NULL,
  prnt_item_id TEXT,
  prnt_lot_id TEXT,
  user_id TEXT,
  tran_date TEXT,
  entry TEXT,
  detail TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS misltd_raw_prnt_item_idx ON staging.misltd_raw (prnt_item_id);
CREATE INDEX IF NOT EXISTS misltd_raw_prnt_lot_idx ON staging.misltd_raw (prnt_lot_id);
CREATE INDEX IF NOT EXISTS misltd_raw_join_idx ON staging.misltd_raw (tran_date, user_id, entry, detail);
CREATE INDEX IF NOT EXISTS misltd_raw_data_gin ON staging.misltd_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mislhist_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MISLHIST.CSV',
  row_num INTEGER NOT NULL,
  prnt_item_id TEXT,
  lot_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mislhist_raw_item_idx ON staging.mislhist_raw (prnt_item_id);
CREATE INDEX IF NOT EXISTS mislhist_raw_lot_idx ON staging.mislhist_raw (lot_id);
CREATE INDEX IF NOT EXISTS mislhist_raw_data_gin ON staging.mislhist_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mislnh_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MISLNH.CSV',
  row_num INTEGER NOT NULL,
  prnt_item_id TEXT,
  lot_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mislnh_raw_item_idx ON staging.mislnh_raw (prnt_item_id);
CREATE INDEX IF NOT EXISTS mislnh_raw_lot_idx ON staging.mislnh_raw (lot_id);
CREATE INDEX IF NOT EXISTS mislnh_raw_data_gin ON staging.mislnh_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mislnd_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MISLND.CSV',
  row_num INTEGER NOT NULL,
  prnt_item_id TEXT,
  lot_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mislnd_raw_item_idx ON staging.mislnd_raw (prnt_item_id);
CREATE INDEX IF NOT EXISTS mislnd_raw_lot_idx ON staging.mislnd_raw (lot_id);
CREATE INDEX IF NOT EXISTS mislnd_raw_data_gin ON staging.mislnd_raw USING GIN (data);

-- BOM
CREATE TABLE IF NOT EXISTS staging.mibomh_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIBOMH.CSV',
  row_num INTEGER NOT NULL,
  bom_id TEXT,
  parent_item_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mibomh_raw_bom_idx ON staging.mibomh_raw (bom_id);
CREATE INDEX IF NOT EXISTS mibomh_raw_parent_idx ON staging.mibomh_raw (parent_item_id);
CREATE INDEX IF NOT EXISTS mibomh_raw_data_gin ON staging.mibomh_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mibomd_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIBOMD.CSV',
  row_num INTEGER NOT NULL,
  bom_id TEXT,
  part_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mibomd_raw_bom_idx ON staging.mibomd_raw (bom_id);
CREATE INDEX IF NOT EXISTS mibomd_raw_part_idx ON staging.mibomd_raw (part_id);
CREATE INDEX IF NOT EXISTS mibomd_raw_data_gin ON staging.mibomd_raw USING GIN (data);

-- Manufacturing Orders (MO)
CREATE TABLE IF NOT EXISTS staging.mimoh_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIMOH.CSV',
  row_num INTEGER NOT NULL,
  moh_id TEXT,
  build_item_id TEXT,
  loc_id TEXT,
  creator_user_id TEXT,
  releaser_user_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mimoh_raw_moh_idx ON staging.mimoh_raw (moh_id);
CREATE INDEX IF NOT EXISTS mimoh_raw_build_item_idx ON staging.mimoh_raw (build_item_id);
CREATE INDEX IF NOT EXISTS mimoh_raw_loc_idx ON staging.mimoh_raw (loc_id);
CREATE INDEX IF NOT EXISTS mimoh_raw_data_gin ON staging.mimoh_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mimomd_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIMOMD.CSV',
  row_num INTEGER NOT NULL,
  moh_id TEXT,
  part_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mimomd_raw_moh_idx ON staging.mimomd_raw (moh_id);
CREATE INDEX IF NOT EXISTS mimomd_raw_part_idx ON staging.mimomd_raw (part_id);
CREATE INDEX IF NOT EXISTS mimomd_raw_data_gin ON staging.mimomd_raw USING GIN (data);

-- Purchasing (PO)
CREATE TABLE IF NOT EXISTS staging.mipoh_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIPOH.CSV',
  row_num INTEGER NOT NULL,
  poh_id TEXT,
  poh_rev TEXT,
  supl_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mipoh_raw_poh_idx ON staging.mipoh_raw (poh_id, poh_rev);
CREATE INDEX IF NOT EXISTS mipoh_raw_supl_idx ON staging.mipoh_raw (supl_id);
CREATE INDEX IF NOT EXISTS mipoh_raw_data_gin ON staging.mipoh_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mipohx_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIPOHX.CSV',
  row_num INTEGER NOT NULL,
  poh_id TEXT,
  poh_rev TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mipohx_raw_poh_idx ON staging.mipohx_raw (poh_id, poh_rev);
CREATE INDEX IF NOT EXISTS mipohx_raw_data_gin ON staging.mipohx_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.mipod_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIPOD.CSV',
  row_num INTEGER NOT NULL,
  poh_id TEXT,
  poh_rev TEXT,
  pod_id TEXT,
  item_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mipod_raw_poh_idx ON staging.mipod_raw (poh_id, poh_rev);
CREATE INDEX IF NOT EXISTS mipod_raw_item_idx ON staging.mipod_raw (item_id);
CREATE INDEX IF NOT EXISTS mipod_raw_data_gin ON staging.mipod_raw USING GIN (data);

-- Suppliers
CREATE TABLE IF NOT EXISTS staging.misupl_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MISUPL.CSV',
  row_num INTEGER NOT NULL,
  supl_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS misupl_raw_supl_idx ON staging.misupl_raw (supl_id);
CREATE INDEX IF NOT EXISTS misupl_raw_data_gin ON staging.misupl_raw USING GIN (data);

CREATE TABLE IF NOT EXISTS staging.miqsup_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIQSUP.CSV',
  row_num INTEGER NOT NULL,
  supl_id TEXT,
  item_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS miqsup_raw_supl_idx ON staging.miqsup_raw (supl_id);
CREATE INDEX IF NOT EXISTS miqsup_raw_item_idx ON staging.miqsup_raw (item_id);
CREATE INDEX IF NOT EXISTS miqsup_raw_data_gin ON staging.miqsup_raw USING GIN (data);

-- Cost history
CREATE TABLE IF NOT EXISTS staging.miicst_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIICST.CSV',
  row_num INTEGER NOT NULL,
  item_id TEXT,
  loc_id TEXT,
  trans_date TEXT,
  seq_no TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS miicst_raw_item_idx ON staging.miicst_raw (item_id);
CREATE INDEX IF NOT EXISTS miicst_raw_loc_idx ON staging.miicst_raw (loc_id);
CREATE INDEX IF NOT EXISTS miicst_raw_date_idx ON staging.miicst_raw (trans_date);
CREATE INDEX IF NOT EXISTS miicst_raw_data_gin ON staging.miicst_raw USING GIN (data);

-- Users
CREATE TABLE IF NOT EXISTS staging.miuser_raw (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT 'MIUSER.CSV',
  row_num INTEGER NOT NULL,
  user_id TEXT,
  data JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS miuser_raw_user_idx ON staging.miuser_raw (user_id);
CREATE INDEX IF NOT EXISTS miuser_raw_data_gin ON staging.miuser_raw USING GIN (data);


-- ============================================================
-- 2) CORE LAYER (typed, normalized, drilldown-friendly)
-- ============================================================

-- --------------------------
-- Core: Users
-- --------------------------
CREATE TABLE IF NOT EXISTS core.users (
  user_id           TEXT PRIMARY KEY,
  display_name      TEXT,
  email             TEXT,
  is_active         BOOLEAN,
  raw               JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------
-- Core: Items
-- --------------------------
CREATE TABLE IF NOT EXISTS core.items (
  item_id           TEXT PRIMARY KEY,
  descr             TEXT,
  uom               TEXT,
  status            TEXT,
  item_cost         NUMERIC(18,6),
  sales_id          TEXT,
  raw               JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS items_descr_trgm_idx ON core.items USING GIN (descr gin_trgm_ops);

CREATE TABLE IF NOT EXISTS core.item_notes (
  item_id           TEXT PRIMARY KEY REFERENCES core.items(item_id) ON DELETE CASCADE,
  notes             TEXT,
  doc_path          TEXT,
  pic_path          TEXT,
  raw               JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core.item_alternates (
  item_id           TEXT NOT NULL REFERENCES core.items(item_id) ON DELETE CASCADE,
  alt_item_id       TEXT NOT NULL,
  relation          TEXT,
  raw               JSONB NOT NULL,
  PRIMARY KEY (item_id, alt_item_id)
);
CREATE INDEX IF NOT EXISTS item_alts_alt_idx ON core.item_alternates (alt_item_id);

-- --------------------------
-- Core: Inventory snapshots
-- --------------------------
CREATE TABLE IF NOT EXISTS core.inventory_by_location (
  item_id           TEXT NOT NULL REFERENCES core.items(item_id) ON DELETE CASCADE,
  loc_id            TEXT NOT NULL,
  qty_on_hand       NUMERIC(18,6),
  qty_reserved      NUMERIC(18,6),
  qty_on_order      NUMERIC(18,6),
  raw               JSONB NOT NULL,
  PRIMARY KEY (item_id, loc_id)
);
CREATE INDEX IF NOT EXISTS inv_loc_loc_idx ON core.inventory_by_location (loc_id);

CREATE TABLE IF NOT EXISTS core.inventory_by_bin (
  item_id           TEXT NOT NULL REFERENCES core.items(item_id) ON DELETE CASCADE,
  loc_id            TEXT NOT NULL,
  bin_id            TEXT NOT NULL,
  qty_on_hand       NUMERIC(18,6),
  raw               JSONB NOT NULL,
  PRIMARY KEY (item_id, loc_id, bin_id)
);
CREATE INDEX IF NOT EXISTS inv_bin_loc_bin_idx ON core.inventory_by_bin (loc_id, bin_id);

-- --------------------------
-- Core: Inventory transactions
-- --------------------------
CREATE TABLE IF NOT EXISTS core.inventory_txn_header (
  txn_id            BIGSERIAL PRIMARY KEY,
  tran_date         DATE,
  entry             TEXT,
  loc_id            TEXT,
  user_id           TEXT,
  txn_type          TEXT,
  comment           TEXT,
  raw               JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS inv_txn_header_key_idx
  ON core.inventory_txn_header (tran_date, entry);

CREATE INDEX IF NOT EXISTS inv_txn_header_loc_idx ON core.inventory_txn_header (loc_id);
CREATE INDEX IF NOT EXISTS inv_txn_header_user_idx ON core.inventory_txn_header (user_id);

CREATE TABLE IF NOT EXISTS core.inventory_txn_line (
  txn_line_id       BIGSERIAL PRIMARY KEY,
  tran_date         DATE,
  entry             TEXT,
  detail            TEXT,
  item_id           TEXT,
  qty               NUMERIC(18,6),
  uom               TEXT,
  loc_id            TEXT,
  raw               JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_txn_line_key_idx ON core.inventory_txn_line (tran_date, entry, detail);
CREATE INDEX IF NOT EXISTS inv_txn_line_item_idx ON core.inventory_txn_line (item_id);
CREATE INDEX IF NOT EXISTS inv_txn_line_loc_idx ON core.inventory_txn_line (loc_id);

CREATE TABLE IF NOT EXISTS core.inventory_txn_breakdown (
  txn_breakdown_id  BIGSERIAL PRIMARY KEY,
  tran_date         DATE,
  entry             TEXT,
  detail            TEXT,
  item_id           TEXT,
  loc_id            TEXT,
  bin_id            TEXT,
  lot_id            TEXT,
  qty               NUMERIC(18,6),
  raw               JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_txn_bd_key_idx ON core.inventory_txn_breakdown (tran_date, entry, detail);
CREATE INDEX IF NOT EXISTS inv_txn_bd_item_idx ON core.inventory_txn_breakdown (item_id);
CREATE INDEX IF NOT EXISTS inv_txn_bd_lot_idx ON core.inventory_txn_breakdown (lot_id);

-- --------------------------
-- Core: Lots / Serial (event-based)
-- --------------------------
CREATE TABLE IF NOT EXISTS core.lots (
  lot_id            TEXT PRIMARY KEY,
  prnt_item_id      TEXT,
  created_date      DATE,
  created_by        TEXT,
  balance_qty       NUMERIC(18,6),
  raw_master        JSONB,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lots_item_idx ON core.lots (prnt_item_id);

CREATE TABLE IF NOT EXISTS core.lot_movements (
  lot_move_id       BIGSERIAL PRIMARY KEY,
  prnt_lot_id       TEXT NOT NULL,
  prnt_item_id      TEXT,
  tran_date         DATE,
  user_id           TEXT,
  entry             TEXT,
  detail            TEXT,
  loc_id            TEXT,
  bin_id            TEXT,
  qty_in            NUMERIC(18,6),
  qty_out           NUMERIC(18,6),
  raw_header        JSONB,
  raw_detail        JSONB
);
CREATE INDEX IF NOT EXISTS lot_moves_lot_idx ON core.lot_movements (prnt_lot_id);
CREATE INDEX IF NOT EXISTS lot_moves_item_idx ON core.lot_movements (prnt_item_id);
CREATE INDEX IF NOT EXISTS lot_moves_join_idx ON core.lot_movements (tran_date, user_id, entry, detail);

-- --------------------------
-- Core: BOM
-- --------------------------
CREATE TABLE IF NOT EXISTS core.boms (
  bom_id            TEXT PRIMARY KEY,
  parent_item_id    TEXT,
  revision          TEXT,
  is_active         BOOLEAN,
  raw               JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boms_parent_idx ON core.boms (parent_item_id);

CREATE TABLE IF NOT EXISTS core.bom_components (
  bom_id            TEXT NOT NULL REFERENCES core.boms(bom_id) ON DELETE CASCADE,
  line_no           INTEGER NOT NULL DEFAULT 0,
  part_id           TEXT NOT NULL,
  qty_per           NUMERIC(18,6),
  uom               TEXT,
  scrap_factor      NUMERIC(18,6),
  raw               JSONB NOT NULL,
  PRIMARY KEY (bom_id, part_id, line_no)
);
CREATE INDEX IF NOT EXISTS bom_components_part_idx ON core.bom_components (part_id);

-- --------------------------
-- Core: Manufacturing Orders (MO)
-- --------------------------
CREATE TABLE IF NOT EXISTS core.manufacturing_orders (
  moh_id            TEXT PRIMARY KEY,
  build_item_id     TEXT,
  loc_id            TEXT,
  status            TEXT,
  qty_planned       NUMERIC(18,6),
  qty_completed     NUMERIC(18,6),
  created_date      DATE,
  released_date     DATE,
  created_by        TEXT,
  released_by       TEXT,
  raw               JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mos_build_item_idx ON core.manufacturing_orders (build_item_id);
CREATE INDEX IF NOT EXISTS mos_loc_idx ON core.manufacturing_orders (loc_id);

CREATE TABLE IF NOT EXISTS core.mo_materials (
  moh_id            TEXT NOT NULL REFERENCES core.manufacturing_orders(moh_id) ON DELETE CASCADE,
  line_no           INTEGER NOT NULL DEFAULT 0,
  part_id           TEXT NOT NULL,
  qty_required      NUMERIC(18,6),
  qty_issued        NUMERIC(18,6),
  uom               TEXT,
  raw               JSONB NOT NULL,
  PRIMARY KEY (moh_id, part_id, line_no)
);
CREATE INDEX IF NOT EXISTS mo_materials_part_idx ON core.mo_materials (part_id);

-- --------------------------
-- Core: Suppliers
-- --------------------------
CREATE TABLE IF NOT EXISTS core.suppliers (
  supl_id           TEXT PRIMARY KEY,
  name              TEXT,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  raw               JSONB NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suppliers_name_trgm_idx ON core.suppliers USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS core.supplier_items (
  supl_id           TEXT NOT NULL REFERENCES core.suppliers(supl_id) ON DELETE CASCADE,
  item_id           TEXT NOT NULL REFERENCES core.items(item_id) ON DELETE CASCADE,
  status            TEXT,
  raw               JSONB NOT NULL,
  PRIMARY KEY (supl_id, item_id)
);
CREATE INDEX IF NOT EXISTS supplier_items_item_idx ON core.supplier_items (item_id);

-- --------------------------
-- Core: Purchase Orders (PO)
-- --------------------------
CREATE TABLE IF NOT EXISTS core.purchase_orders (
  poh_id            TEXT NOT NULL,
  poh_rev           TEXT NOT NULL,
  supl_id           TEXT,
  status            TEXT,
  order_date        DATE,
  promised_date     DATE,
  ship_to           TEXT,
  buyer             TEXT,
  currency_code     TEXT,
  raw_header        JSONB NOT NULL,
  raw_ext           JSONB,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poh_id, poh_rev)
);
CREATE INDEX IF NOT EXISTS pos_supl_idx ON core.purchase_orders (supl_id);

CREATE TABLE IF NOT EXISTS core.purchase_order_lines (
  poh_id            TEXT NOT NULL,
  poh_rev           TEXT NOT NULL,
  pod_id            TEXT,
  line_no           INTEGER NOT NULL DEFAULT 0,
  item_id           TEXT,
  descr             TEXT,
  uom               TEXT,
  qty_ordered       NUMERIC(18,6),
  qty_received      NUMERIC(18,6),
  unit_cost         NUMERIC(18,6),
  ext_cost          NUMERIC(18,6),
  raw               JSONB NOT NULL,
  PRIMARY KEY (poh_id, poh_rev, line_no),
  FOREIGN KEY (poh_id, poh_rev) REFERENCES core.purchase_orders(poh_id, poh_rev) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS po_lines_item_idx ON core.purchase_order_lines (item_id);

-- --------------------------
-- Core: Cost history (Item Cost)
-- --------------------------
CREATE TABLE IF NOT EXISTS core.item_cost_history (
  id                BIGSERIAL PRIMARY KEY,
  item_id           TEXT NOT NULL REFERENCES core.items(item_id) ON DELETE CASCADE,
  loc_id            TEXT NOT NULL DEFAULT '',
  trans_date        DATE,
  seq_no            TEXT NOT NULL DEFAULT '',
  qty_received      NUMERIC(18,6),
  qty_issued        NUMERIC(18,6),
  unit_cost         NUMERIC(18,6),
  ext_cost          NUMERIC(18,6),
  currency_code     TEXT,
  raw               JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS item_cost_history_natural_key
  ON core.item_cost_history (item_id, loc_id, trans_date, seq_no);
CREATE INDEX IF NOT EXISTS cost_hist_date_idx ON core.item_cost_history (trans_date);

-- ============================================================
-- 3) VIEWS (Better-than-MISys quality)
-- ============================================================

CREATE OR REPLACE VIEW core.v_activity_timeline AS
SELECT
  'INVENTORY_TXN'::TEXT AS source,
  h.tran_date AS activity_date,
  h.entry AS source_id,
  h.loc_id,
  h.user_id,
  h.txn_type AS activity_type,
  h.comment AS activity_note,
  h.raw AS raw
FROM core.inventory_txn_header h

UNION ALL
SELECT
  'LOT_MOVE'::TEXT AS source,
  lm.tran_date AS activity_date,
  lm.prnt_lot_id AS source_id,
  lm.loc_id,
  lm.user_id,
  'LOT_MOVEMENT'::TEXT AS activity_type,
  NULL::TEXT AS activity_note,
  COALESCE(lm.raw_header, '{}'::jsonb) || jsonb_build_object('raw_detail', COALESCE(lm.raw_detail, '{}'::jsonb)) AS raw
FROM core.lot_movements lm

UNION ALL
SELECT
  'MO'::TEXT AS source,
  mo.created_date AS activity_date,
  mo.moh_id AS source_id,
  mo.loc_id,
  mo.created_by AS user_id,
  'MO_CREATED'::TEXT AS activity_type,
  NULL::TEXT AS activity_note,
  mo.raw AS raw
FROM core.manufacturing_orders mo

UNION ALL
SELECT
  'PO'::TEXT AS source,
  po.order_date AS activity_date,
  po.poh_id || ':' || po.poh_rev AS source_id,
  NULL::TEXT AS loc_id,
  po.buyer AS user_id,
  'PO'::TEXT AS activity_type,
  NULL::TEXT AS activity_note,
  po.raw_header AS raw
FROM core.purchase_orders po;

COMMIT;
