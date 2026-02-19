@echo off
REM Test logistics validation against Scheduled SOs pool
REM Prereqs: 1) Start backend first (python app.py in backend)
REM          2) OPENAI_API_KEY in .env
REM          3) G: drive or so_cache with SO PDFs
echo.
echo ============================================================
echo LOGISTICS SCHEDULED SOs TEST
echo ============================================================
echo.
echo Ensure backend is running: cd backend ^&^& python app.py
echo Then run this script.
echo.
cd /d "%~dp0backend"
python test_logistics_scheduled_sos.py
pause
