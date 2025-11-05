# Deploy Backend on Vercel as Serverless Functions - FREE!

## 🎯 What This Does

Deploys your Flask backend **directly on Vercel** as serverless functions. No Render, no other services needed - everything runs on Vercel!

---

## ✅ What I Created

1. **`api/index.py`** - Serverless function wrapper for Flask
2. **`api/requirements.txt`** - Python dependencies for serverless
3. **Updated `vercel.json`** - Routes API calls to serverless functions

---

## 📋 Step 1: Push Changes

The files are already created. Just push to GitHub:

```bash
git add api/ vercel.json
git commit -m "Add Vercel serverless backend support"
git push
```

---

## 📋 Step 2: Set Environment Variables in Vercel

1. **Go to:** Vercel Dashboard → "canoil-portal" project
2. **Settings** → **Environment Variables**
3. **Add these variables:**

### Backend Environment Variables:

```
USE_GOOGLE_DRIVE_API=true

GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation

GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions

GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders

GOOGLE_DRIVE_CREDENTIALS={"installed": {"client_id": "711358371169-r7tcm0q20mgr6a4l036psq6n5lobe71j.apps.googleusercontent.com", "project_id": "dulcet-order-474521-q1", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "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", "redirect_uris": ["http://localhost"]}}
```

**OR** copy from `vercel_credentials.txt`

### Frontend Environment Variable:

```
VITE_API_URL=https://canoil-portal.vercel.app
```

(Use your actual Vercel project URL - same domain for frontend and backend!)

---

## 📋 Step 3: Redeploy

1. **Go to:** Deployments tab
2. **Click:** Latest deployment → ⋯ → **Redeploy**
3. **Wait:** For deployment to complete

---

## 📋 Step 4: Get Google Drive Token (After First Deploy)

1. **Check logs** after deployment
2. **If you see:** `⚠️ First-time authentication required`
   - Follow the auth flow
   - Copy token JSON from logs
3. **Add environment variable:**
   ```
   Key: GOOGLE_DRIVE_TOKEN
   Value: (paste token JSON)
   ```
4. **Save** → Auto-redeploys

---

## ✅ How It Works

- **Frontend:** Served from `frontend/dist` (static files)
- **Backend API:** Runs as serverless functions in `api/` directory
- **All API calls:** `/api/*` routes to `api/index.py` serverless function
- **Same domain:** Frontend and backend on same Vercel project
- **FREE:** No payment needed!

---

## 🚨 Troubleshooting

**Backend not working?**
- Check logs in Vercel dashboard
- Verify `api/index.py` exists
- Verify `api/requirements.txt` exists
- Check environment variables are set

**API calls failing?**
- Verify `VITE_API_URL` is set to your Vercel URL
- Check browser console for errors
- Verify serverless functions are deployed (check Functions tab)

**Google Drive not connecting?**
- Verify `GOOGLE_DRIVE_CREDENTIALS` is set correctly
- Get token (Step 4) and set `GOOGLE_DRIVE_TOKEN`
- Check serverless function logs

---

## 📝 Complete Checklist

- [ ] `api/index.py` created ✅
- [ ] `api/requirements.txt` created ✅
- [ ] `vercel.json` updated ✅
- [ ] Changes pushed to GitHub
- [ ] Environment variables set in Vercel
- [ ] Project redeployed
- [ ] Google Drive token obtained (if needed)
- [ ] `GOOGLE_DRIVE_TOKEN` set
- [ ] Everything works! ✅

---

## 🎉 That's It!

Now everything runs on Vercel:
- ✅ Frontend on Vercel
- ✅ Backend on Vercel (serverless functions)
- ✅ Same domain (no CORS issues)
- ✅ FREE (no payment needed)
- ✅ No other services required!

