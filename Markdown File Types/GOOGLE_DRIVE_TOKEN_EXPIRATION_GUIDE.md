# Google Drive Token Expiration Guide

## ⏰ Token Expiration Times

### Access Token
- **Expires:** Every **1 hour**
- **Auto-refreshes:** Yes (if refresh token is valid)
- **What happens:** Code automatically refreshes it using the refresh token

### Refresh Token
- **Expires:** **6 months** of inactivity (if not used)
- **Never expires:** If used regularly (refreshed at least once every 6 months)
- **Can be revoked:** If you change Google password or revoke app access

## 🔄 How Auto-Refresh Works

Your code automatically handles token refresh:

```python
# In google_drive_service.py
if creds and creds.expired and creds.refresh_token:
    try:
        creds.refresh(Request())  # Auto-refresh using refresh token
        print("✅ Refreshed expired Google Drive token")
    except Exception as e:
        print(f"⚠️ Failed to refresh token: {e}")
```

**What this means:**
- ✅ Access token expires every hour → **Auto-refreshes** (you don't notice)
- ✅ Refresh token stays valid → **No action needed** (for months)
- ❌ Refresh token expires/revoked → **Need new token** (rare)

## 🚨 When You Need to Update Token

You only need to update `GOOGLE_DRIVE_TOKEN` in Vercel if:

1. **Refresh token expired** (6 months of no use)
2. **Refresh token revoked** (changed password, revoked access)
3. **Refresh fails** (network error, invalid grant)

**This is RARE** - usually happens:
- Every 6 months (if app not used)
- If you change Google password
- If you revoke app access in Google account settings

## 📋 How to Check if Token is Expired

### Method 1: Check Vercel Logs
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click latest deployment → Functions → `api/index` → Logs
3. Look for:
   - `✅ Refreshed expired Google Drive token` → Working fine
   - `⚠️ Failed to refresh token` → Need new token
   - `❌ Google Drive authentication failed` → Need new token

### Method 2: Test Debug Endpoint
Visit: `https://your-project.vercel.app/api/debug`

Check:
- `google_drive_service.authenticated`: Should be `true`
- If `false`, check for `auth_error` message

### Method 3: Test Data Endpoint
Visit: `https://your-project.vercel.app/api/data`

- ✅ Returns data → Token is valid
- ❌ Returns 500 error → Check logs for token error

## 🔧 How to Update Token in Vercel

### Step 1: Get Fresh Token Locally

```bash
# Make sure local backend has authenticated
cd backend
python app.py
# Let it authenticate if needed

# Extract token
python get_vercel_env_vars.py
# This creates vercel_token.txt with token JSON
```

### Step 2: Update in Vercel

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Find `GOOGLE_DRIVE_TOKEN`
3. Click three dots (⋯) → **Edit**
4. Copy entire JSON from `vercel_token.txt`
5. Paste into Value field
6. Click **Save**
7. Vercel auto-redeploys

## 💡 Best Practices

### 1. Monitor Token Health
- Check `/api/debug` endpoint weekly
- Watch Vercel logs for refresh errors
- Set up alerts if authentication fails

### 2. Keep Local Token Fresh
- Run local backend occasionally (keeps refresh token active)
- Extract fresh token before it expires
- Update Vercel token proactively

### 3. Handle Expiration Gracefully
- Code already handles auto-refresh
- Only need manual update if refresh fails
- Check logs to see what's happening

## 📊 Token Lifecycle

```
Day 1: Get token → Save to Vercel
├─ Hour 1: Access token expires → Auto-refresh ✅
├─ Hour 2: Access token expires → Auto-refresh ✅
├─ Hour 3: Access token expires → Auto-refresh ✅
└─ ... (continues for months)

Month 6: If not used → Refresh token expires
└─ Need to get new token manually

OR

Month 6: If used regularly → Refresh token stays valid
└─ Continues working indefinitely
```

## 🎯 Summary

**Access Token:**
- Expires: **Every 1 hour**
- Action: **Auto-refreshes** (no action needed)

**Refresh Token:**
- Expires: **6 months** of inactivity
- Action: **Update Vercel token** (rare, only if expired/revoked)

**You only need to update the token:**
- Every 6 months (if app not used)
- If you change Google password
- If you revoke app access
- If refresh fails (check logs)

**Most of the time:** Token auto-refreshes and you don't need to do anything! ✅

