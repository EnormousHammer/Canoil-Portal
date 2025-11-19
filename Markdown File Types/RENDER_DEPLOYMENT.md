# Render Deployment - Using Existing Google Drive Setup

## You Already Have Everything! ✅

Your app already has Google Drive API set up. For Render, just:

## Simple Steps:

### 1. Deploy to Render

1. Go to [Render.com](https://render.com)
2. New → Blueprint (or New Web Service)
3. Connect GitHub repo
4. Render reads `render.yaml` → Deploys automatically

### 2. Set Environment Variables in Render

In Render Dashboard → Your Backend Service → Environment Variables:

**Required:**
```
USE_GOOGLE_DRIVE_API=true
```

**Optional (if you already have credentials):**
```
GOOGLE_DRIVE_CREDENTIALS={"web":{"client_id":"...","client_secret":"..."}}
```

Or upload `google_drive_credentials.json` as a secret file.

### 3. That's It!

Your existing Google Drive code will:
- ✅ Connect to Google Drive API (if `USE_GOOGLE_DRIVE_API=true`)
- ✅ Use saved token (if exists)
- ✅ Fall back to local G: Drive (if API not enabled)

## What's Different on Render?

**Local Development:**
- Uses `google_drive_credentials.json` file
- Opens browser for auth (`run_local_server`)

**Render Deployment:**
- Uses environment variable `GOOGLE_DRIVE_CREDENTIALS`
- Needs manual auth URL (I'll add endpoint for this)

**Or:** Just use the local G: Drive fallback on Render (no Google Drive API needed if you mount G: Drive, but Render doesn't support that).

---

## Quick Answer:

**For Render + Google Drive API:**

1. Set `USE_GOOGLE_DRIVE_API=true` in Render
2. Add your existing Google credentials (from Google Cloud Console) as environment variable
3. Authenticate once (manual step)
4. Done - uses your existing Google Drive connection!

Your code already supports this! ✅

