# Google Drive API Setup Guide

This guide explains how to configure the Canoil Portal to connect directly to Google Drive API instead of using a local G: Drive mount.

## Overview

By enabling Google Drive API, the application will:
- Connect directly to Google Drive shared drives via API
- Access data without requiring a local G: Drive mount
- Work from any location (cloud, remote servers, etc.)
- Automatically sync with the latest data from Google Drive

## Prerequisites

1. Google Cloud Project with Drive API enabled
2. OAuth 2.0 credentials downloaded
3. Python Google API libraries installed (already in requirements.txt)

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable "Google Drive API":
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure consent screen if needed:
   - Choose "External" (unless you have Workspace)
   - Fill in required fields
   - Add scopes:
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/drive.metadata.readonly`
4. Create OAuth client ID:
   - Application type: "Desktop app"
   - Name: "Canoil Portal"
   - Click "Create"
5. Download the credentials JSON file
6. Save it as `backend/google_drive_credentials.json`

### 3. Configure Environment

1. Set environment variable to enable Google Drive API:
   ```bash
   # In .env file or environment
   USE_GOOGLE_DRIVE_API=true
   ```

2. Or set it when starting the backend:
   ```bash
   USE_GOOGLE_DRIVE_API=true python backend/app.py
   ```

### 4. First-Time Authentication

1. Start the backend server
2. On first run, it will:
   - Open a browser window for Google authentication
   - Ask you to sign in with Google account that has access to the shared drive
   - Grant permissions to access Google Drive
3. After authentication, a token file will be saved at `backend/google_drive_token.pickle`
4. Future requests will use this saved token automatically

### 5. Configure Shared Drive Name

Edit `backend/google_drive_service.py` and update:
```python
SHARED_DRIVE_NAME = "IT_Automation"  # Change to your shared drive name
BASE_FOLDER_PATH = "MiSys/Misys Extracted Data/API Extractions"  # Path within shared drive
```

## How It Works

1. **Initial Setup**: First run authenticates with Google and saves token
2. **Data Loading**: When `/api/data` is called:
   - If `USE_GOOGLE_DRIVE_API=true`, tries Google Drive API first
   - Finds the specified shared drive
   - Navigates to the folder path
   - Gets the latest folder (by date/name)
   - Downloads all JSON files from that folder
   - Returns data to frontend
3. **Fallback**: If Google Drive API fails, falls back to local G: Drive mount

## File Structure

```
backend/
├── google_drive_service.py      # Google Drive API service
├── google_drive_credentials.json  # OAuth credentials (download from Google Cloud)
├── google_drive_token.pickle    # Saved authentication token (auto-generated)
└── app.py                       # Backend with Google Drive API support
```

## Troubleshooting

### "Shared drive not found"
- Check that `SHARED_DRIVE_NAME` matches exactly
- Ensure your Google account has access to the shared drive
- Verify the shared drive exists in Google Drive

### "Folder not found"
- Check that `BASE_FOLDER_PATH` matches the folder structure exactly
- Path should be relative to shared drive root
- Use forward slashes: `folder/subfolder/subfolder2`

### "Credentials file not found"
- Ensure `google_drive_credentials.json` is in the `backend/` folder
- Download credentials from Google Cloud Console

### Authentication Issues
- Delete `google_drive_token.pickle` to re-authenticate
- Ensure OAuth credentials are for "Desktop app" type
- Check that required scopes are added in consent screen

## Benefits

✅ **Always Available**: Works from anywhere, no local mount needed  
✅ **Automatic Sync**: Always gets latest data from Google Drive  
✅ **Cloud-Ready**: Perfect for cloud deployments (Vercel backend, etc.)  
✅ **Multi-User**: Works with any user who has shared drive access  
✅ **Real-Time**: No dependency on local file synchronization  

