@echo off
title Canoil Portal Backend Server
echo ========================================
echo   CANOIL PORTAL BACKEND SERVER
echo ========================================
echo.
echo Starting server...
echo.
cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"
python app.py
echo.
echo Server stopped. Press any key to close...
pause >nul

