@echo off
echo ====================================
echo CANOIL PORTAL - TRANSFER HELPER
echo ====================================
echo.
echo This will help you organize the project on your new computer
echo.

echo Creating recommended folder structure...
echo.

echo Option 1: Development folder structure
echo Creating: C:\Development\
if not exist "C:\Development\" (
    mkdir "C:\Development\" 2>nul
    if %errorlevel% equ 0 (
        echo ✅ Created C:\Development\
    ) else (
        echo ⚠️ Could not create C:\Development\ (may need admin rights)
    )
) else (
    echo ✅ C:\Development\ already exists
)
echo.

echo Option 2: Your existing structure
echo Using: C:\APPLICATIONS MADE BY ME\WINDOWS\Canoil Helper\
if not exist "C:\APPLICATIONS MADE BY ME\WINDOWS\Canoil Helper\" (
    echo ⚠️ Your usual folder doesn't exist yet on this computer
    echo You may need to create it manually
) else (
    echo ✅ Your usual folder structure exists
)
echo.

echo ====================================
echo TRANSFER INSTRUCTIONS
echo ====================================
echo.
echo 1. Copy the ENTIRE canoil-portal folder to one of these locations:
echo.
echo    RECOMMENDED:
echo    C:\Development\canoil-portal\
echo.
echo    OR YOUR USUAL:
echo    C:\APPLICATIONS MADE BY ME\WINDOWS\Canoil Helper\canoil-portal\
echo.
echo 2. After copying, navigate to:
echo    [chosen-location]\canoil-portal\NEW COMPUTER, CLICK HERE\
echo.
echo 3. Run: CHECK-REQUIREMENTS.bat
echo.
echo 4. Then run: SETUP.bat
echo.
echo 5. Finally run: ..\launch-canoil.bat
echo.
echo ====================================

echo Checking G: Drive access...
if exist "G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions\" (
    echo ✅ G: Drive is accessible - data source ready!
) else (
    echo ⚠️ G: Drive not accessible - you may need to:
    echo    - Connect to company network/VPN
    echo    - Map the G: drive properly
    echo    - Check with IT for access
)
echo.

echo Current location of this file:
echo %~dp0
echo.
echo Make sure to copy the PARENT folder (canoil-portal) that contains this folder
echo.
pause
