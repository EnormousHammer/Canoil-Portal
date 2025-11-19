@echo off
REM ================================================================
REM PRE-FLIGHT CHECK FOR CLOUD RUN DEPLOYMENT
REM ================================================================

echo.
echo ================================================================
echo   CLOUD RUN DEPLOYMENT - PRE-FLIGHT CHECK
echo ================================================================
echo.

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

set READY=1

REM Check 1: Google Cloud CLI
echo [CHECK 1/6] Google Cloud CLI...
gcloud --version >nul 2>&1
if errorlevel 1 (
    echo ❌ NOT INSTALLED
    echo    Install from: https://cloud.google.com/sdk/docs/install
    set READY=0
) else (
    echo ✅ INSTALLED
)

REM Check 2: Docker
echo.
echo [CHECK 2/6] Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ NOT INSTALLED
    echo    Install from: https://www.docker.com/products/docker-desktop
    set READY=0
) else (
    echo ✅ INSTALLED
)

REM Check 3: Docker Running
echo.
echo [CHECK 3/6] Docker Running...
docker ps >nul 2>&1
if errorlevel 1 (
    echo ❌ NOT RUNNING
    echo    Please start Docker Desktop
    set READY=0
) else (
    echo ✅ RUNNING
)

REM Check 4: gcloud authenticated
echo.
echo [CHECK 4/6] Google Cloud Authentication...
gcloud auth list --filter=status:ACTIVE --format="value(account)" >nul 2>&1
if errorlevel 1 (
    echo ❌ NOT AUTHENTICATED
    echo    Run: gcloud auth login
    set READY=0
) else (
    echo ✅ AUTHENTICATED
    gcloud auth list --filter=status:ACTIVE --format="value(account)"
)

REM Check 5: Project set
echo.
echo [CHECK 5/6] Google Cloud Project...
gcloud config get-value project >nul 2>&1
if errorlevel 1 (
    echo ❌ NO PROJECT SET
    echo    Run: gcloud config set project dulcet-order-474521-q1
    set READY=0
) else (
    echo ✅ PROJECT SET
    gcloud config get-value project
)

REM Check 6: Required files
echo.
echo [CHECK 6/6] Required Files...
if not exist "backend\Dockerfile" (
    echo ❌ backend\Dockerfile missing
    set READY=0
) else (
    echo ✅ backend\Dockerfile
)

if not exist "backend\app.py" (
    echo ❌ backend\app.py missing
    set READY=0
) else (
    echo ✅ backend\app.py
)

if not exist "backend\requirements.txt" (
    echo ❌ backend\requirements.txt missing
    set READY=0
) else (
    echo ✅ backend\requirements.txt
)

REM Final verdict
echo.
echo ================================================================
if %READY%==1 (
    echo   ✅ ALL CHECKS PASSED - READY TO DEPLOY!
    echo ================================================================
    echo.
    echo Run: DEPLOY_TO_CLOUD_RUN.bat
) else (
    echo   ❌ SOME CHECKS FAILED - FIX ISSUES ABOVE
    echo ================================================================
    echo.
    echo Fix the issues above, then run this script again.
)
echo.
pause


