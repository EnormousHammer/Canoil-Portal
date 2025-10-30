# Gmail Email Assistant Setup Guide

## Overview
The Gmail Email Assistant integrates with your Gmail account to provide AI-powered email response generation that learns and mimics your writing style.

## Features
- ✅ Gmail OAuth2 authentication (secure, no password storage)
- ✅ Read inbox emails
- ✅ Analyze your writing style from sent emails using OpenAI
- ✅ Generate AI responses that match your communication style
- ✅ Windows desktop notifications for draft email alerts
- ✅ User-specific feature (only available for Haron at the moment)

## Prerequisites
1. OpenAI API key (already configured in your `.env` file)
2. Gmail account
3. Google Cloud Project with Gmail API enabled

## Setup Steps

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Name it something like "Canoil Email Assistant"

### Step 2: Enable Gmail API

1. In your Google Cloud project, go to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click on "Gmail API" and click **Enable**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in required fields:
     - App name: "Canoil Email Assistant"
     - User support email: Your email
     - Developer contact email: Your email
   - Add scopes (optional for now)
   - Add test users: Add your Gmail address
   - Save and continue

4. Back to Create OAuth client ID:
   - Application type: **Desktop app**
   - Name: "Canoil Email Assistant Desktop"
   - Click **Create**

5. **Download the credentials JSON file**
6. Rename it to `credentials.json`
7. Place it in: `canoil-portal/backend/gmail_credentials/credentials.json`

### Step 4: Install Python Dependencies

```bash
cd canoil-portal/backend
pip install -r requirements.txt
```

This will install:
- `google-auth`
- `google-auth-oauthlib`
- `google-auth-httplib2`
- `google-api-python-client`

### Step 5: Configure Authorized Redirect URIs

1. In Google Cloud Console, go to **APIs & Services** > **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   - `http://localhost:5002/api/email/auth/callback`
4. Save the changes

### Step 6: Start the Backend Server

```bash
cd canoil-portal/backend
python app.py
```

Or if you're using the start script:
```bash
python start_server.py
```

The server should start on `http://localhost:5002`

### Step 7: Test the Email Assistant

1. Log in to the Canoil Portal as Haron (haron@canoilcanadaltd.com)
2. You should see the **Email Assistant** card instead of Smart SO Entry
3. Click on Email Assistant
4. Click **Connect Gmail**
5. A popup window will open asking you to:
   - Select your Google account
   - Grant permissions to the app
   - Allow access to read and send emails
6. After authorization, the popup will close
7. The Email Assistant should now show as connected

### Step 8: Analyze Your Writing Style

1. Click **Analyze Now** button
2. The system will:
   - Fetch up to 50 of your sent emails
   - Analyze your writing patterns with OpenAI
   - Create a writing style profile
3. This may take 30-60 seconds depending on email count
4. Once complete, you'll see "Ready" status

### Step 9: Use AI Email Responses

1. Click **Refresh** to load your inbox
2. Click on any email
3. Click **AI Reply** button
4. The system will:
   - Fetch the full email content
   - Generate a response matching your writing style
   - Show you the draft for review
5. A Windows notification will appear alerting you to check the draft

## File Structure

```
canoil-portal/backend/
├── gmail_email_service.py          # Gmail service implementation
├── app.py                          # Flask routes for email API
├── requirements.txt                # Python dependencies
├── gmail_credentials/              # Created automatically
│   ├── credentials.json           # OAuth credentials (YOU CREATE THIS)
│   ├── token.pickle               # Generated after first auth
│   ├── writing_style.json         # Generated after style analysis
│   └── flow.pickle                # Temporary OAuth flow state
└── GMAIL_EMAIL_ASSISTANT_SETUP.md # This file
```

## API Endpoints

All endpoints are prefixed with `/api/email/`

- `GET /api/email/status` - Check Gmail connection status
- `GET /api/email/auth/start` - Start OAuth flow
- `GET /api/email/auth/callback` - OAuth callback handler
- `POST /api/email/auth/logout` - Disconnect Gmail
- `GET /api/email/inbox` - Fetch inbox emails
- `POST /api/email/analyze-style` - Analyze writing style
- `POST /api/email/generate-response` - Generate AI email response

## Security Notes

1. **credentials.json** contains your OAuth client ID and secret
   - Keep this file secure
   - Never commit to Git
   - Only share with authorized developers

2. **token.pickle** contains your access and refresh tokens
   - This gives access to your Gmail
   - Never commit to Git
   - Automatically refreshed when expired

3. OAuth2 scopes requested:
   - `gmail.readonly` - Read emails
   - `gmail.send` - Send emails
   - `gmail.compose` - Create drafts
   - `gmail.modify` - Modify email labels

## Troubleshooting

### "Gmail service not available"
- Make sure you've installed the Google API dependencies
- Check that `credentials.json` exists in the correct location
- Restart the backend server

### "Authorization failed"
- Verify redirect URI is configured correctly in Google Cloud Console
- Make sure you're using the same OAuth client credentials
- Clear browser cookies and try again

### "OpenAI not available"
- Check that `OPENAI_API_KEY` is set in your `.env` file
- Verify the API key is valid
- Check OpenAI API usage limits

### "No sent emails found to analyze"
- Make sure you have sent emails from this Gmail account
- Try with a different Gmail account that has sent emails
- Check Gmail API permissions

### Token expired
- The system automatically refreshes tokens
- If refresh fails, logout and login again

## Gmail API Quotas

Google provides generous quotas for Gmail API:
- 1 billion quota units per day
- Most operations cost 1 unit
- Sending emails costs 100 units

For normal usage, you won't hit these limits.

## Future Enhancements

Potential features for future development:
- [ ] Send emails directly from the assistant
- [ ] Email threading and conversation context
- [ ] Multiple writing styles for different recipients
- [ ] Email templates and quick responses
- [ ] Integration with Carolina's shipment notifications
- [ ] Automatic parsing of shipment details into forms
- [ ] Email scheduling
- [ ] Multi-language support

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Google Cloud Console for API errors
3. Check backend logs for detailed error messages
4. Verify all setup steps were completed

## Version History

- **v1.0.0** (Current) - Initial implementation
  - Gmail OAuth2 authentication
  - Inbox email fetching
  - Writing style analysis with OpenAI
  - AI-powered email response generation
  - Windows notifications
  - User-specific access (Haron only)

