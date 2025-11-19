@echo off
REM ============================================================
REM  START EVERYTHING - ONE CLICK STARTUP FOR 24/7 PC
REM ============================================================
REM  This starts backend and ngrok in separate windows
REM ============================================================

echo.
echo ============================================================
echo   CANOIL PORTAL - STARTING ALL SERVICES
echo ============================================================
echo.

cd /d "%~dp0"

REM Check if backend is already running
echo [1/3] Checking existing services...
netstat -ano | findstr :5002 >nul
if %ERRORLEVEL% EQU 0 (
    echo    WARNING: Backend already running on port 5002
    echo    Kill it first? (y/n)
    set /p kill=
    if /i "%kill%"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5002') do taskkill /F /PID %%a >nul 2>&1
        echo    Stopped existing backend
        timeout /t 2 >nul
    )
)

REM Start backend in new window
echo.
echo [2/3] Starting Flask backend...
start "Canoil Backend" cmd /k "cd /d "%~dp0" && .\start_backend.bat"
echo    ✓ Backend starting in new window

REM Wait for backend to start
echo    Waiting for backend to initialize...
timeout /t 5 >nul

REM Check if ngrok is already running
netstat -ano | findstr :4040 >nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [3/3] ngrok already running
    echo    ✓ ngrok tunnel active
) else (
    echo.
    echo [3/3] Starting ngrok tunnel...
    start "Canoil Ngrok" cmd /k "ngrok http 5002"
    echo    ✓ ngrok starting in new window
    
    echo.
    echo    Waiting for ngrok to connect...
    timeout /t 5 >nul
)

REM Get ngrok URL
echo.
echo ============================================================
echo   SERVICES STARTED!
echo ============================================================
echo.

REM Try to get ngrok URL
for /f "delims=" %%i in ('curl -s http://localhost:4040/api/tunnels ^| findstr "public_url"') do (
    echo %%i | findstr /r "https://.*\.ngrok" >nul
    if !ERRORLEVEL! EQU 0 (
        for /f "tokens=2 delims=:" %%a in ("%%i") do (
            set ngrokurl=%%a
            set ngrokurl=!ngrokurl:~1,-2!
            echo   Ngrok URL: https:!ngrokurl!
        )
    )
)

echo.
echo   Backend:  http://localhost:5002
echo   Ngrok UI: http://localhost:4040
echo.
echo ============================================================
echo.
echo Press any key to open ngrok UI in browser...
pause >nul

start http://localhost:4040

echo.
echo Services are running! Keep these windows open.
echo Close this window when you're done.
echo.
pause

