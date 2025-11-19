# Vercel Backend Deployment Guide - Fix 500 Errors

## 🔍 Problem Analysis

Based on the code review, the backend is failing with 500 errors because:

1. **The `GOOGLE_DRIVE_TOKEN` environment variable is missing or invalid**
   - The code in `backend/google_drive_service.py` tries to load token from `GOOGLE_DRIVE_TOKEN` env var first
   - If token is missing/invalid, it tries to run OAuth flow with `flow.run_local_server(port=0)` which **fails on Vercel serverless**
   - This causes the 500 error

2. **Required files exist:**
   - ✅ `api/index.py` - Serverless function wrapper
   - ✅ `api/requirements.txt` - Python dependencies
   - ✅ `vercel.json` - Routes configuration

## 📋 Step-by-Step Fix Process

### STEP 1: Verify Required Files Are Pushed

Check that these files exist in your repository:

```bash
# Check if files exist
ls api/index.py
ls api/requirements.txt
ls vercel.json
```

If missing, they need to be committed and pushed:

```bash
git add api/ vercel.json
git commit -m "Ensure Vercel serverless backend files are present"
git push
```

### STEP 2: Set Environment Variables in Vercel

**Go to:** Vercel Dashboard → Your Project → **Settings** → **Environment Variables**

#### Required Backend Environment Variables (6 total):

1. **`USE_GOOGLE_DRIVE_API`**
   ```
   Value: true
   ```

2. **`GOOGLE_DRIVE_SHARED_DRIVE_NAME`**
   ```
   Value: IT_Automation
   ```

3. **`GOOGLE_DRIVE_BASE_FOLDER_PATH`**
   ```
   Value: MiSys/Misys Extracted Data/API Extractions
   ```

4. **`GOOGLE_DRIVE_SALES_ORDERS_PATH`**
   ```
   Value: Sales_CSR/Customer Orders/Sales Orders
   ```

5. **`GOOGLE_DRIVE_CREDENTIALS`**
   - Copy from `vercel_credentials.txt` file in your project
   - OR use this (if file doesn't exist):
   ```
   {"installed": {"client_id": "711358371169-r7tcm0q20mgr6a4l036psq6n5lobe71j.apps.googleusercontent.com", "project_id": "dulcet-order-474521-q1", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "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", "redirect_uris": ["http://localhost"]}}
   ```

6. **`GOOGLE_DRIVE_TOKEN`** ⚠️ **CRITICAL - This is likely missing!**
   - This must be a valid JSON token string
   - See "How to Get Token" section below

#### Required Frontend Environment Variable:

1. **`VITE_API_URL`**
   ```
   Value: https://your-project-name.vercel.app
   ```
   (Replace with your actual Vercel project URL)

### STEP 3: Get Google Drive Token

The token is the most critical piece. Here's how to get it:

#### Option A: Extract from Local Backend (Easiest)

If you have a local backend that's already authenticated:

1. **Check if token file exists:**
   ```bash
   ls backend/google_drive_token.pickle
   ```

2. **Run the extraction script:**
   ```bash
   python get_vercel_env_vars.py
   ```

3. **Copy token from `vercel_token.txt`** and set as `GOOGLE_DRIVE_TOKEN` in Vercel

#### Option B: Generate New Token (If no local token)

1. **Set all other environment variables first** (Steps 1-5 above)
2. **Redeploy backend** (see Step 4)
3. **Check backend logs** in Vercel dashboard
4. **Look for authentication URL** in logs
5. **Visit URL and authenticate**
6. **Copy token JSON from logs** (will be printed after auth)
7. **Set as `GOOGLE_DRIVE_TOKEN`** environment variable
8. **Redeploy again**

### STEP 4: Redeploy After Setting Variables

**CRITICAL:** Environment variables only take effect after redeployment!

1. **Go to:** Vercel Dashboard → Your Project → **Deployments** tab
2. **Click:** Three dots (⋯) on latest deployment
3. **Click:** **Redeploy**
4. **Wait:** For deployment to complete (watch the build logs)

### STEP 5: Verify Backend is Working

1. **Check Backend Logs:**
   - Go to: Deployments → Latest → **Logs** tab
   - Look for these success messages:
     ```
     ✅ Google Drive API service initialized
     ✅ Loaded Google Drive token from environment variable
     ✅ Google Drive API authenticated successfully
     ```

2. **Test API Endpoint:**
   - Visit: `https://your-project.vercel.app/api/data`
   - Should return JSON data (not 500 error)

3. **Check Frontend Console:**
   - Open browser console (F12)
   - Should see: `VITE_API_URL: "https://your-project.vercel.app"`
   - Should NOT see: `localhost:5002`
   - Should NOT see: `500` errors

## 🚨 Troubleshooting

### Still Getting 500 Errors?

1. **Check if `GOOGLE_DRIVE_TOKEN` is set:**
   - Go to Vercel → Settings → Environment Variables
   - Verify `GOOGLE_DRIVE_TOKEN` exists and has a value
   - Value should be a JSON string starting with `{"token":`

2. **Check Backend Logs for Specific Error:**
   - Go to: Deployments → Latest → Logs
   - Look for error messages like:
     - `❌ Error loading token from environment`
     - `⚠️ First-time authentication required`
     - `❌ Error using environment credentials`

3. **Token Format Issues:**
   - Token must be valid JSON
   - Should start with `{"token":` or `{"installed":`
   - No extra quotes or escaping needed in Vercel UI

4. **Token Expired:**
   - Token should auto-refresh if it has `refresh_token`
   - If refresh fails, need to get new token (see Step 3)

### Frontend Shows `localhost:5002`?

- **Fix:** `VITE_API_URL` not set or frontend not redeployed
- **Solution:** Set `VITE_API_URL` and redeploy frontend

### Backend Returns Empty Data?

- **Fix:** Check backend logs for authentication errors
- **Solution:** Verify `GOOGLE_DRIVE_CREDENTIALS` and `GOOGLE_DRIVE_TOKEN` are correct

## 📝 Quick Checklist

Before pushing, verify:

- [ ] `api/index.py` exists and is committed
- [ ] `api/requirements.txt` exists and is committed
- [ ] `vercel.json` exists and is committed
- [ ] All 6 backend environment variables are set in Vercel
- [ ] `VITE_API_URL` is set in Vercel (frontend)
- [ ] `GOOGLE_DRIVE_TOKEN` is set and valid
- [ ] Backend redeployed after setting variables
- [ ] Frontend redeployed after setting variables
- [ ] Backend logs show successful authentication
- [ ] Frontend console shows correct API URL

## 🎯 Most Likely Issue

Based on the 500 errors you're seeing, the **most likely problem** is:

**`GOOGLE_DRIVE_TOKEN` is missing or invalid**

The code tries to load token from environment variable first. If it's missing, it tries to run OAuth flow which fails on serverless, causing the 500 error.

**Solution:** Get a valid token (see Step 3) and set it as `GOOGLE_DRIVE_TOKEN` in Vercel, then redeploy.

## 📚 Reference Files

- `VERCEL_SERVERLESS_BACKEND_SETUP.md` - Original setup guide
- `VERCEL_SETUP_STEP_BY_STEP.md` - Detailed step-by-step
- `VERCEL_ENV_VARS_TO_SET.md` - Quick reference for env vars
- `get_vercel_env_vars.py` - Script to extract token from local backend

