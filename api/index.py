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

# Import Flask app
from app import app

# Vercel serverless function handler
# Vercel Python functions use a specific format - we'll export the Flask app directly
# and use a WSGI adapter if needed, or export handler that works with Vercel's format

# For Vercel Python runtime, we need to export a handler function
# Try to use Flask's WSGI adapter for Vercel
try:
    from vercel import Request, Response
    # Vercel SDK available
    def handler(req: Request):
        """Vercel Python SDK handler"""
        # Convert Vercel request to WSGI format
        environ = {
            'REQUEST_METHOD': req.method,
            'PATH_INFO': req.path,
            'QUERY_STRING': req.query_string or '',
            'CONTENT_TYPE': req.headers.get('content-type', ''),
            'CONTENT_LENGTH': str(len(req.body)) if req.body else '0',
            'wsgi.version': (1, 0),
            'wsgi.url_scheme': 'https',
            'wsgi.input': BytesIO(req.body.encode() if isinstance(req.body, str) else req.body) if req.body else BytesIO(),
            'wsgi.errors': sys.stderr,
            'wsgi.multithread': False,
            'wsgi.multiprocess': False,
            'wsgi.run_once': False,
        }
        
        # Add headers
        for key, value in req.headers.items():
            environ[f'HTTP_{key.upper().replace("-", "_")}'] = value
        
        # Call Flask
        response_status = []
        response_headers = []
        response_body = []
        
        def start_response(status, headers):
            response_status.append(status)
            response_headers.extend(headers)
        
        app_iter = app(environ, start_response)
        for chunk in app_iter:
            response_body.append(chunk)
        if hasattr(app_iter, 'close'):
            app_iter.close()
        
        status_code = int(response_status[0].split()[0]) if response_status else 200
        body_bytes = b''.join(response_body)
        
        return Response(
            status_code=status_code,
            headers=dict(response_headers),
            body=body_bytes.decode('utf-8') if isinstance(body_bytes, bytes) else body_bytes
        )
except ImportError:
    # No Vercel SDK - use standard Python function format
    def handler(request):
        """Standard Vercel Python handler - converts request/response"""
        try:
            # Handle both dict and object request formats
            if isinstance(request, dict):
                path = request.get('path', '/')
                method = request.get('method', 'GET')
                headers = request.get('headers', {})
                body = request.get('body', '')
                query_string = request.get('queryString', '')
            else:
                path = getattr(request, 'path', '/')
                method = getattr(request, 'method', 'GET')
                headers = getattr(request, 'headers', {})
                body = getattr(request, 'body', '')
                query_string = getattr(request, 'queryString', '')
            
            # Create WSGI environment
            body_bytes = body.encode('utf-8') if isinstance(body, str) else body
            environ = {
                'REQUEST_METHOD': method,
                'PATH_INFO': path,
                'SCRIPT_NAME': '',
                'QUERY_STRING': query_string or '',
                'CONTENT_TYPE': headers.get('content-type', ''),
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
            
            # Add headers
            for key, value in headers.items():
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
            app_iter = app(environ, start_response)
            
            # Collect response
            for chunk in app_iter:
                response_body.append(chunk)
            if hasattr(app_iter, 'close'):
                app_iter.close()
            
            # Parse response
            status_code = int(response_status[0].split()[0]) if response_status else 200
            body_bytes = b''.join(response_body)
            body_str = body_bytes.decode('utf-8') if isinstance(body_bytes, bytes) else body_bytes
            
            # Return Vercel format
            return {
                'statusCode': status_code,
                'headers': dict(response_headers),
                'body': body_str
            }
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error in handler: {e}\n{error_trace}")
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': str(e), 'trace': error_trace})
            }

