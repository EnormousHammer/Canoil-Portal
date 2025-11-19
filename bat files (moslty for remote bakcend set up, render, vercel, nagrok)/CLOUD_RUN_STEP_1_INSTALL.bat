@echo off
REM ============================================================
REM  STEP 1: Install Google Cloud CLI
REM ============================================================

echo.
echo ========================================
echo   STEP 1: Install Google Cloud CLI
echo ========================================
echo.

REM Check if already installed
gcloud --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Google Cloud CLI is already installed!
    echo.
    gcloud --version
    echo.
    echo ========================================
    echo   NEXT: Run CLOUD_RUN_STEP_2_AUTH.bat
    echo ========================================
    pause
    exit /b 0
)

echo Google Cloud CLI is NOT installed.
echo.
echo Opening download page in browser...
echo.
echo Download and install from:
echo https://cloud.google.com/sdk/docs/install-sdk#windows
echo.
echo IMPORTANT:
echo 1. Run the installer
echo 2. Follow the setup wizard
echo 3. RESTART your terminal after install
echo 4. Run this script again to verify
echo.

start https://cloud.google.com/sdk/docs/install-sdk#windows

pause

