# ============================================================
#  PR BOM Test - Create PR from BOM explosion
#  Tests: LZ 2C FULL-SYN BL 24X3.4, LZ 2T SEMI-SYN BL 6X946, LZ 2T SEMI-SYN BL 24X3.4
# ============================================================
#  Usage: .\test-pr-bom.ps1           # Local backend (localhost:5002)
#         .\test-pr-bom.ps1 -Cloud   # Cloud backend (Render)
# ============================================================

param([switch]$Cloud)
$ErrorActionPreference = "Stop"
$BackendUrl = if ($Cloud) { "https://canoil-portal-1.onrender.com" } else { "http://localhost:5002" }

$body = @{
    user_info = @{
        name = "PR Test"
        department = "Testing"
        justification = "Full Company Data test"
    }
    selected_items = @(
        @{ item_no = "LZ 2C FULL-SYN BL 24X3.4"; qty = 240 }
        @{ item_no = "LZ 2T SEMI-SYN BL 6X946"; qty = 320 }
        @{ item_no = "LZ 2T SEMI-SYN BL 24X3.4"; qty = 480 }
    )
    location = "62TODD"
} | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PR BOM Test" -ForegroundColor Cyan
Write-Host "  Backend: $BackendUrl" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Items:" -ForegroundColor Yellow
Write-Host "  LZ 2C FULL-SYN BL 24X3.4 x 240"
Write-Host "  LZ 2T SEMI-SYN BL 6X946 x 320"
Write-Host "  LZ 2T SEMI-SYN BL 24X3.4 x 480"
Write-Host ""

$outZip = Join-Path $PSScriptRoot "test-pr-output.zip"
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/api/pr/create-from-bom" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 120 `
        -OutFile $outZip
    Write-Host "OK: PR generated" -ForegroundColor Green
    Write-Host "Saved: $outZip" -ForegroundColor Cyan
    if (Test-Path $outZip) {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($outZip)
        Write-Host ""
        Write-Host "Contents:" -ForegroundColor Yellow
        $zip.Entries | ForEach-Object { Write-Host "  - $($_.Name)" }
        $zip.Dispose()
    }
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errBody = $reader.ReadToEnd()
        $reader.Dispose()
        if ($errBody) { Write-Host $errBody }
    }
    exit 1
}
