# ============================================================
#  VERIFY 24/7 PC SETUP - HEALTH CHECK
# ============================================================
# Run this to verify everything is installed and working
# ============================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CANOIL PORTAL - SYSTEM VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$allGood = $true

# ============================================================
# 1. SOFTWARE CHECKS
# ============================================================

Write-Host "[1] SOFTWARE INSTALLATIONS" -ForegroundColor Yellow
Write-Host "─────────────────────────────`n" -ForegroundColor DarkGray

# Python
Write-Host "Python:       " -NoNewline
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# Node.js
Write-Host "Node.js:      " -NoNewline
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✅ $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# npm
Write-Host "npm:          " -NoNewline
try {
    $npmVersion = npm --version 2>&1
    Write-Host "✅ v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# ngrok
Write-Host "ngrok:        " -NoNewline
try {
    $ngrokVersion = ngrok version 2>&1
    Write-Host "✅ $ngrokVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# ============================================================
# 2. PROJECT STRUCTURE
# ============================================================

Write-Host "`n[2] PROJECT STRUCTURE" -ForegroundColor Yellow
Write-Host "─────────────────────────────`n" -ForegroundColor DarkGray

$projectPath = "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

Write-Host "Project Path: " -NoNewline
if (Test-Path $projectPath) {
    Write-Host "✅ Found" -ForegroundColor Green
    cd $projectPath
} else {
    Write-Host "❌ Not found" -ForegroundColor Red
    $allGood = $false
}

$requiredFolders = @(
    "backend",
    "frontend",
    "backend\venv",
    "frontend\node_modules",
    "frontend\dist"
)

foreach ($folder in $requiredFolders) {
    Write-Host "$($folder.PadRight(20)): " -NoNewline
    if (Test-Path $folder) {
        Write-Host "✅" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing" -ForegroundColor Red
        if ($folder -eq "frontend\dist") {
            Write-Host "  → Run: cd frontend; npm run build" -ForegroundColor Gray
        }
        $allGood = $false
    }
}

# ============================================================
# 3. PYTHON PACKAGES
# ============================================================

Write-Host "`n[3] PYTHON PACKAGES" -ForegroundColor Yellow
Write-Host "─────────────────────────────`n" -ForegroundColor DarkGray

$pythonPackages = @("flask", "flask-cors", "google-api-python-client", "openai", "pandas")

foreach ($package in $pythonPackages) {
    Write-Host "$($package.PadRight(30)): " -NoNewline
    try {
        $check = pip show $package 2>&1
        if ($check -like "*Version:*") {
            $version = ($check | Select-String "Version:").ToString().Split(":")[1].Trim()
            Write-Host "✅ v$version" -ForegroundColor Green
        } else {
            Write-Host "❌ Not installed" -ForegroundColor Red
            $allGood = $false
        }
    } catch {
        Write-Host "❌ Not installed" -ForegroundColor Red
        $allGood = $false
    }
}

# ============================================================
# 4. NETWORK & SERVICES
# ============================================================

Write-Host "`n[4] NETWORK & SERVICES" -ForegroundColor Yellow
Write-Host "─────────────────────────────`n" -ForegroundColor DarkGray

# Check if backend is running
Write-Host "Backend (5002):               " -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5002/api/health" -UseBasicParsing -TimeoutSec 2 2>&1
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Responding but unhealthy" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Not running" -ForegroundColor Red
    Write-Host "  → Run: .\start_backend.bat" -ForegroundColor Gray
}

# Check ngrok
Write-Host "ngrok (4040):                 " -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing -TimeoutSec 2 2>&1
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Running" -ForegroundColor Green
        
        # Get tunnel URL
        $tunnels = $response.Content | ConvertFrom-Json
        if ($tunnels.tunnels.Count -gt 0) {
            $publicUrl = $tunnels.tunnels[0].public_url
            Write-Host "  Public URL: $publicUrl" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "❌ Not running" -ForegroundColor Red
    Write-Host "  → Run: ngrok http 5002" -ForegroundColor Gray
}

# ============================================================
# 5. DATA ACCESS
# ============================================================

Write-Host "`n[5] DATA ACCESS" -ForegroundColor Yellow
Write-Host "─────────────────────────────`n" -ForegroundColor DarkGray

$gdrivePath = "G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
Write-Host "G: Drive Access:              " -NoNewline
if (Test-Path $gdrivePath) {
    Write-Host "✅ Accessible" -ForegroundColor Green
    
    # Find latest folder
    $folders = Get-ChildItem $gdrivePath -Directory | Sort-Object Name -Descending
    if ($folders.Count -gt 0) {
        $latestFolder = $folders[0].Name
        Write-Host "  Latest folder: $latestFolder" -ForegroundColor Cyan
        
        # Check for data files
        $dataFiles = Get-ChildItem "$gdrivePath\$latestFolder" -Filter "*.json" | Measure-Object
        Write-Host "  Data files: $($dataFiles.Count)" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Not accessible" -ForegroundColor Red
    Write-Host "  → Make sure Google Drive is installed and syncing" -ForegroundColor Gray
    $allGood = $false
}

# ============================================================
# 6. CONFIGURATION FILES
# ============================================================

Write-Host "`n[6] CONFIGURATION FILES" -ForegroundColor Yellow
Write-Host "─────────────────────────────`n" -ForegroundColor DarkGray

$configFiles = @(
    "backend\.env",
    "backend\requirements.txt",
    "frontend\package.json",
    "start_backend.bat",
    "START_NGROK_MODE.bat"
)

foreach ($file in $configFiles) {
    Write-Host "$($file.PadRight(30)): " -NoNewline
    if (Test-Path $file) {
        Write-Host "✅" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing" -ForegroundColor Red
        $allGood = $false
    }
}

# ============================================================
# FINAL SUMMARY
# ============================================================

Write-Host "`n========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "  ✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host "  System is ready to run" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  SOME CHECKS FAILED" -ForegroundColor Yellow
    Write-Host "  Review errors above" -ForegroundColor Yellow
}
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Quick Actions:" -ForegroundColor Yellow
Write-Host "• Start backend:    .\start_backend.bat" -ForegroundColor White
Write-Host "• Start ngrok:      ngrok http 5002" -ForegroundColor White
Write-Host "• Run full setup:   .\SETUP_24_7_PC.ps1" -ForegroundColor White
Write-Host "• View logs:        Get-Content backend\app.log -Tail 50`n" -ForegroundColor White

Read-Host "Press Enter to exit"

