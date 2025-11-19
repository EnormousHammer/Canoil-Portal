@echo off
REM Fix OpenAI library compatibility issue
REM This fixes: TypeError: Client.__init__() got an unexpected keyword argument 'proxies'

echo ========================================
echo   FIXING OPENAI LIBRARY COMPATIBILITY
echo ========================================
echo.

cd /d "%~dp0"
cd backend

echo [1/3] Upgrading OpenAI library...
python -m pip install --upgrade openai

echo.
echo [2/3] Upgrading httpx library...
python -m pip install --upgrade httpx

echo.
echo [3/3] Installing compatible versions...
python -m pip install "httpx>=0.24.0" "openai>=1.0.0"

echo.
echo ========================================
echo   FIX COMPLETE!
echo ========================================
echo.
echo Now restart the backend server:
echo   1. Close the backend window
echo   2. Run: start_backend.bat
echo.
pause

