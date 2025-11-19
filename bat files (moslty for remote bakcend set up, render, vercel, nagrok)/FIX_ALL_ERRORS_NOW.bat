@echo off
REM ============================================================
REM  FIX ALL BACKEND ERRORS - ONE CLICK SOLUTION
REM ============================================================
REM  Fixes:
REM  1. OpenAI library compatibility (proxies error)
REM  2. Google Drive authentication (SSL error)
REM  3. Restarts backend automatically
REM ============================================================

echo.
echo ============================================================
echo   FIXING ALL BACKEND ERRORS
echo ============================================================
echo.

cd /d "%~dp0"

REM ============================================================
REM STEP 1: Kill existing backend
REM ============================================================

echo [1/4] Stopping existing backend...
netstat -ano | findstr :5002 >nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5002') do taskkill /F /PID %%a >nul 2>&1
    echo    Backend stopped
    timeout /t 2 >nul
) else (
    echo    No backend running
)

REM ============================================================
REM STEP 2: Fix OpenAI library
REM ============================================================

echo.
echo [2/4] Fixing OpenAI library compatibility...
cd backend
python -m pip install --upgrade --quiet openai httpx
echo    OpenAI library fixed

REM ============================================================
REM STEP 3: Delete corrupted Google Drive token
REM ============================================================

echo.
echo [3/4] Cleaning Google Drive authentication...
if exist google_drive_token.pickle (
    del google_drive_token.pickle
    echo    Old token deleted
)
if exist token.pickle (
    del token.pickle
)
echo    Google Drive auth cleaned

REM ============================================================
REM STEP 4: Restart backend
REM ============================================================

echo.
echo [4/4] Restarting backend...
cd ..
start "Canoil Backend - FIXED" cmd /k "cd /d "%~dp0" && .\start_backend.bat"
echo    Backend starting in new window

timeout /t 3 >nul

echo.
echo ============================================================
echo   ALL FIXES APPLIED!
echo ============================================================
echo.
echo Backend should now work correctly.
echo Check the backend window for:
echo   - OpenAI client initialized successfully
echo   - Google Drive authentication successful
echo.
echo Try processing an email again!
echo.
pause

