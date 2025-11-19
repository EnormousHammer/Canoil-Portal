@echo off
REM ============================================================
REM  STEP 4: Build and Deploy to Cloud Run
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   STEP 4: Deploy to Cloud Run
echo ========================================
echo.

cd /d "%~dp0"

REM Get project ID
for /f "tokens=2" %%i in ('gcloud config get-value project 2^>nul') do set PROJECT_ID=%%i

if "%PROJECT_ID%"=="" (
    echo ERROR: No project selected!
    pause
    exit /b 1
)

echo Project ID: %PROJECT_ID%
echo.

REM Check service account key exists
if not exist "service-account-key.json" (
    echo ERROR: service-account-key.json not found!
    echo Please run: CLOUD_RUN_STEP_3_SETUP.bat first
    pause
    exit /b 1
)

echo [1/6] Service account key found
echo.

REM Check Docker is running
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker not found!
    echo.
    echo Install Docker Desktop:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo [2/6] Docker found
docker --version
echo.

REM Configure Docker for Google Cloud
echo [3/6] Configuring Docker authentication...
gcloud auth configure-docker gcr.io --quiet

echo.
echo [4/6] Building Docker container...
echo This may take 3-5 minutes...
echo.

cd backend
docker build -t gcr.io/%PROJECT_ID%/canoil-backend:latest .

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Docker build failed!
    pause
    exit /b 1
)

echo.
echo [5/6] Pushing container to Google Container Registry...
echo This may take 2-3 minutes...
echo.

docker push gcr.io/%PROJECT_ID%/canoil-backend:latest

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Docker push failed!
    pause
    exit /b 1
)

cd ..

echo.
echo [6/6] Deploying to Cloud Run...
echo This may take 2-3 minutes...
echo.

gcloud run deploy canoil-backend --image gcr.io/%PROJECT_ID%/canoil-backend:latest --platform managed --region us-central1 --allow-unauthenticated --memory 2Gi --cpu 1 --timeout 300 --min-instances 0 --max-instances 10 --set-env-vars "OPENAI_API_KEY=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,USE_GOOGLE_DRIVE_API=true,GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation,GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions,GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders,FLASK_ENV=production" --project=%PROJECT_ID%

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.

REM Get service URL
for /f "delims=" %%i in ('gcloud run services describe canoil-backend --platform managed --region us-central1 --format "value(status.url)" --project^=%PROJECT_ID% 2^>nul') do set SERVICE_URL=%%i

echo.
echo Backend URL: %SERVICE_URL%
echo.
echo Test health: %SERVICE_URL%/api/health
echo.

echo ========================================
echo   NEXT STEPS
echo ========================================
echo.
echo 1. Test backend health (opening in browser...)
timeout /t 2 >nul
start %SERVICE_URL%/api/health

echo.
echo 2. Update Vercel environment variable:
echo    Name: VITE_API_URL
echo    Value: %SERVICE_URL%
echo.
echo 3. Redeploy Vercel frontend
echo.
echo ========================================
echo.

REM Save URL to file
echo %SERVICE_URL% > cloud_run_url.txt
echo Backend URL saved to: cloud_run_url.txt
echo.

pause

