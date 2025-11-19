@echo off
REM Stop backend and ngrok

echo Stopping services...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul

echo Done.
pause

