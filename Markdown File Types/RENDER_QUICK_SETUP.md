# Render Deployment - Quick Setup

## You Already Have Everything! ✅

Your app already has all configuration set up locally. Just copy it to Render:

## Simple Steps:

### 1. Check Your Local `.env` File

Look at your local `.env` file (in root or `backend/` folder). It should have:
- `OPENAI_API_KEY=...`
- `USE_GOOGLE_DRIVE_API=...` (maybe)
- Other settings

### 2. Copy to Render

In Render Dashboard → Backend Service → Environment Variables:

**Copy each line from your `.env` file:**
- If your `.env` has: `OPENAI_API_KEY=sk-...`
- Add to Render: Key = `OPENAI_API_KEY`, Value = `sk-...`

### 3. Add Google Drive Credentials (if using API)

If you're using Google Drive API:
- Download "Canoil Expert" JSON from Google Cloud Console
- Add to Render: Key = `GOOGLE_DRIVE_CREDENTIALS`, Value = (paste JSON content)

### 4. Upload Gmail Credentials File (optional)

Your `backend/gmail_credentials/credentials.json` file:
- Upload to Render as a secret file, OR
- Copy content to environment variable `GMAIL_CREDENTIALS`

## That's It!

Everything else is already configured:
- ✅ Code reads from environment variables
- ✅ All services are set up
- ✅ Paths are configured
- ✅ Everything works

Just copy your local settings to Render! 🚀

