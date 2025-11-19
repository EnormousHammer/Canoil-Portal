@echo off
REM ============================================================
REM  STEP 2: Authenticate Google Cloud
REM ============================================================

echo.
echo ========================================
echo   STEP 2: Authenticate Google Cloud
echo ========================================
echo.

cd /d "%~dp0"

REM Check gcloud is installed
gcloud --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Google Cloud CLI not found!
    echo Please run: CLOUD_RUN_STEP_1_INSTALL.bat first
    pause
    exit /b 1
)

echo Google Cloud CLI found!
echo.

REM Initialize gcloud
echo Initializing Google Cloud...
echo.
echo This will:
echo 1. Open browser for login
echo 2. Ask you to select/create a project
echo 3. Set default region
echo.
pause

gcloud init

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Authentication failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Authentication Complete!
echo ========================================
echo.

REM Show current config
echo Your configuration:
gcloud config list

echo.
echo ========================================
echo   NEXT: Run CLOUD_RUN_STEP_3_SETUP.bat
echo ========================================
echo.
pause

