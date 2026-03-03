@echo off
REM ============================================
REM  Install Daily Inventory Snapshot Task
REM  Run this ONCE as Administrator
REM ============================================

echo Installing "Canoil Daily Inventory Snapshot" task...

schtasks /create /tn "Canoil Daily Inventory Snapshot" /tr "\"G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend\run_daily_snapshot.bat\"" /sc DAILY /st 18:00 /rl HIGHEST /f

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Task created!
    echo   Name: Canoil Daily Inventory Snapshot
    echo   Schedule: Daily at 6:00 PM
    echo   Action: Pulls MISys inventory and saves snapshot
    echo.
    echo To change the time, run:
    echo   schtasks /change /tn "Canoil Daily Inventory Snapshot" /st HH:MM
    echo.
    echo To run manually now:
    echo   schtasks /run /tn "Canoil Daily Inventory Snapshot"
) else (
    echo.
    echo FAILED: Could not create task. Run this as Administrator.
)

pause
