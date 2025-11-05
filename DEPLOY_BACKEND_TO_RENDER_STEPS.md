# Deploy Backend to Render - Step by Step

## 🎯 Goal
Deploy your Flask backend to Render so your Vercel frontend can connect to it.

---

## 📋 Step 1: Sign Up for Render

1. Go to https://render.com
2. Click **"Get Started for Free"** or **"Sign Up"**
3. Sign up with GitHub (easiest - connects to your repo automatically)
4. Confirm your email

---

## 📋 Step 2: Create Backend Service

1. Once logged in, click **"New +"** button (top right)
2. Click **"Web Service"**
3. Connect your GitHub repository:
   - Click **"Connect GitHub"** if not already connected
   - Select your repository: `EnormousHammer/Canoil-Portal`
   - Click **"Connect"**

---

## 📋 Step 3: Configure Backend Service

1. **Name:** `canoil-portal-backend` (or any name you want)
2. **Region:** Choose closest to you (e.g., `Oregon (US West)`)
3. **Branch:** `main`
4. **Root Directory:** Leave blank (it's at root)
5. **Runtime:** `Python 3`
6. **Build Command:** `pip install -r backend/requirements.txt`
7. **Start Command:** `cd backend && python app.py`
8. **Plan:** `Free` (for now, upgrade later if needed)

---

## 📋 Step 4: Set Environment Variables

**Before clicking "Create Web Service"**, scroll down to **"Environment Variables"** section:

Click **"Add Environment Variable"** for each of these:

1. **Key:** `USE_GOOGLE_DRIVE_API`
   **Value:** `true`

2. **Key:** `GOOGLE_DRIVE_SHARED_DRIVE_NAME`
   **Value:** `IT_Automation`

3. **Key:** `GOOGLE_DRIVE_BASE_FOLDER_PATH`
   **Value:** `MiSys/Misys Extracted Data/API Extractions`

4. **Key:** `GOOGLE_DRIVE_SALES_ORDERS_PATH`
   **Value:** `Sales_CSR/Customer Orders/Sales Orders`

5. **Key:** `GOOGLE_DRIVE_CREDENTIALS`
   **Value:** Copy the entire contents from `vercel_credentials.txt` file
   (It's the long JSON string)

6. **Key:** `PORT`
   **Value:** `10000`
   (Render sets this automatically, but good to set explicitly)

---

## 📋 Step 5: Create and Deploy

1. Scroll down and click **"Create Web Service"**
2. Render will start building and deploying
3. Wait for deployment to complete (5-10 minutes first time)
4. You'll see logs showing the build process

---

## 📋 Step 6: Get Backend URL

1. Once deployed, you'll see a green checkmark ✅
2. At the top of the page, you'll see your backend URL:
   - Example: `https://canoil-portal-backend.onrender.com`
3. **Copy this URL** - you'll need it for the frontend!

---

## 📋 Step 7: Get Google Drive Token (After First Deploy)

1. Go to your backend service on Render
2. Click **"Logs"** tab
3. Look for authentication messages
4. If you see: `⚠️ First-time authentication required`
   - The backend will print an auth URL
   - Copy it and open in browser
   - Sign in with Google
   - Grant permissions
   - Copy the token JSON from logs
5. Go back to **"Environment"** tab
6. Add new variable:
   - **Key:** `GOOGLE_DRIVE_TOKEN`
   - **Value:** Paste the token JSON you copied
7. Click **"Save Changes"** - Render will auto-redeploy

---

## 📋 Step 8: Update Vercel Frontend

Now go back to Vercel:

1. Go to your **"canoil-portal"** project on Vercel
2. **Settings** → **Environment Variables**
3. Add/Update:
   - **Key:** `VITE_API_URL`
   - **Value:** Your Render backend URL (from Step 6)
     - Example: `https://canoil-portal-backend.onrender.com`
4. Click **"Save"**
5. Go to **"Deployments"** tab
6. Click **three dots (⋯)** on latest deployment
7. Click **"Redeploy"**
8. Wait for deployment to complete

---

## ✅ Done!

After both are deployed:
- ✅ Backend on Render: `https://your-backend.onrender.com`
- ✅ Frontend on Vercel: `https://canoil-portal.vercel.app`
- ✅ Frontend connects to backend via `VITE_API_URL`
- ✅ Backend connects to Google Drive API
- ✅ Data loads correctly!

---

## 🚨 Troubleshooting

**Backend won't start?**
- Check logs for errors
- Make sure Python version is correct
- Check if all dependencies installed

**Backend can't connect to Google Drive?**
- Verify `GOOGLE_DRIVE_CREDENTIALS` is set correctly
- Get token (Step 7) and set `GOOGLE_DRIVE_TOKEN`
- Check logs for authentication errors

**Frontend still shows "0 data"?**
- Verify `VITE_API_URL` is set correctly in Vercel
- Make sure frontend was redeployed after setting variable
- Check browser console for API errors

---

## 📝 Quick Checklist

- [ ] Signed up for Render
- [ ] Created Web Service
- [ ] Set all 6 environment variables
- [ ] Backend deployed successfully
- [ ] Got backend URL
- [ ] Got Google Drive token (after first auth)
- [ ] Set `GOOGLE_DRIVE_TOKEN` in Render
- [ ] Set `VITE_API_URL` in Vercel
- [ ] Redeployed frontend on Vercel
- [ ] Everything works! ✅

