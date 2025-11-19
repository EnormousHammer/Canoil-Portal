@echo off
REM Check if Sales Orders path is accessible
REM This will help diagnose why SalesOrdersByStatus is empty

echo ========================================
echo   CHECKING SALES ORDERS PATH
echo ========================================
echo.

cd /d "%~dp0"

SET SO_PATH=G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders

echo Checking path: %SO_PATH%
echo.

if exist "%SO_PATH%" (
    echo ✅ PATH EXISTS
    echo.
    echo Listing folders:
    dir "%SO_PATH%" /AD /B
    echo.
    echo Counting PDF files in each folder:
    for /D %%F in ("%SO_PATH%\*") do (
        echo.
        echo Folder: %%~nxF
        dir "%%F\*.pdf" /B 2>nul | find /C /V ""
    )
) else (
    echo ❌ PATH DOES NOT EXIST
    echo.
    echo The backend cannot access Sales Orders because this path is missing.
    echo.
    echo Possible solutions:
    echo 1. Mount G: drive on this computer
    echo 2. Download Sales Orders to local path
    echo 3. Configure backend to use Google Drive API instead
)

echo.
echo ========================================
echo   CHECKING MiSys DATA PATH
echo ========================================
echo.

SET MISYS_PATH=G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions

echo Checking path: %MISYS_PATH%
echo.

if exist "%MISYS_PATH%" (
    echo ✅ PATH EXISTS
    echo.
    echo Latest folder:
    for /F "delims=" %%A in ('dir "%MISYS_PATH%\*" /AD /B /O-D 2^>nul ^| findstr /R "^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$"') do (
        echo %%A
        goto :found
    )
    :found
) else (
    echo ❌ PATH DOES NOT EXIST
)

echo.
pause

