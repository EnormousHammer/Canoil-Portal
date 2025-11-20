# ================================================================
# CHECK FULL DATA SIZE (MiSys + Sales Orders)
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CHECKING FULL DATA SIZE (MiSys + Sales Orders)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Part 1: MiSys Data
$gdriveBase = "G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"

if (Test-Path $gdriveBase) {
    Write-Host "[1/2] Checking MiSys data size..." -ForegroundColor Yellow
    
    $folders = Get-ChildItem $gdriveBase -Directory | Sort-Object Name -Descending
    if ($folders.Count -gt 0) {
        $latestFolder = $folders[0]
        Write-Host "   Latest folder: $($latestFolder.Name)" -ForegroundColor Gray
        
        $filesToCheck = @(
            'CustomAlert5.json', 'MIILOC.json',
            'SalesOrderHeaders.json', 'SalesOrderDetails.json',
            'ManufacturingOrderHeaders.json', 'ManufacturingOrderDetails.json',
            'BillsOfMaterial.json', 'BillOfMaterialDetails.json',
            'PurchaseOrders.json', 'PurchaseOrderDetails.json',
            'Items.json', 'MIITEM.json', 'MIBOMH.json', 'MIBOMD.json',
            'ManufacturingOrderRoutings.json', 'MIMOH.json', 'MIMOMD.json', 'MIMORD.json',
            'Jobs.json', 'JobDetails.json', 'MIJOBH.json', 'MIJOBD.json',
            'MIPOH.json', 'MIPOD.json', 'MIPOHX.json', 'MIPOC.json', 'MIPOCV.json',
            'MIPODC.json', 'MIWOH.json', 'MIWOD.json', 'MIBORD.json',
            'PurchaseOrderExtensions.json', 'WorkOrders.json', 'WorkOrderDetails.json',
            'PurchaseOrderAdditionalCosts.json', 'PurchaseOrderAdditionalCostsTaxes.json',
            'PurchaseOrderDetailAdditionalCosts.json'
        )
        
        $misysSize = 0
        foreach ($fileName in $filesToCheck) {
            $filePath = Join-Path $latestFolder.FullName $fileName
            if (Test-Path $filePath) {
                $file = Get-Item $filePath
                $misysSize += $file.Length
            }
        }
        
        $misysSizeMB = [math]::Round($misysSize / 1MB, 2)
        Write-Host "   MiSys JSON files: ${misysSizeMB}MB" -ForegroundColor Green
    } else {
        Write-Host "   No MiSys folders found" -ForegroundColor Red
        $misysSizeMB = 0
    }
} else {
    Write-Host "[1/2] MiSys G: Drive not accessible" -ForegroundColor Red
    $misysSizeMB = 0
}

Write-Host ""

# Part 2: Sales Orders Metadata
$salesOrdersBase = "G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"

if (Test-Path $salesOrdersBase) {
    Write-Host "[2/2] Scanning Sales Orders metadata..." -ForegroundColor Yellow
    Write-Host "   (Counting PDF/DOCX files for metadata size estimate)" -ForegroundColor Gray
    
    # Count all PDF/DOCX files recursively
    $salesOrderFiles = Get-ChildItem -Path $salesOrdersBase -Recurse -Include *.pdf,*.docx,*.doc -File -ErrorAction SilentlyContinue
    $fileCount = $salesOrderFiles.Count
    
    # Estimate metadata size per file
    # Each file has metadata: order number, customer, dates, file path, etc. (~500-1000 bytes per file)
    $avgMetadataPerFile = 750  # bytes
    $totalMetadataSize = $fileCount * $avgMetadataPerFile
    $metadataSizeMB = [math]::Round($totalMetadataSize / 1MB, 2)
    
    Write-Host "   Sales Order files found: $fileCount" -ForegroundColor Cyan
    Write-Host "   Estimated metadata size: ${metadataSizeMB}MB" -ForegroundColor Green
    Write-Host "   (Average $avgMetadataPerFile bytes per file)" -ForegroundColor Gray
} else {
    Write-Host "[2/2] Sales Orders G: Drive not accessible" -ForegroundColor Red
    Write-Host "   Path: $salesOrdersBase" -ForegroundColor Gray
    $metadataSizeMB = 0
    $fileCount = 0
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "TOTAL SIZE ESTIMATE:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

$totalSizeMB = $misysSizeMB + $metadataSizeMB
Write-Host "MiSys data:            ${misysSizeMB}MB" -ForegroundColor Cyan
Write-Host "Sales Orders metadata: ${metadataSizeMB}MB" -ForegroundColor Cyan
Write-Host "────────────────────────────────" -ForegroundColor Gray
Write-Host "TOTAL (uncompressed):  ${totalSizeMB}MB" -ForegroundColor $(if($totalSizeMB -gt 32){"Yellow"}else{"Green"})
Write-Host ""

# Calculate compressed sizes
$compressedMin = [math]::Round($totalSizeMB * 0.1, 2)   # 90% compression (best case)
$compressedAvg = [math]::Round($totalSizeMB * 0.2, 2)   # 80% compression (typical)
$compressedMax = [math]::Round($totalSizeMB * 0.3, 2)   # 70% compression (worst case)

Write-Host "Estimated compressed size (GZIP):" -ForegroundColor Yellow
Write-Host "  Best case (90% compression):  ${compressedMin}MB" -ForegroundColor $(if($compressedMin -lt 32){"Green"}elseif($compressedMin -lt 40){"Yellow"}else{"Red"})
Write-Host "  Typical (80% compression):    ${compressedAvg}MB" -ForegroundColor $(if($compressedAvg -lt 32){"Green"}elseif($compressedAvg -lt 40){"Yellow"}else{"Red"})
Write-Host "  Worst case (70% compression): ${compressedMax}MB" -ForegroundColor $(if($compressedMax -lt 32){"Green"}elseif($compressedMax -lt 40){"Yellow"}else{"Red"})
Write-Host ""

Write-Host "Cloud Run limit: 32MB" -ForegroundColor Cyan
Write-Host ""

# Analysis
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "VERDICT:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

if ($compressedAvg -lt 32) {
    Write-Host "✅ WILL WORK with GZIP compression!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Expected compressed size: ~${compressedAvg}MB" -ForegroundColor Green
    Write-Host "Cloud Run limit: 32MB" -ForegroundColor Cyan
    Write-Host "Margin: $([math]::Round(32 - $compressedAvg, 2))MB headroom" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Deploy the fix:" -ForegroundColor Cyan
    Write-Host "   .\DEPLOY_FIX_CLOUD_RUN.ps1" -ForegroundColor White
} elseif ($compressedAvg -lt 40) {
    Write-Host "⚠️  MIGHT WORK but it's close!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Expected compressed size: ~${compressedAvg}MB" -ForegroundColor Yellow
    Write-Host "Cloud Run limit: 32MB" -ForegroundColor Cyan
    Write-Host "⚠️  Over limit by: $([math]::Round($compressedAvg - 32, 2))MB" -ForegroundColor Red
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPTION 1: Try compression first (may work if compression is better than 80%)" -ForegroundColor Cyan
    Write-Host "   .\DEPLOY_FIX_CLOUD_RUN.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "OPTION 2: Reduce Sales Orders scope" -ForegroundColor Cyan
    Write-Host "   Only scan last 3 months instead of all folders" -ForegroundColor White
    Write-Host "   Would reduce metadata from ${metadataSizeMB}MB to ~$([math]::Round($metadataSizeMB / 4, 2))MB" -ForegroundColor White
    Write-Host ""
    Write-Host "OPTION 3: Lazy load Sales Orders" -ForegroundColor Cyan
    Write-Host "   Load Sales Orders in separate API call" -ForegroundColor White
    Write-Host "   /api/data gets MiSys only (${misysSizeMB}MB → ~$([math]::Round($misysSizeMB * 0.2, 2))MB compressed)" -ForegroundColor White
    Write-Host "   /api/sales-orders gets SO metadata separately" -ForegroundColor White
} else {
    Write-Host "❌ TOO LARGE even with compression!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Expected compressed size: ~${compressedAvg}MB" -ForegroundColor Red
    Write-Host "Cloud Run limit: 32MB" -ForegroundColor Cyan
    Write-Host "Over limit by: $([math]::Round($compressedAvg - 32, 2))MB" -ForegroundColor Red
    Write-Host ""
    Write-Host "Required solutions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SOLUTION 1: Split into multiple endpoints (RECOMMENDED)" -ForegroundColor Cyan
    Write-Host "   /api/data/misys     → MiSys only (${misysSizeMB}MB → ~$([math]::Round($misysSizeMB * 0.2, 2))MB)" -ForegroundColor White
    Write-Host "   /api/data/orders    → Sales Orders (${metadataSizeMB}MB → ~$([math]::Round($metadataSizeMB * 0.2, 2))MB)" -ForegroundColor White
    Write-Host "   Frontend loads both in parallel" -ForegroundColor White
    Write-Host ""
    Write-Host "SOLUTION 2: Reduce Sales Orders scope" -ForegroundColor Cyan
    Write-Host "   Only scan active folders (last 3-6 months)" -ForegroundColor White
    Write-Host "   Would reduce from $fileCount files to ~$([math]::Round($fileCount / 4)) files" -ForegroundColor White
    Write-Host "   Metadata: ${metadataSizeMB}MB → ~$([math]::Round($metadataSizeMB / 4, 2))MB" -ForegroundColor White
    Write-Host ""
    Write-Host "SOLUTION 3: Pagination" -ForegroundColor Cyan
    Write-Host "   Load data in 20MB chunks" -ForegroundColor White
    Write-Host "   Requires significant frontend changes" -ForegroundColor White
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan

