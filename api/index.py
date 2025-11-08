import sys
import json
from pathlib import Path

# Add backend to Python path
backend_path = Path(__file__).parent.parent / 'backend'
backend_path_str = str(backend_path)
if backend_path_str not in sys.path:
    sys.path.insert(0, backend_path_str)

def handler(request):
    """Minimal handler that bypasses app.py and calls GoogleDriveService directly"""
    try:
        from google_drive_service import GoogleDriveService

        drive_service = GoogleDriveService()
        data, folder_info = drive_service.get_all_data()

        # If service returned an error tuple (None, "error"), surface it
        if data is None:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': folder_info or 'Unknown error'})
            }

        body = {
            'data': data,
            'folderInfo': folder_info,
            'source': 'Google Drive API'
        }

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(body)
        }
    except Exception as e:
        import traceback
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'traceback': traceback.format_exc()
            })
        }
