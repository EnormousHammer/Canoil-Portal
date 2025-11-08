"""
Vercel Serverless Function - Flask Backend Entry Point
This allows the Flask backend to run on Vercel as serverless functions
"""
import sys
import os
import json
from pathlib import Path
from io import BytesIO

# Add backend directory to Python path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

# Change to backend directory so imports work
os.chdir(str(backend_path))

# Set environment encoding for proper output
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Initialize Flask app variable
app = None

# Import Flask app - this will initialize Google Drive service if configured
try:
    print("🔍 Attempting to import Flask app...")
    from app import app as flask_app
    app = flask_app
    print("✅ Flask app imported successfully")
except ImportError as e:
    print(f"❌ ImportError importing Flask app: {e}")
    import traceback
    traceback.print_exc()
    # Don't raise - let handler catch it
except Exception as e:
    print(f"❌ Error importing Flask app: {e}")
    import traceback
    traceback.print_exc()
    # Don't raise - let handler catch it

# Try to initialize Google Drive service early if configured
USE_GOOGLE_DRIVE_API = os.getenv('USE_GOOGLE_DRIVE_API', 'false').lower() == 'true'
if USE_GOOGLE_DRIVE_API:
    try:
        print("🔍 Attempting to initialize Google Drive service...")
        from google_drive_service import GoogleDriveService
        google_drive_service = GoogleDriveService()
        # Authenticate immediately
        if not google_drive_service.authenticated:
            print("🔐 Authenticating Google Drive service...")
            google_drive_service.authenticate()
        print("✅ Google Drive service initialized and authenticated")
    except Exception as e:
        print(f"⚠️ Google Drive service initialization failed: {e}")
        import traceback
        traceback.print_exc()
        # Continue anyway - app will handle it gracefully

def handler(request):
    """Vercel Python serverless function handler"""
    try:
        # Log request for debugging - FIRST THING
        print(f"📥 Handler called with request type: {type(request)}")
        print(f"📥 Request object: {request}")
        
        # Check if Flask app was imported successfully
        if app is None:
            error_msg = "Flask app not imported - check logs for import errors"
            print(f"❌ {error_msg}")
            import traceback
            traceback.print_exc()
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'error': error_msg, 
                    'type': 'import_error',
                    'message': 'Flask app failed to import - check Vercel logs for details'
                })
            }
        
        # Vercel Python functions receive a dict with: path, method, headers, body, query
        if isinstance(request, dict):
            path = request.get('path', '/')
            method = request.get('method', 'GET')
            headers = request.get('headers', {}) or {}
            body = request.get('body', '')
            query_string = request.get('queryString', '') or request.get('query', '')
        else:
            # Handle object format
            path = getattr(request, 'path', '/')
            method = getattr(request, 'method', 'GET')
            headers = getattr(request, 'headers', {}) or {}
            body = getattr(request, 'body', '')
            query_string = getattr(request, 'queryString', '') or getattr(request, 'query', '')
        
        print(f"📥 Request: {method} {path}")
        
        # Ensure path is properly formatted
        # When request comes to /api/data, Vercel sends path=/api/data
        # Flask routes are at /api/data, so we keep the full path
        
        # Convert body to bytes if string
        if isinstance(body, str):
            body_bytes = body.encode('utf-8')
        elif body:
            body_bytes = body
        else:
            body_bytes = b''
        
        # Create WSGI environment
        environ = {
            'REQUEST_METHOD': method,
            'PATH_INFO': path,
            'SCRIPT_NAME': '',
            'QUERY_STRING': query_string or '',
            'CONTENT_TYPE': headers.get('content-type', '') or headers.get('Content-Type', '') or '',
            'CONTENT_LENGTH': str(len(body_bytes)) if body_bytes else '0',
            'SERVER_NAME': 'localhost',
            'SERVER_PORT': '80',
            'wsgi.version': (1, 0),
            'wsgi.url_scheme': 'https',
            'wsgi.input': BytesIO(body_bytes) if body_bytes else BytesIO(),
            'wsgi.errors': sys.stderr,
            'wsgi.multithread': False,
            'wsgi.multiprocess': False,
            'wsgi.run_once': False,
        }
        
        # Add headers (convert to HTTP_* format for WSGI)
        if isinstance(headers, dict):
            for key, value in headers.items():
                if isinstance(value, str):
                    key_upper = key.upper().replace('-', '_')
                    if key_upper not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
                        environ[f'HTTP_{key_upper}'] = value
        
        # Response storage
        response_status = []
        response_headers = []
        response_body = []
        
        def start_response(status, headers):
            response_status.append(status)
            response_headers.extend(headers)
        
        # Call Flask app
        try:
            app_iter = app(environ, start_response)
            
            # Collect response
            for chunk in app_iter:
                response_body.append(chunk)
            if hasattr(app_iter, 'close'):
                app_iter.close()
        except Exception as flask_error:
            import traceback
            flask_trace = traceback.format_exc()
            print(f"❌ Flask app error: {flask_error}\n{flask_trace}")
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'error': str(flask_error),
                    'type': 'flask_error',
                    'trace': flask_trace
                })
            }
        
        # Parse response
        status_code = 200
        if response_status:
            status_code = int(response_status[0].split()[0])
        
        body_bytes = b''.join(response_body)
        body_str = body_bytes.decode('utf-8') if isinstance(body_bytes, bytes) else body_bytes
        
        print(f"✅ Response: {status_code} ({len(body_str)} bytes)")
        
        # Return Vercel format
        return {
            'statusCode': status_code,
            'headers': dict(response_headers),
            'body': body_str
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error in handler: {e}\n{error_trace}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': str(e),
                'type': 'handler_error',
                'trace': error_trace
            })
        }

