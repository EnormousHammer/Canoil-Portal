GMAIL API SETUP - REQUIRED BEFORE FIRST USE
==========================================

You need to place your Gmail OAuth credentials.json file here.

QUICK STEPS:
1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "Gmail API"
4. Create OAuth 2.0 credentials (Desktop app type)
5. Download the credentials.json file
6. Place it HERE in this folder

IMPORTANT:
- Filename must be exactly: credentials.json
- Also add this redirect URI in Google Cloud Console:
  http://localhost:5002/api/email/auth/callback

Full detailed instructions in:
../GMAIL_EMAIL_ASSISTANT_SETUP.md

After placing credentials.json here, restart the backend server.

