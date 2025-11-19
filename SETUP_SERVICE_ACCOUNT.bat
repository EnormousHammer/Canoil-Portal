@echo off
REM ================================================================
REM SETUP GOOGLE DRIVE SERVICE ACCOUNT FOR CLOUD RUN
REM ================================================================

echo.
echo ================================================================
echo   SETUP GOOGLE DRIVE SERVICE ACCOUNT
echo ================================================================
echo.
echo This script will create a service account for Google Drive access.
echo.

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

REM ================================================================
REM STEP 1: CREATE SERVICE ACCOUNT
REM ================================================================
echo.
echo [STEP 1/4] Creating service account...
echo.

gcloud iam service-accounts create canoil-backend ^
    --display-name="Canoil Backend Service" ^
    --project=dulcet-order-474521-q1

if errorlevel 1 (
    echo.
    echo ⚠️  Service account might already exist - continuing...
    echo.
)

echo.
echo ✅ Service account created or already exists
pause

REM ================================================================
REM STEP 2: CREATE SERVICE ACCOUNT KEY
REM ================================================================
echo.
echo [STEP 2/4] Creating service account key...
echo.

gcloud iam service-accounts keys create service-account-key.json ^
    --iam-account=canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com ^
    --project=dulcet-order-474521-q1

if errorlevel 1 (
    echo ❌ Failed to create service account key!
    pause
    exit /b 1
)

echo.
echo ✅ Service account key created: service-account-key.json
pause

REM ================================================================
REM STEP 3: GET SERVICE ACCOUNT EMAIL
REM ================================================================
echo.
echo [STEP 3/4] Service account email:
echo.
echo    canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com
echo.
echo ================================================================
echo   IMPORTANT - MANUAL STEP REQUIRED!
echo ================================================================
echo.
echo You MUST share your Google Drives with this service account:
echo.
echo 1. Go to Google Drive (drive.google.com)
echo.
echo 2. Find "IT_Automation" shared drive
echo    - Right-click → "Share"
echo    - Add email: canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com
echo    - Set permission: "Viewer" or "Editor"
echo    - Click "Send"
echo.
echo 3. Find "Sales_CSR" shared drive
echo    - Right-click → "Share"
echo    - Add email: canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com
echo    - Set permission: "Viewer" or "Editor"
echo    - Click "Send"
echo.
echo ================================================================
echo.
pause

REM ================================================================
REM STEP 4: UPLOAD SECRET TO GOOGLE CLOUD
REM ================================================================
echo.
echo [STEP 4/4] Uploading service account key as secret...
echo.

REM Create secret
gcloud secrets create google-drive-credentials ^
    --data-file=service-account-key.json ^
    --project=dulcet-order-474521-q1

if errorlevel 1 (
    echo.
    echo ⚠️  Secret might already exist, trying to update it...
    gcloud secrets versions add google-drive-credentials ^
        --data-file=service-account-key.json ^
        --project=dulcet-order-474521-q1
)

echo.
echo ✅ Secret created/updated in Google Cloud Secret Manager
echo.
pause

REM Grant Cloud Run access to secret
echo.
echo Granting Cloud Run access to secret...
echo.

REM Get project number
for /f "tokens=*" %%i in ('gcloud projects describe dulcet-order-474521-q1 --format="value(projectNumber)"') do set PROJECT_NUMBER=%%i

gcloud secrets add-iam-policy-binding google-drive-credentials ^
    --member="serviceAccount:%PROJECT_NUMBER%-compute@developer.gserviceaccount.com" ^
    --role="roles/secretmanager.secretAccessor" ^
    --project=dulcet-order-474521-q1

echo.
echo ✅ Secret access granted to Cloud Run
echo.

echo.
echo ================================================================
echo   SERVICE ACCOUNT SETUP COMPLETE! ✅
echo ================================================================
echo.
echo Next steps:
echo.
echo 1. Make sure you shared both Google Drives with the service account
echo    Email: canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com
echo.
echo 2. Run: DEPLOY_TO_CLOUD_RUN.bat
echo.
echo ================================================================
pause


