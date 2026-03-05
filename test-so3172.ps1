# Test SO 3172 - GRTP SRI-USD PO 0602-26
# Usage: .\test-so3172.ps1

$baseUrl = "http://localhost:5002"

$emailContent = @"
GRTP SRI-USD purchase order number 0602-26 (Canoil sales order 3172 attached) is ready to go out the door:

Line 1:
10 pails of Canoil H1 Food & Beverage #2 pail 
170 kg total net, Batch number WH1K25G043

Line 2: 
2 cases of Canoil H1 Food & Beverage #2 master box - 30 x 400g
24 kg total net weight, Batch number WH1K25G043

On 1 pallet, 48 x 40 x 30 inches, 234 kg total gross weight.
"@

$body = @{ email_content = $emailContent } | ConvertTo-Json

Write-Host ""
Write-Host "Testing SO 3172 process-email..." -ForegroundColor Cyan
Write-Host "URL: $baseUrl/api/logistics/process-email" -ForegroundColor Gray
Write-Host ""

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/logistics/process-email" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 120

    if ($result.success) {
        Write-Host "[OK] SUCCESS" -ForegroundColor Green
        Write-Host "SO Number: $($result.so_data.so_number)" -ForegroundColor Green
        Write-Host "Customer: $($result.so_data.customer_name)" -ForegroundColor Green
        Write-Host "Validation: $($result.validation_result.status)" -ForegroundColor $(if ($result.validation_result.status -eq 'valid') { 'Green' } else { 'Red' })
        Write-Host "Items matched: $($result.validation_result.items_matched)/$($result.validation_result.items_total)" -ForegroundColor Gray
        if ($result.validation_result.details) {
            Write-Host "Details:" -ForegroundColor Gray
            $result.validation_result.details | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        }
    } else {
        Write-Host "[FAIL] $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Tip: Start backend first: launch-canoil.bat or python backend/app.py" -ForegroundColor Yellow
}
