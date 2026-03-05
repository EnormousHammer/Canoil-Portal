"""
Price List Service for Canoil Portal.

Reads "Copy of Price List Master 2026.xlsx" from Google Drive using the
service account (canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com),
parses all sheets, and provides a search interface for the AI chat.

Cached for 30 minutes to avoid re-downloading on every query.
"""

import os
import time
import json
from io import BytesIO
from typing import Optional, Dict, Any, List

# ── Constants ────────────────────────────────────────────────────────────────
PRICE_LIST_FILE_NAME = "Copy of Price List Master 2026"   # partial name match
CACHE_TTL_SECONDS    = 1800   # 30 minutes


# ── Module-level cache ───────────────────────────────────────────────────────
_cache: Dict[str, Any] = {}          # {"sheets": {...}, "file_id": "...", "ts": float}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_drive_service():
    """Return an authenticated Google Drive service from google_drive_service.py."""
    try:
        from google_drive_service import GoogleDriveService
        svc = GoogleDriveService()
        if svc.authenticate():
            return svc
    except Exception as exc:
        print(f"[PriceList] Could not get Drive service: {exc}")
    return None


def _search_file(gdrive_svc) -> Optional[Dict[str, str]]:
    """
    Search for the price list Excel file across all drives accessible to the
    service account. Returns {"id": file_id, "name": file_name} or None.
    """
    try:
        service = gdrive_svc._get_fresh_service()
        query = f"name contains 'Price List Master 2026' and trashed=false and mimeType!='application/vnd.google-apps.folder'"
        results = service.files().list(
            q=query,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            fields="files(id, name, parents, driveId, modifiedTime)",
            orderBy="modifiedTime desc",
            pageSize=10,
        ).execute()
        files = results.get("files", [])
        if not files:
            # Fallback: broader search
            query2 = "name contains 'Price List' and trashed=false"
            results2 = service.files().list(
                q=query2,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                fields="files(id, name, parents, driveId, modifiedTime)",
                orderBy="modifiedTime desc",
                pageSize=20,
            ).execute()
            files = [
                f for f in results2.get("files", [])
                if "price list" in f.get("name", "").lower()
                and "2026" in f.get("name", "")
            ]
        if files:
            chosen = files[0]
            print(f"[PriceList] Found file: '{chosen['name']}' (id={chosen['id']})")
            return {"id": chosen["id"], "name": chosen["name"]}
        print("[PriceList] Price list file not found on Google Drive.")
        return None
    except Exception as exc:
        print(f"[PriceList] File search failed: {exc}")
        return None


def _parse_excel(content: bytes) -> Dict[str, Any]:
    """
    Parse all sheets of the Excel file.
    Returns a dict:
      {
        "sheets": {
          "Sheet1": {
            "headers": [...],
            "rows": [ {...}, ... ]   # list of dicts, one per row
          },
          ...
        },
        "all_rows": [ {...}, ... ]   # flat list across all sheets (for search)
      }
    """
    try:
        import pandas as pd
        xf = pd.ExcelFile(BytesIO(content), engine="openpyxl")
        sheets: Dict[str, Any] = {}
        all_rows: List[Dict] = []

        for sheet_name in xf.sheet_names:
            try:
                df = pd.read_excel(BytesIO(content), sheet_name=sheet_name, engine="openpyxl")
                # Drop fully-empty rows and columns
                df = df.dropna(how="all").dropna(axis=1, how="all")
                if df.empty:
                    continue
                # Normalise column names to strings
                df.columns = [str(c).strip() for c in df.columns]
                rows = df.where(df.notna(), other=None).to_dict(orient="records")
                # Add sheet name to every row so we can trace it later
                for row in rows:
                    row["_sheet"] = sheet_name
                sheets[sheet_name] = {
                    "headers": list(df.columns),
                    "row_count": len(rows),
                    "rows": rows,
                }
                all_rows.extend(rows)
                print(f"[PriceList]   Sheet '{sheet_name}': {len(rows)} rows, {len(df.columns)} cols")
            except Exception as exc:
                print(f"[PriceList]   Could not parse sheet '{sheet_name}': {exc}")

        return {"sheets": sheets, "all_rows": all_rows}
    except Exception as exc:
        print(f"[PriceList] Excel parse failed: {exc}")
        return {"sheets": {}, "all_rows": []}


# ── Public API ───────────────────────────────────────────────────────────────

def load_price_list(force_reload: bool = False) -> Dict[str, Any]:
    """
    Load (or return cached) price list data.
    Returns the parsed dict or {"error": "..."} if unavailable.
    """
    global _cache
    now = time.time()

    # Return cached if still fresh
    if not force_reload and _cache.get("ts") and (now - _cache["ts"]) < CACHE_TTL_SECONDS:
        age = int(now - _cache["ts"])
        print(f"[PriceList] Using cached price list ({age}s old, {len(_cache.get('all_rows', []))} rows)")
        return _cache

    print("[PriceList] Loading price list from Google Drive…")
    gdrive_svc = _get_drive_service()
    if not gdrive_svc:
        return {"error": "Google Drive service unavailable", "sheets": {}, "all_rows": []}

    file_info = _search_file(gdrive_svc)
    if not file_info:
        return {"error": "Price list file not found on Google Drive", "sheets": {}, "all_rows": []}

    # Download raw bytes
    try:
        content = gdrive_svc.download_file(file_info["id"], file_info["name"])
        if content is None:
            return {"error": "Failed to download price list file", "sheets": {}, "all_rows": []}
        # download_file returns bytes for non-JSON files
        if isinstance(content, (dict, list)):
            return {"error": "Unexpected JSON returned for xlsx file", "sheets": {}, "all_rows": []}
    except Exception as exc:
        return {"error": f"Download error: {exc}", "sheets": {}, "all_rows": []}

    parsed = _parse_excel(content)
    if not parsed["sheets"]:
        return {"error": "No data sheets found in price list file", "sheets": {}, "all_rows": []}

    _cache = {
        "file_name": file_info["name"],
        "file_id":   file_info["id"],
        "ts":        now,
        "sheets":    parsed["sheets"],
        "all_rows":  parsed["all_rows"],
    }
    total = sum(s["row_count"] for s in parsed["sheets"].values())
    print(f"[PriceList] Loaded {len(parsed['sheets'])} sheets, {total} total rows. Cached for 30 min.")
    return _cache


def search_price(query: str, customer: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    """
    Search the price list for rows matching the query text and optional customer name.

    Matching strategy (case-insensitive):
    1. Score each row by how many query tokens appear in its string representation.
    2. Customer name narrowing: if customer is provided, further filter to rows
       that mention the customer (or don't mention any customer if the sheet is
       not customer-specific).
    3. Return the top-`limit` rows sorted by score descending.

    Returns:
      {
        "matched_rows": [...],
        "total_matched": int,
        "query": str,
        "customer": str | None,
        "source_file": str,
        "sheet_names": [...]
      }
    """
    data = load_price_list()
    if data.get("error"):
        return {"error": data["error"], "matched_rows": [], "total_matched": 0}

    all_rows = data.get("all_rows", [])
    if not all_rows:
        return {"error": "Price list is empty", "matched_rows": [], "total_matched": 0}

    # Tokenise the query
    import re
    tokens = [t.lower() for t in re.split(r"[\s,]+", query) if len(t) >= 2]

    def row_score(row: dict) -> int:
        row_str = " ".join(str(v) for v in row.values() if v is not None).lower()
        score = sum(1 for t in tokens if t in row_str)
        # Bonus: customer name match
        if customer:
            cust_lower = customer.lower()
            if cust_lower in row_str:
                score += 5
        return score

    scored = [(row_score(r), r) for r in all_rows]
    # Keep only rows that match at least one token
    scored = [(s, r) for s, r in scored if s > 0]
    scored.sort(key=lambda x: x[0], reverse=True)

    matched = [r for _, r in scored[:limit]]

    return {
        "matched_rows":  matched,
        "total_matched": len(scored),
        "query":         query,
        "customer":      customer,
        "source_file":   data.get("file_name", PRICE_LIST_FILE_NAME),
        "sheet_names":   list(data.get("sheets", {}).keys()),
    }


def get_all_sheets_summary() -> Dict[str, Any]:
    """Return a lightweight summary of the price list (sheet names, row counts, headers)."""
    data = load_price_list()
    if data.get("error"):
        return data
    summary = {}
    for sheet_name, sheet_data in data.get("sheets", {}).items():
        summary[sheet_name] = {
            "headers":   sheet_data["headers"],
            "row_count": sheet_data["row_count"],
        }
    return {
        "file_name":     data.get("file_name", ""),
        "total_rows":    sum(s["row_count"] for s in data.get("sheets", {}).values()),
        "sheets_summary": summary,
    }
