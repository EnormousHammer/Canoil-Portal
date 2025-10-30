"""
Start Flask App with Error Handling
"""

try:
    from app import app
    print("✅ App imported successfully")
    
    # Test the BOL HTML endpoint
    with app.test_client() as client:
        response = client.post('/api/logistics/generate-bol-html', 
                             json={'so_data': {'so_number': '3015'}})
        print(f"✅ BOL HTML endpoint test: {response.status_code}")
    
    print("🚀 Starting Flask app on port 5002...")
    app.run(host='127.0.0.1', port=5002, debug=True)
    
except Exception as e:
    print(f"❌ Error starting app: {e}")
    import traceback
    traceback.print_exc()
