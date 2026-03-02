"""
Sage key matching service. Compares MISys entities (customers, items, suppliers)
with Sage 50 entities to create a mapping table.

SAGE 50 IS 100% READ-ONLY — NEVER WRITE TO SAGE.
All Sage queries are SELECT-only. Mappings stored in portal PostgreSQL.
"""
from difflib import SequenceMatcher


def _normalize(s):
    if not s:
        return ""
    return str(s).strip().upper().replace(".", "").replace(",", "")


def _fuzzy_score(a, b):
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


def match_customers(misys_data, sage_customers, threshold=0.75):
    """Match MISys customer names to Sage customers.
    misys_data: list of MO records with 'Customer' field.
    sage_customers: list from sage_service.get_customers() (READ-ONLY).
    Returns list of {misys_key, sage_key, sage_id, confidence, score}."""

    misys_names = set()
    for mo in (misys_data or []):
        name = (mo.get("Customer") or "").strip()
        if name:
            misys_names.add(name)

    matches = []
    sage_lookup = {}
    for sc in (sage_customers or []):
        sname = (sc.get("name") or sc.get("sName") or "").strip()
        sid = sc.get("id") or sc.get("lId")
        if sname:
            sage_lookup[_normalize(sname)] = {"name": sname, "id": sid}

    for mname in sorted(misys_names):
        norm_m = _normalize(mname)
        best_score = 0
        best_sage = None

        if norm_m in sage_lookup:
            best_sage = sage_lookup[norm_m]
            best_score = 1.0
        else:
            for norm_s, sinfo in sage_lookup.items():
                score = _fuzzy_score(norm_m, norm_s)
                if score > best_score:
                    best_score = score
                    best_sage = sinfo

        if best_sage and best_score >= threshold:
            confidence = "exact" if best_score >= 0.98 else "fuzzy"
            matches.append({
                "misys_key": mname,
                "sage_key": best_sage["name"],
                "sage_id": best_sage["id"],
                "confidence": confidence,
                "score": round(best_score, 3),
            })
        else:
            matches.append({
                "misys_key": mname,
                "sage_key": None,
                "sage_id": None,
                "confidence": "unmatched",
                "score": round(best_score, 3) if best_score > 0 else 0,
            })

    return matches


def match_items(misys_items, sage_inventory, threshold=0.9):
    """Match MISys item numbers to Sage part codes.
    sage_inventory: list from sage_service.get_inventory() (READ-ONLY)."""

    sage_parts = {}
    for si in (sage_inventory or []):
        code = (si.get("part_code") or si.get("sPartCode") or "").strip()
        sid = si.get("id") or si.get("lId")
        if code:
            sage_parts[_normalize(code)] = {"part_code": code, "id": sid}

    matches = []
    for item in (misys_items or []):
        ino = (item.get("Item No.") or item.get("item_no") or "").strip()
        if not ino:
            continue
        norm_i = _normalize(ino)
        if norm_i in sage_parts:
            sp = sage_parts[norm_i]
            matches.append({
                "misys_key": ino,
                "sage_key": sp["part_code"],
                "sage_id": sp["id"],
                "confidence": "exact",
                "score": 1.0,
            })
        else:
            best_score = 0
            best_sp = None
            for norm_s, sp in sage_parts.items():
                score = _fuzzy_score(norm_i, norm_s)
                if score > best_score:
                    best_score = score
                    best_sp = sp
            if best_sp and best_score >= threshold:
                matches.append({
                    "misys_key": ino,
                    "sage_key": best_sp["part_code"],
                    "sage_id": best_sp["id"],
                    "confidence": "fuzzy",
                    "score": round(best_score, 3),
                })
            else:
                matches.append({
                    "misys_key": ino,
                    "sage_key": None,
                    "sage_id": None,
                    "confidence": "unmatched",
                    "score": 0,
                })

    return matches


def match_suppliers(misys_suppliers, sage_vendors, threshold=0.75):
    """Match MISys supplier names to Sage vendors.
    sage_vendors: from sage_service.get_vendors() (READ-ONLY)."""

    sage_lookup = {}
    for sv in (sage_vendors or []):
        sname = (sv.get("name") or sv.get("sName") or "").strip()
        sid = sv.get("id") or sv.get("lId")
        if sname:
            sage_lookup[_normalize(sname)] = {"name": sname, "id": sid}

    matches = []
    for supl in (misys_suppliers or []):
        name = (supl.get("Name") or supl.get("Supplier Name") or "").strip()
        supl_no = (supl.get("Supplier No.") or supl.get("suplId") or "").strip()
        if not name:
            continue

        norm_m = _normalize(name)
        best_score = 0
        best_sage = None

        if norm_m in sage_lookup:
            best_sage = sage_lookup[norm_m]
            best_score = 1.0
        else:
            for norm_s, sinfo in sage_lookup.items():
                score = _fuzzy_score(norm_m, norm_s)
                if score > best_score:
                    best_score = score
                    best_sage = sinfo

        if best_sage and best_score >= threshold:
            confidence = "exact" if best_score >= 0.98 else "fuzzy"
            matches.append({
                "misys_key": supl_no or name,
                "sage_key": best_sage["name"],
                "sage_id": best_sage["id"],
                "confidence": confidence,
                "score": round(best_score, 3),
            })
        else:
            matches.append({
                "misys_key": supl_no or name,
                "sage_key": None,
                "sage_id": None,
                "confidence": "unmatched",
                "score": 0,
            })

    return matches


def save_mappings(matches, entity_type):
    """Persist confirmed mappings (exact or manually confirmed) to core.entity_mapping."""
    try:
        import db_service
        if not db_service.is_available():
            return 0

        saved = 0
        for m in matches:
            if m.get("confidence") == "unmatched" or not m.get("sage_key"):
                continue
            try:
                db_service.execute(
                    """INSERT INTO core.entity_mapping
                       (entity_type, misys_key, sage_key, sage_id, confidence)
                       VALUES (%s, %s, %s, %s, %s)
                       ON CONFLICT (entity_type, misys_key) DO UPDATE
                       SET sage_key = EXCLUDED.sage_key,
                           sage_id = EXCLUDED.sage_id,
                           confidence = EXCLUDED.confidence""",
                    (entity_type, m["misys_key"], m["sage_key"],
                     m.get("sage_id"), m["confidence"])
                )
                saved += 1
            except Exception as e:
                print(f"[sage_matching] save error: {e}")
        return saved
    except Exception:
        return 0


def get_mapping(entity_type, misys_key):
    """Look up a single mapping."""
    try:
        import db_service
        return db_service.fetch_one(
            "SELECT * FROM core.entity_mapping WHERE entity_type = %s AND misys_key = %s",
            (entity_type, misys_key)
        )
    except Exception:
        return None


def get_all_mappings(entity_type=None):
    """Get all mappings, optionally filtered by type."""
    try:
        import db_service
        if entity_type:
            return db_service.fetch_all(
                "SELECT * FROM core.entity_mapping WHERE entity_type = %s ORDER BY misys_key",
                (entity_type,)
            )
        return db_service.fetch_all(
            "SELECT * FROM core.entity_mapping ORDER BY entity_type, misys_key"
        )
    except Exception:
        return []
