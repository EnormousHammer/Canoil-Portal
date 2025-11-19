# Google Cloud Run - Quick Start

## What You Get

✅ **No physical PC needed** - Backend runs in Google's cloud  
✅ **99.95% uptime** - More reliable than ngrok PC  
✅ **Auto-scaling** - Handles any traffic  
✅ **FREE or $5-10/month** - Free tier covers light usage  
✅ **HTTPS included** - No ngrok domain needed  

---

## ONE-CLICK DEPLOYMENT

**Just run:**
```
DEPLOY_TO_CLOUD_RUN_AUTO.bat
```

It will guide you through:
1. Installing Google Cloud CLI
2. Logging in to Google
3. Creating project
4. Building Docker container
5. Deploying to Cloud Run
6. Setting up Google Drive access

**Total time: 20-30 minutes**

---

## Prerequisites

### Before You Start:

1. **Google Account** (your work Gmail)
2. **Credit Card** (for Google Cloud - won't be charged if under free tier)
3. **Docker Desktop** installed
   - Download: https://www.docker.com/products/docker-desktop
   - Install and start it

---

## Manual Steps (Step-by-Step)

If you prefer manual control:

### 1. Install Google Cloud CLI
```
CLOUD_RUN_STEP_1_INSTALL.bat
```

### 2. Authenticate
```
CLOUD_RUN_STEP_2_AUTH.bat
```

### 3. Setup Project & Service Account
```
CLOUD_RUN_STEP_3_SETUP.bat
```
**Manual action:** Share G: drives with service account email

### 4. Build & Deploy
```
CLOUD_RUN_STEP_4_DEPLOY.bat
```

### 5. Add Google Drive Credentials
```
CLOUD_RUN_STEP_5_ADD_CREDENTIALS.bat
```

---

## After Deployment

### Your Backend URL:
```
https://canoil-backend-XXXXXXXXXX-uc.a.run.app
```

### Update Vercel:
1. Go to Vercel dashboard
2. Select canoil-portal project
3. Settings → Environment Variables
4. Update `VITE_API_URL` to your Cloud Run URL
5. Redeploy

---

## Cost Estimate

### Free Tier (per month):
- 2 million requests
- 360,000 vCPU-seconds  
- 180,000 GiB-seconds memory

### Your Usage:
- ~10,000-50,000 requests/month
- **Cost: $0/month** (well under free tier)

### If You Exceed:
- ~$5-10/month for moderate usage

**Much cheaper than running a PC 24/7!**

---

## vs ngrok PC

| Feature | ngrok PC | Cloud Run |
|---------|----------|-----------|
| **Setup** | Copy files, run bat | 30 min deployment |
| **Reliability** | PC can crash | 99.95% uptime |
| **Speed** | 50-200ms | 50-150ms |
| **Cost** | Electricity $5-10/mo | FREE to $10/mo |
| **Maintenance** | Must monitor PC | None |
| **Scaling** | Fixed capacity | Auto-scales |
| **HTTPS** | Via ngrok | Built-in |

---

## What Happens

### During Deployment:
1. Builds Docker container with your backend code
2. Pushes to Google Container Registry
3. Creates Cloud Run service
4. Sets up environment variables
5. Configures Google Drive API access
6. Gives you public HTTPS URL

### After Deployment:
- Backend runs in Google's cloud
- Accesses G: drive via API
- Vercel frontend connects to it
- Auto-scales based on traffic
- Spins down when idle (saves money)

---

## Files Created

✅ `backend/Dockerfile` - Container configuration  
✅ `backend/.dockerignore` - Excludes unnecessary files  
✅ `CLOUD_RUN_STEP_1_INSTALL.bat` - Install gcloud CLI  
✅ `CLOUD_RUN_STEP_2_AUTH.bat` - Authenticate  
✅ `CLOUD_RUN_STEP_3_SETUP.bat` - Setup project  
✅ `CLOUD_RUN_STEP_4_DEPLOY.bat` - Build & deploy  
✅ `CLOUD_RUN_STEP_5_ADD_CREDENTIALS.bat` - Add credentials  
✅ `DEPLOY_TO_CLOUD_RUN_AUTO.bat` - Automated deployment  
✅ `DEPLOY_TO_CLOUD_RUN.md` - Detailed guide  

---

## Recommendation

**Try Cloud Run if:**
- You want more reliability
- Don't want to maintain a PC
- Want automatic scaling
- Free tier covers you

**Stick with ngrok if:**
- It's working fine
- Don't want to spend 30 min on setup
- Prefer physical control

Both work equally well for your operation!

---

## Ready to Deploy?

```
DEPLOY_TO_CLOUD_RUN_AUTO.bat
```

Follow the prompts, and you'll have a production backend in 30 minutes! 🚀

