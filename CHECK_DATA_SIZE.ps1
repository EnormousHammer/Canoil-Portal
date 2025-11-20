# ================================================================
# CHECK ACTUAL DATA SIZE
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CHECKING ACTUAL DATA SIZE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$gdriveBase = "G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"

# Check if G: Drive is accessible
if (-not (Test-Path $gdriveBase)) {
    Write-Host "❌ G: Drive not accessible: $gdriveBase" -ForegroundColor Red
    Write-Host ""
    Write-Host "Cannot check data size without G: Drive access." -ForegroundColor Yellow
    Write-Host "Estimating based on typical MiSys data..." -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "Typical sizes:" -ForegroundColor Cyan
    Write-Host "  Small business: 5-20MB uncompressed" -ForegroundColor White
    Write-Host "  Medium business: 20-50MB uncompressed" -ForegroundColor White
    Write-Host "  Large business: 50-200MB uncompressed" -ForegroundColor White
    Write-Host ""
    Write-Host "With GZIP compression (70-90% reduction):" -ForegroundColor Cyan
    Write-Host "  Small: 1-4MB compressed" -ForegroundColor Green
    Write-Host "  Medium: 4-10MB compressed" -ForegroundColor Green
    Write-Host "  Large: 10-40MB compressed" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# Get latest folder
Write-Host "Finding latest MiSys data folder..." -ForegroundColor Yellow
$folders = Get-ChildItem $gdriveBase -Directory | Sort-Object Name -Descending
if ($folders.Count -eq 0) {
    Write-Host "❌ No folders found in: $gdriveBase" -ForegroundColor Red
    exit 1
}

$latestFolder = $folders[0]
Write-Host "Latest folder: $($latestFolder.Name)" -ForegroundColor Green
Write-Host ""

# List all JSON files that backend loads
$filesToCheck = @(
    # Essential files
    'CustomAlert5.json', 'MIILOC.json',
    'SalesOrderHeaders.json', 'SalesOrderDetails.json',
    'ManufacturingOrderHeaders.json', 'ManufacturingOrderDetails.json',
    'BillsOfMaterial.json', 'BillOfMaterialDetails.json',
    'PurchaseOrders.json', 'PurchaseOrderDetails.json',
    
    # Other files
    'Items.json', 'MIITEM.json', 'MIBOMH.json', 'MIBOMD.json',
    'ManufacturingOrderRoutings.json', 'MIMOH.json', 'MIMOMD.json', 'MIMORD.json',
    'Jobs.json', 'JobDetails.json', 'MIJOBH.json', 'MIJOBD.json',
    'MIPOH.json', 'MIPOD.json', 'MIPOHX.json', 'MIPOC.json', 'MIPOCV.json',
    'MIPODC.json', 'MIWOH.json', 'MIWOD.json', 'MIBORD.json',
    'PurchaseOrderExtensions.json', 'WorkOrders.json', 'WorkOrderDetails.json',
    'PurchaseOrderAdditionalCosts.json', 'PurchaseOrderAdditionalCostsTaxes.json',
    'PurchaseOrderDetailAdditionalCosts.json'
)

Write-Host "Checking file sizes..." -ForegroundColor Yellow
Write-Host ""

$totalSize = 0
$fileCount = 0
$largestFiles = @()

foreach ($fileName in $filesToCheck) {
    $filePath = Join-Path $latestFolder.FullName $fileName
    if (Test-Path $filePath) {
        $file = Get-Item $filePath
        $sizeMB = [math]::Round($file.Length / 1MB, 2)
        $totalSize += $file.Length
        $fileCount++
        
        $largestFiles += [PSCustomObject]@{
            Name = $fileName
            SizeMB = $sizeMB
        }
        
        if ($sizeMB > 1) {
            Write-Host "  $fileName : ${sizeMB}MB" -ForegroundColor Cyan
        }
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "SUMMARY:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "Total files found: $fileCount" -ForegroundColor Cyan
Write-Host "Total size (uncompressed): ${totalSizeMB}MB" -ForegroundColor $(if($totalSizeMB -gt 32){"Red"}else{"Green"})
Write-Host ""

# Show largest files
Write-Host "Top 10 largest files:" -ForegroundColor Yellow
$largestFiles | Sort-Object SizeMB -Descending | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.Name): $($_.SizeMB)MB" -ForegroundColor White
}
Write-Host ""

# Calculate compressed size estimate
$compressedMin = [math]::Round($totalSizeMB * 0.1, 2)  # 90% compression (best case)
$compressedAvg = [math]::Round($totalSizeMB * 0.2, 2)  # 80% compression (typical)
$compressedMax = [math]::Round($totalSizeMB * 0.3, 2)  # 70% compression (worst case)

Write-Host "Estimated compressed size (with GZIP):" -ForegroundColor Yellow
Write-Host "  Best case (90% compression): ${compressedMin}MB" -ForegroundColor $(if($compressedMin -lt 32){"Green"}else{"Red"})
Write-Host "  Typical (80% compression): ${compressedAvg}MB" -ForegroundColor $(if($compressedAvg -lt 32){"Green"}else{"Red"})
Write-Host "  Worst case (70% compression): ${compressedMax}MB" -ForegroundColor $(if($compressedMax -lt 32){"Green"}else{"Red"})
Write-Host ""

# Analysis
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "ANALYSIS:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

if ($totalSizeMB -gt 32) {
    Write-Host "⚠️  Uncompressed size (${totalSizeMB}MB) exceeds Cloud Run limit (32MB)" -ForegroundColor Yellow
    Write-Host ""
    
    if ($compressedAvg -lt 32) {
        Write-Host "✅ SOLUTION: GZIP compression will FIX this!" -ForegroundColor Green
        Write-Host ""
        Write-Host "With compression, response will be ~${compressedAvg}MB" -ForegroundColor Green
        Write-Host "This fits within Cloud Run's 32MB limit!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Action: Deploy with Flask-Compress" -ForegroundColor Cyan
        Write-Host "  .\DEPLOY_FIX_CLOUD_RUN.ps1" -ForegroundColor White
    } else {
        Write-Host "❌ WARNING: Even compressed (~${compressedAvg}MB) might exceed 32MB!" -ForegroundColor Red
        Write-Host ""
        Write-Host "You have 3 options:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "OPTION 1: Pagination (Best)" -ForegroundColor Cyan
        Write-Host "  Load data in chunks (10MB per request)" -ForegroundColor White
        Write-Host "  Requires frontend changes" -ForegroundColor White
        Write-Host ""
        Write-Host "OPTION 2: Filter Data (Quick)" -ForegroundColor Cyan
        Write-Host "  Only load recent data (last 3 months)" -ForegroundColor White
        Write-Host "  Backend filters before sending" -ForegroundColor White
        Write-Host ""
        Write-Host "OPTION 3: Cloud Storage (Enterprise)" -ForegroundColor Cyan
        Write-Host "  Store data in Cloud Storage bucket" -ForegroundColor White
        Write-Host "  Frontend downloads directly" -ForegroundColor White
        Write-Host "  Bypasses 32MB limit completely" -ForegroundColor White
    }
} else {
    Write-Host "✅ Data size (${totalSizeMB}MB) is within Cloud Run limit!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Compressed size will be ~${compressedAvg}MB" -ForegroundColor Green
    Write-Host "This should work fine with GZIP compression." -ForegroundColor Green
    Write-Host ""
    Write-Host "Action: Deploy with Flask-Compress" -ForegroundColor Cyan
    Write-Host "  .\DEPLOY_FIX_CLOUD_RUN.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "CLOUD RUN LIMITS:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "Current limits:" -ForegroundColor Cyan
Write-Host "  HTTP Response: 32MB (HARD LIMIT - cannot increase)" -ForegroundColor White
Write-Host "  Request timeout: 300s (5 min) - configurable up to 3600s (1 hour)" -ForegroundColor White
Write-Host "  Memory: 2GB (can increase to 32GB)" -ForegroundColor White
Write-Host "  CPU: 2 vCPU (can increase to 8 vCPU)" -ForegroundColor White
Write-Host ""
Write-Host "❗ IMPORTANT: 32MB response limit CANNOT be increased!" -ForegroundColor Red
Write-Host "   This is a Google Cloud Run platform limitation." -ForegroundColor Yellow
Write-Host ""

Write-Host "================================================================" -ForegroundColor Cyan

