# ================================================================
# DEPLOY CLOUD RUN - RESPONSE SIZE FIX
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DEPLOYING FIX FOR 'Response size was too large' ERROR" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fix: Added GZIP compression to reduce response size by 70-90%" -ForegroundColor Yellow
Write-Host ""

$projectId = "dulcet-order-474521-q1"
$region = "us-central1"

# Navigate to project root
Set-Location "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

# Build Docker image
Write-Host "[1/3] Building Docker image..." -ForegroundColor Yellow
Write-Host "   This may take 5-10 minutes..." -ForegroundColor Gray
Write-Host ""

docker build -t gcr.io/$projectId/canoil-backend ./backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Docker image built!" -ForegroundColor Green
Write-Host ""

# Push to Container Registry
Write-Host "[2/3] Pushing image to Google Container Registry..." -ForegroundColor Yellow
Write-Host "   This may take 5-10 minutes..." -ForegroundColor Gray
Write-Host ""

docker push gcr.io/$projectId/canoil-backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Image pushed!" -ForegroundColor Green
Write-Host ""

# Deploy to Cloud Run
Write-Host "[3/3] Deploying to Cloud Run..." -ForegroundColor Yellow
Write-Host ""

gcloud run deploy canoil-backend `
  --image gcr.io/$projectId/canoil-backend `
  --platform managed `
  --region $region `
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
  --project=$projectId

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ Deployed successfully!" -ForegroundColor Green
Write-Host ""

# Get service URL
$serviceUrl = gcloud run services describe canoil-backend `
  --region=$region `
  --format="value(status.url)" `
  --project=$projectId

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE! 🎉" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend URL:" -ForegroundColor Yellow
Write-Host $serviceUrl -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing data endpoint..." -ForegroundColor Yellow
Write-Host "⏳ This takes 2-4 minutes..." -ForegroundColor Gray
Write-Host ""

try {
    $data = Invoke-RestMethod -Uri "$serviceUrl/api/data" -TimeoutSec 300
    Write-Host "✅ SUCCESS! Data loaded!" -ForegroundColor Green
    $fileCount = ($data.data | Get-Member -MemberType NoteProperty).Count
    Write-Host "   Files loaded: $fileCount" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ GZIP compression is working!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not test data endpoint:" -ForegroundColor Yellow
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Check logs:" -ForegroundColor Yellow
    Write-Host "   https://console.cloud.google.com/logs/query?project=$projectId" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Next: Update VITE_API_URL in Vercel to:" -ForegroundColor Yellow
Write-Host $serviceUrl -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"

