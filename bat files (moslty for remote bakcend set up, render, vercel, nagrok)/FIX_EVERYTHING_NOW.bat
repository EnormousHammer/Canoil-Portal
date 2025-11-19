@echo off
REM ============================================================
REM  FIX EVERYTHING - RESTORE WORKING STATE
REM ============================================================

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

echo Killing everything...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 >nul

echo Deleting corrupted .env...
if exist "backend\.env" del /f /q "backend\.env"

echo Creating clean .env...
cd backend
(
echo OPENAI_API_KEY=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
) > .env

echo Starting backend...
cd ..
start "Backend" cmd /k "cd backend && python app.py"

timeout /t 10 >nul

echo Starting ngrok...
start "Ngrok" cmd /k "ngrok http --url=canoil-portal.ngrok.app 5002"

timeout /t 3 >nul

echo.
echo DONE - Check https://canoil-portal.ngrok.app/api/health
pause

