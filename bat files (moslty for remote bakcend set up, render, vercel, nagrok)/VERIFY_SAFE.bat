@echo off
REM ============================================================
REM  SAFE VERIFY - WITH LOGGING
REM ============================================================

setlocal enabledelayedexpansion

cd /d "%~dp0"

set LOGFILE=verify_log.txt
echo Verification started at %date% %time% > %LOGFILE%

echo.
echo ========================================
echo   SYSTEM VERIFICATION
echo ========================================
echo.
echo Logging to: %LOGFILE%
echo.

set ALL_GOOD=1

REM ============================================================
REM SOFTWARE CHECKS
REM ============================================================

echo [1] SOFTWARE
echo -----------------------------
echo.

echo Python:
python --version >> %LOGFILE% 2>&1
if %ERRORLEVEL% EQU 0 (
    python --version
    echo    OK
) else (
    echo    ERROR: Not found
    set ALL_GOOD=0
)

echo.
echo Node.js:
node --version >> %LOGFILE% 2>&1
if %ERRORLEVEL% EQU 0 (
    node --version
    echo    OK
) else (
    echo    ERROR: Not found
    set ALL_GOOD=0
)

echo.
echo npm:
npm --version >> %LOGFILE% 2>&1
if %ERRORLEVEL% EQU 0 (
    npm --version
    echo    OK
) else (
    echo    ERROR: Not found
    set ALL_GOOD=0
)

REM ============================================================
REM PROJECT STRUCTURE
REM ============================================================

echo.
echo [2] PROJECT STRUCTURE
echo -----------------------------
echo.

echo backend folder:
if exist "backend" (
    echo    OK
    echo backend: OK >> %LOGFILE%
) else (
    echo    ERROR: Missing
    echo backend: MISSING >> %LOGFILE%
    set ALL_GOOD=0
)

echo frontend folder:
if exist "frontend" (
    echo    OK
    echo frontend: OK >> %LOGFILE%
) else (
    echo    ERROR: Missing
    echo frontend: MISSING >> %LOGFILE%
    set ALL_GOOD=0
)

echo backend\venv:
if exist "backend\venv" (
    echo    OK
    echo backend\venv: OK >> %LOGFILE%
) else (
    echo    ERROR: Missing (run SETUP_SAFE.bat)
    echo backend\venv: MISSING >> %LOGFILE%
    set ALL_GOOD=0
)

echo frontend\node_modules:
if exist "frontend\node_modules" (
    echo    OK
    echo frontend\node_modules: OK >> %LOGFILE%
) else (
    echo    ERROR: Missing (run SETUP_SAFE.bat)
    echo frontend\node_modules: MISSING >> %LOGFILE%
    set ALL_GOOD=0
)

echo frontend\dist:
if exist "frontend\dist" (
    echo    OK
    echo frontend\dist: OK >> %LOGFILE%
) else (
    echo    WARNING: Missing (run: cd frontend ^&^& npm run build)
    echo frontend\dist: MISSING >> %LOGFILE%
)

REM ============================================================
REM SERVICES
REM ============================================================

echo.
echo [3] SERVICES
echo -----------------------------
echo.

echo Backend on port 5002:
netstat -ano | findstr :5002 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    OK: Running
    echo Backend: RUNNING >> %LOGFILE%
) else (
    echo    Not running (this is OK if you haven't started it yet)
    echo Backend: NOT RUNNING >> %LOGFILE%
)

echo.
echo ngrok on port 4040:
netstat -ano | findstr :4040 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    OK: Running
    echo ngrok: RUNNING >> %LOGFILE%
) else (
    echo    Not running (this is OK if you haven't started it yet)
    echo ngrok: NOT RUNNING >> %LOGFILE%
)

REM ============================================================
REM DATA ACCESS
REM ============================================================

echo.
echo [4] DATA ACCESS
echo -----------------------------
echo.

set GDRIVE_PATH=G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions

echo G: Drive:
if exist "%GDRIVE_PATH%" (
    echo    OK: Accessible
    echo G_Drive: ACCESSIBLE >> %LOGFILE%
) else (
    echo    ERROR: Not accessible
    echo G_Drive: NOT ACCESSIBLE >> %LOGFILE%
    set ALL_GOOD=0
)

REM ============================================================
REM SUMMARY
REM ============================================================

echo.
echo ========================================
if %ALL_GOOD% EQU 1 (
    echo   ALL CHECKS PASSED!
    echo   ALL CHECKS PASSED! >> %LOGFILE%
) else (
    echo   SOME CHECKS FAILED
    echo   SOME CHECKS FAILED >> %LOGFILE%
    echo   Run SETUP_SAFE.bat to fix
)
echo ========================================
echo.

echo Verification completed at %date% %time% >> %LOGFILE%
echo Log saved to: %LOGFILE%
echo.

pause

