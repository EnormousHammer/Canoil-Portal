# Deploy Everything on One Platform (Render)

## Render - Deploy Frontend AND Backend Together ✅

**Render** lets you deploy BOTH your frontend and backend in ONE project!

### Quick Setup:

1. **Sign up at [Render.com](https://render.com)** (free tier available)

2. **Create New Blueprint** (or use "New Web Service" for each)

3. **Connect GitHub Repository**

4. **Render will read `render.yaml` automatically** OR:

   **Option A: Use Blueprint (Recommended)**
   - New → Blueprint
   - Connect repo
   - Render reads `render.yaml` → Deploys BOTH services automatically!
   - ✅ Frontend + Backend in ONE project

   **Option B: Manual Setup (Two Services)**
   - Create Backend Service:
     - Type: Web Service
     - Build: `pip install -r backend/requirements.txt`
     - Start: `cd backend && python app.py`
   
   - Create Frontend Service:
     - Type: Static Site
     - Build: `cd frontend && npm install && npm run build`
     - Publish: `frontend/dist`

5. **Set Environment Variables** (in Backend service):
   ```
   USE_GOOGLE_DRIVE_API=true
   GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation
   GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions
   GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders
   ```

6. **Frontend Auto-Connects to Backend:**
   - Render automatically provides internal URLs
   - Frontend gets backend URL via `VITE_API_URL`
   - Set in Frontend service environment variables:
     ```
     VITE_API_URL=https://your-backend-service.onrender.com
     ```

**That's it!** Everything runs on Render - one platform, one project! 🎉

---

## Alternative: Railway (Also One Platform)

Railway can also deploy both services in one project:

1. **Sign up at [Railway.app](https://railway.app)**

2. **New Project → Deploy from GitHub**

3. **Add Two Services:**
   - Service 1: Backend (Python)
     - Root Directory: `/backend`
     - Build: `pip install -r requirements.txt`
     - Start: `python app.py`
   
   - Service 2: Frontend (Node)
     - Root Directory: `/frontend`  
     - Build: `npm install && npm run build`
     - Start: `npm run preview` (or serve static files)

4. **Set Environment Variables** in Backend service

5. **Frontend gets Backend URL** via `VITE_API_URL`

**Both services in ONE Railway project!** ✅

---

## Why Render is Best for "One Roof":

✅ **One Dashboard** - See both frontend and backend  
✅ **One Project** - Everything together  
✅ **Auto-scaling** - Both services scale together  
✅ **One URL** - Frontend automatically knows backend URL  
✅ **Free Tier** - Both services on free tier  
✅ **Simple** - Just push to GitHub, Render deploys everything  

---

## After Deployment:

1. **Backend URL**: `https://canoil-portal-backend.onrender.com`
2. **Frontend URL**: `https://canoil-portal-frontend.onrender.com`
3. **Frontend uses Backend** - automatically configured!

**Everything under one roof!** 🏠

