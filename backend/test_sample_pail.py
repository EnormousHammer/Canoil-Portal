"""
Test if the app can handle sample items with instructions at bottom of email
"""
import requests
import json

# Modified email with sample pail instruction at bottom
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

add 1 pail to 3020. no need to add weight just 1 pail which is a sample so no value either, just need to do the right steel commercial invoice things.
"""

def test_sample_parsing():
    print("="*70)
    print("TESTING: Can app handle sample pail instruction?")
    print("="*70)
    
    url = "http://localhost:5002/api/logistics/process-email"
    
    try:
        response = requests.post(url, json={"email_content": test_email}, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n✅ API Response Successful")
            print(f"\n📧 EMAIL DATA:")
            email_data = result.get('email_data', {})
            print(f"   SO Numbers: {email_data.get('so_numbers')}")
            
            # Check items by SO
            items_by_so = email_data.get('items_by_so', {})
            print(f"\n📦 ITEMS BY SO:")
            for so_num, items in items_by_so.items():
                print(f"\n   SO {so_num}:")
                for item in items:
                    print(f"      - {item.get('quantity')} {item.get('unit')} of {item.get('description')}")
                    if item.get('is_sample'):
                        print(f"        ⚠️ SAMPLE - No value")
            
            # Check if sample pail was detected
            so_3020_items = items_by_so.get('3020', [])
            sample_detected = any('sample' in str(item).lower() or 'pail' in str(item.get('unit', '')).lower() 
                                  for item in so_3020_items if item.get('quantity') == '1' or item.get('quantity') == 1)
            
            print(f"\n🔍 SAMPLE DETECTION:")
            print(f"   Was sample pail instruction understood? {sample_detected}")
            print(f"   SO 3020 items count: {len(so_3020_items)}")
            
            return result
        else:
            print(f"\n❌ API Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_sample_parsing()

