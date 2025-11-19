@echo off
REM ============================================================
REM  FIXED SETUP - HANDLES VENV PROPERLY
REM ============================================================

setlocal enabledelayedexpansion

cd /d "%~dp0"

set LOGFILE=setup_log.txt
echo Setup started at %date% %time% > %LOGFILE%

echo.
echo ========================================
echo   CANOIL PORTAL - FIXED SETUP
echo ========================================
echo.

REM ============================================================
REM CHECK PYTHON
REM ============================================================

echo [1/6] Checking Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found!
    pause
    exit /b 1
)
python --version
echo    OK

REM ============================================================
REM CHECK NODE.JS
REM ============================================================

echo.
echo [2/6] Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found!
    pause
    exit /b 1
)
node --version
echo    OK

REM ============================================================
REM INSTALL PYTHON PACKAGES - FIXED
REM ============================================================

echo.
echo [3/6] Installing Python packages...
echo This may take a minute...

REM Check if venv exists, create if needed
if not exist "backend\venv\Scripts\python.exe" (
    echo    Creating virtual environment...
    cd backend
    python -m venv venv
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to create venv
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo    OK: venv created
)

REM Install packages using venv's pip directly (no activation needed)
echo    Installing packages with venv pip...
backend\venv\Scripts\python.exe -m pip install --upgrade pip >> %LOGFILE% 2>&1
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt >> %LOGFILE% 2>&1

if %ERRORLEVEL% EQU 0 (
    echo    OK: Python packages installed
) else (
    echo    WARNING: Some packages may have failed
    echo    Check setup_log.txt for details
)

REM ============================================================
REM INSTALL NPM PACKAGES
REM ============================================================

echo.
echo [4/6] Installing npm packages...
echo This may take 2-3 minutes...

cd frontend

npm install >> ..\%LOGFILE% 2>&1

if %ERRORLEVEL% EQU 0 (
    echo    OK: npm packages installed
) else (
    echo    ERROR: npm install failed
    cd ..
    type %LOGFILE%
    pause
    exit /b 1
)

cd ..

REM ============================================================
REM BUILD FRONTEND
REM ============================================================

echo.
echo [5/6] Building frontend...
echo This may take 1-2 minutes...

cd frontend
npm run build >> ..\%LOGFILE% 2>&1

if %ERRORLEVEL% EQU 0 (
    echo    OK: Frontend built successfully
) else (
    echo    ERROR: Build failed
    cd ..
    type %LOGFILE%
    pause
    exit /b 1
)

cd ..

REM ============================================================
REM CREATE ENV FILE
REM ============================================================

echo.
echo [6/6] Creating environment file...

if exist "backend\.env" (
    echo    OK: .env already exists
) else (
    (
        echo # OpenAI API Key
        echo OPENAI_API_KEY=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
        echo.
        echo # Flask Settings
        echo FLASK_ENV=production
    ) > backend\.env
    echo    OK: .env created
)

REM ============================================================
REM DONE
REM ============================================================

echo.
echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.

echo All steps completed!
echo.
echo Next: Run START_EVERYTHING.bat
echo.
echo Log saved to: %LOGFILE%
echo.

pause

