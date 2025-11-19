@echo off
REM Comprehensive check for ALL Sales Order files (including subfolders)

echo ========================================
echo   FINDING ALL SALES ORDER FILES
echo ========================================
echo.

SET SO_PATH=G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders

echo Scanning ALL subfolders recursively...
echo.

REM Count all PDF files recursively
echo PDF Files:
dir "%SO_PATH%\*.pdf" /S /B 2>nul | find /C /V ""
echo.

REM Count all DOC/DOCX files recursively  
echo DOC/DOCX Files:
dir "%SO_PATH%\*.doc" /S /B 2>nul | find /C /V ""
dir "%SO_PATH%\*.docx" /S /B 2>nul | find /C /V ""
echo.

echo ========================================
echo   CHECKING SPECIFIC SUBFOLDERS
echo ========================================
echo.

REM Check common subfolders
echo In Production\Scheduled:
dir "%SO_PATH%\In Production\Scheduled\*.pdf" /B 2>nul | find /C /V ""
dir "%SO_PATH%\In Production\Scheduled\*.doc*" /B 2>nul | find /C /V ""
echo.

echo Completed and Closed:
dir "%SO_PATH%\Completed and Closed\*.pdf" /B 2>nul | find /C /V ""
dir "%SO_PATH%\Completed and Closed\*.doc*" /B 2>nul | find /C /V ""
echo.

echo ========================================
echo   SAMPLE FILES FOUND
echo ========================================
echo.

echo First 10 PDF files:
dir "%SO_PATH%\*.pdf" /S /B 2>nul | findstr /N "^" | findstr "^[1-9]:"
echo.

echo First 10 DOC files:
dir "%SO_PATH%\*.doc*" /S /B 2>nul | findstr /N "^" | findstr "^[1-9]:"
echo.

echo ========================================
echo   CLOUD STATUS CHECK
echo ========================================
echo.

echo Checking if files are cloud placeholders...
dir "%SO_PATH%\New and Revised" /A-D 2>nul | findstr /C:"File(s)"
echo.

echo If file count is 0 or very low but you see files in Google Drive:
echo   → Files are CLOUD PLACEHOLDERS (not downloaded yet)
echo.
echo Solution:
echo   1. Open Google Drive Desktop (system tray)
echo   2. Click Settings (gear icon)
echo   3. Click "Preferences"
echo   4. Find "Customer Orders\Sales Orders"
echo   5. Right-click → "Make available offline"
echo   6. Wait for download (watch progress in Google Drive)
echo.

pause

