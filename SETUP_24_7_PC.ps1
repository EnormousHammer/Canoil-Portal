# ============================================================
#  SETUP 24/7 NGROK PC - COMPLETE INSTALLATION
# ============================================================
# Run this script on the 24/7 PC to install everything needed
# ============================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CANOIL PORTAL - 24/7 PC SETUP" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  WARNING: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "Some installations may require admin rights" -ForegroundColor Yellow
    Write-Host "Right-click PowerShell and 'Run as Administrator' for best results`n" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') { exit }
}

# ============================================================
# STEP 1: CHECK EXISTING INSTALLATIONS
# ============================================================

Write-Host "`n[STEP 1] Checking existing installations..." -ForegroundColor Yellow

# Check Python
Write-Host "`n1. Python:" -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✅ $pythonVersion" -ForegroundColor Green
    $hasPython = $true
} catch {
    Write-Host "   ❌ Python not found" -ForegroundColor Red
    $hasPython = $false
}

# Check Node.js
Write-Host "`n2. Node.js:" -ForegroundColor Cyan
try {
    $nodeVersion = node --version 2>&1
    Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green
    $hasNode = $true
} catch {
    Write-Host "   ❌ Node.js not found" -ForegroundColor Red
    $hasNode = $false
}

# Check npm
Write-Host "`n3. npm:" -ForegroundColor Cyan
try {
    $npmVersion = npm --version 2>&1
    Write-Host "   ✅ npm $npmVersion" -ForegroundColor Green
    $hasNpm = $true
} catch {
    Write-Host "   ❌ npm not found" -ForegroundColor Red
    $hasNpm = $false
}

# Check Git
Write-Host "`n4. Git:" -ForegroundColor Cyan
try {
    $gitVersion = git --version 2>&1
    Write-Host "   ✅ $gitVersion" -ForegroundColor Green
    $hasGit = $true
} catch {
    Write-Host "   ❌ Git not found" -ForegroundColor Red
    $hasGit = $false
}

# Check ngrok
Write-Host "`n5. ngrok:" -ForegroundColor Cyan
try {
    $ngrokVersion = ngrok version 2>&1
    Write-Host "   ✅ ngrok $ngrokVersion" -ForegroundColor Green
    $hasNgrok = $true
} catch {
    Write-Host "   ❌ ngrok not found" -ForegroundColor Red
    $hasNgrok = $false
}

# ============================================================
# STEP 2: INSTALL MISSING SOFTWARE
# ============================================================

Write-Host "`n`n[STEP 2] Installing missing software..." -ForegroundColor Yellow

# Install Node.js if missing
if (-not $hasNode) {
    Write-Host "`n📦 Installing Node.js..." -ForegroundColor Cyan
    Write-Host "   Opening download page..." -ForegroundColor Gray
    Start-Process "https://nodejs.org/en/download/"
    Write-Host "`n   ⚠️  Please install Node.js LTS from the browser" -ForegroundColor Yellow
    Write-Host "   After installation, close and reopen this PowerShell window" -ForegroundColor Yellow
    Write-Host "   Then run this script again" -ForegroundColor Yellow
    Read-Host "`nPress Enter to continue"
}

# Install Python if missing
if (-not $hasPython) {
    Write-Host "`n📦 Installing Python..." -ForegroundColor Cyan
    Write-Host "   Opening download page..." -ForegroundColor Gray
    Start-Process "https://www.python.org/downloads/"
    Write-Host "`n   ⚠️  Please install Python from the browser" -ForegroundColor Yellow
    Write-Host "   ⚠️  IMPORTANT: Check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    Write-Host "   After installation, close and reopen this PowerShell window" -ForegroundColor Yellow
    Write-Host "   Then run this script again" -ForegroundColor Yellow
    Read-Host "`nPress Enter to continue"
}

# If core software missing, exit and ask to rerun
if (-not $hasNode -or -not $hasPython) {
    Write-Host "`n⚠️  Please install missing software and rerun this script" -ForegroundColor Yellow
    Read-Host "`nPress Enter to exit"
    exit
}

# ============================================================
# STEP 3: SETUP PROJECT DIRECTORY
# ============================================================

Write-Host "`n`n[STEP 3] Setting up project directory..." -ForegroundColor Yellow

$projectPath = "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

if (Test-Path $projectPath) {
    Write-Host "   ✅ Project directory found: $projectPath" -ForegroundColor Green
    cd $projectPath
} else {
    Write-Host "   ❌ Project directory not found!" -ForegroundColor Red
    Write-Host "   Expected: $projectPath" -ForegroundColor Gray
    Read-Host "`nPress Enter to exit"
    exit
}

# ============================================================
# STEP 4: INSTALL PYTHON DEPENDENCIES
# ============================================================

Write-Host "`n`n[STEP 4] Installing Python dependencies..." -ForegroundColor Yellow

# Check if virtual environment exists
if (Test-Path "backend\venv") {
    Write-Host "   ✅ Virtual environment found" -ForegroundColor Green
} else {
    Write-Host "   📦 Creating virtual environment..." -ForegroundColor Cyan
    cd backend
    python -m venv venv
    cd ..
}

# Activate venv and install requirements
Write-Host "   📦 Installing Python packages..." -ForegroundColor Cyan
try {
    & "backend\venv\Scripts\Activate.ps1"
    pip install -r backend\requirements.txt
    Write-Host "   ✅ Python packages installed" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Error installing Python packages: $_" -ForegroundColor Yellow
}

# ============================================================
# STEP 5: INSTALL FRONTEND DEPENDENCIES
# ============================================================

Write-Host "`n`n[STEP 5] Installing frontend dependencies..." -ForegroundColor Yellow

cd frontend

if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules found" -ForegroundColor Green
    Write-Host "   Updating packages..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "   📦 Installing npm packages (this may take a few minutes)..." -ForegroundColor Cyan
    npm install
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Frontend packages installed" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error installing frontend packages" -ForegroundColor Red
}

cd ..

# ============================================================
# STEP 6: BUILD FRONTEND
# ============================================================

Write-Host "`n`n[STEP 6] Building frontend..." -ForegroundColor Yellow

cd frontend
Write-Host "   🔨 Building production frontend (this may take a minute)..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Frontend built successfully" -ForegroundColor Green
    
    # Check dist folder
    if (Test-Path "dist") {
        $distSize = (Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "   📦 Build size: $([math]::Round($distSize, 2)) MB" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ Error building frontend" -ForegroundColor Red
}

cd ..

# ============================================================
# STEP 7: SETUP NGROK
# ============================================================

Write-Host "`n`n[STEP 7] Setting up ngrok..." -ForegroundColor Yellow

if (-not $hasNgrok) {
    Write-Host "   📦 Installing ngrok..." -ForegroundColor Cyan
    
    # Try chocolatey first
    try {
        choco install ngrok -y
        Write-Host "   ✅ ngrok installed via Chocolatey" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Chocolatey not found, opening manual download page..." -ForegroundColor Yellow
        Start-Process "https://ngrok.com/download"
        Write-Host "   Please download and extract ngrok.exe to a folder in your PATH" -ForegroundColor Yellow
        Read-Host "`nPress Enter to continue"
    }
}

# Check ngrok auth token
Write-Host "`n   Checking ngrok authentication..." -ForegroundColor Cyan
try {
    $ngrokConfig = ngrok config check 2>&1
    if ($ngrokConfig -like "*authtoken*") {
        Write-Host "   ✅ ngrok authenticated" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  ngrok not authenticated" -ForegroundColor Yellow
        Write-Host "   Run: ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor Gray
        Write-Host "   Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Could not check ngrok authentication" -ForegroundColor Yellow
}

# ============================================================
# STEP 8: CREATE STARTUP SCRIPTS
# ============================================================

Write-Host "`n`n[STEP 8] Creating startup scripts..." -ForegroundColor Yellow

# Already exist, just verify
$scripts = @(
    "start_backend.bat",
    "START_NGROK_MODE.bat",
    "launch-canoil.bat"
)

foreach ($script in $scripts) {
    if (Test-Path $script) {
        Write-Host "   ✅ $script" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $script not found" -ForegroundColor Yellow
    }
}

# ============================================================
# STEP 9: ENVIRONMENT VARIABLES
# ============================================================

Write-Host "`n`n[STEP 9] Setting up environment variables..." -ForegroundColor Yellow

# Create .env file if it doesn't exist
if (-not (Test-Path "backend\.env")) {
    Write-Host "   📝 Creating backend\.env file..." -ForegroundColor Cyan
    
    $envContent = @"
# OpenAI API Key
OPENAI_API_KEY=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

# Google Drive API (for ngrok/remote access)
USE_GOOGLE_DRIVE_API=false

# Flask Settings
FLASK_ENV=production
FLASK_DEBUG=0
"@
    
    $envContent | Out-File -FilePath "backend\.env" -Encoding UTF8
    Write-Host "   ✅ .env file created" -ForegroundColor Green
} else {
    Write-Host "   ✅ backend\.env file exists" -ForegroundColor Green
}

# ============================================================
# FINAL VERIFICATION
# ============================================================

Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "✅ Setup completed successfully!`n" -ForegroundColor Green

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start backend: .\start_backend.bat" -ForegroundColor White
Write-Host "2. Start ngrok (in new window): ngrok http 5002" -ForegroundColor White
Write-Host "3. Access via ngrok URL" -ForegroundColor White
Write-Host ""
Write-Host "Or use all-in-one launcher: .\launch-canoil.bat`n" -ForegroundColor White

Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "- NGROK_MODE_INSTRUCTIONS.md - Setup guide" -ForegroundColor Gray
Write-Host "- NGROK_FIX_COMPLETE.md - Troubleshooting" -ForegroundColor Gray
Write-Host "- START_NGROK_MODE.bat - Start with Google Drive API`n" -ForegroundColor Gray

Read-Host "Press Enter to exit"

