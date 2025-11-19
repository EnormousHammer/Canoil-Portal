@echo off
REM ============================================================
REM  START CANOIL BACKEND SERVER
REM ============================================================

cd /d "%~dp0\backend"

echo.
echo ============================================================
echo   STARTING CANOIL BACKEND SERVER
echo ============================================================
echo.

REM Check if .env exists
if not exist "%~dp0\.env" (
    echo WARNING: .env file not found in root directory!
    echo Run CREATE_ENV_FILE.bat first to create it.
    echo.
    pause
    exit /b 1
)

REM Check if venv exists
if not exist "venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found!
    echo Run: python -m venv venv
    echo Then: venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Starting Flask server on http://localhost:5002
echo Press Ctrl+C to stop the server
echo.

REM Use start_server.py for proper startup
python start_server.py

pause

