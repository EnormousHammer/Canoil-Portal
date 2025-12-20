# CANOIL PORTAL DEPLOYMENT INFO

## CRITICAL: Architecture Setup

**Frontend (Vercel):** https://canoil-portal.vercel.app
- Hosts the React frontend
- Routes all `/api/*` requests to Cloud Run backend

**Backend (Cloud Run):** https://canoil-backend-711358371169.us-central1.run.app
- Flask backend with all API endpoints
- **THIS IS THE BACKEND TO DEPLOY TO** (not canoil-portal!)

## Deployment Commands

### Deploy Backend (when making backend changes):
```bash
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"
git add . && git commit -m "your message" && git push origin main
gcloud run deploy canoil-backend --source . --region us-central1 --allow-unauthenticated --memory 2Gi --timeout 300
```

### Deploy Frontend (when making frontend changes):
```bash
# Vercel auto-deploys from GitHub on push to main
git push origin main
```

## Vercel Configuration (vercel.json)
```json
{
  "routes": [
    { "src": "/api/(.*)", "dest": "https://canoil-backend-711358371169.us-central1.run.app/api/$1" }
  ]
}
```

## Key Files
- Backend: `backend/` folder
- Frontend: `frontend/src/` folder
- SO Parser: `backend/raw_so_extractor.py` (GPT-4o based - use this for parsing)
- Logistics API: `backend/logistics_automation.py`

## REMEMBER
- **ALWAYS deploy to `canoil-backend`** for backend changes
- Vercel frontend connects to Cloud Run `canoil-backend`
- The `canoil-portal` Cloud Run service is NOT used by Vercel

