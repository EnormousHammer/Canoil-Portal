# Complete Vercel Frontend Setup - Copy & Paste

## 🎯 What This Does
Configures your Vercel frontend to connect to your Render backend.

---

## 📋 Step 1: Open Vercel Dashboard

1. **Go to:** https://vercel.com
2. **Login** to your account
3. **Click:** "canoil-portal" project

---

## 📋 Step 2: Go to Environment Variables

1. **Click:** "Settings" tab (top navigation)
2. **Click:** "Environment Variables" (left sidebar)

---

## 📋 Step 3: Add VITE_API_URL

1. **Click:** "Add New" button
2. **Fill in:**
   ```
   Key: VITE_API_URL
   Value: https://canoil-portal-backend.onrender.com
   ```
   **Replace with YOUR actual Render backend URL!**
3. **Environment:** Select:
   - ✅ Production
   - ✅ Preview (optional)
   - ✅ Development (optional)
4. **Click:** "Save"

---

## 📋 Step 4: Verify Variable Added

You should see:
- ✅ `VITE_API_URL` = `https://your-backend-url.onrender.com`

---

## 📋 Step 5: Redeploy Frontend

1. **Click:** "Deployments" tab (top navigation)
2. **Find:** Latest deployment (top of list)
3. **Click:** Three dots (⋯) menu on the right
4. **Click:** "Redeploy"
5. **Click:** "Redeploy" again to confirm
6. **Wait:** For deployment to complete (2-5 minutes)

---

## 📋 Step 6: Verify It Works

1. **Open:** Your frontend URL (e.g., `https://canoil-portal.vercel.app`)
2. **Open:** Browser console (F12 → Console tab)
3. **Look for:**
   ```
   🔧 API Configuration: {
     VITE_API_URL: "https://your-backend.onrender.com",
     API_BASE_URL: "https://your-backend.onrender.com",
     isProduction: true
   }
   ```
4. **Should NOT see:** `localhost:5002`
5. **Check:** Data should load (not empty/0 data)

---

## ✅ Done!

If you see:
- ✅ Correct API URL in console
- ✅ No `localhost:5002`
- ✅ Data loads correctly

Then you're done! 🎉

---

## 🚨 If It Still Shows localhost:5002

**Problem:** `VITE_API_URL` not set or frontend not redeployed

**Fix:**
1. Go back to Settings → Environment Variables
2. Verify `VITE_API_URL` exists and is correct
3. Make sure it's set for "Production" environment
4. Redeploy frontend again
5. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

---

## 🚨 If Data Still Empty

**Problem:** Backend not accessible or not returning data

**Fix:**
1. Check backend URL is correct (try opening it in browser)
2. Check backend logs on Render for errors
3. Verify backend has Google Drive token configured
4. Check browser console for API errors (F12 → Network tab)

