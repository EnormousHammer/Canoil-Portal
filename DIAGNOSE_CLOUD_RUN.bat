@echo off
REM Quick Cloud Run Diagnostics
echo.
echo ================================================================
echo   CLOUD RUN DIAGNOSTICS
echo ================================================================
echo.

set PROJECT_ID=dulcet-order-474521-q1
set REGION=us-central1
set SERVICE_NAME=canoil-backend

echo [1/3] Getting service URL...
for /f "delims=" %%i in ('gcloud run services describe %SERVICE_NAME% --region=%REGION% --project=%PROJECT_ID% --format="value(status.url)"') do set SERVICE_URL=%%i

if "%SERVICE_URL%"=="" (
    echo ERROR: Could not get service URL
    echo Service may not be deployed yet.
    pause
    exit /b 1
)

echo Service URL: %SERVICE_URL%
echo.

echo [2/3] Checking health endpoint...
curl -s "%SERVICE_URL%/api/health" | jq .
echo.

echo [3/3] Checking recent logs for errors...
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=%SERVICE_NAME% AND severity>=WARNING" --limit=20 --project=%PROJECT_ID% --format="table(timestamp,severity,textPayload)"
echo.

echo ================================================================
echo Complete! Check results above.
echo.
echo Service URL: %SERVICE_URL%
echo.
echo Test data endpoint manually:
echo   curl "%SERVICE_URL%/api/data"
echo ================================================================
pause

