# FIX: Stop Having to Log In Every Time! 🔥

## The Problem
You have to log into Google **every single time** you launch the app on Render/ngrok. **NOT ACCEPTABLE!**

## The Cause
Render.com deletes files on every restart → Your tokens get deleted → You have to log in again.

## The Solution ✅
Store tokens as **environment variables** on Render instead of files.

---

## Quick Fix (3 Minutes)

### Step 1: Extract Tokens Locally
```bash
SETUP_RENDER_TOKENS.bat
```

This will print something like:
```
Variable name: GOOGLE_DRIVE_TOKEN
Variable value: {"token":"ya29...","refresh_token":"1//0gXz..."}

Variable name: GMAIL_TOKEN  
Variable value: {"token":"ya29...","refresh_token":"1//0gXz..."}
```

### Step 2: Add to Render
1. Go to https://dashboard.render.com/
2. Select `canoil-portal-backend`
3. Click **Environment** tab
4. Add these 2 variables:
   - `GOOGLE_DRIVE_TOKEN` = (paste the JSON)
   - `GMAIL_TOKEN` = (paste the JSON)
5. Click **Save Changes**

### Step 3: Done! 🎉
- Render will auto-redeploy (2-3 minutes)
- **Never log in again!**

---

## What Changed

### Before ❌
- Tokens saved as files
- Files deleted on restart
- **Had to log in EVERY TIME**

### After ✅
- Tokens saved as environment variables
- Env vars persist forever
- **Log in ONCE, works forever**

---

## Verification

After Render redeploys, check the logs for:
```
✅ Gmail credentials loaded from environment variable (persistent across restarts)
✅ Google Drive token loaded from environment variable
```

If you see that, **IT'S FIXED!** 🎉

---

## Troubleshooting

**Still asking to log in?**
1. Check env vars are set on Render
2. Check JSON is valid (starts with `{` ends with `}`)
3. Trigger manual redeploy on Render

**"No tokens found" when running script?**
1. Run `start_backend.bat` first
2. Authenticate with Google when prompted
3. Run `SETUP_RENDER_TOKENS.bat` again

---

## Files Modified
- ✅ `backend/gmail_email_service.py` - Added env var support
- ✅ `backend/extract_tokens_for_render.py` - NEW script to extract tokens
- ✅ `SETUP_RENDER_TOKENS.bat` - One-click extraction
- ✅ `render.yaml` - Added env var comments

---

**See `RENDER_PERSISTENT_LOGIN_FIX.md` for full technical details.**



