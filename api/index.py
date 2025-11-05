"""
Vercel Serverless Function - Flask Backend Entry Point
This allows the Flask backend to run on Vercel as serverless functions
"""
import sys
import os
from pathlib import Path

# Add backend directory to Python path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

# Import Flask app
from app import app

# Vercel serverless function handler
def handler(request):
    """Vercel serverless function handler"""
    return app(request.environ, request.start_response)

# Export for Vercel
# Vercel expects a handler function or WSGI application
# Flask app is already a WSGI application, so we can export it directly
__all__ = ['app']

