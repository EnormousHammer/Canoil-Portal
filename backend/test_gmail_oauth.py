#!/usr/bin/env python3
"""
Test Gmail OAuth flow to verify credentials work
"""
import os
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify'
]

credentials_path = Path(__file__).parent / 'gmail_credentials' / 'credentials.json'

print(f"Looking for credentials at: {credentials_path}")
print(f"File exists: {credentials_path.exists()}")

if not credentials_path.exists():
    print("ERROR: credentials.json not found!")
    exit(1)

print("\n🔐 Starting OAuth flow...")
print("This will open your browser for Google login.")
print("Authorize the app, then the browser will close automatically.\n")

try:
    flow = InstalledAppFlow.from_client_secrets_file(
        str(credentials_path),
        SCOPES
    )
    
    # This opens browser and handles OAuth
    creds = flow.run_local_server(port=0)
    
    print("\n✅ SUCCESS! OAuth flow completed.")
    print(f"Access token received: {creds.token[:20]}...")
    print(f"Token expires: {creds.expiry}")
    
    # Save for later use
    import pickle
    token_path = Path(__file__).parent / 'gmail_credentials' / 'token.pickle'
    with open(token_path, 'wb') as token:
        pickle.dump(creds, token)
    
    print(f"\n✅ Token saved to: {token_path}")
    print("\nYou can now use the Email Assistant!")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print(f"Error type: {type(e)}")
    import traceback
    traceback.print_exc()

