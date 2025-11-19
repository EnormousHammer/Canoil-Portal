@echo off
REM Fix Sales Orders showing 0 - Force backend reload

echo ========================================
echo   FIXING SALES ORDERS - ONE CLICK FIX
echo ========================================
echo.

cd /d "%~dp0"

REM Step 1: Stop backend
echo [1/3] Stopping backend...
netstat -ano | findstr :5002 >nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5002') do taskkill /F /PID %%a >nul 2>&1
    echo    Backend stopped
    timeout /t 2 >nul
) else (
    echo    No backend running
)

REM Step 2: Rebuild frontend
echo.
echo [2/3] Rebuilding frontend...
cd frontend
call npm run build
cd ..
echo    Frontend rebuilt

REM Step 3: Restart backend
echo.
echo [3/3] Starting backend...
start "Canoil Backend - FIXED" cmd /k "cd /d "%~dp0" && .\start_backend.bat"
echo    Backend starting in new window

timeout /t 3 >nul

echo.
echo ========================================
echo   DONE!
echo ========================================
echo.
echo Backend restarted - will now scan Sales Orders fresh
echo Refresh your browser to see the fix
echo.
pause

