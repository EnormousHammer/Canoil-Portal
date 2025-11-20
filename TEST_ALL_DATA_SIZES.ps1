# ================================================================
# TEST ALL DATA SIZES - Local Backend Test
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TESTING ALL DATA SIZES (LOCAL BACKEND)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$backendUrl = "http://localhost:5002"

Write-Host "Testing local backend at: $backendUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: /api/data (MiSys only)
Write-Host "[1/3] Testing /api/data (MiSys data only)..." -ForegroundColor Yellow
Write-Host "   ⏳ This may take 30-60 seconds..." -ForegroundColor Gray
Write-Host ""

try {
    $startTime = Get-Date
    # CRITICAL: Send Accept-Encoding header to request compression!
    $headers = @{
        'Accept-Encoding' = 'gzip, deflate'
    }
    $response = Invoke-WebRequest -Uri "$backendUrl/api/data" -Headers $headers -TimeoutSec 120
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    # Get response size
    $contentLength = $response.RawContentLength
    $contentLengthMB = [math]::Round($contentLength / 1MB, 2)
    
    # Check if compressed
    $encoding = $response.Headers['Content-Encoding']
    $isCompressed = $encoding -eq 'gzip'
    
    Write-Host "✅ /api/data Response:" -ForegroundColor Green
    Write-Host "   Duration: $([math]::Round($duration, 1)) seconds" -ForegroundColor Cyan
    Write-Host "   Size: ${contentLengthMB}MB" -ForegroundColor $(if($contentLengthMB -lt 32){"Green"}else{"Red"})
    Write-Host "   Compressed: $isCompressed" -ForegroundColor $(if($isCompressed){"Green"}else{"Yellow"})
    if ($isCompressed) {
        $estimatedUncompressed = [math]::Round($contentLengthMB / 0.2, 2)
        Write-Host "   Est. uncompressed: ~${estimatedUncompressed}MB" -ForegroundColor Gray
    }
    Write-Host "   Status: $(if($contentLengthMB -lt 32){"✅ FITS IN 32MB LIMIT"}else{"❌ TOO LARGE"})" -ForegroundColor $(if($contentLengthMB -lt 32){"Green"}else{"Red"})
    
    $apiDataSize = $contentLengthMB
    $apiDataCompressed = $isCompressed
    
} catch {
    Write-Host "❌ /api/data FAILED!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Make sure backend is running:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   python app.py" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""

# Test 2: /api/sales-orders
Write-Host "[2/3] Testing /api/sales-orders..." -ForegroundColor Yellow
Write-Host "   ⏳ This may take 30-60 seconds..." -ForegroundColor Gray
Write-Host ""

try {
    $startTime = Get-Date
    # CRITICAL: Send Accept-Encoding header to request compression!
    $headers = @{
        'Accept-Encoding' = 'gzip, deflate'
    }
    $response = Invoke-WebRequest -Uri "$backendUrl/api/sales-orders" -Headers $headers -TimeoutSec 120
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    # Get response size
    $contentLength = $response.RawContentLength
    $contentLengthMB = [math]::Round($contentLength / 1MB, 2)
    
    # Check if compressed
    $encoding = $response.Headers['Content-Encoding']
    $isCompressed = $encoding -eq 'gzip'
    
    Write-Host "✅ /api/sales-orders Response:" -ForegroundColor Green
    Write-Host "   Duration: $([math]::Round($duration, 1)) seconds" -ForegroundColor Cyan
    Write-Host "   Size: ${contentLengthMB}MB" -ForegroundColor $(if($contentLengthMB -lt 32){"Green"}else{"Red"})
    Write-Host "   Compressed: $isCompressed" -ForegroundColor $(if($isCompressed){"Green"}else{"Yellow"})
    if ($isCompressed) {
        $estimatedUncompressed = [math]::Round($contentLengthMB / 0.2, 2)
        Write-Host "   Est. uncompressed: ~${estimatedUncompressed}MB" -ForegroundColor Gray
    }
    Write-Host "   Status: $(if($contentLengthMB -lt 32){"✅ FITS IN 32MB LIMIT"}else{"❌ TOO LARGE"})" -ForegroundColor $(if($contentLengthMB -lt 32){"Green"}else{"Red"})
    
    $soSize = $contentLengthMB
    $soCompressed = $isCompressed
    
} catch {
    Write-Host "⚠️  /api/sales-orders FAILED!" -ForegroundColor Yellow
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "   (Sales Orders may not be accessible)" -ForegroundColor Gray
    $soSize = 0
    $soCompressed = $false
}

Write-Host ""

# Test 3: Combined size
Write-Host "[3/3] Combined Analysis..." -ForegroundColor Yellow
Write-Host ""

$totalSize = $apiDataSize + $soSize

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "SUMMARY:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

Write-Host "Individual Endpoints:" -ForegroundColor Cyan
Write-Host "  /api/data:          ${apiDataSize}MB $(if($apiDataCompressed){"(compressed)"}else{"(uncompressed)"})" -ForegroundColor White
Write-Host "  /api/sales-orders:  ${soSize}MB $(if($soCompressed){"(compressed)"}else{"(uncompressed)"})" -ForegroundColor White
Write-Host "  ────────────────────────" -ForegroundColor Gray
Write-Host "  Total if combined:  ${totalSize}MB" -ForegroundColor $(if($totalSize -gt 32){"Red"}else{"Green"})
Write-Host ""

Write-Host "Cloud Run Limit:" -ForegroundColor Cyan
Write-Host "  32MB per response" -ForegroundColor White
Write-Host ""

# Verdict
if ($apiDataSize -lt 32 -and $soSize -lt 32) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ VERDICT: WILL WORK ON CLOUD RUN!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "Both endpoints fit within 32MB limit:" -ForegroundColor Green
    Write-Host "  ✅ /api/data: ${apiDataSize}MB < 32MB" -ForegroundColor Green
    Write-Host "  ✅ /api/sales-orders: ${soSize}MB < 32MB" -ForegroundColor Green
    Write-Host ""
    Write-Host "Margin:" -ForegroundColor Cyan
    Write-Host "  /api/data headroom: $([math]::Round(32 - $apiDataSize, 2))MB" -ForegroundColor White
    Write-Host "  /api/sales-orders headroom: $([math]::Round(32 - $soSize, 2))MB" -ForegroundColor White
    Write-Host ""
    Write-Host "✅ Safe to deploy to Cloud Run!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step:" -ForegroundColor Yellow
    Write-Host "  .\DEPLOY_FIX_CLOUD_RUN.ps1" -ForegroundColor White
    
} elseif ($apiDataSize -gt 32 -or $soSize -gt 32) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "❌ VERDICT: STILL TOO LARGE!" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host ""
    
    if ($apiDataSize -gt 32) {
        Write-Host "❌ /api/data: ${apiDataSize}MB > 32MB limit" -ForegroundColor Red
        Write-Host "   Over by: $([math]::Round($apiDataSize - 32, 2))MB" -ForegroundColor Yellow
        Write-Host ""
    }
    
    if ($soSize -gt 32) {
        Write-Host "❌ /api/sales-orders: ${soSize}MB > 32MB limit" -ForegroundColor Red
        Write-Host "   Over by: $([math]::Round($soSize - 32, 2))MB" -ForegroundColor Yellow
        Write-Host ""
    }
    
    Write-Host "Required fixes:" -ForegroundColor Yellow
    Write-Host ""
    
    if (-not $apiDataCompressed -or -not $soCompressed) {
        Write-Host "1. Enable GZIP compression (Flask-Compress)" -ForegroundColor Cyan
        Write-Host "   This should reduce size by 70-90%" -ForegroundColor White
        Write-Host ""
    }
    
    if ($soSize -gt 20) {
        Write-Host "2. Reduce Sales Orders scope:" -ForegroundColor Cyan
        Write-Host "   Only scan recent folders (last 3 months)" -ForegroundColor White
        Write-Host "   Or implement pagination" -ForegroundColor White
        Write-Host ""
    }
    
} else {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "⚠️  VERDICT: CHECK COMPRESSION!" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Sizes are close to limit. Make sure compression is enabled!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan

# Additional diagnostics
Write-Host ""
Write-Host "Compression Status:" -ForegroundColor Yellow
if ($apiDataCompressed) {
    Write-Host "  ✅ /api/data is using GZIP compression" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  /api/data is NOT compressed!" -ForegroundColor Red
    Write-Host "     Add Flask-Compress to backend/requirements.txt" -ForegroundColor Yellow
}

if ($soCompressed) {
    Write-Host "  ✅ /api/sales-orders is using GZIP compression" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  /api/sales-orders is NOT compressed!" -ForegroundColor Red
    Write-Host "     Flask-Compress will fix this automatically" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan

