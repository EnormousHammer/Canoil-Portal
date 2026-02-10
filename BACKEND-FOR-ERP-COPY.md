# Backend for Canoil-Portal-ERP (the copy)

The **backend lives in the same repo** as the frontend (`backend/`). When you clone Canoil-Portal-ERP you get both. You have two ways to run the backend for the ERP copy.

---

## Option 1: Local development only (simplest)

Use the ERP clone and run the backend on your machine. No new cloud services.

1. **Clone and open the ERP repo** (if you haven’t):
   ```powershell
   cd "g:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper"
   git clone https://github.com/EnormousHammer/Canoil-Portal--ERP.git Canoil-Portal-ERP
   cd Canoil-Portal-ERP
   ```

2. **Run the backend** from the ERP folder:
   - Same way you run it for the original (e.g. `python backend/app.py`, or your existing `start_backend.bat` / Docker).
   - Backend usually runs on **port 5002** (or 5003 for MPS if you use that).

3. **Point the frontend at this backend:**
   - In `Canoil-Portal-ERP/frontend` create or use `.env.development.local` with:
     ```env
     VITE_API_URL=http://localhost:5002
     ```
   - Run the frontend from the ERP clone; it will use this backend.

4. **Env vars / secrets**  
   Copy what the original app uses: G: Drive path or Google Drive API (e.g. `GOOGLE_DRIVE_TOKEN` or service account), Gmail if needed, etc. Use the same `.env` or env files you use for the original backend, in the ERP clone.

Result: ERP app (frontend + backend) runs entirely on your PC; no separate backend deployment.

---

## Option 2: Separate production backend (Render + Vercel)

Use a **dedicated** backend and frontend for ERP so the original Canoil Portal and ERP can diverge safely.

### 2a. New backend on Render

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**.

2. **Connect repository:**  
   Select **Canoil-Portal-ERP** (or connect GitHub and choose `EnormousHammer/Canoil-Portal--ERP`).

3. **Settings:**
   - **Name:** e.g. `canoil-portal-erp-backend`
   - **Region:** same as now (e.g. Oregon).
   - **Branch:** `main`.
   - **Root directory:** leave blank (repo root has `backend/` and Dockerfile).
   - **Runtime:** Docker (use existing `Dockerfile` in repo).
   - **Instance type:** same as current (e.g. Free or paid).

4. **Environment variables**  
   Copy from your **current** Canoil Portal backend on Render (or from your local backend env):
   - `PYTHON_VERSION=3.11.0`
   - `USE_GOOGLE_DRIVE_API=true`
   - `GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation`
   - `GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions`
   - `GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders`
   - `FLASK_ENV=production`
   - **Secrets (same as original):** `GOOGLE_DRIVE_SA_JSON` or `GOOGLE_DRIVE_TOKEN`, `GMAIL_TOKEN` if you use Gmail, etc.

5. **Create service.**  
   Render will build and deploy. Copy the **backend URL**, e.g.  
   `https://canoil-portal-erp-backend.onrender.com` (your actual URL may differ).

### 2b. New frontend on Vercel (pointing at ERP backend)

1. Go to [Vercel](https://vercel.com) → **Add New** → **Project**.

2. **Import** the **Canoil-Portal-ERP** repo (same GitHub repo).

3. **Settings:**
   - **Framework:** Vite.
   - **Root directory:** `frontend` (if your Vite app is in `frontend/`).
   - **Build command / output:** leave default if it detects Vite.

4. **Environment variable:**
   - **Name:** `VITE_API_URL`
   - **Value:** your **ERP** Render backend URL from 2a, e.g.  
     `https://canoil-portal-erp-backend.onrender.com`  
   (No trailing slash.)

5. Deploy. The ERP frontend will call the ERP backend only.

### 2c. MPS / Production Schedule (optional)

If the Production Schedule uses a separate MPS backend URL, set in Vercel for the ERP project:

- **Name:** `VITE_MPS_BACKEND_URL`  
- **Value:**  
  - Same ERP Render backend URL if MPS is served from the same Flask app, or  
  - A separate MPS service URL if you run MPS separately.

---

## Summary

| Goal                         | What to do |
|-----------------------------|------------|
| **Develop ERP locally**     | Option 1: run backend from ERP clone, frontend with `VITE_API_URL=http://localhost:5002`. |
| **Deploy ERP (own backend)** | Option 2: new Render web service from Canoil-Portal-ERP repo + new Vercel project with `VITE_API_URL` = new Render URL. |
| **Keep original untouched** | Original repo stays as-is; original Render + Vercel keep using the original repo. |

The backend **code** is the same in both repos until you change it; the only difference is **which** backend instance (local vs Render) the ERP frontend talks to, and **which** env vars that instance uses.
