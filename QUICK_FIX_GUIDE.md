# 🚀 QUICK FIX GUIDE - Zero Data Problem

## When Your App Shows 0 Data

### **INSTANT FIXES** (Try these first - 2 minutes)

#### Fix 1: Restart Backend ⚡
```powershell
# Kill backend
Get-Process python | Where-Object {$_.Path -like "*canoil-portal*"} | Stop-Process

# Restart with checks
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"
.\start_backend_with_checks.bat
```

#### Fix 2: Hard Refresh Browser 🔄
```
Press: Ctrl + Shift + R
Or: Ctrl + F5
```

#### Fix 3: Set OpenAI API Key 🔑
```powershell
$env:OPENAI_API_KEY = "sk-proj-YOUR_KEY_HERE"
```

Then restart backend.

---

## **DIAGNOSTIC COMMANDS** (Find the problem - 1 minute)

### Run Preflight Check
```powershell
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"
python preflight_check.py
```

This checks:
- ✅ G: Drive access
- ✅ Authentication tokens
- ✅ Environment variables
- ✅ Python packages
- ✅ Data freshness

### Check System Health (from browser)
```
Open: http://localhost:5002/api/health
```

---

## **ROOT CAUSE CHECKLIST**

Run through this checklist:

| ✓ | Check | Command | Fix |
|---|-------|---------|-----|
| ☐ | G: Drive mounted? | `ls "G:\Shared drives"` | Open Google Drive app |
| ☐ | Backend running? | `Get-Process python` | Run `start_backend.bat` |
| ☐ | OpenAI key set? | `echo $env:OPENAI_API_KEY` | Set environment variable |
| ☐ | Tokens valid? | Check `backend/gmail_credentials/token.json` | Delete and re-auth |
| ☐ | Data fresh? | Check backend console | Force refresh |

---

## **COMMON SCENARIOS**

### Scenario 1: After Computer Restart
**Problem:** G: Drive not auto-mounted

**Solution:**
1. Open Google Drive desktop app
2. Sign in if needed
3. Verify `G:\Shared drives` is accessible
4. Restart backend

### Scenario 2: OpenAI API Not Working
**Problem:** Environment variable not set

**Solution (Temporary):**
```powershell
$env:OPENAI_API_KEY = "sk-proj-YOUR_KEY_HERE"
.\start_backend.bat
```

**Solution (Permanent):**
1. Search "Environment Variables" in Windows
2. Add `OPENAI_API_KEY` to User Variables
3. Restart PowerShell/Terminal
4. Restart backend

### Scenario 3: Token Expired
**Problem:** Google Drive/Gmail token expired

**Solution:**
```powershell
cd backend
Remove-Item google_drive_token.pickle
Remove-Item gmail_credentials\token.json
cd ..
.\start_backend.bat
# Follow OAuth prompts
```

### Scenario 4: Empty Cache
**Problem:** Backend cached empty data

**Solution:**
```powershell
# Force cache refresh by restarting backend
Get-Process python | Where-Object {$_.Path -like "*canoil-portal*"} | Stop-Process
.\start_backend.bat
```

Cache clears automatically on restart.

---

## **PREVENTION TIPS**

### Daily Startup Routine
1. **Run with checks:** Use `start_backend_with_checks.bat` instead of `start_backend.bat`
2. **Verify health:** Check browser for any warning banners
3. **Monitor console:** Look for error messages in backend console

### Weekly Maintenance
1. **Check tokens:** Tokens valid for 7 days, refresh proactively
2. **Update data:** Ensure latest data folders exist
3. **Clear cache:** Restart backend once per week

### Environment Setup (One-Time)
```powershell
# Set permanent environment variables
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-proj-YOUR_KEY', 'User')
```

---

## **MONITORING**

### Frontend Error Banners

The app now shows **visual warnings** when issues are detected:

1. **🔴 Red Banner** - Critical system issues
   - G: Drive not accessible
   - Multiple services down
   
2. **🟡 Yellow Banner** - No data loaded
   - Backend returned empty arrays
   - Click "Retry" to refresh

3. **🔵 Blue Banner** - New data available
   - Sales orders updated
   - Click "Refresh" to sync

### Health Check Endpoint

Monitor system status:
```
GET http://localhost:5002/api/health
```

Response shows:
- G: Drive accessibility
- Google Drive API status
- OpenAI availability
- Cache status
- Active issues

---

## **SUPPORT COMMANDS**

### Check Backend Logs
```powershell
# If using output redirection
cat backend_output.log | Select-String -Pattern "ERROR|WARN"
```

### Test API Directly
```powershell
# Test data endpoint
Invoke-WebRequest -Uri "http://localhost:5002/api/data" | ConvertFrom-Json

# Check health
Invoke-WebRequest -Uri "http://localhost:5002/api/health" | ConvertFrom-Json
```

### Force Re-Authentication
```powershell
cd backend
Remove-Item google_drive_token.pickle -Force
Remove-Item gmail_credentials\token.json -Force
cd ..
python backend/app.py
# Follow browser prompts
```

---

## **ESCALATION PATH**

If problem persists after all fixes:

1. ✅ Run `preflight_check.py` - save output
2. ✅ Check `/api/health` endpoint - save response
3. ✅ Check backend console - copy error messages
4. ✅ Check browser console (F12) - copy errors
5. ✅ Verify G: Drive has recent data folders
6. ✅ Try on different computer if available

---

## **AUTOMATED FIX SCRIPT**

Save this as `fix_zero_data.ps1`:

```powershell
# Canoil Portal - Auto Fix Zero Data
Write-Host "🔧 Auto-fixing zero data issue..." -ForegroundColor Cyan

# Step 1: Kill backend
Write-Host "1️⃣ Stopping backend..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*canoil-portal*"} | Stop-Process -Force

# Step 2: Check G: Drive
Write-Host "2️⃣ Checking G: Drive..." -ForegroundColor Yellow
if (Test-Path "G:\Shared drives") {
    Write-Host "  ✅ G: Drive is accessible" -ForegroundColor Green
} else {
    Write-Host "  ❌ G: Drive NOT accessible - open Google Drive app" -ForegroundColor Red
    exit 1
}

# Step 3: Check OpenAI key
Write-Host "3️⃣ Checking OpenAI key..." -ForegroundColor Yellow
if ($env:OPENAI_API_KEY) {
    Write-Host "  ✅ OpenAI key is set" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  OpenAI key NOT set - some features will not work" -ForegroundColor Yellow
}

# Step 4: Run preflight check
Write-Host "4️⃣ Running system checks..." -ForegroundColor Yellow
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"
python preflight_check.py

# Step 5: Restart backend
Write-Host "5️⃣ Restarting backend..." -ForegroundColor Yellow
cd ..
Start-Process -FilePath "start_backend.bat" -NoNewWindow

Write-Host "✅ Auto-fix complete! Wait 10 seconds then refresh browser." -ForegroundColor Green
```

Usage:
```powershell
.\fix_zero_data.ps1
```

---

**Remember:** The new system will now **show you warnings** when data is missing, so you'll know immediately what's wrong!

