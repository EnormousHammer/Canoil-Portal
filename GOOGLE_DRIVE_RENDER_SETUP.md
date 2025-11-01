# Google Drive Connection on Render

## How It Connects

The backend connects to your Google Drive using **Google Drive API** (not a local mount).

## Setup Steps

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Create Project** (or select existing)
3. **Enable Google Drive API**:
   - APIs & Services → Library
   - Search "Google Drive API"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials**:
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Configure consent screen first (if needed):
     - User type: External
     - App name: "Canoil Portal"
     - Add your email as test user
   - Application type: **Web application** (for Render deployment)
   - Name: "Canoil Portal Backend"
   - Authorized redirect URIs: 
     - `https://your-backend-url.onrender.com/oauth2callback`
   - Click "Create"
   - **Download JSON file**

### 2. Add Credentials to Render

**Option A: Environment Variable (Recommended)**

1. Open the downloaded JSON credentials file
2. Copy the entire contents
3. Go to Render Dashboard → Your Backend Service → Environment
4. Add new environment variable:
   - **Key**: `GOOGLE_DRIVE_CREDENTIALS`
   - **Value**: Paste the entire JSON content (as one line or multiline)
   - ✅ Save

**Option B: Secret File**

1. Render Dashboard → Your Backend Service → Secrets
2. Upload `google_drive_credentials.json` file
3. It will be available as a file path in the service

### 3. Update Backend Code to Use Environment Variable

The backend needs to read credentials from environment variable instead of file. I'll update this:

```python
# In google_drive_service.py - read from env var if on Render
import os
import json

if os.getenv('GOOGLE_DRIVE_CREDENTIALS'):
    # Use credentials from environment variable (Render)
    creds_json = json.loads(os.getenv('GOOGLE_DRIVE_CREDENTIALS'))
    flow = InstalledAppFlow.from_client_secrets_dict(creds_json, SCOPES)
else:
    # Use credentials file (local development)
    flow = InstalledAppFlow.from_client_secrets_file(
        self.credentials_file, SCOPES)
```

### 4. First-Time Authentication

**Important:** The first time the backend starts on Render:

1. Backend starts → Tries to authenticate
2. Needs to open a browser for OAuth (but Render can't do this)
3. **Solution**: You need to authenticate manually first time

**Manual Authentication Method:**

1. Check Render logs for auth URL (or set up a route to get it)
2. Visit the auth URL in your browser
3. Sign in with Google account that has access to shared drive
4. Grant permissions
5. Get authorization code
6. Submit code to backend (via API endpoint)
7. Backend saves token for future use

### 5. Automatic Re-authentication

After first auth:
- Token is saved on Render's disk
- Backend uses saved token automatically
- Token refreshes automatically when expired
- No manual intervention needed

---

## Configuration on Render

**Environment Variables to Set:**

```
USE_GOOGLE_DRIVE_API=true
GOOGLE_DRIVE_CREDENTIALS={"client_id":"...","client_secret":"...","project_id":"..."}  (full JSON)
GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation
GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions
GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders
```

**Important:**
- Use Google account that has **access to the shared drive**
- OAuth redirect URI must match Render URL
- First auth requires manual step (subsequent ones are automatic)

---

## How It Works

1. **Backend starts** on Render
2. **Checks for saved token** (from previous auth)
3. **If no token**: Needs first-time auth (manual step)
4. **If token exists**: Uses it automatically ✅
5. **If token expired**: Auto-refreshes using refresh token ✅
6. **Connects to Google Drive API**
7. **Finds your shared drive** ("IT_Automation")
8. **Navigates to folder path**
9. **Downloads all JSON files**
10. **Returns data to frontend**

---

## Alternative: Service Account (Easier)

Instead of OAuth, you can use a **Service Account** (no manual auth needed):

1. **Create Service Account**:
   - Google Cloud Console → IAM & Admin → Service Accounts
   - Create Service Account
   - Name: "canoil-portal-backend"
   - Grant it access to shared drive
   - Create key → Download JSON

2. **Add to Render**:
   - Environment variable: `GOOGLE_DRIVE_SERVICE_ACCOUNT` (JSON content)

3. **Update backend** to use service account instead of OAuth

**Service Account Benefits:**
- ✅ No manual authentication needed
- ✅ Works immediately after deployment
- ✅ No browser interaction required
- ✅ Perfect for serverless/cloud deployments

---

## Summary

**Connection Method:** Google Drive API  
**Authentication:** OAuth 2.0 (or Service Account)  
**First Auth:** Manual (one-time)  
**Subsequent:** Automatic (saved token)  
**Location:** Render's backend service  
**Access:** Uses your Google account permissions

The backend connects to **your Google Drive** using **your Google account's permissions** to access the shared drive.

