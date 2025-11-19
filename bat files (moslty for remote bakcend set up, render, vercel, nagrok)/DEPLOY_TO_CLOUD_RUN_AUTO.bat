@echo off
REM ============================================================
REM  AUTOMATED CLOUD RUN DEPLOYMENT
REM ============================================================
REM  This runs all steps automatically
REM  Only pauses when manual action is required
REM ============================================================

echo.
echo ========================================
echo   CLOUD RUN AUTO DEPLOYMENT
echo ========================================
echo.
echo This will deploy your backend to Google Cloud Run.
echo.
echo You will need:
echo   - Google account
echo   - Credit card (for Google Cloud - free tier available)
echo   - Docker Desktop installed
echo.
echo Estimated time: 20-30 minutes
echo.
pause

echo.
echo Starting deployment process...
echo.

REM STEP 1: Check gcloud
call CLOUD_RUN_STEP_1_INSTALL.bat
if %ERRORLEVEL% NEQ 0 exit /b 1

REM STEP 2: Authenticate
call CLOUD_RUN_STEP_2_AUTH.bat
if %ERRORLEVEL% NEQ 0 exit /b 1

REM STEP 3: Setup project
call CLOUD_RUN_STEP_3_SETUP.bat
if %ERRORLEVEL% NEQ 0 exit /b 1

REM STEP 4: Deploy
call CLOUD_RUN_STEP_4_DEPLOY.bat
if %ERRORLEVEL% NEQ 0 exit /b 1

REM STEP 5: Add credentials
call CLOUD_RUN_STEP_5_ADD_CREDENTIALS.bat
if %ERRORLEVEL% NEQ 0 exit /b 1

echo.
echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Your backend is live on Google Cloud Run!
echo.
pause

