#!/usr/bin/env python3
"""
ETL: Full Company Data (app data dict or CSV folder) -> Postgres staging -> core.

Implements all app sections (not just items): Items, Stock, Movements, Lots,
BOM, MO, PO, Suppliers, Cost, Users. Run after 01_schema.sql has been applied.

Usage:
  export DATABASE_URL=postgresql://user:pass@host:5432/dbname
  # From app data dict (e.g. already loaded by backend):
  python -m db.etl_full_company_to_postgres --data-dict  # not supported yet; use folder
  # From CSV folder (same as Full Company Data):
  python -m db.etl_full_company_to_postgres /path/to/full/company/data/folder

Requires: psycopg2 or psycopg2-binary.
"""

import json
import os
import sys
from pathlib import Path
from decimal import Decimal
from datetime import datetime

# Add backend to path so we can import full_company_data_converter
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    import psycopg2
    from psycopg2.extras import Json, execute_values
except ImportError:
    print("Install psycopg2: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

from full_company_data_converter import load_from_folder, _get_skeleton


def _v(row, *keys, default=None):
    """Get first non-empty value from row for given keys (case-sensitive then case-insensitive)."""
    if not row or not isinstance(row, dict):
        return default
    for k in keys:
        v = row.get(k)
        if v is not None and str(v).strip() != "":
            return v
    for k in keys:
        for rk, rv in row.items():
            if rk and str(rk).strip().lower() == str(k).strip().lower():
                if rv is not None and str(rv).strip() != "":
                    return rv
    return default


def _n(val):
    """Numeric or None."""
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None


def _d(val):
    """Date or None."""
    if val is None:
        return None
    if hasattr(val, "date"):
        return val
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except Exception:
            continue
    return None


def load_staging(conn, data: dict, source_file_default: str = "export") -> None:
    """Insert all sections into staging.*_raw. data = app data dict (e.g. from load_from_folder)."""
    cur = conn.cursor()

    # MIITEM / Items
    for key in ("MIITEM.json", "Items.json", "CustomAlert5.json"):
        rows = data.get(key) or []
        if not rows:
            continue
        for i, row in enumerate(rows):
            item_id = _v(row, "Item No.", "itemId", "Item Number") or ""
            cur.execute(
                """INSERT INTO staging.miitem_raw (source_file, row_num, item_id, data) VALUES (%s,%s,%s,%s)""",
                (source_file_default, i + 1, item_id or None, Json(_to_jsonb(row))),
            )
        if rows:
            break

    # MIITEMX
    for i, row in enumerate(data.get("MIITEMX.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        cur.execute(
            """INSERT INTO staging.miitemx_raw (source_file, row_num, item_id, data) VALUES (%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, Json(_to_jsonb(row))),
        )

    # MIITEMA
    for i, row in enumerate(data.get("MIITEMA.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        alt = _v(row, "Alternate Item No.", "altItemId") or ""
        cur.execute(
            """INSERT INTO staging.miitema_raw (source_file, row_num, item_id, alt_item_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, alt or None, Json(_to_jsonb(row))),
        )

    # MIILOCQT
    for i, row in enumerate(data.get("MIILOCQT.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        loc_id = _v(row, "Location No.", "locId") or ""
        cur.execute(
            """INSERT INTO staging.miilocqt_raw (source_file, row_num, item_id, loc_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, loc_id or None, Json(_to_jsonb(row))),
        )

    # MIBINQ
    for i, row in enumerate(data.get("MIBINQ.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        loc_id = _v(row, "Location No.", "locId") or ""
        bin_id = _v(row, "Bin No.", "binId") or ""
        cur.execute(
            """INSERT INTO staging.mibinq_raw (source_file, row_num, item_id, loc_id, bin_id, data) VALUES (%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, loc_id or None, bin_id or None, Json(_to_jsonb(row))),
        )

    # MISLBINQ (lot qty by bin)
    for i, row in enumerate(data.get("MISLBINQ.json") or []):
        prnt_item_id = _v(row, "Item No.", "itemId", "Parent Item No.", "prntItemId") or ""
        lot_id = _v(row, "Lot No.", "lotId") or ""
        loc_id = _v(row, "Location No.", "locId") or ""
        bin_id = _v(row, "Bin No.", "binId") or ""
        cur.execute(
            """INSERT INTO staging.mislbinq_raw (source_file, row_num, prnt_item_id, lot_id, loc_id, bin_id, data) VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, prnt_item_id or None, lot_id or None, loc_id or None, bin_id or None, Json(_to_jsonb(row))),
        )

    # MIBINH (bin movement history)
    for i, row in enumerate(data.get("MIBINH.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        loc_id = _v(row, "Location No.", "locId") or ""
        bin_id = _v(row, "Bin No.", "binId") or ""
        tran_date = _v(row, "Transaction Date", "tranDate", "tranDt") or ""
        entry = _v(row, "Entry", "entry") or ""
        cur.execute(
            """INSERT INTO staging.mibinh_raw (source_file, row_num, item_id, loc_id, bin_id, tran_date, entry, data) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, loc_id or None, bin_id or None, tran_date or None, entry or None, Json(_to_jsonb(row))),
        )

    # MILOGH
    for i, row in enumerate(data.get("MILOGH.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        loc_id = _v(row, "Location No.", "locId") or ""
        user_id = _v(row, "User", "userId") or ""
        tran_date = _v(row, "Transaction Date", "tranDate", "tranDt") or ""
        entry = _v(row, "Entry", "entry") or ""
        cur.execute(
            """INSERT INTO staging.milogh_raw (source_file, row_num, item_id, loc_id, user_id, tran_date, entry, data) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, loc_id or None, user_id or None, tran_date or None, entry or None, Json(_to_jsonb(row))),
        )

    # MILOGD (log detail)
    for i, row in enumerate(data.get("MILOGD.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        tran_date = _v(row, "Transaction Date", "tranDate", "tranDt") or ""
        entry = _v(row, "Entry", "entry") or ""
        detail = _v(row, "Detail", "detail") or ""
        cur.execute(
            """INSERT INTO staging.milogd_raw (source_file, row_num, item_id, tran_date, entry, detail, data) VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, tran_date or None, entry or None, detail or None, Json(_to_jsonb(row))),
        )

    # MILOGB (log bin breakdown)
    for i, row in enumerate(data.get("MILOGB.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        tran_date = _v(row, "Transaction Date", "tranDate", "tranDt") or ""
        entry = _v(row, "Entry", "entry") or ""
        detail = _v(row, "Detail", "detail") or ""
        cur.execute(
            """INSERT INTO staging.milogb_raw (source_file, row_num, item_id, tran_date, entry, detail, data) VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, tran_date or None, entry or None, detail or None, Json(_to_jsonb(row))),
        )

    # LotSerialHistory / MISLTH-style
    lot_hist = data.get("LotSerialHistory.json") or data.get("MISLHIST.json") or []
    for i, row in enumerate(lot_hist):
        prnt = _v(row, "Parent Item No.", "prntItemId", "Item No.", "itemId") or ""
        lot_id = _v(row, "Lot No.", "lotId", "SL No.") or ""
        user_id = _v(row, "User", "userId") or ""
        tran_date = _v(row, "Transaction Date", "tranDate", "tranDt") or ""
        entry = _v(row, "Entry", "entry") or ""
        detail = _v(row, "Detail", "detail") or ""
        cur.execute(
            """INSERT INTO staging.mislth_raw (source_file, row_num, prnt_item_id, lot_id, user_id, tran_date, entry, detail, data) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, prnt or None, lot_id or None, user_id or None, tran_date or None, entry or None, detail or None, Json(_to_jsonb(row))),
        )
    for i, row in enumerate(data.get("MISLHIST.json") or []):
        prnt = _v(row, "Parent Item No.", "prntItemId", "Item No.", "itemId") or ""
        lot_id = _v(row, "Lot No.", "lotId") or ""
        cur.execute(
            """INSERT INTO staging.mislhist_raw (source_file, row_num, prnt_item_id, lot_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, prnt or None, lot_id or None, Json(_to_jsonb(row))),
        )

    # MISLTD (LotSerialDetail)
    for i, row in enumerate(data.get("LotSerialDetail.json") or data.get("MISLTD.json") or []):
        prnt_item_id = _v(row, "Parent Item No.", "prntItemId", "Item No.", "itemId") or ""
        prnt_lot_id = _v(row, "Lot No.", "prntLotId", "lotId", "SL No.") or ""
        user_id = _v(row, "User", "userId") or ""
        tran_date = _v(row, "Transaction Date", "tranDate", "tranDt") or ""
        entry = _v(row, "Entry", "entry", "Serial No.") or ""
        detail = _v(row, "Detail", "detail") or ""
        cur.execute(
            """INSERT INTO staging.misltd_raw (source_file, row_num, prnt_item_id, prnt_lot_id, user_id, tran_date, entry, detail, data) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, prnt_item_id or None, prnt_lot_id or None, user_id or None, tran_date or None, entry or None, detail or None, Json(_to_jsonb(row))),
        )

    # MISLNH, MISLND
    for i, row in enumerate(data.get("MISLNH.json") or []):
        prnt = _v(row, "Parent Item No.", "prntItemId", "Item No.", "itemId") or ""
        lot_id = _v(row, "Lot No.", "lotId") or ""
        cur.execute(
            """INSERT INTO staging.mislnh_raw (source_file, row_num, prnt_item_id, lot_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, prnt or None, lot_id or None, Json(_to_jsonb(row))),
        )
    for i, row in enumerate(data.get("MISLND.json") or []):
        prnt = _v(row, "Parent Item No.", "prntItemId", "Item No.", "itemId") or ""
        lot_id = _v(row, "Lot No.", "lotId") or ""
        cur.execute(
            """INSERT INTO staging.mislnd_raw (source_file, row_num, prnt_item_id, lot_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, prnt or None, lot_id or None, Json(_to_jsonb(row))),
        )

    # MIBOMH, MIBOMD
    for i, row in enumerate(data.get("MIBOMH.json") or data.get("BillsOfMaterial.json") or []):
        bom_id = _v(row, "BOM Item", "bomItem", "Parent Item No.") or _v(row, "Revision No.", "bomRev") or str(i)
        parent = _v(row, "Parent Item No.", "BOM Item", "bomItem") or ""
        cur.execute(
            """INSERT INTO staging.mibomh_raw (source_file, row_num, bom_id, parent_item_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, bom_id or None, parent or None, Json(_to_jsonb(row))),
        )
    for i, row in enumerate(data.get("MIBOMD.json") or data.get("BillOfMaterialDetails.json") or []):
        bom_id = _v(row, "Parent Item No.", "BOM Item", "bomItem") or ""
        part_id = _v(row, "Component Item No.", "partId", "Part Id") or ""
        cur.execute(
            """INSERT INTO staging.mibomd_raw (source_file, row_num, bom_id, part_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, bom_id or None, part_id or None, Json(_to_jsonb(row))),
        )

    # MIMOH, MIMOMD
    for i, row in enumerate(data.get("MIMOH.json") or data.get("ManufacturingOrderHeaders.json") or []):
        moh_id = _v(row, "Mfg. Order No.", "mohId") or ""
        build = _v(row, "Build Item No.", "buildItem", "Item No.") or ""
        loc_id = _v(row, "Location No.", "locId") or ""
        cur.execute(
            """INSERT INTO staging.mimoh_raw (source_file, row_num, moh_id, build_item_id, loc_id, data) VALUES (%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, moh_id or None, build or None, loc_id or None, Json(_to_jsonb(row))),
        )
    for i, row in enumerate(data.get("MIMOMD.json") or data.get("ManufacturingOrderDetails.json") or []):
        moh_id = _v(row, "Mfg. Order No.", "mohId") or ""
        part_id = _v(row, "Component Item No.", "partId", "Item No.") or ""
        cur.execute(
            """INSERT INTO staging.mimomd_raw (source_file, row_num, moh_id, part_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, moh_id or None, part_id or None, Json(_to_jsonb(row))),
        )

    # MIPOH, MIPOD
    for i, row in enumerate(data.get("MIPOH.json") or data.get("PurchaseOrders.json") or []):
        poh_id = _v(row, "PO No.", "pohId", "poNo") or ""
        poh_rev = str(_v(row, "Revision", "poRev", "PO Rev") or "0")
        supl_id = _v(row, "Supplier No.", "suplId", "Name", "Vendor") or ""
        cur.execute(
            """INSERT INTO staging.mipoh_raw (source_file, row_num, poh_id, poh_rev, supl_id, data) VALUES (%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, poh_id or None, poh_rev or None, supl_id or None, Json(_to_jsonb(row))),
        )
    for i, row in enumerate(data.get("MIPOD.json") or data.get("PurchaseOrderDetails.json") or []):
        poh_id = _v(row, "PO No.", "pohId") or ""
        poh_rev = str(_v(row, "Revision", "poRev") or "0")
        pod_id = _v(row, "Line", "podId", "Line No.") or ""
        item_id = _v(row, "Item No.", "itemId", "Component Item No.") or ""
        cur.execute(
            """INSERT INTO staging.mipod_raw (source_file, row_num, poh_id, poh_rev, pod_id, item_id, data) VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, poh_id or None, poh_rev or None, pod_id or None, item_id or None, Json(_to_jsonb(row))),
        )

    # MIPOHX (PO extensions)
    for i, row in enumerate(data.get("MIPOHX.json") or data.get("PurchaseOrderExtensions.json") or []):
        poh_id = _v(row, "PO No.", "pohId", "poNo") or ""
        poh_rev = str(_v(row, "Revision", "poRev", "PO Rev") or "0")
        cur.execute(
            """INSERT INTO staging.mipohx_raw (source_file, row_num, poh_id, poh_rev, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, poh_id or None, poh_rev or None, Json(_to_jsonb(row))),
        )

    # MISUPL
    for i, row in enumerate(data.get("MISUPL.json") or []):
        supl_id = _v(row, "Supplier No.", "suplId") or ""
        cur.execute(
            """INSERT INTO staging.misupl_raw (source_file, row_num, supl_id, data) VALUES (%s,%s,%s,%s)""",
            (source_file_default, i + 1, supl_id or None, Json(_to_jsonb(row))),
        )

    # MIQSUP (supplier–item links)
    for i, row in enumerate(data.get("MIQSUP.json") or []):
        supl_id = _v(row, "Supplier No.", "suplId") or ""
        item_id = _v(row, "Item No.", "itemId") or ""
        cur.execute(
            """INSERT INTO staging.miqsup_raw (source_file, row_num, supl_id, item_id, data) VALUES (%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, supl_id or None, item_id or None, Json(_to_jsonb(row))),
        )

    # MIICST
    for i, row in enumerate(data.get("MIICST.json") or []):
        item_id = _v(row, "Item No.", "itemId") or ""
        loc_id = _v(row, "Location No.", "locId") or ""
        trans_date = _v(row, "Transaction Date", "transDate", "transDt") or ""
        seq_no = _v(row, "Seq No.", "seqNo") or ""
        cur.execute(
            """INSERT INTO staging.miicst_raw (source_file, row_num, item_id, loc_id, trans_date, seq_no, data) VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (source_file_default, i + 1, item_id or None, loc_id or None, trans_date or None, seq_no or None, Json(_to_jsonb(row))),
        )

    # MIUSER
    for i, row in enumerate(data.get("MIUSER.json") or []):
        user_id = _v(row, "User", "userId") or ""
        cur.execute(
            """INSERT INTO staging.miuser_raw (source_file, row_num, user_id, data) VALUES (%s,%s,%s,%s)""",
            (source_file_default, i + 1, user_id or None, Json(_to_jsonb(row))),
        )

    conn.commit()
    cur.close()


def _to_jsonb(obj):
    """Convert to JSON-serializable dict for JSONB."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return {str(k): _to_jsonb(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonb(x) for x in obj]
    if isinstance(obj, (Decimal, datetime)):
        return str(obj)
    return obj


def upsert_core(conn, base_currency: str = "CAD") -> None:
    """
    Upsert from staging into core in dependency order.
    Assumes staging is already populated (e.g. by load_staging).
    """
    cur = conn.cursor()

    # 1) Users
    cur.execute("""
        INSERT INTO core.users (user_id, display_name, email, is_active, raw)
        SELECT user_id, COALESCE(data->>'displayName', data->>'Name', data->>'userName'), data->>'email',
               (data->>'isActive')::text NOT IN ('0','false','False','N','No')
             , data
        FROM staging.miuser_raw
        WHERE user_id IS NOT NULL AND user_id <> ''
        ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email,
            is_active = EXCLUDED.is_active, raw = EXCLUDED.raw, updated_at = NOW()
    """)

    # 2) Items
    cur.execute("""
        INSERT INTO core.items (item_id, descr, uom, status, item_cost, raw)
        SELECT item_id,
               COALESCE(data->>'Description', data->>'descr'),
               COALESCE(data->>'Stocking Units', data->>'uOfM'),
               COALESCE(data->>'Status', data->>'status'),
               (NULLIF(TRIM(COALESCE(data->>'Unit Cost', data->>'itemCost', '')), '')::numeric),
               data
        FROM staging.miitem_raw
        WHERE item_id IS NOT NULL AND item_id <> ''
        ON CONFLICT (item_id) DO UPDATE SET descr = EXCLUDED.descr, uom = EXCLUDED.uom, status = EXCLUDED.status,
            item_cost = EXCLUDED.item_cost, raw = EXCLUDED.raw, updated_at = NOW()
    """)

    # 3) Item notes, alternates
    cur.execute("""
        INSERT INTO core.item_notes (item_id, notes, doc_path, pic_path, raw)
        SELECT item_id, data->>'Notes', data->>'Document Path', data->>'Picture Path', data
        FROM staging.miitemx_raw
        WHERE item_id IS NOT NULL AND item_id <> ''
        ON CONFLICT (item_id) DO UPDATE SET notes = EXCLUDED.notes, doc_path = EXCLUDED.doc_path,
            pic_path = EXCLUDED.pic_path, raw = EXCLUDED.raw, updated_at = NOW()
    """)
    cur.execute("""
        INSERT INTO core.item_alternates (item_id, alt_item_id, relation, raw)
        SELECT item_id, alt_item_id, data->>'relation', data
        FROM staging.miitema_raw
        WHERE item_id IS NOT NULL AND item_id <> '' AND alt_item_id IS NOT NULL AND alt_item_id <> ''
        ON CONFLICT (item_id, alt_item_id) DO UPDATE SET relation = EXCLUDED.relation, raw = EXCLUDED.raw
    """)

    # 4) Inventory by location (only for items that exist in core.items)
    cur.execute("""
        INSERT INTO core.inventory_by_location (item_id, loc_id, qty_on_hand, qty_reserved, qty_on_order, raw)
        SELECT r.item_id, r.loc_id,
               (NULLIF(TRIM(COALESCE(r.data->>'On Hand', r.data->>'qStk', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(r.data->>'Reserve', r.data->>'qRes', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(r.data->>'On Order', r.data->>'qOrd', '')), '')::numeric),
               r.data
        FROM staging.miilocqt_raw r
        WHERE r.item_id IS NOT NULL AND r.item_id <> '' AND EXISTS (SELECT 1 FROM core.items i WHERE i.item_id = r.item_id)
        ON CONFLICT (item_id, loc_id) DO UPDATE SET qty_on_hand = EXCLUDED.qty_on_hand, qty_reserved = EXCLUDED.qty_reserved,
            qty_on_order = EXCLUDED.qty_on_order, raw = EXCLUDED.raw
    """)

    # 5) Inventory by bin
    cur.execute("""
        INSERT INTO core.inventory_by_bin (item_id, loc_id, bin_id, qty_on_hand, raw)
        SELECT r.item_id, r.loc_id, r.bin_id,
               (NULLIF(TRIM(COALESCE(r.data->>'On Hand', r.data->>'qStk', '')), '')::numeric),
               r.data
        FROM staging.mibinq_raw r
        WHERE r.item_id IS NOT NULL AND r.item_id <> '' AND r.loc_id IS NOT NULL AND r.bin_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM core.items i WHERE i.item_id = r.item_id)
        ON CONFLICT (item_id, loc_id, bin_id) DO UPDATE SET qty_on_hand = EXCLUDED.qty_on_hand, raw = EXCLUDED.raw
    """)

    # 6) Inventory txn header/lines from MILOGH (simplified: one header per row)
    cur.execute("""
        INSERT INTO core.inventory_txn_header (tran_date, entry, loc_id, user_id, txn_type, comment, raw)
        SELECT (NULLIF(TRIM(COALESCE(r.data->>'Transaction Date', r.data->>'tranDate', r.data->>'tranDt', '')), '')::date),
               r.entry, r.loc_id, r.user_id, r.data->>'Type', r.data->>'Comment', r.data
        FROM staging.milogh_raw r
        WHERE r.tran_date IS NOT NULL AND r.entry IS NOT NULL
        ON CONFLICT (tran_date, entry) DO UPDATE SET loc_id = EXCLUDED.loc_id, user_id = EXCLUDED.user_id, txn_type = EXCLUDED.txn_type, comment = EXCLUDED.comment, raw = EXCLUDED.raw
    """)
    # 6b) Inventory txn lines from MILOGD
    cur.execute("""
        INSERT INTO core.inventory_txn_line (tran_date, entry, detail, item_id, qty, uom, loc_id, raw)
        SELECT (NULLIF(TRIM(COALESCE(r.data->>'Transaction Date', r.data->>'tranDate', r.data->>'tranDt', r.tran_date, '')), '')::date),
               r.entry, r.detail, r.item_id,
               (NULLIF(TRIM(COALESCE(r.data->>'Quantity', r.data->>'qty', '')), '')::numeric),
               r.data->>'UOM', r.data->>'Location No.', r.data
        FROM staging.milogd_raw r
        WHERE r.tran_date IS NOT NULL AND r.entry IS NOT NULL
    """)
    # 6c) Inventory txn breakdown from MILOGB
    cur.execute("""
        INSERT INTO core.inventory_txn_breakdown (tran_date, entry, detail, item_id, loc_id, bin_id, lot_id, qty, raw)
        SELECT (NULLIF(TRIM(COALESCE(r.data->>'Transaction Date', r.data->>'tranDate', r.data->>'tranDt', r.tran_date, '')), '')::date),
               r.entry, r.detail, r.item_id, r.data->>'Location No.', r.data->>'Bin No.', r.data->>'Lot No.',
               (NULLIF(TRIM(COALESCE(r.data->>'Quantity', r.data->>'qty', '')), '')::numeric), r.data
        FROM staging.milogb_raw r
        WHERE r.tran_date IS NOT NULL AND r.entry IS NOT NULL
    """)

    # 7) Lots from MISLHIST (minimal: lot_id, prnt_item_id)
    cur.execute("""
        INSERT INTO core.lots (lot_id, prnt_item_id, raw_master)
        SELECT DISTINCT lot_id, prnt_item_id, data
        FROM staging.mislhist_raw
        WHERE lot_id IS NOT NULL AND lot_id <> ''
        ON CONFLICT (lot_id) DO UPDATE SET prnt_item_id = EXCLUDED.prnt_item_id, raw_master = EXCLUDED.raw_master, updated_at = NOW()
    """)

    # 8) Lot movements from MISLTH
    cur.execute("""
        INSERT INTO core.lot_movements (prnt_lot_id, prnt_item_id, tran_date, user_id, entry, detail, loc_id, qty_in, qty_out, raw_header)
        SELECT lot_id, prnt_item_id,
               (NULLIF(TRIM(COALESCE(data->>'Transaction Date', data->>'tranDate', '')), '')::date),
               user_id, entry, detail, data->>'Location No.',
               (NULLIF(TRIM(COALESCE(data->>'Quantity', data->>'qty', '')), '')::numeric),
               NULL, data
        FROM staging.mislth_raw
        WHERE lot_id IS NOT NULL AND lot_id <> ''
    """)
    # 8b) Lots: set created_date, created_by from earliest lot_movement; balance_qty from sum(qty_in) - sum(qty_out)
    cur.execute("""
        WITH first_move AS (
            SELECT prnt_lot_id, MIN(tran_date) AS first_date, (array_agg(user_id ORDER BY tran_date))[1] AS first_user
            FROM core.lot_movements WHERE prnt_lot_id IS NOT NULL AND prnt_lot_id <> '' GROUP BY prnt_lot_id
        ),
        balances AS (
            SELECT prnt_lot_id, COALESCE(SUM(qty_in), 0) - COALESCE(SUM(qty_out), 0) AS bal
            FROM core.lot_movements WHERE prnt_lot_id IS NOT NULL AND prnt_lot_id <> '' GROUP BY prnt_lot_id
        )
        UPDATE core.lots l SET
            created_date = fm.first_date,
            created_by = fm.first_user,
            balance_qty = b.bal,
            updated_at = NOW()
        FROM first_move fm
        JOIN balances b ON b.prnt_lot_id = l.lot_id
        WHERE l.lot_id = fm.prnt_lot_id
    """)

    # 9) BOMs
    cur.execute("""
        INSERT INTO core.boms (bom_id, parent_item_id, revision, is_active, raw)
        SELECT bom_id, parent_item_id, data->>'Revision No.', (data->>'isActive')::text NOT IN ('0','false'), data
        FROM staging.mibomh_raw
        WHERE bom_id IS NOT NULL AND bom_id <> ''
        ON CONFLICT (bom_id) DO UPDATE SET parent_item_id = EXCLUDED.parent_item_id, revision = EXCLUDED.revision, raw = EXCLUDED.raw, updated_at = NOW()
    """)
    cur.execute("""
        INSERT INTO core.bom_components (bom_id, line_no, part_id, qty_per, uom, raw)
        SELECT bom_id, COALESCE((data->>'Line')::int, (data->>'lineNbr')::int, 0), part_id,
               (NULLIF(TRIM(COALESCE(data->>'Required Quantity', data->>'qty', data->>'Qty Per', '')), '')::numeric),
               data->>'Stocking Units', data
        FROM staging.mibomd_raw
        WHERE bom_id IS NOT NULL AND part_id IS NOT NULL AND part_id <> ''
          AND EXISTS (SELECT 1 FROM core.boms b WHERE b.bom_id = staging.mibomd_raw.bom_id)
        ON CONFLICT (bom_id, part_id, line_no) DO UPDATE SET qty_per = EXCLUDED.qty_per, raw = EXCLUDED.raw
    """)

    # 10) Manufacturing orders
    cur.execute("""
        INSERT INTO core.manufacturing_orders (moh_id, build_item_id, loc_id, status, qty_planned, qty_completed, created_date, released_date, created_by, released_by, raw)
        SELECT moh_id, build_item_id, loc_id, data->>'Status',
               (NULLIF(TRIM(COALESCE(data->>'Ordered', data->>'ordQty', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(data->>'Completed', data->>'endQty', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(data->>'Order Date', data->>'ordDt', '')), '')::date),
               (NULLIF(TRIM(COALESCE(data->>'Release Date', data->>'releaseDt', '')), '')::date),
               data->>'createdBy', data->>'releasedBy', data
        FROM staging.mimoh_raw
        WHERE moh_id IS NOT NULL AND moh_id <> ''
        ON CONFLICT (moh_id) DO UPDATE SET build_item_id = EXCLUDED.build_item_id, loc_id = EXCLUDED.loc_id, status = EXCLUDED.status,
            qty_planned = EXCLUDED.qty_planned, qty_completed = EXCLUDED.qty_completed, raw = EXCLUDED.raw, updated_at = NOW()
    """)
    cur.execute("""
        INSERT INTO core.mo_materials (moh_id, line_no, part_id, qty_required, qty_issued, uom, raw)
        SELECT moh_id, COALESCE((data->>'Line')::int, 0), part_id,
               (NULLIF(TRIM(COALESCE(data->>'Required Quantity', data->>'reqQty', data->>'qty', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(data->>'relQty', data->>'Released', '')), '')::numeric),
               data->>'Stocking Units', data
        FROM staging.mimomd_raw
        WHERE moh_id IS NOT NULL AND part_id IS NOT NULL AND part_id <> ''
          AND EXISTS (SELECT 1 FROM core.manufacturing_orders m WHERE m.moh_id = staging.mimomd_raw.moh_id)
        ON CONFLICT (moh_id, part_id, line_no) DO UPDATE SET qty_required = EXCLUDED.qty_required, raw = EXCLUDED.raw
    """)

    # 11) Suppliers
    cur.execute("""
        INSERT INTO core.suppliers (supl_id, name, phone, email, address, raw)
        SELECT supl_id, COALESCE(data->>'Name', data->>'name'), data->>'Phone', data->>'Email',
               TRIM(COALESCE(data->>'Address 1', '') || ' ' || COALESCE(data->>'City', '') || ' ' || COALESCE(data->>'State', '')),
               data
        FROM staging.misupl_raw
        WHERE supl_id IS NOT NULL AND supl_id <> ''
        ON CONFLICT (supl_id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, raw = EXCLUDED.raw, updated_at = NOW()
    """)
    # 11b) Supplier–item links from MIQSUP
    cur.execute("""
        INSERT INTO core.supplier_items (supl_id, item_id, status, raw)
        SELECT supl_id, item_id, data->>'Status', data
        FROM staging.miqsup_raw
        WHERE supl_id IS NOT NULL AND supl_id <> '' AND item_id IS NOT NULL AND item_id <> ''
          AND EXISTS (SELECT 1 FROM core.suppliers s WHERE s.supl_id = staging.miqsup_raw.supl_id)
          AND EXISTS (SELECT 1 FROM core.items i WHERE i.item_id = staging.miqsup_raw.item_id)
        ON CONFLICT (supl_id, item_id) DO UPDATE SET status = EXCLUDED.status, raw = EXCLUDED.raw
    """)

    # 12) Purchase orders
    cur.execute("""
        INSERT INTO core.purchase_orders (poh_id, poh_rev, supl_id, status, order_date, promised_date, buyer, currency_code, raw_header)
        SELECT poh_id, poh_rev, supl_id, data->>'Status',
               (NULLIF(TRIM(COALESCE(data->>'Order Date', data->>'ordDt', '')), '')::date),
               (NULLIF(TRIM(COALESCE(data->>'Required Date', data->>'promisedDate', '')), '')::date),
               data->>'Buyer', COALESCE(NULLIF(TRIM(data->>'Home Currency'), ''), NULLIF(TRIM(data->>'Source Currency'), ''), %s),
               data
        FROM staging.mipoh_raw
        WHERE poh_id IS NOT NULL AND poh_id <> ''
        ON CONFLICT (poh_id, poh_rev) DO UPDATE SET supl_id = EXCLUDED.supl_id, status = EXCLUDED.status, order_date = EXCLUDED.order_date, raw_header = EXCLUDED.raw_header, updated_at = NOW()
    """, (base_currency,))
    # 12b) PO extensions (raw_ext) from MIPOHX
    cur.execute("""
        UPDATE core.purchase_orders po SET raw_ext = x.data, updated_at = NOW()
        FROM staging.mipohx_raw x
        WHERE po.poh_id = x.poh_id AND po.poh_rev = x.poh_rev
    """)
    cur.execute("""
        WITH numbered AS (
            SELECT poh_id, poh_rev, pod_id, item_id, data,
                   ROW_NUMBER() OVER (PARTITION BY poh_id, poh_rev ORDER BY id) AS rn
            FROM staging.mipod_raw
            WHERE poh_id IS NOT NULL AND poh_id <> ''
        )
        INSERT INTO core.purchase_order_lines (poh_id, poh_rev, pod_id, line_no, item_id, descr, uom, qty_ordered, qty_received, unit_cost, ext_cost, raw)
        SELECT n.poh_id, n.poh_rev, n.pod_id, n.rn, n.item_id, n.data->>'Description', n.data->>'Stocking Units',
               (NULLIF(TRIM(COALESCE(n.data->>'Ordered Qty', n.data->>'Ordered', n.data->>'Quantity', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(n.data->>'Received Qty', n.data->>'Received', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(n.data->>'Unit Price', n.data->>'Cost', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(n.data->>'Extended Price', '')), '')::numeric), n.data
        FROM numbered n
        WHERE EXISTS (SELECT 1 FROM core.purchase_orders p WHERE p.poh_id = n.poh_id AND p.poh_rev = n.poh_rev)
        ON CONFLICT (poh_id, poh_rev, line_no) DO UPDATE SET item_id = EXCLUDED.item_id, qty_ordered = EXCLUDED.qty_ordered, qty_received = EXCLUDED.qty_received, unit_cost = EXCLUDED.unit_cost, raw = EXCLUDED.raw
    """)

    # 13) Item cost history
    cur.execute("""
        INSERT INTO core.item_cost_history (item_id, loc_id, trans_date, seq_no, qty_received, qty_issued, unit_cost, ext_cost, currency_code, raw)
        SELECT item_id, COALESCE(loc_id, ''), (NULLIF(TRIM(trans_date), '')::date), COALESCE(seq_no, ''),
               (NULLIF(TRIM(COALESCE(data->>'Qty Received', data->>'qRecd', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(data->>'Qty Used', data->>'qUsed', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(data->>'Cost', data->>'cost', '')), '')::numeric),
               (NULLIF(TRIM(COALESCE(data->>'Extended Cost', data->>'extCost', '')), '')::numeric),
               COALESCE(NULLIF(TRIM(data->>'currencyCode'), ''), %s), data
        FROM staging.miicst_raw
        WHERE item_id IS NOT NULL AND item_id <> ''
          AND EXISTS (SELECT 1 FROM core.items i WHERE i.item_id = staging.miicst_raw.item_id)
        ON CONFLICT (item_id, loc_id, trans_date, seq_no) DO UPDATE SET qty_received = EXCLUDED.qty_received, unit_cost = EXCLUDED.unit_cost, raw = EXCLUDED.raw
    """, (base_currency,))

    conn.commit()
    cur.close()


def main():
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("Set DATABASE_URL", file=sys.stderr)
        sys.exit(1)

    folder = None
    for i, arg in enumerate(sys.argv[1:] or []):
        if arg == "--folder" and i + 2 < len(sys.argv):
            folder = sys.argv[i + 2]
            break
        if not arg.startswith("-"):
            folder = arg
            break
    if not folder or not os.path.isdir(folder):
        print("Usage: python -m db.etl_full_company_to_postgres /path/to/full/company/data/folder", file=sys.stderr)
        sys.exit(1)

    data, err = load_from_folder(folder)
    if err or not data:
        print("Load failed:", err or "no data", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(url)
    try:
        load_staging(conn, data, source_file_default="full_company_export")
        upsert_core(conn)
        print("ETL done: staging + core updated for all sections.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
