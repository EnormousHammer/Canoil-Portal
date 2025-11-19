@echo off
REM ============================================================
REM  FIX .ENV FILE AND RESTART BACKEND
REM ============================================================

cd /d "%~dp0"

echo.
echo ========================================
echo   FIXING .ENV FILE
echo ========================================
echo.

REM Delete corrupted .env
if exist "backend\.env" (
    del "backend\.env"
    echo Old .env deleted
)

REM Create fresh .env
(
echo OPENAI_API_KEY=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
echo USE_GOOGLE_DRIVE_API=true
echo FLASK_ENV=production
) > backend\.env

echo.
echo ========================================
echo   .ENV FILE CREATED
echo ========================================
echo.

type backend\.env

echo.
echo ========================================
echo   RESTARTING BACKEND
echo ========================================
echo.

REM Kill old backend
taskkill /F /IM python.exe 2>nul

timeout /t 2 >nul

REM Start backend
start_backend.bat


