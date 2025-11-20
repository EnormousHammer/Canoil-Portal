# ================================================================
# DIAGNOSE GOOGLE CLOUD RUN BACKEND ISSUES
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSING CLOUD RUN BACKEND" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$projectId = "dulcet-order-474521-q1"
$region = "us-central1"
$serviceName = "canoil-backend"

# ================================================================
# STEP 1: CHECK IF SERVICE EXISTS AND IS RUNNING
# ================================================================
Write-Host ""
Write-Host "[STEP 1/6] Checking if Cloud Run service exists..." -ForegroundColor Yellow
Write-Host ""

try {
    $serviceInfo = gcloud run services describe $serviceName `
        --region=$region `
        --project=$projectId `
        --format=json 2>&1 | ConvertFrom-Json
    
    $serviceUrl = $serviceInfo.status.url
    Write-Host "✅ Service exists!" -ForegroundColor Green
    Write-Host "   URL: $serviceUrl" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ Service not found or error getting service info!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Run deployment first: .\DEPLOY_TO_CLOUD_RUN.ps1"
    Read-Host "Press Enter to exit"
    exit 1
}

# ================================================================
# STEP 2: CHECK SERVICE HEALTH ENDPOINT
# ================================================================
Write-Host ""
Write-Host "[STEP 2/6] Checking backend health endpoint..." -ForegroundColor Yellow
Write-Host ""

$healthUrl = "$serviceUrl/api/health"
Write-Host "Testing: $healthUrl" -ForegroundColor Cyan

try {
    $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30
    Write-Host "✅ Backend is responding!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Health Status:" -ForegroundColor Cyan
    Write-Host ($healthResponse | ConvertTo-Json -Depth 3)
    Write-Host ""
    
    # Check Google Drive status
    if ($healthResponse.google_drive_api_enabled) {
        if ($healthResponse.google_drive_authenticated) {
            Write-Host "✅ Google Drive API: AUTHENTICATED" -ForegroundColor Green
        } else {
            Write-Host "❌ Google Drive API: NOT AUTHENTICATED" -ForegroundColor Red
            Write-Host "   This is likely the problem!" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Google Drive API: DISABLED" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Backend health check FAILED!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "The backend is not responding. Check logs in next step."
}

Write-Host ""
Read-Host "Press Enter to continue"

# ================================================================
# STEP 3: CHECK RECENT LOGS
# ================================================================
Write-Host ""
Write-Host "[STEP 3/6] Fetching recent logs..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Recent logs (last 50 lines):" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$serviceName" `
    --limit=50 `
    --project=$projectId `
    --format='table(timestamp,severity,textPayload)' `
    --order=desc

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Look for specific errors in logs
Write-Host "Searching for authentication errors..." -ForegroundColor Yellow
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$serviceName AND (textPayload=~'authentication' OR textPayload=~'AUTH' OR textPayload=~'credential')" `
    --limit=10 `
    --project=$projectId `
    --format='table(timestamp,textPayload)' `
    --order=desc

Write-Host ""
Read-Host "Press Enter to continue"

# ================================================================
# STEP 4: CHECK ENVIRONMENT VARIABLES
# ================================================================
Write-Host ""
Write-Host "[STEP 4/6] Checking environment variables..." -ForegroundColor Yellow
Write-Host ""

$envVars = gcloud run services describe $serviceName `
    --region=$region `
    --project=$projectId `
    --format="value(spec.template.spec.containers[0].env)"

Write-Host "Environment Variables:" -ForegroundColor Cyan
Write-Host $envVars
Write-Host ""

# ================================================================
# STEP 5: CHECK SECRETS
# ================================================================
Write-Host ""
Write-Host "[STEP 5/6] Checking secrets configuration..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Checking if secret 'google-drive-credentials' exists..." -ForegroundColor Cyan

try {
    $secretInfo = gcloud secrets describe google-drive-credentials `
        --project=$projectId `
        --format=json 2>&1 | ConvertFrom-Json
    
    Write-Host "✅ Secret exists!" -ForegroundColor Green
    Write-Host "   Created: $($secretInfo.createTime)" -ForegroundColor Cyan
    
    # Check if service has access to secret
    $secretBindings = gcloud run services describe $serviceName `
        --region=$region `
        --project=$projectId `
        --format="value(spec.template.spec.containers[0].env)" 2>&1
    
    if ($secretBindings -match "google-drive-credentials") {
        Write-Host "✅ Secret is mounted to service" -ForegroundColor Green
    } else {
        Write-Host "❌ Secret is NOT mounted to service!" -ForegroundColor Red
        Write-Host "   Redeploy with: .\DEPLOY_TO_CLOUD_RUN.ps1"
    }
    
} catch {
    Write-Host "❌ Secret 'google-drive-credentials' NOT FOUND!" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to create the secret first:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Go to Google Cloud Console > Secret Manager" -ForegroundColor Cyan
    Write-Host "2. Create secret named: google-drive-credentials" -ForegroundColor Cyan
    Write-Host "3. Upload your service account JSON file" -ForegroundColor Cyan
    Write-Host "4. Redeploy: .\DEPLOY_TO_CLOUD_RUN.ps1" -ForegroundColor Cyan
}

Write-Host ""
Read-Host "Press Enter to continue"

# ================================================================
# STEP 6: TEST /api/data ENDPOINT
# ================================================================
Write-Host ""
Write-Host "[STEP 6/6] Testing /api/data endpoint..." -ForegroundColor Yellow
Write-Host ""

$dataUrl = "$serviceUrl/api/data"
Write-Host "Testing: $dataUrl" -ForegroundColor Cyan
Write-Host "⚠️  This may take 2-4 minutes if loading from Google Drive..." -ForegroundColor Yellow
Write-Host ""

try {
    $startTime = Get-Date
    Write-Host "Starting request at: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Gray
    
    $dataResponse = Invoke-RestMethod -Uri $dataUrl -Method Get -TimeoutSec 300
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "✅ Data loaded successfully!" -ForegroundColor Green
    Write-Host "   Duration: $([math]::Round($duration, 2)) seconds" -ForegroundColor Cyan
    Write-Host ""
    
    # Check data structure
    if ($dataResponse.data) {
        $fileCount = ($dataResponse.data | Get-Member -MemberType NoteProperty).Count
        Write-Host "   Files loaded: $fileCount" -ForegroundColor Cyan
        
        # Show some file names
        $files = $dataResponse.data | Get-Member -MemberType NoteProperty | Select-Object -First 5 -ExpandProperty Name
        Write-Host "   Sample files:" -ForegroundColor Cyan
        foreach ($file in $files) {
            Write-Host "      - $file" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "✅ CLOUD RUN BACKEND IS WORKING!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to load data!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    
    if ($_.Exception.Message -match "timeout") {
        Write-Host "The request timed out. This could mean:" -ForegroundColor Yellow
        Write-Host "  - Google Drive API is not authenticated" -ForegroundColor Yellow
        Write-Host "  - Backend is trying to scan too much data" -ForegroundColor Yellow
        Write-Host "  - Network issues between Cloud Run and Google Drive" -ForegroundColor Yellow
    }
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSIS COMPLETE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps based on results:" -ForegroundColor Yellow
Write-Host ""
Write-Host "If Google Drive NOT authenticated:" -ForegroundColor Cyan
Write-Host "  1. Check Secret Manager has 'google-drive-credentials'" -ForegroundColor White
Write-Host "  2. Verify service account JSON is valid" -ForegroundColor White
Write-Host "  3. Ensure service account has Shared Drive access" -ForegroundColor White
Write-Host "  4. Redeploy: .\DEPLOY_TO_CLOUD_RUN.ps1" -ForegroundColor White
Write-Host ""
Write-Host "If data loading times out:" -ForegroundColor Cyan
Write-Host "  1. Check backend logs for errors" -ForegroundColor White
Write-Host "  2. Verify service account has access to IT_Automation drive" -ForegroundColor White
Write-Host "  3. Check Sales_CSR shared drive permissions" -ForegroundColor White
Write-Host ""
Write-Host "If everything works here but not in frontend:" -ForegroundColor Cyan
Write-Host "  1. Update VITE_API_URL in Vercel to: $serviceUrl" -ForegroundColor White
Write-Host "  2. Rebuild and deploy frontend" -ForegroundColor White
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"

