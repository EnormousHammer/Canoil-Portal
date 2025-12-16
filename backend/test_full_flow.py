"""
End-to-End Test for Near North Broker Detection
This simulates the full flow from process-email to generate-all-documents
"""

import requests
import json
from bs4 import BeautifulSoup
import sys

BASE_URL = "http://localhost:5002"

# Updated to test the new use_near_north flag

def test_full_flow():
    """Test the complete flow: process-email -> generate-all-documents"""
    
    print("=" * 70)
    print("END-TO-END TEST: Near North Broker Detection")
    print("=" * 70)
    
    # Step 1: Process the email
    print("\n📧 STEP 1: Processing email with Near North mentioned...")
    
    email_content = """Hi Haron,

Chalmers & Kubeck Inc. - PA purchase order number L120225EG (Canoil sales order 3091 attached) is ready to go out the door:

2 drums of MOV Extra 0 - Drums
375 kg total net weight, batch number CCL-25342
On 1 pallet, 45×45×40 inches 

Broker: Near North"""
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/logistics/process-email",
            json={"email_content": email_content},
            timeout=120
        )
        
        if response.status_code != 200:
            print(f"❌ process-email failed with status {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
        
        result = response.json()
        
        print(f"\n✅ Email processed successfully!")
        print(f"   SO Number: {result.get('so_data', {}).get('so_number', 'N/A')}")
        
        # Check if email_analysis has the broker fields
        email_analysis = result.get('email_analysis', {})
        print(f"\n📋 email_analysis fields:")
        print(f"   'raw_text' present: {'raw_text' in email_analysis}")
        print(f"   'customs_broker': '{email_analysis.get('customs_broker', 'NOT SET')}'")
        print(f"   'customs_broker_phone': '{email_analysis.get('customs_broker_phone', 'NOT SET')}'")
        
        if 'raw_text' not in email_analysis:
            print("\n❌ PROBLEM: raw_text is NOT in email_analysis!")
            print(f"   Available keys: {list(email_analysis.keys())}")
        
        if not email_analysis.get('customs_broker'):
            print("\n❌ PROBLEM: customs_broker is NOT set in email_analysis!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Is it running?")
        return False
    except Exception as e:
        print(f"❌ Error in process-email: {e}")
        return False
    
    # Step 2: Generate all documents (mimics frontend)
    print("\n" + "=" * 70)
    print("📄 STEP 2: Generating all documents...")
    print("=" * 70)
    
    try:
        # This is exactly what the frontend sends
        request_data = {
            'so_data': result.get('so_data', {}),
            'email_shipping': result.get('email_shipping', {}),
            'email_analysis': result.get('email_analysis', {}),  # Should have raw_text and customs_broker
            'items': result.get('items', [])
        }
        
        print(f"\n📤 Sending to generate-all-documents:")
        print(f"   email_analysis keys: {list(request_data['email_analysis'].keys())}")
        print(f"   raw_text present: {'raw_text' in request_data['email_analysis']}")
        print(f"   customs_broker: '{request_data['email_analysis'].get('customs_broker', 'NOT SET')}'")
        
        response = requests.post(
            f"{BASE_URL}/api/logistics/generate-all-documents",
            json=request_data,
            timeout=120
        )
        
        if response.status_code != 200:
            print(f"❌ generate-all-documents failed with status {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
        
        gen_result = response.json()
        print(f"\n✅ Documents generated!")
        
    except Exception as e:
        print(f"❌ Error in generate-all-documents: {e}")
        return False
    
    # Step 3: Check the Commercial Invoice output
    print("\n" + "=" * 70)
    print("🔍 STEP 3: Checking Commercial Invoice broker fields...")
    print("=" * 70)
    
    ci_result = gen_result.get('commercial_invoice', {})
    if not ci_result.get('success'):
        print(f"❌ Commercial Invoice was not generated")
        print(f"   Reason: {ci_result.get('reason', 'Unknown')}")
        return False
    
    # Download and parse the CI
    ci_url = ci_result.get('download_url', '')
    print(f"\n📥 Downloading CI from: {ci_url}")
    
    try:
        ci_response = requests.get(f"{BASE_URL}{ci_url}", timeout=30)
        if ci_response.status_code != 200:
            print(f"❌ Could not download CI: {ci_response.status_code}")
            return False
        
        soup = BeautifulSoup(ci_response.text, 'html.parser')
        
        # Check broker fields
        broker_company = soup.find(id='brokerCompany')
        broker_phone = soup.find(id='brokerPhone')
        broker_fax = soup.find(id='brokerFax')
        broker_paps = soup.find(id='brokerPaps')
        brokerage = soup.find(id='brokerage')
        duty_exporter = soup.find(id='dutyExporter')
        
        print("\n📋 COMMERCIAL INVOICE BROKER FIELDS:")
        
        results = []
        
        # Check each field
        if broker_company:
            value = broker_company.get('value', '')
            expected = 'Near North Customs Brokers US Inc'
            passed = expected in value
            results.append(('brokerCompany', value, passed))
            print(f"\n   brokerCompany: '{value}'")
            print(f"   Expected: '{expected}'")
            print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
        else:
            results.append(('brokerCompany', 'NOT FOUND', False))
            print(f"\n   ❌ brokerCompany NOT FOUND!")
        
        if broker_phone:
            value = broker_phone.get('value', '')
            expected = '716-204-4020'
            passed = expected in value
            results.append(('brokerPhone', value, passed))
            print(f"\n   brokerPhone: '{value}'")
            print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
        else:
            results.append(('brokerPhone', 'NOT FOUND', False))
            print(f"\n   ❌ brokerPhone NOT FOUND!")
        
        if broker_fax:
            value = broker_fax.get('value', '')
            expected = '716-204-5551'
            passed = expected in value
            results.append(('brokerFax', value, passed))
            print(f"\n   brokerFax: '{value}'")
            print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
        else:
            results.append(('brokerFax', 'NOT FOUND', False))
            print(f"\n   ❌ brokerFax NOT FOUND!")
        
        if broker_paps:
            value = broker_paps.get('value', '') or broker_paps.get_text() or ''
            expected = 'ENTRY@NEARNORTHUS.COM'
            passed = expected in value.upper()
            results.append(('brokerPaps', value, passed))
            print(f"\n   brokerPaps: '{value}'")
            print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
        else:
            results.append(('brokerPaps', 'NOT FOUND', False))
            print(f"\n   ❌ brokerPaps NOT FOUND!")
        
        if brokerage:
            value = brokerage.get('value', '')
            expected = 'Near North'
            passed = expected in value
            results.append(('brokerage', value, passed))
            print(f"\n   brokerage: '{value}'")
            print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
        else:
            results.append(('brokerage', 'NOT FOUND', False))
            print(f"\n   ❌ brokerage NOT FOUND!")
        
        if duty_exporter:
            checked = duty_exporter.get('checked') is not None
            results.append(('dutyExporter', 'checked' if checked else 'not checked', checked))
            print(f"\n   dutyExporter: {'checked' if checked else 'not checked'}")
            print(f"   {'✅ PASS' if checked else '❌ FAIL'}")
        else:
            results.append(('dutyExporter', 'NOT FOUND', False))
            print(f"\n   ❌ dutyExporter NOT FOUND!")
        
        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        
        passed_count = sum(1 for r in results if r[2])
        total_count = len(results)
        
        print(f"\nPassed: {passed_count}/{total_count}")
        
        if passed_count == total_count:
            print("\n🎉🎉🎉 ALL TESTS PASSED! Near North broker info is correctly filled! 🎉🎉🎉")
            return True
        else:
            print("\n❌ SOME TESTS FAILED:")
            for field, actual, passed in results:
                if not passed:
                    print(f"   - {field}: got '{actual}'")
            return False
        
    except Exception as e:
        print(f"❌ Error checking CI: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = test_full_flow()
    sys.exit(0 if success else 1)

