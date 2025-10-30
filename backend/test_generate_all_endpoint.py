#!/usr/bin/env python3
"""
TEST SCRIPT: Verify generate-all-documents endpoint works
Run this AFTER starting the backend server (python app.py)
"""

import requests
import json

print("="*80)
print("TESTING: /api/logistics/generate-all-documents endpoint")
print("="*80)

# Test data - minimal valid SO data
test_data = {
    "so_data": {
        "so_number": "TEST123",
        "customer_name": "Test Customer",
        "order_date": "2025-10-15",
        "ship_to": {
            "company_name": "Test Company",
            "street_address": "123 Test St",
            "city": "TestCity",
            "province": "ON",
            "postal_code": "A1A 1A1",
            "country": "Canada"
        },
        "sold_to": {
            "company_name": "Test Company",
            "street_address": "123 Test St",
            "city": "TestCity",
            "province": "ON",
            "postal_code": "A1A 1A1",
            "country": "Canada"
        },
        "items": [
            {
                "item_code": "TEST001",
                "description": "Test Product",
                "quantity": 1,
                "unit": "EA",
                "unit_price": 100.00,
                "total_price": 100.00
            }
        ]
    },
    "email_shipping": {},
    "email_analysis": {},
    "items": [
        {
            "item_code": "TEST001",
            "description": "Test Product",
            "quantity": 1,
            "unit": "EA",
            "unit_price": 100.00,
            "total_price": 100.00
        }
    ]
}

# Make the request
url = "http://localhost:5002/api/logistics/generate-all-documents"

print(f"\n📤 Sending POST request to: {url}")
print(f"📤 Payload: SO Number = {test_data['so_data']['so_number']}")
print(f"📤 Items: {len(test_data['items'])}")

try:
    response = requests.post(
        url,
        json=test_data,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    print(f"\n📥 Response Status: {response.status_code}")
    print(f"📥 Response Headers: {dict(response.headers)}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ SUCCESS!")
        print(f"📋 Response Data:")
        print(json.dumps(data, indent=2))
        
        print(f"\n📊 Summary:")
        print(f"   Success: {data.get('success')}")
        print(f"   Documents Generated: {data.get('documents_generated')}")
        print(f"   Total Documents: {data.get('total_documents')}")
        
        if data.get('results'):
            print(f"\n📁 Generated Files:")
            for doc_type, result in data['results'].items():
                if isinstance(result, dict) and result.get('success'):
                    print(f"   ✅ {doc_type}: {result.get('filename')}")
                elif isinstance(result, dict) and result.get('skipped'):
                    print(f"   ⏭️  {doc_type}: Skipped ({result.get('reason')})")
                elif isinstance(result, dict):
                    print(f"   ❌ {doc_type}: Failed ({result.get('error')})")
        
        if data.get('errors'):
            print(f"\n⚠️  Errors:")
            for error in data['errors']:
                print(f"   - {error}")
                
        print(f"\n{'='*80}")
        print(f"✅ ENDPOINT IS WORKING!")
        print(f"{'='*80}")
        
    else:
        print(f"\n❌ FAILED!")
        print(f"Response: {response.text}")
        
except requests.exceptions.ConnectionError:
    print(f"\n❌ CONNECTION ERROR!")
    print(f"Backend is not running on http://localhost:5002")
    print(f"\nTo fix:")
    print(f"1. Open terminal in canoil-portal/backend/")
    print(f"2. Run: python app.py")
    print(f"3. Wait for 'Running on http://localhost:5002'")
    print(f"4. Run this test script again")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()

print()

