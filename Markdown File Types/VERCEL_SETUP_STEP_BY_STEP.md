# Vercel Setup - Step by Step Instructions

## 📋 Prerequisites

- Vercel account logged in
- Backend and Frontend projects already deployed on Vercel
- Access to Vercel dashboard

---

## 🔧 PART 1: Set Backend Environment Variables

### Step 1: Open Vercel Dashboard
1. Go to https://vercel.com
2. Log in to your account
3. You should see your projects list

### Step 2: Open Backend Project
1. Find your **backend project** in the list
2. Click on it to open the project dashboard

### Step 3: Go to Environment Variables
1. Click on **"Settings"** tab (at the top)
2. Click on **"Environment Variables"** in the left sidebar
3. You should see a list of existing variables (or empty if none)

### Step 4: Add First Variable - USE_GOOGLE_DRIVE_API
1. Click the **"Add New"** button (or "Add" button)
2. In the **"Key"** field, type: `USE_GOOGLE_DRIVE_API`
3. In the **"Value"** field, type: `true`
4. Select **"Production"** environment (and Preview/Development if you want)
5. Click **"Save"**

### Step 5: Add Second Variable - GOOGLE_DRIVE_SHARED_DRIVE_NAME
1. Click **"Add New"** again
2. **Key:** `GOOGLE_DRIVE_SHARED_DRIVE_NAME`
3. **Value:** `IT_Automation`
4. Select **"Production"** (and Preview/Development if needed)
5. Click **"Save"**

### Step 6: Add Third Variable - GOOGLE_DRIVE_BASE_FOLDER_PATH
1. Click **"Add New"**
2. **Key:** `GOOGLE_DRIVE_BASE_FOLDER_PATH`
3. **Value:** `MiSys/Misys Extracted Data/API Extractions`
4. Select **"Production"**
5. Click **"Save"**

### Step 7: Add Fourth Variable - GOOGLE_DRIVE_SALES_ORDERS_PATH
1. Click **"Add New"**
2. **Key:** `GOOGLE_DRIVE_SALES_ORDERS_PATH`
3. **Value:** `Sales_CSR/Customer Orders/Sales Orders`
4. Select **"Production"**
5. Click **"Save"**

### Step 8: Add Fifth Variable - GOOGLE_DRIVE_CREDENTIALS
1. Click **"Add New"**
2. **Key:** `GOOGLE_DRIVE_CREDENTIALS`
3. **Value:** Copy this entire line (it's one long JSON string):
   ```
   {"installed": {"client_id": "711358371169-r7tcm0q20mgr6a4l036psq6n5lobe71j.apps.googleusercontent.com", "project_id": "dulcet-order-474521-q1", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "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", "redirect_uris": ["http://localhost"]}}
   ```
   **OR** open the file `vercel_credentials.txt` in your project folder and copy the entire contents
4. Paste it into the **"Value"** field
5. Select **"Production"**
6. Click **"Save"**

### Step 9: Verify Backend Variables
You should now see these 5 variables listed:
- ✅ `USE_GOOGLE_DRIVE_API` = `true`
- ✅ `GOOGLE_DRIVE_SHARED_DRIVE_NAME` = `IT_Automation`
- ✅ `GOOGLE_DRIVE_BASE_FOLDER_PATH` = `MiSys/Misys Extracted Data/API Extractions`
- ✅ `GOOGLE_DRIVE_SALES_ORDERS_PATH` = `Sales_CSR/Customer Orders/Sales Orders`
- ✅ `GOOGLE_DRIVE_CREDENTIALS` = (long JSON string)

---

## 🎨 PART 2: Set Frontend Environment Variables

### Step 10: Open Frontend Project
1. Go back to your Vercel dashboard (click your profile/logo at top)
2. Find your **frontend project** in the list
3. Click on it

### Step 11: Go to Frontend Environment Variables
1. Click **"Settings"** tab
2. Click **"Environment Variables"** in left sidebar

### Step 12: Add Frontend Variable - VITE_API_URL
1. Click **"Add New"**
2. **Key:** `VITE_API_URL`
3. **Value:** Your backend URL
   - **If backend is on Vercel:** `https://your-backend-project-name.vercel.app`
   - **If backend is on Render:** `https://your-backend-project-name.onrender.com`
   - **To find your backend URL:** Go to your backend project in Vercel → "Deployments" tab → Click the latest deployment → Copy the URL from the address bar
4. Select **"Production"** (and Preview/Development if needed)
5. Click **"Save"**

### Step 13: Verify Frontend Variable
You should see:
- ✅ `VITE_API_URL` = `https://your-backend-url...`

---

## 🚀 PART 3: Redeploy Both Services

### Step 14: Redeploy Backend
1. Go to your **backend project** in Vercel
2. Click on **"Deployments"** tab (at the top)
3. Find the **latest deployment** (should be at the top)
4. Click the **three dots** (⋯) menu on the right side of that deployment
5. Click **"Redeploy"**
6. Confirm by clicking **"Redeploy"** again
7. Wait for deployment to complete (you'll see it building)

### Step 15: Redeploy Frontend
1. Go to your **frontend project** in Vercel
2. Click on **"Deployments"** tab
3. Find the **latest deployment**
4. Click the **three dots** (⋯) menu
5. Click **"Redeploy"**
6. Confirm by clicking **"Redeploy"** again
7. Wait for deployment to complete

---

## 🔑 PART 4: Get Google Drive Token (After First Deploy)

### Step 16: Check Backend Logs
1. Go to your **backend project** in Vercel
2. Click on **"Deployments"** tab
3. Click on the **latest deployment** (the one you just redeployed)
4. Click on **"Logs"** tab (or "View Function Logs")
5. Look for messages about Google Drive authentication

### Step 17: Authentication Flow
The backend will either:

**Option A: Token Already Exists**
- If you see: `✅ Loaded Google Drive token from environment variable`
- You're done! Skip to Step 20

**Option B: Needs First-Time Authentication**
- If you see: `⚠️ First-time authentication required`
- The backend will print an authentication URL
- Copy that URL
- Open it in your browser
- Sign in with Google account that has access to the shared drive
- Grant permissions
- Copy the authorization code from the URL or page
- Submit it to the backend (there should be an endpoint for this)

### Step 18: Get Token from Logs
After authentication, the backend logs will show:
- `💡 Token JSON (save to GOOGLE_DRIVE_TOKEN env var):`
- Followed by a JSON string

**Copy that entire JSON string**

### Step 19: Add Token to Backend Environment Variables
1. Go back to **backend project** → **Settings** → **Environment Variables**
2. Click **"Add New"**
3. **Key:** `GOOGLE_DRIVE_TOKEN`
4. **Value:** Paste the JSON string you copied from logs
5. Select **"Production"**
6. Click **"Save"**

### Step 20: Redeploy Backend Again
1. Go to **Deployments** tab
2. Click **three dots** (⋯) on latest deployment
3. Click **"Redeploy"**
4. Wait for completion

---

## ✅ PART 5: Verify Everything Works

### Step 21: Test Frontend
1. Go to your frontend URL (from Vercel dashboard)
2. Open browser console (F12 → Console tab)
3. Look for: `🔧 API Configuration:`
4. Should show: `VITE_API_URL: "https://your-backend-url"`
5. Should NOT show: `localhost:5002`
6. The app should load data (not empty/0 data)

### Step 22: Test Backend Logs
1. Go to backend project → Deployments → Latest → Logs
2. Should see:
   - `✅ Google Drive API service initialized`
   - `✅ Loaded Google Drive token from environment variable`
   - `✅ Google Drive API authenticated successfully`
   - `📡 Loading data from Google Drive API...`
   - `✅ Data loaded successfully from Google Drive API`

### Step 23: If Something Doesn't Work
- **Frontend shows `localhost:5002`:** `VITE_API_URL` not set or frontend not redeployed
- **Backend returns empty data:** Check backend logs for authentication errors
- **Backend can't authenticate:** Verify `GOOGLE_DRIVE_CREDENTIALS` is correct
- **Token expired:** Token will auto-refresh, but if it fails, get new token (Step 17-19)

---

## 📝 Summary Checklist

After completing all steps, you should have:

**Backend Environment Variables (6 total):**
- [ ] `USE_GOOGLE_DRIVE_API=true`
- [ ] `GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation`
- [ ] `GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions`
- [ ] `GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders`
- [ ] `GOOGLE_DRIVE_CREDENTIALS` (JSON string)
- [ ] `GOOGLE_DRIVE_TOKEN` (JSON string - after first auth)

**Frontend Environment Variables (1 total):**
- [ ] `VITE_API_URL` (your backend URL)

**Deployments:**
- [ ] Backend redeployed after setting variables
- [ ] Frontend redeployed after setting variables
- [ ] Backend redeployed again after adding token (if needed)

---

## 🎉 Done!

If everything worked:
- Frontend should show data (not empty)
- Backend should connect to Google Drive
- Emails should load (if Gmail is configured)
- Everything should work on Vercel!

