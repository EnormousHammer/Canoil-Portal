#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os

# Set UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("🚀 Starting Flask server...")
    from app import app
    print("✅ App imported successfully")
    print("🌐 Starting server on http://0.0.0.0:5002 (accessible via localhost:5002)")
    app.run(host='0.0.0.0', port=5002, debug=False, use_reloader=False)
except Exception as e:
    print(f"❌ Error starting server: {e}")
    import traceback
    traceback.print_exc()
