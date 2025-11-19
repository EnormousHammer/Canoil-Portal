# Complete Render Backend Setup - Copy & Paste

## 🎯 What This Does
Deploys your Flask backend to Render with Google Drive API configured.

---

## 📋 Step 1: Go to Render

1. **Open:** https://render.com
2. **Sign up/Login** with GitHub
3. **Click:** "New +" → "Web Service"

---

## 📋 Step 2: Connect Repository

**After clicking "New +" → "Web Service", you'll see a page asking you to connect a repository:**

1. **If you see "Connect GitHub" button:**
   - Click the **"Connect GitHub"** button (usually blue/green button)
   - You'll be asked to authorize Render
   - Click **"Authorize"** or **"Grant Access"**
   - You'll see a list of your GitHub repositories
   - Find and click **`EnormousHammer/Canoil-Portal`** in the list
   - Click **"Connect"** or **"Select"**

2. **If you already connected GitHub:**
   - You'll see a dropdown or list of repositories
   - Select **`EnormousHammer/Canoil-Portal`** from the list
   - Or type `EnormousHammer/Canoil-Portal` in the search box

3. **After selecting repository:**
   - **Branch:** Should auto-select `main` (or select it from dropdown)
   - You should see a green checkmark or "Connected" message
   - Click **"Continue"** or **"Next"** button (if there is one)

---

## 📋 Step 3: Configure Service

**On the Render page, you'll see several sections. Fill in these EXACT values:**

### Section 1: Basic Settings (at the top)
- **Name:** Type `canoil-portal-backend`
- **Region:** Select `Oregon (US West)` (or closest to you from dropdown)
- **Branch:** Type `main` (or select from dropdown if it shows)
- **Root Directory:** (leave blank - don't type anything)

### Section 2: Environment (middle section)
- **Runtime:** Select `Python 3` from dropdown
- **Python Version:** Select `3.11.0` from dropdown (or latest available)

### Section 3: Build & Deploy (scroll down)
- **Build Command:** Type `pip install -r backend/requirements.txt`
- **Start Command:** Type `cd backend && python app.py`

### Section 4: Plan (bottom)
- **Plan:** Select `Free` from dropdown (or `Starter` if you want)

**Note:** Scroll down the page to see all sections. They're all on the same page, just scroll down!

---

## 📋 Step 4: Add Environment Variables

**BEFORE clicking "Create Web Service"**, scroll to **"Environment Variables"** section and add these EXACTLY:

### Variable 1:
```
Key: USE_GOOGLE_DRIVE_API
Value: true
```

### Variable 2:
```
Key: GOOGLE_DRIVE_SHARED_DRIVE_NAME
Value: IT_Automation
```

### Variable 3:
```
Key: GOOGLE_DRIVE_BASE_FOLDER_PATH
Value: MiSys/Misys Extracted Data/API Extractions
```

### Variable 4:
```
Key: GOOGLE_DRIVE_SALES_ORDERS_PATH
Value: Sales_CSR/Customer Orders/Sales Orders
```

### Variable 5:
```
Key: GOOGLE_DRIVE_CREDENTIALS
Value: {"installed": {"client_id": "711358371169-r7tcm0q20mgr6a4l036psq6n5lobe71j.apps.googleusercontent.com", "project_id": "dulcet-order-474521-q1", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "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", "redirect_uris": ["http://localhost"]}}
```

**OR** copy the entire contents from `vercel_credentials.txt` file

### Variable 6:
```
Key: PORT
Value: 10000
```

---

## 📋 Step 5: Deploy

1. **Click:** "Create Web Service"
2. **Wait:** 5-10 minutes for first deployment
3. **Watch logs:** Should see "✅ Google Drive API service initialized"

---

## 📋 Step 6: Get Backend URL

1. Once deployed (green checkmark ✅)
2. **Copy the URL** at the top (e.g., `https://canoil-portal-backend.onrender.com`)
3. **Save this URL** - you need it for Vercel!

---

## 📋 Step 7: Get Token (After First Deploy)

1. Go to your backend service → **"Logs"** tab
2. Look for authentication messages
3. If you see: `⚠️ First-time authentication required`
   - Backend will print an auth URL
   - Copy it → Open in browser
   - Sign in with Google (use account that has access to shared drive)
   - Grant permissions
   - Backend logs will show token JSON
   - Copy the entire token JSON
4. Go to backend service → **"Environment"** tab
5. **Add new variable:**
   ```
   Key: GOOGLE_DRIVE_TOKEN
   Value: (paste the token JSON you copied)
   ```
6. **Click:** "Save Changes"
7. **Wait:** Auto-redeploy completes

---

## 📋 Step 8: Update Vercel Frontend

1. **Go to:** https://vercel.com
2. **Open:** "canoil-portal" project
3. **Settings** → **Environment Variables**
4. **Add/Update:**
   ```
   Key: VITE_API_URL
   Value: https://canoil-portal-backend.onrender.com
   ```
   (Replace with YOUR actual backend URL from Step 6)
5. **Click:** "Save"
6. **Go to:** "Deployments" tab
7. **Click:** three dots (⋯) on latest deployment
8. **Click:** "Redeploy"
9. **Wait:** For deployment to complete

---

## ✅ Verification

**Backend Logs Should Show:**
- ✅ `Google Drive API service initialized`
- ✅ `Loaded Google Drive token from environment variable`
- ✅ `Google Drive API authenticated successfully`
- ✅ `Loading data from Google Drive API...`
- ✅ `Data loaded successfully from Google Drive API`

**Frontend Console Should Show:**
- ✅ `🔧 API Configuration:`
- ✅ `VITE_API_URL: "https://your-backend.onrender.com"`
- ✅ Should NOT show `localhost:5002`
- ✅ Data loads (not empty/0 data)

---

## 🚨 If Something Fails

**Backend won't start?**
- Check logs for Python errors
- Verify `requirements.txt` has all dependencies
- Check Python version matches

**Backend can't authenticate?**
- Verify `GOOGLE_DRIVE_CREDENTIALS` is correct (copy from `vercel_credentials.txt`)
- Get token (Step 7) and set `GOOGLE_DRIVE_TOKEN`
- Check logs for specific error messages

**Frontend still shows "0 data"?**
- Verify `VITE_API_URL` is set correctly in Vercel
- Make sure frontend was redeployed after setting variable
- Check browser console (F12) for API errors
- Verify backend URL is accessible (try opening it in browser)

---

## 📝 Complete Checklist

- [ ] Render account created/logged in
- [ ] Web Service created
- [ ] All 6 environment variables added
- [ ] Backend deployed successfully
- [ ] Backend URL copied
- [ ] Google Drive token obtained (Step 7)
- [ ] `GOOGLE_DRIVE_TOKEN` added to Render
- [ ] `VITE_API_URL` set in Vercel
- [ ] Frontend redeployed on Vercel
- [ ] Backend logs show success ✅
- [ ] Frontend shows data (not empty) ✅

---

## 🎉 That's It!

Once all checkboxes are done, your app should work:
- Frontend on Vercel connects to backend on Render
- Backend connects to Google Drive API
- Data loads correctly
- Everything works! 🚀

