# 🚨 ZERO DATA PROBLEM - COMPLETE DIAGNOSTIC & SOLUTION GUIDE

## THE PROBLEM

Your app suddenly shows 0 data from Google Drive and OpenAI even though all data is actually there. This happens frequently and is frustrating.

## WHY THIS HAPPENS - ROOT CAUSES

### 1. **GOOGLE DRIVE TOKEN EXPIRATION** (Most Common)
**File**: `backend/google_drive_service.py` (lines 127-134)

```python
if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            print("[OK] Refreshed expired Google Drive token")
        except Exception as e:
            print(f"[WARN] Failed to refresh token: {e}")
            creds = None  # ❌ TOKEN REFRESH FAILED - NO DATA!
```

**What happens:**
- Google Drive tokens expire after 1 hour
- Token refresh attempts but can fail silently
- When refresh fails, `creds = None` and NO authentication = NO data
- Frontend receives empty arrays: `[]`
- App shows "0 data" but looks normal otherwise

**Token Files:**
- `backend/google_drive_token.pickle` (main Google Drive)
- `backend/gmail_credentials/token.json` (Gmail/OAuth)

### 2. **BACKEND CACHE WITH EMPTY DATA** (Silent Killer)
**File**: `backend/app.py` (lines 654-740)

```python
_data_cache = None
_cache_timestamp = None
_cache_duration = 600  # 10 minutes cache

# If cache has NO data but is fresh, it still returns it!
if cache_age < _cache_duration and has_data:
    return cached_data
elif not has_data:
    print("⚠️ Cache exists but is empty - forcing refresh")
```

**What happens:**
- Backend caches data for 10 minutes to reduce load
- If token fails during cache refresh, empty data gets cached
- For next 10 minutes, everyone gets empty data
- No error shown - just empty arrays

### 3. **OPENAI API KEY ISSUES**
**File**: `backend/app.py` (lines 528-557)

```python
openai_api_key = os.getenv('OPENAI_API_KEY')

if not openai_api_key or openai_api_key == "your_openai_api_key_here":
    print("ERROR: OPENAI_API_KEY environment variable not set")
    client = None
    openai_available = False  # ❌ NO OPENAI!
```

**What happens:**
- Environment variable not set or expired
- API key invalid or rate-limited
- All AI features fail silently
- Email assistant, AI drafting, etc. don't work

### 4. **SILENT FAILURES IN FRONTEND**
**File**: `frontend/src/App.tsx` (lines 340-363)

```typescript
try {
    result = await gdriveLoader.loadAllData();
    console.log('✅ Data loaded successfully from G: Drive');
} catch (error) {
    console.warn('⚠️ Error loading data, retrying...', error);
    try {
        result = await gdriveLoader.loadAllData();
    } catch (retryError) {
        // Returns empty data structure - NO ERROR SHOWN TO USER!
        result = { 
            data: {
                'CustomAlert5.json': [],  // ❌ EMPTY!
                'SalesOrderHeaders.json': [],  // ❌ EMPTY!
            }
        };
    }
}
```

**What happens:**
- Backend errors caught and handled silently
- Empty data structure returned instead of showing error
- User sees loading screen complete normally
- App loads with 0 data - no indication of problem

### 5. **G: DRIVE NOT MOUNTED** (Windows Specific)
**File**: `backend/app.py` (line 560)

```python
GDRIVE_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"

if not os.path.exists(GDRIVE_BASE):
    print(f"ERROR: G: Drive not accessible at: {GDRIVE_BASE}")
    return empty_data  # ❌ RETURNS EMPTY DATA!
```

**What happens:**
- Computer restarts and G: Drive doesn't auto-mount
- Network drive disconnected
- Path not accessible
- Backend returns empty data structure

## HOW TO DIAGNOSE THE PROBLEM

### Step 1: Check Backend Console Logs

Look for these error messages:

```
❌ ERROR: G: Drive path not accessible
⚠️ Google Drive authentication failed
❌ Failed to refresh token
❌ ERROR: OPENAI_API_KEY environment variable not set
⚠️ Cache exists but is empty - forcing refresh
```

### Step 2: Check Browser Console

Open DevTools (F12) and look for:

```
❌ Flask API error response
⚠️ Backend not accessible - returning empty data structure
⚠️ Failed to load MPS data
❌ Error loading G: Drive data via Flask
```

### Step 3: Check Token Files

**Windows:**
```powershell
# Check if token files exist
ls "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend\google_drive_token.pickle"
ls "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend\gmail_credentials\token.json"
```

**Check token contents:**
```powershell
# Check Gmail token
cat "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend\gmail_credentials\token.json"
```

### Step 4: Check G: Drive Access

```powershell
# Verify G: Drive is mounted and accessible
ls "G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
```

### Step 5: Check Environment Variables

```powershell
# Check if OPENAI_API_KEY is set
echo $env:OPENAI_API_KEY

# Check if USE_GOOGLE_DRIVE_API is set
echo $env:USE_GOOGLE_DRIVE_API
```

## IMMEDIATE FIXES

### Fix 1: Force Cache Refresh

**Add `?force=true` to API call:**

In browser console:
```javascript
fetch(window.location.origin + '/api/data?force=true')
    .then(r => r.json())
    .then(d => console.log('Data:', d));
```

Or just reload the page - frontend always hits backend fresh.

### Fix 2: Restart Backend Server

**Kill and restart:**
```powershell
# Kill backend
Get-Process python | Where-Object {$_.Path -like "*canoil-portal*"} | Stop-Process

# Restart backend
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"
.\start_backend.bat
```

### Fix 3: Re-authenticate Google Drive

**Delete tokens and re-auth:**
```powershell
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"

# Delete old tokens
Remove-Item google_drive_token.pickle -ErrorAction SilentlyContinue
Remove-Item gmail_credentials\token.json -ErrorAction SilentlyContinue

# Restart backend - it will prompt for re-auth
cd ..
.\start_backend.bat
```

### Fix 4: Check G: Drive Mount

**Ensure G: Drive is accessible:**
```powershell
# Try to access G: Drive
cd "G:\Shared drives"

# If error, remount Google Drive:
# 1. Open Google Drive desktop app
# 2. Sign out and sign back in
# 3. Verify "G:\Shared drives" is accessible
```

### Fix 5: Set OpenAI API Key

**PowerShell (temporary):**
```powershell
$env:OPENAI_API_KEY = "sk-proj-YOUR_KEY_HERE"
```

**Windows System Environment (permanent):**
1. Search "Environment Variables" in Windows
2. Click "Environment Variables" button
3. Under "User variables", click "New"
4. Variable name: `OPENAI_API_KEY`
5. Variable value: `sk-proj-YOUR_KEY_HERE`
6. Click OK
7. Restart backend

## PERMANENT SOLUTIONS

### Solution 1: Better Error Handling in Frontend

**Add visual error indicators:**

```typescript
// frontend/src/App.tsx
if (!data || Object.values(data).every(v => Array.isArray(v) && v.length === 0)) {
    return (
        <div className="error-banner">
            ⚠️ No data loaded from backend! Check connection.
        </div>
    );
}
```

### Solution 2: Token Auto-Refresh on Startup

**Modify backend to always verify tokens:**

```python
# backend/google_drive_service.py
def authenticate(self):
    # ALWAYS verify token is valid before returning
    if self.creds and self.creds.expired and self.creds.refresh_token:
        try:
            self.creds.refresh(Request())
        except Exception as e:
            # DELETE invalid token and force re-auth
            if os.path.exists(self.token_file):
                os.remove(self.token_file)
            raise Exception("Token refresh failed - please re-authenticate")
```

### Solution 3: Cache Validation

**Don't cache empty data:**

```python
# backend/app.py
if should_cache_data(data):
    # Validate data is not empty
    has_real_data = any(
        len(v) > 0 
        for v in data.values() 
        if isinstance(v, list)
    )
    if has_real_data:
        _data_cache = data
        _cache_timestamp = time.time()
    else:
        print("⚠️ Data is empty - NOT caching")
```

### Solution 4: Health Check Endpoint

**Add endpoint to check system status:**

```python
# backend/app.py
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'gdrive_accessible': os.path.exists(GDRIVE_BASE),
        'google_drive_api': google_drive_service is not None,
        'google_drive_authenticated': google_drive_service.authenticated if google_drive_service else False,
        'openai_available': openai_available,
        'cache_age_seconds': time.time() - _cache_timestamp if _cache_timestamp else None,
        'cache_has_data': _data_cache is not None and len(_data_cache) > 0 if _data_cache else False
    })
```

### Solution 5: Startup Validation Script

**Create a pre-flight check:**

```python
# backend/preflight_check.py
import os
import json

def check_system():
    issues = []
    
    # Check G: Drive
    gdrive_path = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
    if not os.path.exists(gdrive_path):
        issues.append("❌ G: Drive not accessible")
    
    # Check tokens
    if not os.path.exists('backend/google_drive_token.pickle'):
        issues.append("⚠️ Google Drive token missing")
    
    if not os.path.exists('backend/gmail_credentials/token.json'):
        issues.append("⚠️ Gmail token missing")
    
    # Check OpenAI key
    if not os.getenv('OPENAI_API_KEY'):
        issues.append("❌ OPENAI_API_KEY not set")
    
    if issues:
        print("\n".join(issues))
        return False
    
    print("✅ All systems ready")
    return True

if __name__ == '__main__':
    check_system()
```

## WHY THIS HAPPENS "OFTEN"

### Frequency Patterns:

1. **Every 1-7 days**: Token expiration cycles
2. **After computer restart**: G: Drive not auto-mounted
3. **After backend restart**: Cache cleared, tokens not refreshed
4. **After Windows updates**: Environment variables reset
5. **During peak usage**: API rate limits hit

## MONITORING & PREVENTION

### Create a Status Dashboard

Add to RevolutionaryCanoilHub:

```typescript
const [systemStatus, setSystemStatus] = useState(null);

useEffect(() => {
    fetch(getApiUrl('/api/health'))
        .then(r => r.json())
        .then(status => setSystemStatus(status));
}, []);

// Show warning banner if issues detected
{systemStatus && !systemStatus.gdrive_accessible && (
    <div className="alert alert-danger">
        ⚠️ G: Drive not accessible - data may be stale
    </div>
)}
```

### Automated Health Checks

**Run every 5 minutes:**
```python
# backend/app.py
import threading
import time

def health_monitor():
    while True:
        time.sleep(300)  # 5 minutes
        if not os.path.exists(GDRIVE_BASE):
            print("🚨 ALERT: G: Drive disconnected!")
        if google_drive_service and not google_drive_service.authenticated:
            print("🚨 ALERT: Google Drive not authenticated!")

threading.Thread(target=health_monitor, daemon=True).start()
```

## QUICK REFERENCE - WHEN DATA IS MISSING

**Run this checklist:**

1. ✅ Check backend console for errors
2. ✅ Check browser console (F12) for errors  
3. ✅ Verify G: Drive is mounted: `ls "G:\Shared drives"`
4. ✅ Restart backend: `.\start_backend.bat`
5. ✅ Hard refresh browser: Ctrl+Shift+R
6. ✅ Check environment variables: `echo $env:OPENAI_API_KEY`
7. ✅ Re-authenticate if needed: Delete tokens, restart backend
8. ✅ Force cache refresh: Restart backend or wait 10 minutes

## FILES TO MONITOR

**Token Files:**
- `backend/google_drive_token.pickle`
- `backend/gmail_credentials/token.json`

**Configuration Files:**
- `backend/app.py` (line 532: OpenAI key check)
- `backend/google_drive_service.py` (line 127: token refresh)

**Frontend Data Loading:**
- `frontend/src/services/GDriveDataLoader.ts` (line 202: error handling)
- `frontend/src/App.tsx` (line 340: data loading)

## CONTACT & ESCALATION

**If problem persists after all fixes:**

1. Check backend logs in detail
2. Verify all environment variables are set
3. Test Google Drive API credentials manually
4. Check OpenAI API key status at platform.openai.com
5. Restart entire system (backend + frontend)
6. Re-authenticate all services from scratch

---

**Last Updated:** November 10, 2025
**Status:** Active Issue - Requires Monitoring

