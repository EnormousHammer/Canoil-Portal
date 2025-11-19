@echo off
REM ============================================================
REM QUICK START - FIXED VERSION
REM ============================================================
REM This script starts the Canoil Portal with all fixes applied

cd /d "%~dp0"

echo.
echo ============================================================
echo   CANOIL PORTAL - QUICK START (FIXED)
echo ============================================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file...
    (
        echo # CANOIL PORTAL ENVIRONMENT
        echo OPENAI_API_KEY=
        echo USE_GOOGLE_DRIVE_API=false
        echo PORT=5002
        echo FLASK_ENV=development
        echo DEBUG_SO=1
    ) > .env
    echo .env file created!
    echo.
)

REM Kill any existing backend
echo Checking for existing backend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5002') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting backend...
start "Canoil Backend" cmd /k "cd /d "%~dp0\backend" && python start_server.py"

timeout /t 8 >nul

echo.
echo Testing backend...
curl http://localhost:5002/api/health

echo.
echo ============================================================
echo   READY!
echo ============================================================
echo.
echo Backend: http://localhost:5002
echo.
echo Open http://localhost:5002 in your browser
echo.
pause

