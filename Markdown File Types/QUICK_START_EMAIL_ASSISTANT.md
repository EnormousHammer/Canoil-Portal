# 🚀 Email Assistant - Quick Start (5 Minutes)

## What You Get
AI-powered email assistant that learns YOUR writing style and generates responses that sound exactly like you wrote them. **Only visible for Haron.**

## ⚡ Quick Setup (3 Steps)

### 1️⃣ Install Dependencies (1 minute)
```bash
cd canoil-portal/backend
pip install -r requirements.txt
```

### 2️⃣ Set Up Gmail API (5 minutes)
1. Go to https://console.cloud.google.com/
2. Create project: "Canoil Email Assistant"
3. Enable "Gmail API"
4. Create OAuth 2.0 credentials (Desktop app)
5. Download `credentials.json`
6. Create folder: `backend/gmail_credentials/`
7. Place `credentials.json` there
8. Add redirect URI: `http://localhost:5002/api/email/auth/callback`

### 3️⃣ Start & Test (1 minute)
```bash
# Start backend
cd canoil-portal/backend
python app.py

# In another terminal, start frontend
cd canoil-portal/frontend
npm run dev
```

## 🎯 How to Use

1. Log in as Haron (haron@canoilcanadaltd.com)
2. Click **Email Assistant** card (replaces Smart SO Entry)
3. Click **Connect Gmail** → Authorize in popup
4. Click **Analyze Now** → AI learns your writing style (30-60 seconds)
5. Click **Refresh** → Load your inbox
6. Click **AI Reply** on any email → Get instant draft response
7. Windows notification pops up when draft is ready!

## ✨ What It Does

- 🔐 **Secure Gmail login** (OAuth2, no passwords stored)
- 🧠 **Learns your writing style** from your sent emails
- ✍️ **Generates responses** that sound like YOU
- 🔔 **Windows notifications** for draft alerts
- 💎 **Beautiful UI** matching your app's style

## 📚 Need Help?

- **Full setup guide:** `backend/GMAIL_EMAIL_ASSISTANT_SETUP.md`
- **Implementation details:** `EMAIL_ASSISTANT_IMPLEMENTATION.md`
- **Troubleshooting:** Check the setup guide

## 🎊 That's It!

You're ready to automate your emails with AI! 🚀

---
*Questions? Check the detailed guides or backend logs for errors.*

