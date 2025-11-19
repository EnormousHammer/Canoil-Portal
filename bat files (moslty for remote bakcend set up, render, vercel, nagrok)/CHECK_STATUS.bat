@echo off
REM ============================================================
REM  SIMPLE STATUS CHECK - NO CRASHES
REM ============================================================

echo.
echo ========================================
echo   QUICK STATUS CHECK
echo ========================================
echo.

cd /d "%~dp0"

REM ============================================================
REM SOFTWARE
REM ============================================================

echo [SOFTWARE INSTALLED]
echo.

echo Python:
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python --version 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo    OK
    ) else (
        echo    ERROR
    )
) else (
    echo    NOT FOUND
)

echo.
echo Node.js:
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node --version 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo    OK
    ) else (
        echo    ERROR
    )
) else (
    echo    NOT FOUND
)

echo.
echo npm:
where npm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    FOUND
) else (
    echo    NOT FOUND
)

REM ============================================================
REM FOLDERS
REM ============================================================

echo.
echo [PROJECT FOLDERS]
echo.

if exist "backend" (echo backend: OK) else (echo backend: MISSING)
if exist "frontend" (echo frontend: OK) else (echo frontend: MISSING)
if exist "backend\venv" (echo backend\venv: OK) else (echo backend\venv: MISSING)
if exist "frontend\node_modules" (echo frontend\node_modules: OK) else (echo frontend\node_modules: MISSING)
if exist "frontend\dist" (echo frontend\dist: OK) else (echo frontend\dist: MISSING - need to build)
if exist "backend\.env" (echo backend\.env: OK) else (echo backend\.env: MISSING)

REM ============================================================
REM SERVICES
REM ============================================================

echo.
echo [RUNNING SERVICES]
echo.

netstat -ano | findstr :5002 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Backend (5002): RUNNING
) else (
    echo Backend (5002): NOT RUNNING
)

netstat -ano | findstr :4040 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ngrok (4040): RUNNING
) else (
    echo ngrok (4040): NOT RUNNING
)

REM ============================================================
REM NEXT STEPS
REM ============================================================

echo.
echo ========================================
echo   WHAT TO DO NEXT
echo ========================================
echo.

if not exist "frontend\node_modules" (
    echo 1. Need to install: Run SETUP_FIXED.bat
) else if not exist "frontend\dist" (
    echo 1. Need to build: cd frontend ^&^& npm run build
) else (
    echo 1. Setup looks good!
    echo 2. Run: START_EVERYTHING.bat
)

echo.
pause

