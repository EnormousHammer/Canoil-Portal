# Vercel Email Loading Fix

## Issue: Emails Not Loading on Vercel

The backend is returning empty cached results: `{cached: true, emails: Array(0)}`

## Root Causes

1. **Backend API URL not configured on Vercel**
   - `VITE_API_URL` environment variable missing or incorrect
   - Frontend defaults to `http://localhost:5002` which doesn't work on Vercel

2. **Backend Gmail not authenticated**
   - Backend on Render/Vercel doesn't have Gmail credentials
   - `token.pickle` file missing on server
   - Gmail service returns empty results

## Solution

### Step 1: Configure Vercel Environment Variable

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add/Update:
   ```
   Name: VITE_API_URL
   Value: https://your-backend-url.onrender.com
   ```
   (Replace with your actual backend URL from Render/Railway)

3. **Important:** After adding, you must:
   - **Redeploy** the frontend (or push a new commit to trigger redeploy)
   - Environment variables are baked in at BUILD time, not runtime

### Step 2: Verify Backend is Running

Check your backend URL in browser:
- `https://your-backend-url.onrender.com/api/email/status`
- Should return: `{"connected": true/false, "email": "..."}`

If you get an error, backend isn't running or isn't deployed.

### Step 3: Authenticate Gmail on Backend

If backend returns `{"connected": false}`:
- Backend needs Gmail credentials uploaded to the server
- Or backend needs to be re-authenticated via OAuth flow
- Token files (`token.pickle`, `credentials.json`) must exist on backend server

### Step 4: Check Console Logs

After deploying, check browser console (F12) on Vercel:
- Look for: `🌐 Fetching emails from:` - Should show your Render backend URL
- Look for: `📡 Backend response received:` - Check what the backend is returning
- Look for: `⚠️ DEBUG: Empty emails array received` - This means backend returned empty array

## Common Issues

### Issue: Still showing localhost:5002
**Fix:** `VITE_API_URL` not set correctly OR frontend wasn't redeployed after setting it

### Issue: CORS errors
**Fix:** Backend must allow requests from Vercel domain (add CORS headers)

### Issue: Backend returns empty emails
**Fix:** Backend Gmail isn't authenticated - need to authenticate Gmail on the deployed backend

### Issue: Backend URL wrong
**Fix:** Check Render dashboard for correct backend URL, update `VITE_API_URL` in Vercel

## Quick Debug Checklist

✅ `VITE_API_URL` set in Vercel environment variables  
✅ Frontend redeployed after setting `VITE_API_URL`  
✅ Backend is running and accessible at the URL in `VITE_API_URL`  
✅ Backend `/api/email/status` returns `{"connected": true}`  
✅ Backend has Gmail credentials (`token.pickle` exists)  
✅ Check browser console for actual API URLs being called


