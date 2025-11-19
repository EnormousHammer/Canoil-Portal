# Deploy Canoil Backend to Google Cloud Run

## Why Cloud Run?

- **No ngrok PC needed** - Runs in Google's cloud
- **Auto-scaling** - Handles traffic spikes automatically
- **99.95% uptime** - Much more reliable than a PC
- **FREE tier** - Likely covers your usage
- **HTTPS built-in** - No ngrok needed
- **Google Drive API** - Direct access to your G: drive data

---

## Prerequisites

1. **Google Cloud Account** (with billing enabled)
   - Go to: https://console.cloud.google.com
   - Enable billing (free tier available)

2. **Google Cloud CLI installed on your local computer**
   - Download: https://cloud.google.com/sdk/docs/install
   - Run installer
   - Restart terminal after install

3. **Docker installed** (for building container)
   - Download: https://www.docker.com/products/docker-desktop
   - Install and start Docker Desktop

---

## Step-by-Step Setup

### 1. Install & Setup Google Cloud CLI

```cmd
REM Download from: https://cloud.google.com/sdk/docs/install
REM After install, run:

gcloud init

REM Follow prompts:
REM - Login to your Google account
REM - Select or create a project (e.g., "canoil-portal")
REM - Select default region (us-central1 recommended)
```

---

### 2. Enable Required APIs

```cmd
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable drive.googleapis.com
```

---

### 3. Setup Google Drive API Credentials

**A. Create Service Account:**
```cmd
gcloud iam service-accounts create canoil-backend \
    --display-name="Canoil Backend Service"
```

**B. Go to Google Cloud Console:**
- https://console.cloud.google.com/iam-admin/serviceaccounts
- Find "canoil-backend" service account
- Click ⋮ → "Manage Keys"
- Click "Add Key" → "Create New Key" → JSON
- Download the JSON file (save as `service-account-key.json`)

**C. Share G: Drive with Service Account:**
- Open Google Drive (web)
- Right-click "IT_Automation" shared drive → Share
- Add the service account email (e.g., `canoil-backend@PROJECT_ID.iam.gserviceaccount.com`)
- Give "Viewer" or "Editor" access
- Repeat for "Sales_CSR" shared drive

---

### 4. Prepare Backend for Cloud Run

**Update `backend/Dockerfile`:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV USE_GOOGLE_DRIVE_API=true

# Run the application
CMD exec python app.py
```

**Create `.dockerignore`:**
```
venv/
__pycache__/
*.pyc
*.pyo
*.pyd
.git/
.env
cache/
uploads/
*.bat
*.md
node_modules/
```

---

### 5. Build and Deploy

**A. Authenticate Docker with Google Cloud:**
```cmd
gcloud auth configure-docker
```

**B. Build Container:**
```cmd
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

docker build -t gcr.io/YOUR_PROJECT_ID/canoil-backend ./backend
```

**C. Push to Google Container Registry:**
```cmd
docker push gcr.io/YOUR_PROJECT_ID/canoil-backend
```

**D. Deploy to Cloud Run:**
```cmd
gcloud run deploy canoil-backend \
  --image gcr.io/YOUR_PROJECT_ID/canoil-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "OPENAI_API_KEY=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" \
  --set-env-vars "USE_GOOGLE_DRIVE_API=true" \
  --set-env-vars "GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation" \
  --set-env-vars "GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions" \
  --set-env-vars "GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders" \
  --set-env-vars "FLASK_ENV=production"
```

**E. Add Service Account Key as Secret:**
```cmd
REM Create secret with service account key
gcloud secrets create google-drive-credentials \
  --data-file=service-account-key.json

REM Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding google-drive-credentials \
  --member=serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

REM Update Cloud Run to use secret
gcloud run services update canoil-backend \
  --update-secrets=GOOGLE_DRIVE_CREDENTIALS=google-drive-credentials:latest \
  --region us-central1
```

---

### 6. Update Vercel Frontend

**Set environment variable in Vercel:**
```
VITE_API_URL=https://canoil-backend-XXXXXXXXXX-uc.a.run.app
```

(Get URL from Cloud Run deployment output)

---

## Pricing Estimate

### **Free Tier (Monthly):**
- 2 million requests
- 360,000 vCPU-seconds
- 180,000 GiB-seconds of memory

### **Your Estimated Usage:**
- ~10,000 requests/month (light usage)
- Backend running ~1-2 hours/day actual compute
- **Cost: $0/month (under free tier!)**

### **If You Exceed Free Tier:**
- CPU: $0.00002400/vCPU-second
- Memory: $0.00000250/GiB-second
- Requests: $0.40/million

**Estimated max: $5-10/month** for moderate usage

---

## Advantages Over ngrok:

✅ **No physical PC needed** - Saves electricity, maintenance
✅ **Auto-scales** - Handles load spikes
✅ **99.95% uptime** - More reliable than PC
✅ **HTTPS built-in** - No ngrok domain needed
✅ **Automatic deployments** - Push code, auto-deploy
✅ **Logs & monitoring** - Built-in error tracking
✅ **Cold start** - Spins down when not used (saves money)

---

## Disadvantages:

⚠️ **Cold starts** - First request after idle takes 5-10 seconds
⚠️ **Google Drive API** - Must use API (not local G: drive)
⚠️ **Request timeout** - Max 5 minutes per request
⚠️ **Setup complexity** - Initial setup takes 1-2 hours

---

## Quick Deployment Script

I can create a `DEPLOY_TO_CLOUD_RUN.bat` that does all this automatically.

Want me to create it?

---

## Recommendation

**For your operation:**
- **Stay with ngrok PC** if it's already working and you have the PC
- **Switch to Cloud Run** if:
  - PC keeps crashing
  - Want better reliability
  - Want to eliminate physical hardware
  - Free tier covers your usage

**Verdict:** Cloud Run is **easier long-term** but requires **1-2 hour initial setup**. ngrok PC is working now, so maybe stick with it unless you have problems.

