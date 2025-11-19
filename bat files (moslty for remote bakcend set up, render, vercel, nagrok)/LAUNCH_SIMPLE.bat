@echo off
REM ============================================================
REM  SIMPLE LAUNCHER - NO GOOGLE DRIVE API (FASTER STARTUP)
REM ============================================================

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

echo.
echo ========================================
echo   LAUNCHING (SIMPLE MODE)
echo ========================================
echo.

REM Kill existing
echo Stopping old processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 >nul

REM Start backend (simple mode - no Google Drive API)
echo.
echo Starting backend (local G: drive only)...
start "Backend" cmd /k "start_backend_simple.bat"
timeout /t 5 >nul

REM Start ngrok
echo Starting ngrok...
start "Ngrok" cmd /k "ngrok http --url=canoil-portal.ngrok.app 5002"
timeout /t 3 >nul

echo.
echo ========================================
echo   DONE!
echo ========================================
echo.
echo   Public:  https://canoil-portal.ngrok.app
echo   Monitor: http://localhost:4040
echo.

start http://localhost:4040
pause

