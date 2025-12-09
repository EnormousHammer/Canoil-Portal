"""
Test GPT-5 parsing with sample pail instruction
"""
import requests
import json

# Exact email from user with sample pail instruction
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

def test_full_flow():
    print("="*70)
    print("TESTING GPT-5 WITH SAMPLE PAIL INSTRUCTION")
    print("="*70)
    
    # Step 1: Process email
    print("\n📧 STEP 1: Processing email with GPT-5...")
    url = "http://localhost:5002/api/logistics/process-email"
    
    response = requests.post(url, json={"email_content": test_email}, timeout=180)
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return
    
    result = response.json()
    
    print(f"\n✅ Email processed successfully!")
    print(f"   SO Numbers: {result.get('so_numbers')}")
    
    # Show items by SO
    email_data = result.get('email_data', {})
    items_by_so = email_data.get('items_by_so', {})
    
    print(f"\n📦 ITEMS EXTRACTED BY SO:")
    for so_num, items in items_by_so.items():
        print(f"\n   SO {so_num}:")
        for item in items:
            sample_flag = " 🎁 SAMPLE" if item.get('is_sample') or 'sample' in str(item).lower() else ""
            print(f"      - {item.get('quantity')} {item.get('unit')} of {item.get('description')}{sample_flag}")
            if item.get('is_sample'):
                print(f"        💰 Value: $0 (free/sample)")
    
    # Check if sample pail was detected for SO 3020
    so_3020_items = items_by_so.get('3020', [])
    print(f"\n🔍 SO 3020 has {len(so_3020_items)} items")
    
    # Step 2: Generate Commercial Invoice
    print(f"\n📄 STEP 2: Generating Commercial Invoice...")
    ci_url = "http://localhost:5002/api/logistics/generate-commercial-invoice"
    
    ci_payload = {
        "so_data": result.get('so_data', {}),
        "items": result.get('items', []),
        "email_analysis": result.get('email_data', {})
    }
    
    ci_response = requests.post(ci_url, json=ci_payload, timeout=120)
    
    if ci_response.status_code == 200:
        ci_result = ci_response.json()
        print(f"\n✅ COMMERCIAL INVOICE GENERATED!")
        print(f"   File: {ci_result.get('download_url', 'N/A')}")
        
        # Read and show the items table from the HTML
        import os
        filename = ci_result.get('download_url', '').replace('/download/logistics/', '')
        if filename:
            filepath = os.path.join('uploads', 'logistics', filename)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract items from the HTML
                import re
                items_pattern = r'<textarea class="item-description"[^>]*>([^<]+)</textarea>'
                qty_pattern = r'<input class="unit-qty"[^>]*value="(\d+)"'
                price_pattern = r'<input class="unit-price"[^>]*value="\$([^"]+)"'
                hts_pattern = r'<input class="hts-code"[^>]*value="([^"]+)"'
                
                descriptions = re.findall(items_pattern, content)
                quantities = re.findall(qty_pattern, content)
                prices = re.findall(price_pattern, content)
                hts_codes = re.findall(hts_pattern, content)
                
                print(f"\n📋 COMMERCIAL INVOICE ITEMS:")
                print("-" * 80)
                print(f"{'Description':<45} {'Qty':>8} {'Price':>12} {'HTS':>15}")
                print("-" * 80)
                
                for i, desc in enumerate(descriptions):
                    qty = quantities[i] if i < len(quantities) else "?"
                    price = prices[i] if i < len(prices) else "?"
                    hts = hts_codes[i] if i < len(hts_codes) else "?"
                    print(f"{desc[:44]:<45} {qty:>8} ${price:>11} {hts:>15}")
                
                print("-" * 80)
                print(f"Total items on invoice: {len(descriptions)}")
    else:
        print(f"❌ Commercial Invoice Error: {ci_response.status_code}")
        print(ci_response.text)

if __name__ == '__main__':
    test_full_flow()

