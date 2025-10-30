from flask import Flask, jsonify
from flask_cors import CORS
import requests
import csv
import io
import os

app = Flask(__name__)
CORS(app)

# Try to use Google authentication if available
USE_AUTH = False
AUTH_METHOD = None
try:
    import gspread
    from google.oauth2.service_account import Credentials as ServiceAccountCredentials
    from google.oauth2.credentials import Credentials as UserCredentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    import pickle
    
    # Check for service account first
    CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), 'canoil-service-account.json')
    TOKEN_FILE = os.path.join(os.path.dirname(__file__), 'token.pickle')
    
    if os.path.exists(CREDENTIALS_FILE):
        USE_AUTH = True
        AUTH_METHOD = 'service_account'
        print("✅ Google Service Account credentials found - will authenticate as 'Canoil Portal'")
    elif os.path.exists(TOKEN_FILE):
        USE_AUTH = True
        AUTH_METHOD = 'user_oauth'
        print("✅ User OAuth token found - will authenticate with your Gmail account")
    else:
        print("⚠️ No credentials found - will access as 'Anonymous'")
        print("   Option 1: Service Account - save JSON as: canoil-service-account.json")
        print("   Option 2: Your Gmail - run: python setup_gmail_auth.py")
except ImportError:
    print("⚠️ gspread not installed - will access as 'Anonymous'")
    print("   To authenticate, run: pip install gspread google-auth google-auth-oauthlib")

def load_mps_data():
    """Load MPS data from Google Sheets - with optional authentication"""
    try:
        sheet_id = "1zAOY7ngP2mLVi-W_FL9tsPiKDPqbU6WEUmrrTDeKygw"
        
        if USE_AUTH:
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
            
            if AUTH_METHOD == 'service_account':
                # Service Account - shows as "Canoil Portal"
                print("📊 Loading MPS data with service account...")
                creds = ServiceAccountCredentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
            else:
                # User OAuth - shows with your Gmail name
                print("📊 Loading MPS data with your Gmail account...")
                with open(TOKEN_FILE, 'rb') as token:
                    creds = pickle.load(token)
            
            client = gspread.authorize(creds)
            
            # Open the sheet
            sheet = client.open_by_key(sheet_id).sheet1
            rows = sheet.get_all_values()
        else:
            # Anonymous access - shows as "Anonymous Jackalope" etc.
            print("📊 Loading MPS data anonymously...")
            csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
            
            response = requests.get(csv_url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            if response.status_code != 200:
                return {"error": f"Failed to access Google Sheets: {response.status_code}"}
            
            # Parse CSV data
            reader = csv.reader(io.StringIO(response.text))
            rows = list(reader)
        
        if len(rows) < 5:
            return {"error": "Insufficient data in Google Sheets"}
        
        # Find header row (should be row 4, index 3)
        headers = rows[3] if len(rows) > 3 else []
        data_start_row = 4
        
        # Process production orders
        mps_orders = []
        
        for i, row in enumerate(rows[data_start_row:], start=data_start_row + 1):
            if len(row) < 2 or not row[0] or not row[0].strip():
                continue
            
            try:
                order_data = {
                    'order_number': row[0].strip() if len(row) > 0 else '',
                    'so_number': row[1].strip() if len(row) > 1 else '',
                    'mo_number': row[2].strip() if len(row) > 2 else '',
                    'work_center': row[3].strip() if len(row) > 3 else '',
                    'status': row[4].strip() if len(row) > 4 else '',
                    'product': row[5].strip() if len(row) > 5 else '',
                    'customer': row[6].strip() if len(row) > 6 else '',
                    'packaging': row[7].strip() if len(row) > 7 else '',
                    'required': row[8].strip() if len(row) > 8 else '',
                    'ready': row[9].strip() if len(row) > 9 else '',
                    'planned': row[10].strip() if len(row) > 10 else '',
                    'actual': row[11].strip() if len(row) > 11 else '',
                    'promised': row[12].strip() if len(row) > 12 else '',
                    'start_date': row[13].strip() if len(row) > 13 else '',
                    'end_date': row[14].strip() if len(row) > 14 else '',
                    'duration': row[15].strip() if len(row) > 15 else '',
                    'dtc': row[16].strip() if len(row) > 16 else '',
                    'action_items': row[17].strip() if len(row) > 17 else ''
                }
                
                if order_data['order_number'] and order_data['so_number']:
                    mps_orders.append(order_data)
                    
            except Exception as e:
                continue
        
        return {
            "mps_orders": mps_orders,
            "summary": {
                "total_orders": len(mps_orders),
                "source": "Google Sheets",
                "sheet_id": sheet_id
            }
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.route('/api/mps', methods=['GET'])
def get_mps_data():
    """Get MPS data only"""
    try:
        mps_data = load_mps_data()
        return jsonify(mps_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/data', methods=['GET'])
def get_all_data():
    """Get all data including MPS"""
    try:
        mps_data = load_mps_data()
        return jsonify({
            "MPS.json": mps_data,
            "SalesOrders.json": [],
            "ManufacturingOrderHeaders.json": [],
            "Items.json": []
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting clean MPS server...")
    app.run(host='0.0.0.0', port=5002, debug=True)
