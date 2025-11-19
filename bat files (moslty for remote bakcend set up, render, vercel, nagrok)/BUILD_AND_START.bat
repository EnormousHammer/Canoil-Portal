@echo off
REM ============================================================
REM  BUILD FRONTEND AND START EVERYTHING - STAYS OPEN
REM ============================================================

cd /d "%~dp0"

echo.
echo ========================================
echo   BUILDING FRONTEND
echo ========================================
echo.

cd frontend

echo Building... this takes 1-2 minutes...
echo.

call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.

cd ..

echo Checking dist folder...
if exist "frontend\dist" (
    echo OK: frontend\dist exists
) else (
    echo ERROR: frontend\dist still missing!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   STARTING SERVICES
echo ========================================
echo.

echo Starting backend in new window...
start "Canoil Backend" cmd /k "cd /d "%~dp0" && start_backend.bat"

timeout /t 3 >nul

echo Starting ngrok in new window...
start "Canoil Ngrok" cmd /k "ngrok http 5002"

timeout /t 5 >nul

echo.
echo ========================================
echo   DONE!
echo ========================================
echo.

echo Backend: http://localhost:5002
echo Ngrok UI: http://localhost:4040
echo.
echo Press any key to open ngrok dashboard...
pause >nul

start http://localhost:4040

echo.
echo All services running!
echo Keep the backend and ngrok windows open.
echo.
pause

