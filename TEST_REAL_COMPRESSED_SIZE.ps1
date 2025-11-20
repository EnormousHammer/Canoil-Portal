# ================================================================
# TEST REAL COMPRESSED SIZE (What Cloud Run Actually Sees)
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TESTING REAL COMPRESSED SIZE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$backendUrl = "http://localhost:5002"

Write-Host "Testing /api/data endpoint..." -ForegroundColor Yellow
Write-Host ""

# Use curl to see the REAL compressed size (before decompression)
# This is what Cloud Run actually sends over the network
$curlPath = "curl.exe"  # Windows 10+ has curl built-in

Write-Host "Downloading with GZIP compression (what Cloud Run sends)..." -ForegroundColor Gray
Write-Host ""

# Create temp file to save compressed response
$tempFile = [System.IO.Path]::GetTempFileName()

try {
    # Download with compression, save to file
    $output = & $curlPath -s -w "%{size_download}" -H "Accept-Encoding: gzip" -o $tempFile "$backendUrl/api/data"
    
    $compressedSizeBytes = [int]$output
    $compressedSizeMB = [math]::Round($compressedSizeBytes / 1MB, 2)
    
    Write-Host "✅ Real Compressed Size (over the wire):" -ForegroundColor Green
    Write-Host "   $compressedSizeMB MB" -ForegroundColor Cyan
    Write-Host ""
    
    # Now get uncompressed size
    Write-Host "Downloading without compression (uncompressed)..." -ForegroundColor Gray
    $uncompOutput = & $curlPath -s -w "%{size_download}" --compressed -o $tempFile "$backendUrl/api/data"
    
    $uncompressedSizeBytes = [int]$uncompOutput
    $uncompressedSizeMB = [math]::Round($uncompressedSizeBytes / 1MB, 2)
    
    Write-Host "📊 Uncompressed Size:" -ForegroundColor Yellow
    Write-Host "   $uncompressedSizeMB MB" -ForegroundColor Cyan
    Write-Host ""
    
    # Calculate compression ratio
    $compressionRatio = [math]::Round((1 - ($compressedSizeBytes / $uncompressedSizeBytes)) * 100, 1)
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "RESULTS:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Uncompressed:  $uncompressedSizeMB MB" -ForegroundColor White
    Write-Host "Compressed:    $compressedSizeMB MB" -ForegroundColor $(if($compressedSizeMB -lt 32){"Green"}else{"Red"})
    Write-Host "Compression:   $compressionRatio%" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Cloud Run Limit: 32 MB" -ForegroundColor Yellow
    Write-Host ""
    
    if ($compressedSizeMB -lt 32) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "✅ SUCCESS: WILL WORK ON CLOUD RUN!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host ""
        Write-Host "Compressed size ($compressedSizeMB MB) fits within 32MB limit!" -ForegroundColor Green
        Write-Host "Headroom: $([math]::Round(32 - $compressedSizeMB, 2)) MB" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "✅ Ready to deploy to Cloud Run:" -ForegroundColor Yellow
        Write-Host "   .\DEPLOY_FIX_CLOUD_RUN.ps1" -ForegroundColor White
    } else {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
        Write-Host "❌ STILL TOO LARGE!" -ForegroundColor Red
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
        Write-Host ""
        Write-Host "Compressed size ($compressedSizeMB MB) exceeds 32MB limit" -ForegroundColor Red
        Write-Host "Over by: $([math]::Round($compressedSizeMB - 32, 2)) MB" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Need to further reduce data size." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Error testing with curl:" -ForegroundColor Red
    Write-Host $_.Exception.Message
} finally {
    # Clean up temp file
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan

