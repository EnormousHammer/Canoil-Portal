# Test logistics process-email with sample shipping email
# Usage: .\test-logistics-email.ps1           # Local backend (localhost:5002)
#        .\test-logistics-email.ps1 -Cloud   # Render backend

param([switch]$Cloud)
$baseUrl = if ($Cloud) { "https://canoil-portal-1.onrender.com" } else { "http://localhost:5002" }

$emailContent = @"
purchase order OS00066277 ( Sales order 3152) 'is ready for shipping.

1 item which is REOLUBE 46XC Batch Number NT5E19T018 

1 Skid  45" x 45" x 40  AT 195 KG
"@

$body = @{ email_content = $emailContent } | ConvertTo-Json

Write-Host ""
Write-Host "Testing logistics process-email..." -ForegroundColor Cyan
Write-Host "URL: $baseUrl/api/logistics/process-email" -ForegroundColor Gray
Write-Host ""

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/logistics/process-email" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 120

    if ($result.success) {
        Write-Host "SUCCESS" -ForegroundColor Green
        Write-Host "SO Number: $($result.so_data.so_number)" -ForegroundColor Green
        Write-Host "Customer: $($result.so_data.customer_name)" -ForegroundColor Green
        Write-Host "Items: $($result.so_data.items.Count)" -ForegroundColor Green
    } else {
        Write-Host "FAILED: $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($Cloud) {
        Write-Host "Tip: Render free tier may timeout. Try local: .\test-logistics-email.ps1" -ForegroundColor Yellow
    } else {
        Write-Host "Tip: Start backend first: launch-canoil.bat or python backend/app.py" -ForegroundColor Yellow
    }
}
