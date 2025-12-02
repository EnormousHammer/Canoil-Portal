# ✅ NEVER AUTHENTICATE AGAIN - Complete Guide

## How Authentication Works

### **Cloud Run (Production) - Service Account (PERMANENT) ✅**

Cloud Run uses a **Service Account** which **NEVER expires**:
- ✅ No OAuth consent needed
- ✅ No token refresh needed  
- ✅ Works forever once set up
- ✅ Stored in Google Cloud Secret Manager

**Current Setup:**
- Secret: `google-drive-credentials` in Google Cloud Secret Manager
- Mounted as: `GOOGLE_DRIVE_SA_JSON` environment variable
- Service Account email: `canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com`

**To Verify It's Working:**
1. Check Cloud Run logs - should see: `"✅ Google Drive API authenticated successfully using Service Account"`
2. If you see OAuth prompts, the service account isn't configured correctly

---

### **Local Development - OAuth Token (Auto-Refreshes) ✅**

Local development uses OAuth tokens that **auto-refresh**:
- Token saved in: `backend/google_drive_token.pickle`
- When token expires → automatically refreshes using `refresh_token`
- No manual login needed after first time

**First Time Setup (One Time Only):**
1. Run backend locally: `cd backend && python app.py`
2. Follow OAuth flow in browser
3. Token saved to file
4. **Never have to do this again** - token auto-refreshes

---

## ✅ Ensuring Permanent Authentication

### For Cloud Run:

**Step 1: Verify Service Account Secret Exists**
```powershell
gcloud secrets describe google-drive-credentials --project=dulcet-order-474521-q1
```

**Step 2: Verify Service Account Has Drive Access**
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=dulcet-order-474521-q1
2. Find: `canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com`
3. Make sure it has "Service Account User" role

**Step 3: Share Google Drive with Service Account**
1. Go to Google Drive
2. Right-click "IT_Automation" shared drive → Share
3. Add: `canoil-backend@dulcet-order-474521-q1.iam.gserviceaccount.com`
4. Permission: "Viewer" or "Editor"
5. Click "Send"

**Step 4: Verify in Cloud Run Logs**
```powershell
gcloud run services logs read canoil-backend --region=us-central1 --project=dulcet-order-474521-q1 --limit=50
```

Look for:
- ✅ `"✅ Google Drive API authenticated successfully using Service Account"`
- ❌ If you see OAuth prompts → service account not working

---

### For Local Development:

**One-Time Setup:**
1. Start backend: `cd backend && python app.py`
2. Authenticate once in browser
3. Token saved to `backend/google_drive_token.pickle`
4. **Done forever** - token auto-refreshes

**If Token Expires (Rare):**
- Backend automatically refreshes it using `refresh_token`
- No action needed
- Only fails if `refresh_token` is revoked (very rare)

---

## Troubleshooting

### Problem: Cloud Run Still Asking for OAuth

**Cause:** Service account not configured or not shared with Drive

**Fix:**
1. Check secret exists: `gcloud secrets list --project=dulcet-order-474521-q1`
2. Verify service account email matches the one shared with Drive
3. Re-share Drive with service account
4. Redeploy Cloud Run service

### Problem: Local Development Asking for Login Every Time

**Cause:** Token file deleted or corrupted

**Fix:**
1. Delete `backend/google_drive_token.pickle`
2. Restart backend
3. Authenticate once
4. Token will be saved and auto-refresh

---

## Summary

✅ **Cloud Run**: Uses Service Account (permanent, no expiration)
✅ **Local Dev**: Uses OAuth token (auto-refreshes, never expires)
✅ **Both**: Set up once, work forever

**You should NEVER have to authenticate again after initial setup!**

