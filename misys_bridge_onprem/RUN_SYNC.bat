@echo off
title MISys -> Google Drive Sync
color 0A
echo.
echo ============================================================
echo   MISys -^> Google Drive CSV Sync
echo   Canoil Canada Ltd.
echo ============================================================
echo.

:: ── Check Python ──────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERROR] Python is not installed or not in PATH.
    echo.
    echo Please install Python from https://python.org
    echo Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

echo [OK] Python found.

:: ── Auto-install missing packages ─────────────────────────────
echo [..] Checking required packages...
python -c "import pyodbc" >nul 2>&1
if errorlevel 1 (
    echo [..] Installing pyodbc...
    python -m pip install pyodbc --quiet
)
python -c "import dotenv" >nul 2>&1
if errorlevel 1 (
    echo [..] Installing python-dotenv...
    python -m pip install python-dotenv --quiet
)
echo [OK] Packages ready.
echo.

:: ── Run the sync ──────────────────────────────────────────────
echo [..] Starting sync - this takes about 90 seconds...
echo.
python -X utf8 "%~dp0sync_to_gdrive.py" %*

:: ── Result ────────────────────────────────────────────────────
if errorlevel 1 (
    color 0C
    echo.
    echo [FAILED] Sync did not complete. See error above.
    echo.
    echo Common causes:
    echo   - VPN not connected
    echo   - Not on office network
    echo   - G: drive not mounted
    echo.
) else (
    color 0A
    echo.
    echo [DONE] Google Drive updated. App will show fresh data on next load.
    echo.
)

pause
