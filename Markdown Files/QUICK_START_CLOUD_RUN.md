# Quick Start: Deploy to Google Cloud Run

**Project ID:** `dulcet-order-474521-q1`

---

## ✅ What I've Already Done

- ✅ Installed Google Cloud CLI
- ✅ Ran `gcloud init`
- ✅ Set project to `dulcet-order-474521-q1`

---

## 📋 Next Steps (In Order)

### Step 1: Check Prerequisites
```cmd
CHECK_CLOUD_RUN_READY.bat
```

This will verify:
- Google Cloud CLI installed ✓
- Docker installed
- Docker running
- Authenticated
- All required files exist

**If anything fails, fix it before continuing!**

---

### Step 2: Install Docker Desktop (if needed)

1. Download from: https://www.docker.com/products/docker-desktop
2. Install and start Docker Desktop
3. Wait for Docker to fully start
4. Run `CHECK_CLOUD_RUN_READY.bat` again to verify

---

### Step 3: Setup Service Account for Google Drive

```cmd
SETUP_SERVICE_ACCOUNT.bat
```

This will:
1. Create service account: `canoil-backend`
2. Generate service account key: `service-account-key.json`
3. Upload key to Google Cloud Secret Manager

**⚠️ IMPORTANT MANUAL STEP:**

After running the script, you MUST share your Google Drives:

1. Go to https://drive.google.com
2. Find "IT_Automation" shared drive
   - Right-click → "Share"
   - Add: `canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com`
   - Permission: "Viewer" or "Editor"
   - Click "Send"
3. Find "Sales_CSR" shared drive
   - Right-click → "Share"
   - Add: `canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com`
   - Permission: "Viewer" or "Editor"
   - Click "Send"

---

### Step 4: Deploy to Cloud Run

```cmd
DEPLOY_TO_CLOUD_RUN.bat
```

This will:
1. ✅ Verify prerequisites
2. ✅ Enable required Google Cloud APIs
3. ✅ Authenticate Docker with Google Cloud
4. 🏗️ Build Docker image (~5-10 min)
5. 📤 Push image to Google Container Registry (~5-10 min)
6. 🚀 Deploy to Cloud Run (~2-3 min)
7. 🌐 Show your backend URL

**Total time: 15-20 minutes**

---

### Step 5: Update Vercel Frontend

After deployment completes:

1. Copy the URL shown (e.g., `https://canoil-backend-xxxx-uc.a.run.app`)
2. Go to Vercel Dashboard: https://vercel.com
3. Select your project
4. Go to Settings → Environment Variables
5. Update `VITE_API_URL` to the Cloud Run URL
6. Redeploy your frontend

---

## 🎯 Expected Results

After successful deployment:

- ✅ Backend running on Google Cloud Run
- ✅ Auto-scaling (1 to 10 instances)
- ✅ HTTPS enabled
- ✅ Google Drive API access
- ✅ 99.95% uptime
- ⚡ **Always instant - No cold starts** (min-instances=1)
- 💰 Cost: ~$30-50/month (always-on instance)

---

## 🔍 Troubleshooting

### Docker Build Fails
```cmd
# Check Docker is running
docker ps

# If not running, start Docker Desktop
```

### Authentication Fails
```cmd
# Re-authenticate
gcloud auth login

# Set project
gcloud config set project dulcet-order-474521-q1
```

### Google Drive Access Fails
```cmd
# Verify service account email
gcloud iam service-accounts list --project=dulcet-order-474521-q1

# Make sure you shared both drives with the service account!
```

### Deployment Fails
```cmd
# Check logs
gcloud run services logs read canoil-backend --region=us-central1 --project=dulcet-order-474521-q1

# Check service status
gcloud run services describe canoil-backend --region=us-central1 --project=dulcet-order-474521-q1
```

---

## 📊 Cost Estimate

### Configuration: min-instances=1 (Always Instant)

**Why:** You need instant access from anywhere, anytime - no cold starts allowed!

### Monthly Cost
- Always-on instance (2 GB RAM, 2 CPU): ~$30-50/month
- Auto-scales for traffic spikes
- **Worth it for:** Professional 24/7 instant access from any device worldwide

### Alternative: min-instances=0 (Free but 5-10 sec cold start)
- Would be $0/month on free tier
- BUT: Not acceptable for your use case (defeats the purpose of Vercel hosting)

---

## 🆚 Cloud Run vs ngrok PC

| Feature | Cloud Run (min-instances=1) | ngrok PC |
|---------|-----------|----------|
| **Instant Access** | ⚡ YES | ⚡ YES |
| **From Anywhere** | ✅ YES | ✅ YES (via ngrok) |
| Uptime | 99.95% | Depends on PC |
| Setup Time | 1-2 hours | 30 min |
| Monthly Cost | $30-50 | $10-20 (electricity) |
| Maintenance | None | PC must stay on |
| Scaling | Auto | Fixed |
| HTTPS | Built-in | Via ngrok |
| Cold Start | ❌ NONE | ❌ NONE |
| Reliability | 99.95% | If PC crashes, app down |

---

## 📝 Summary

1. ✅ `CHECK_CLOUD_RUN_READY.bat` - Verify everything
2. 🔐 `SETUP_SERVICE_ACCOUNT.bat` - Setup Google Drive access
3. 📤 Share Google Drives with service account (MANUAL!)
4. 🚀 `DEPLOY_TO_CLOUD_RUN.bat` - Deploy backend
5. 🌐 Update Vercel with new backend URL

---

## ❓ Questions?

- Check deployment logs in Google Cloud Console
- Visit: https://console.cloud.google.com/run?project=dulcet-order-474521-q1
- View logs, metrics, and service details

---

**Ready to deploy? Start with Step 1!** 🚀

