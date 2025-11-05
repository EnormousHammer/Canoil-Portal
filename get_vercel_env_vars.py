#!/usr/bin/env python3
"""
Helper script to extract Google Drive token and credentials for Vercel environment variables
"""
import os
import json
import pickle
from pathlib import Path

def get_google_drive_token():
    """Extract Google Drive token JSON from pickle file"""
    token_file = Path('backend/google_drive_token.pickle')
    
    if not token_file.exists():
        print("[ERROR] Token file not found:", token_file)
        print("[INFO] Make sure you've authenticated with Google Drive at least once")
        return None
    
    try:
        with open(token_file, 'rb') as f:
            creds = pickle.load(f)
        
        # Convert credentials to JSON
        token_dict = {
            'token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_uri': creds.token_uri,
            'client_id': creds.client_id,
            'client_secret': creds.client_secret,
            'scopes': creds.scopes
        }
        
        token_json = json.dumps(token_dict)
        return token_json
    except Exception as e:
        print(f"[ERROR] Error reading token: {e}")
        return None

def get_google_drive_credentials():
    """Extract Google Drive credentials JSON"""
    creds_file = Path('backend/google_drive_credentials.json')
    gmail_creds_file = Path('backend/gmail_credentials/credentials.json')
    
    # Try Google Drive credentials first
    if creds_file.exists():
        try:
            with open(creds_file, 'r') as f:
                creds_data = json.load(f)
            return json.dumps(creds_data)
        except Exception as e:
            print(f"[WARNING] Error reading credentials file: {e}")
    
    # Fallback to Gmail credentials (might be same OAuth client)
    if gmail_creds_file.exists():
        try:
            with open(gmail_creds_file, 'r') as f:
                creds_data = json.load(f)
            print("[INFO] Using Gmail credentials (might be same OAuth client)")
            return json.dumps(creds_data)
        except Exception as e:
            print(f"[WARNING] Error reading Gmail credentials: {e}")
    
    print("[ERROR] Credentials file not found")
    print("[INFO] Download OAuth credentials from Google Cloud Console")
    return None

def main():
    print("=" * 60)
    print("Vercel Environment Variables Helper")
    print("=" * 60)
    print()
    
    # Get token
    print("1. Getting Google Drive Token...")
    token_json = get_google_drive_token()
    if token_json:
        print("[SUCCESS] Token found!")
        print()
        print("GOOGLE_DRIVE_TOKEN (copy this to Vercel):")
        print("-" * 60)
        print(token_json)
        print("-" * 60)
        print()
        
        # Save to file for easy copy-paste
        with open('vercel_token.txt', 'w') as f:
            f.write(token_json)
        print("[INFO] Saved to: vercel_token.txt")
        print()
    else:
        print("[WARNING] Could not get token - you may need to authenticate first")
        print()
    
    # Get credentials
    print("2. Getting Google Drive Credentials...")
    creds_json = get_google_drive_credentials()
    if creds_json:
        print("[SUCCESS] Credentials found!")
        print()
        print("GOOGLE_DRIVE_CREDENTIALS (copy this to Vercel):")
        print("-" * 60)
        print(creds_json)
        print("-" * 60)
        print()
        
        # Save to file for easy copy-paste
        with open('vercel_credentials.txt', 'w') as f:
            f.write(creds_json)
        print("[INFO] Saved to: vercel_credentials.txt")
        print()
    else:
        print("[WARNING] Could not get credentials - download from Google Cloud Console")
        print()
    
    # Print all environment variables needed
    print("=" * 60)
    print("Complete Vercel Environment Variables List:")
    print("=" * 60)
    print()
    print("BACKEND (if backend is on Vercel):")
    print("  USE_GOOGLE_DRIVE_API=true")
    print("  GOOGLE_DRIVE_SHARED_DRIVE_NAME=IT_Automation")
    print("  GOOGLE_DRIVE_BASE_FOLDER_PATH=MiSys/Misys Extracted Data/API Extractions")
    print("  GOOGLE_DRIVE_SALES_ORDERS_PATH=Sales_CSR/Customer Orders/Sales Orders")
    if creds_json:
        print(f"  GOOGLE_DRIVE_CREDENTIALS={creds_json[:100]}...")
    else:
        print("  GOOGLE_DRIVE_CREDENTIALS=<paste credentials JSON here>")
    if token_json:
        print(f"  GOOGLE_DRIVE_TOKEN={token_json[:100]}...")
    else:
        print("  GOOGLE_DRIVE_TOKEN=<paste token JSON here>")
    print()
    print("FRONTEND:")
    print("  VITE_API_URL=https://your-backend-url.vercel.app")
    print("    (or https://your-backend-url.onrender.com if backend is on Render)")
    print()
    print("=" * 60)
    print("Next Steps:")
    print("1. Copy the values above to Vercel Dashboard -> Settings -> Environment Variables")
    print("2. Redeploy both frontend and backend after setting variables")
    print("=" * 60)

if __name__ == '__main__':
    main()

