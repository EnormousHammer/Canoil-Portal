def handler(request):
    """Minimal test endpoint"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': '{"status": "working", "message": "Backend is alive!"}'
    }

"""
Simple test endpoint to verify Vercel Python function works
"""
import json

def handler(request):
    """Simple test handler"""
    try:
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'message': 'Test endpoint works!',
                'request_type': str(type(request)),
                'request': str(request)[:200] if request else None
            })
        }
    except Exception as e:
        import traceback
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': str(e),
                'trace': traceback.format_exc()
            })
        }

