@echo off
REM ================================================================
REM DEPLOY CANOIL BACKEND TO GOOGLE CLOUD RUN
REM Project ID: dulcet-order-474521-q1
REM ================================================================

echo.
echo ================================================================
echo   CANOIL BACKEND - CLOUD RUN DEPLOYMENT
echo ================================================================
echo.
echo Project ID: dulcet-order-474521-q1
echo Region: us-central1
echo.

REM Navigate to project root
cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

REM ================================================================
REM STEP 1: VERIFY PREREQUISITES
REM ================================================================
echo.
echo [STEP 1/7] Checking prerequisites...
echo.

REM Check gcloud
gcloud --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Google Cloud CLI not found!
    echo Please install from: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)
echo ✅ Google Cloud CLI installed

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker not found!
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo ✅ Docker installed

REM Check if Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo ✅ Docker is running

echo.
echo ✅ All prerequisites met!
pause

REM ================================================================
REM STEP 2: ENABLE REQUIRED APIS
REM ================================================================
echo.
echo [STEP 2/7] Enabling required Google Cloud APIs...
echo.

gcloud services enable run.googleapis.com --project=dulcet-order-474521-q1
gcloud services enable containerregistry.googleapis.com --project=dulcet-order-474521-q1
gcloud services enable drive.googleapis.com --project=dulcet-order-474521-q1
gcloud services enable secretmanager.googleapis.com --project=dulcet-order-474521-q1

if errorlevel 1 (
    echo ❌ Failed to enable APIs!
    pause
    exit /b 1
)

echo.
echo ✅ All APIs enabled!
pause

REM ================================================================
REM STEP 3: AUTHENTICATE DOCKER
REM ================================================================
echo.
echo [STEP 3/7] Authenticating Docker with Google Cloud...
echo.

gcloud auth configure-docker --quiet

if errorlevel 1 (
    echo ❌ Docker authentication failed!
    pause
    exit /b 1
)

echo.
echo ✅ Docker authenticated!
pause

REM ================================================================
REM STEP 4: BUILD DOCKER IMAGE
REM ================================================================
echo.
echo [STEP 4/7] Building Docker image...
echo.
echo This may take 5-10 minutes...
echo.

docker build -t gcr.io/dulcet-order-474521-q1/canoil-backend ./backend

if errorlevel 1 (
    echo ❌ Docker build failed!
    pause
    exit /b 1
)

echo.
echo ✅ Docker image built successfully!
pause

REM ================================================================
REM STEP 5: PUSH IMAGE TO GOOGLE CONTAINER REGISTRY
REM ================================================================
echo.
echo [STEP 5/7] Pushing image to Google Container Registry...
echo.
echo This may take 5-10 minutes...
echo.

docker push gcr.io/dulcet-order-474521-q1/canoil-backend

if errorlevel 1 (
    echo ❌ Docker push failed!
    pause
    exit /b 1
)

echo.
echo ✅ Image pushed successfully!
pause

REM ================================================================
REM STEP 6: DEPLOY TO CLOUD RUN
REM ================================================================
echo.
echo [STEP 6/7] Deploying to Cloud Run...
echo.

gcloud run deploy canoil-backend ^
  --image gcr.io/dulcet-order-474521-q1/canoil-backend ^
  --platform managed ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --memory 2Gi ^
  --cpu 2 ^
  --timeout 300 ^
  --min-instances 1 ^
  --max-instances 10 ^
  --set-env-vars "OPENAI_API_KEY=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" ^
  --set-env-vars "USE_GOOGLE_DRIVE_API=true" ^
  --set-env-vars "GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation" ^
  --set-env-vars "GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions" ^
  --set-env-vars "GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders" ^
  --set-env-vars "FLASK_ENV=production" ^
  --set-env-vars "PORT=8080" ^
  --update-secrets="GOOGLE_DRIVE_SA_JSON=google-drive-credentials:latest" ^
  --project=dulcet-order-474521-q1

if errorlevel 1 (
    echo ❌ Cloud Run deployment failed!
    pause
    exit /b 1
)

echo.
echo ✅ Deployed to Cloud Run successfully!
pause

REM ================================================================
REM STEP 7: GET SERVICE URL
REM ================================================================
echo.
echo [STEP 7/7] Getting service URL...
echo.

gcloud run services describe canoil-backend ^
  --region=us-central1 ^
  --format="value(status.url)" ^
  --project=dulcet-order-474521-q1

echo.
echo.
echo ================================================================
echo   DEPLOYMENT COMPLETE! 🎉
echo ================================================================
echo.
echo Your backend is now running on Google Cloud Run!
echo.
echo Copy the URL above and set it as VITE_API_URL in Vercel
echo.
echo Next steps:
echo 1. Copy the URL shown above
echo 2. Go to Vercel dashboard
echo 3. Update environment variable: VITE_API_URL=[paste URL]
echo 4. Redeploy your Vercel frontend
echo.
echo ================================================================
pause

