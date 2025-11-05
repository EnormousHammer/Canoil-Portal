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

# Change to backend directory so imports work
os.chdir(str(backend_path))

# Import Flask app
from app import app

# Vercel serverless function handler
# Vercel passes (request) as the handler argument
def handler(request):
    """Vercel serverless function handler"""
    # Flask app is a WSGI application
    # Vercel expects a function that takes request and returns response
    return app(request.environ, request.start_response)

# Export handler for Vercel
__all__ = ['handler']

