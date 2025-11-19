@echo off
REM ============================================================
REM  STEP 3: Enable APIs and Create Service Account
REM ============================================================

echo.
echo ========================================
echo   STEP 3: Setup Google Cloud Project
echo ========================================
echo.

cd /d "%~dp0"

REM Get current project
for /f "tokens=2" %%i in ('gcloud config get-value project 2^>nul') do set PROJECT_ID=%%i

if "%PROJECT_ID%"=="" (
    echo ERROR: No project selected!
    echo Please run: CLOUD_RUN_STEP_2_AUTH.bat first
    pause
    exit /b 1
)

echo Project ID: %PROJECT_ID%
echo.

REM Enable required APIs
echo [1/5] Enabling Cloud Run API...
gcloud services enable run.googleapis.com --project=%PROJECT_ID%

echo [2/5] Enabling Container Registry API...
gcloud services enable containerregistry.googleapis.com --project=%PROJECT_ID%

echo [3/5] Enabling Google Drive API...
gcloud services enable drive.googleapis.com --project=%PROJECT_ID%

echo [4/5] Enabling Secret Manager API...
gcloud services enable secretmanager.googleapis.com --project=%PROJECT_ID%

echo [5/5] Enabling Artifact Registry API...
gcloud services enable artifactregistry.googleapis.com --project=%PROJECT_ID%

echo.
echo ========================================
echo   APIs Enabled!
echo ========================================
echo.

REM Create service account
echo Creating service account for backend...
gcloud iam service-accounts create canoil-backend --display-name="Canoil Backend Service" --project=%PROJECT_ID% 2>nul

if %ERRORLEVEL% EQU 0 (
    echo Service account created!
) else (
    echo Service account already exists
)

echo.
echo Service Account Email:
echo canoil-backend@%PROJECT_ID%.iam.gserviceaccount.com
echo.

echo ========================================
echo   IMPORTANT: Manual Step Required
echo ========================================
echo.
echo You need to give this service account access to your Google Drive:
echo.
echo 1. Go to: https://drive.google.com
echo 2. Right-click "IT_Automation" shared drive
echo 3. Click "Share"
echo 4. Add: canoil-backend@%PROJECT_ID%.iam.gserviceaccount.com
echo 5. Give "Viewer" access
echo 6. Repeat for "Sales_CSR" shared drive
echo.
echo Press any key after you've done this...
pause

echo.
echo ========================================
echo   Creating Service Account Key
echo ========================================
echo.

REM Create key file
gcloud iam service-accounts keys create service-account-key.json --iam-account=canoil-backend@%PROJECT_ID%.iam.gserviceaccount.com --project=%PROJECT_ID%

if %ERRORLEVEL% EQU 0 (
    echo Service account key saved to: service-account-key.json
) else (
    echo ERROR: Failed to create service account key
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo NEXT: Run CLOUD_RUN_STEP_4_DEPLOY.bat
echo.
pause

