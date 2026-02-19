@echo off
REM ============================================================
REM  CANOIL PORTAL - API TEST
REM  Run this after starting the app to verify backend works.
REM ============================================================

cd /d "%~dp0"

echo.
echo Starting API verification...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0test-canoil-api.ps1"

echo.
pause
