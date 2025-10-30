@echo off
echo ====================================
echo CANOIL PORTAL - NEW COMPUTER SETUP
echo ====================================
echo.
echo This will install everything needed for the Canoil Portal project
echo.
pause

echo Installing Node.js and npm...
echo Please download and install Node.js from: https://nodejs.org/
echo Choose the LTS version (recommended)
echo.
pause

echo Installing Python...
echo Please download and install Python from: https://python.org/downloads/
echo Make sure to check "Add Python to PATH" during installation
echo.
pause

echo Setting up project directories...
cd /d "%~dp0.."
echo Current directory: %CD%

echo Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend npm install failed
    pause
    exit /b 1
)

echo Installing backend dependencies...
cd ..\backend
call pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Backend pip install failed
    pause
    exit /b 1
)

echo.
echo ====================================
echo SETUP COMPLETE!
echo ====================================
echo.
echo To start the project:
echo 1. Run: launch-canoil.bat
echo 2. Or manually start both servers (see instructions in README-NEW-COMPUTER.md)
echo.
pause
