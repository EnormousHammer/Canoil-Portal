#!/usr/bin/env python3
"""
Extract Google Drive and Gmail tokens for Render.com environment variables
Run this LOCALLY after you've authenticated once to get the tokens
"""

import os
import json
import pickle
from pathlib import Path

def extract_google_drive_token():
    """Extract Google Drive token"""
    print("\n" + "="*80)
    print("🔍 EXTRACTING GOOGLE DRIVE TOKEN")
    print("="*80)
    
    token_file = Path(__file__).parent / 'google_drive_token.pickle'
    
    if not token_file.exists():
        print("❌ google_drive_token.pickle not found")
        print("💡 Run the backend locally and authenticate with Google Drive first")
        return None
    
    try:
        with open(token_file, 'rb') as f:
            creds = pickle.load(f)
        
        # Convert credentials to JSON-serializable format
        token_dict = {
            'token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_uri': creds.token_uri,
            'client_id': creds.client_id,
            'client_secret': creds.client_secret,
            'scopes': creds.scopes,
        }
        
        token_json = json.dumps(token_dict, indent=None)
        
        print("✅ Google Drive token extracted successfully")
        print("\n📋 ADD THIS TO RENDER ENVIRONMENT VARIABLES:")
        print("-"*80)
        print("Variable name: GOOGLE_DRIVE_TOKEN")
        print("Variable value:")
        print(token_json)
        print("-"*80)
        
        return token_dict
    except Exception as e:
        print(f"❌ Error extracting Google Drive token: {e}")
        import traceback
        traceback.print_exc()
        return None

def extract_gmail_token():
    """Extract Gmail token"""
    print("\n" + "="*80)
    print("🔍 EXTRACTING GMAIL TOKEN")
    print("="*80)
    
    # Try JSON first
    token_json_file = Path(__file__).parent / 'gmail_credentials' / 'token.json'
    token_pickle_file = Path(__file__).parent / 'gmail_credentials' / 'token.pickle'
    
    token_dict = None
    
    # Try JSON file first
    if token_json_file.exists():
        print(f"📄 Found token.json: {token_json_file}")
        try:
            with open(token_json_file, 'r') as f:
                token_dict = json.load(f)
            print("✅ Gmail token loaded from JSON")
        except Exception as e:
            print(f"❌ Error loading JSON token: {e}")
    
    # Fallback to pickle
    elif token_pickle_file.exists():
        print(f"📄 Found token.pickle: {token_pickle_file}")
        try:
            with open(token_pickle_file, 'rb') as f:
                creds = pickle.load(f)
            
            # Convert credentials to JSON-serializable format
            token_dict = {
                'token': creds.token,
                'refresh_token': creds.refresh_token,
                'token_uri': creds.token_uri,
                'client_id': creds.client_id,
                'client_secret': creds.client_secret,
                'scopes': creds.scopes,
            }
            print("✅ Gmail token loaded from pickle")
        except Exception as e:
            print(f"❌ Error loading pickle token: {e}")
    else:
        print("❌ No Gmail token found (checked token.json and token.pickle)")
        print("💡 Run the backend locally and authenticate with Gmail first")
        return None
    
    if token_dict:
        token_json = json.dumps(token_dict, indent=None)
        
        print("\n📋 ADD THIS TO RENDER ENVIRONMENT VARIABLES:")
        print("-"*80)
        print("Variable name: GMAIL_TOKEN")
        print("Variable value:")
        print(token_json)
        print("-"*80)
        
        return token_dict
    
    return None

def main():
    """Main function"""
    print("\n" + "🔐"*40)
    print("TOKEN EXTRACTION FOR RENDER.COM")
    print("🔐"*40)
    print("\nThis script extracts your Google Drive and Gmail authentication tokens")
    print("so you can add them as environment variables on Render.com")
    print("\n⚠️  IMPORTANT: Run this script LOCALLY after authenticating once")
    print("⚠️  NEVER commit these tokens to git or share them publicly!")
    
    # Extract both tokens
    gdrive_token = extract_google_drive_token()
    gmail_token = extract_gmail_token()
    
    # Summary
    print("\n" + "="*80)
    print("📊 SUMMARY")
    print("="*80)
    print(f"Google Drive Token: {'✅ Extracted' if gdrive_token else '❌ Not found'}")
    print(f"Gmail Token: {'✅ Extracted' if gmail_token else '❌ Not found'}")
    
    if gdrive_token or gmail_token:
        print("\n" + "="*80)
        print("📋 NEXT STEPS:")
        print("="*80)
        print("1. Go to Render.com dashboard")
        print("2. Select your 'canoil-portal-backend' service")
        print("3. Go to 'Environment' tab")
        print("4. Add the environment variables shown above")
        print("5. Click 'Save Changes'")
        print("6. Render will automatically redeploy")
        print("\n✅ After that, you'll NEVER have to log in again on Render/ngrok!")
        print("="*80)
    else:
        print("\n" + "="*80)
        print("⚠️  NO TOKENS FOUND")
        print("="*80)
        print("Please:")
        print("1. Run the backend locally: python backend/app.py")
        print("2. Authenticate with Google Drive and Gmail when prompted")
        print("3. Run this script again")
        print("="*80)
    
    print("\n")

if __name__ == '__main__':
    main()








