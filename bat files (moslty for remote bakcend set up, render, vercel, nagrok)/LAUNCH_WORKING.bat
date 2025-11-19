@echo off
REM ============================================================
REM  WORKING LAUNCHER - LOCAL G DRIVE ONLY
REM ============================================================

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

echo Stopping old processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 >nul

echo.
echo Starting backend...
start "Backend" cmd /k "cd /d "%~dp0backend" && set USE_GOOGLE_DRIVE_API=false && set OPENAI_API_KEY=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 && python app.py"

timeout /t 8 >nul

echo Starting ngrok...
start "Ngrok" cmd /k "ngrok http --url=canoil-portal.ngrok.app 5002"

timeout /t 3 >nul
start http://localhost:4040

echo.
echo DONE! Access at: https://canoil-portal.ngrok.app
pause

