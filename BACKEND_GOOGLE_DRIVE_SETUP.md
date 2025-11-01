# Backend & Google Drive Setup Guide

## Architecture Overview

The Canoil Portal works like this:

```
Frontend (React/Vite) → Backend (Flask) → Google Drive
                         ↓
                   Processes Data
                         ↓
                   Returns to Frontend
```

**The backend is CRITICAL** - it handles ALL Google Drive access and data processing.

## Setup Options

### Option 1: Local G: Drive Mount (Current)

**How it works:**
- Backend reads directly from local G: Drive mount
- Path: `G:\Shared drives\IT_Automation\...`
- No authentication needed
- Requires Google Drive File Stream installed locally

**Requirements:**
- Google Drive File Stream installed
- G: Drive mounted locally
- Backend running on `localhost:5002`

**Start backend:**
```bash
cd backend
python app.py
```

---

### Option 2: Google Drive API (New - Recommended for Cloud)

**How it works:**
- Backend connects directly to Google Drive via API
- No local mount needed
- Works from anywhere (cloud, remote servers)
- Access to specific shared drive

**Setup Steps:**

1. **Enable Google Drive API**:
   - Set environment variable: `USE_GOOGLE_DRIVE_API=true`
   - Or set in `.env` file

2. **Get OAuth Credentials**:
   - Go to Google Cloud Console
   - Create OAuth 2.0 credentials
   - Download as `backend/google_drive_credentials.json`

3. **First-Time Authentication**:
   - Start backend: `python backend/app.py`
   - Browser opens for Google authentication
   - Grant permissions to access Google Drive
   - Token saved to `backend/google_drive_token.pickle`

4. **Configure Shared Drive**:
   - Edit `backend/google_drive_service.py`:
     - `SHARED_DRIVE_NAME = "IT_Automation"`
     - `BASE_FOLDER_PATH = "MiSys/Misys Extracted Data/API Extractions"`
     - `SALES_ORDERS_PATH = "Sales_CSR/Customer Orders/Sales Orders"`

**Start backend:**
```bash
cd backend
USE_GOOGLE_DRIVE_API=true python app.py
```

---

## Backend Routes

The backend provides these critical routes:

- `/api/data` - Main data endpoint (all JSON files from Google Drive)
- `/api/mps` - MPS production data
- `/api/sales-orders/*` - Sales order endpoints
- `/api/logistics/*` - Logistics automation
- `/api/email/*` - Email assistant
- `/api/pr/*` - Purchase requisitions
- `/api/chat` - AI chat

**All frontend requests go through these backend routes.**

---

## Deployment Architecture

### Local Development:
```
Frontend: http://localhost:5173 (or Vite port)
Backend:  http://localhost:5002
Google Drive: Local G: mount OR API
```

### Production/Vercel:
```
Frontend: Deployed on Vercel
Backend:  Deployed separately (Railway, Render, Heroku, etc.)
          → Needs to be accessible via HTTPS
Google Drive: Via API (recommended)
```

**Frontend Environment Variable:**
- `VITE_API_URL=https://your-backend-url.com`
- Or set in Vercel dashboard under Environment Variables

**Backend Environment Variable:**
- `USE_GOOGLE_DRIVE_API=true`
- `GOOGLE_DRIVE_CREDENTIALS_PATH=/path/to/credentials.json`

---

## Current Error: Backend Not Running

If you see `ERR_CONNECTION_REFUSED` on `localhost:5002`:

**Solution:**
1. Start the backend server:
   ```bash
   cd backend
   python app.py
   ```

2. Backend should show:
   ```
   ✅ Running on http://localhost:5002
   ```

3. Frontend will automatically connect once backend is running

---

## Google Drive API Benefits

✅ **No local mount required**  
✅ **Works from cloud/deployed backend**  
✅ **Always gets latest data**  
✅ **Access specific shared drives**  
✅ **Automatic authentication**  
✅ **Multi-user support**

---

## Next Steps

1. **For Local Development:**
   - Keep using local G: Drive mount
   - Just start backend: `python backend/app.py`

2. **For Cloud/Production:**
   - Set up Google Drive API (see `GOOGLE_DRIVE_API_SETUP.md`)
   - Deploy backend to Railway/Render/Heroku
   - Set `VITE_API_URL` in Vercel to point to deployed backend

3. **Current Issue:**
   - Backend needs to be running
   - Either locally or deployed somewhere accessible

