#!/usr/bin/env python3
"""
Test the logistics automation flow
"""

import requests
import json

def test_logistics_flow():
    """Test the complete logistics automation flow"""
    
    # Test email with SO 2996
    email_content = """
    Hi team,
    Please prepare shipping for Canoil sales order 2996 for Canadian Bearings Ltd.
    They need 8 drums of REOLUBE 46XC DRUM shipped to their Toronto facility ASAP.
    Total weight is 1,840 kg on 2 pallets.
    Thanks,
    Carolyn
    """
    
    print('🧪 Testing logistics automation flow...')
    print(f'📧 Email content: {len(email_content)} characters')
    
    try:
        # Test the process-email endpoint
        response = requests.post('http://localhost:5002/api/logistics/process-email', 
                               json={'email_content': email_content}, 
                               timeout=30)
        
        print(f'📡 Response status: {response.status_code}')
        
        if response.status_code == 200:
            result = response.json()
            print('✅ SUCCESS! Logistics API working')
            
            # Check email analysis
            email_analysis = result.get('email_analysis', {})
            print(f'📋 SO Number extracted: {email_analysis.get("so_number", "Not found")}')
            print(f'👤 Customer: {email_analysis.get("customer_name", "Not found")}')
            
            # Check SO data lookup
            so_data = result.get('so_data', {})
            print(f'🔍 SO Data Status: {so_data.get("status", "Unknown")}')
            print(f'📦 Items found: {len(so_data.get("items", []))}')
            
            # Check available forms
            available_forms = result.get('available_forms', [])
            print(f'📄 Available forms: {len(available_forms)}')
            for form in available_forms:
                print(f'   - {form.get("name", "Unknown form")}')
            
            return True
            
        else:
            print(f'❌ API Error: {response.status_code}')
            print(f'Response: {response.text}')
            return False
            
    except Exception as e:
        print(f'❌ Connection error: {e}')
        return False

if __name__ == '__main__':
    success = test_logistics_flow()
    if success:
        print('\n🎉 Logistics automation is working!')
    else:
        print('\n💥 Logistics automation needs fixing')
