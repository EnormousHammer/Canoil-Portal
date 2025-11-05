# Vercel "0 Data" Fix Summary

## The Problem

Frontend on Vercel is trying to connect to `localhost:5002` instead of the actual backend URL.

**Console Error:**
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
localhost:5002/api/data:1
```

## The Root Cause

**Missing `VITE_API_URL` environment variable in Vercel**

When `VITE_API_URL` is not set, the frontend defaults to `http://localhost:5002` (see `frontend/src/utils/apiConfig.ts`).

## The Solution

### Step 1: Set VITE_API_URL in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **Add New**
3. Set:
   - **Key**: `VITE_API_URL`
   - **Value**: Your backend URL (e.g., `https://canoil-portal-backend.onrender.com`)
   - **Environment**: Production (and Preview if needed)
4. Click **Save**

### Step 2: Redeploy Frontend

After setting the environment variable, you **MUST** redeploy:

1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger automatic deployment

**Important:** Environment variables are only available after redeployment!

## Backend Configuration (Already Working)

Your backend on Render is correctly configured:

- ✅ `USE_GOOGLE_DRIVE_API=true` - Enables Google Drive API mode
- ✅ `GOOGLE_DRIVE_CREDENTIALS` - OAuth credentials from environment variable
- ✅ `GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation`
- ✅ `GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions`
- ✅ `GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders`

**How it works:**
1. Backend loads credentials from `GOOGLE_DRIVE_CREDENTIALS` environment variable
2. Uses saved token from disk (`google_drive_token.pickle`) if it exists
3. Auto-refreshes token when expired
4. Connects to Google Drive API directly
5. Returns data to frontend

## Verification

After setting `VITE_API_URL` and redeploying:

1. Open browser console (F12) on Vercel
2. Look for: `🔧 API Configuration:`
3. Should show:
   ```
   VITE_API_URL: "https://your-backend-url.onrender.com"
   API_BASE_URL: "https://your-backend-url.onrender.com"
   isProduction: true
   ```
4. Should NOT show: `localhost:5002`

## Files Changed

I've added better error logging to help diagnose this:

1. **`frontend/src/utils/apiConfig.ts`**:
   - Logs API configuration on load
   - Warns if using localhost in production
   - Shows which environment variable is set

2. **`frontend/src/services/GDriveDataLoader.ts`**:
   - Enhanced error logging with URL and hints
   - Warns if using localhost in production

3. **`frontend/src/App.tsx`**:
   - Enhanced MPS data loading error logging

## Summary

**The fix:** Set `VITE_API_URL` in Vercel environment variables and redeploy.

**Why it was working before:** `VITE_API_URL` was set, but got removed or the build wasn't redeployed after changes.

**Backend is fine:** Google Drive API connection is working correctly with saved tokens that auto-refresh.

