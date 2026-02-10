# Push this canoil-portal app to a NEW GitHub repo (copy).
# Run from the canoil-portal folder. Leaves this repo and origin unchanged.
# Usage: .\push-copy-to-new-repo.ps1 -NewRepoUrl "https://github.com/YourOrg/canoil-portal-copy.git"

param(
    [Parameter(Mandatory = $true)]
    [string]$NewRepoUrl
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Validate URL (basic GitHub HTTPS check)
if ($NewRepoUrl -notmatch '^https://github\.com/') {
    Write-Host "Usage: .\push-copy-to-new-repo.ps1 -NewRepoUrl `"https://github.com/YourOrg/your-repo-name.git`"" -ForegroundColor Yellow
    Write-Host "Ensure the repo exists on GitHub (empty, no README)." -ForegroundColor Yellow
    exit 1
}
if (-not $NewRepoUrl.EndsWith(".git")) { $NewRepoUrl = $NewRepoUrl.TrimEnd('/') + ".git" }

$remoteName = "copy"
# If already added, remove so we can re-add with correct URL
git remote remove $remoteName 2>$null
$null = $LASTEXITCODE  # ignore remove failure when remote doesn't exist

Write-Host "Adding remote '$remoteName' -> $NewRepoUrl" -ForegroundColor Cyan
git remote add $remoteName $NewRepoUrl

Write-Host "Pushing main to the new repo (this creates the copy)..." -ForegroundColor Cyan
git push $remoteName main

Write-Host ""
Write-Host "Done. The new GitHub repo now has a full copy of this app." -ForegroundColor Green
Write-Host "This folder is unchanged; origin still points to the original repo." -ForegroundColor Green
Write-Host "Clone the new repo to a different folder to work from the copy. See COPY-TO-NEW-GITHUB-REPO.md" -ForegroundColor Green
