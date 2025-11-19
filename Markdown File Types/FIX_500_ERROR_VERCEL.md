# Fix 500 Error on Vercel - Token Issue

## 🔍 Problem Identified

The 500 errors are caused by an **invalid or expired `GOOGLE_DRIVE_TOKEN`**. 

When the token is invalid/expired:
1. Code tries to refresh it (fails)
2. Code tries to run OAuth flow with `flow.run_local_server(port=0)` 
3. **This fails on Vercel serverless** → 500 error

## ✅ Fix Applied

I've updated `backend/google_drive_service.py` to:
- Detect when running on serverless (Vercel)
- Give a clear error message instead of trying to run OAuth flow
- Tell you exactly what to do

## 📋 Steps to Fix

### Step 1: Get Fresh Token Locally

1. **Make sure your local backend has authenticated:**
   ```bash
   # Check if token file exists
   ls backend/google_drive_token.pickle
   ```

2. **If token file exists, extract fresh token:**
   ```bash
   python get_vercel_env_vars.py
   ```

3. **This will create `vercel_token.txt` with the token JSON**

### Step 2: Update Token in Vercel

1. **Go to:** Vercel Dashboard → Your Project → **Settings** → **Environment Variables**

2. **Find:** `GOOGLE_DRIVE_TOKEN`

3. **Click:** Three dots (⋯) → **Edit**

4. **Copy token from `vercel_token.txt`** (the entire JSON string)

5. **Paste** into the Value field

6. **Click:** Save

### Step 3: Push Code Fix

The code fix needs to be pushed:

```bash
git add backend/google_drive_service.py
git commit -m "Fix: Prevent OAuth flow on Vercel serverless when token invalid"
git push
```

### Step 4: Redeploy on Vercel

1. **Go to:** Vercel Dashboard → Your Project → **Deployments**

2. **Click:** Three dots (⋯) on latest deployment → **Redeploy**

3. **Wait:** For deployment to complete

## 🚨 If You Don't Have Local Token

If `backend/google_drive_token.pickle` doesn't exist:

1. **Run local backend:**
   ```bash
   cd backend
   python app.py
   ```

2. **Backend will try to authenticate** - follow the OAuth flow

3. **After authentication, token will be saved**

4. **Then run:** `python get_vercel_env_vars.py` to extract token

5. **Update `GOOGLE_DRIVE_TOKEN` in Vercel** (Step 2 above)

## ✅ Verification

After updating token and redeploying:

1. **Check Vercel logs:**
   - Should see: `✅ Loaded Google Drive token from environment variable`
   - Should see: `✅ Google Drive API authenticated successfully`
   - Should NOT see: `❌ Google Drive token is invalid or expired`

2. **Test frontend:**
   - Should load data (not 0 data)
   - Should NOT see 500 errors in console

## 📝 Summary

**Root Cause:** `GOOGLE_DRIVE_TOKEN` is invalid/expired

**Fix:**
1. Get fresh token locally (`python get_vercel_env_vars.py`)
2. Update `GOOGLE_DRIVE_TOKEN` in Vercel
3. Push code fix (prevents OAuth flow on serverless)
4. Redeploy

**That's it!** The token will auto-refresh once it's valid.

