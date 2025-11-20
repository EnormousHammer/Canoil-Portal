# Google Cloud Run - Detailed Fix Guide

## Your Project Details
- **Project ID:** `dulcet-order-474521-q1`
- **Region:** `us-central1`
- **Service Name:** `canoil-backend`

---

## STEP 1: Check if Service is Deployed

### Get your Cloud Run URL:
```powershell
gcloud run services describe canoil-backend --region=us-central1 --project=dulcet-order-474521-q1 --format="value(status.url)"
```

**Expected Output:** Something like:
```
https://canoil-backend-xxxxxxxxxxxxx-uc.a.run.app
```

### View Service in Console:
**Direct Link:** https://console.cloud.google.com/run/detail/us-central1/canoil-backend?project=dulcet-order-474521-q1

---

## STEP 2: Test Backend Health

### Method A: Browser Test
1. Copy the URL from Step 1
2. Add `/api/health` to the end
3. Open in browser: `https://canoil-backend-xxxxxxxxxxxxx-uc.a.run.app/api/health`

### Method B: PowerShell Test
```powershell
# Replace YOUR-URL with your actual Cloud Run URL from Step 1
$url = "YOUR-CLOUD-RUN-URL"
Invoke-RestMethod -Uri "$url/api/health" | ConvertTo-Json -Depth 5
```

### What to Look For:
```json
{
  "status": "healthy",
  "google_drive_api_enabled": true,
  "google_drive_authenticated": true,    ← THIS IS KEY!
  "gdrive_accessible": true,
  "issues": []
}
```

**If `google_drive_authenticated` is `false`** → Go to Step 3
**If you get an error/timeout** → Go to Step 4
**If everything is `true`** → Go to Step 5

---

## STEP 3: Fix Google Drive Authentication

### Problem: Secret Not Configured

### 3A: Check if Secret Exists
**Direct Link:** https://console.cloud.google.com/security/secret-manager?project=dulcet-order-474521-q1

**Look for:** A secret named `google-drive-credentials`

### 3B: If Secret Does NOT Exist - Create It

**Step 3B.1:** Find your service account JSON file locally:
```powershell
# Check if file exists
Test-Path "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend\google_service_account.json"
```

If this returns `False`, you need to create a service account first (see Step 3C).

**Step 3B.2:** Create the secret via Cloud Console:
1. Go to: https://console.cloud.google.com/security/secret-manager?project=dulcet-order-474521-q1
2. Click **"CREATE SECRET"**
3. Name: `google-drive-credentials`
4. Secret value: Click **"BROWSE"** and upload your `google_service_account.json` file
5. Click **"CREATE SECRET"**

**OR create via command line:**
```powershell
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

gcloud secrets create google-drive-credentials `
  --data-file="backend\google_service_account.json" `
  --project=dulcet-order-474521-q1
```

### 3C: If Service Account JSON Doesn't Exist - Create Service Account

**Step 3C.1:** Go to Service Accounts:
**Direct Link:** https://console.cloud.google.com/iam-admin/serviceaccounts?project=dulcet-order-474521-q1

**Step 3C.2:** Create Service Account:
1. Click **"CREATE SERVICE ACCOUNT"**
2. Service account name: `canoil-backend-sa`
3. Service account ID: `canoil-backend-sa` (auto-filled)
4. Click **"CREATE AND CONTINUE"**
5. Grant roles:
   - Click **"Select a role"**
   - Choose: **"Basic" → "Editor"** (or use "Viewer" for read-only)
   - Click **"CONTINUE"**
6. Click **"DONE"**

**Step 3C.3:** Create and Download Key:
1. Find your new service account in the list
2. Click the **3 dots (⋮)** on the right → **"Manage keys"**
3. Click **"ADD KEY"** → **"Create new key"**
4. Choose **"JSON"**
5. Click **"CREATE"**
6. **Save the downloaded file as:** `G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\backend\google_service_account.json`

**Step 3C.4:** Give Service Account Access to Google Drives:

For **IT_Automation** Shared Drive:
1. Open Google Drive: https://drive.google.com/drive/u/0/shared-drives
2. Find **"IT_Automation"** shared drive
3. Right-click → **"Manage members"**
4. Click **"Add members"**
5. Paste service account email: `canoil-backend-sa@dulcet-order-474521-q1.iam.gserviceaccount.com`
6. Set role: **"Content manager"** or **"Viewer"**
7. Uncheck **"Notify people"**
8. Click **"Send"**

Repeat for **Sales_CSR** Shared Drive:
1. Find **"Sales_CSR"** shared drive
2. Follow same steps as above

**Now go back to Step 3B to create the secret!**

### 3D: Grant Cloud Run Access to Secret

**Direct Link to IAM:** https://console.cloud.google.com/iam-admin/iam?project=dulcet-order-474521-q1

**Via Command Line:**
```powershell
# Get your project number
$projectNumber = gcloud projects describe dulcet-order-474521-q1 --format="value(projectNumber)"

# Grant access
gcloud secrets add-iam-policy-binding google-drive-credentials `
  --member="serviceAccount:${projectNumber}-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor" `
  --project=dulcet-order-474521-q1
```

### 3E: Redeploy Cloud Run with Secret

```powershell
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"
.\DEPLOY_TO_CLOUD_RUN.ps1
```

**Wait 2-3 minutes for deployment to complete, then test again (Step 2).**

---

## STEP 4: View Logs (If Backend Not Responding)

### View in Console:
**Direct Link:** https://console.cloud.google.com/logs/query?project=dulcet-order-474521-q1

**Query to use:**
```
resource.type="cloud_run_revision"
resource.labels.service_name="canoil-backend"
severity>=WARNING
```

### View via Command Line:
```powershell
# Last 50 error/warning logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=canoil-backend AND severity>=WARNING" `
  --limit=50 `
  --project=dulcet-order-474521-q1
```

**Look for errors related to:**
- Authentication
- Secrets
- Google Drive API
- Memory/timeout issues

---

## STEP 5: Test Data Loading

### Test in Browser:
```
https://canoil-backend-xxxxxxxxxxxxx-uc.a.run.app/api/data
```

**Warning:** This will take 2-4 minutes on first load!

### Test via PowerShell:
```powershell
$url = "YOUR-CLOUD-RUN-URL"
$response = Invoke-RestMethod -Uri "$url/api/data" -TimeoutSec 300
Write-Host "Files loaded: $(($response.data.PSObject.Properties).Count)"
```

---

## STEP 6: Update Frontend to Use Cloud Run

### 6A: Get Your Exact Cloud Run URL
```powershell
gcloud run services describe canoil-backend --region=us-central1 --project=dulcet-order-474521-q1 --format="value(status.url)"
```

Copy this URL!

### 6B: Update Vercel Environment Variable

**Direct Link to Vercel Dashboard:**
1. Go to: https://vercel.com/dashboard
2. Find your `canoil-portal` project
3. Click on it
4. Go to: **Settings** → **Environment Variables**
5. Find `VITE_API_URL` or create it if missing
6. Set value to your Cloud Run URL (from 6A)
7. Click **"Save"**

### 6C: Redeploy Frontend
```powershell
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal\frontend"
npm run build
vercel --prod
```

Or push to Git and Vercel will auto-deploy.

---

## QUICK DIAGNOSTIC COMMAND

Run this to check everything at once:

```powershell
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"

# Get URL
$url = gcloud run services describe canoil-backend --region=us-central1 --project=dulcet-order-474521-q1 --format="value(status.url)"

Write-Host "Cloud Run URL: $url" -ForegroundColor Cyan
Write-Host ""

# Test health
Write-Host "Testing health..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$url/api/health"
Write-Host "Status: $($health.status)" -ForegroundColor Green
Write-Host "Google Drive Authenticated: $($health.google_drive_authenticated)" -ForegroundColor $(if($health.google_drive_authenticated){"Green"}else{"Red"})
Write-Host ""

if ($health.google_drive_authenticated) {
    Write-Host "✅ Backend is ready!" -ForegroundColor Green
    Write-Host "Set this URL in Vercel VITE_API_URL:" -ForegroundColor Yellow
    Write-Host $url -ForegroundColor Cyan
} else {
    Write-Host "❌ Google Drive not authenticated!" -ForegroundColor Red
    Write-Host "Fix: https://console.cloud.google.com/security/secret-manager?project=dulcet-order-474521-q1" -ForegroundColor Yellow
}
```

---

## Common Issues and Solutions

### Issue 1: "Secret not found"
**Solution:** Go to Step 3B - Create the secret

### Issue 2: "Permission denied" accessing Google Drive
**Solution:** Go to Step 3C.4 - Add service account to shared drives

### Issue 3: Backend times out loading data
**Solution:** 
- Check logs (Step 4)
- Verify service account has access to both IT_Automation and Sales_CSR drives
- Increase Cloud Run memory: Change `--memory 2Gi` to `--memory 4Gi` in deploy script

### Issue 4: Frontend still shows "No Data"
**Solution:** Go to Step 6 - Update VITE_API_URL in Vercel

---

## Support Links

- **Cloud Run Console:** https://console.cloud.google.com/run?project=dulcet-order-474521-q1
- **Secret Manager:** https://console.cloud.google.com/security/secret-manager?project=dulcet-order-474521-q1
- **Service Accounts:** https://console.cloud.google.com/iam-admin/serviceaccounts?project=dulcet-order-474521-q1
- **Logs:** https://console.cloud.google.com/logs/query?project=dulcet-order-474521-q1
- **IAM:** https://console.cloud.google.com/iam-admin/iam?project=dulcet-order-474521-q1

---

## Next: Run the Quick Diagnostic

```powershell
cd "G:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper\canoil-portal"
.\CHECK_CLOUD_RUN.ps1
```

This will tell you exactly what needs to be fixed!

