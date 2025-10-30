#!/usr/bin/env python3
"""
Test BOL generation with real Fastenal data
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from logistics_automation import generate_bol

def test_bol_generation():
    """Test BOL generation with Fastenal data"""
    
    # Real Fastenal data from the email
    fastenal_data = {
        'so_number': '3015',
        'customer_name': 'FASTENAL COMPANY-USD',
        'po_number': 'ALMN56061',
        'shipping_address': {
            'company': 'FASTENAL COMPANY-USD',
            'address': '123 Main Street\nToronto, ON K1A 0A6',
            'city': 'Toronto',
            'province': 'ON',
            'postal_code': 'K1A 0A6',
            'country': 'Canada'
        },
        'items': [
            {
                'item_code': 'ANDEROL FGCS-2',
                'description': 'ANDEROL FGCS-2 Food Grade Grease',
                'quantity': 2,
                'unit': 'PAIL',
                'unit_price': 0.0,
                'total_price': 0.0
            }
        ],
        'total_weight': '34 kg',
        'batch_number': 'WH1K25G043',
        'skid_sizing': '19.5×40×23 inches',
        'pieces': 2,
        'special_instructions': 'Ready to go out the door'
    }
    
    print("🚚 Testing BOL generation with Fastenal data...")
    print(f"📋 SO: {fastenal_data['so_number']}")
    print(f"👤 Customer: {fastenal_data['customer_name']}")
    print(f"📦 Items: {len(fastenal_data['items'])}")
    
    try:
        # Generate BOL
        result = generate_bol(fastenal_data)
        
        if result and 'success' in result:
            print("✅ BOL generated successfully!")
            print(f"📄 PDF saved to: {result.get('pdf_path', 'Unknown')}")
            return True
        else:
            print("❌ BOL generation failed")
            print(f"Error: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Error generating BOL: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_bol_generation()
    if success:
        print("\n🎉 BOL generation test completed successfully!")
    else:
        print("\n💥 BOL generation test failed!")
        sys.exit(1)

