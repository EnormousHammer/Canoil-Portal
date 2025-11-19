@echo off
REM ============================================================
REM  NGROK BACKEND WITH VISIBLE LOGS
REM ============================================================

cd /d "%~dp0"

echo Stopping old processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 >nul

echo.
echo Starting ngrok in background...
start "Ngrok" cmd /k "ngrok http --url=canoil-portal.ngrok.app 5002"

timeout /t 3 >nul

echo.
echo ========================================
echo   BACKEND STARTING - LOGS BELOW
echo ========================================
echo.
echo Backend: http://localhost:5002
echo Public: https://canoil-portal.ngrok.app
echo ngrok Dashboard: http://localhost:4040
echo.
echo ========================================
echo.

REM Start backend in THIS window so you can see logs
cd backend
set USE_GOOGLE_DRIVE_API=false
set OPENAI_API_KEY=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
python app.py

