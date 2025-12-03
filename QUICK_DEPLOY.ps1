# ================================================================
# QUICK DEPLOY - One command to commit, push, build, and deploy
# Usage: .\QUICK_DEPLOY.ps1 "Your commit message"
# ================================================================

param(
    [Parameter(Position=0)]
    [string]$message = "Quick deploy update"
)

$ErrorActionPreference = "Stop"
$projectId = "dulcet-order-474521-q1"
$region = "us-central1"
$serviceName = "canoil-backend"

Write-Host ""
Write-Host "🚀 QUICK DEPLOY" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Check for changes
$hasChanges = (git status --porcelain) -ne $null

if ($hasChanges) {
    Write-Host "📝 Committing changes: $message" -ForegroundColor Yellow
    git add -A
    git commit -m $message
} else {
    Write-Host "📝 No changes to commit" -ForegroundColor Gray
}

# Push to remote
Write-Host "📤 Pushing to GitHub..." -ForegroundColor Yellow
git push

# Check if backend files changed
$backendChanged = git diff --name-only HEAD~1 | Select-String "backend/"

if ($backendChanged) {
    Write-Host ""
    Write-Host "🔨 Backend changes detected - Building and deploying..." -ForegroundColor Yellow
    
    # Build with Cloud Build
    Write-Host "   Building Docker image..." -ForegroundColor Gray
    gcloud builds submit --tag gcr.io/$projectId/$serviceName ./backend --project=$projectId --quiet 2>&1 | Out-Null
    
    # Deploy to Cloud Run
    Write-Host "   Deploying to Cloud Run..." -ForegroundColor Gray
    gcloud run deploy $serviceName --image gcr.io/$projectId/$serviceName --platform managed --region $region --project=$projectId --quiet 2>&1 | Out-Null
    
    Write-Host "✅ Backend deployed!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⏭️  No backend changes - skipping Cloud Run deploy" -ForegroundColor Gray
    Write-Host "   (Frontend auto-deploys via Vercel)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ DONE!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: Auto-deployed by Vercel (check vercel.com)" -ForegroundColor Cyan
if ($backendChanged) {
    Write-Host "Backend:  https://canoil-backend-711358371169.us-central1.run.app" -ForegroundColor Cyan
}
Write-Host ""

