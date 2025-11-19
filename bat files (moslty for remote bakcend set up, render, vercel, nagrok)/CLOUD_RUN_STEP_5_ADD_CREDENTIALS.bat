@echo off
REM ============================================================
REM  STEP 5: Add Google Drive Credentials to Cloud Run
REM ============================================================

echo.
echo ========================================
echo   STEP 5: Add Google Drive Credentials
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

echo [1/4] Service account key found
echo.

REM Create secret in Secret Manager
echo [2/4] Creating secret in Secret Manager...
gcloud secrets create google-drive-credentials --data-file=service-account-key.json --project=%PROJECT_ID% 2>nul

if %ERRORLEVEL% EQU 0 (
    echo Secret created!
) else (
    echo Secret already exists, updating...
    gcloud secrets versions add google-drive-credentials --data-file=service-account-key.json --project=%PROJECT_ID%
)

echo.
echo [3/4] Granting Cloud Run access to secret...

REM Get project number
for /f "tokens=1" %%i in ('gcloud projects describe %PROJECT_ID% --format^="value(projectNumber)" 2^>nul') do set PROJECT_NUMBER=%%i

gcloud secrets add-iam-policy-binding google-drive-credentials --member=serviceAccount:%PROJECT_NUMBER%-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor --project=%PROJECT_ID%

echo.
echo [4/4] Updating Cloud Run service to use credentials...

gcloud run services update canoil-backend --update-secrets=GOOGLE_DRIVE_CREDENTIALS=google-drive-credentials:latest --region us-central1 --project=%PROJECT_ID%

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to update Cloud Run service!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Credentials Added!
echo ========================================
echo.

REM Get service URL
for /f "delims=" %%i in ('gcloud run services describe canoil-backend --platform managed --region us-central1 --format "value(status.url)" --project^=%PROJECT_ID% 2^>nul') do set SERVICE_URL=%%i

echo Backend URL: %SERVICE_URL%
echo.
echo Test it: %SERVICE_URL%/api/health
echo.

start %SERVICE_URL%/api/health

echo.
echo ========================================
echo   ALL DONE!
echo ========================================
echo.
echo Your backend is now running on Google Cloud Run!
echo.
echo Update Vercel with this URL: %SERVICE_URL%
echo.
pause

