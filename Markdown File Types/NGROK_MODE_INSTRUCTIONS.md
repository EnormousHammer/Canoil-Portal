# Canoil Portal - NGROK Mode Setup

## Problem
When accessing your backend via **ngrok**, items show as **0** because ngrok can't access your local `G:\Shared drives\...` network drive.

## Solution: Enable Google Drive API Mode

### Current Status Check
Your backend has TWO modes:
1. **Local Mode** (Default): Reads from `G:\Shared drives\...` ✅ Works locally
2. **API Mode**: Uses Google Drive API 🌐 Works via ngrok

### Quick Fix (2 Steps)

#### Step 1: Start Backend in API Mode
```powershell
# Stop current backend
Get-Process python | Where-Object {$_.Path -like "*canoil-portal*"} | Stop-Process

# Start in NGROK mode
.\START_NGROK_MODE.bat
```

#### Step 2: Test via Ngrok
Open your ngrok URL and check if items load.

---

## Files Detected

✅ **Found**: `backend/google_drive_token.pickle` - OAuth token exists  
⚠️ **Missing**: `backend/google_drive_credentials.json` - Using Gmail credentials as fallback

### Credentials Fallback
The backend will automatically use Gmail OAuth credentials if Google Drive credentials are missing:
- **Fallback location**: `backend/gmail_credentials/credentials.json`

---

## How It Works

### Environment Variables (set in START_NGROK_MODE.bat)
```bash
USE_GOOGLE_DRIVE_API=true           # Enable API mode
GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation
GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions
GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders
```

### Backend Logic (`backend/app.py` line 642-684)
```python
# Check environment variable
USE_GOOGLE_DRIVE_API = os.getenv('USE_GOOGLE_DRIVE_API', 'false').lower() == 'true'

if USE_GOOGLE_DRIVE_API:
    # Initialize Google Drive API service
    google_drive_service = GoogleDriveService()
    google_drive_service.authenticate()
else:
    # Use local G: Drive (default)
    GDRIVE_BASE = r"G:\Shared drives\IT_Automation\..."
```

---

## Troubleshooting

### Issue: "Authentication failed"
**Cause**: Token expired or credentials missing

**Fix**:
```powershell
# Re-authenticate Google Drive
cd backend
python
>>> from google_drive_service import GoogleDriveService
>>> service = GoogleDriveService()
>>> service.authenticate()
>>> exit()
```

### Issue: Still showing 0 items
**Check**:
1. Backend console shows: `✅ Google Drive API service authenticated successfully`
2. Backend console shows: `[OK] Data loaded successfully from Google Drive API`
3. Check ngrok is pointing to correct port (5002)

**Debug**:
```powershell
# Check backend logs for errors
# Look for lines starting with [ERROR] or [WARN]
```

### Issue: "Shared drive not found"
**Cause**: Wrong shared drive name or missing permissions

**Fix**: Check environment variables match your Google Drive structure
```bash
GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation  # Must match exactly
```

---

## Verification Checklist

After starting in NGROK mode, verify:

- [ ] Backend console shows: `🔍 Initializing Google Drive API`
- [ ] Backend console shows: `✅ Google Drive API service authenticated successfully`
- [ ] Ngrok URL loads the app (not local URL)
- [ ] Items count shows correct numbers (not 0)
- [ ] All data sections have content

---

## Why Two Modes?

### Local Mode (Default)
**Pros**:
- ⚡ Faster (direct file access)
- 💾 No API quota limits
- 🔒 No authentication needed

**Cons**:
- 🏠 Only works on your computer
- ❌ Won't work via ngrok
- 📡 Requires network drive mounted

### API Mode (Ngrok)
**Pros**:
- 🌐 Works from anywhere
- ✅ Works via ngrok
- ☁️ Cloud-ready (Vercel/Render)

**Cons**:
- 🐌 Slightly slower (API calls)
- 📊 Subject to API quotas
- 🔑 Requires authentication

---

## Recommended Workflow

### For Development (Local Only)
```powershell
.\start_backend.bat  # Default local mode
```

### For Sharing/Testing (Ngrok)
```powershell
.\START_NGROK_MODE.bat  # API mode

# In another terminal:
ngrok http 5002
```

### For Production (Render/Vercel)
Set environment variables in platform:
```
USE_GOOGLE_DRIVE_API=true
GOOGLE_DRIVE_TOKEN=<your token JSON>
GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation
```

---

## Files Created

📄 **START_NGROK_MODE.bat** - Start backend with Google Drive API enabled  
📄 **NGROK_MODE_INSTRUCTIONS.md** - This guide

---

## Next Steps

1. **Run**: `.\START_NGROK_MODE.bat`
2. **Test**: Access via ngrok URL
3. **Verify**: Items show correct counts

If issues persist, check backend console logs for specific error messages.

