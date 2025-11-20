#!/usr/bin/env python3
"""Test Hypercorn locally before deploying to Cloud Run"""
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

print("=" * 60)
print("🧪 TESTING HYPERCORN LOCALLY")
print("=" * 60)
print()

# Import after encoding setup
try:
    from asgiref.wsgi import WsgiToAsgi
    print("✅ asgiref imported successfully")
except ImportError as e:
    print(f"❌ Error importing asgiref: {e}")
    print("   Run: pip install asgiref")
    sys.exit(1)

try:
    from app import app
    print("✅ Flask app imported successfully")
except ImportError as e:
    print(f"❌ Error importing Flask app: {e}")
    sys.exit(1)

try:
    import hypercorn.asyncio
    import asyncio
    print("✅ Hypercorn imported successfully")
except ImportError as e:
    print(f"❌ Error importing Hypercorn: {e}")
    print("   Run: pip install hypercorn")
    sys.exit(1)

# Wrap Flask (WSGI) app for ASGI server
try:
    asgi_app = WsgiToAsgi(app)
    print("✅ Flask app wrapped with WsgiToAsgi adapter")
except Exception as e:
    print(f"❌ Error wrapping Flask app: {e}")
    sys.exit(1)

# Configure Hypercorn for local testing
port = 5002  # Use same port as Flask dev server
bind_address = f'127.0.0.1:{port}'

config = hypercorn.Config()
config.bind = [bind_address]
config.workers = 1
config.accesslog = "-"  # Log to stdout
config.errorlog = "-"  # Log to stderr

# Enable HTTP/2 (for testing)
config.h2 = True

print()
print("=" * 60)
print(f"🚀 Starting Hypercorn on http://{bind_address}")
print("=" * 60)
print()
print("✅ HTTP/2 enabled")
print("✅ Flask app running on Hypercorn")
print()
print("Test endpoints:")
print(f"  - Health: http://localhost:{port}/api/health")
print(f"  - Data: http://localhost:{port}/api/data")
print()
print("Press Ctrl+C to stop")
print("=" * 60)
print()

# Run Hypercorn
try:
    asyncio.run(hypercorn.asyncio.serve(asgi_app, config))
except KeyboardInterrupt:
    print("\n🛑 Shutting down Hypercorn...")
except Exception as e:
    print(f"❌ Error starting Hypercorn: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

