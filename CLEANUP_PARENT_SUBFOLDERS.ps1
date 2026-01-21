# Cleanup Files in Parent Directory Subfolders
# These are test outputs, generated documents, and uploads - likely unused

$parent = "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CLEANUP: PARENT SUBFOLDERS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$deletedItems = @()
$totalSize = 0

# 1. test_output folder (test results)
Write-Host "1. Cleaning test_output folder..." -ForegroundColor Yellow
$testOutput = "$parent\test_output"
if (Test-Path $testOutput) {
    $files = Get-ChildItem -Path $testOutput -Recurse -File -ErrorAction SilentlyContinue
    $size = ($files | Measure-Object -Property Length -Sum).Sum
    $sizeMB = [math]::Round($size / 1MB, 2)
    Remove-Item -Path $testOutput -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $testOutput)) {
        Write-Host "   ✅ Deleted test_output\ folder ($($files.Count) files, $sizeMB MB)" -ForegroundColor Green
        $deletedItems += "test_output\ ($($files.Count) files, $sizeMB MB)"
        $totalSize += $size
    }
} else {
    Write-Host "   ⚠️  test_output folder not found" -ForegroundColor Yellow
}
Write-Host ""

# 2. generated_documents folder (generated files)
Write-Host "2. Cleaning generated_documents folder..." -ForegroundColor Yellow
$genDocs = "$parent\generated_documents"
if (Test-Path $genDocs) {
    $files = Get-ChildItem -Path $genDocs -Recurse -File -ErrorAction SilentlyContinue
    $size = ($files | Measure-Object -Property Length -Sum).Sum
    $sizeMB = [math]::Round($size / 1MB, 2)
    Remove-Item -Path $genDocs -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $genDocs)) {
        Write-Host "   ✅ Deleted generated_documents\ folder ($($files.Count) files, $sizeMB MB)" -ForegroundColor Green
        $deletedItems += "generated_documents\ ($($files.Count) files, $sizeMB MB)"
        $totalSize += $size
    }
} else {
    Write-Host "   ⚠️  generated_documents folder not found" -ForegroundColor Yellow
}
Write-Host ""

# 3. uploads folder (uploaded files)
Write-Host "3. Cleaning uploads folder..." -ForegroundColor Yellow
$uploads = "$parent\uploads"
if (Test-Path $uploads) {
    $files = Get-ChildItem -Path $uploads -Recurse -File -ErrorAction SilentlyContinue
    $size = ($files | Measure-Object -Property Length -Sum).Sum
    $sizeMB = [math]::Round($size / 1MB, 2)
    Remove-Item -Path $uploads -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $uploads)) {
        Write-Host "   ✅ Deleted uploads\ folder ($($files.Count) files, $sizeMB MB)" -ForegroundColor Green
        $deletedItems += "uploads\ ($($files.Count) files, $sizeMB MB)"
        $totalSize += $size
    }
} else {
    Write-Host "   ⚠️  uploads folder not found" -ForegroundColor Yellow
}
Write-Host ""

# 4. logs folder (old logs)
Write-Host "4. Cleaning logs folder..." -ForegroundColor Yellow
$logs = "$parent\logs"
if (Test-Path $logs) {
    $files = Get-ChildItem -Path $logs -Recurse -File -ErrorAction SilentlyContinue
    $size = ($files | Measure-Object -Property Length -Sum).Sum
    $sizeKB = [math]::Round($size / 1KB, 2)
    Remove-Item -Path $logs -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $logs)) {
        Write-Host "   ✅ Deleted logs\ folder ($($files.Count) files, $sizeKB KB)" -ForegroundColor Green
        $deletedItems += "logs\ ($($files.Count) files, $sizeKB KB)"
        $totalSize += $size
    }
} else {
    Write-Host "   ⚠️  logs folder not found" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "Total folders deleted: $($deletedItems.Count)" -ForegroundColor Green
Write-Host "Total space freed: $totalSizeMB MB" -ForegroundColor Green
Write-Host ""
Write-Host "Deleted folders:" -ForegroundColor Cyan
$deletedItems | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
Write-Host ""
Write-Host "✅ Subfolder cleanup complete!" -ForegroundColor Green









