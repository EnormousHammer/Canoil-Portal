# ================================================================
# DEPLOY CANOIL BACKEND TO GOOGLE CLOUD RUN (NON-INTERACTIVE)
# Project ID: dulcet-order-474521-q1
# Uses service account for PERMANENT auth - no expiration!
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CANOIL BACKEND - CLOUD RUN DEPLOYMENT (AUTO)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
Set-Location "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

# ================================================================
# AUTHENTICATE WITH SERVICE ACCOUNT (NEVER EXPIRES!)
# ================================================================
Write-Host "[AUTH] Activating service account..." -ForegroundColor Yellow
$keyFile = "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\deploy-key.json"
if (Test-Path $keyFile) {
    gcloud auth activate-service-account --key-file=$keyFile --quiet
    gcloud auth configure-docker gcr.io --quiet 2>$null
    Write-Host "✅ Service account authenticated!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Service account key not found, using current auth..." -ForegroundColor Yellow
}
Write-Host ""

# ================================================================
# STEP 1: BUILD DOCKER IMAGE
# ================================================================
Write-Host "[STEP 1/3] Building Docker image..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes..." -ForegroundColor Cyan
Write-Host ""

docker build -t gcr.io/dulcet-order-474521-q1/canoil-backend -f Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker image built successfully!" -ForegroundColor Green
Write-Host ""

# ================================================================
# STEP 2: PUSH IMAGE TO GOOGLE CONTAINER REGISTRY
# ================================================================
Write-Host "[STEP 2/3] Pushing image to Google Container Registry..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes..." -ForegroundColor Cyan
Write-Host ""

docker push gcr.io/dulcet-order-474521-q1/canoil-backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Image pushed successfully!" -ForegroundColor Green
Write-Host ""

# ================================================================
# STEP 3: DEPLOY TO CLOUD RUN
# ================================================================
Write-Host "[STEP 3/3] Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host ""

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
  --set-env-vars "OPENAI_API_KEY=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" `
  --set-env-vars "USE_GOOGLE_DRIVE_API=true" `
  --set-env-vars "GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation" `
  --set-env-vars "GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions" `
  --set-env-vars "GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders" `
  --set-env-vars "FLASK_ENV=production" `
  --update-secrets="GOOGLE_DRIVE_SA_JSON=google-drive-credentials:latest" `
  --project=dulcet-order-474521-q1 `
  --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cloud Run deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deployed to Cloud Run successfully!" -ForegroundColor Green
Write-Host ""

# ================================================================
# GET SERVICE URL
# ================================================================
Write-Host "Getting service URL..." -ForegroundColor Yellow
Write-Host ""

$serviceUrl = gcloud run services describe canoil-backend `
  --region=us-central1 `
  --format="value(status.url)" `
  --project=dulcet-order-474521-q1

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE! 🎉" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URL: $serviceUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "All changes have been deployed to Cloud Run!" -ForegroundColor Green
Write-Host ""







