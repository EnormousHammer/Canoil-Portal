# 🔐 Use Your Gmail Instead of "Anonymous Jackalope"

## Super Simple: 3 Steps to Show Your Name

---

## 📋 Step 1: Create OAuth Client (5 minutes)

1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/credentials

2. **Create or Select Project**: 
   - Top of page: Click project dropdown
   - Click "NEW PROJECT"
   - Name it "Canoil Portal" (or anything)
   - Click "CREATE"

3. **Enable Google Sheets API**:
   - Go to: https://console.cloud.google.com/apis/library
   - Search "Google Sheets API"
   - Click it → Click "ENABLE"
   - Do the same for "Google Drive API"

4. **Configure OAuth Consent Screen**:
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - Choose "External" → Click "CREATE"
   - App name: "Canoil Portal"
   - User support email: Your email
   - Developer contact: Your email
   - Click "SAVE AND CONTINUE"
   - Skip "Scopes" → Click "SAVE AND CONTINUE"
   - Add yourself as a test user → Click "SAVE AND CONTINUE"

5. **Create OAuth Client**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: **Desktop app**
   - Name: "Canoil Portal MPS"
   - Click "CREATE"
   - Click "DOWNLOAD JSON"
   - Save it as: `oauth_client_secret.json` in this folder:
     ```
     canoil-portal/backend/oauth_client_secret.json
     ```

---

## 💻 Step 2: Install Libraries

```bash
cd canoil-portal/backend
pip install gspread google-auth google-auth-oauthlib
```

---

## 🚀 Step 3: Run Setup Script

```bash
cd canoil-portal/backend
python setup_gmail_auth.py
```

This will:
1. Open your browser
2. Ask you to log in with Gmail
3. Ask to authorize "Canoil Portal"
4. Save your credentials

**Click "Allow" when prompted!**

---

## ✅ Done!

Now restart your MPS server and it will use YOUR Gmail account:

```bash
python simple_mps_server.py
```

You'll see:
```
✅ User OAuth token found - will authenticate with your Gmail account
📊 Loading MPS data with your Gmail account...
```

**In Google Sheets, instead of "Anonymous Jackalope", it will show YOUR NAME!** 🎉

---

## 🔒 Security Notes

- The credentials are saved locally in `token.pickle`
- Only your computer can use them
- You can revoke access anytime at: https://myaccount.google.com/permissions
- The app can only READ Google Sheets (not write/delete)

---

## 🐛 Troubleshooting

### "OAuth client secret not found"
- Make sure you saved the file as: `oauth_client_secret.json`
- Make sure it's in the `canoil-portal/backend/` folder

### "Access blocked: This app isn't verified"
- Click "Advanced" → "Go to Canoil Portal (unsafe)"
- This is normal for personal projects
- Google shows this because you haven't published the app

### Browser doesn't open
- The script will print a URL
- Copy it and paste in your browser

---

**Much easier than service accounts!** 😊

