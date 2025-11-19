@echo off
REM Extract tokens for Render.com to fix persistent login issue
echo ================================================================================
echo    RENDER TOKEN SETUP - FIX "LOG IN EVERY TIME" ISSUE
echo ================================================================================
echo.
echo This script will extract your Google Drive and Gmail tokens
echo so you can add them to Render.com environment variables.
echo.
echo IMPORTANT: Make sure you've authenticated at least once locally!
echo            (Run start_backend.bat and authenticate when prompted)
echo.
echo ================================================================================
echo.

cd backend
python extract_tokens_for_render.py

echo.
echo ================================================================================
echo.
echo NEXT STEPS:
echo 1. Copy the GOOGLE_DRIVE_TOKEN value above
echo 2. Copy the GMAIL_TOKEN value above
echo 3. Go to https://dashboard.render.com/
echo 4. Select 'canoil-portal-backend' service
echo 5. Click 'Environment' tab
echo 6. Add both environment variables
echo 7. Click 'Save Changes'
echo.
echo RESULT: You'll NEVER have to log in again on Render/ngrok!
echo.
echo ================================================================================
echo.
pause



