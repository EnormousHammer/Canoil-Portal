# ================================================================
# DEPLOY CANOIL BACKEND TO GOOGLE CLOUD RUN
# Project ID: dulcet-order-474521-q1
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CANOIL BACKEND - CLOUD RUN DEPLOYMENT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project ID: dulcet-order-474521-q1"
Write-Host "Region: us-central1"
Write-Host ""

# Navigate to project root
Set-Location "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

# ================================================================
# STEP 1: VERIFY PREREQUISITES
# ================================================================
Write-Host ""
Write-Host "[STEP 1/7] Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check gcloud
try {
    $null = gcloud --version 2>&1
    Write-Host "✅ Google Cloud CLI installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Google Cloud CLI not found!" -ForegroundColor Red
    Write-Host "Please install from: https://cloud.google.com/sdk/docs/install"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Docker
try {
    $null = docker --version 2>&1
    Write-Host "✅ Docker installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker not found!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Docker is running
try {
    $null = docker ps 2>&1
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ All prerequisites met!" -ForegroundColor Green
Read-Host "Press Enter to continue"

# ================================================================
# STEP 2: ENABLE REQUIRED APIS
# ================================================================
Write-Host ""
Write-Host "[STEP 2/7] Enabling required Google Cloud APIs..." -ForegroundColor Yellow
Write-Host ""

gcloud services enable run.googleapis.com --project=dulcet-order-474521-q1
gcloud services enable containerregistry.googleapis.com --project=dulcet-order-474521-q1
gcloud services enable drive.googleapis.com --project=dulcet-order-474521-q1
gcloud services enable secretmanager.googleapis.com --project=dulcet-order-474521-q1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to enable APIs!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ All APIs enabled!" -ForegroundColor Green
Read-Host "Press Enter to continue"

# ================================================================
# STEP 3: AUTHENTICATE DOCKER
# ================================================================
Write-Host ""
Write-Host "[STEP 3/7] Authenticating Docker with Google Cloud..." -ForegroundColor Yellow
Write-Host ""

gcloud auth configure-docker --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker authentication failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ Docker authenticated!" -ForegroundColor Green
Read-Host "Press Enter to continue"

# ================================================================
# STEP 4: BUILD DOCKER IMAGE
# ================================================================
Write-Host ""
Write-Host "[STEP 4/7] Building Docker image..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This may take 5-10 minutes..." -ForegroundColor Cyan
Write-Host ""

docker build -t gcr.io/dulcet-order-474521-q1/canoil-backend ./backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ Docker image built successfully!" -ForegroundColor Green
Read-Host "Press Enter to continue"

# ================================================================
# STEP 5: PUSH IMAGE TO GOOGLE CONTAINER REGISTRY
# ================================================================
Write-Host ""
Write-Host "[STEP 5/7] Pushing image to Google Container Registry..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This may take 5-10 minutes..." -ForegroundColor Cyan
Write-Host ""

docker push gcr.io/dulcet-order-474521-q1/canoil-backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ Image pushed successfully!" -ForegroundColor Green
Read-Host "Press Enter to continue"

# ================================================================
# STEP 6: DEPLOY TO CLOUD RUN
# ================================================================
Write-Host ""
Write-Host "[STEP 6/7] Deploying to Cloud Run..." -ForegroundColor Yellow
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
  --project=dulcet-order-474521-q1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cloud Run deployment failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ Deployed to Cloud Run successfully!" -ForegroundColor Green
Read-Host "Press Enter to continue"

# ================================================================
# STEP 7: GET SERVICE URL
# ================================================================
Write-Host ""
Write-Host "[STEP 7/7] Getting service URL..." -ForegroundColor Yellow
Write-Host ""

$serviceUrl = gcloud run services describe canoil-backend `
  --region=us-central1 `
  --format="value(status.url)" `
  --project=dulcet-order-474521-q1

Write-Host ""
Write-Host $serviceUrl -ForegroundColor Cyan
Write-Host ""
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE! 🎉" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your backend is now running on Google Cloud Run!" -ForegroundColor Green
Write-Host ""
Write-Host "Copy the URL above and set it as VITE_API_URL in Vercel" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy the URL shown above"
Write-Host "2. Go to Vercel dashboard"
Write-Host "3. Update environment variable: VITE_API_URL=[paste URL]"
Write-Host "4. Redeploy your Vercel frontend"
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"

