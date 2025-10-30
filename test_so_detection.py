#!/usr/bin/env python3
"""
Test SO number detection patterns without requiring server
"""

import re

def test_so_patterns():
    """Test SO number extraction patterns"""
    print("🔍 Testing SO number detection patterns...")
    
    test_cases = [
        "Hi Haron, FASTENAL COMPANY-USDpurchase order number ALMN56061 (Canoil sales order 3015, attached) is ready to go out the door:",
        "SO 3015 for Fastenal",
        "sales order 3015 attached", 
        "order 3015 is ready",
        "#3015 for customer",
        "Canoil sales order 3015",
        "SO3015 ready to ship",
        "Order #3015 attached",
        "SO 2972 for Georgia Western",
        "sales order 1234"
    ]
    
    patterns = [
        r'sales order\s+(\d{3,5})',  # "sales order 3015"
        r'SO\s+(\d{3,5})',          # "SO 3015"
        r'order\s+(\d{3,5})',       # "order 3015"
        r'#(\d{3,5})',              # "#3015"
        r'(\d{3,5})',               # Just the number (fallback)
    ]
    
    for email in test_cases:
        print(f"\nTesting: '{email[:50]}...'")
        
        so_number = None
        for pattern in patterns:
            matches = re.findall(pattern, email, re.IGNORECASE)
            if matches:
                so_number = matches[0]
                print(f"  ✅ Pattern '{pattern}' found: {so_number}")
                break
        
        if not so_number:
            print(f"  ❌ No SO number found")

def main():
    print("🚀 Testing SO Number Detection Patterns")
    print("=" * 50)
    test_so_patterns()
    print("\n✅ Pattern testing complete!")

if __name__ == "__main__":
    main()
