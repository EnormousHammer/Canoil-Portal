# ================================================================
# QUICK CLOUD RUN DIAGNOSTIC
# ================================================================

$projectId = "dulcet-order-474521-q1"
$region = "us-central1"
$serviceName = "canoil-backend"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CLOUD RUN QUICK CHECK" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get URL
Write-Host "[1/4] Getting Cloud Run URL..." -ForegroundColor Yellow
$url = gcloud run services describe $serviceName --region=$region --project=$projectId --format="value(status.url)" 2>$null

if (-not $url) {
    Write-Host ""
    Write-Host "❌ SERVICE NOT DEPLOYED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Deploy first:" -ForegroundColor Yellow
    Write-Host "  .\DEPLOY_TO_CLOUD_RUN.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Or view in console:" -ForegroundColor Yellow
    Write-Host "  https://console.cloud.google.com/run?project=$projectId" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✅ Service deployed" -ForegroundColor Green
Write-Host "   URL: $url" -ForegroundColor Cyan
Write-Host ""

# Step 2: Test Health
Write-Host "[2/4] Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Backend responding" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ BACKEND NOT RESPONDING!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Check logs:" -ForegroundColor Yellow
    Write-Host "  https://console.cloud.google.com/logs/query?project=$projectId" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Step 3: Check Google Drive Auth
Write-Host "[3/4] Checking Google Drive authentication..." -ForegroundColor Yellow

if ($health.google_drive_api_enabled) {
    Write-Host "   Google Drive API: ENABLED" -ForegroundColor Green
    
    if ($health.google_drive_authenticated) {
        Write-Host "   Authentication: ✅ SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "   Authentication: ❌ FAILED" -ForegroundColor Red
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
        Write-Host "PROBLEM: Google Drive not authenticated!" -ForegroundColor Red
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Fix this by creating the secret:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Step 1: Check if secret exists:" -ForegroundColor Cyan
        Write-Host "  https://console.cloud.google.com/security/secret-manager?project=$projectId" -ForegroundColor White
        Write-Host ""
        Write-Host "Step 2: If missing, create secret 'google-drive-credentials':" -ForegroundColor Cyan
        Write-Host "  Upload: backend\google_service_account.json" -ForegroundColor White
        Write-Host ""
        Write-Host "Step 3: Redeploy Cloud Run:" -ForegroundColor Cyan
        Write-Host "  .\DEPLOY_TO_CLOUD_RUN.ps1" -ForegroundColor White
        Write-Host ""
        Write-Host "Full guide: CLOUD_RUN_FIX_GUIDE.md" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "   Google Drive API: DISABLED" -ForegroundColor Red
    Write-Host ""
    Write-Host "This shouldn't happen - check deployment script!" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""

# Step 4: Test Data Loading
Write-Host "[4/4] Testing data loading..." -ForegroundColor Yellow
Write-Host "   ⏳ This takes 2-4 minutes on first load..." -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
try {
    $data = Invoke-RestMethod -Uri "$url/api/data" -TimeoutSec 300 -ErrorAction Stop
    $endTime = Get-Date
    $duration = [math]::Round(($endTime - $startTime).TotalSeconds, 1)
    
    Write-Host "✅ Data loaded successfully!" -ForegroundColor Green
    Write-Host "   Duration: $duration seconds" -ForegroundColor Cyan
    
    if ($data.data) {
        $fileCount = ($data.data | Get-Member -MemberType NoteProperty).Count
        Write-Host "   Files loaded: $fileCount" -ForegroundColor Cyan
    }
    Write-Host ""
    
} catch {
    Write-Host "❌ Data loading FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Check logs:" -ForegroundColor Yellow
    Write-Host "  https://console.cloud.google.com/logs/query?project=$projectId" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Success!
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ EVERYTHING WORKING!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Backend URL: $url" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next step: Update frontend to use this URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to Vercel dashboard:" -ForegroundColor Cyan
Write-Host "   https://vercel.com/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "2. Open your project settings → Environment Variables" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Set VITE_API_URL to:" -ForegroundColor Cyan
Write-Host "   $url" -ForegroundColor White
Write-Host ""
Write-Host "4. Redeploy frontend:" -ForegroundColor Cyan
Write-Host "   cd frontend" -ForegroundColor White
Write-Host "   vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan

