# 🔧 Gmail Login Persistence - Investigation & Fix

## 🔍 Issue

User has to log in and paste authorization code **every time** they restart the application.

## 🎯 Expected Behavior

- Log in **once**
- Token saved to `gmail_credentials/token.pickle`
- Next launch: Auto-login using saved token
- Only re-login if token expires (usually 7 days)

## ✅ What I've Added

### 1. **Enhanced Logging**

Added detailed logging to track credential loading and refreshing:

```python
✅ Credentials loaded from file
✅ Credentials are still valid
✅ Gmail credentials loaded and service initialized
```

Or if there's an issue:

```python
⚠️ Credentials expired, attempting refresh...
✅ Credentials refreshed successfully
```

Or if refresh fails:

```python
❌ Failed to refresh credentials: [error]
🔄 You'll need to log in again
```

### 2. **Better Token Refresh Logic**

Now properly handles:
- **Expired tokens** → Auto-refresh using refresh_token
- **Missing refresh_token** → Prompt for re-login
- **Refresh failures** → Clear message about needing to log in again

### 3. **OAuth Completion Logging**

Shows what credentials were received:

```python
✅ OAuth token exchange successful
📋 Credentials info:
   - Has access token: True
   - Has refresh token: True
   - Expiry: 2025-01-23 10:30:00
```

## 🧪 Testing Steps

### Step 1: Restart Backend with New Logging

```bash
cd canoil-portal/backend
# Stop current server (Ctrl+C)
python start_server.py
```

**Watch the console output carefully!** You should see:

#### **If Credentials Exist (Should Auto-Login):**

```
🔍 Checking for saved credentials at: [path]/token.pickle
📄 Token file found, loading...
✅ Credentials loaded from file
✅ Credentials are still valid
✅ Gmail service initialized for your@email.com
📧 Pre-fetching emails for instant access...
✅ Email cache warmed up
✅ Gmail credentials loaded and service initialized
```

#### **If Credentials Don't Exist:**

```
🔍 Checking for saved credentials at: [path]/token.pickle
❌ No saved credentials found - please log in
```

#### **If Credentials Expired:**

```
🔍 Checking for saved credentials at: [path]/token.pickle
📄 Token file found, loading...
✅ Credentials loaded from file
⚠️ Credentials expired, attempting refresh...
✅ Credentials refreshed successfully
✅ Gmail service initialized for your@email.com
```

### Step 2: Log In (If Needed)

If you still see "need to log in", do the login flow **one more time**:

1. Click "Connect Gmail"
2. Copy authorization code
3. Paste and submit

**Watch for this in backend console:**

```
🔐 Completing OAuth flow with authorization code...
✅ OAuth token exchange successful
📋 Credentials info:
   - Has access token: True
   - Has refresh token: True  ← THIS IS CRITICAL
   - Expiry: 2025-01-23 10:30:00
✅ Gmail credentials saved
```

### Step 3: Restart Backend Again

```bash
# Stop server (Ctrl+C)
python start_server.py
```

**Should now auto-login without asking for code!**

---

## 🐛 Possible Issues & Fixes

### Issue 1: "Has refresh token: False"

**Problem:** OAuth setup might not be requesting `access_type='offline'`

**Check:** Look at the OAuth start URL in console:
```python
'access_type': 'offline',
'prompt': 'consent'
```

**Fix:** These params ensure you get a refresh token

### Issue 2: Token File Gets Deleted

**Problem:** Maybe antivirus or cleanup script is deleting it

**Check:** Does `canoil-portal/backend/gmail_credentials/token.pickle` exist after restart?

```bash
ls -la "canoil-portal/backend/gmail_credentials/"
```

**Should see:**
```
token.pickle
credentials.json
writing_style.json (after learning style)
```

### Issue 3: Permission Issues

**Problem:** Can't read/write token.pickle

**Check:** File permissions

**Fix:** Make sure the backend process has read/write access to `gmail_credentials/` folder

### Issue 4: Credentials Expire and Can't Refresh

**Problem:** Refresh token is revoked or invalid

**Symptoms:** See this in logs:
```
❌ Failed to refresh credentials: invalid_grant
🔄 You'll need to log in again
```

**Fix:** This is normal if:
- You changed Gmail password
- You revoked app access in Google account settings
- Token is older than 6 months (Google expires them)

**Solution:** Just log in again, it will generate a new refresh token

---

## 📊 Debug Checklist

Run through this when backend starts:

- [ ] See "Checking for saved credentials"?
- [ ] Token file found?
- [ ] Credentials loaded successfully?
- [ ] Credentials valid or refreshed?
- [ ] Gmail service initialized?
- [ ] Can see your email address in logs?

If **ALL YES** → Should be auto-logged in! ✅

If **ANY NO** → That's where the problem is

---

## 🔒 Security Note

The `token.pickle` file contains **active OAuth tokens** that grant access to your Gmail.

**Keep it safe:**
- ✅ It's in `gmail_credentials/` which should be in `.gitignore`
- ✅ Only accessible by backend process
- ❌ Don't share this file
- ❌ Don't commit to git

---

## 💡 What Should Happen Now

1. **First Time:** Log in once → Token saved
2. **Next Launch:** Auto-login from token → No code needed
3. **Token Expires (7 days):** Auto-refresh → Still no code needed
4. **Refresh Fails (rare):** Need to log in again

---

## 🎉 Expected Outcome

After this fix, you should:

✅ **Log in ONCE**  
✅ **Backend always auto-connects on restart**  
✅ **No more copy-paste authorization code**  
✅ **Only re-login if token is revoked or expired (rare)**

---

## 📝 Test Results (Fill This In)

**Date:** _____________

**Backend Restart #1:**
- [ ] Auto-logged in
- [ ] Had to log in manually

**Backend Restart #2:**
- [ ] Auto-logged in
- [ ] Had to log in manually

**Backend Restart #3:**
- [ ] Auto-logged in
- [ ] Had to log in manually

**Console Messages Seen:**
```
[Paste what you see in backend console]
```

---

## 🔍 Next Steps

1. **Restart backend** with new logging
2. **Check console output** - see what it says
3. **Copy-paste the console output** so I can see exactly what's happening
4. Based on that, we'll know exactly why it's not persisting

**The enhanced logging will tell us exactly what's going wrong!** 🚀

