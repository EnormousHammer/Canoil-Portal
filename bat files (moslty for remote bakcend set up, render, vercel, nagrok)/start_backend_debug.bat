@echo off
echo ========================================
echo BACKEND STARTUP - DEBUG MODE
echo ========================================
echo.

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"

echo [1] Setting environment variables...
set USE_GOOGLE_DRIVE_API=false
set OPENAI_API_KEY=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
echo     Done

echo.
echo [2] Checking Python...
python --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found!
    pause
    exit /b 1
)
echo     OK

echo.
echo [3] Checking if port 5002 is available...
netstat -ano | findstr :5002
if %ERRORLEVEL% EQU 0 (
    echo WARNING: Port 5002 already in use!
    echo Killing process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5002') do taskkill /F /PID %%a 2>nul
    timeout /t 2 >nul
)
echo     OK

echo.
echo [4] Starting Python app with verbose output...
echo ========================================
echo.

python -u app.py

echo.
echo ========================================
echo Backend stopped or crashed
echo ========================================
pause

