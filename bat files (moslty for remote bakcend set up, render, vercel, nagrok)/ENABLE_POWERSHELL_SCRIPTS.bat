@echo off
REM ============================================================
REM  ENABLE POWERSHELL SCRIPTS (Run as Administrator)
REM ============================================================

echo.
echo ========================================
echo   ENABLE POWERSHELL SCRIPTS
echo ========================================
echo.

REM Check if running as admin
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Not running as Administrator!
    echo.
    echo Please:
    echo 1. Right-click this file
    echo 2. Select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

echo This will enable PowerShell scripts for the current user.
echo.
echo Current execution policy:
PowerShell -Command "Get-ExecutionPolicy -List"
echo.

set /p confirm="Enable scripts? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Enabling scripts...
PowerShell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: PowerShell scripts enabled!
    echo.
    echo You can now run .ps1 files directly.
) else (
    echo.
    echo ERROR: Failed to enable scripts
)

echo.
echo New execution policy:
PowerShell -Command "Get-ExecutionPolicy -List"

echo.
pause

