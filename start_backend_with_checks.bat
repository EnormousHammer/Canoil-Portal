@echo off
echo ========================================
echo CANOIL PORTAL BACKEND STARTUP
echo ========================================
echo.

REM Change to the backend directory
cd /d "%~dp0\backend"

echo Running preflight system checks...
echo.
python preflight_check.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo All checks passed! Starting backend...
    echo ========================================
    echo.
    cd ..
    start_backend.bat
) else (
    echo.
    echo ========================================
    echo PREFLIGHT CHECK FAILED!
    echo ========================================
    echo.
    echo Please fix the issues above before starting the backend.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

