# Test Cloud Run data endpoint to see what it's actually returning
Write-Host "Testing Cloud Run /api/data endpoint..." -ForegroundColor Cyan
Write-Host ""

$url = "https://canoil-backend-711358371169.us-central1.run.app/api/data"

try {
    Write-Host "Fetching data (this may take a moment)..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
    $json = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Response received" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "  Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Data Structure:" -ForegroundColor Yellow
    if ($json.data) {
        $fileCount = ($json.data | Get-Member -MemberType NoteProperty).Count
        Write-Host "  Files in response: $fileCount" -ForegroundColor Gray
        
        # Count total records
        $totalRecords = 0
        $emptyFiles = 0
        $filesWithData = 0
        
        $json.data.PSObject.Properties | ForEach-Object {
            $fileName = $_.Name
            $fileData = $_.Value
            
            if ($fileData -is [Array]) {
                $recordCount = $fileData.Count
                $totalRecords += $recordCount
                
                if ($recordCount -eq 0) {
                    $emptyFiles++
                } else {
                    $filesWithData++
                    Write-Host "  ✅ $fileName : $recordCount records" -ForegroundColor Green
                }
            } elseif ($fileData -is [PSCustomObject]) {
                Write-Host "  📄 $fileName : Object (not array)" -ForegroundColor Yellow
            } else {
                Write-Host "  📄 $fileName : $($fileData.GetType().Name)" -ForegroundColor Yellow
            }
        }
        
        Write-Host ""
        Write-Host "Summary:" -ForegroundColor Yellow
        Write-Host "  Total files: $fileCount" -ForegroundColor Gray
        Write-Host "  Files with data: $filesWithData" -ForegroundColor $(if ($filesWithData -gt 0) { "Green" } else { "Red" })
        Write-Host "  Empty files: $emptyFiles" -ForegroundColor $(if ($emptyFiles -eq $fileCount) { "Red" } else { "Gray" })
        Write-Host "  Total records: $totalRecords" -ForegroundColor $(if ($totalRecords -gt 0) { "Green" } else { "Red" })
        
        if ($totalRecords -eq 0) {
            Write-Host ""
            Write-Host "❌ PROBLEM: Backend returned empty data structure!" -ForegroundColor Red
            Write-Host "   This means Cloud Run cannot access G: Drive" -ForegroundColor Yellow
            Write-Host "   G: Drive is a local Windows network drive, not accessible from Cloud Run" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ No 'data' property in response" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Folder Info:" -ForegroundColor Yellow
    if ($json.folderInfo) {
        Write-Host "  Folder: $($json.folderInfo.folderName)" -ForegroundColor Gray
        Write-Host "  Sync Date: $($json.folderInfo.syncDate)" -ForegroundColor Gray
        Write-Host "  File Count: $($json.folderInfo.fileCount)" -ForegroundColor Gray
        
        if ($json.folderInfo.folderName -like "*No G: Drive*" -or $json.folderInfo.folderName -like "*Not Connected*") {
            Write-Host ""
            Write-Host "❌ CONFIRMED: Backend cannot access G: Drive" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""


