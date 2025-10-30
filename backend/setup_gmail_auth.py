"""
Setup Gmail Authentication for MPS Access
Run this once to authenticate with your Gmail account
"""

from google_auth_oauthlib.flow import InstalledAppFlow
import pickle
import os

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
]

def setup_gmail_auth():
    print("=" * 60)
    print("🔐 Gmail Authentication Setup for Canoil Portal MPS")
    print("=" * 60)
    print()
    print("This will:")
    print("1. Open your browser")
    print("2. Ask you to log in with your Gmail")
    print("3. Ask you to authorize 'Canoil Portal' to read Google Sheets")
    print("4. Save your credentials locally")
    print()
    print("After this, the app will show YOUR NAME instead of 'Anonymous Jackalope'!")
    print()
    
    # Check if OAuth client credentials exist
    credentials_file = 'oauth_client_secret.json'
    if not os.path.exists(credentials_file):
        print("❌ ERROR: Missing OAuth client credentials!")
        print()
        print("You need to create OAuth credentials first:")
        print()
        print("1. Go to: https://console.cloud.google.com/apis/credentials")
        print("2. Click '+ CREATE CREDENTIALS' > 'OAuth client ID'")
        print("3. Application type: 'Desktop app'")
        print("4. Name: 'Canoil Portal MPS'")
        print("5. Click 'CREATE'")
        print("6. Download the JSON file")
        print("7. Save it as: oauth_client_secret.json (in this folder)")
        print()
        print("Then run this script again!")
        return
    
    try:
        print("🌐 Opening browser for authentication...")
        print()
        
        flow = InstalledAppFlow.from_client_secrets_file(
            credentials_file, 
            SCOPES
        )
        
        # This will open a browser window
        creds = flow.run_local_server(port=0)
        
        # Save the credentials for future use
        token_file = 'token.pickle'
        with open(token_file, 'wb') as token:
            pickle.dump(creds, token)
        
        print()
        print("=" * 60)
        print("✅ SUCCESS! Authentication complete!")
        print("=" * 60)
        print()
        print(f"📁 Credentials saved to: {token_file}")
        print()
        print("🎉 Next time the app accesses your MPS Google Sheet,")
        print(f"   it will show YOUR NAME instead of 'Anonymous Jackalope'!")
        print()
        print("🔄 Now restart your MPS server:")
        print("   python simple_mps_server.py")
        print()
        
    except Exception as e:
        print()
        print("❌ ERROR during authentication:")
        print(str(e))
        print()

if __name__ == '__main__':
    setup_gmail_auth()

