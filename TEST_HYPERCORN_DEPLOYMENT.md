# Testing Hypercorn - Local & Deployment Guide

## ✅ Step 1: Local Testing (Current)

### Test Endpoints:
```bash
# Health check
curl http://localhost:5002/api/health

# Main data (should include Sales Orders now)
curl http://localhost:5002/api/data

# Check response size
curl -s http://localhost:5002/api/data | Measure-Object -Character
```

### Verify HTTP/2:
```bash
# Check if server is using HTTP/2
curl -I --http2 http://localhost:5002/api/health
```

Look for: `HTTP/2 200` in response

---

## ✅ Step 2: Test Response Size Locally

### Check if response exceeds 32MB:
```powershell
# Get response size
$response = Invoke-WebRequest -Uri "http://localhost:5002/api/data" -UseBasicParsing
$sizeMB = $response.RawContentLength / 1MB
Write-Host "Response size: $([math]::Round($sizeMB, 2)) MB"

if ($sizeMB -gt 32) {
    Write-Host "⚠️ WARNING: Response is $([math]::Round($sizeMB - 32, 2)) MB over 32MB limit!" -ForegroundColor Red
} else {
    Write-Host "✅ Response is under 32MB limit" -ForegroundColor Green
}
```

### Check compressed size (what Cloud Run sees):
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:5002/api/data" -Headers @{"Accept-Encoding"="gzip"} -UseBasicParsing
$compressedSizeMB = $response.RawContentLength / 1MB
Write-Host "Compressed size: $([math]::Round($compressedSizeMB, 2)) MB"
```

---

## ✅ Step 3: Deploy to Cloud Run

### Option A: Use Existing Deployment Script
```powershell
.\DEPLOY_TO_CLOUD_RUN.ps1
```

This will:
- Build Docker image with Hypercorn
- Push to Google Container Registry
- Deploy with `--use-http2` flag
- Enable HTTP/2 support

### Option B: Manual Deploy
```powershell
cd backend

# Build image
docker build -t gcr.io/dulcet-order-474521-q1/canoil-backend .

# Push to registry
docker push gcr.io/dulcet-order-474521-q1/canoil-backend

# Deploy with HTTP/2
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

---

## ✅ Step 4: Test on Cloud Run

### Get Service URL:
```powershell
$url = gcloud run services describe canoil-backend --region=us-central1 --format="value(status.url)" --project=dulcet-order-474521-q1
Write-Host "Service URL: $url"
```

### Test Endpoints:
```powershell
# Health check
Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing

# Main data
$response = Invoke-WebRequest -Uri "$url/api/data" -UseBasicParsing
$sizeMB = $response.RawContentLength / 1MB
Write-Host "Response size: $([math]::Round($sizeMB, 2)) MB"
```

### Verify HTTP/2:
```powershell
# Check response headers
$response = Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing
$response.Headers

# Look for HTTP/2 indicators
# If using HTTP/2, you should see different headers
```

### Test Large Response:
```powershell
# This should work now (no 32MB limit with HTTP/2)
$response = Invoke-WebRequest -Uri "$url/api/data" -UseBasicParsing

if ($response.StatusCode -eq 200) {
    Write-Host "✅ SUCCESS: Large response accepted!" -ForegroundColor Green
    Write-Host "Response size: $([math]::Round($response.RawContentLength / 1MB, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: Response rejected" -ForegroundColor Red
}
```

---

## ✅ Step 5: Verify HTTP/2 is Working

### Check Cloud Run Logs:
```powershell
gcloud run services logs read canoil-backend --region=us-central1 --project=dulcet-order-474521-q1 --limit=50
```

Look for:
- `✅ HTTP/2 enabled - 32MB response limit removed`
- `🚀 Starting Hypercorn with HTTP/2 support`

### Test with curl (if available):
```bash
curl -I --http2 https://your-service-url/api/health
```

Should show: `HTTP/2 200`

---

## ✅ Step 6: Test Vercel (If Using)

Vercel uses a different setup (serverless functions), so Hypercorn won't work there. But you can:

1. **Point Vercel frontend to Cloud Run backend:**
   - Set `VITE_API_URL` in Vercel to your Cloud Run URL
   - Frontend will call Cloud Run (which has HTTP/2)

2. **Or test Vercel backend separately:**
   - Vercel backend uses different architecture
   - May still have 32MB limit (Vercel has different limits)
   - Test separately if needed

---

## 🎯 Success Criteria

### ✅ Local Test Passes:
- [ ] Server starts without errors
- [ ] `/api/health` returns 200
- [ ] `/api/data` returns data with Sales Orders
- [ ] Response size is reasonable

### ✅ Cloud Run Deploy Passes:
- [ ] Deployment succeeds
- [ ] Service starts without errors
- [ ] `/api/health` returns 200
- [ ] `/api/data` returns data
- [ ] **NO "Response size too large" errors**
- [ ] HTTP/2 is enabled (check logs)

### ✅ Large Response Test:
- [ ] Response >32MB is accepted (if needed)
- [ ] No timeout errors
- [ ] Data loads correctly

---

## 🔍 Troubleshooting

### If you get "Response size too large":
1. Check if HTTP/2 is actually enabled:
   ```powershell
   gcloud run services describe canoil-backend --region=us-central1 --format="yaml(spec.template.spec.containers[0].env)" --project=dulcet-order-474521-q1
   ```

2. Check Cloud Run logs for Hypercorn startup:
   ```powershell
   gcloud run services logs read canoil-backend --region=us-central1 --limit=100 | Select-String "Hypercorn|HTTP/2"
   ```

3. Verify Dockerfile is using `start_hypercorn.py`:
   ```dockerfile
   CMD ["python", "start_hypercorn.py"]
   ```

### If Sales Orders are empty:
1. Check if folders exist:
   ```powershell
   Test-Path "G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\In Production"
   Test-Path "G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\New and Revised"
   ```

2. Check logs for scanning messages:
   - Look for "Scanning In Production..."
   - Look for "Found X orders in..."

---

## 📝 Next Steps After Testing

1. **If local test passes** → Deploy to Cloud Run
2. **If Cloud Run passes** → Update Vercel frontend to use Cloud Run URL
3. **If size is still an issue** → Consider pagination or further optimization

