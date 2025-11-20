# ================================================================
# SIMPLE CLOUD RUN CHECK
# ================================================================

Write-Host ""
Write-Host "Checking Cloud Run Backend..." -ForegroundColor Cyan
Write-Host ""

$projectId = "dulcet-order-474521-q1"
$region = "us-central1"
$serviceName = "canoil-backend"

# Get service URL
Write-Host "Getting service URL..." -ForegroundColor Yellow
$serviceUrl = gcloud run services describe $serviceName --region=$region --project=$projectId --format="value(status.url)" 2>$null

if (-not $serviceUrl) {
    Write-Host "ERROR: Service not found!" -ForegroundColor Red
    Write-Host "Deploy first: .\DEPLOY_TO_CLOUD_RUN.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Service URL: $serviceUrl" -ForegroundColor Green
Write-Host ""

# Test health endpoint
Write-Host "Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$serviceUrl/api/health" -TimeoutSec 10
    
    Write-Host "Status: $($health.status)" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Google Drive API:" -ForegroundColor Cyan
    Write-Host "  Enabled: $($health.google_drive_api_enabled)" -ForegroundColor $(if($health.google_drive_api_enabled){"Green"}else{"Red"})
    Write-Host "  Authenticated: $($health.google_drive_authenticated)" -ForegroundColor $(if($health.google_drive_authenticated){"Green"}else{"Red"})
    Write-Host ""
    
    if (-not $health.google_drive_authenticated) {
        Write-Host "PROBLEM FOUND: Google Drive NOT authenticated!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Solution:" -ForegroundColor Yellow
        Write-Host "1. Check Secret Manager: https://console.cloud.google.com/security/secret-manager?project=$projectId" -ForegroundColor White
        Write-Host "2. Verify 'google-drive-credentials' secret exists" -ForegroundColor White
        Write-Host "3. Redeploy: .\DEPLOY_TO_CLOUD_RUN.ps1" -ForegroundColor White
    } else {
        Write-Host "Testing data endpoint (this may take 2-3 minutes)..." -ForegroundColor Yellow
        try {
            $data = Invoke-RestMethod -Uri "$serviceUrl/api/data" -TimeoutSec 300
            Write-Host "SUCCESS: Data loaded!" -ForegroundColor Green
            Write-Host "Files loaded: $(($data.data.PSObject.Properties).Count)" -ForegroundColor Cyan
        } catch {
            Write-Host "ERROR loading data: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "ERROR: Cannot reach backend!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Backend URL for Vercel:" -ForegroundColor Cyan
Write-Host $serviceUrl -ForegroundColor Yellow
Write-Host ""

