@echo off
echo ====================================
echo CANOIL PORTAL - REQUIREMENTS CHECK
echo ====================================
echo.

echo Checking Node.js installation...
node --version 2>nul
if %errorlevel% equ 0 (
    echo ✅ Node.js is installed
    node --version
) else (
    echo ❌ Node.js is NOT installed
    echo Run INSTALL-NODEJS.bat to install
)
echo.

echo Checking npm installation...
npm --version 2>nul
if %errorlevel% equ 0 (
    echo ✅ npm is installed
    npm --version
) else (
    echo ❌ npm is NOT installed
    echo npm comes with Node.js - reinstall Node.js
)
echo.

echo Checking Python installation...
REM Prefer Python launcher (py) which works even if python.exe is not on PATH
py --version 2>nul
if %errorlevel% equ 0 (
    echo ✅ Python is installed
    py --version
) else (
    echo ❌ Python is NOT installed
    echo Run INSTALL-PYTHON.bat to install
)
echo.

echo Checking pip installation...
REM Use pip via Python launcher to avoid PATH issues
py -m pip --version 2>nul
if %errorlevel% equ 0 (
    echo ✅ pip is installed
    py -m pip --version
) else (
    echo ❌ pip is NOT installed
    echo pip comes with Python - reinstall Python or ensure py launcher is installed
)
echo.

echo Checking G: Drive access...
if exist "G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\" (
    echo ✅ G: Drive path is accessible
) else (
    echo ⚠️ G: Drive path is NOT accessible
    echo Make sure you're connected to the network and have access
)
echo.

echo ====================================
echo REQUIREMENTS CHECK COMPLETE
echo ====================================
echo.
echo If all items show ✅, you can run SETUP.bat
echo If any items show ❌, install the missing requirements first
echo.
pause
