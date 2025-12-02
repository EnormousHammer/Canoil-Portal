# ================================================================
# GET GOOGLE CLOUD RUN URL
# ================================================================

$projectId = "dulcet-order-474521-q1"
$region = "us-central1"
$serviceName = "canoil-backend"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  GETTING CLOUD RUN URL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    $serviceUrl = gcloud run services describe $serviceName `
        --region=$region `
        --project=$projectId `
        --format="value(status.url)" 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $serviceUrl) {
        Write-Host "✅ Cloud Run Service URL:" -ForegroundColor Green
        Write-Host ""
        Write-Host $serviceUrl -ForegroundColor Cyan
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "  UPDATE VERCEL.JSON" -ForegroundColor Yellow
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "If this URL is different from what's in vercel.json, update it:" -ForegroundColor Yellow
        Write-Host "  File: vercel.json" -ForegroundColor White
        Write-Host "  Line 7: Change the 'dest' URL to:" -ForegroundColor White
        Write-Host "    $serviceUrl/api/`$1" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Current vercel.json URL:" -ForegroundColor Yellow
        $currentUrl = (Get-Content vercel.json | Select-String -Pattern 'canoil-backend.*\.run\.app').Matches.Value
        if ($currentUrl) {
            Write-Host "  $currentUrl" -ForegroundColor White
        } else {
            Write-Host "  (Could not find current URL in vercel.json)" -ForegroundColor Red
        }
        Write-Host ""
    } else {
        Write-Host "❌ Could not get Cloud Run URL" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error output:" -ForegroundColor Yellow
        Write-Host $serviceUrl -ForegroundColor Red
        Write-Host ""
        Write-Host "Make sure:" -ForegroundColor Yellow
        Write-Host "1. Service is deployed: .\DEPLOY_TO_CLOUD_RUN.ps1" -ForegroundColor White
        Write-Host "2. You're authenticated: gcloud auth login" -ForegroundColor White
        Write-Host "3. Project is set: gcloud config set project $projectId" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Error getting Cloud Run URL:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to exit"

