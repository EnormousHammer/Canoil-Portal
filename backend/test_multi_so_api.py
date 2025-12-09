"""
Test Multi-SO API endpoint with actual example email
"""
import requests
import json

# Test email content from user
test_email = """
Hi Haron,

AEC Group Inc. purchase orders numbers 20475 & 20496 (Canoil sales orders 3004 & 3020 attached) are ready to go out the door:

Sales Order 3004:
360 pails of AEC Engine Flush Finished 6 Gallon Pail
7,610 kg total gross weight, batch number CCL-25324 
On 10 pallets, 48×40×53 inches each

Sales Order 3020:
500 cases of Diesel - Fuel System 12x1L Cleaning Solution
6,267.3 kg total gross weight, batch number CCL-25304 
On 9 pallets, 48×40×46 inches (8) + 45×40×22 inches (1)
"""

def test_process_email():
    """Test the process-email endpoint with multi-SO email"""
    print("="*70)
    print("TESTING MULTI-SO API: /api/logistics/process-email")
    print("="*70)
    
    url = "http://localhost:5002/api/logistics/process-email"
    
    payload = {
        "email_content": test_email
    }
    
    try:
        print(f"\nSending request to {url}...")
        response = requests.post(url, json=payload, timeout=120)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n{'='*70}")
            print("✅ SUCCESS - MULTI-SO PROCESSING RESULT")
            print(f"{'='*70}")
            
            # Check if multi-SO mode
            print(f"\n📋 MULTI-SO MODE: {result.get('is_multi_so', False)}")
            print(f"📋 SO Numbers: {result.get('so_numbers', 'N/A')}")
            
            # Email data
            email_data = result.get('email_data', {})
            print(f"\n📧 EMAIL DATA:")
            print(f"   SO Number: {email_data.get('so_number')}")
            print(f"   PO Number: {email_data.get('po_number')}")
            print(f"   Company: {email_data.get('company_name')}")
            print(f"   Total Weight: {email_data.get('total_weight')}")
            print(f"   Pallet Count: {email_data.get('pallet_count')}")
            
            # Items by SO
            items_by_so = email_data.get('items_by_so', {})
            if items_by_so:
                print(f"\n📦 ITEMS BY SO:")
                for so_num, items in items_by_so.items():
                    print(f"\n   SO {so_num}:")
                    for item in items:
                        print(f"      - {item.get('quantity')} {item.get('unit')} of {item.get('description')}")
                        print(f"        Batch: {item.get('batch_number', 'N/A')}")
                        print(f"        Weight: {item.get('gross_weight', 'N/A')}")
            
            # Combined SO data
            so_data = result.get('so_data', {})
            print(f"\n📊 COMBINED SO DATA:")
            print(f"   SO Number: {so_data.get('so_number')}")
            print(f"   PO Number: {so_data.get('po_number')}")
            print(f"   Customer: {so_data.get('customer_name')}")
            print(f"   Subtotal: {so_data.get('subtotal')}")
            print(f"   Total: {so_data.get('total')}")
            
            # Items with HTS codes
            items = so_data.get('items', [])
            print(f"\n📦 COMBINED ITEMS ({len(items)} items):")
            for i, item in enumerate(items, 1):
                print(f"\n   Item {i} (from SO {item.get('source_so', 'N/A')}):")
                print(f"      Description: {item.get('description')}")
                print(f"      Item Code: {item.get('item_code')}")
                print(f"      Quantity: {item.get('quantity')} {item.get('unit')}")
                print(f"      Unit Price: {item.get('unit_price')}")
                print(f"      Total: {item.get('total')}")
                print(f"      HTS Code: {item.get('hts_code', 'NOT FOUND')}")
                print(f"      Country of Origin: {item.get('country_of_origin', 'N/A')}")
                print(f"      Batch: {item.get('batch_number', 'N/A')}")
            
            # Validation
            validation = result.get('validation_details', {})
            print(f"\n✅ VALIDATION:")
            print(f"   Is Multi-SO: {validation.get('is_multi_so')}")
            print(f"   Overall Status: {validation.get('overall_status')}")
            
            per_so = validation.get('per_so_validation', [])
            for so_val in per_so:
                print(f"\n   SO {so_val.get('so_number')}:")
                print(f"      Status: {so_val.get('status')}")
                print(f"      Matched: {so_val.get('matched_items')}/{so_val.get('total_email_items')}")
                if so_val.get('unmatched_items'):
                    print(f"      Unmatched: {so_val.get('unmatched_items')}")
            
            # Save full result for inspection
            with open('multi_so_result.json', 'w') as f:
                json.dump(result, f, indent=2, default=str)
            print(f"\n💾 Full result saved to: multi_so_result.json")
            
            return result
            
        else:
            print(f"\n❌ ERROR Response:")
            print(response.text)
            return None
            
    except requests.exceptions.ConnectionError:
        print(f"\n❌ CONNECTION ERROR: Could not connect to {url}")
        print("   Make sure the Flask server is running on port 5002")
        return None
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_generate_commercial_invoice(process_result):
    """Test commercial invoice generation with multi-SO data"""
    if not process_result:
        print("\n⚠️ Skipping commercial invoice test - no process result")
        return
    
    print(f"\n{'='*70}")
    print("TESTING COMMERCIAL INVOICE GENERATION")
    print(f"{'='*70}")
    
    url = "http://localhost:5002/api/logistics/generate-commercial-invoice"
    
    payload = {
        "so_data": process_result.get('so_data', {}),
        "items": process_result.get('items', []),
        "email_analysis": process_result.get('email_data', {})
    }
    
    try:
        print(f"\nSending request to {url}...")
        response = requests.post(url, json=payload, timeout=120)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ COMMERCIAL INVOICE GENERATED:")
            print(f"   Filename: {result.get('filename')}")
            print(f"   Download URL: {result.get('download_url')}")
            
            # Try to get the HTML content
            if result.get('download_url'):
                html_url = f"http://localhost:5002{result.get('download_url')}"
                print(f"\n   Full URL: {html_url}")
            
            return result
        else:
            print(f"\n❌ ERROR Response:")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    result = test_process_email()
    if result:
        test_generate_commercial_invoice(result)

