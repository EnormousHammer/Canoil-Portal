"""
Test Multi-SO Parsing with actual example email
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

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

def test_so_extraction():
    """Test that we extract all SO numbers correctly"""
    print("="*60)
    print("TEST 1: SO Number Extraction")
    print("="*60)
    
    from logistics_automation import extract_all_so_numbers
    
    so_numbers = extract_all_so_numbers(test_email)
    
    print(f"Email content preview: {test_email[:200]}...")
    print(f"\nExtracted SO numbers: {so_numbers}")
    
    # Verify
    expected = ["3004", "3020"]
    if set(so_numbers) == set(expected):
        print(f"✅ PASSED: Found expected SOs {expected}")
    else:
        print(f"❌ FAILED: Expected {expected}, got {so_numbers}")
    
    return so_numbers

def test_multi_so_fallback_parsing():
    """Test fallback regex parsing for multi-SO"""
    print("\n" + "="*60)
    print("TEST 2: Multi-SO Fallback Parsing")
    print("="*60)
    
    from logistics_automation import parse_multi_so_fallback
    
    result = parse_multi_so_fallback(test_email)
    
    print(f"\nParsed result:")
    print(f"  so_numbers: {result.get('so_numbers')}")
    print(f"  po_numbers: {result.get('po_numbers')}")
    print(f"  items_by_so keys: {list(result.get('items_by_so', {}).keys())}")
    
    for so_num, items in result.get('items_by_so', {}).items():
        print(f"\n  SO {so_num} items:")
        for item in items:
            print(f"    - {item.get('quantity')} {item.get('unit')} of {item.get('description')}")
            print(f"      Batch: {item.get('batch_number', 'N/A')}")
            print(f"      Weight: {item.get('gross_weight', 'N/A')}")
            print(f"      Pallets: {item.get('pallet_count', 'N/A')}")
    
    return result

def test_pallet_counting():
    """Test pallet count extraction from email"""
    print("\n" + "="*60)
    print("TEST 3: Pallet Count Extraction")
    print("="*60)
    
    import re
    
    pallet_matches = re.findall(r'[Oo]n\s+(\d+)\s+(?:pallet|skid)', test_email)
    total_pallets = sum(int(p) for p in pallet_matches)
    
    print(f"Pallet mentions found: {pallet_matches}")
    print(f"Total pallets: {total_pallets}")
    
    expected = 19  # 10 + 9
    if total_pallets == expected:
        print(f"✅ PASSED: Correct pallet count {expected}")
    else:
        print(f"❌ FAILED: Expected {expected}, got {total_pallets}")
    
    return total_pallets

def test_gpt_parsing():
    """Test GPT-based multi-SO parsing (requires API key)"""
    print("\n" + "="*60)
    print("TEST 4: GPT Multi-SO Parsing")
    print("="*60)
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key or len(api_key) < 20:
        print("⚠️ SKIPPED: No valid OPENAI_API_KEY found")
        return None
    
    from logistics_automation import parse_multi_so_email_with_gpt4
    
    try:
        result = parse_multi_so_email_with_gpt4(test_email)
        
        print(f"\nGPT Parsed result:")
        print(f"  so_numbers: {result.get('so_numbers')}")
        print(f"  po_numbers: {result.get('po_numbers')}")
        print(f"  company_name: {result.get('company_name')}")
        print(f"  combined_totals: {result.get('combined_totals')}")
        
        items_by_so = result.get('items_by_so', {})
        print(f"\n  Items by SO:")
        for so_num, items in items_by_so.items():
            print(f"\n  SO {so_num}:")
            for item in items:
                print(f"    - {item.get('quantity')} {item.get('unit')} of {item.get('description')}")
                print(f"      Batch: {item.get('batch_number', 'N/A')}")
                print(f"      Weight: {item.get('gross_weight', 'N/A')}")
                print(f"      Pallets: {item.get('pallet_count', 'N/A')}")
        
        return result
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("\n" + "="*60)
    print("MULTI-SO PARSING TESTS")
    print("="*60 + "\n")
    
    # Run tests
    test_so_extraction()
    test_multi_so_fallback_parsing()
    test_pallet_counting()
    test_gpt_parsing()
    
    print("\n" + "="*60)
    print("TESTS COMPLETE")
    print("="*60)

if __name__ == '__main__':
    main()

