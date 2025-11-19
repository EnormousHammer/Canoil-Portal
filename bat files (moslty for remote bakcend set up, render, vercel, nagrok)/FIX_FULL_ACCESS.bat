@echo off
REM ============================================================
REM  FIX FOR FULL ACCESS - ALL BACKEND DATA VIA NGROK
REM ============================================================

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

echo Killing everything...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 >nul

echo Fixing .env file...
cd backend
if exist .env del /f /q .env

REM Create CLEAN .env with proper encoding - NO null characters
echo OPENAI_API_KEY=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 > .env

cd ..

echo.
echo Starting backend with FULL features...
echo - Sales Orders: YES
echo - Email Processing: YES  
echo - Logistics: YES
echo - All APIs: YES
echo.

start "Backend FULL" cmd /k "cd backend && python app.py"

echo Waiting for backend startup...
timeout /t 10 >nul

echo.
echo Starting ngrok...
start "Ngrok" cmd /k "ngrok http --url=canoil-portal.ngrok.app 5002"

timeout /t 3 >nul

echo.
echo ========================================
echo   FULL ACCESS READY
echo ========================================
echo.
echo Test ALL endpoints via ngrok:
echo - Health:       https://canoil-portal.ngrok.app/api/health
echo - Data:         https://canoil-portal.ngrok.app/api/data
echo - Sales Orders: https://canoil-portal.ngrok.app/api/sales-orders
echo - Logistics:    https://canoil-portal.ngrok.app/api/logistics/process-email
echo.
pause

