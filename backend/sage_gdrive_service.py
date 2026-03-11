"""
Sage G Drive Data Service
=========================
Reads Sage 50 CSV exports from either:
  - LOCAL:  G:\\Shared drives\\IT_Automation\\MiSys\\Misys Extracted Data\\Full Company Data From SAGE\\
  - CLOUD:  Google Drive API (Render/Cloud Run — no local G: drive access)

Finds the latest subfolder (by mtime/API), loads key tables with pandas, and caches
the result in memory. Provides analytics functions used by the portal API.

╔══════════════════════════════════════════════════════════════════╗
║  ALL DATA IS READ-ONLY — we never write to Sage.                ║
║  This module reads exported CSV files only.                     ║
╚══════════════════════════════════════════════════════════════════╝

Tables loaded:
  tcustomr   – 353 customers
  tvendor    – 478 vendors
  tinvent    – 616 inventory items
  tinvbyln   – 933 stock-on-hand by location
  tinvext    – 916 YTD sales stats per item
  tinvprc    – 4,928 price records (4 tiers × 2 currencies × items)
  tinvinfo   – 616 item long descriptions
  tsalordr   – 4,743 sales order headers
  tsoline    – 12,772 SO line items
  titrec     – 32,672 invoice/PO transaction headers
  titrline   – 62,017 transaction line items
  tprclist   – 4 price lists
  tcustr     – 8,049 customer AR transactions
"""

import os
import json
import time
import threading
from datetime import datetime, date
from io import BytesIO
from pathlib import Path
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SAGE_GDRIVE_BASE = os.environ.get(
    "SAGE_GDRIVE_BASE",
    r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\Full Company Data From SAGE"
)

# Google Drive API path for cloud environments (Render / Cloud Run)
SAGE_GDRIVE_DRIVE_PATH = os.environ.get(
    "SAGE_GDRIVE_DRIVE_PATH",
    "MiSys/Misys Extracted Data/Full Company Data From SAGE"
)
SAGE_SHARED_DRIVE_NAME = os.environ.get("GOOGLE_DRIVE_SHARED_DRIVE_NAME", "IT_Automation")

# Detect cloud environment — same logic as app.py
IS_CLOUD_ENVIRONMENT = (
    os.getenv('K_SERVICE') is not None or          # Cloud Run
    os.getenv('RENDER') is not None or             # Render
    os.getenv('RENDER_SERVICE_ID') is not None     # Render (alt key)
)

# Price list IDs from tprclist
PRICE_LIST_NAMES = {1: "Regular", 2: "Preferred", 3: "Web Price", 4: "Master"}
# Currency IDs from tcurrncyId field
CURRENCY_NAMES = {1: "CAD", 2: "USD"}

# Tables we actually need (subset of all 636 files)
REQUIRED_TABLES = [
    "tcustomr", "tvendor", "tinvent", "tinvbyln", "tinvext",
    "tinvprc", "tinvinfo", "tsalordr", "tsoline",
    "titrec", "titrline", "tprclist", "tcustr",
]

# ---------------------------------------------------------------------------
# Module-level cache
# ---------------------------------------------------------------------------
_cache: dict = {}
_cache_ts: float = 0.0
_cache_folder: str = ""
_cache_lock = threading.Lock()
CACHE_TTL_SECONDS = 3600  # 1 hour — re-read from disk once per hour

# Lazy-initialized Google Drive service for cloud use
_gds_instance = None
_gds_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Google Drive API helpers (cloud environment support)
# ---------------------------------------------------------------------------

def _get_gds():
    """Lazy-init a GoogleDriveService; returns None if unavailable."""
    global _gds_instance
    with _gds_lock:
        if _gds_instance is not None:
            return _gds_instance
        try:
            from google_drive_service import GoogleDriveService
            gds = GoogleDriveService()
            gds.authenticate()
            if gds.authenticated:
                _gds_instance = gds
                print("[sage_gdrive] GoogleDriveService authenticated OK")
                return gds
            else:
                print("[sage_gdrive] GoogleDriveService authentication failed")
        except Exception as e:
            print(f"[sage_gdrive] GoogleDriveService init error: {e}")
    return None


def _find_sage_subfolder_api(gds, drive_id, parent_id):
    """Get latest data subfolder (excluding _*) under parent. Returns (folder_id, folder_name) or (None, None)."""
    service = gds._get_fresh_service()
    results = service.files().list(
        q=f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        orderBy="modifiedTime desc",
        pageSize=10,
        fields="files(id, name)",
        corpora="drive",
        driveId=drive_id,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
    ).execute()
    folders = [f for f in results.get("files", []) if not f.get("name", "").startswith("_")]
    return (folders[0]["id"], folders[0]["name"]) if folders else (None, None)


def _find_latest_sage_folder_api():
    """Find the Sage data folder via Google Drive API.
    Returns (gds, drive_id, folder_id, folder_name).
    Uses parent folder (Full Company Data From SAGE) directly — CSVs may be there.
    """
    gds = _get_gds()
    if not gds:
        return None, None, None, "Google Drive service not available"
    try:
        drive_id = gds.find_shared_drive(SAGE_SHARED_DRIVE_NAME)
        if not drive_id:
            return None, None, None, f"Shared drive '{SAGE_SHARED_DRIVE_NAME}' not found"

        parent_id = gds.find_folder_by_path(drive_id, SAGE_GDRIVE_DRIVE_PATH)
        if not parent_id:
            return None, None, None, f"Sage folder path not found in Drive: {SAGE_GDRIVE_DRIVE_PATH}"

        # Use parent folder directly — CSVs may be in Full Company Data From SAGE (flat structure on Drive)
        print(f"[sage_gdrive] Using folder: {SAGE_GDRIVE_DRIVE_PATH}")
        return gds, drive_id, parent_id, "(base)"
    except Exception as e:
        return None, None, None, str(e)


def _load_csv_from_api(gds, folder_id, drive_id, table_name):
    """Download and parse one Sage CSV from Google Drive. Returns pd.DataFrame or None."""
    try:
        service = gds._get_fresh_service()
        for filename in [f"{table_name}.CSV", f"{table_name}.csv", f"{table_name.upper()}.CSV"]:
            query = f"name='{filename}' and '{folder_id}' in parents and trashed=false"
            results = service.files().list(
                q=query,
                corpora="drive",
                driveId=drive_id,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                fields="files(id, name)",
                pageSize=1,
            ).execute()
            files = results.get("files", [])
            if not files:
                continue
            content = gds.download_file(files[0]["id"], filename)
            if content is None:
                continue
            for encoding in ["utf-8", "latin-1", "cp1252"]:
                try:
                    df = pd.read_csv(BytesIO(content), encoding=encoding, low_memory=False)
                    return df
                except UnicodeDecodeError:
                    continue
                except Exception as e:
                    print(f"[sage_gdrive] Parse error for {filename}: {e}")
                    return None
    except Exception as e:
        print(f"[sage_gdrive] API CSV load error for {table_name}: {e}")
    return None


def _load_via_api():
    """Load all required Sage tables via Google Drive API (cloud mode).
    Returns (tables_dict, folder_name_or_error).
    """
    gds, drive_id, folder_id, folder_name = _find_latest_sage_folder_api()
    if gds is None:
        return {}, folder_name  # folder_name holds the error message here

    print(f"[sage_gdrive] Loading {len(REQUIRED_TABLES)} Sage tables via API from: {folder_name}")
    t0 = time.time()
    tables = {}
    for tbl in REQUIRED_TABLES:
        df = _load_csv_from_api(gds, folder_id, drive_id, tbl)
        if df is not None:
            tables[tbl] = df
            print(f"[sage_gdrive]   {tbl}: {len(df)} rows (API)")
        else:
            print(f"[sage_gdrive]   {tbl}: NOT FOUND (API)")
    # If parent had no CSVs, try latest subfolder (date folders like 2024-11-15)
    if not tables:
        sub_id, sub_name = _find_sage_subfolder_api(gds, drive_id, folder_id)
        if sub_id:
            print(f"[sage_gdrive] No CSVs in base; trying subfolder: {sub_name}")
            for tbl in REQUIRED_TABLES:
                df = _load_csv_from_api(gds, sub_id, drive_id, tbl)
                if df is not None:
                    tables[tbl] = df
                    print(f"[sage_gdrive]   {tbl}: {len(df)} rows (API)")
                else:
                    print(f"[sage_gdrive]   {tbl}: NOT FOUND (API)")
            folder_name = sub_name

    print(f"[sage_gdrive] API load complete: {len(tables)} tables in {time.time() - t0:.1f}s")
    if not tables:
        return {}, (
            f"Found folder '{folder_name}' but no CSV files loaded. "
            f"Ensure tcustomr.CSV, tsalordr.CSV, tsoline.CSV, etc. exist in {SAGE_GDRIVE_DRIVE_PATH} or a date subfolder. "
            f"Service account must be a member of shared drive '{SAGE_SHARED_DRIVE_NAME}' with Content Viewer."
        )
    return tables, folder_name


# ---------------------------------------------------------------------------
# Folder discovery (local)
# ---------------------------------------------------------------------------

def get_latest_folder():
    """Return (full_path, folder_name) for the most recent local Sage export subfolder."""
    base = SAGE_GDRIVE_BASE
    if not os.path.isdir(base):
        return None, f"Sage G Drive base folder not found: {base}"
    try:
        subfolders = [
            f for f in os.listdir(base)
            if os.path.isdir(os.path.join(base, f)) and not f.startswith('_')
        ]
        if not subfolders:
            return None, f"No subfolders found in: {base}"
        # Sort by mtime descending (folder name format is 'March 3, 2026_01-36 PM' — not lexically sortable)
        subfolders.sort(key=lambda f: os.path.getmtime(os.path.join(base, f)), reverse=True)
        latest_name = subfolders[0]
        latest_path = os.path.join(base, latest_name)
        return latest_path, latest_name
    except Exception as e:
        return None, str(e)


def get_status() -> dict:
    """Return metadata about the Sage G Drive data (folder, row counts, cache age)."""
    result = {
        "is_cloud": IS_CLOUD_ENVIRONMENT,
        "base_path": SAGE_GDRIVE_BASE,
        "base_exists": os.path.isdir(SAGE_GDRIVE_BASE),
        "drive_path": SAGE_GDRIVE_DRIVE_PATH,
        "cache_loaded": bool(_cache),
        "cache_folder": _cache_folder,
        "cache_age_seconds": round(time.time() - _cache_ts, 0) if _cache_ts else None,
        "row_counts": {},
    }
    if IS_CLOUD_ENVIRONMENT:
        result["latest_folder"] = _cache_folder or "not loaded yet"
        result["latest_folder_path"] = None
    else:
        folder_path, folder_name = get_latest_folder()
        result["latest_folder"] = folder_name
        result["latest_folder_path"] = folder_path
    if _cache:
        result["row_counts"] = {tbl: len(df) for tbl, df in _cache.items()}
    return result


# ---------------------------------------------------------------------------
# CSV loading
# ---------------------------------------------------------------------------

def _load_csv(folder_path: str, table_name: str) -> pd.DataFrame | None:
    """Load one Sage CSV (case-insensitive filename match)."""
    # Try common casing variants
    for candidate in [f"{table_name}.CSV", f"{table_name}.csv", f"{table_name.upper()}.CSV"]:
        fp = os.path.join(folder_path, candidate)
        if os.path.isfile(fp):
            try:
                df = pd.read_csv(fp, encoding="utf-8", low_memory=False)
                return df
            except UnicodeDecodeError:
                try:
                    df = pd.read_csv(fp, encoding="latin-1", low_memory=False)
                    return df
                except Exception as e:
                    print(f"[sage_gdrive] Failed to load {candidate}: {e}")
                    return None
            except Exception as e:
                print(f"[sage_gdrive] Failed to load {candidate}: {e}")
                return None
    return None


def _safe_float(val, default=0.0) -> float:
    try:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return default
        return float(val)
    except Exception:
        return default


def _safe_str(val, default="") -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return default
    return str(val).strip()


def _safe_date(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    if not s or s in ("0", "nan", "NaT"):
        return None
    # Already ISO format
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return s


def load_data(force: bool = False):
    """
    Load (or return cached) Sage G Drive tables.
    Returns (tables_dict, error_message).
    tables_dict keys = table names (e.g. 'tcustomr'), values = pd.DataFrame.

    On cloud environments (Render/Cloud Run) the Google Drive API is used.
    On local environments the G: drive path is used, with API fallback.
    """
    global _cache, _cache_ts, _cache_folder

    with _cache_lock:
        now = time.time()
        if _cache and not force and (now - _cache_ts) < CACHE_TTL_SECONDS:
            return _cache, None

        # ── CLOUD: must use Google Drive API ──────────────────────────────
        if IS_CLOUD_ENVIRONMENT:
            tables, result = _load_via_api()
            if not tables:
                return {}, f"[Cloud] Sage API load failed: {result}"
            _cache = tables
            _cache_ts = time.time()
            _cache_folder = result  # result is folder_name on success
            return tables, None

        # ── LOCAL: try G: drive, fall back to API ─────────────────────────
        folder_path, folder_name = get_latest_folder()
        if not folder_path:
            print(f"[sage_gdrive] G: drive unavailable ({folder_name}), trying Google Drive API…")
            tables, result = _load_via_api()
            if not tables:
                return {}, f"G: drive not found and API fallback failed: {result}"
            _cache = tables
            _cache_ts = time.time()
            _cache_folder = result
            return tables, None

        print(f"[sage_gdrive] Loading from local folder: {folder_name}")
        t0 = time.time()

        tables = {}
        for tbl in REQUIRED_TABLES:
            df = _load_csv(folder_path, tbl)
            if df is not None:
                tables[tbl] = df
                print(f"[sage_gdrive]   {tbl}: {len(df)} rows")
            else:
                print(f"[sage_gdrive]   {tbl}: NOT FOUND")

        _cache = tables
        _cache_ts = time.time()
        _cache_folder = folder_name
        print(f"[sage_gdrive] Loaded {len(tables)} tables in {time.time() - t0:.1f}s")
        return tables, None


# ---------------------------------------------------------------------------
# Helper: get tables (auto-load)
# ---------------------------------------------------------------------------

def _tables() -> dict:
    tables, err = load_data()
    if err and not tables:
        return {}
    return tables


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

def get_customers(search: str = None, inactive: bool = False, limit: int = 500, offset: int = 0) -> dict:
    """Return enriched customer list from tcustomr."""
    df = _tables().get("tcustomr")
    if df is None or df.empty:
        return {"customers": [], "total": 0, "source": "gdrive", "error": "tcustomr not loaded"}

    rows = df.copy()

    if not inactive:
        if "bInactive" in rows.columns:
            rows = rows[rows["bInactive"].fillna(0) == 0]

    if search:
        q = search.lower()
        mask = pd.Series([False] * len(rows), index=rows.index)
        for col in ["sName", "sCntcName", "sEmail", "sCity"]:
            if col in rows.columns:
                mask |= rows[col].fillna("").astype(str).str.lower().str.contains(q, na=False)
        rows = rows[mask]

    total = len(rows)
    rows = rows.iloc[offset: offset + limit]

    result = []
    for _, r in rows.iterrows():
        result.append({
            "lId": int(r.get("lId", 0) or 0),
            "sName": _safe_str(r.get("sName")),
            "sCntcName": _safe_str(r.get("sCntcName")),
            "sCity": _safe_str(r.get("sCity")),
            "sProvState": _safe_str(r.get("sProvState")),
            "sCountry": _safe_str(r.get("sCountry")),
            "sPhone1": _safe_str(r.get("sPhone1")),
            "sEmail": _safe_str(r.get("sEmail")),
            "dCrLimit": _safe_float(r.get("dCrLimit")),
            "dAmtYtd": _safe_float(r.get("dAmtYtd")),
            "dLastYrAmt": _safe_float(r.get("dLastYrAmt")),
            "dAmtYtdHm": _safe_float(r.get("dAmtYtdHm")),
            "dAmtLYHm": _safe_float(r.get("dAmtLYHm")),
            "nNetDay": int(r.get("nNetDay", 0) or 0),
            "lCurrncyId": int(r.get("lCurrncyId", 1) or 1),
            "lPrcListId": int(r.get("lPrcListId", 1) or 1),
            "bInactive": bool(r.get("bInactive", 0)),
            "dtSince": _safe_date(r.get("dtSince")),
            "dtLastSal": _safe_date(r.get("dtLastSal")),
        })

    return {"customers": result, "total": total, "source": "gdrive"}


def get_customer_by_name(name: str) -> dict | None:
    """Find a single customer by name (case-insensitive, with recent SOs)."""
    df = _tables().get("tcustomr")
    if df is None or df.empty:
        return None
    if "sName" not in df.columns:
        return None
    name_norm = name.strip().lower()
    match = df[df["sName"].fillna("").str.strip().str.lower() == name_norm]
    if match.empty:
        # Try partial match
        match = df[df["sName"].fillna("").str.strip().str.lower().str.contains(name_norm, na=False)]
    if match.empty:
        return None

    r = match.iloc[0]
    cust_id = int(r.get("lId", 0) or 0)

    customer = {
        "lId": cust_id,
        "sName": _safe_str(r.get("sName")),
        "sCntcName": _safe_str(r.get("sCntcName")),
        "sStreet1": _safe_str(r.get("sStreet1")),
        "sCity": _safe_str(r.get("sCity")),
        "sProvState": _safe_str(r.get("sProvState")),
        "sCountry": _safe_str(r.get("sCountry")),
        "sPhone1": _safe_str(r.get("sPhone1")),
        "sEmail": _safe_str(r.get("sEmail")),
        "dCrLimit": _safe_float(r.get("dCrLimit")),
        "dAmtYtd": _safe_float(r.get("dAmtYtd")),
        "dLastYrAmt": _safe_float(r.get("dLastYrAmt")),
        "dAmtYtdHm": _safe_float(r.get("dAmtYtdHm")),
        "dAmtLYHm": _safe_float(r.get("dAmtLYHm")),
        "nNetDay": int(r.get("nNetDay", 0) or 0),
        "lCurrncyId": int(r.get("lCurrncyId", 1) or 1),
        "lPrcListId": int(r.get("lPrcListId", 1) or 1),
        "bInactive": bool(r.get("bInactive", 0)),
        "dtSince": _safe_date(r.get("dtSince")),
        "dtLastSal": _safe_date(r.get("dtLastSal")),
        "currency": CURRENCY_NAMES.get(int(r.get("lCurrncyId", 1) or 1), "CAD"),
        "price_list": PRICE_LIST_NAMES.get(int(r.get("lPrcListId", 1) or 1), "Regular"),
        "credit_utilization_pct": round(
            (_safe_float(r.get("dAmtYtd")) / _safe_float(r.get("dCrLimit")) * 100)
            if _safe_float(r.get("dCrLimit")) > 0 else 0,
            1
        ),
        "ytd_vs_ly_pct": round(
            ((_safe_float(r.get("dAmtYtd")) - _safe_float(r.get("dLastYrAmt"))) / _safe_float(r.get("dLastYrAmt")) * 100)
            if _safe_float(r.get("dLastYrAmt")) > 0 else 0,
            1
        ),
    }

    # Recent sales orders
    recent_sos = get_customer_orders(cust_id, limit=15)
    customer["recent_orders"] = recent_sos

    return customer


def get_customer_orders(customer_id: int, limit: int = 20) -> list:
    """Get open/recent SOs for a customer from tsalordr."""
    df = _tables().get("tsalordr")
    if df is None or df.empty:
        return []
    if "lCusId" not in df.columns:
        return []
    rows = df[df["lCusId"] == customer_id].copy()
    if rows.empty:
        return []
    # Sort by date descending (by lId as proxy)
    if "lId" in rows.columns:
        rows = rows.sort_values("lId", ascending=False)
    rows = rows.head(limit)
    result = []
    for _, r in rows.iterrows():
        result.append({
            "lId": int(r.get("lId", 0) or 0),
            "sSONum": _safe_str(r.get("sSONum")),
            "sName": _safe_str(r.get("sName")),
            "dtSODate": _safe_date(r.get("dtSODate")),
            "dtShipDate": _safe_date(r.get("dtShipDate")),
            "dTotal": _safe_float(r.get("dTotal")),
            "nFilled": int(r.get("nFilled", 0) or 0),
            "bQuote": bool(r.get("bQuote", 0)),
            "sShipper": _safe_str(r.get("sShipper")),
        })
    return result


# ---------------------------------------------------------------------------
# Inventory + Pricing
# ---------------------------------------------------------------------------

def get_inventory(search: str = None, inactive: bool = False, limit: int = 700, offset: int = 0) -> dict:
    """Return inventory items with stock-on-hand and pricing."""
    tables = _tables()
    inv_df = tables.get("tinvent")
    if inv_df is None or inv_df.empty:
        return {"inventory": [], "total": 0, "source": "gdrive", "error": "tinvent not loaded"}

    rows = inv_df.copy()
    if not inactive and "bInactive" in rows.columns:
        rows = rows[rows["bInactive"].fillna(0) == 0]

    if search:
        q = search.lower()
        mask = pd.Series([False] * len(rows), index=rows.index)
        for col in ["sPartCode", "sName", "sNameF"]:
            if col in rows.columns:
                mask |= rows[col].fillna("").astype(str).str.lower().str.contains(q, na=False)
        rows = rows[mask]

    # Build stock lookup from tinvbyln
    stock_map: dict[int, dict] = {}
    byln = tables.get("tinvbyln")
    if byln is not None and not byln.empty and "lInventId" in byln.columns:
        for _, sr in byln.iterrows():
            iid = int(sr.get("lInventId", 0) or 0)
            if iid not in stock_map:
                stock_map[iid] = {"dInStock": 0.0, "dQtyOnOrd": 0.0, "dQOnSalOrd": 0.0,
                                  "dLastCost": 0.0, "dCostStk": 0.0}
            stock_map[iid]["dInStock"] += _safe_float(sr.get("dInStock"))
            stock_map[iid]["dQtyOnOrd"] += _safe_float(sr.get("dQtyOnOrd"))
            stock_map[iid]["dQOnSalOrd"] += _safe_float(sr.get("dQOnSalOrd"))
            if _safe_float(sr.get("dLastCost")) > 0:
                stock_map[iid]["dLastCost"] = _safe_float(sr.get("dLastCost"))
            stock_map[iid]["dCostStk"] += _safe_float(sr.get("dCostStk"))

    # Build YTD stats lookup from tinvext
    ext_map: dict[int, dict] = {}
    ext = tables.get("tinvext")
    if ext is not None and not ext.empty and "lInventId" in ext.columns:
        for _, er in ext.iterrows():
            iid = int(er.get("lInventId", 0) or 0)
            ext_map[iid] = {
                "dYTDAmtSld": _safe_float(er.get("dYTDAmtSld")),
                "dPrAmtSld": _safe_float(er.get("dPrAmtSld")),
                "dYTDUntSld": _safe_float(er.get("dYTDUntSld")),
                "dPrUntSld": _safe_float(er.get("dPrUntSld")),
                "dYTDCOGS": _safe_float(er.get("dYTDCOGS")),
                "dPriorCOGS": _safe_float(er.get("dPriorCOGS")),
                "dtLastSold": _safe_date(er.get("dtLastSold")),
            }

    total = len(rows)
    rows = rows.iloc[offset: offset + limit]

    result = []
    for _, r in rows.iterrows():
        iid = int(r.get("lId", 0) or 0)
        stk = stock_map.get(iid, {})
        ext_data = ext_map.get(iid, {})
        result.append({
            "lId": iid,
            "sPartCode": _safe_str(r.get("sPartCode")),
            "sName": _safe_str(r.get("sName")),
            "sSellUnit": _safe_str(r.get("sSellUnit")),
            "sBuyUnit": _safe_str(r.get("sBuyUnit")),
            "sStockUnit": _safe_str(r.get("sStockUnit")),
            "bService": bool(r.get("bService", 0)),
            "bInactive": bool(r.get("bInactive", 0)),
            "nInvType": int(r.get("nInvType", 0) or 0),
            "dInStock": stk.get("dInStock", 0.0),
            "dQtyOnOrd": stk.get("dQtyOnOrd", 0.0),
            "dQtyOnSO": stk.get("dQOnSalOrd", 0.0),
            "dLastCost": stk.get("dLastCost", 0.0),
            "dCostOfStock": stk.get("dCostStk", 0.0),
            "dYTDAmtSld": ext_data.get("dYTDAmtSld", 0.0),
            "dPrAmtSld": ext_data.get("dPrAmtSld", 0.0),
            "dYTDUntSld": ext_data.get("dYTDUntSld", 0.0),
            "dPrUntSld": ext_data.get("dPrUntSld", 0.0),
            "dYTDCOGS": ext_data.get("dYTDCOGS", 0.0),
            "dtLastSold": ext_data.get("dtLastSold"),
        })

    return {"inventory": result, "total": total, "source": "gdrive"}


def get_item_pricing(sage_item_id: int) -> dict:
    """Return all pricing tiers for a single Sage inventory item."""
    tables = _tables()
    prc_df = tables.get("tinvprc")
    if prc_df is None or prc_df.empty:
        return {"pricing": [], "error": "tinvprc not loaded"}

    rows = prc_df[prc_df["lInventId"] == sage_item_id]
    pricing = []
    for _, r in rows.iterrows():
        pl_id = int(r.get("lPrcListId", 1) or 1)
        cur_id = int(r.get("lCurrncyId", 1) or 1)
        pricing.append({
            "price_list_id": pl_id,
            "price_list_name": PRICE_LIST_NAMES.get(pl_id, f"List {pl_id}"),
            "currency_id": cur_id,
            "currency": CURRENCY_NAMES.get(cur_id, "CAD"),
            "price": _safe_float(r.get("dPrice")),
            "bSpecified": bool(r.get("bSpecified", 0)),
        })
    # Sort by price list, then currency
    pricing.sort(key=lambda x: (x["price_list_id"], x["currency_id"]))
    return {"item_id": sage_item_id, "pricing": pricing}


def get_item_by_part_code(part_code: str) -> dict | None:
    """Look up a Sage inventory item by sPartCode."""
    df = _tables().get("tinvent")
    if df is None or df.empty or "sPartCode" not in df.columns:
        return None
    norm = part_code.strip().upper()
    match = df[df["sPartCode"].fillna("").str.strip().str.upper() == norm]
    if match.empty:
        return None
    r = match.iloc[0]
    iid = int(r.get("lId", 0) or 0)
    pricing = get_item_pricing(iid)
    stk = {}
    byln = _tables().get("tinvbyln")
    if byln is not None and not byln.empty:
        byln_rows = byln[byln["lInventId"] == iid]
        stk = {
            "dInStock": float(byln_rows["dInStock"].sum()) if "dInStock" in byln_rows.columns else 0.0,
            "dLastCost": float(byln_rows["dLastCost"].max()) if "dLastCost" in byln_rows.columns else 0.0,
        }
    return {
        "lId": iid,
        "sPartCode": _safe_str(r.get("sPartCode")),
        "sName": _safe_str(r.get("sName")),
        "sSellUnit": _safe_str(r.get("sSellUnit")),
        "bService": bool(r.get("bService", 0)),
        "dInStock": stk.get("dInStock", 0.0),
        "dLastCost": stk.get("dLastCost", 0.0),
        "pricing": pricing.get("pricing", []),
    }


# ---------------------------------------------------------------------------
# Sales Orders
# ---------------------------------------------------------------------------

def get_sales_orders(search: str = None, customer_id: int = None,
                     date_from: str = None, date_to: str = None,
                     limit: int = 200, offset: int = 0) -> dict:
    """Return Sage sales orders with customer name joined."""
    tables = _tables()
    so_df = tables.get("tsalordr")
    cust_df = tables.get("tcustomr")
    if so_df is None or so_df.empty:
        return {"sales_orders": [], "total": 0, "source": "gdrive"}

    rows = so_df.copy()

    if customer_id:
        rows = rows[rows["lCusId"] == customer_id]

    if date_from and "dtSODate" in rows.columns:
        rows = rows[rows["dtSODate"].fillna("") >= date_from]
    if date_to and "dtSODate" in rows.columns:
        rows = rows[rows["dtSODate"].fillna("") <= date_to]

    if search:
        q = search.lower()
        mask = pd.Series([False] * len(rows), index=rows.index)
        for col in ["sSONum", "sName", "sComment"]:
            if col in rows.columns:
                mask |= rows[col].fillna("").astype(str).str.lower().str.contains(q, na=False)
        rows = rows[mask]

    # Join customer names
    cust_name_map = {}
    if cust_df is not None and not cust_df.empty and "lId" in cust_df.columns:
        for _, cr in cust_df[["lId", "sName"]].iterrows():
            cust_name_map[int(cr["lId"] or 0)] = _safe_str(cr["sName"])

    total = len(rows)
    if "lId" in rows.columns:
        rows = rows.sort_values("lId", ascending=False)
    rows = rows.iloc[offset: offset + limit]

    result = []
    for _, r in rows.iterrows():
        cid = int(r.get("lCusId", 0) or 0)
        result.append({
            "lId": int(r.get("lId", 0) or 0),
            "lCusId": cid,
            "sSONum": _safe_str(r.get("sSONum")),
            "sName": _safe_str(r.get("sName")),
            "sCustomerName": cust_name_map.get(cid, ""),
            "dtSODate": _safe_date(r.get("dtSODate")),
            "dtShipDate": _safe_date(r.get("dtShipDate")),
            "dTotal": _safe_float(r.get("dTotal")),
            "nFilled": int(r.get("nFilled", 0) or 0),
            "bQuote": bool(r.get("bQuote", 0)),
            "bCleared": bool(r.get("bCleared", 0)),
            "sShipper": _safe_str(r.get("sShipper")),
            "lCurrncyId": int(r.get("lCurrncyId", 1) or 1),
        })

    return {"sales_orders": result, "total": total, "source": "gdrive"}


def get_customer_item_sales(customer_search: str, item_code_search: str, limit: int = 500) -> dict:
    """
    Return all sales order lines where customer matches customer_search AND item matches item_code_search.
    Used for analytics: "How many times did we sell REOL46bdrm to Duke Energy?"

    Returns: {
        "records": [{"so_number", "customer_name", "item_code", "item_name", "quantity", "line_total", "order_date"}],
        "total_count": int,
        "customer_search": str,
        "item_search": str,
        "source": "gdrive"
    }
    """
    import re
    import difflib
    tables = _tables()
    so_df = tables.get("tsalordr")
    line_df = tables.get("tsoline")
    inv_df = tables.get("tinvent")
    cust_df = tables.get("tcustomr")

    if so_df is None or so_df.empty or line_df is None or line_df.empty:
        return {"records": [], "total_count": 0, "count": 0, "customer_search": customer_search, "item_search": item_code_search, "source": "gdrive", "error": "tsalordr or tsoline not loaded"}
    if inv_df is None or inv_df.empty:
        return {"records": [], "total_count": 0, "count": 0, "customer_search": customer_search, "item_search": item_code_search, "source": "gdrive", "error": "tinvent not loaded"}

    cust_search = (customer_search or "").strip()
    item_search = (item_code_search or "").strip()
    if not cust_search or not item_search:
        return {"records": [], "total_count": 0, "count": 0, "customer_search": cust_search, "item_search": item_search, "source": "gdrive", "error": "customer_search and item_code_search required"}

    cust_lower = cust_search.lower()
    item_lower = item_search.lower()
    item_parts = re.sub(r"[^a-z0-9]", "", item_lower)
    if len(item_parts) < 2:
        item_parts = item_lower

    # Product name → Sage code variants (e.g. reolube46b → reol46b for REOL46bdrm)
    _PRODUCT_ALIASES = [
        (r"reolube\s*", "reol"),
        (r"reolibe\s*", "reol"),   # common typo
        (r"reolue\s*", "reol"),    # missing b
        (r"anderol\s*", "anderol"),
        (r"mov\s*", "mov"),
    ]
    item_variants = [item_lower, item_parts]
    for pat, repl in _PRODUCT_ALIASES:
        if re.search(pat, item_lower):
            normalized = re.sub(pat, repl, item_lower, flags=re.IGNORECASE).replace(" ", "")
            item_variants.append(normalized)
            item_variants.append(re.sub(r"[^a-z0-9]", "", normalized))
            break

    cust_name_map = {}
    if cust_df is not None and not cust_df.empty and "lId" in cust_df.columns:
        for _, cr in cust_df[["lId", "sName"]].iterrows():
            cust_name_map[int(cr["lId"] or 0)] = _safe_str(cr["sName"])

    inv_map = {}
    if "lId" in inv_df.columns and "sPartCode" in inv_df.columns and "sName" in inv_df.columns:
        for _, ir in inv_df.iterrows():
            iid = int(ir.get("lId", 0) or 0)
            part = _safe_str(ir.get("sPartCode")).lower()
            name = _safe_str(ir.get("sName")).lower()
            inv_map[iid] = {"sPartCode": _safe_str(ir.get("sPartCode")), "sName": _safe_str(ir.get("sName"))}

    cust_ids = [
        cid for cid, cname in cust_name_map.items()
        if cust_lower in cname.lower()
    ]
    if not cust_ids:
        return {"records": [], "total_count": 0, "count": 0, "customer_search": cust_search, "item_search": item_search, "source": "gdrive", "note": f"No customers found matching '{cust_search}'"}

    so_ids = set()
    if "lCusId" in so_df.columns and "lId" in so_df.columns:
        for _, r in so_df.iterrows():
            if int(r.get("lCusId", 0) or 0) in cust_ids:
                so_ids.add(int(r.get("lId", 0) or 0))
    so_id_to_header = {}
    for _, r in so_df.iterrows():
        sid = int(r.get("lId", 0) or 0)
        if sid in so_ids:
            so_id_to_header[sid] = {
                "sSONum": _safe_str(r.get("sSONum")),
                "dtSODate": _safe_date(r.get("dtSODate")),
                "lCusId": int(r.get("lCusId", 0) or 0),
            }

    line_df = line_df[line_df["lSOId"].fillna(0).astype(int).isin(so_ids)].copy()
    if line_df.empty:
        return {"records": [], "total_count": 0, "count": 0, "customer_search": cust_search, "item_search": item_search, "source": "gdrive", "note": f"No sales lines for customers matching '{cust_search}'"}

    line_df["_invId"] = pd.to_numeric(line_df["lInventId"], errors="coerce").fillna(0).astype(int)
    for qcol in ["dQuantity", "dOrdered", "dQty", "dOrdQty", "dQtyOrd", "nQty"]:
        if qcol in line_df.columns:
            line_df["_qty"] = pd.to_numeric(line_df[qcol], errors="coerce").fillna(0.0)
            break
    else:
        line_df["_qty"] = 0.0
    if "dPrice" in line_df.columns:
        line_df["_price"] = pd.to_numeric(line_df["dPrice"], errors="coerce").fillna(0.0)
    else:
        line_df["_price"] = 0.0
    if "dAmount" in line_df.columns:
        line_df["_amt"] = pd.to_numeric(line_df["dAmount"], errors="coerce").fillna(0.0)
    else:
        line_df["_amt"] = line_df["_qty"] * line_df["_price"]
    if line_df["_amt"].sum() == 0 and "dPrice" in line_df.columns:
        line_df["_amt"] = pd.to_numeric(line_df["dPrice"], errors="coerce").fillna(0.0) * line_df["_qty"]
    # Fix 0.0 quantity when we have valid line total: derive qty from amount/price
    mask = (line_df["_qty"] == 0) & (line_df["_amt"] > 0) & (line_df["_price"] > 0)
    if mask.any():
        line_df.loc[mask, "_qty"] = line_df.loc[mask, "_amt"] / line_df.loc[mask, "_price"]

    records = []
    for _, row in line_df.iterrows():
        iid = int(row.get("_invId", 0) or 0)
        info = inv_map.get(iid, {"sPartCode": f"ID:{iid}", "sName": ""})
        part = info["sPartCode"].lower()
        name = info["sName"].lower()
        part_clean = re.sub(r"[^a-z0-9]", "", part)
        part_match = any(
            v in part or v in name or (len(v) >= 2 and v in part_clean)
            for v in item_variants
        )
        if not part_match and len(item_parts) >= 4:
            for v in item_variants:
                if len(v) >= 4 and (
                    difflib.SequenceMatcher(None, v, part).ratio() >= 0.75
                    or difflib.SequenceMatcher(None, v, part_clean).ratio() >= 0.75
                ):
                    part_match = True
                    break
        if not part_match:
            continue
        so_id = int(row.get("lSOId", 0) or 0)
        hdr = so_id_to_header.get(so_id, {})
        qty = float(row.get("_qty", 0) or 0)
        amt = float(row.get("_amt", 0) or 0)
        records.append({
            "so_number": hdr.get("sSONum", ""),
            "customer_name": cust_name_map.get(hdr.get("lCusId", 0), ""),
            "item_code": info["sPartCode"],
            "item_name": info["sName"],
            "quantity": round(qty, 2),
            "line_total": round(amt, 2),
            "order_date": hdr.get("dtSODate", ""),
        })

    records = records[:limit]
    return {"records": records, "total_count": len(records), "count": len(records), "customer_search": cust_search, "item_search": item_search, "source": "gdrive"}


def get_sales_order_by_number(so_number: str) -> dict | None:
    """
    Return a single sales order with line items by SO number (sSONum).
    Used for SO detail modal in AI Command Center.
    """
    tables = _tables()
    so_df = tables.get("tsalordr")
    line_df = tables.get("tsoline")
    inv_df = tables.get("tinvent")
    cust_df = tables.get("tcustomr")

    if so_df is None or so_df.empty or line_df is None or line_df.empty:
        return None

    so_num = str(so_number or "").strip()
    if not so_num:
        return None

    if "sSONum" not in so_df.columns:
        return None
    rows = so_df[so_df["sSONum"].fillna("").astype(str).str.strip() == so_num]
    if rows.empty:
        return None

    r = rows.iloc[0]
    so_id = int(r.get("lId", 0) or 0)
    cid = int(r.get("lCusId", 0) or 0)
    cust_name = ""
    if cust_df is not None and not cust_df.empty and "lId" in cust_df.columns:
        match = cust_df[cust_df["lId"] == cid]
        if not match.empty:
            cust_name = _safe_str(match.iloc[0].get("sName"))

    inv_map = {}
    if inv_df is not None and not inv_df.empty and "lId" in inv_df.columns:
        for _, ir in inv_df.iterrows():
            inv_map[int(ir.get("lId", 0) or 0)] = {
                "sPartCode": _safe_str(ir.get("sPartCode")),
                "sName": _safe_str(ir.get("sName")),
                "sSellUnit": _safe_str(ir.get("sSellUnit")),
            }

    lines_df = line_df[line_df["lSOId"].fillna(0).astype(int) == so_id].copy()
    for qcol in ["dQuantity", "dOrdered", "dQty", "dOrdQty", "dQtyOrd"]:
        if qcol in lines_df.columns:
            lines_df["_qty"] = pd.to_numeric(lines_df[qcol], errors="coerce").fillna(0.0)
            break
    else:
        lines_df["_qty"] = 0.0
    lines_df["_price"] = pd.to_numeric(lines_df["dPrice"], errors="coerce").fillna(0.0) if "dPrice" in lines_df.columns else 0.0
    if "dAmount" in lines_df.columns:
        lines_df["_amt"] = pd.to_numeric(lines_df["dAmount"], errors="coerce").fillna(0.0)
    else:
        lines_df["_amt"] = lines_df["_qty"] * lines_df["_price"]
    mask = (lines_df["_qty"] == 0) & (lines_df["_amt"] > 0) & (lines_df["_price"] > 0)
    if mask.any():
        lines_df.loc[mask, "_qty"] = lines_df.loc[mask, "_amt"] / lines_df.loc[mask, "_price"]

    lines = []
    for _, row in lines_df.iterrows():
        iid = int(row.get("lInventId", 0) or 0)
        info = inv_map.get(iid, {"sPartCode": f"ID:{iid}", "sName": "", "sSellUnit": ""})
        qty = float(row.get("_qty", 0) or 0)
        amt = float(row.get("_amt", 0) or 0)
        price = float(row.get("_price", 0) or 0)
        lines.append({
            "item_code": info["sPartCode"],
            "item_name": info["sName"],
            "unit": info["sSellUnit"],
            "quantity": round(qty, 2),
            "unit_price": round(price, 2),
            "line_total": round(amt, 2),
        })

    cur_id = int(r.get("lCurrncyId", 1) or 1)
    currency = "USD" if cur_id == 2 else "CAD"
    return {
        "so_number": _safe_str(r.get("sSONum")),
        "customer_name": cust_name,
        "order_date": _safe_date(r.get("dtSODate")),
        "ship_date": _safe_date(r.get("dtShipDate")),
        "total": round(_safe_float(r.get("dTotal")), 2),
        "currency": currency,
        "lines": lines,
        "source": "gdrive",
    }


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

def get_available_years() -> list:
    """Return only years that have actual invoiced revenue in titrec (dInvAmt > 0)."""
    df = _tables().get("titrec")
    if df is None or df.empty or "dtASDate" not in df.columns:
        return [datetime.now().year]

    rows = df.copy()
    rows["dtASDate"] = rows["dtASDate"].dropna().astype(str)

    # Only include years that have positive invoice amounts (real revenue)
    if "dInvAmt" in rows.columns:
        rows["_amt"] = pd.to_numeric(rows["dInvAmt"], errors="coerce").fillna(0)
        rows = rows[rows["_amt"] > 0]

    dates = rows["dtASDate"].astype(str)
    years = sorted(
        set(int(d[:4]) for d in dates if len(d) >= 4 and d[:4].isdigit()),
        reverse=True,
    )
    return years if years else [datetime.now().year]


def get_available_years_with_meta() -> dict:
    """Return years plus date range info for debugging year-to-year data availability."""
    df = _tables().get("titrec")
    if df is None or df.empty:
        return {"years": [datetime.now().year], "date_range": None, "row_count": 0, "note": "titrec not loaded"}
    if "dtASDate" not in df.columns:
        return {"years": [datetime.now().year], "date_range": None, "row_count": len(df), "note": "dtASDate column missing"}

    rows = df.copy()
    rows["dtASDate"] = rows["dtASDate"].dropna().astype(str)
    valid_dates = [d for d in rows["dtASDate"].astype(str) if len(d) >= 8 and d[:4].isdigit() and d[4:6].isdigit()]

    if "dInvAmt" in rows.columns:
        rows["_amt"] = pd.to_numeric(rows["dInvAmt"], errors="coerce").fillna(0)
        rows = rows[rows["_amt"] > 0]
        dates = rows["dtASDate"].astype(str)
    else:
        dates = rows["dtASDate"].astype(str)

    years = sorted(
        set(int(d[:4]) for d in dates if len(d) >= 4 and d[:4].isdigit()),
        reverse=True,
    )
    years = years if years else [datetime.now().year]

    date_range = None
    if valid_dates:
        date_range = {"min": min(valid_dates)[:10], "max": max(valid_dates)[:10]}

    return {
        "years": years,
        "date_range": date_range,
        "row_count": len(df),
        "note": "Year-to-year data depends on titrec.CSV having historical dates. Ensure G Drive export includes full history." if len(years) <= 1 else None,
    }


def _customer_revenue_from_titrec(year: int) -> dict:
    """Aggregate per-customer revenue from titrec for a given year."""
    df = _tables().get("titrec")
    if df is None or df.empty:
        return {}
    rows = df[df["dtASDate"].fillna("").astype(str).str.startswith(str(year))].copy()
    if rows.empty or "lCusId" not in rows.columns or "dInvAmt" not in rows.columns:
        return {}
    rows["_amt"] = pd.to_numeric(rows["dInvAmt"], errors="coerce").fillna(0.0)
    rows["_cid"] = pd.to_numeric(rows["lCusId"], errors="coerce").fillna(0).astype(int)
    grouped = rows.groupby("_cid")["_amt"].sum()
    return {int(cid): float(v) for cid, v in grouped.items() if int(cid) != 0}


def _item_stats_from_titrline(year: int) -> dict:
    """Aggregate per-item revenue/qty/cogs from titrline for a given year via titrec join."""
    tables = _tables()
    lines = tables.get("titrline")
    if lines is None or lines.empty or "lInventId" not in lines.columns:
        return {}

    trec = tables.get("titrec")
    lines = lines.copy()

    # Filter by year — join via lTransId → titrec.lId if possible, else use dtASDate on lines
    if trec is not None and not trec.empty and "dtASDate" in trec.columns and "lId" in trec.columns:
        year_ids = set(
            pd.to_numeric(
                trec[trec["dtASDate"].fillna("").astype(str).str.startswith(str(year))]["lId"],
                errors="coerce",
            ).fillna(0).astype(int).tolist()
        )
        if "lTransId" in lines.columns:
            lines = lines[
                pd.to_numeric(lines["lTransId"], errors="coerce").fillna(0).astype(int).isin(year_ids)
            ]
    elif "dtASDate" in lines.columns:
        lines = lines[lines["dtASDate"].fillna("").astype(str).str.startswith(str(year))]

    if lines.empty:
        return {}

    lines["_rev"] = pd.to_numeric(lines.get("dAmt", pd.Series(0.0, index=lines.index)), errors="coerce").fillna(0.0)
    lines["_qty"] = pd.to_numeric(lines.get("dQty", pd.Series(0.0, index=lines.index)), errors="coerce").fillna(0.0)
    lines["_cogs"] = pd.to_numeric(lines.get("dCost", pd.Series(0.0, index=lines.index)), errors="coerce").fillna(0.0)
    lines["_invId"] = pd.to_numeric(lines["lInventId"], errors="coerce").fillna(0).astype(int)

    grouped = lines.groupby("_invId").agg(
        total_revenue=("_rev", "sum"),
        total_qty=("_qty", "sum"),
        total_cogs=("_cogs", "sum"),
        txn_count=("_rev", "count"),
    ).reset_index()

    return {
        int(r["_invId"]): {
            "total_revenue": round(float(r["total_revenue"]), 2),
            "total_qty": round(float(r["total_qty"]), 2),
            "total_cogs": round(float(r["total_cogs"]), 2),
            "txn_count": int(r["txn_count"]),
        }
        for _, r in grouped.iterrows()
        if int(r["_invId"]) != 0
    }


def get_top_customers(limit: int = 25, year: int = None) -> dict:
    """
    Rank customers by YTD sales.
    - current year (or None): uses dAmtYtd / dLastYrAmt from tcustomr (Sage's own fields)
    - any other year: aggregates from titrec transaction journal
    """
    current_year = datetime.now().year
    use_sage_fields = (year is None or year == current_year)

    df = _tables().get("tcustomr")
    if df is None or df.empty:
        return {"customers": [], "error": "tcustomr not loaded"}

    rows = df[df["bInactive"].fillna(0) == 0].copy() if "bInactive" in df.columns else df.copy()

    # For non-current years, pull revenue from transaction journal
    txn_rev: dict = {}
    if not use_sage_fields:
        txn_rev = _customer_revenue_from_titrec(year)

    result = []
    for _, r in rows.iterrows():
        cid = int(r.get("lId", 0) or 0)
        credit = _safe_float(r.get("dCrLimit"))
        if use_sage_fields:
            ytd = _safe_float(r.get("dAmtYtd"))
            ly = _safe_float(r.get("dLastYrAmt"))
        else:
            ytd = txn_rev.get(cid, 0.0)
            # prior year for YoY
            prev_txn = _customer_revenue_from_titrec(year - 1) if year else {}
            ly = prev_txn.get(cid, 0.0)
        if ytd <= 0 and ly <= 0:
            continue
        result.append({
            "lId": cid,
            "sName": _safe_str(r.get("sName")),
            "sCity": _safe_str(r.get("sCity")),
            "sProvState": _safe_str(r.get("sProvState")),
            "dAmtYtd": round(ytd, 2),
            "dLastYrAmt": round(ly, 2),
            "dCrLimit": round(credit, 2),
            "yoy_change_pct": round((ytd - ly) / ly * 100, 1) if ly > 0 else None,
            "credit_utilization_pct": round(ytd / credit * 100, 1) if credit > 0 else None,
            "currency": CURRENCY_NAMES.get(int(r.get("lCurrncyId", 1) or 1), "CAD"),
            "price_list": PRICE_LIST_NAMES.get(int(r.get("lPrcListId", 1) or 1), "Regular"),
            "dtLastSal": _safe_date(r.get("dtLastSal")),
            "nNetDay": int(r.get("nNetDay", 0) or 0),
        })

    result.sort(key=lambda x: x["dAmtYtd"], reverse=True)
    return {"customers": result[:limit], "total": len(result), "year": year or current_year}


def get_best_movers(limit: int = 25, year: int = None) -> dict:
    """
    Rank inventory items by units sold.
    - current year (or None): uses dYTDUntSld from tinvext (Sage's own fields)
    - any other year: aggregates from titrline transaction lines
    """
    current_year = datetime.now().year
    use_sage_fields = (year is None or year == current_year)

    tables = _tables()
    inv = tables.get("tinvent")

    # Build item name map
    name_map: dict[int, dict] = {}
    if inv is not None and not inv.empty:
        for _, r in inv.iterrows():
            iid = int(r.get("lId", 0) or 0)
            name_map[iid] = {
                "sPartCode": _safe_str(r.get("sPartCode")),
                "sName": _safe_str(r.get("sName")),
                "sSellUnit": _safe_str(r.get("sSellUnit")),
            }

    if use_sage_fields:
        ext = tables.get("tinvext")
        if ext is None or ext.empty:
            return {"items": [], "error": "tinvext not loaded"}
        result = []
        for _, r in ext.iterrows():
            iid = int(r.get("lInventId", 0) or 0)
            ytd_units = _safe_float(r.get("dYTDUntSld"))
            ytd_rev = _safe_float(r.get("dYTDAmtSld"))
            ly_units = _safe_float(r.get("dPrUntSld"))
            ly_rev = _safe_float(r.get("dPrAmtSld"))
            ytd_cogs = _safe_float(r.get("dYTDCOGS"))
            if ytd_units <= 0 and ly_units <= 0:
                continue
            item_info = name_map.get(iid, {})
            margin = round((ytd_rev - ytd_cogs) / ytd_rev * 100, 1) if ytd_rev > 0 else None
            result.append({
                "lInventId": iid,
                "sPartCode": item_info.get("sPartCode", f"ID:{iid}"),
                "sName": item_info.get("sName", ""),
                "sSellUnit": item_info.get("sSellUnit", ""),
                "dYTDUntSld": round(ytd_units, 2),
                "dPrUntSld": round(ly_units, 2),
                "dYTDAmtSld": round(ytd_rev, 2),
                "dPrAmtSld": round(ly_rev, 2),
                "dYTDCOGS": round(ytd_cogs, 2),
                "estimated_margin_pct": margin,
                "units_yoy_pct": round((ytd_units - ly_units) / ly_units * 100, 1) if ly_units > 0 else None,
                "dtLastSold": _safe_date(r.get("dtLastSold")),
            })
    else:
        # Use transaction lines
        stats = _item_stats_from_titrline(year)
        prev_stats = _item_stats_from_titrline(year - 1)
        result = []
        for iid, s in stats.items():
            if s["total_revenue"] <= 0:
                continue
            item_info = name_map.get(iid, {"sPartCode": f"ID:{iid}", "sName": "", "sSellUnit": ""})
            py = prev_stats.get(iid, {})
            ytd_rev = s["total_revenue"]
            ytd_cogs = s["total_cogs"]
            ly_units = py.get("total_qty", 0.0)
            ytd_units = s["total_qty"]
            margin = round((ytd_rev - ytd_cogs) / ytd_rev * 100, 1) if ytd_rev > 0 else None
            result.append({
                "lInventId": iid,
                "sPartCode": item_info.get("sPartCode", f"ID:{iid}"),
                "sName": item_info.get("sName", ""),
                "sSellUnit": item_info.get("sSellUnit", ""),
                "dYTDUntSld": round(ytd_units, 2),
                "dPrUntSld": round(ly_units, 2),
                "dYTDAmtSld": round(ytd_rev, 2),
                "dPrAmtSld": round(py.get("total_revenue", 0.0), 2),
                "dYTDCOGS": round(ytd_cogs, 2),
                "estimated_margin_pct": margin,
                "units_yoy_pct": round((ytd_units - ly_units) / ly_units * 100, 1) if ly_units > 0 else None,
                "dtLastSold": None,
            })

    result.sort(key=lambda x: x["dYTDUntSld"], reverse=True)
    return {"items": result[:limit], "total": len(result), "year": year or current_year}


def get_monthly_revenue(year: int = None) -> dict:
    """
    Compute monthly invoiced revenue from titrec (journal type 1 = AR invoices).
    Returns 12 months of data for the requested year (defaults to current year).
    """
    if year is None:
        year = datetime.now().year

    df = _tables().get("titrec")
    if df is None or df.empty:
        return {"year": year, "months": [], "error": "titrec not loaded"}

    if "dtASDate" not in df.columns:
        return {"year": year, "months": [], "error": "dtASDate column missing"}

    # Filter to sales-side journals (nJournal == 1 or 7 = sales journal, 11 = invoice)
    # Use all positive dInvAmt transactions to approximate revenue
    rows = df.copy()
    rows["dtASDate"] = rows["dtASDate"].fillna("").astype(str)
    year_str = str(year)

    # Filter to requested year
    rows = rows[rows["dtASDate"].str.startswith(year_str)]
    if rows.empty:
        return {"year": year, "months": [{"month": m, "month_name": _month_name(m), "revenue": 0.0, "order_count": 0} for m in range(1, 13)]}

    # Extract month
    rows["_month"] = rows["dtASDate"].str[5:7].str.lstrip("0")

    # Use dInvAmt as the invoice amount (positive = revenue)
    if "dInvAmt" in rows.columns:
        rows["_amt"] = pd.to_numeric(rows["dInvAmt"], errors="coerce").fillna(0.0)
    else:
        rows["_amt"] = 0.0

    monthly = rows.groupby("_month").agg(revenue=("_amt", "sum"), order_count=("_amt", "count")).reset_index()
    monthly["month_num"] = monthly["_month"].apply(lambda m: int(m) if m.isdigit() else 0)

    months_result = []
    for m in range(1, 13):
        row = monthly[monthly["month_num"] == m]
        rev = float(row["revenue"].iloc[0]) if len(row) > 0 else 0.0
        cnt = int(row["order_count"].iloc[0]) if len(row) > 0 else 0
        months_result.append({
            "month": m,
            "month_name": _month_name(m),
            "revenue": round(rev, 2),
            "order_count": cnt,
        })

    total_rev = sum(m["revenue"] for m in months_result)
    return {"year": year, "months": months_result, "total_revenue": round(total_rev, 2)}


def _month_name(m: int) -> str:
    names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
             "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return names[m] if 1 <= m <= 12 else str(m)


def get_recent_invoices(limit: int = 100) -> dict:
    """
    List recent invoice transactions from titrec (AR invoices, dInvAmt > 0).
    Joins with tcustomr for customer name.
    """
    tables = _tables()
    df = tables.get("titrec")
    cname_df = tables.get("tcustomr")
    if df is None or df.empty:
        return {"invoices": [], "error": "titrec not loaded"}

    cust_name_map: dict[int, str] = {}
    if cname_df is not None and not cname_df.empty and "lId" in cname_df.columns:
        for _, r in cname_df[["lId", "sName"]].iterrows():
            cust_name_map[int(r["lId"] or 0)] = _safe_str(r["sName"])

    rows = df.copy()
    if "dInvAmt" not in rows.columns or "dtASDate" not in rows.columns:
        return {"invoices": [], "error": "titrec missing dInvAmt or dtASDate"}
    rows["_amt"] = pd.to_numeric(rows["dInvAmt"], errors="coerce").fillna(0)
    rows = rows[rows["_amt"] > 0]
    rows = rows.sort_values("dtASDate", ascending=False).head(limit)

    invoices = []
    for _, r in rows.iterrows():
        cus_id = int(r.get("lCusId", 0) or 0)
        invoices.append({
            "lId": int(r.get("lId", 0) or 0),
            "dtASDate": _safe_str(r.get("dtASDate")),
            "dInvAmt": round(float(r["_amt"]), 2),
            "lCusId": cus_id,
            "sName": cust_name_map.get(cus_id, ""),
            "sSource": _safe_str(r.get("sSource")),
        })
    return {"invoices": invoices, "total": len(invoices)}


def get_ar_aging() -> dict:
    """
    Compute AR aging from tcustr (customer transaction journal).
    Groups outstanding balances into 0-30, 31-60, 61-90, 90+ day buckets.
    Falls back to titrec (invoice header table) if tcustr yields $0.
    """
    tables = _tables()
    cust_df = tables.get("tcustr")
    cname_df = tables.get("tcustomr")

    # Build customer name map
    cust_name_map: dict[int, str] = {}
    if cname_df is not None and not cname_df.empty and "lId" in cname_df.columns:
        for _, r in cname_df[["lId", "sName"]].iterrows():
            cust_name_map[int(r["lId"] or 0)] = _safe_str(r["sName"])

    # ── Diagnostic logging ─────────────────────────────────────────────────────
    if cust_df is not None and not cust_df.empty:
        print(f"[ar_aging] tcustr loaded: {len(cust_df)} rows, columns: {list(cust_df.columns)[:20]}")
    else:
        print("[ar_aging] tcustr is None or empty — falling back to titrec")

    today = date.today()
    buckets: dict[int, dict] = {}

    def _add_to_bucket(cid: int, amt: float, dt_str: str):
        """Add outstanding amount to the correct aging bucket for a customer."""
        if amt == 0:
            return
        age = 999
        if dt_str and len(dt_str) >= 10:
            try:
                age = (today - date.fromisoformat(dt_str[:10])).days
            except Exception:
                pass
        if cid not in buckets:
            buckets[cid] = {"lCusId": cid, "sName": cust_name_map.get(cid, f"ID:{cid}"),
                            "current": 0.0, "d30": 0.0, "d60": 0.0, "d90": 0.0, "d90plus": 0.0, "total": 0.0}
        buckets[cid]["total"] += amt
        if age <= 30:
            buckets[cid]["current"] += amt
        elif age <= 60:
            buckets[cid]["d30"] += amt
        elif age <= 90:
            buckets[cid]["d60"] += amt
        elif age <= 120:
            buckets[cid]["d90"] += amt
        else:
            buckets[cid]["d90plus"] += amt

    # ── Primary: tcustr ────────────────────────────────────────────────────────
    if cust_df is not None and not cust_df.empty:
        cols = set(cust_df.columns)
        # Try several possible column names for outstanding balance
        bal_col = next((c for c in ["dBalance", "dCurrntBal", "dAmtDue", "dAmtOwing",
                                     "dOutstanding", "dBal", "dOpenBal"] if c in cols), None)
        # Try possible column names for due/transaction date
        date_col = next((c for c in ["dtDueDate", "dtDate", "dtInvDate", "dtTxDate"] if c in cols), None)
        # Customer ID column
        cid_col = next((c for c in ["lCusId", "lCustomerId", "lCustId"] if c in cols), None)

        print(f"[ar_aging] tcustr columns detected → balance:{bal_col}, date:{date_col}, cid:{cid_col}")

        if bal_col and cid_col:
            for _, r in cust_df.iterrows():
                cid = int(r.get(cid_col, 0) or 0)
                # Some Sage exports store invoice amount in one col and applied in another
                if bal_col in cols:
                    amt = _safe_float(r.get(bal_col, 0))
                else:
                    # Compute outstanding = dAmt - dApplied
                    raw_amt = _safe_float(r.get("dAmt", 0) or r.get("dInvAmt", 0))
                    applied = _safe_float(r.get("dApplied", 0) or r.get("dPaid", 0))
                    amt = raw_amt - applied
                dt_str = _safe_date(r.get(date_col) if date_col else None)
                _add_to_bucket(cid, amt, dt_str or "")
        else:
            # No balance column found — try dAmt - dApplied
            print("[ar_aging] No balance column found in tcustr — trying dAmt-dApplied")
            amt_col = next((c for c in ["dAmt", "dInvAmt"] if c in cols), None)
            applied_col = next((c for c in ["dApplied", "dPaid", "dAmtPaid"] if c in cols), None)
            cid_col = cid_col or next((c for c in ["lCusId", "lCustomerId", "lCustId"] if c in cols), None)
            date_col = date_col or next((c for c in ["dtDueDate", "dtDate"] if c in cols), None)
            if amt_col and cid_col:
                for _, r in cust_df.iterrows():
                    cid = int(r.get(cid_col, 0) or 0)
                    raw_amt = _safe_float(r.get(amt_col, 0))
                    applied = _safe_float(r.get(applied_col, 0)) if applied_col else 0.0
                    amt = raw_amt - applied
                    dt_str = _safe_date(r.get(date_col) if date_col else None)
                    _add_to_bucket(cid, amt, dt_str or "")

    # ── Fallback: titrec (invoice transaction headers) ─────────────────────────
    # If tcustr gave $0, try computing AR from open invoices in titrec
    grand_total_check = sum(b["total"] for b in buckets.values())
    if grand_total_check == 0:
        print("[ar_aging] tcustr gave $0 — falling back to titrec for open invoices")
        titrec_df = tables.get("titrec")
        if titrec_df is not None and not titrec_df.empty:
            t_cols = set(titrec_df.columns)
            print(f"[ar_aging] titrec columns: {list(t_cols)[:25]}")
            # Look for invoice amount and balance due columns
            inv_col = next((c for c in ["dInvAmt", "dAmt", "dTotalAmt"] if c in t_cols), None)
            paid_col = next((c for c in ["dAmtPaid", "dApplied", "dPaid", "dPayAmt"] if c in t_cols), None)
            bal_due_col = next((c for c in ["dBalDue", "dBalance", "dAmtDue"] if c in t_cols), None)
            due_col = next((c for c in ["dtDueDate", "dtDate", "dtASDate"] if c in t_cols), None)
            cid_col = next((c for c in ["lCusId", "lCustomerId", "lCustId"] if c in t_cols), None)
            # Only look at invoice-type transactions (positive amounts)
            if inv_col and cid_col:
                rows = titrec_df.copy()
                rows["_inv"] = pd.to_numeric(rows[inv_col], errors="coerce").fillna(0)
                rows = rows[rows["_inv"] > 0]  # invoices only (not payments)
                if bal_due_col and bal_due_col in t_cols:
                    rows["_bal"] = pd.to_numeric(rows[bal_due_col], errors="coerce").fillna(0)
                elif paid_col and paid_col in t_cols:
                    rows["_paid"] = pd.to_numeric(rows[paid_col], errors="coerce").fillna(0)
                    rows["_bal"] = rows["_inv"] - rows["_paid"]
                else:
                    rows["_bal"] = rows["_inv"]  # assume all unpaid if no payment column
                rows = rows[rows["_bal"] > 0]  # only open/partially-open invoices
                print(f"[ar_aging] titrec: {len(rows)} open invoices found")
                for _, r in rows.iterrows():
                    cid = int(r.get(cid_col, 0) or 0)
                    amt = _safe_float(r.get("_bal", 0))
                    dt_str = _safe_date(r.get(due_col) if due_col else None)
                    _add_to_bucket(cid, amt, dt_str or "")

    result = sorted(buckets.values(), key=lambda x: abs(x["total"]), reverse=True)
    for row in result:
        for k in ["current", "d30", "d60", "d90", "d90plus", "total"]:
            row[k] = round(row[k], 2)

    grand_total = sum(r["total"] for r in result)
    print(f"[ar_aging] Final AR aging: {len(result)} customers, total_ar=${grand_total:,.2f}")
    return {"aging": result[:50], "total_ar": round(grand_total, 2), "total_customers": len(result)}


def get_sales_by_product(limit: int = 25, year: int = None) -> dict:
    """
    Aggregate titrline by lInventId to compute revenue per product.
    - year=None → all-time (all transaction lines)
    - year=YYYY → filter to that year via titrec join
    """
    current_year = datetime.now().year
    inv = _tables().get("tinvent")

    name_map: dict[int, dict] = {}
    if inv is not None and not inv.empty:
        for _, r in inv.iterrows():
            iid = int(r.get("lId", 0) or 0)
            name_map[iid] = {"sPartCode": _safe_str(r.get("sPartCode")), "sName": _safe_str(r.get("sName"))}

    if year is not None:
        stats = _item_stats_from_titrline(year)
    else:
        # All-time: use full titrline without year filter
        tables = _tables()
        lines = tables.get("titrline")
        if lines is None or lines.empty:
            return {"products": [], "error": "titrline not loaded"}
        if "lInventId" not in lines.columns:
            return {"products": [], "error": "lInventId column missing from titrline"}
        lines = lines.copy()
        lines["_rev"] = pd.to_numeric(lines.get("dAmt", pd.Series(0.0, index=lines.index)), errors="coerce").fillna(0.0)
        lines["_qty"] = pd.to_numeric(lines.get("dQty", pd.Series(0.0, index=lines.index)), errors="coerce").fillna(0.0)
        lines["_cogs"] = pd.to_numeric(lines.get("dCost", pd.Series(0.0, index=lines.index)), errors="coerce").fillna(0.0)
        lines["_invId"] = pd.to_numeric(lines["lInventId"], errors="coerce").fillna(0).astype(int)
        grouped = lines.groupby("_invId").agg(
            total_revenue=("_rev", "sum"), total_qty=("_qty", "sum"),
            total_cogs=("_cogs", "sum"), txn_count=("_rev", "count"),
        ).reset_index()
        stats = {
            int(r["_invId"]): {
                "total_revenue": round(float(r["total_revenue"]), 2),
                "total_qty": round(float(r["total_qty"]), 2),
                "total_cogs": round(float(r["total_cogs"]), 2),
                "txn_count": int(r["txn_count"]),
            }
            for _, r in grouped.iterrows() if int(r["_invId"]) != 0
        }

    result = []
    for iid, s in stats.items():
        rev = s["total_revenue"]
        if rev <= 0:
            continue
        cogs = s["total_cogs"]
        info = name_map.get(iid, {"sPartCode": f"ID:{iid}", "sName": ""})
        margin = round((rev - cogs) / rev * 100, 1) if rev > 0 else None
        result.append({
            "lInventId": iid,
            "sPartCode": info["sPartCode"],
            "sName": info["sName"],
            "total_revenue": round(rev, 2),
            "total_qty": round(s["total_qty"], 2),
            "total_cogs": round(cogs, 2),
            "estimated_margin_pct": margin,
            "txn_count": s["txn_count"],
        })

    result.sort(key=lambda x: x["total_revenue"], reverse=True)
    return {"products": result[:limit], "total": len(result), "year": year, "all_time": year is None}


def get_dashboard_kpis(year: int = None) -> dict:
    """Return summary KPIs for the Sage Analytics dashboard header.
    - year=None or current year → uses Sage's own dAmtYtd / dLastYrAmt fields (fast, accurate)
    - any other year → aggregates from titrec transaction journal
    """
    current_year = datetime.now().year
    use_sage_fields = (year is None or year == current_year)
    resolved_year = year or current_year

    tables = _tables()

    # Customer totals
    cust = tables.get("tcustomr")
    total_ytd = 0.0
    total_ly = 0.0
    active_customers = 0
    if cust is not None and not cust.empty:
        active = cust[cust["bInactive"].fillna(0) == 0] if "bInactive" in cust.columns else cust
        active_customers = len(active)
        if use_sage_fields:
            total_ytd = float(pd.to_numeric(active["dAmtYtd"], errors="coerce").fillna(0).sum())
            total_ly = float(pd.to_numeric(active["dLastYrAmt"], errors="coerce").fillna(0).sum())
        else:
            rev_map = _customer_revenue_from_titrec(resolved_year)
            prev_map = _customer_revenue_from_titrec(resolved_year - 1)
            total_ytd = sum(rev_map.values())
            total_ly = sum(prev_map.values())

    # Open SOs — always current (not year-filtered)
    so = tables.get("tsalordr")
    open_sos = 0
    open_so_value = 0.0
    if so is not None and not so.empty:
        unfilled = so[so["nFilled"].fillna(0) < 2] if "nFilled" in so.columns else so
        unfilled = unfilled[unfilled["bCleared"].fillna(0) == 0] if "bCleared" in unfilled.columns else unfilled
        unfilled = unfilled[unfilled["bQuote"].fillna(0) == 0] if "bQuote" in unfilled.columns else unfilled
        open_sos = len(unfilled)
        open_so_value = float(pd.to_numeric(unfilled.get("dTotal", pd.Series()), errors="coerce").fillna(0).sum())

    # Inventory
    inv = tables.get("tinvent")
    active_items = 0
    if inv is not None and not inv.empty:
        active_items = len(inv[inv["bInactive"].fillna(0) == 0]) if "bInactive" in inv.columns else len(inv)

    yoy_pct = round((total_ytd - total_ly) / total_ly * 100, 1) if total_ly > 0 else None

    return {
        "total_ytd_revenue": round(total_ytd, 2),
        "total_ly_revenue": round(total_ly, 2),
        "yoy_revenue_pct": yoy_pct,
        "active_customers": active_customers,
        "open_sales_orders": open_sos,
        "open_so_value": round(open_so_value, 2),
        "active_inventory_items": active_items,
        "data_folder": _cache_folder,
        "source": "gdrive",
        "year": resolved_year,
        "is_ytd": use_sage_fields and resolved_year == current_year,
    }


# ---------------------------------------------------------------------------
# MO Sage Tab data
# ---------------------------------------------------------------------------

def get_mo_sage_data(customer_name: str, build_item_misys_id: str = None,
                     component_misys_ids: list = None) -> dict:
    """
    Full Sage data for the MO detail 'Sage' tab.
    - customer_name: from the MO header
    - build_item_misys_id: MiSys item ID for the finished goods item
    - component_misys_ids: list of MiSys item IDs for BOM components
    Returns customer info, recent orders, build item pricing (if mapped), component pricing.
    """
    result: dict = {
        "customer": None,
        "build_item": None,
        "components": [],
        "mapping_note": "",
    }

    # Customer lookup
    if customer_name:
        cust = get_customer_by_name(customer_name)
        if cust:
            result["customer"] = cust
        else:
            result["mapping_note"] = f"No Sage customer found matching '{customer_name}'"

    # Build item lookup — requires item mapping
    if build_item_misys_id:
        mapping = _get_item_mapping(build_item_misys_id)
        if mapping and mapping.get("confirmed"):
            item = get_item_by_part_code(mapping["sage_part_code"])
            if item:
                result["build_item"] = item
                result["build_item"]["misys_item_id"] = build_item_misys_id
                result["build_item"]["mapping_confidence"] = mapping.get("confidence")

    # Component lookups
    for comp_id in (component_misys_ids or []):
        mapping = _get_item_mapping(comp_id)
        if mapping and mapping.get("confirmed"):
            item = get_item_by_part_code(mapping["sage_part_code"])
            if item:
                item["misys_item_id"] = comp_id
                item["mapping_confidence"] = mapping.get("confidence")
                result["components"].append(item)

    return result


# ---------------------------------------------------------------------------
# Item Mapping (JSON file, requires manual confirmation for 100% accuracy)
# ---------------------------------------------------------------------------

_MAPPING_FILE = os.path.join(os.path.dirname(__file__), "sage_item_mapping.json")


def _load_mapping_file() -> dict:
    if os.path.isfile(_MAPPING_FILE):
        try:
            with open(_MAPPING_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"mappings": [], "last_run": None, "stats": {}}


def _save_mapping_file(data: dict):
    with open(_MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def _get_item_mapping(misys_item_id: str) -> dict | None:
    data = _load_mapping_file()
    for m in data.get("mappings", []):
        if m.get("misys_item_id", "").strip().upper() == misys_item_id.strip().upper():
            return m
    return None


def get_item_mapping_for_item(misys_item_id: str) -> dict | None:
    """Return the mapping for a single MiSys item (for display on item page)."""
    return _get_item_mapping(misys_item_id)


def get_all_item_mappings() -> dict:
    """Return all item mappings from the JSON file."""
    data = _load_mapping_file()
    mappings = data.get("mappings", [])
    confirmed = [m for m in mappings if m.get("confirmed")]
    unconfirmed = [m for m in mappings if not m.get("confirmed") and m.get("sage_part_code")]
    unmatched = [m for m in mappings if not m.get("sage_part_code")]
    return {
        "mappings": mappings,
        "confirmed_count": len(confirmed),
        "suggested_count": len(unconfirmed),
        "unmatched_count": len(unmatched),
        "total": len(mappings),
        "last_run": data.get("last_run"),
        "mapping_file": _MAPPING_FILE,
    }


def suggest_item_mappings(misys_items: list) -> dict:
    """
    Generate item mapping suggestions using exact and fuzzy matching.
    Exact matches (itemId == sPartCode, case-insensitive) are flagged 'exact'.
    Fuzzy matches are flagged 'suggested' and require manual confirmation.
    Saves to sage_item_mapping.json. Does NOT auto-confirm anything.
    """
    from difflib import SequenceMatcher

    tables = _tables()
    inv_df = tables.get("tinvent")
    if inv_df is None or inv_df.empty:
        return {"error": "Sage inventory not loaded — cannot generate suggestions"}

    def _norm(s):
        return str(s or "").strip().upper().replace(".", "").replace(",", "").replace(" ", "")

    # Build Sage lookup: normalised_code -> {sage_part_code, lId, sName}
    sage_lookup: dict[str, dict] = {}
    for _, sr in inv_df.iterrows():
        code = _safe_str(sr.get("sPartCode"))
        if code:
            sage_lookup[_norm(code)] = {
                "sage_part_code": code,
                "sage_item_id": int(sr.get("lId", 0) or 0),
                "sage_name": _safe_str(sr.get("sName")),
            }

    # Load existing file (to preserve confirmed mappings)
    existing_data = _load_mapping_file()
    existing_map: dict[str, dict] = {
        m["misys_item_id"].strip().upper(): m
        for m in existing_data.get("mappings", [])
    }

    new_mappings = []
    exact_count = 0
    fuzzy_count = 0
    unmatched_count = 0

    for item in misys_items:
        misys_id = _safe_str(item.get("Item No.") or item.get("itemId") or item.get("item_no") or "")
        misys_desc = _safe_str(item.get("Description") or item.get("descr") or "")
        if not misys_id:
            continue

        key = misys_id.strip().upper()

        # Preserve existing confirmed mapping
        if key in existing_map and existing_map[key].get("confirmed"):
            new_mappings.append(existing_map[key])
            continue

        norm_id = _norm(misys_id)
        norm_desc = _norm(misys_desc)

        # Try exact match on part code
        if norm_id in sage_lookup:
            match = sage_lookup[norm_id]
            new_mappings.append({
                "misys_item_id": misys_id,
                "misys_description": misys_desc,
                "sage_part_code": match["sage_part_code"],
                "sage_item_id": match["sage_item_id"],
                "sage_description": match["sage_name"],
                "confidence": "exact",
                "score": 1.0,
                "confirmed": False,
                "confirmed_by": None,
                "confirmed_at": None,
                "note": "Exact part code match — review and confirm",
            })
            exact_count += 1
            continue

        # Fuzzy match: score against all Sage codes AND descriptions
        best_score = 0.0
        best_match = None

        for norm_s, sinfo in sage_lookup.items():
            # Score against code
            score_code = SequenceMatcher(None, norm_id, norm_s).ratio()
            # Score against description
            score_desc = SequenceMatcher(None, norm_desc, _norm(sinfo["sage_name"])).ratio()
            score = max(score_code, score_desc * 0.9)  # Weight code slightly higher
            if score > best_score:
                best_score = score
                best_match = sinfo

        if best_match and best_score >= 0.70:
            new_mappings.append({
                "misys_item_id": misys_id,
                "misys_description": misys_desc,
                "sage_part_code": best_match["sage_part_code"],
                "sage_item_id": best_match["sage_item_id"],
                "sage_description": best_match["sage_name"],
                "confidence": "suggested",
                "score": round(best_score, 3),
                "confirmed": False,
                "confirmed_by": None,
                "confirmed_at": None,
                "note": f"Fuzzy match (score {round(best_score * 100)}%) — MUST review before use",
            })
            fuzzy_count += 1
        else:
            new_mappings.append({
                "misys_item_id": misys_id,
                "misys_description": misys_desc,
                "sage_part_code": None,
                "sage_item_id": None,
                "sage_description": None,
                "confidence": "unmatched",
                "score": round(best_score, 3),
                "confirmed": False,
                "confirmed_by": None,
                "confirmed_at": None,
                "note": "No match found — manual mapping required",
            })
            unmatched_count += 1

    stats = {
        "total_misys_items": len(new_mappings),
        "exact_matches": exact_count,
        "fuzzy_suggestions": fuzzy_count,
        "unmatched": unmatched_count,
        "confirmed": sum(1 for m in new_mappings if m.get("confirmed")),
    }

    _save_mapping_file({
        "mappings": new_mappings,
        "last_run": datetime.now().isoformat(),
        "stats": stats,
    })

    return stats


def confirm_item_mapping(misys_item_id: str, sage_part_code: str, confirmed_by: str = "user") -> dict:
    """
    Confirm a specific item mapping. The user explicitly approves this match.
    For 100% accuracy — only confirmed mappings are used in enrichment.
    """
    data = _load_mapping_file()
    mappings = data.get("mappings", [])

    key = misys_item_id.strip().upper()
    found = False

    for m in mappings:
        if m.get("misys_item_id", "").strip().upper() == key:
            # Validate the sage_part_code exists in Sage data
            tables = _tables()
            inv_df = tables.get("tinvent")
            sage_item_id = None
            if inv_df is not None and not inv_df.empty:
                match_rows = inv_df[inv_df["sPartCode"].fillna("").str.strip().str.upper() == sage_part_code.strip().upper()]
                if not match_rows.empty:
                    sage_item_id = int(match_rows.iloc[0].get("lId", 0) or 0)
                    sage_name = _safe_str(match_rows.iloc[0].get("sName"))
                else:
                    return {"error": f"Sage part code '{sage_part_code}' not found in Sage inventory"}

            m["sage_part_code"] = sage_part_code
            m["sage_item_id"] = sage_item_id
            m["sage_description"] = sage_name if sage_item_id else m.get("sage_description")
            m["confirmed"] = True
            m["confidence"] = "manual" if m.get("confidence") == "suggested" else m.get("confidence", "manual")
            m["confirmed_by"] = confirmed_by
            m["confirmed_at"] = datetime.now().isoformat()
            found = True
            break

    if not found:
        # Add new mapping
        tables = _tables()
        inv_df = tables.get("tinvent")
        sage_item_id = None
        sage_name = ""
        if inv_df is not None and not inv_df.empty:
            match_rows = inv_df[inv_df["sPartCode"].fillna("").str.strip().str.upper() == sage_part_code.strip().upper()]
            if not match_rows.empty:
                sage_item_id = int(match_rows.iloc[0].get("lId", 0) or 0)
                sage_name = _safe_str(match_rows.iloc[0].get("sName"))

        mappings.append({
            "misys_item_id": misys_item_id,
            "misys_description": "",
            "sage_part_code": sage_part_code,
            "sage_item_id": sage_item_id,
            "sage_description": sage_name,
            "confidence": "manual",
            "score": 1.0,
            "confirmed": True,
            "confirmed_by": confirmed_by,
            "confirmed_at": datetime.now().isoformat(),
            "note": "Manually created",
        })

    _save_mapping_file({"mappings": mappings, "last_run": data.get("last_run"), "stats": data.get("stats", {})})
    return {"success": True, "misys_item_id": misys_item_id, "sage_part_code": sage_part_code}


def reject_item_mapping(misys_item_id: str, confirmed_by: str = "user") -> dict:
    """Clear/reject a suggested mapping for a MiSys item."""
    data = _load_mapping_file()
    mappings = data.get("mappings", [])
    key = misys_item_id.strip().upper()
    for m in mappings:
        if m.get("misys_item_id", "").strip().upper() == key:
            m["sage_part_code"] = None
            m["sage_item_id"] = None
            m["sage_description"] = None
            m["confirmed"] = False
            m["confidence"] = "rejected"
            m["confirmed_by"] = confirmed_by
            m["confirmed_at"] = datetime.now().isoformat()
            m["note"] = "Rejected — manually marked as no match"
            break
    _save_mapping_file({"mappings": mappings, "last_run": data.get("last_run"), "stats": data.get("stats", {})})
    return {"success": True, "misys_item_id": misys_item_id}


def bulk_confirm_exact_mappings(confirmed_by: str = "user") -> dict:
    """Bulk-confirm all exact (score=1.0) unconfirmed mappings."""
    data = _load_mapping_file()
    mappings = data.get("mappings", [])
    count = 0
    for m in mappings:
        if not m.get("confirmed") and m.get("confidence") == "exact" and m.get("sage_part_code"):
            m["confirmed"] = True
            m["confirmed_by"] = confirmed_by
            m["confirmed_at"] = datetime.now().isoformat()
            count += 1
    _save_mapping_file({"mappings": mappings, "last_run": data.get("last_run"), "stats": data.get("stats", {})})
    return {"success": True, "confirmed_count": count}
