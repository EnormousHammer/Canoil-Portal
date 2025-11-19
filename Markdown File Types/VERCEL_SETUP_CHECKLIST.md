# Vercel Setup Checklist - Fix "0 Data" Issue

## ✅ Code Changes (Already Pushed)

The code changes are already pushed:
- ✅ Support for `GOOGLE_DRIVE_TOKEN` environment variable
- ✅ Better cache checking (skips empty cache)
- ✅ Enhanced error logging

## 🔧 What You Need to Do NOW in Vercel Dashboard

### Step 1: Set Frontend Environment Variables

1. Go to **Vercel Dashboard** → Your Frontend Project → **Settings** → **Environment Variables**
2. Add these variables:

   **Required:**
   - `VITE_API_URL` = Your backend URL
     - Example: `https://your-backend.vercel.app` 
     - Or: `https://canoil-portal-backend.onrender.com` (if backend is on Render)
   
   **Important:** After adding, you MUST redeploy the frontend!

### Step 2: Set Backend Environment Variables (If backend is on Vercel)

1. Go to **Vercel Dashboard** → Your Backend Project → **Settings** → **Environment Variables**
2. Add these variables:

   **Required:**
   ```
   USE_GOOGLE_DRIVE_API=true
   GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation
   GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions
   GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders
   ```

   **OAuth Credentials (get from Google Cloud Console):**
   ```
   GOOGLE_DRIVE_CREDENTIALS={"web":{"client_id":"...","client_secret":"...","project_id":"..."}}
   ```
   - Copy the ENTIRE JSON from your OAuth credentials file
   - Paste it as one line (or multiline if Vercel supports it)

   **Token (get from previous auth):**
   ```
   GOOGLE_DRIVE_TOKEN={"token":"...","refresh_token":"...","token_uri":"...","client_id":"..."}
   ```
   - If you don't have this yet, see "How to Get Token" below

3. **Important:** After adding, you MUST redeploy the backend!

### Step 3: Redeploy Both Services

1. **Frontend:** Go to Deployments → Click "Redeploy" on latest
2. **Backend:** Go to Deployments → Click "Redeploy" on latest

**Why redeploy?** Environment variables are only available after redeployment!

---

## 🔑 How to Get GOOGLE_DRIVE_TOKEN

If you don't have the token yet:

### Option 1: Get from Local Backend (Easiest)

1. Make sure your local backend has authenticated before
2. Check if `backend/google_drive_token.pickle` exists
3. Run this Python script to extract token JSON:

```python
import pickle
import json

# Load token from pickle file
with open('backend/google_drive_token.pickle', 'rb') as f:
    creds = pickle.load(f)

# Convert to JSON
token_json = creds.to_json()
print(token_json)

# Copy the output and paste into VERCEL environment variable GOOGLE_DRIVE_TOKEN
```

### Option 2: Authenticate Once on Render/Vercel

1. Set `GOOGLE_DRIVE_CREDENTIALS` in Vercel
2. Deploy backend
3. Check backend logs for the token JSON (it will print it)
4. Copy the token JSON
5. Set it as `GOOGLE_DRIVE_TOKEN` environment variable
6. Redeploy

---

## ✅ Verification Checklist

After setting everything and redeploying:

1. **Frontend Console (F12):**
   - Should see: `🔧 API Configuration:`
   - Should show: `VITE_API_URL: "https://your-backend-url"`
   - Should NOT show: `localhost:5002`

2. **Backend Logs:**
   - Should see: `✅ Google Drive API service initialized`
   - Should see: `✅ Loaded Google Drive token from environment variable` OR `✅ Loaded Google Drive token from file`
   - Should see: `✅ Google Drive API authenticated successfully`
   - Should see: `📡 Loading data from Google Drive API...`
   - Should see: `✅ Data loaded successfully from Google Drive API`

3. **Frontend:**
   - Should show data (not empty/0 data)
   - Should load emails if Gmail is configured

---

## 🚨 Common Issues

### Still seeing `localhost:5002` in console?
- **Fix:** `VITE_API_URL` not set OR frontend not redeployed after setting it
- **Solution:** Set `VITE_API_URL` and redeploy frontend

### Backend returns empty data?
- **Fix:** Check backend logs for authentication errors
- **Solution:** Verify `GOOGLE_DRIVE_CREDENTIALS` and `GOOGLE_DRIVE_TOKEN` are set correctly

### Backend can't authenticate?
- **Fix:** Token expired or invalid
- **Solution:** Get fresh token (see "How to Get Token" above)

### Cache returning empty data?
- **Fix:** Backend cache is empty but marked as valid
- **Solution:** Code now checks for empty cache - should auto-refresh. If not, add `?force=true` to API calls

---

## 📝 Quick Summary

**Minimum Required:**
1. Frontend: `VITE_API_URL` set → Redeploy
2. Backend: `USE_GOOGLE_DRIVE_API=true` + `GOOGLE_DRIVE_CREDENTIALS` + `GOOGLE_DRIVE_TOKEN` → Redeploy

**That's it!** The code changes are already pushed, you just need to set the environment variables and redeploy.

