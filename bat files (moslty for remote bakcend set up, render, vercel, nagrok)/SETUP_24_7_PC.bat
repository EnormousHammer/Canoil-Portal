@echo off
REM ============================================================
REM  SETUP 24/7 NGROK PC - COMPLETE INSTALLATION (BATCH)
REM ============================================================
REM  This works even if PowerShell scripts are disabled
REM ============================================================

echo.
echo ========================================
echo   CANOIL PORTAL - 24/7 PC SETUP
echo ========================================
echo.

cd /d "%~dp0"

REM ============================================================
REM STEP 1: CHECK EXISTING INSTALLATIONS
REM ============================================================

echo [STEP 1] Checking existing installations...
echo.

echo 1. Python:
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python --version
    set HAS_PYTHON=1
) else (
    echo    ERROR: Python not found
    set HAS_PYTHON=0
)

echo.
echo 2. Node.js:
node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node --version
    set HAS_NODE=1
) else (
    echo    ERROR: Node.js not found
    set HAS_NODE=0
)

echo.
echo 3. npm:
npm --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    npm --version
    set HAS_NPM=1
) else (
    echo    ERROR: npm not found
    set HAS_NPM=0
)

echo.
echo 4. ngrok:
ngrok version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    ngrok version
    set HAS_NGROK=1
) else (
    echo    WARNING: ngrok not found
    set HAS_NGROK=0
)

REM ============================================================
REM STEP 2: INSTALL MISSING SOFTWARE
REM ============================================================

echo.
echo.
echo [STEP 2] Installing missing software...
echo.

if %HAS_NODE% EQU 0 (
    echo Node.js is required but not installed!
    echo.
    echo Opening download page...
    start https://nodejs.org/en/download/
    echo.
    echo Please install Node.js LTS, then run this script again.
    echo Make sure to check "Add to PATH" during installation!
    pause
    exit /b 1
)

if %HAS_PYTHON% EQU 0 (
    echo Python is required but not installed!
    echo.
    echo Opening download page...
    start https://www.python.org/downloads/
    echo.
    echo Please install Python, then run this script again.
    echo Make sure to check "Add Python to PATH" during installation!
    pause
    exit /b 1
)

REM ============================================================
REM STEP 3: VERIFY PROJECT DIRECTORY
REM ============================================================

echo.
echo [STEP 3] Verifying project directory...
echo.

if exist "backend" (
    echo    OK: backend folder found
) else (
    echo    ERROR: backend folder not found!
    echo    Are you in the correct directory?
    pause
    exit /b 1
)

if exist "frontend" (
    echo    OK: frontend folder found
) else (
    echo    ERROR: frontend folder not found!
    pause
    exit /b 1
)

REM ============================================================
REM STEP 4: INSTALL PYTHON DEPENDENCIES
REM ============================================================

echo.
echo [STEP 4] Installing Python dependencies...
echo.

if exist "backend\venv" (
    echo    OK: Virtual environment found
) else (
    echo    Creating virtual environment...
    cd backend
    python -m venv venv
    cd ..
)

echo    Installing Python packages...
echo.
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt
if %ERRORLEVEL% EQU 0 (
    echo    OK: Python packages installed
) else (
    echo    ERROR: Failed to install Python packages
)

REM ============================================================
REM STEP 5: INSTALL FRONTEND DEPENDENCIES
REM ============================================================

echo.
echo [STEP 5] Installing frontend dependencies...
echo.

cd frontend

if exist "node_modules" (
    echo    OK: node_modules found, updating...
    npm install
) else (
    echo    Installing npm packages (this may take a few minutes)...
    npm install
)

if %ERRORLEVEL% EQU 0 (
    echo    OK: Frontend packages installed
) else (
    echo    ERROR: Failed to install frontend packages
    cd ..
    pause
    exit /b 1
)

cd ..

REM ============================================================
REM STEP 6: BUILD FRONTEND
REM ============================================================

echo.
echo [STEP 6] Building frontend...
echo.

cd frontend
echo    Building production frontend...
npm run build

if %ERRORLEVEL% EQU 0 (
    echo    OK: Frontend built successfully
) else (
    echo    ERROR: Failed to build frontend
)

cd ..

REM ============================================================
REM STEP 7: CREATE ENV FILE
REM ============================================================

echo.
echo [STEP 7] Setting up environment variables...
echo.

if exist "backend\.env" (
    echo    OK: .env file exists
) else (
    echo    Creating .env file...
    (
        echo # OpenAI API Key
        echo OPENAI_API_KEY=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
        echo.
        echo # Google Drive API
        echo USE_GOOGLE_DRIVE_API=false
        echo.
        echo # Flask Settings
        echo FLASK_ENV=production
        echo FLASK_DEBUG=0
    ) > backend\.env
    echo    OK: .env file created
)

REM ============================================================
REM STEP 8: VERIFY DATA ACCESS
REM ============================================================

echo.
echo [STEP 8] Verifying data access...
echo.

set GDRIVE_PATH=G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions

if exist "%GDRIVE_PATH%" (
    echo    OK: G: Drive accessible
    dir /b "%GDRIVE_PATH%" | findstr /r "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]" >nul
    if %ERRORLEVEL% EQU 0 (
        echo    OK: Data folders found
    )
) else (
    echo    WARNING: G: Drive not accessible at: %GDRIVE_PATH%
    echo    Make sure Google Drive is installed and syncing
)

REM ============================================================
REM FINAL SUMMARY
REM ============================================================

echo.
echo ========================================
echo   INSTALLATION COMPLETE!
echo ========================================
echo.

echo Next steps:
echo 1. Start backend: start_backend.bat
echo 2. Start ngrok:   ngrok http 5002
echo 3. Access via ngrok URL
echo.
echo Or use: START_EVERYTHING.bat
echo.

if %HAS_NGROK% EQU 0 (
    echo NOTE: ngrok not found. Install from: https://ngrok.com/download
    echo.
)

pause

