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
from asgiref.wsgi import WsgiToAsgi
from app import app
import hypercorn.asyncio
import asyncio

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

