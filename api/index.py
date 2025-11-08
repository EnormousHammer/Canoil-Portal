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

def handler(request):
    """Vercel Python serverless function handler"""
    try:
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
        app_iter = app(environ, start_response)
        
        # Collect response
        for chunk in app_iter:
            response_body.append(chunk)
        if hasattr(app_iter, 'close'):
            app_iter.close()
        
        # Parse response
        status_code = 200
        if response_status:
            status_code = int(response_status[0].split()[0])
        
        body_bytes = b''.join(response_body)
        body_str = body_bytes.decode('utf-8') if isinstance(body_bytes, bytes) else body_bytes
        
        # Convert headers list of tuples to dict (preserve all headers)
        # Flask-CORS may add multiple headers, so we need to handle duplicates
        headers_dict = {}
        for header_name, header_value in response_headers:
            # Convert header name to lowercase for consistency
            header_key = header_name.lower()
            # If header already exists, combine values (for headers that allow multiple values)
            if header_key in headers_dict:
                # For CORS headers, we want to keep all values
                if header_key in ('access-control-allow-headers', 'access-control-expose-headers'):
                    headers_dict[header_key] = f"{headers_dict[header_key]}, {header_value}"
                else:
                    # For other headers, keep the last value
                    headers_dict[header_key] = header_value
            else:
                headers_dict[header_key] = header_value
        
        # Ensure CORS headers are present for all responses
        if 'access-control-allow-origin' not in headers_dict:
            headers_dict['access-control-allow-origin'] = '*'
        if 'access-control-allow-methods' not in headers_dict:
            headers_dict['access-control-allow-methods'] = 'GET, POST, OPTIONS'
        if 'access-control-allow-headers' not in headers_dict:
            headers_dict['access-control-allow-headers'] = '*'
        
        # Return Vercel format
        return {
            'statusCode': status_code,
            'headers': headers_dict,
            'body': body_str
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in handler: {e}\n{error_trace}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            },
            'body': json.dumps({'error': str(e), 'trace': error_trace})
        }

