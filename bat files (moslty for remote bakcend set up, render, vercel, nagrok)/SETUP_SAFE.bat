@echo off
REM ============================================================
REM  SAFE SETUP - WITH LOGGING AND PAUSES
REM ============================================================

setlocal enabledelayedexpansion

cd /d "%~dp0"

REM Create log file
set LOGFILE=setup_log.txt
echo Setup started at %date% %time% > %LOGFILE%
echo. >> %LOGFILE%

echo.
echo ========================================
echo   CANOIL PORTAL - SAFE SETUP
echo ========================================
echo.
echo Logging to: %LOGFILE%
echo.

REM ============================================================
REM CHECK PYTHON
REM ============================================================

echo [1/6] Checking Python...
echo [1/6] Checking Python... >> %LOGFILE%

python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python --version
    python --version >> %LOGFILE%
    echo    OK: Python found
    echo    OK: Python found >> %LOGFILE%
) else (
    echo    ERROR: Python not found!
    echo    ERROR: Python not found! >> %LOGFILE%
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH"!
    pause
    exit /b 1
)

REM ============================================================
REM CHECK NODE.JS
REM ============================================================

echo.
echo [2/6] Checking Node.js...
echo [2/6] Checking Node.js... >> %LOGFILE%

node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node --version
    node --version >> %LOGFILE%
    echo    OK: Node.js found
    echo    OK: Node.js found >> %LOGFILE%
) else (
    echo    ERROR: Node.js not found!
    echo    ERROR: Node.js not found! >> %LOGFILE%
    echo.
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM ============================================================
REM INSTALL PYTHON PACKAGES
REM ============================================================

echo.
echo [3/6] Installing Python packages...
echo [3/6] Installing Python packages... >> %LOGFILE%
echo This may take a minute...

if not exist "backend\venv" (
    echo    Creating virtual environment...
    echo    Creating virtual environment... >> %LOGFILE%
    cd backend
    python -m venv venv >> ..\%LOGFILE% 2>&1
    cd ..
)

echo    Activating venv and installing packages...
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt >> %LOGFILE% 2>&1

if %ERRORLEVEL% EQU 0 (
    echo    OK: Python packages installed
    echo    OK: Python packages installed >> %LOGFILE%
) else (
    echo    WARNING: Some Python packages may have failed
    echo    WARNING: Some Python packages may have failed >> %LOGFILE%
    echo    Check %LOGFILE% for details
)

REM ============================================================
REM INSTALL NPM PACKAGES
REM ============================================================

echo.
echo [4/6] Installing npm packages...
echo [4/6] Installing npm packages... >> %LOGFILE%
echo This may take 2-3 minutes...

cd frontend

if not exist "node_modules" (
    echo    First install - this will take longer...
)

npm install >> ..\%LOGFILE% 2>&1

if %ERRORLEVEL% EQU 0 (
    echo    OK: npm packages installed
    echo    OK: npm packages installed >> ..\%LOGFILE%
) else (
    echo    ERROR: npm install failed
    echo    ERROR: npm install failed >> ..\%LOGFILE%
    cd ..
    echo.
    echo Check %LOGFILE% for details
    pause
    exit /b 1
)

cd ..

REM ============================================================
REM BUILD FRONTEND
REM ============================================================

echo.
echo [5/6] Building frontend...
echo [5/6] Building frontend... >> %LOGFILE%
echo This may take 1-2 minutes...

cd frontend
npm run build >> ..\%LOGFILE% 2>&1

if %ERRORLEVEL% EQU 0 (
    echo    OK: Frontend built successfully
    echo    OK: Frontend built successfully >> ..\%LOGFILE%
    
    if exist "dist" (
        echo    OK: dist folder created
        echo    OK: dist folder created >> ..\%LOGFILE%
    )
) else (
    echo    ERROR: Build failed
    echo    ERROR: Build failed >> ..\%LOGFILE%
    cd ..
    echo.
    echo Check %LOGFILE% for details
    pause
    exit /b 1
)

cd ..

REM ============================================================
REM CREATE ENV FILE
REM ============================================================

echo.
echo [6/6] Creating environment file...
echo [6/6] Creating environment file... >> %LOGFILE%

if exist "backend\.env" (
    echo    OK: .env file already exists
    echo    OK: .env file already exists >> %LOGFILE%
) else (
    echo    Creating .env file...
    (
        echo # OpenAI API Key
        echo OPENAI_API_KEY=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
        echo.
        echo # Flask Settings
        echo FLASK_ENV=production
    ) > backend\.env
    echo    OK: .env file created
    echo    OK: .env file created >> %LOGFILE%
)

REM ============================================================
REM DONE
REM ============================================================

echo.
echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.
echo Setup completed at %date% %time% >> %LOGFILE%

echo All steps completed successfully!
echo.
echo Next steps:
echo 1. Run: START_EVERYTHING.bat
echo 2. Access via ngrok URL
echo.
echo Full log saved to: %LOGFILE%
echo.

pause

