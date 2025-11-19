@echo off
REM ============================================================
REM  CREATE .ENV FILE FOR LOCAL DEVELOPMENT
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   CREATING .ENV FILE
echo ============================================================
echo.

if exist ".env" (
    echo .env file already exists!
    echo Do you want to overwrite it? (y/n)
    set /p overwrite=
    if /i not "%overwrite%"=="y" (
        echo Cancelled.
        pause
        exit /b 0
    )
)

echo Creating .env file...

(
echo # CANOIL PORTAL - ENVIRONMENT CONFIGURATION
echo # ============================================================
echo.
echo # OPENAI API KEY ^(REQUIRED for AI features^)
echo OPENAI_API_KEY=
echo.
echo # GOOGLE DRIVE CONFIGURATION
echo # For local Windows PC with G: Drive mounted, use false
echo USE_GOOGLE_DRIVE_API=false
echo.
echo # SERVER CONFIGURATION  
echo PORT=5002
echo FLASK_ENV=development
echo DEBUG_SO=1
echo.
echo # For cloud deployment ^(if USE_GOOGLE_DRIVE_API=true^)
echo GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation
echo GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions
echo GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales Orders
echo GOOGLE_DRIVE_CREDENTIALS=
echo GOOGLE_DRIVE_TOKEN=
) > .env

echo.
echo ============================================================
echo   .ENV FILE CREATED!
echo ============================================================
echo.
echo Location: %CD%\.env
echo.
echo IMPORTANT:
echo 1. Edit .env and add your OPENAI_API_KEY
echo 2. Get key from: https://platform.openai.com/api-keys
echo 3. Save the file after editing
echo.
echo Opening .env in notepad...
timeout /t 2 >nul
notepad .env

echo.
pause

