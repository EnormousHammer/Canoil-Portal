"""
Price List Service for Canoil Portal.

Reads "Copy of Price List Master 2026.xlsx" from Google Drive using the
service account (canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com),
parses all sheets, and provides a clean search interface for the AI chat.

File structure (5 sheets):
  - Sept 2024 prices  : Master sheet – all customers, all products, full price history
  - Mail merge Reolube: Reolube products, current price in last column
  - Mail merge Grease : Grease products, current price in last column
  - Mail Merge MOV VSG: MOV / VSG products, current price in last column
  - sort              : Duplicate of master, sorted differently

Key columns (consistent across all sheets):
  Customer                    – company name
  Product Description /Code   – product name / code
  Product Size                – packaging size (Drum 180kg, Case (30), Pail, etc.)
  Currency                    – CAD / USD / CDN
  <price columns>             – historical then current; rightmost non-null = CURRENT price

Cached for 30 minutes.
"""

import os
import re
import time
from io import BytesIO
from typing import Optional, Dict, Any, List

# ── Constants ─────────────────────────────────────────────────────────────────
PRICE_LIST_FILE_NAME = "Copy of Price List Master 2026"
CACHE_TTL_SECONDS    = 1800   # 30 minutes

# Columns that are NOT price columns (skip them when looking for the current price)
NON_PRICE_COLS = {
    "contact information", "contact email", "customer",
    "product description /code", "product description/code",
    "product size", "currency", "old price",
    # ratio / multiplier rows (non-dollar values like 1.06, 1.08)
}

# Sheets to use for "current price" extraction (most up-to-date per product type)
CURRENT_PRICE_SHEETS = {
    "Mail merge Reolube":  "reolube",
    "Mail merge Grease":   "grease",
    "Mail Merge MOV VSG":  "mov_vsg",
}

MASTER_SHEET = "Sept 2024 prices"

# ── Module-level cache ────────────────────────────────────────────────────────
_cache: Dict[str, Any] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_drive_service():
    try:
        from google_drive_service import GoogleDriveService
        svc = GoogleDriveService()
        if svc.authenticate():
            return svc
    except Exception as exc:
        print(f"[PriceList] Could not get Drive service: {exc}")
    return None


def _search_file(gdrive_svc) -> Optional[Dict[str, str]]:
    """Search for the price list file across all drives the service account can see."""
    try:
        service = gdrive_svc._get_fresh_service()
        query = "name contains 'Price List Master 2026' and trashed=false"
        results = service.files().list(
            q=query,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            fields="files(id, name, modifiedTime)",
            orderBy="modifiedTime desc",
            pageSize=10,
        ).execute()
        files = results.get("files", [])
        if files:
            chosen = files[0]
            print(f"[PriceList] Found: '{chosen['name']}' (id={chosen['id']})")
            return {"id": chosen["id"], "name": chosen["name"]}
        print("[PriceList] Price list file not found on Google Drive.")
        return None
    except Exception as exc:
        print(f"[PriceList] File search failed: {exc}")
        return None


def _is_price_col(col_name: str) -> bool:
    """Return True if the column header looks like a price / date column."""
    if col_name is None:
        return False
    clean = str(col_name).strip().lower()
    # Skip known non-price columns
    for skip in NON_PRICE_COLS:
        if clean.startswith(skip):
            return False
    # Skip pure multiplier rows header (e.g. "1.06", "6%")
    if re.match(r"^[\d\.%]+$", clean):
        return False
    # It's a price column if it has a year/month reference or "price" in the name
    return True


def _last_price(row: dict, headers: List[str]) -> tuple:
    """
    Return (current_price, price_column_label) — the rightmost non-null, non-zero
    numeric value in a row that comes from a price column.
    """
    last_val = None
    last_label = None
    for h in headers:
        if not _is_price_col(h):
            continue
        v = row.get(h)
        if v is None:
            continue
        try:
            fv = float(v)
            if fv > 1:           # ignore multiplier rows (e.g. 1.06)
                last_val = fv
                last_label = str(h).strip()
        except (TypeError, ValueError):
            pass
    # Normalize label (remove newlines from Excel multi-line headers)
    if last_label:
        last_label = re.sub(r"\s+", " ", last_label).strip()
    return last_val, last_label


def _find_col(row_lower: dict, *names: str) -> str:
    """Case-insensitive, whitespace-normalised dict lookup; returns '' if not found."""
    for name in names:
        key = re.sub(r"\s+", " ", name.strip().lower())
        val = row_lower.get(key)
        if val is not None:
            return str(val).strip()
    return ""


def _clean_row(raw_row: tuple, headers: List[str]) -> Optional[Dict]:
    """
    Convert a raw openpyxl row into a clean structured dict with only the
    essential fields + current price.
    """
    # Build two dicts: original-keyed (for price lookup) and lower-keyed (for field lookup)
    row_orig  = {}
    row_lower = {}
    for h, v in zip(headers, raw_row):
        if h is not None and v is not None:
            key_orig  = str(h).strip()
            key_lower = re.sub(r"\s+", " ", key_orig.lower())
            row_orig[key_orig]  = v
            row_lower[key_lower] = v

    # Must have at least customer + product
    customer = _find_col(row_lower, "customer")
    product  = _find_col(row_lower,
                         "product description /code",
                         "product description/code",
                         "product description / code")
    if not customer or not product or customer.lower() in ("blank", "customer"):
        return None

    size     = _find_col(row_lower, "product size")
    currency = _find_col(row_lower, "currency")
    contact  = _find_col(row_lower, "contact email", "contact information")

    # Use original-keyed row so _last_price can match the raw header strings
    current_price, price_label = _last_price(row_orig, headers)

    return {
        "customer":      customer,
        "contact":       contact,
        "product":       product,
        "size":          size,
        "currency":      currency,
        "current_price": current_price,
        "price_as_of":   price_label,
    }


def _parse_excel(content: bytes) -> Dict[str, Any]:
    """
    Parse the price list Excel and return a list of clean price records.
    We prioritise the Mail Merge sheets for current prices (most up-to-date),
    then fall back to the master sheet for any products not covered.
    """
    import openpyxl
    wb = openpyxl.load_workbook(BytesIO(content), read_only=True, data_only=True)

    # Parse every sheet into clean records
    sheet_records: Dict[str, List[Dict]] = {}

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            continue

        # Detect header row (first row with at least 3 non-empty cells)
        header_idx = None
        for i, row in enumerate(all_rows[:10]):
            non_empty = [c for c in row if c is not None]
            if len(non_empty) >= 3:
                header_idx = i
                break
        if header_idx is None:
            continue

        raw_headers = [str(h).strip() if h is not None else None
                       for h in all_rows[header_idx]]

        records = []
        for raw_row in all_rows[header_idx + 1:]:
            if not any(c is not None for c in raw_row):
                continue
            cleaned = _clean_row(raw_row, raw_headers)
            if cleaned:
                cleaned["_sheet"] = sheet_name
                records.append(cleaned)

        sheet_records[sheet_name] = records
        print(f"[PriceList]   Sheet '{sheet_name}': {len(records)} price records")

    wb.close()

    # Build the master list:
    # For each (customer, product, size) we want the MOST CURRENT price.
    # Priority: Mail Merge sheets > Master sheet (they have the latest increases applied)
    seen = {}   # key → record
    priority_order = list(CURRENT_PRICE_SHEETS.keys()) + [MASTER_SHEET, "sort"]

    for sheet_name in priority_order:
        for rec in sheet_records.get(sheet_name, []):
            key = (
                rec["customer"].lower(),
                rec["product"].lower().rstrip(),
                rec["size"].lower(),
            )
            # Only overwrite if the new record has a price
            if rec.get("current_price") is not None:
                seen[key] = rec
            elif key not in seen:
                seen[key] = rec

    all_records = list(seen.values())
    print(f"[PriceList] Total unique price records: {len(all_records)}")
    return {
        "records":     all_records,
        "sheet_names": list(sheet_records.keys()),
    }


# ── Public API ────────────────────────────────────────────────────────────────

def load_price_list(force_reload: bool = False) -> Dict[str, Any]:
    """Load (or return cached) price list data."""
    global _cache
    now = time.time()

    if not force_reload and _cache.get("ts") and (now - _cache["ts"]) < CACHE_TTL_SECONDS:
        age = int(now - _cache["ts"])
        print(f"[PriceList] Cache hit ({age}s old, {len(_cache.get('records', []))} records)")
        return _cache

    print("[PriceList] Loading from Google Drive…")
    gdrive_svc = _get_drive_service()
    if not gdrive_svc:
        return {"error": "Google Drive service unavailable", "records": []}

    file_info = _search_file(gdrive_svc)
    if not file_info:
        return {"error": "Price list file not found on Google Drive", "records": []}

    try:
        content = gdrive_svc.download_file(file_info["id"], file_info["name"])
        if content is None or isinstance(content, (dict, list)):
            return {"error": "Failed to download price list file", "records": []}
    except Exception as exc:
        return {"error": f"Download error: {exc}", "records": []}

    parsed = _parse_excel(content)
    if not parsed["records"]:
        return {"error": "No price records found in file", "records": []}

    _cache = {
        "file_name":   file_info["name"],
        "file_id":     file_info["id"],
        "ts":          now,
        "records":     parsed["records"],
        "sheet_names": parsed["sheet_names"],
    }
    return _cache


def search_price(query: str, customer: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    """
    Search price records matching the query text and optional customer name.

    Scoring:
    - Each query token found in (customer + product + size) = +1 point
    - Customer name match = +10 points bonus
    - Exact customer match = +20 points bonus
    - Size keyword match (drum, pail, case, etc.) = +2 bonus

    Returns clean records: customer, product, size, currency, current_price, price_as_of.
    """
    data = load_price_list()
    if data.get("error"):
        return {"error": data["error"], "matched_rows": [], "total_matched": 0}

    records = data.get("records", [])
    if not records:
        return {"error": "Price list is empty", "matched_rows": [], "total_matched": 0}

    # Tokenise query
    tokens = [t.lower() for t in re.split(r"[\s,/\-]+", query) if len(t) >= 2]

    def score(rec: dict) -> int:
        searchable = " ".join([
            rec.get("customer", ""),
            rec.get("product",  ""),
            rec.get("size",     ""),
        ]).lower()

        s = sum(1 for t in tokens if t in searchable)
        if s == 0:
            return 0

        # Customer bonus
        if customer:
            cust_lower = customer.lower()
            rec_cust   = rec.get("customer", "").lower()
            if cust_lower == rec_cust:
                s += 20
            elif cust_lower in rec_cust or rec_cust in cust_lower:
                s += 10

        # Size/packaging bonus
        size_lower = rec.get("size", "").lower()
        for size_kw in ["drum", "pail", "case", "keg", "tote", "bag", "kg"]:
            if size_kw in tokens and size_kw in size_lower:
                s += 2

        return s

    scored = [(score(r), r) for r in records]
    scored = [(s, r) for s, r in scored if s > 0]
    scored.sort(key=lambda x: x[0], reverse=True)

    matched = [r for _, r in scored[:limit]]

    return {
        "matched_rows":  matched,
        "total_matched": len(scored),
        "query":         query,
        "customer":      customer,
        "source_file":   data.get("file_name", PRICE_LIST_FILE_NAME),
        "sheet_names":   data.get("sheet_names", []),
    }


def get_all_sheets_summary() -> Dict[str, Any]:
    """Return sheet names, record count, and a sample of records."""
    data = load_price_list()
    if data.get("error"):
        return data
    records = data.get("records", [])
    return {
        "file_name":   data.get("file_name", ""),
        "total_records": len(records),
        "sheet_names": data.get("sheet_names", []),
        "sample":      records[:5],
        "note": (
            "Each record = one customer+product+size combination. "
            "current_price is the most recent price for that line. "
            "Currency is CAD or USD per the customer agreement."
        ),
    }
