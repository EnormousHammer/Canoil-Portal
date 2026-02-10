# Backend setup for Canoil-Portal-ERP (for Cursor / new chat)

**Use this when you open the Canoil-Portal-ERP repo in Cursor and need to set up or run the backend.**

---

## What this project is

- **Repo:** Canoil-Portal-ERP (clone of Canoil Portal). Frontend = Vite/React in `frontend/`. Backend = Flask/Python in `backend/`.
- **Goal:** Run the app locally for development. Backend talks to G: Drive or Google Drive API for data (same as original Canoil Portal).

---

## Backend setup (local development)

1. **Backend lives in** `backend/`. Run it from the **repo root** or from `backend/` (depending on how the app is normally started).
2. **How we run it:** Same as the original Canoil Portal — e.g. `python backend/app.py` or the project’s existing script (e.g. `start_backend.bat` / `launch-canoil.bat` if present). Backend listens on **port 5002** (or 5003 for MPS if used).
3. **Environment / secrets:** Backend needs the same env as the original:
   - G: Drive path **or** Google Drive API credentials (e.g. `GOOGLE_DRIVE_TOKEN` or `GOOGLE_DRIVE_SA_JSON`, plus paths like `GOOGLE_DRIVE_BASE_FOLDER_PATH`, `GOOGLE_DRIVE_SALES_ORDERS_PATH`).
   - Optional: Gmail token if using email features (`GMAIL_TOKEN`).
   - Use a `.env` in repo root or in `backend/`, or copy from the original Canoil Portal project — **no mock data; real credentials from the existing setup.**
4. **Dependencies:** From repo root or `backend/`:  
   `pip install -r backend/requirements.txt`  
   (or `pip install -r requirements.txt` if you’re already in `backend/`.)

---

## Frontend pointing at this backend

- In `frontend/`, create or edit `.env.development.local` with:
  ```env
  VITE_API_URL=http://localhost:5002
  ```
- Run frontend (e.g. `npm run dev` from `frontend/`). It will use this local backend.

---

## Do not

- Change port configuration or add new dependencies unless asked.
- Introduce mock data; use real G: Drive / Google Drive and existing env vars.
- Modify the original Canoil Portal repo; this is the ERP copy only.

---

**If something fails:** Check (1) Python version (e.g. 3.11), (2) `backend/requirements.txt` installed, (3) env vars set (G Drive or Google Drive API), (4) port 5002 free and backend actually listening.
