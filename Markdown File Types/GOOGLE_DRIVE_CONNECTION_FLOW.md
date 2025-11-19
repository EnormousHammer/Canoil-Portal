# Google Drive API Connection Flow - How It Actually Works

## 🔍 How It Connects

### Step 1: Initialization (in `app.py`)

When `app.py` loads:
1. Checks `USE_GOOGLE_DRIVE_API` environment variable
2. If `true`, creates `GoogleDriveService()` instance
3. Calls `authenticate()` immediately
4. Stores in `google_drive_service` variable

### Step 2: Authentication (in `google_drive_service.py`)

The `authenticate()` method:
1. **Loads token from `GOOGLE_DRIVE_TOKEN` env var** (JSON string)
2. **If token missing client_id/client_secret**, gets from `GOOGLE_DRIVE_CREDENTIALS`
3. **Creates Credentials** from token JSON
4. **Refreshes token** if expired (using refresh_token)
5. **Builds Google Drive API service** with `build('drive', 'v3', credentials=creds)`
6. **Sets `authenticated = True`**

### Step 3: Data Loading (in `/api/data` endpoint)

When `/api/data` is called:
1. Checks if `USE_GOOGLE_DRIVE_API` and `google_drive_service` exist
2. If yes, calls `google_drive_service.get_all_data()`

### Step 4: `get_all_data()` Flow

1. **Authenticates** if not already authenticated
2. **Finds shared drive** by name (`GOOGLE_DRIVE_SHARED_DRIVE_NAME`)
3. **Finds base folder** by path (`GOOGLE_DRIVE_BASE_FOLDER_PATH`)
4. **Gets latest folder** (by name/date)
5. **Downloads all JSON files** from latest folder
6. **Loads sales orders** from sales orders path
7. **Returns data** and folder info

## 🧪 What I Need to Test

### Test 1: Authentication
- ✅ Token loads from `GOOGLE_DRIVE_TOKEN`
- ✅ Credentials extracted from `GOOGLE_DRIVE_CREDENTIALS` if needed
- ✅ Token is valid or can be refreshed
- ✅ Google Drive API service built successfully

### Test 2: Shared Drive Access
- ✅ Shared drive found by name
- ✅ Service has permission to access shared drive

### Test 3: Folder Access
- ✅ Base folder found by path
- ✅ Latest folder found
- ✅ Can list files in folder

### Test 4: File Download
- ✅ Can download JSON files
- ✅ Files are parsed correctly
- ✅ Data is returned

## 🔍 What to Check in Vercel Logs

Look for these messages in order:

1. **Initialization:**
   - `🔍 Initializing Google Drive API: env='true', parsed=True`
   - `✅ Google Drive API service initialized`

2. **Authentication:**
   - `✅ Loaded Google Drive token from environment variable`
   - `✅ Added client_id/client_secret from GOOGLE_DRIVE_CREDENTIALS` (if needed)
   - `✅ Refreshed expired Google Drive token` (if token was expired)
   - `✅ Google Drive API authenticated successfully`

3. **Data Loading:**
   - `📡 Loading data from Google Drive API...`
   - `✅ Found shared drive: IT_Automation (ID: ...)`
   - `📁 Found folder: MiSys (ID: ...)`
   - `📁 Found folder: Misys Extracted Data (ID: ...)`
   - `✅ Latest folder: 2025-01-XX (ID: ...)`
   - `📄 Downloading: CustomAlert5.json`
   - `✅ Data loaded successfully from Google Drive API: X files`

## 🚨 Common Failure Points

1. **Token Invalid/Expired:**
   - `⚠️ Failed to refresh token: ...`
   - **Fix:** Get fresh token and update `GOOGLE_DRIVE_TOKEN`

2. **Shared Drive Not Found:**
   - `⚠️ Shared drive 'IT_Automation' not found`
   - **Fix:** Check `GOOGLE_DRIVE_SHARED_DRIVE_NAME` matches exactly

3. **Folder Not Found:**
   - `❌ Folder not found: MiSys`
   - **Fix:** Check `GOOGLE_DRIVE_BASE_FOLDER_PATH` matches exactly

4. **No Files Found:**
   - `❌ No folders found`
   - **Fix:** Check folder structure in Google Drive

5. **Permission Error:**
   - `❌ Error finding shared drive: ...`
   - **Fix:** Check service account has access to shared drive

## 📋 Test Endpoint: `/api/debug`

This endpoint tests:
- ✅ Environment variables status
- ✅ Google Drive service initialization
- ✅ Authentication status
- ✅ Shared drive connection
- ✅ Returns detailed status

**Visit:** `https://your-project.vercel.app/api/debug`

**Should show:**
```json
{
  "google_drive_service": {
    "initialized": true,
    "service_exists": true,
    "authenticated": true,
    "shared_drive_found": true,
    "shared_drive_id": "..."
  }
}
```

