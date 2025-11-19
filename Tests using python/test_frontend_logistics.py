#!/usr/bin/env python3
"""
Test the actual frontend logistics page functionality
"""

import requests
import json
import time

def test_frontend_logistics():
    """Test the complete frontend logistics flow"""
    
    print("🔍 FRONTEND LOGISTICS TEST")
    print("=" * 50)
    
    # Test email content
    email_content = 'SO 2972 for Georgia Western Inc. - 4 cases MOV Long Life 0, 4 cases MOV Long Life 1, 4 pails MOV Long Life 1. Batch: CC-09-06-24. Total weight: 1200 kg. 2 pallets (48x40 standard size).'
    
    try:
        # Test the backend API directly (what the frontend calls)
        print("1. Testing backend API...")
        response = requests.post('http://localhost:5002/api/logistics/process-email', 
                                json={
                                    'email_content': email_content,
                                    'user_name': 'Test User',
                                    'document_date': '2025-09-25'
                                })
        
        if response.status_code != 200:
            print(f"❌ Backend API failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        if not data.get('success'):
            print(f"❌ Backend API returned error: {data.get('error')}")
            return False
        
        print("✅ Backend API working")
        
        # Check if we have the required data structure
        extracted_data = data.get('extracted_data', {})
        email_analysis = extracted_data.get('email_analysis', {})
        so_data = extracted_data
        
        print(f"2. Checking data structure...")
        print(f"   Email analysis keys: {list(email_analysis.keys())}")
        print(f"   SO data keys: {list(so_data.keys())}")
        
        # Check critical fields
        required_email_fields = ['so_number', 'total_weight', 'batch_numbers', 'pallet_info']
        required_so_fields = ['items', 'customer_name', 'billing_address', 'shipping_address']
        
        missing_email = [field for field in required_email_fields if not email_analysis.get(field)]
        missing_so = [field for field in required_so_fields if not so_data.get(field)]
        
        if missing_email:
            print(f"❌ Missing email fields: {missing_email}")
            return False
        
        if missing_so:
            print(f"❌ Missing SO fields: {missing_so}")
            return False
        
        print("✅ All required data fields present")
        
        # Test document generation
        print("3. Testing document generation...")
        doc_response = requests.post('http://localhost:5002/api/logistics/generate-documents', 
                                   json={
                                       'so_data': so_data,
                                       'document_types': ['bill_of_lading', 'packing_slip']
                                   })
        
        if doc_response.status_code != 200:
            print(f"❌ Document generation failed: {doc_response.status_code}")
            print(f"Response: {doc_response.text}")
            return False
        
        doc_data = doc_response.json()
        if not doc_data.get('success'):
            print(f"❌ Document generation returned error: {doc_data.get('error')}")
            return False
        
        print("✅ Document generation working")
        print(f"   Generated {len(doc_data.get('documents', []))} documents")
        
        print("\n✅ COMPLETE LOGISTICS FLOW WORKING!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_frontend_logistics()
    if success:
        print("\n🎉 Logistics page is fully functional!")
    else:
        print("\n💥 Logistics page has issues that need fixing!")

