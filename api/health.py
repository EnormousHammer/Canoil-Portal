"""Comprehensive health check endpoint for Canoil Portal backend"""
import os
import sys
import json
from pathlib import Path

def handler(request):
    """Health check that verifies all backend components"""
    checks = {
        "timestamp": str(__import__('datetime').datetime.now()),
        "environment": {},
        "imports": {},
        "google_credentials": {},
        "google_drive": {},
        "overall_status": "unknown"
    }
    
    # CHECK 1: Environment Variables
    try:
        checks["environment"]["VERCEL"] = os.getenv('VERCEL', 'not set')
        checks["environment"]["VERCEL_ENV"] = os.getenv('VERCEL_ENV', 'not set')
        checks["environment"]["USE_GOOGLE_DRIVE_API"] = os.getenv('USE_GOOGLE_DRIVE_API', 'not set')
        
        creds = os.getenv('GOOGLE_DRIVE_CREDENTIALS')
        checks["environment"]["GOOGLE_DRIVE_CREDENTIALS"] = "✅ Set" if creds else "❌ Missing"
        checks["environment"]["GOOGLE_DRIVE_CREDENTIALS_length"] = len(creds) if creds else 0
        
        token = os.getenv('GOOGLE_DRIVE_TOKEN')
        checks["environment"]["GOOGLE_DRIVE_TOKEN"] = "✅ Set" if token else "❌ Missing"
        checks["environment"]["GOOGLE_DRIVE_TOKEN_length"] = len(token) if token else 0
        
        checks["environment"]["GOOGLE_DRIVE_SHARED_DRIVE_NAME"] = os.getenv('GOOGLE_DRIVE_SHARED_DRIVE_NAME', 'not set')
        checks["environment"]["status"] = "✅ Pass"
    except Exception as e:
        checks["environment"]["status"] = f"❌ Fail: {str(e)}"
    
    # CHECK 2: Python Path & Backend Access
    try:
        backend_path = Path(__file__).parent.parent / 'backend'
        checks["imports"]["backend_path"] = str(backend_path)
        checks["imports"]["backend_exists"] = backend_path.exists()
        
        if backend_path.exists():
            sys.path.insert(0, str(backend_path))
            os.chdir(str(backend_path))
            checks["imports"]["path_setup"] = "✅ Pass"
        else:
            checks["imports"]["path_setup"] = "❌ Backend directory not found"
    except Exception as e:
        checks["imports"]["path_setup"] = f"❌ Fail: {str(e)}"
    
    # CHECK 3: Import google_drive_service
    try:
        from google_drive_service import GoogleDriveService
        checks["imports"]["google_drive_service"] = "✅ Imported"
        
        try:
            service = GoogleDriveService()
            checks["imports"]["service_instantiation"] = "✅ Created"
            has_get_all = hasattr(service, 'get_all_data')
            checks["imports"]["has_get_all_data"] = "✅ Yes" if has_get_all else "❌ Missing method"
        except Exception as e:
            checks["imports"]["service_instantiation"] = f"❌ Fail: {str(e)}"
    except ImportError as e:
        checks["imports"]["google_drive_service"] = f"❌ Import failed: {str(e)}"
    except Exception as e:
        checks["imports"]["google_drive_service"] = f"❌ Error: {str(e)}"
    
    # CHECK 4: Google Credentials Parsing
    try:
        creds_json = os.getenv('GOOGLE_DRIVE_CREDENTIALS')
        if creds_json:
            creds_data = json.loads(creds_json)
            checks["google_credentials"]["format"] = "✅ Valid JSON"
            checks["google_credentials"]["type"] = creds_data.get('type', 'unknown')
            checks["google_credentials"]["client_email"] = creds_data.get('client_email', 'missing')[:30] + "..."
            checks["google_credentials"]["project_id"] = creds_data.get('project_id', 'missing')
        else:
            checks["google_credentials"]["format"] = "❌ No credentials found"
    except json.JSONDecodeError as e:
        checks["google_credentials"]["format"] = f"❌ Invalid JSON: {str(e)}"
    except Exception as e:
        checks["google_credentials"]["format"] = f"❌ Error: {str(e)}"
    
    # CHECK 5: Google Token Parsing
    try:
        token_json = os.getenv('GOOGLE_DRIVE_TOKEN')
        if token_json:
            token_data = json.loads(token_json)
            checks["google_credentials"]["token_format"] = "✅ Valid JSON"
            checks["google_credentials"]["token_has_refresh"] = "✅ Yes" if 'refresh_token' in token_data else "❌ No"
            checks["google_credentials"]["token_scopes"] = len(token_data.get('scopes', []))
        else:
            checks["google_credentials"]["token_format"] = "❌ No token found"
    except json.JSONDecodeError as e:
        checks["google_credentials"]["token_format"] = f"❌ Invalid JSON: {str(e)}"
    except Exception as e:
        checks["google_credentials"]["token_format"] = f"❌ Error: {str(e)}"
    
    # CHECK 6: Try Google Drive Connection
    try:
        from google_drive_service import GoogleDriveService
        service = GoogleDriveService()
        
        try:
            data = service.get_all_data()
            if isinstance(data, dict):
                checks["google_drive"]["connection"] = "✅ Connected"
                checks["google_drive"]["data_keys"] = list(data.keys())
                if 'sales_orders' in data:
                    checks["google_drive"]["sales_orders_count"] = len(data.get('sales_orders', []))
                if 'inventory' in data:
                    checks["google_drive"]["inventory_count"] = len(data.get('inventory', []))
            else:
                checks["google_drive"]["connection"] = f"⚠️ Unexpected data type: {type(data)}"
        except Exception as e:
            import traceback
            checks["google_drive"]["connection"] = "❌ get_all_data() failed"
            checks["google_drive"]["error"] = str(e)
            checks["google_drive"]["traceback"] = traceback.format_exc()
    except Exception as e:
        import traceback
        checks["google_drive"]["connection"] = "❌ Service creation failed"
        checks["google_drive"]["error"] = str(e)
        checks["google_drive"]["traceback"] = traceback.format_exc()
    
    # OVERALL STATUS
    failed_checks = []
    if "❌" in str(checks["environment"]):
        failed_checks.append("environment")
    if "❌" in str(checks["imports"]):
        failed_checks.append("imports")
    if "❌" in str(checks["google_credentials"]):
        failed_checks.append("google_credentials")
    if "❌" in str(checks["google_drive"]):
        failed_checks.append("google_drive")
    
    if not failed_checks:
        checks["overall_status"] = "✅ ALL CHECKS PASSED"
    else:
        checks["overall_status"] = f"❌ FAILED: {', '.join(failed_checks)}"
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(checks, indent=2)
    }
