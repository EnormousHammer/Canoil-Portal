"""
MISys Live Data Bridge - Server Setup
Runs ON the MISys server (192.168.1.11).
Connects to SQL locally, exposes /api/data for the cloud app.
"""
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import misys_service

app = Flask(__name__)
CORS(app)

@app.route('/api/data', methods=['GET'])
def get_data():
    data, err = misys_service.load_all_data()
    if data:
        return jsonify({
            "data": data,
            "folderInfo": {
                "folderName": "MISys Live SQL (Server)",
                "syncDate": datetime.now().isoformat(),
                "lastModified": datetime.now().isoformat(),
                "folder": "192.168.1.11/CANOILCA",
                "created": datetime.now().isoformat(),
                "size": "N/A",
                "fileCount": sum(1 for v in data.values() if isinstance(v, list) and len(v) > 0),
            },
            "LoadTimestamp": datetime.now().isoformat(),
            "source": "live_sql",
            "fullCompanyDataReady": True,
        })
    return jsonify({
        "data": {},
        "source": "live_sql",
        "fullCompanyDataReady": False,
        "message": err or "Failed to load data",
    }), 500

@app.route('/health', methods=['GET'])
def health():
    ok, msg = misys_service.test_connection()
    return jsonify({"ok": ok, "message": msg})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003)
