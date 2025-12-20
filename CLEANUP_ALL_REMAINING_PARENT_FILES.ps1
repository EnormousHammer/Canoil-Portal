# Cleanup ALL Remaining Unused Files in Parent Directory
# These are one-off debugging/analysis scripts NOT used by canoil-portal

$parent = "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CLEANUP: ALL REMAINING PARENT FILES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$deletedItems = @()
$totalSize = 0

# Python file patterns to delete (all one-off scripts)
$pythonPatterns = @(
    'check_*.py',
    'verify_*.py',
    'trace_*.py',
    'fix_*.py',
    'run_*.py',
    'show_*.py',
    'diagnose_*.py',
    'find_*.py',
    'examine_*.py',
    'cross_*.py',
    'simple_*.py',
    'final_*.py',
    'complete_*.py',
    'convert_*.py',
    'clean_*.py',
    'understand_*.py',
    'proper_*.py',
    'systematic_*.py',
    'inspect_*.py',
    'investigate_*.py',
    'direct_*.py',
    'read_*.py',
    'scan_*.py',
    'ultimate_*.py'
)

Write-Host "1. Deleting Python analysis/debug scripts..." -ForegroundColor Yellow
$allPythonFiles = @()
foreach ($pattern in $pythonPatterns) {
    $files = Get-ChildItem -Path $parent -Filter $pattern -File -ErrorAction SilentlyContinue
    $allPythonFiles += $files
}

if ($allPythonFiles) {
    $pythonSize = ($allPythonFiles | Measure-Object -Property Length -Sum).Sum
    $pythonSizeMB = [math]::Round($pythonSize / 1MB, 2)
    $allPythonFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($allPythonFiles.Count) Python scripts ($pythonSizeMB MB)" -ForegroundColor Green
    $deletedItems += "$($allPythonFiles.Count) Python scripts ($pythonSizeMB MB)"
    $totalSize += $pythonSize
} else {
    Write-Host "   ⚠️  No Python scripts found" -ForegroundColor Yellow
}
Write-Host ""

# Test result files
Write-Host "2. Deleting test result/output files..." -ForegroundColor Yellow
$testResultFiles = Get-ChildItem -Path $parent -Filter "*test*.txt" -File -ErrorAction SilentlyContinue
$testResultFiles += Get-ChildItem -Path $parent -Filter "*test*.json" -File -ErrorAction SilentlyContinue
$testResultFiles += Get-ChildItem -Path $parent -Filter "*test*.html" -File -ErrorAction SilentlyContinue
$testResultFiles += Get-ChildItem -Path $parent -Filter "*results*.txt" -File -ErrorAction SilentlyContinue
$testResultFiles += Get-ChildItem -Path $parent -Filter "*results*.json" -File -ErrorAction SilentlyContinue
$testResultFiles += Get-ChildItem -Path $parent -Filter "*output*.txt" -File -ErrorAction SilentlyContinue
$testResultFiles += Get-ChildItem -Path $parent -Filter "*output*.json" -File -ErrorAction SilentlyContinue

if ($testResultFiles) {
    $testSize = ($testResultFiles | Measure-Object -Property Length -Sum).Sum
    $testSizeMB = [math]::Round($testSize / 1MB, 2)
    $testResultFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($testResultFiles.Count) test result files ($testSizeMB MB)" -ForegroundColor Green
    $deletedItems += "$($testResultFiles.Count) test result files ($testSizeMB MB)"
    $totalSize += $testSize
}
Write-Host ""

# Batch files (test/debug scripts)
Write-Host "3. Deleting batch test scripts..." -ForegroundColor Yellow
$batFiles = Get-ChildItem -Path $parent -Filter "*.bat" -File -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -match 'TEST|RUN|CHECK|VERIFY|DIAGNOSE|FORCE|CLEAN' }
if ($batFiles) {
    $batSize = ($batFiles | Measure-Object -Property Length -Sum).Sum
    $batSizeKB = [math]::Round($batSize / 1KB, 2)
    $batFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($batFiles.Count) batch test scripts ($batSizeKB KB)" -ForegroundColor Green
    $deletedItems += "$($batFiles.Count) batch test scripts ($batSizeKB KB)"
    $totalSize += $batSize
}
Write-Host ""

# JavaScript test files
Write-Host "4. Deleting JavaScript test files..." -ForegroundColor Yellow
$jsFiles = Get-ChildItem -Path $parent -Filter "test_*.js" -File -ErrorAction SilentlyContinue
if ($jsFiles) {
    $jsSize = ($jsFiles | Measure-Object -Property Length -Sum).Sum
    $jsSizeKB = [math]::Round($jsSize / 1KB, 2)
    $jsFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($jsFiles.Count) JavaScript test files ($jsSizeKB KB)" -ForegroundColor Green
    $deletedItems += "$($jsFiles.Count) JavaScript test files ($jsSizeKB KB)"
    $totalSize += $jsSize
}
Write-Host ""

# JSON test/output files
Write-Host "5. Deleting JSON test/output files..." -ForegroundColor Yellow
$jsonFiles = Get-ChildItem -Path $parent -Filter "*.json" -File -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -match 'test|output|results|response|extraction|mapping|example|sample|expected|raw|openai|multiple|complete|sample' }
if ($jsonFiles) {
    $jsonSize = ($jsonFiles | Measure-Object -Property Length -Sum).Sum
    $jsonSizeMB = [math]::Round($jsonSize / 1MB, 2)
    $jsonFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($jsonFiles.Count) JSON test/output files ($jsonSizeMB MB)" -ForegroundColor Green
    $deletedItems += "$($jsonFiles.Count) JSON test/output files ($jsonSizeMB MB)"
    $totalSize += $jsonSize
}
Write-Host ""

# Text files (test results, logs, etc.)
Write-Host "6. Deleting text test/log files..." -ForegroundColor Yellow
$txtFiles = Get-ChildItem -Path $parent -Filter "*.txt" -File -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -match 'test|results|output|verification|comparison|parsing|extraction|trace|debug|log' }
if ($txtFiles) {
    $txtSize = ($txtFiles | Measure-Object -Property Length -Sum).Sum
    $txtSizeKB = [math]::Round($txtSize / 1KB, 2)
    $txtFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($txtFiles.Count) text test/log files ($txtSizeKB KB)" -ForegroundColor Green
    $deletedItems += "$($txtFiles.Count) text test/log files ($txtSizeKB KB)"
    $totalSize += $txtSize
}
Write-Host ""

# Excel test files
Write-Host "7. Deleting Excel test files..." -ForegroundColor Yellow
$xlsxFiles = Get-ChildItem -Path $parent -Filter "TEST_*.xlsx" -File -ErrorAction SilentlyContinue
if ($xlsxFiles) {
    $xlsxSize = ($xlsxFiles | Measure-Object -Property Length -Sum).Sum
    $xlsxSizeMB = [math]::Round($xlsxSize / 1MB, 2)
    $xlsxFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($xlsxFiles.Count) Excel test files ($xlsxSizeMB MB)" -ForegroundColor Green
    $deletedItems += "$($xlsxFiles.Count) Excel test files ($xlsxSizeMB MB)"
    $totalSize += $xlsxSize
}
Write-Host ""

# Word test files
Write-Host "8. Deleting Word test files..." -ForegroundColor Yellow
$docxFiles = Get-ChildItem -Path $parent -Filter "TEST_*.docx" -File -ErrorAction SilentlyContinue
if ($docxFiles) {
    $docxSize = ($docxFiles | Measure-Object -Property Length -Sum).Sum
    $docxSizeKB = [math]::Round($docxSize / 1KB, 2)
    $docxFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($docxFiles.Count) Word test files ($docxSizeKB KB)" -ForegroundColor Green
    $deletedItems += "$($docxFiles.Count) Word test files ($docxSizeKB KB)"
    $totalSize += $docxSize
}
Write-Host ""

# HTML test files
Write-Host "9. Deleting HTML test files..." -ForegroundColor Yellow
$htmlFiles = Get-ChildItem -Path $parent -Filter "test_*.html" -File -ErrorAction SilentlyContinue
if ($htmlFiles) {
    $htmlSize = ($htmlFiles | Measure-Object -Property Length -Sum).Sum
    $htmlSizeKB = [math]::Round($htmlSize / 1KB, 2)
    $htmlFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($htmlFiles.Count) HTML test files ($htmlSizeKB KB)" -ForegroundColor Green
    $deletedItems += "$($htmlFiles.Count) HTML test files ($htmlSizeKB KB)"
    $totalSize += $htmlSize
}
Write-Host ""

# Log files
Write-Host "10. Deleting log files..." -ForegroundColor Yellow
$logFiles = Get-ChildItem -Path $parent -Filter "*.log" -File -ErrorAction SilentlyContinue
if ($logFiles) {
    $logSize = ($logFiles | Measure-Object -Property Length -Sum).Sum
    $logSizeKB = [math]::Round($logSize / 1KB, 2)
    $logFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Deleted $($logFiles.Count) log files ($logSizeKB KB)" -ForegroundColor Green
    $deletedItems += "$($logFiles.Count) log files ($logSizeKB KB)"
    $totalSize += $logSize
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "Total items deleted: $($deletedItems.Count) categories" -ForegroundColor Green
Write-Host "Total space freed: $totalSizeMB MB" -ForegroundColor Green
Write-Host ""
Write-Host "Deleted items:" -ForegroundColor Cyan
$deletedItems | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
Write-Host ""
Write-Host "✅ All unused test/debug/analysis files deleted!" -ForegroundColor Green

