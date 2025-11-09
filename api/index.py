"""
Vercel Serverless Function - Flask Backend Entry Point
This allows the Flask backend to run on Vercel as serverless functions
"""
import sys
import os
import json
from pathlib import Path
from io import BytesIO

# Flask app - lazy import (inside handler) to avoid import-time failures
_flask_app = None
_path_setup_done = False

def setup_paths():
    """Setup Python path and working directory - only when needed"""
    global _path_setup_done
    if not _path_setup_done:
        try:
            backend_path = Path(__file__).parent.parent / 'backend'
            backend_path_str = str(backend_path)
            
            # Add backend directory to Python path
            if backend_path_str not in sys.path:
                sys.path.insert(0, backend_path_str)
            
            # Change to backend directory so imports work
            # Only if the directory exists (might not on Vercel)
            if os.path.exists(backend_path_str):
                os.chdir(backend_path_str)
            
            _path_setup_done = True
            print(f"✅ Path setup complete: {backend_path_str}")
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"⚠️ Path setup warning: {e}\n{error_trace}")
            # Continue anyway - might still work

def get_flask_app():
    """Lazy load Flask app - only import when needed"""
    global _flask_app
    if _flask_app is None:
        try:
            # Setup paths first
            setup_paths()
            
            # Now import Flask app
            from app import app
            _flask_app = app
            print("✅ Flask app imported successfully")
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"❌ Error importing Flask app: {e}\n{error_trace}")
            raise
    return _flask_app

def handler(request):
    """Vercel Python serverless function handler"""
    try:
        # Log that handler was called
        print(f"🔵 Handler called: path={request.get('path') if isinstance(request, dict) else getattr(request, 'path', 'unknown')}")
        
        # Lazy import Flask app (only when handler is called)
        app = get_flask_app()
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
            error_trace = traceback.format_exc()
            print(f"❌ Flask app error: {flask_error}\n{error_trace}")
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'error': str(flask_error),
                    'type': 'flask_error',
                    'trace': error_trace
                })
            }
        
        # Parse response
        status_code = 200
        if response_status:
            status_code = int(response_status[0].split()[0])
        
        body_bytes = b''.join(response_body)
        body_str = body_bytes.decode('utf-8') if isinstance(body_bytes, bytes) else body_bytes
        
        # Return Vercel format
        return {
            'statusCode': status_code,
            'headers': dict(response_headers),
            'body': body_str
        }
    except ImportError as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Import error in handler: {e}\n{error_trace}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': 'Import error',
                'message': str(e),
                'type': 'import_error',
                'trace': error_trace
            })
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

