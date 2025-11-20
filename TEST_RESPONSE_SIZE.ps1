# Test Response Size for Hypercorn Deployment
# Checks if response exceeds 32MB limit

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TESTING RESPONSE SIZE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$url = Read-Host "Enter URL to test (default: http://localhost:5002/api/data)"

if ([string]::IsNullOrWhiteSpace($url)) {
    $url = "http://localhost:5002/api/data"
}

Write-Host ""
Write-Host "Testing: $url" -ForegroundColor Yellow
Write-Host ""

try {
    # Get response
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    
    # Calculate sizes
    $sizeBytes = $response.RawContentLength
    $sizeMB = $sizeBytes / 1MB
    $sizeKB = $sizeBytes / 1KB
    
    Write-Host "Response Details:" -ForegroundColor Cyan
    Write-Host "  Status Code: $($response.StatusCode)"
    Write-Host "  Size: $([math]::Round($sizeMB, 2)) MB ($([math]::Round($sizeKB, 2)) KB)"
    Write-Host ""
    
    # Check against limits
    Write-Host "Limit Check:" -ForegroundColor Cyan
    if ($sizeMB -gt 32) {
        Write-Host "  ⚠️  WARNING: Response exceeds 32MB limit!" -ForegroundColor Red
        Write-Host "     Over by: $([math]::Round($sizeMB - 32, 2)) MB" -ForegroundColor Red
        Write-Host ""
        Write-Host "  With HTTP/2: Should still work (no limit)" -ForegroundColor Yellow
        Write-Host "  Without HTTP/2: Will be rejected" -ForegroundColor Red
    } else {
        Write-Host "  ✅ Response is under 32MB limit" -ForegroundColor Green
        Write-Host "     Headroom: $([math]::Round(32 - $sizeMB, 2)) MB" -ForegroundColor Green
    }
    
    Write-Host ""
    
    # Check for Sales Orders
    try {
        $jsonContent = $response.Content | ConvertFrom-Json
        $soCount = 0
        $soByStatus = @{}
        
        if ($jsonContent.data) {
            if ($jsonContent.data.SalesOrdersByStatus) {
                $soByStatus = $jsonContent.data.SalesOrdersByStatus
                foreach ($folder in $soByStatus.PSObject.Properties.Name) {
                    $soCount += ($soByStatus.$folder | Measure-Object).Count
                }
            }
            if ($jsonContent.data.'SalesOrders.json') {
                $soCount = ($jsonContent.data.'SalesOrders.json' | Measure-Object).Count
            }
        }
        
        Write-Host "Sales Orders Check:" -ForegroundColor Cyan
        if ($soCount -gt 0) {
            Write-Host "  ✅ Sales Orders loaded: $soCount orders" -ForegroundColor Green
            Write-Host "  Folders: $($soByStatus.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠️  No Sales Orders found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  Could not parse Sales Orders data" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  TEST COMPLETE" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ ERROR: Failed to get response" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure the server is running:" -ForegroundColor Yellow
    Write-Host "  python backend/test_hypercorn_local.py" -ForegroundColor White
}

Write-Host ""

