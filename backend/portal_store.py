"""
Portal store: persisted mutations (MOs, inventory adjustments, transfers, item overrides, BOM edits).
Merged into get_all_data so the app sees portal-originated data. File-based JSON; safe for Render (ephemeral) and local.
"""
import os
import json
from datetime import datetime
from threading import Lock

_lock = Lock()
_store_path = os.path.join(os.path.dirname(__file__), "data", "portal_store.json")

def _ensure_dir():
    d = os.path.dirname(_store_path)
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)

def _default_store():
    return {
        "created_mos": [],
        "mo_updates": [],
        "inventory_adjustments": [],
        "location_transfers": [],
        "item_overrides": {},
        "bom_edits": {"MIBOMH.json": [], "MIBOMD.json": [], "BillsOfMaterial.json": [], "BillOfMaterialDetails.json": []},
        "created_pos": [],
        "created_po_details": [],
        "po_receives": [],
        "mo_completion_lots": [],
        "wo_updates": [],
    }

def load():
    with _lock:
        _ensure_dir()
        if not os.path.isfile(_store_path):
            return _default_store()
        try:
            with open(_store_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for key in _default_store():
                if key not in data:
                    data[key] = _default_store()[key]
            return data
        except Exception as e:
            print(f"[portal_store] load error: {e}")
            return _default_store()

def save(store):
    with _lock:
        _ensure_dir()
        try:
            with open(_store_path, "w", encoding="utf-8") as f:
                json.dump(store, f, indent=2)
        except Exception as e:
            print(f"[portal_store] save error: {e}")

def get_created_mos():
    return load().get("created_mos", [])

def add_created_mo(mo_record):
    s = load()
    s.setdefault("created_mos", []).append(mo_record)
    save(s)

def get_mo_updates():
    return load().get("mo_updates", [])

def add_mo_update(mo_no, status=None, completed=None, release_date=None, completion_date=None):
    s = load()
    updates = s.get("mo_updates", [])
    existing = next((u for u in updates if u.get("mo_no") == mo_no), None)
    if existing:
        if status is not None:
            existing["status"] = status
        if completed is not None:
            existing["Completed"] = completed
        if release_date is not None:
            existing["Release Date"] = release_date
        if completion_date is not None:
            existing["Completion Date"] = completion_date
    else:
        updates.append({
            "mo_no": mo_no,
            "status": status,
            "Completed": completed,
            "Release Date": release_date or "",
            "Completion Date": completion_date or "",
        })
    s["mo_updates"] = updates
    save(s)

def get_inventory_adjustments():
    return load().get("inventory_adjustments", [])

def add_inventory_adjustment(item_no, location, delta, reason=""):
    s = load()
    s.setdefault("inventory_adjustments", []).append({
        "item_no": item_no,
        "location": location or "",
        "delta": float(delta),
        "reason": reason or "",
        "at": datetime.utcnow().isoformat() + "Z",
    })
    save(s)

def get_location_transfers():
    return load().get("location_transfers", [])

def add_location_transfer(from_loc, to_loc, item_no, qty):
    s = load()
    s.setdefault("location_transfers", []).append({
        "from_loc": from_loc,
        "to_loc": to_loc,
        "item_no": item_no,
        "qty": float(qty),
        "at": datetime.utcnow().isoformat() + "Z",
    })
    save(s)

def get_item_overrides():
    return load().get("item_overrides", {})

def set_item_override(item_no, minimum=None, maximum=None, reorder_level=None, reorder_quantity=None):
    s = load()
    ov = s.setdefault("item_overrides", {}).setdefault(item_no, {})
    if minimum is not None:
        ov["Minimum"] = minimum
    if maximum is not None:
        ov["Maximum"] = maximum
    if reorder_level is not None:
        ov["Reorder Level"] = reorder_level
    if reorder_quantity is not None:
        ov["Reorder Quantity"] = reorder_quantity
    save(s)

def get_bom_edits():
    return load().get("bom_edits", _default_store()["bom_edits"])

def add_bom_header(header_record):
    s = load()
    s.setdefault("bom_edits", _default_store()["bom_edits"])["MIBOMH.json"].append(header_record)
    s["bom_edits"]["BillsOfMaterial.json"].append(header_record)
    save(s)

def add_bom_detail(detail_record):
    s = load()
    s.setdefault("bom_edits", _default_store()["bom_edits"])["MIBOMD.json"].append(detail_record)
    s["bom_edits"]["BillOfMaterialDetails.json"].append(detail_record)
    save(s)

def get_created_pos():
    return load().get("created_pos", [])

def add_created_po(header_record):
    s = load()
    s.setdefault("created_pos", []).append(header_record)
    save(s)

def get_created_po_details():
    return load().get("created_po_details", [])

def add_created_po_detail(detail_record):
    s = load()
    s.setdefault("created_po_details", []).append(detail_record)
    save(s)

def get_po_receives():
    return load().get("po_receives", [])

def add_po_receive(po_no, item_no, qty, location="", lot=""):
    s = load()
    s.setdefault("po_receives", []).append({
        "po_no": po_no,
        "item_no": item_no,
        "qty": float(qty),
        "location": location or "",
        "lot": lot or "",
        "at": datetime.utcnow().isoformat() + "Z",
    })
    save(s)

def get_mo_completion_lots():
    return load().get("mo_completion_lots", [])

def add_mo_completion_lot(mo_no, item_no, qty, lot=""):
    s = load()
    s.setdefault("mo_completion_lots", []).append({
        "mo_no": mo_no,
        "item_no": item_no,
        "qty": float(qty),
        "lot": lot or "",
        "at": datetime.utcnow().isoformat() + "Z",
    })
    save(s)

def get_wo_updates():
    return load().get("wo_updates", [])

def add_wo_update(wo_no, status=None, release_date=None, completed=None, completion_date=None, scrap=None):
    s = load()
    updates = s.get("wo_updates", [])
    existing = next((u for u in updates if u.get("wo_no") == wo_no), None)
    if existing:
        if status is not None:
            existing["status"] = status
        if release_date is not None:
            existing["Release Date"] = release_date
        if completed is not None:
            existing["Completed"] = completed
        if completion_date is not None:
            existing["Completion Date"] = completion_date
        if scrap is not None:
            existing["Scrap"] = scrap
    else:
        updates.append({
            "wo_no": wo_no,
            "status": status,
            "Release Date": release_date or "",
            "Completed": completed,
            "Completion Date": completion_date or "",
            "Scrap": scrap,
        })
    s["wo_updates"] = updates
    save(s)

def apply_to_data(data):
    """Apply portal store to raw data dict. Mutates data in place."""
    if not data:
        return data
    store = load()

    # Item overrides (B4: min/max/reorder)
    overrides = store.get("item_overrides") or {}
    for item in (data.get("CustomAlert5.json") or []):
        if not isinstance(item, dict):
            continue
        ino = item.get("Item No.") or item.get("item_no")
        if ino and ino in overrides:
            for k, v in overrides[ino].items():
                item[k] = v

    # Inventory adjustments (B5): apply deltas to Stock
    adjustments = store.get("inventory_adjustments") or []
    for adj in adjustments:
        ino = adj.get("item_no")
        loc = adj.get("location") or ""
        delta = float(adj.get("delta", 0))
        if not ino:
            continue
        # Apply to CustomAlert5 (aggregate Stock)
        for item in (data.get("CustomAlert5.json") or []):
            if not isinstance(item, dict):
                continue
            if (item.get("Item No.") or item.get("item_no")) == ino:
                try:
                    item["Stock"] = float(item.get("Stock") or 0) + delta
                except (TypeError, ValueError):
                    item["Stock"] = delta
                break
        # Apply to MIILOC if present (by location)
        for row in (data.get("MIILOC.json") or []):
            if not isinstance(row, dict):
                continue
            if (row.get("Item No.") or row.get("Item No") or row.get("itemId")) == ino and (row.get("Location No.") or row.get("locId") or "") == loc:
                try:
                    row["qStk"] = float(row.get("qStk") or row.get("Stock") or 0) + delta
                except (TypeError, ValueError):
                    row["qStk"] = delta
                if "Stock" in row:
                    row["Stock"] = row["qStk"]
                break

    # Location transfers (B6): move qty from one loc to another in MIILOC
    transfers = store.get("location_transfers") or []
    for t in transfers:
        from_loc = t.get("from_loc") or ""
        to_loc = t.get("to_loc") or ""
        ino = t.get("item_no")
        qty = float(t.get("qty", 0))
        if not ino or not qty:
            continue
        miloc = data.get("MIILOC.json") or []
        from_row = to_row = None
        for r in miloc:
            if not isinstance(r, dict):
                continue
            it = r.get("Item No.") or r.get("Item No") or r.get("itemId")
            loc = r.get("Location No.") or r.get("locId") or ""
            if it == ino and loc == from_loc:
                from_row = r
            if it == ino and loc == to_loc:
                to_row = r
        if from_row is not None:
            cur = float(from_row.get("qStk") or from_row.get("Stock") or 0)
            from_row["qStk"] = max(0, cur - qty)
            if "Stock" in from_row:
                from_row["Stock"] = from_row["qStk"]
        if to_row is not None:
            cur = float(to_row.get("qStk") or to_row.get("Stock") or 0)
            to_row["qStk"] = cur + qty
            if "Stock" in to_row:
                to_row["Stock"] = to_row["qStk"]

    # BOM edits (C5): append portal-created BOMs
    bom_edits = store.get("bom_edits") or _default_store()["bom_edits"]
    for key in ["MIBOMH.json", "MIBOMD.json", "BillsOfMaterial.json", "BillOfMaterialDetails.json"]:
        existing = data.get(key)
        if not isinstance(existing, list):
            existing = []
        extra = bom_edits.get(key, [])
        data[key] = list(existing) + list(extra)

    # Created MOs (D3): merge portal-created MOs
    created = store.get("created_mos") or []
    existing_mo = data.get("ManufacturingOrderHeaders.json") or []
    if not isinstance(existing_mo, list):
        existing_mo = []
    all_mos = list(existing_mo) + list(created)
    # Apply MO updates (release/complete status)
    mo_updates = store.get("mo_updates") or []
    for upd in mo_updates:
        mo_no = upd.get("mo_no")
        if not mo_no:
            continue
        for mo in all_mos:
            if not isinstance(mo, dict):
                continue
            if (mo.get("Mfg. Order No.") or mo.get("mohId")) == mo_no:
                if "status" in upd and upd["status"] is not None:
                    mo["Status"] = upd["status"]
                if "Completed" in upd and upd["Completed"] is not None:
                    mo["Completed"] = upd["Completed"]
                if upd.get("Release Date") is not None:
                    mo["Release Date"] = upd.get("Release Date") or ""
                if upd.get("Completion Date") is not None:
                    mo["Completion Date"] = upd.get("Completion Date") or ""
                break
    data["ManufacturingOrderHeaders.json"] = all_mos

    # Created POs (F2): merge into PurchaseOrders.json and PurchaseOrderDetails.json
    created_pos = store.get("created_pos") or []
    existing_po_h = data.get("PurchaseOrders.json") or []
    if not isinstance(existing_po_h, list):
        existing_po_h = []
    data["PurchaseOrders.json"] = list(existing_po_h) + list(created_pos)

    created_po_d = store.get("created_po_details") or []
    existing_po_d = data.get("PurchaseOrderDetails.json") or []
    if not isinstance(existing_po_d, list):
        existing_po_d = []
    all_po_details = list(existing_po_d) + list(created_po_d)

    # F4: Apply PO receives – add qty to Received on matching lines
    for rec in store.get("po_receives") or []:
        po_no = rec.get("po_no")
        item_no = rec.get("item_no")
        qty = float(rec.get("qty", 0))
        if not po_no or not item_no or qty <= 0:
            continue
        for line in all_po_details:
            if not isinstance(line, dict):
                continue
            ln_po = line.get("PO No.") or line.get("Purchase Order No")
            ln_item = line.get("Item No.") or line.get("Item No")
            if ln_po == po_no and ln_item == item_no:
                cur = float(line.get("Received") or 0)
                line["Received"] = cur + qty
                break
        # Inventory already updated via add_inventory_adjustment when receive was recorded
    data["PurchaseOrderDetails.json"] = all_po_details

    # WO updates (E2/E3): apply release/complete to WorkOrders.json and WorkOrderDetails.json
    wo_updates = store.get("wo_updates") or []
    all_wo = data.get("WorkOrders.json") or []
    if not isinstance(all_wo, list):
        all_wo = []
    for upd in wo_updates:
        wo_no = upd.get("wo_no")
        if not wo_no:
            continue
        for wo in all_wo:
            if not isinstance(wo, dict):
                continue
            if (wo.get("Work Order No.") or wo.get("Job No.") or "").strip() != wo_no:
                continue
            if upd.get("status") is not None:
                wo["Status"] = upd["status"]
            if upd.get("Release Date") is not None:
                wo["Release Date"] = upd["Release Date"] or ""
            if upd.get("Completed") is not None:
                wo["Completed"] = upd["Completed"]
            if upd.get("Completion Date") is not None:
                wo["Completion Date"] = upd.get("Completion Date") or ""
            if upd.get("Scrap") is not None:
                wo["Scrap"] = upd["Scrap"]
            break
    data["WorkOrders.json"] = all_wo
    # Apply completed qty to first detail line for this WO
    wo_details = data.get("WorkOrderDetails.json") or []
    if isinstance(wo_details, list):
        for upd in wo_updates:
            wo_no = upd.get("wo_no")
            completed = upd.get("Completed")
            if not wo_no or completed is None:
                continue
            for line in wo_details:
                if not isinstance(line, dict):
                    continue
                if (line.get("Work Order No.") or line.get("Job No.") or "").strip() != wo_no:
                    continue
                line["Completed"] = float(completed)
                break
        data["WorkOrderDetails.json"] = wo_details

    return data
