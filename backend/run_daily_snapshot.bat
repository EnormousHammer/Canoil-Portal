@echo off
REM ============================================
REM  Daily Inventory Snapshot - Canoil Canada
REM  Pulls MISys inventory and saves snapshot
REM  Schedule: Daily at 6:00 PM via Task Scheduler
REM ============================================

cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"
python daily_inventory_snapshot.py >> "%USERPROFILE%\Documents\snapshot_log.txt" 2>&1
