@echo off
cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

echo Killing old processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul
timeout /t 2 >nul

echo.
echo Starting backend in DEBUG mode...
echo Watch the backend window to see where it gets stuck!
echo.
start "Backend DEBUG" cmd /k "start_backend_debug.bat"

timeout /t 10 >nul

echo.
echo Starting ngrok...
start "Ngrok" cmd /k "ngrok http --url=canoil-portal.ngrok.app 5002"

echo.
echo WATCH THE BACKEND WINDOW - it will show exactly where it stops!
pause

