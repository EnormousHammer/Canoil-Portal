# Cloud Run Deployment Fix - Summary

## ❌ Problem: Container Failed to Start

**Error:**
```
The user-provided container failed to start and listen on the port defined 
provided by the PORT=8080 environment variable within the allocated timeout.
```

## ✅ Fixes Applied

### 1. **Port Mismatch Fixed** (Dockerfile)
- **Before:** `EXPOSE 10000`
- **After:** `EXPOSE 8080`
- **Why:** Cloud Run expects containers to listen on PORT=8080

### 2. **Better Error Handling** (start_hypercorn.py)
- Added try/except blocks around imports
- Clear error messages if imports fail
- Exits gracefully with error codes

### 3. **Improved Google Drive Initialization** (app.py)
- Better error handling for Google Drive service
- App continues to start even if Google Drive fails
- More detailed logging

## 🚀 How to Redeploy

### Option 1: Use Deployment Script
```powershell
.\DEPLOY_FIX_CLOUD_RUN.ps1
```

### Option 2: Manual Deployment
```powershell
# 1. Build Docker image
docker build -t gcr.io/dulcet-order-474521-q1/canoil-backend -f Dockerfile .

# 2. Push to registry
docker push gcr.io/dulcet-order-474521-q1/canoil-backend

# 3. Deploy to Cloud Run
gcloud run deploy canoil-backend `
  --image gcr.io/dulcet-order-474521-q1/canoil-backend `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --memory 2Gi `
  --cpu 2 `
  --timeout 300 `
  --min-instances 1 `
  --max-instances 10 `
  --use-http2 `
  --set-env-vars "USE_GOOGLE_DRIVE_API=true" `
  --set-env-vars "GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation" `
  --set-env-vars "GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions" `
  --set-env-vars "GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders" `
  --set-env-vars "FLASK_ENV=production" `
  --update-secrets="GOOGLE_DRIVE_SA_JSON=google-drive-credentials:latest" `
  --project=dulcet-order-474521-q1
```

## ✅ Verification After Deployment

### 1. Check Health Endpoint
```powershell
$url = "https://canoil-backend-711358371169.us-central1.run.app"
Invoke-WebRequest -Uri "$url/api/health"
```

**Expected:** `200 OK` with JSON response

### 2. Check Logs
```powershell
gcloud run services logs read canoil-backend `
  --region=us-central1 `
  --limit=50 `
  --project=dulcet-order-474521-q1
```

**Look for:**
- ✅ `🚀 Starting Hypercorn with HTTP/2 support on 0.0.0.0:8080`
- ✅ `✅ Flask app imported successfully`
- ✅ `✅ Google Drive API service initialized successfully` (if enabled)

### 3. Test Data Endpoint
```powershell
.\TEST_CLOUD_RUN_DATA.ps1
```

**Expected:** Data loaded from Google Drive API (not empty)

## 🔍 Troubleshooting

### If Container Still Fails to Start:

1. **Check Logs:**
   - Go to: https://console.cloud.google.com/logs/viewer?project=dulcet-order-474521-q1
   - Filter by: `resource.type="cloud_run_revision"`

2. **Common Issues:**
   - **Import Error:** Check if all dependencies are in `requirements.txt`
   - **Port Error:** Verify `EXPOSE 8080` in Dockerfile
   - **Timeout:** Increase `--timeout` value (max 3600s)

3. **Test Locally First:**
   ```powershell
   docker build -t test-backend -f Dockerfile .
   docker run -p 8080:8080 -e PORT=8080 test-backend
   ```

## 📝 Files Changed

1. **Dockerfile:**
   - Changed `EXPOSE 10000` → `EXPOSE 8080`

2. **backend/start_hypercorn.py:**
   - Added error handling for imports
   - Better error messages

3. **backend/app.py:**
   - Improved Google Drive initialization error handling
   - Better logging

## ✅ Expected Result

After successful deployment:
- ✅ Container starts and listens on port 8080
- ✅ Health endpoint responds
- ✅ Google Drive API fallback works
- ✅ Data endpoint returns data (not empty)

