@echo off
REM Check what files are ACTUALLY in Sales Orders folders

echo ========================================
echo   CHECKING ACTUAL FILES IN FOLDERS
echo ========================================
echo.

SET SO_PATH=G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders

echo Checking: New and Revised
echo.
dir "%SO_PATH%\New and Revised" /B 2>nul | findstr /V "desktop.ini"
echo.

echo Checking: In Production
echo.
dir "%SO_PATH%\In Production" /B 2>nul | findstr /V "desktop.ini"
echo.

echo Checking: Completed and Closed
echo.
dir "%SO_PATH%\Completed and Closed" /B 2>nul | findstr /V "desktop.ini"
echo.

echo Checking: Cancelled
echo.
dir "%SO_PATH%\Cancelled" /B 2>nul | findstr /V "desktop.ini"
echo.

echo ========================================
echo   CHECKING FILE ATTRIBUTES
echo ========================================
echo.

echo Checking if files are cloud placeholders...
echo.

dir "%SO_PATH%\New and Revised" /A 2>nul | findstr /C:"<CLOUD>"

echo.
echo If files show ^<CLOUD^> attribute, they are NOT downloaded yet.
echo Google Drive Desktop needs to finish downloading them.
echo.

echo To force download:
echo 1. Open Google Drive Desktop
echo 2. Right-click folder: Customer Orders\Sales Orders
echo 3. Select: Make available offline
echo 4. Wait for download to complete
echo.

pause

