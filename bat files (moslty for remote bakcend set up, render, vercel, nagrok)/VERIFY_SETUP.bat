@echo off
REM ============================================================
REM  VERIFY 24/7 PC SETUP - HEALTH CHECK (BATCH)
REM ============================================================

echo.
echo ========================================
echo   CANOIL PORTAL - SYSTEM VERIFICATION
echo ========================================
echo.

cd /d "%~dp0"

REM ============================================================
REM 1. SOFTWARE CHECKS
REM ============================================================

echo [1] SOFTWARE INSTALLATIONS
echo -----------------------------
echo.

echo Python:
python --version 2>nul
if %ERRORLEVEL% NEQ 0 echo    ERROR: Not found

echo.
echo Node.js:
node --version 2>nul
if %ERRORLEVEL% NEQ 0 echo    ERROR: Not found

echo.
echo npm:
npm --version 2>nul
if %ERRORLEVEL% NEQ 0 echo    ERROR: Not found

echo.
echo ngrok:
ngrok version 2>nul
if %ERRORLEVEL% NEQ 0 echo    WARNING: Not found

REM ============================================================
REM 2. PROJECT STRUCTURE
REM ============================================================

echo.
echo [2] PROJECT STRUCTURE
echo -----------------------------
echo.

echo backend:             
if exist "backend" (echo    OK) else (echo    ERROR: Missing)

echo frontend:            
if exist "frontend" (echo    OK) else (echo    ERROR: Missing)

echo backend\venv:        
if exist "backend\venv" (echo    OK) else (echo    ERROR: Missing)

echo frontend\node_modules:
if exist "frontend\node_modules" (echo    OK) else (echo    ERROR: Missing)

echo frontend\dist:       
if exist "frontend\dist" (echo    OK) else (echo    WARNING: Missing - run: cd frontend && npm run build)

REM ============================================================
REM 3. SERVICES
REM ============================================================

echo.
echo [3] NETWORK ^& SERVICES
echo -----------------------------
echo.

echo Backend (5002):
netstat -ano | findstr :5002 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    OK: Running
) else (
    echo    ERROR: Not running
    echo    Run: start_backend.bat
)

echo.
echo ngrok (4040):
netstat -ano | findstr :4040 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    OK: Running
    echo.
    echo    Getting public URL...
    curl -s http://localhost:4040/api/tunnels 2>nul | findstr "public_url"
) else (
    echo    ERROR: Not running
    echo    Run: ngrok http 5002
)

REM ============================================================
REM 4. DATA ACCESS
REM ============================================================

echo.
echo [4] DATA ACCESS
echo -----------------------------
echo.

set GDRIVE_PATH=G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions

echo G: Drive Access:
if exist "%GDRIVE_PATH%" (
    echo    OK: Accessible
    echo.
    echo    Latest folders:
    dir /b /o-n "%GDRIVE_PATH%" | findstr /r "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]" | more +0
) else (
    echo    ERROR: Not accessible
    echo    Path: %GDRIVE_PATH%
)

REM ============================================================
REM 5. CONFIGURATION FILES
REM ============================================================

echo.
echo [5] CONFIGURATION FILES
echo -----------------------------
echo.

echo backend\.env:              
if exist "backend\.env" (echo    OK) else (echo    ERROR: Missing)

echo backend\requirements.txt:  
if exist "backend\requirements.txt" (echo    OK) else (echo    ERROR: Missing)

echo frontend\package.json:     
if exist "frontend\package.json" (echo    OK) else (echo    ERROR: Missing)

echo start_backend.bat:         
if exist "start_backend.bat" (echo    OK) else (echo    ERROR: Missing)

REM ============================================================
REM SUMMARY
REM ============================================================

echo.
echo ========================================
echo   VERIFICATION COMPLETE
echo ========================================
echo.

echo Quick Actions:
echo  - Start backend:  start_backend.bat
echo  - Start ngrok:    ngrok http 5002
echo  - Start both:     START_EVERYTHING.bat
echo  - Run setup:      SETUP_24_7_PC.bat
echo.

pause

