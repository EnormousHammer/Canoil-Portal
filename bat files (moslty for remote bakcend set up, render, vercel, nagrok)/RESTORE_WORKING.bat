@echo off
REM ============================================================
REM  RESTORE TO WORKING STATE - UNDO ALL MY CHANGES
REM ============================================================

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

echo Killing everything...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 >nul

echo Deleting corrupted .env...
if exist "backend\.env" del /f /q "backend\.env"

echo Creating MINIMAL .env (just API key)...
cd backend
echo OPENAI_API_KEY=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 > .env
cd ..

echo.
echo Starting backend (original way - NO modifications)...
start "Backend" cmd /k "cd backend && python app.py"

echo Waiting 10 seconds for backend to start...
timeout /t 10 >nul

echo Starting ngrok...
start "Ngrok" cmd /k "ngrok http --url=canoil-portal.ngrok.app 5002"

echo.
echo ========================================
echo DONE - RESTORED TO ORIGINAL STATE
echo ========================================
echo.
echo Test: https://canoil-portal.ngrok.app/api/health
echo.
pause

