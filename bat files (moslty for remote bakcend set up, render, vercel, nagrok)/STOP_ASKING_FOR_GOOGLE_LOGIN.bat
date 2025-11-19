@echo off
REM Fix: Stop constantly asking for Google Drive login

echo ========================================
echo   FIX GOOGLE DRIVE LOGIN PERSISTENCE
echo ========================================
echo.

cd /d "%~dp0"

echo Checking token file location...
echo.

REM Check if token exists
if exist "backend\google_drive_token.pickle" (
    echo ✅ Token file exists: backend\google_drive_token.pickle
    echo    Token should persist across restarts
    echo.
    echo If you're still being asked to login:
    echo    1. Token might be expired - login once more
    echo    2. It will save and stop asking after that
) else (
    echo ❌ Token file missing: backend\google_drive_token.pickle
    echo.
    echo This is normal for first-time setup.
    echo After you login once, token will be saved here.
    echo.
    echo Steps to fix permanently:
    echo    1. Run the backend: LAUNCH_BACKEND_24_7.bat
    echo    2. When browser opens asking for login - login ONCE
    echo    3. Token will be saved and you won't be asked again
)

echo.
echo ========================================
echo   TOKEN PERSISTENCE CHECK
echo ========================================
echo.

REM Check backend directory
cd backend
echo Current directory: %CD%
echo Token file should be at: %CD%\google_drive_token.pickle
echo.

REM Check if we can write to this directory
echo Test File > test_write.txt 2>nul
if exist test_write.txt (
    echo ✅ Write permissions: OK
    del test_write.txt
) else (
    echo ❌ Write permissions: FAILED
    echo    Backend cannot save token file!
    echo    Run as Administrator or check folder permissions
)

cd ..

echo.
echo ========================================
echo   SOLUTION
echo ========================================
echo.
echo 1. Make sure backend is running from correct directory
echo 2. Login to Google Drive ONCE when prompted
echo 3. Token will be saved and persist
echo 4. You won't be asked again unless token expires (60 days)
echo.
pause

