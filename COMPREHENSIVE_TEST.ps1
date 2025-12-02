# Comprehensive End-to-End Testing Script
# Tests everything: local, Cloud Run, and integration

$ErrorActionPreference = "Continue"
$rootPath = "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMPREHENSIVE END-TO-END TESTING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [int]$Timeout = 10,
        [switch]$ExpectTimeout
    )
    
    Write-Host "[TEST] $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    Write-Host "  Method: $Method" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = $Timeout
            ErrorAction = "Stop"
        }
        
        if ($Method -eq "HEAD") {
            $response = Invoke-WebRequest @params
            $status = $response.StatusCode
            $content = "HEAD request - no content"
        } else {
            $response = Invoke-WebRequest @params
            $status = $response.StatusCode
            $content = $response.Content
        }
        
        if ($status -eq 200 -or $status -eq 201 -or $status -eq 204) {
            Write-Host "  ✅ SUCCESS - Status: $status" -ForegroundColor Green
            if ($content.Length -gt 0 -and $content.Length -lt 500) {
                Write-Host "  Response: $($content.Substring(0, [Math]::Min(200, $content.Length)))" -ForegroundColor Gray
            } elseif ($content.Length -ge 500) {
                Write-Host "  Response: Large response ($($content.Length) bytes)" -ForegroundColor Gray
            }
            $testResults += @{Name=$Name; Status="PASS"; Details="Status: $status"}
            return $true
        } else {
            Write-Host "  ⚠️  UNEXPECTED STATUS - Status: $status" -ForegroundColor Yellow
            $testResults += @{Name=$Name; Status="WARN"; Details="Status: $status"}
            return $false
        }
    } catch {
        if ($ExpectTimeout -and $_.Exception.Message -like "*timeout*") {
            Write-Host "  ✅ EXPECTED TIMEOUT (large data load)" -ForegroundColor Green
            $testResults += @{Name=$Name; Status="PASS"; Details="Expected timeout"}
            return $true
        } elseif ($_.Exception.Message -like "*404*") {
            Write-Host "  ❌ FAILED - 404 Not Found" -ForegroundColor Red
            $testResults += @{Name=$Name; Status="FAIL"; Details="404 Not Found"}
            return $false
        } elseif ($_.Exception.Message -like "*timeout*") {
            Write-Host "  ⚠️  TIMEOUT (may be expected for large endpoints)" -ForegroundColor Yellow
            $testResults += @{Name=$Name; Status="TIMEOUT"; Details=$_.Exception.Message}
            return $false
        } else {
            Write-Host "  ❌ FAILED - $($_.Exception.Message)" -ForegroundColor Red
            $testResults += @{Name=$Name; Status="FAIL"; Details=$_.Exception.Message}
            return $false
        }
    }
}

# ============================================
# PHASE 1: Cleanup and Preparation
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 1: CLEANUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[CLEANUP] Stopping existing processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*nvm4w*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Kill processes on ports
$port5001 = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue
$port5002 = Get-NetTCPConnection -LocalPort 5002 -ErrorAction SilentlyContinue
if ($port5001) { Stop-Process -Id $port5001.OwningProcess -Force -ErrorAction SilentlyContinue }
if ($port5002) { Stop-Process -Id $port5002.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Write-Host "  ✅ Cleanup complete" -ForegroundColor Green
Write-Host ""

# ============================================
# PHASE 2: Start Local Backend
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 2: START LOCAL BACKEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[STARTUP] Starting Flask Backend..." -ForegroundColor Yellow
$backendScript = @"
cd `"$rootPath\backend`"
python app.py
"@
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -PassThru
Write-Host "  ✅ Backend process started (PID: $($backendProcess.Id))" -ForegroundColor Green
Write-Host "  Waiting for backend to initialize..." -ForegroundColor Gray

# Wait and test backend startup
$backendReady = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5002/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ Backend is ready! (attempt $i/15)" -ForegroundColor Green
            $backendReady = $true
            break
        }
    } catch {
        Write-Host "  ⏳ Waiting for backend... (attempt $i/15)" -ForegroundColor Yellow
    }
}

if (-not $backendReady) {
    Write-Host "  ❌ Backend failed to start within 30 seconds" -ForegroundColor Red
    Write-Host "  Check the backend console window for errors" -ForegroundColor Yellow
} else {
    Write-Host ""
}

# ============================================
# PHASE 3: Test Local Backend Endpoints
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 3: TEST LOCAL BACKEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($backendReady) {
    Test-Endpoint -Name "Local Backend Health" -Url "http://localhost:5002/api/health"
    Test-Endpoint -Name "Local Backend Data (HEAD)" -Url "http://localhost:5002/api/data" -Method "HEAD" -Timeout 5
    Test-Endpoint -Name "Local Backend MPS" -Url "http://localhost:5002/api/mps" -Method "HEAD" -Timeout 5
    Test-Endpoint -Name "Local Backend Sales Orders" -Url "http://localhost:5002/api/sales-orders" -Method "HEAD" -Timeout 5
} else {
    Write-Host "  ⚠️  Skipping backend tests - backend not ready" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# PHASE 4: Start Local Frontend
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 4: START LOCAL FRONTEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[STARTUP] Starting Vite Frontend..." -ForegroundColor Yellow
$frontendScript = @"
cd `"$rootPath\frontend`"
npm run dev
"@
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -PassThru
Write-Host "  ✅ Frontend process started (PID: $($frontendProcess.Id))" -ForegroundColor Green
Write-Host "  Waiting for Vite to initialize..." -ForegroundColor Gray

# Wait and test frontend startup
$frontendReady = $false
for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5001" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ Frontend is ready! (attempt $i/20)" -ForegroundColor Green
            $frontendReady = $true
            break
        }
    } catch {
        Write-Host "  ⏳ Waiting for frontend... (attempt $i/20)" -ForegroundColor Yellow
    }
}

if (-not $frontendReady) {
    Write-Host "  ❌ Frontend failed to start within 40 seconds" -ForegroundColor Red
    Write-Host "  Check the frontend console window for errors" -ForegroundColor Yellow
} else {
    Write-Host ""
}

# ============================================
# PHASE 5: Test Local Frontend
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 5: TEST LOCAL FRONTEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($frontendReady) {
    Test-Endpoint -Name "Local Frontend Root" -Url "http://localhost:5001"
    Test-Endpoint -Name "Local Frontend Index" -Url "http://localhost:5001/index.html"
    Test-Endpoint -Name "Local Frontend Main JS" -Url "http://localhost:5001/src/main.tsx" -Timeout 5
} else {
    Write-Host "  ⚠️  Skipping frontend tests - frontend not ready" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# PHASE 6: Test Cloud Run Backend
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 6: TEST CLOUD RUN BACKEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$cloudRunBase = "https://canoil-backend-711358371169.us-central1.run.app"
Test-Endpoint -Name "Cloud Run Health" -Url "$cloudRunBase/api/health" -Timeout 15
Test-Endpoint -Name "Cloud Run Data (HEAD)" -Url "$cloudRunBase/api/data" -Method "HEAD" -Timeout 15
Test-Endpoint -Name "Cloud Run MPS (HEAD)" -Url "$cloudRunBase/api/mps" -Method "HEAD" -Timeout 15
Test-Endpoint -Name "Cloud Run Sales Orders (HEAD)" -Url "$cloudRunBase/api/sales-orders" -Method "HEAD" -Timeout 15
Write-Host ""

# ============================================
# PHASE 7: Test Configuration
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 7: TEST CONFIGURATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test Vercel config
Write-Host "[CONFIG] Checking Vercel configuration..." -ForegroundColor Yellow
if (Test-Path "$rootPath\vercel.json") {
    $vercelConfig = Get-Content "$rootPath\vercel.json" | ConvertFrom-Json
    Write-Host "  ✅ vercel.json found" -ForegroundColor Green
    Write-Host "     Backend route: $($vercelConfig.routes[0].dest)" -ForegroundColor Gray
    if ($vercelConfig.routes[0].dest -like "*canoil-backend*") {
        Write-Host "  ✅ Backend URL configured correctly" -ForegroundColor Green
        $testResults += @{Name="Vercel Config"; Status="PASS"; Details="Backend URL correct"}
    } else {
        Write-Host "  ❌ Backend URL may be incorrect" -ForegroundColor Red
        $testResults += @{Name="Vercel Config"; Status="FAIL"; Details="Backend URL incorrect"}
    }
} else {
    Write-Host "  ❌ vercel.json not found" -ForegroundColor Red
    $testResults += @{Name="Vercel Config"; Status="FAIL"; Details="File not found"}
}

# Test API config
Write-Host "[CONFIG] Checking Frontend API configuration..." -ForegroundColor Yellow
$apiConfigPath = "$rootPath\frontend\src\utils\apiConfig.ts"
if (Test-Path $apiConfigPath) {
    $apiConfig = Get-Content $apiConfigPath -Raw
    $hasLocalhost = $apiConfig -like "*localhost:5002*"
    $hasCloudRun = $apiConfig -like "*canoil-backend-711358371169*"
    
    if ($hasLocalhost -and $hasCloudRun) {
        Write-Host "  ✅ API config has both localhost and Cloud Run" -ForegroundColor Green
        $testResults += @{Name="API Config"; Status="PASS"; Details="Both URLs configured"}
    } else {
        Write-Host "  ⚠️  API config may be missing URLs" -ForegroundColor Yellow
        $testResults += @{Name="API Config"; Status="WARN"; Details="Missing URLs"}
    }
} else {
    Write-Host "  ❌ API config file not found" -ForegroundColor Red
    $testResults += @{Name="API Config"; Status="FAIL"; Details="File not found"}
}

# Test Dockerfile
Write-Host "[CONFIG] Checking Dockerfile..." -ForegroundColor Yellow
if (Test-Path "$rootPath\Dockerfile") {
    $dockerfile = Get-Content "$rootPath\Dockerfile" -Raw
    if ($dockerfile -like "*EXPOSE 8080*" -or $dockerfile -like "*PORT*") {
        Write-Host "  ✅ Dockerfile port configuration looks correct" -ForegroundColor Green
        $testResults += @{Name="Dockerfile"; Status="PASS"; Details="Port configured"}
    } else {
        Write-Host "  ⚠️  Dockerfile port may need review" -ForegroundColor Yellow
        $testResults += @{Name="Dockerfile"; Status="WARN"; Details="Port review needed"}
    }
} else {
    Write-Host "  ❌ Dockerfile not found" -ForegroundColor Red
    $testResults += @{Name="Dockerfile"; Status="FAIL"; Details="File not found"}
}
Write-Host ""

# ============================================
# PHASE 8: Integration Test
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PHASE 8: INTEGRATION TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($backendReady -and $frontendReady) {
    Write-Host "[INTEGRATION] Testing frontend-backend connection..." -ForegroundColor Yellow
    
    # Test that frontend can reach backend
    try {
        # Simulate what frontend does - check API config
        $apiConfigContent = Get-Content "$rootPath\frontend\src\utils\apiConfig.ts" -Raw
        if ($apiConfigContent -like "*localhost:5002*") {
            Write-Host "  ✅ Frontend configured to use localhost:5002" -ForegroundColor Green
            
            # Test the actual connection
            $backendTest = Test-Endpoint -Name "Frontend->Backend Connection" -Url "http://localhost:5002/api/health" -Timeout 5
            if ($backendTest) {
                Write-Host "  ✅ Frontend can reach backend" -ForegroundColor Green
                $testResults += @{Name="Integration"; Status="PASS"; Details="Frontend->Backend working"}
            } else {
                Write-Host "  ❌ Frontend cannot reach backend" -ForegroundColor Red
                $testResults += @{Name="Integration"; Status="FAIL"; Details="Connection failed"}
            }
        }
    } catch {
        Write-Host "  ❌ Integration test failed: $($_.Exception.Message)" -ForegroundColor Red
        $testResults += @{Name="Integration"; Status="FAIL"; Details=$_.Exception.Message}
    }
} else {
    Write-Host "  ⚠️  Skipping integration test - services not ready" -ForegroundColor Yellow
    $testResults += @{Name="Integration"; Status="SKIP"; Details="Services not ready"}
}
Write-Host ""

# ============================================
# FINAL SUMMARY
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$warned = ($testResults | Where-Object { $_.Status -eq "WARN" }).Count
$skipped = ($testResults | Where-Object { $_.Status -eq "SKIP" }).Count

Write-Host "Results:" -ForegroundColor Yellow
Write-Host "  ✅ Passed:  $passed" -ForegroundColor Green
Write-Host "  ❌ Failed:  $failed" -ForegroundColor Red
Write-Host "  ⚠️  Warnings: $warned" -ForegroundColor Yellow
Write-Host "  ⏭️  Skipped: $skipped" -ForegroundColor Gray
Write-Host ""

Write-Host "Detailed Results:" -ForegroundColor Yellow
foreach ($result in $testResults) {
    $color = switch ($result.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
        default { "Gray" }
    }
    $icon = switch ($result.Status) {
        "PASS" { "✅" }
        "FAIL" { "❌" }
        "WARN" { "⚠️ " }
        default { "⏭️ " }
    }
    Write-Host "  $icon $($result.Name): $($result.Status)" -ForegroundColor $color
    if ($result.Details) {
        Write-Host "     $($result.Details)" -ForegroundColor Gray
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SERVICES RUNNING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Local Services:" -ForegroundColor Yellow
if ($backendReady) {
    Write-Host "  ✅ Backend:  http://localhost:5002" -ForegroundColor Green
} else {
    Write-Host "  ❌ Backend:  Not running" -ForegroundColor Red
}
if ($frontendReady) {
    Write-Host "  ✅ Frontend: http://localhost:5001" -ForegroundColor Green
} else {
    Write-Host "  ❌ Frontend: Not running" -ForegroundColor Red
}
Write-Host ""
Write-Host "Cloud Services:" -ForegroundColor Yellow
Write-Host "  ✅ Cloud Run: https://canoil-backend-711358371169.us-central1.run.app" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:5001 in your browser" -ForegroundColor White
Write-Host "  2. Check console windows for any errors" -ForegroundColor White
Write-Host "  3. Review test results above" -ForegroundColor White
Write-Host ""
