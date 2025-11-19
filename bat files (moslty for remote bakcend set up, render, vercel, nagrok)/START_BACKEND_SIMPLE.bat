@echo off
echo Starting Backend (Simple Mode - No Blocking)...
cd /d "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"

REM Set environment to SKIP immediate authentication
set USE_GOOGLE_DRIVE_API=false
set OPENAI_API_KEY=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
set FLASK_ENV=production

python app.py
pause
