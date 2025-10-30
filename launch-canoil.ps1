Write-Host "================================================" -ForegroundColor Cyan
Write-Host "           CANOIL ENTERPRISE PORTAL" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Cleaning up existing processes..." -ForegroundColor Yellow
Write-Host "Stopping any existing Node.js processes..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Stopping any existing Python processes..."
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "All conflicting processes terminated."
Write-Host ""

Write-Host "[2/4] Starting Flask Backend (G: Drive Data Service)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend"
    python app.py
}
Write-Host "Backend service initiated on port 5002"
Write-Host "Waiting for backend to initialize..."
Start-Sleep -Seconds 5
Write-Host ""

Write-Host "[3/4] Starting React Frontend (Manufacturing Portal)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\frontend"
    npm run dev
}
Write-Host "Frontend service initiated on port 5001"
Write-Host ""

Write-Host "[4/4] Launching Canoil Enterprise Portal..." -ForegroundColor Yellow
Write-Host "Waiting for services to initialize..."
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Please wait while the system loads:" -ForegroundColor White
Write-Host "   • Flask Backend: Manufacturing data API" -ForegroundColor White
Write-Host "   • React Frontend: Enterprise dashboard" -ForegroundColor White
Write-Host "   • G: Drive Integration: Real-time data sync" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Cyan
Start-Sleep -Seconds 18

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "           CANOIL PORTAL - READY!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "The portal is now running at: http://localhost:5001" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: To avoid multiple browser windows:" -ForegroundColor Yellow
Write-Host "• If you already have a browser tab open, just refresh it" -ForegroundColor White
Write-Host "• Otherwise, manually open: http://localhost:5001" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   MANUAL BROWSER OPENING - NO AUTO-LAUNCH" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The portal is ready at: http://localhost:5001" -ForegroundColor White
Write-Host ""
Write-Host "Please manually open your browser and navigate to:" -ForegroundColor White
Write-Host "http://localhost:5001" -ForegroundColor Cyan
Write-Host ""
Write-Host "This prevents any duplicate browser windows." -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "           CANOIL PORTAL - READY!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "Frontend URL: http://localhost:5001" -ForegroundColor White
Write-Host "Backend API:  http://localhost:5002/api/data" -ForegroundColor White
Write-Host ""
Write-Host "Keep this PowerShell window open for proper operation." -ForegroundColor Yellow
Write-Host "Close this window when you're done using the portal." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close"

