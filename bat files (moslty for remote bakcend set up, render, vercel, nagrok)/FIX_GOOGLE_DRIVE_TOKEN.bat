@echo off
REM Fix Google Drive SSL authentication error
REM This fixes: ssl.SSLError: [SSL: WRONG_VERSION_NUMBER]

echo ========================================
echo   FIXING GOOGLE DRIVE AUTHENTICATION
echo ========================================
echo.

cd /d "%~dp0"
cd backend

echo The Google Drive token has expired or is corrupted.
echo.
echo Deleting old token file...
if exist google_drive_token.pickle (
    del google_drive_token.pickle
    echo   Token file deleted
) else (
    echo   No token file found
)

if exist token.pickle (
    del token.pickle
    echo   Old token file deleted
) else (
    echo   No old token found
)

echo.
echo ========================================
echo   FIX COMPLETE!
echo ========================================
echo.
echo Next steps:
echo   1. Restart backend: start_backend.bat
echo   2. Backend will re-authenticate with Google Drive automatically
echo   3. Check backend console for authentication messages
echo.
pause

