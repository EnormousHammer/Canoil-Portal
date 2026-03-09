# ERP Portal → Sage G Drive: Full Flow Trace

**Purpose:** Document the complete request path from ERP Portal Overview to Google Drive, and verify every link exists.

---

## 1. Frontend Flow

### 1.1 ERPPortal Overview (`frontend/src/components/ERPPortal.tsx`)

| Step | Code | Endpoint |
|------|------|----------|
| On mount | `useEffect(() => load();, [])` | — |
| `load()` | `fetchStatus()` then optionally `triggerLoad()` | — |
| Status check | `apiGet('/api/sage/gdrive/status')` | `GET /api/sage/gdrive/status` |
| Trigger load | `apiPost('/api/sage/gdrive/load', {})` | `POST /api/sage/gdrive/load` |

**Logic:** If `!st?.cache_loaded` or no row counts → auto-trigger load, then re-fetch status.

### 1.2 API Client (`frontend/src/utils/portalApi.ts`)

| Function | Implementation |
|----------|----------------|
| `apiGet(endpoint)` | `apiRequest(getApiUrl(endpoint))` |
| `apiPost(endpoint, body)` | `apiRequest(getApiUrl(endpoint), { method: 'POST', body: JSON.stringify(body) })` |
| `apiRequest` | `fetch(url, { headers: authHeaders() })` → returns `{ data, status, ok }` |
| Error handling | Non-JSON response → `data = { error: text }`; catch → `data = { error: msg }` |

**✅ Exists:** All functions present. JWT in `Authorization: Bearer`.

### 1.3 API URL (`frontend/src/utils/apiConfig.ts`)

| Environment | API Base |
|-------------|----------|
| `VITE_API_URL` set | Uses env value |
| localhost / 127.0.0.1 | `http://localhost:5002` |
| ngrok | `window.location.origin` |
| Production | `window.location.origin` (Vercel proxies `/api/*` to Render) |

**✅ Exists:** `getApiUrl('/api/sage/gdrive/load')` → `http://localhost:5002/api/sage/gdrive/load` (dev).

---

## 2. Backend Routes (`backend/app.py`)

### 2.1 Sage G Drive Import (startup)

```python
# Lines 99–106
try:
    import sage_gdrive_service
    SAGE_GDRIVE_AVAILABLE = True
except ImportError as e:
    sage_gdrive_service = None
    SAGE_GDRIVE_AVAILABLE = False
```

**Failure:** If import fails (e.g. missing `pandas`, `google_drive_service`) → `SAGE_GDRIVE_AVAILABLE = False` → all Sage G Drive routes return 503.

### 2.2 Route Handlers

| Route | Handler | Behavior |
|-------|---------|----------|
| `GET /api/sage/gdrive/status` | `sage_gdrive_status()` | `_sgds().get_status()` or 503 |
| `POST /api/sage/gdrive/load` | `sage_gdrive_load()` | `_sgds().load_data(force=True)` or 503 |

**`_sgds()`** = `sage_gdrive_service if SAGE_GDRIVE_AVAILABLE else None`

**✅ Exists:** Both routes registered. 503 if service not loaded; 500 on exception.

---

## 3. Sage G Drive Service (`backend/sage_gdrive_service.py`)

### 3.1 Config (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `SAGE_GDRIVE_BASE` | `G:\...\Full Company Data From SAGE` | Local path (not used in cloud) |
| `SAGE_GDRIVE_DRIVE_PATH` | `MiSys/Misys Extracted Data/Full Company Data From SAGE` | Path within shared drive |
| `GOOGLE_DRIVE_SHARED_DRIVE_NAME` | `IT_Automation` | Shared drive name |
| `IS_CLOUD_ENVIRONMENT` | `K_SERVICE` or `RENDER` or `RENDER_SERVICE_ID` | Switches to API mode |

### 3.2 `load_data(force=True)` Flow

```
load_data(force=True)
  ├─ IS_CLOUD_ENVIRONMENT? → _load_via_api()
  └─ LOCAL? → get_latest_folder() or _load_via_api() fallback
```

### 3.3 `_load_via_api()` Flow

```
_load_via_api()
  └─ _find_latest_sage_folder_api()
       ├─ _get_gds()  ← GoogleDriveService(), authenticate()
       ├─ gds.find_shared_drive("IT_Automation")
       ├─ gds.find_folder_by_path(drive_id, "MiSys/Misys Extracted Data/Full Company Data From SAGE")
       ├─ service.files().list() — subfolders, orderBy modifiedTime desc
       └─ return (gds, drive_id, folder_id, folder_name)
  └─ For each REQUIRED_TABLES: _load_csv_from_api(gds, folder_id, drive_id, tbl)
       ├─ service.files().list() — find tcustomr.CSV etc.
       └─ gds.download_file(file_id, filename) → pd.read_csv(BytesIO(content))
```

**✅ Exists:** All functions present. `REQUIRED_TABLES` = tcustomr, tvendor, tinvent, tinvbyln, tinvext, tinvprc, tinvinfo, tsalordr, tsoline, titrec, titrline, tprclist, tcustr.

---

## 4. Google Drive Service (`backend/google_drive_service.py`)

### 4.1 Auth (Service Account)

| Source | Env Var / File |
|--------|----------------|
| Env JSON | `GOOGLE_DRIVE_SA_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON` |
| File | `GOOGLE_DRIVE_SA_FILE` (default: `backend/google_service_account.json`) |

**Failure:** No valid creds → `authenticate()` fails → `_get_gds()` returns None → load fails.

### 4.2 Methods Used by Sage G Drive

| Method | Purpose |
|--------|---------|
| `find_shared_drive(drive_name)` | List drives, match "IT_Automation" |
| `find_folder_by_path(drive_id, path)` | Walk path: MiSys → Misys Extracted Data → Full Company Data From SAGE |
| `download_file(file_id, file_name)` | Get file bytes via `files().get_media()` |
| `_get_fresh_service()` | Build Drive API client from `_credentials` |

**✅ Exists:** All methods implemented in `google_drive_service.py`.

---

## 5. Expected Google Drive Structure

```
Shared Drive: IT_Automation
└── MiSys
    └── Misys Extracted Data
        └── Full Company Data From SAGE   ← SAGE_GDRIVE_DRIVE_PATH
            ├── 2024-11-15/               ← date subfolders (or "March 3, 2026_01-36 PM")
            │   ├── tcustomr.CSV
            │   ├── tsalordr.CSV
            │   ├── tsoline.CSV
            │   └── ... (other REQUIRED_TABLES)
            └── ...
```

**Note:** Subfolders sorted by `modifiedTime desc`. Utility folders starting with `_` are skipped.

---

## 6. Failure Points (500 / 503)

| # | Condition | Result |
|---|-----------|--------|
| 1 | `sage_gdrive_service` import fails | 503 "Sage G Drive service not loaded" |
| 2 | `_get_gds()` returns None (auth fails) | 503 with "Google Drive service not available" |
| 3 | Shared drive "IT_Automation" not found | 503 with "Shared drive 'IT_Automation' not found" |
| 4 | Path not found | 503 with "Sage folder path not found in Drive: MiSys/..." |
| 5 | No subfolders | 503 with "No Sage export subfolders found under ..." |
| 6 | Folder found but no CSVs | 503 with "Found folder 'X' but no CSV files loaded..." |
| 7 | Unhandled exception in load | 500 with traceback in logs |

---

## 7. Verification Checklist

- [x] **ERPPortal** calls `apiGet`/`apiPost` with correct endpoints
- [x] **portalApi** uses `getApiUrl` and returns `{ data, ok, status }`
- [x] **apiConfig** resolves to backend URL (localhost:5002 or proxy)
- [x] **app.py** registers `/api/sage/gdrive/status` and `/api/sage/gdrive/load`
- [x] **sage_gdrive_service** imports and defines `load_data`, `get_status`, `_load_via_api`, `_find_latest_sage_folder_api`, `_load_csv_from_api`
- [x] **google_drive_service** defines `find_shared_drive`, `find_folder_by_path`, `download_file`, `authenticate`
- [x] **Env vars** used: `GOOGLE_DRIVE_SA_JSON`, `GOOGLE_DRIVE_SHARED_DRIVE_NAME`, `SAGE_GDRIVE_DRIVE_PATH`, `RENDER`/`K_SERVICE` for cloud detection

---

## 8. Next Steps for 500 Debugging

1. **Check Render/Cloud Run logs** for the exact exception and traceback.
2. **Confirm env vars** on Render: `GOOGLE_DRIVE_SA_JSON` (or `GOOGLE_DRIVE_SA_FILE`), `GOOGLE_DRIVE_SHARED_DRIVE_NAME`.
3. **Confirm service account** is a member of shared drive "IT_Automation" with at least Content Viewer.
4. **Confirm folder structure** in Drive: `MiSys/Misys Extracted Data/Full Company Data From SAGE` with date subfolders containing `tcustomr.CSV`, etc.
5. **Test status first:** `GET /api/sage/gdrive/status` — if 503, service not loaded; if 200, load may still fail on `POST /api/sage/gdrive/load`.
