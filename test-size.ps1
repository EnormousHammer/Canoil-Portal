$response = Invoke-WebRequest -Uri "http://localhost:5002/api/data" -UseBasicParsing
$sizeMB = $response.RawContentLength / 1MB
Write-Host "Size: $([math]::Round($sizeMB, 2)) MB"
if ($sizeMB -gt 32) { Write-Host "OVER 32MB - Need HTTP/2" -ForegroundColor Red } else { Write-Host "OK - Under 32MB" -ForegroundColor Green }

