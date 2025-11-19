# Vercel Environment Variables - Copy & Paste

## ✅ Credentials Found!

I found your Google Drive credentials. Here's what to set in Vercel:

---

## 🔧 BACKEND Environment Variables (If backend is on Vercel)

Go to: **Vercel Dashboard** → **Backend Project** → **Settings** → **Environment Variables**

Copy these one by one:

### 1. Enable Google Drive API
```
USE_GOOGLE_DRIVE_API=true
```

### 2. Shared Drive Name
```
GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation
```

### 3. Base Folder Path
```
GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions
```

### 4. Sales Orders Path
```
GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders
```

### 5. OAuth Credentials (Copy from vercel_credentials.txt)
```
GOOGLE_DRIVE_CREDENTIALS={"installed": {"client_id": "711358371169-r7tcm0q20mgr6a4l036psq6n5lobe71j.apps.googleusercontent.com", "project_id": "dulcet-order-474521-q1", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "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", "redirect_uris": ["http://localhost"]}}
```

**OR** copy the full value from `vercel_credentials.txt` file (it's already saved there)

### 6. Token (You need to authenticate first)

**Option A: If you've authenticated before**
- Run: `python get_vercel_env_vars.py` again after authenticating
- Copy the token from `vercel_token.txt`

**Option B: First-time authentication**
1. Deploy backend with `GOOGLE_DRIVE_CREDENTIALS` set
2. Check backend logs for authentication URL
3. Visit URL and authenticate
4. Backend will print token JSON - copy it
5. Set as `GOOGLE_DRIVE_TOKEN` environment variable
6. Redeploy

---

## 🎨 FRONTEND Environment Variables

Go to: **Vercel Dashboard** → **Frontend Project** → **Settings** → **Environment Variables**

### 1. Backend URL
```
VITE_API_URL=https://your-backend-url.vercel.app
```

**Replace with your actual backend URL:**
- If backend is on Vercel: `https://your-backend-project.vercel.app`
- If backend is on Render: `https://your-backend-project.onrender.com`

---

## 📋 Quick Checklist

After setting variables:

- [ ] Backend: `USE_GOOGLE_DRIVE_API=true` ✅
- [ ] Backend: `GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation` ✅
- [ ] Backend: `GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions` ✅
- [ ] Backend: `GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders` ✅
- [ ] Backend: `GOOGLE_DRIVE_CREDENTIALS` (from vercel_credentials.txt) ✅
- [ ] Backend: `GOOGLE_DRIVE_TOKEN` (need to authenticate first) ⚠️
- [ ] Frontend: `VITE_API_URL` (your backend URL) ⚠️
- [ ] Redeploy Backend ✅
- [ ] Redeploy Frontend ✅

---

## 🚀 After Setting Variables

1. **Redeploy Backend**: Go to Deployments → Click "Redeploy"
2. **Redeploy Frontend**: Go to Deployments → Click "Redeploy"

**Important:** Environment variables only take effect after redeployment!

---

## ❓ Don't Have Token Yet?

If you don't have `GOOGLE_DRIVE_TOKEN` yet:

1. Set all other variables
2. Deploy backend
3. Backend will try to authenticate and print instructions
4. Follow the authentication flow
5. Copy the token JSON from backend logs
6. Set `GOOGLE_DRIVE_TOKEN` environment variable
7. Redeploy

The token will auto-refresh once set, so you only need to do this once!

