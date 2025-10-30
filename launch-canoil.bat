@echo off
title Canoil Portal Launcher

echo ================================================
echo           CANOIL ENTERPRISE PORTAL
echo ================================================
echo.

echo [1/4] Cleaning up existing processes...
echo Stopping any existing Node.js processes...
taskkill /f /im node.exe >nul 2>&1
echo Stopping any existing Python processes...
taskkill /f /im python.exe >nul 2>&1
echo Stopping any existing npm processes...
taskkill /f /im npm.cmd >nul 2>&1
echo Stopping any processes using ports 5001 and 5002...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5001') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5002') do taskkill /f /pid %%a >nul 2>&1
echo All conflicting processes terminated.
echo.
echo NOTICE: Close any existing browser tabs for localhost:5001 to prevent duplicates
timeout /t 3
echo.

echo [2/4] Starting Flask Backend (G: Drive Data Service)...
start "Canoil Backend - Flask API" cmd /k "cd /d %~dp0backend && echo Starting Flask Backend... && python app.py"
echo Backend service initiated on port 5002
echo Waiting for backend to initialize...
timeout /t 5
echo.

echo [3/4] Starting React Frontend (Manufacturing Portal)...
start "Canoil Frontend - React App" cmd /k "cd /d %~dp0frontend && npm run dev"
echo Frontend service initiated on port 5001
echo.

echo [4/4] Launching Canoil Enterprise Portal...
echo Waiting for services to initialize...
echo ================================================
echo   Please wait while the system loads:
echo   • Flask Backend: Manufacturing data API
echo   • React Frontend: Enterprise dashboard
echo   • G: Drive Integration: Real-time data sync
echo ================================================
timeout /t 18
echo.
echo ================================================
echo           CANOIL PORTAL - READY!
echo ================================================
echo.
echo The portal is now running at: http://localhost:5001
echo.
echo IMPORTANT: To avoid multiple browser windows:
echo • If you already have a browser tab open, just refresh it
echo • Otherwise, manually open: http://localhost:5001
echo.
echo.
echo ================================================
echo   MANUAL BROWSER OPENING - NO AUTO-LAUNCH
echo ================================================
echo.
echo The portal is ready at: http://localhost:5001
echo.
echo Please manually open your browser and navigate to:
echo http://localhost:5001
echo.
echo This prevents any duplicate browser windows.
echo.
REM Commented out auto-browser opening to test
REM start http://localhost:5001
echo.
echo ================================================
echo           CANOIL PORTAL - READY!
echo ================================================
echo Frontend URL: http://localhost:5001
echo Backend API:  http://localhost:5002/api/data
echo.
echo Keep both console windows open for proper operation.
echo Close this window when you're done using the portal.
echo.
pause
