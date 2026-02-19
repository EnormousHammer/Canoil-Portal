# ============================================================
#  CANOIL PORTAL - DATA MAPPING VERIFICATION
#  Verifies: Files in folder -> Converter maps them -> App has data
#  Run after starting the app (launch-canoil.bat) OR use -Cloud for Render backend.
# ============================================================
#  Usage: .\test-canoil-api.ps1           # Local backend (localhost:5002)
#         .\test-canoil-api.ps1 -Cloud   # Cloud backend (Render - Full Company Data via Google Drive API)
# ============================================================

param([switch]$Cloud)
$ErrorActionPreference = "Continue"
$BackendUrl = if ($Cloud) { "https://canoil-portal-1.onrender.com" } else { "http://localhost:5002" }

# CSV file stem -> app keys (from full_company_data_converter.py)
$CsvToAppKeys = @{
    "MIITEM" = @("CustomAlert5.json", "Items.json")
    "Item" = @("CustomAlert5.json", "Items.json")
    "Items" = @("CustomAlert5.json", "Items.json")
    "CustomAlert5" = @("CustomAlert5.json", "Items.json")
    "MIILOC" = @("MIILOC.json")
    "MIBOMH" = @("MIBOMH.json", "BillsOfMaterial.json")
    "MIBOMD" = @("MIBOMD.json", "BillOfMaterialDetails.json")
    "MIMOH" = @("ManufacturingOrderHeaders.json", "MIMOH.json")
    "MIMOMD" = @("ManufacturingOrderDetails.json", "MIMOMD.json")
    "MIMORD" = @("ManufacturingOrderRoutings.json", "MIMORD.json")
    "MIPOH" = @("PurchaseOrders.json", "MIPOH.json")
    "MIPOD" = @("PurchaseOrderDetails.json", "MIPOD.json")
    "MIPOHX" = @("PurchaseOrderExtensions.json")
    "MIPOC" = @("PurchaseOrderExtensions.json", "MIPOC.json")
    "MIPOCV" = @("PurchaseOrderAdditionalCosts.json", "MIPOCV.json")
    "MIPODC" = @("PurchaseOrderDetailAdditionalCosts.json", "MIPODC.json")
    "MIJOBH" = @("Jobs.json", "MIJOBH.json")
    "MIJOBD" = @("JobDetails.json", "MIJOBD.json")
    "MIWOH" = @("WorkOrders.json", "MIWOH.json", "WorkOrderHeaders.json")
    "MIWOD" = @("WorkOrderDetails.json", "MIWOD.json")
    "MIILOCQT" = @("MIILOCQT.json")
    "MIBINQ" = @("MIBINQ.json")
    "MILOGH" = @("MILOGH.json")
    "MILOGD" = @("MILOGD.json")
    "MILOGB" = @("MILOGB.json")
    "MIBINH" = @("MIBINH.json")
    "MIICST" = @("MIICST.json")
    "MIITEMX" = @("MIITEMX.json")
    "MIITEMA" = @("MIITEMA.json")
    "MIQMFG" = @("MIQMFG.json")
    "MISUPL" = @("MISUPL.json")
    "MIQSUP" = @("MIQSUP.json")
    "MIUSER" = @("MIUSER.json")
    "MISLTH" = @("LotSerialHistory.json")
    "MISLTD" = @("LotSerialDetail.json")
    "MISLHIST" = @("MISLHIST.json")
    "MISLNH" = @("MISLNH.json")
    "MISLND" = @("MISLND.json")
    "MISLBINQ" = @("MISLBINQ.json")
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CANOIL - DATA MAPPING VERIFICATION" -ForegroundColor Cyan
Write-Host "  Are we mapping all Full Company Data?" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Backend check
Write-Host "[1] Backend" -ForegroundColor Yellow
if ($Cloud) {
    Write-Host "    Using cloud: $BackendUrl" -ForegroundColor Cyan
    try {
        $health = Invoke-RestMethod -Uri "$BackendUrl/api/health" -Method GET -TimeoutSec 10
        Write-Host "    OK: Cloud backend reachable" -ForegroundColor Green
    } catch {
        Write-Host "    FAIL: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    $port5002 = Get-NetTCPConnection -LocalPort 5002 -ErrorAction SilentlyContinue
    if (-not $port5002) {
        Write-Host "    FAIL: Local backend not running. Run launch-canoil.bat or use -Cloud for Render." -ForegroundColor Red
        exit 1
    }
    Write-Host "    OK: Local backend running" -ForegroundColor Green
}
Write-Host ""

# 2. Get file list from Full Company Data folder (local) or skip (cloud uses Drive API)
Write-Host "[2] Full Company Data folder" -ForegroundColor Yellow
$csvStems = @()
if ($Cloud) {
    try {
        $list = Invoke-RestMethod -Uri "$BackendUrl/api/full-company-data/list" -Method GET -TimeoutSec 30
        $fileNames = $list.files | ForEach-Object { $_.name }
        $csvStems = $fileNames | Where-Object { $_ -match '\.(csv|xlsx|xls)$' } | ForEach-Object {
            [System.IO.Path]::GetFileNameWithoutExtension($_)
        } | Sort-Object -Unique
        Write-Host "    OK: $($fileNames.Count) files via Drive API" -ForegroundColor Green
    } catch {
        Write-Host "    (skipped - cloud uses Drive API)" -ForegroundColor Gray
        $csvStems = @("MIITEM","MIBOMH","MIBOMD","MIMOH","MIMOMD","MIPOH","MIPOD","MIILOCQT","MILOGH","MIICST","MISUPL")
    }
} else {
    try {
        $list = Invoke-RestMethod -Uri "$BackendUrl/api/full-company-data/list" -Method GET -TimeoutSec 15
        $fileNames = $list.files | ForEach-Object { $_.name }
        $csvStems = $fileNames | Where-Object { $_ -match '\.(csv|xlsx|xls)$' } | ForEach-Object {
            [System.IO.Path]::GetFileNameWithoutExtension($_)
        } | Sort-Object -Unique
        Write-Host "    OK: $($fileNames.Count) files, $($csvStems.Count) CSV/Excel stems" -ForegroundColor Green
        if ($list.path) { Write-Host "    Path: $($list.path)" -ForegroundColor Gray }
    } catch {
        Write-Host "    FAIL: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# 3. Get /api/data
Write-Host "[3] Loading /api/data (may take 30-90 sec)..." -ForegroundColor Yellow
$apiData = $null
try {
    $apiData = Invoke-RestMethod -Uri "$BackendUrl/api/data" -Method GET -TimeoutSec 120
} catch {
    Write-Host "    FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
$data = $apiData.data
$source = $apiData.source
Write-Host "    OK: Loaded, source=$source" -ForegroundColor Green
Write-Host ""

# 4. Build record counts per app key
function Get-RecordCount($obj) {
    if ($null -eq $obj) { return 0 }
    if ($obj -is [System.Array]) { return $obj.Count }
    if ($obj -is [PSCustomObject] -and $obj.PSObject.Properties['mps_orders']) {
        return ($obj.mps_orders | Measure-Object).Count
    }
    return 0
}

$keyCounts = @{}
foreach ($prop in $data.PSObject.Properties) {
    $keyCounts[$prop.Name] = Get-RecordCount $prop.Value
}

# 5. Report: MAPPED (file exists -> app has data)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MAPPED: CSV in folder -> App keys populated" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$mappedOk = 0
$mappedEmpty = 0
foreach ($stem in $csvStems) {
    $appKeys = $CsvToAppKeys[$stem]
    if (-not $appKeys) { continue }
    $totalRecs = 0
    foreach ($k in $appKeys) {
        $totalRecs += $keyCounts[$k]
    }
    if ($totalRecs -gt 0) {
        $recStr = ($appKeys | ForEach-Object { "$_`: $($keyCounts[$_])" }) -join ", "
        Write-Host "  OK  $stem.CSV -> $recStr" -ForegroundColor Green
        $mappedOk++
    } else {
        Write-Host "  !!  $stem.CSV -> $($appKeys -join ', ') EMPTY (not loaded?)" -ForegroundColor Yellow
        $mappedEmpty++
    }
}
Write-Host ""

# 6. Report: FILES NOT MAPPED (in folder but converter ignores)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NOT MAPPED: Files in folder, converter has no mapping" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$unmapped = @()
foreach ($stem in $csvStems) {
    if (-not $CsvToAppKeys[$stem]) {
        $unmapped += $stem
    }
}
if ($unmapped.Count -gt 0) {
    $unmapped | Sort-Object | ForEach-Object { Write-Host "  - $_.CSV" -ForegroundColor Gray }
    Write-Host "  ($($unmapped.Count) files - add to full_company_data_converter.py if needed)" -ForegroundColor Gray
} else {
    Write-Host "  (none - all folder files are mapped)" -ForegroundColor Gray
}
Write-Host ""

# 7. Report: APP KEYS EMPTY (expected from converter but no data)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  EMPTY: App keys expected by converter, but no data" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$allExpectedKeys = $CsvToAppKeys.Values | ForEach-Object { $_ } | Sort-Object -Unique
$emptyExpected = @()
foreach ($k in $allExpectedKeys) {
    if (($keyCounts[$k] -eq 0) -and ($keyCounts.ContainsKey($k))) {
        $emptyExpected += $k
    }
}
if ($emptyExpected.Count -gt 0) {
    $emptyExpected | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "  (source CSV may be missing or column names don't match)" -ForegroundColor Gray
} else {
    Write-Host "  (none - all expected keys have data)" -ForegroundColor Gray
}
Write-Host ""

# 8. Summary table - key datasets
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  KEY DATASETS (record counts)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$keySets = @(
    @("CustomAlert5.json", "Items"),
    @("ManufacturingOrderHeaders.json", "MOs"),
    @("PurchaseOrders.json", "POs"),
    @("MIILOCQT.json", "Stock by location"),
    @("MILOGH.json", "Transactions"),
    @("MIICST.json", "Cost history"),
    @("Jobs.json", "Jobs"),
    @("WorkOrders.json", "Work orders"),
    @("MISUPL.json", "Suppliers"),
    @("BillOfMaterialDetails.json", "BOM")
)
foreach ($pair in $keySets) {
    $k = $pair[0]
    $label = $pair[1]
    $n = $keyCounts[$k]
    $color = if ($n -gt 0) { "Green" } else { "Yellow" }
    Write-Host "  $label ($k): $n" -ForegroundColor $color
}
Write-Host ""

# Final summary
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Mapped OK: $mappedOk | Mapped but empty: $mappedEmpty | Unmapped files: $($unmapped.Count)" -ForegroundColor White
Write-Host ""
