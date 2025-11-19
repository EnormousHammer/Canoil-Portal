# Canoil Portal - 24/7 PC Setup Guide

## 🎯 Quick Start

### First Time Setup
1. **Run Setup Script**
   ```powershell
   .\SETUP_24_7_PC.ps1
   ```
   This installs everything needed (Node.js, npm packages, Python packages, etc.)

2. **Start Services**
   ```powershell
   .\START_EVERYTHING.bat
   ```
   This starts backend and ngrok in separate windows

3. **Access Portal**
   - Get your ngrok URL from: http://localhost:4040
   - Open the ngrok URL in browser
   - Portal should show all data!

---

## 📋 Daily Operation

### Starting the System
```powershell
# Option 1: Start everything (recommended)
.\START_EVERYTHING.bat

# Option 2: Start manually
.\start_backend.bat        # Terminal 1
ngrok http 5002            # Terminal 2
```

### Stopping the System
```powershell
# Stop all Python processes
Get-Process python | Where-Object {$_.Path -like "*canoil*"} | Stop-Process

# Stop ngrok (or just close the ngrok window)
taskkill /F /IM ngrok.exe
```

---

## 🔍 Health Checks

### Verify Installation
```powershell
.\VERIFY_24_7_SETUP.ps1
```
This checks:
- ✅ All software installed
- ✅ All packages up to date
- ✅ Services running
- ✅ Data accessible

### Manual Checks
```powershell
# Check backend
curl http://localhost:5002/api/health

# Check ngrok
curl http://localhost:4040/api/tunnels

# Check data
Test-Path "G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
```

---

## 🚨 Troubleshooting

### Backend Won't Start
```powershell
# Check port 5002 not in use
netstat -ano | findstr :5002

# If something's using it, kill it
netstat -ano | findstr :5002
# Note the PID, then:
taskkill /F /PID <PID>

# Try starting again
.\start_backend.bat
```

### Ngrok Shows 0 Items
```powershell
# Rebuild frontend
cd frontend
npm run build
cd ..

# Restart backend
Get-Process python | Where-Object {$_.Path -like "*canoil*"} | Stop-Process
.\start_backend.bat
```

### G: Drive Not Accessible
```powershell
# Check if drive is mounted
Get-PSDrive G

# If not, open Google Drive app and wait for sync
# Or restart Google Drive
```

### "npm not found" Error
```powershell
# Install Node.js from: https://nodejs.org/
# After install, close PowerShell and open new one
# Then run: .\SETUP_24_7_PC.ps1
```

---

## 📁 Important Files

### Startup Scripts
- `START_EVERYTHING.bat` - Start backend + ngrok (one click!)
- `start_backend.bat` - Start backend only
- `START_NGROK_MODE.bat` - Start with Google Drive API (for remote)

### Setup Scripts
- `SETUP_24_7_PC.ps1` - Full installation script
- `VERIFY_24_7_SETUP.ps1` - Health check script

### Configuration
- `backend\.env` - Environment variables
- `backend\requirements.txt` - Python packages
- `frontend\package.json` - Node packages

### Documentation
- `README_24_7_PC.md` - This file
- `NGROK_MODE_INSTRUCTIONS.md` - Ngrok setup details
- `NGROK_FIX_COMPLETE.md` - Technical details of the fix

---

## 🔄 Updates

### Update Backend Code
```powershell
# If code was updated on G: drive
Get-Process python | Where-Object {$_.Path -like "*canoil*"} | Stop-Process
.\start_backend.bat
```

### Update Frontend Code
```powershell
cd frontend
npm run build
cd ..

# Restart backend to serve new frontend
Get-Process python | Where-Object {$_.Path -like "*canoil*"} | Stop-Process
.\start_backend.bat
```

### Update Dependencies
```powershell
# Python packages
cd backend
pip install -r requirements.txt --upgrade

# Node packages
cd ..\frontend
npm update
npm run build
cd ..
```

---

## 🌐 Accessing the Portal

### Local Access (on the 24/7 PC)
```
http://localhost:5002
```

### Remote Access (via ngrok)
1. Open: http://localhost:4040
2. Copy the "Forwarding" URL (e.g., https://abc123.ngrok-free.dev)
3. Use that URL from any device

### Ngrok Dashboard
```
http://localhost:4040
```
Shows:
- Public URL
- Request history
- Traffic stats

---

## 💡 Tips

1. **Keep Windows Open**: Don't close backend or ngrok windows while system is running

2. **Monitor Backend**: Watch backend console for errors

3. **Ngrok URL Changes**: Free ngrok URLs change each restart. Use a paid plan for fixed URLs.

4. **Auto-Start**: Add `START_EVERYTHING.bat` to Windows startup folder for automatic startup

5. **Remote Desktop**: You can use Remote Desktop to check/restart services remotely

---

## 🔐 Security Notes

- The OpenAI API key is in `backend\.env` - keep it secret!
- Ngrok URLs are public - anyone with the URL can access
- For production, use proper authentication
- Consider ngrok password protection: `ngrok http 5002 --basic-auth="user:pass"`

---

## 📞 Support

If something breaks:
1. Run `.\VERIFY_24_7_SETUP.ps1` to diagnose
2. Check backend console for errors
3. Check ngrok console for connection issues
4. Restart everything: `.\START_EVERYTHING.bat`

---

## 🎉 Success Checklist

After setup, you should see:
- ✅ Backend window shows "Running on http://127.0.0.1:5002"
- ✅ Ngrok window shows "Forwarding https://...ngrok... -> http://localhost:5002"
- ✅ Opening ngrok URL in browser shows portal
- ✅ Portal shows item counts (not 0)
- ✅ All sections have data

**If all checked - you're good to go!** 🚀

