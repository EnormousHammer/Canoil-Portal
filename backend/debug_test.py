#!/usr/bin/env python3
import requests
import json
import os

# Test data
test_data = {
    'so_data': {
        'so_number': 'DEBUG2941',
        'customer_name': 'Debug Customer',
        'shipping_address': {
            'company': 'Debug Company',
            'street': '123 Debug St',
            'city': 'Debug City',
            'province': 'ON',
            'postal_code': 'M1A 1A1'
        }
    },
    'email_shipping': {
        'items': [
            {
                'item_code': 'REOL32BGTDRM',
                'description': 'REOLUBE TURBOFLUID 32B GT DRUM',
                'quantity': 4,
                'hts_code': '3819.00.0000',
                'country_of_origin': 'CA'
            }
        ]
    }
}

try:
    print("🧪 Testing generate-all-documents endpoint...")
    response = requests.post(
        'http://localhost:5002/api/logistics/generate-all-documents',
        json=test_data,
        timeout=60
    )
    
    print(f"📥 Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success: {data.get('success')}")
        print(f"📄 Documents: {len(data.get('documents', []))}")
        for doc in data.get('documents', []):
            print(f"   - {doc.get('document_type')}: {doc.get('filename')}")
            print(f"     URL: {doc.get('download_url')}")
        
        # Check if files actually exist
        print("\n🔍 Checking if files exist...")
        for doc in data.get('documents', []):
            filename = doc.get('filename')
            if filename:
                # Check in correct location
                correct_path = os.path.join('uploads', 'logistics', filename)
                exists = os.path.exists(correct_path)
                print(f"   {filename}: {'✅ EXISTS' if exists else '❌ MISSING'} at {correct_path}")
                
                # Check in wrong location
                wrong_path = os.path.join('canoil-portal', 'backend', 'canoil-portal', 'backend', 'uploads', 'logistics', filename)
                wrong_exists = os.path.exists(wrong_path)
                if wrong_exists:
                    print(f"   {filename}: ⚠️  FOUND in wrong location: {wrong_path}")
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Test failed: {e}")
    import traceback
    traceback.print_exc()
