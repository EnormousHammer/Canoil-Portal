#!/usr/bin/env python3
"""Start Flask app with Hypercorn for HTTP/2 support on Cloud Run"""
import os
import sys

# CRITICAL: Add backend directory to Python path BEFORE any imports
# This ensures relative imports in app.py work correctly
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set environment variable for Python encoding
# DO NOT wrap stdout/stderr here - app.py will do it
# Wrapping twice causes "I/O operation on closed file" errors
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Import after encoding setup
try:
    from asgiref.wsgi import WsgiToAsgi
    print("✅ asgiref.wsgi imported successfully")
except ImportError as e:
    print(f"❌ Failed to import asgiref.wsgi: {e}")
    print("   Run: pip install asgiref")
    sys.exit(1)

try:
    from app import app
    print("✅ Flask app imported successfully")
    
    # Check if running on Cloud Run
    is_cloud_run = os.getenv('K_SERVICE') is not None
    if is_cloud_run:
        print("☁️ Running on Cloud Run - server will start even if data preload fails")
    else:
        print("💻 Running locally")
    
    # PRELOAD DATA ON STARTUP - Warm up cache immediately (non-blocking)
    # CRITICAL: Never block server startup - always start server even if preload fails
    print("🔄 Preloading data cache on startup (non-blocking)...")
    try:
        import threading
        def preload_data():
            """Preload data in background thread to warm up cache"""
            try:
                import time
                time.sleep(3)  # Wait for app to fully initialize and server to start
                print("📥 Starting background data preload...")
                # Directly call the data loading function (faster than HTTP)
                with app.test_request_context('/api/data'):
                    from app import get_all_data
                    response = get_all_data()
                    if response:
                        # Check if it's a Flask Response object
                        status = getattr(response, 'status_code', None)
                        if status == 200 or status is None:
                            print("✅ Data preloaded successfully - cache is warm!")
                            # Try to get data size
                            try:
                                import json
                                data = json.loads(response.get_data(as_text=True))
                                if 'data' in data:
                                    file_count = len([k for k, v in data['data'].items() if v])
                                    print(f"   Preloaded {file_count} data files")
                            except:
                                pass
                        else:
                            print(f"⚠️ Data preload returned status {status} (server still running)")
                    else:
                        print("⚠️ Data preload returned None (server still running)")
            except Exception as e:
                print(f"⚠️ Background preload failed (non-critical - server still running): {e}")
                import traceback
                traceback.print_exc()
        
        # Start preload in background thread (non-blocking)
        preload_thread = threading.Thread(target=preload_data, daemon=True)
        preload_thread.start()
        print("✅ Background data preload started (server will start regardless of preload status)")
    except Exception as e:
        print(f"⚠️ Could not start preload thread (non-critical - server will still start): {e}")
        import traceback
        traceback.print_exc()
        
except ImportError as e:
    print(f"❌ Failed to import Flask app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"❌ Error initializing Flask app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    import hypercorn.asyncio
    import asyncio
    print("✅ Hypercorn imported successfully")
except ImportError as e:
    print(f"❌ Failed to import hypercorn: {e}")
    print("   Run: pip install hypercorn")
    sys.exit(1)

# Get port from environment (Cloud Run sets PORT=8080)
port = int(os.environ.get('PORT', 8080))
bind_address = f'0.0.0.0:{port}'

# Wrap Flask (WSGI) app for ASGI server
asgi_app = WsgiToAsgi(app)

# Configure Hypercorn
config = hypercorn.Config()
config.bind = [bind_address]
config.workers = 1  # Cloud Run manages scaling
config.accesslog = "-"  # Log to stdout
config.errorlog = "-"  # Log to stderr

# Enable HTTP/2 (removes 32MB response limit)
config.h2 = True

print(f"🚀 Starting Hypercorn with HTTP/2 support on {bind_address}")
print(f"✅ Flask app wrapped with WsgiToAsgi adapter")
print(f"✅ HTTP/2 enabled - 32MB response limit removed")
print(f"✅ Server will accept requests immediately (data may still be loading in background)")

# Run Hypercorn
try:
    print("="*60)
    print("🌐 SERVER IS NOW ACCEPTING REQUESTS")
    print("="*60)
    asyncio.run(hypercorn.asyncio.serve(asgi_app, config))
except KeyboardInterrupt:
    print("\n🛑 Shutting down Hypercorn...")
except Exception as e:
    print(f"❌ Error starting Hypercorn: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

