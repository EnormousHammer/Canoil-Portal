@echo off
color 0A
echo ====================================
echo 🚀 CANOIL PORTAL - NEW COMPUTER SETUP
echo ====================================
echo.
echo Welcome! This will guide you through setting up
echo the Canoil Portal project on your new computer.
echo.
echo ====================================
echo STEP-BY-STEP GUIDE
echo ====================================
echo.
echo STEP 1: Check if you've copied the project correctly
echo -----------------------------------------------
echo Current folder: %~dp0
echo.
echo You should see these files in this folder:
echo ✓ SETUP.bat
echo ✓ CHECK-REQUIREMENTS.bat  
echo ✓ README-NEW-COMPUTER.md
echo ✓ FOLDER-STRUCTURE-GUIDE.md
echo.

dir /B | findstr /I "SETUP.bat" >nul
if %errorlevel% equ 0 (
    echo ✅ SETUP.bat found - you're in the right place!
) else (
    echo ❌ SETUP.bat not found - you may be in the wrong folder
    echo Make sure you're in the "NEW COMPUTER, CLICK HERE" folder
)
echo.

echo STEP 2: Choose your next action
echo --------------------------------
echo.
echo A] First time setup - Check what you need
echo B] Install Node.js (if needed)
echo C] Install Python (if needed)  
echo D] Complete project setup
echo E] Read detailed instructions
echo F] Check folder structure guide
echo.
echo Q] Quit
echo.
set /p choice="Enter your choice (A/B/C/D/E/F/Q): "

if /I "%choice%"=="A" goto CHECK
if /I "%choice%"=="B" goto NODEJS  
if /I "%choice%"=="C" goto PYTHON
if /I "%choice%"=="D" goto SETUP
if /I "%choice%"=="E" goto README
if /I "%choice%"=="F" goto FOLDER
if /I "%choice%"=="Q" goto END
goto INVALID

:CHECK
echo.
echo Running requirements check...
call CHECK-REQUIREMENTS.bat
goto MENU

:NODEJS
echo.
echo Opening Node.js installer helper...
call INSTALL-NODEJS.bat
goto MENU

:PYTHON
echo.
echo Opening Python installer helper...
call INSTALL-PYTHON.bat
goto MENU

:SETUP
echo.
echo Starting complete project setup...
call SETUP.bat
goto MENU

:README
echo.
echo Opening detailed README...
start README-NEW-COMPUTER.md
goto MENU

:FOLDER
echo.
echo Opening folder structure guide...
start FOLDER-STRUCTURE-GUIDE.md
goto MENU

:INVALID
echo.
echo Invalid choice. Please try again.
echo.

:MENU
echo.
echo ====================================
echo What would you like to do next?
echo ====================================
echo.
echo A] Check requirements again
echo B] Install Node.js
echo C] Install Python  
echo D] Complete project setup
echo E] Read detailed instructions
echo F] Check folder structure guide
echo S] Start the application (if setup complete)
echo.
echo Q] Quit
echo.
set /p choice="Enter your choice (A/B/C/D/E/F/S/Q): "

if /I "%choice%"=="A" goto CHECK
if /I "%choice%"=="B" goto NODEJS  
if /I "%choice%"=="C" goto PYTHON
if /I "%choice%"=="D" goto SETUP
if /I "%choice%"=="E" goto README
if /I "%choice%"=="F" goto FOLDER
if /I "%choice%"=="S" goto START
if /I "%choice%"=="Q" goto END
goto INVALID

:START
echo.
echo Starting the Canoil Portal application...
cd /d "%~dp0.."
if exist "launch-canoil.bat" (
    echo Found launch script, starting application...
    start launch-canoil.bat
    echo.
    echo Application should be starting...
    echo Check your browser for: http://localhost:5001
) else (
    echo ❌ launch-canoil.bat not found
    echo Make sure you've completed the setup first (option D)
)
pause
goto MENU

:END
echo.
echo ====================================
echo Thanks for using Canoil Portal Setup!
echo ====================================
echo.
echo If you need help later, just run this file again
echo or check the README-NEW-COMPUTER.md for detailed instructions
echo.
echo Happy coding! 🎉
echo.
pause
exit

:EOF
