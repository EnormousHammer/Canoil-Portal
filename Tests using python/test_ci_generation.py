#!/usr/bin/env python3
"""
Test script for Commercial Invoice generation with updated template
"""

import sys
import os
import json
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from logistics_automation import gpt4o_generate_commercial_invoice

def test_commercial_invoice_generation():
    """Test the commercial invoice generation with sample data"""
    
    print("🧪 Testing Commercial Invoice Generation with Updated Template...")
    
    # Sample SO data
    so_data = {
        "so_number": "2961",
        "date": "2024-12-19",
        "customer_info": {
            "name": "Test Customer Inc.",
            "address": "123 Main Street",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "United States"
        },
        "shipping_address": {
            "name": "Test Customer Inc.",
            "address": "123 Main Street",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "United States"
        },
        "order_details": {
            "po_number": "PO-67890"
        }
    }
    
    # Sample email shipping data
    email_shipping = {
        "port_loading": "Toronto, ON",
        "port_discharge": "New York, NY",
        "currency": "USD",
        "duty_rate": 2.5,
        "tax_rate": 0,
        "terms_of_sale": "FOB Georgetown, ON",
        "payment_terms": "Net 30 Days",
        "special_instructions": "Handle with care - hazardous materials",
        "authorized_signature": "Export Manager",
        "signature_title": "Export Manager",
        "notify_party_name": "Test Customer Inc.",
        "notify_party_address": "123 Main Street\nNew York, NY 10001\nUnited States",
        "notify_party_country": "United States",
        "export_date": "2024-12-20"
    }
    
    # Sample items data
    items = [
        {
            "item_code": "REOL46XCDRM",
            "description": "REOLUBE 46XC DRUM - Synthetic Hydraulic Oil",
            "quantity": 10,
            "unit": "DRUM",
            "unit_price": 1046.58,
            "total_price": 10465.80
        },
        {
            "item_code": "HYDROIL20",
            "description": "Hydraulic Oil - Synthetic Grade 20",
            "quantity": 5,
            "unit": "DRUM",
            "unit_price": 200.00,
            "total_price": 1000.00
        }
    ]
    
    try:
        print("📄 Generating Commercial Invoice...")
        html_content = gpt4o_generate_commercial_invoice(so_data, email_shipping, items)
        
        # Save the generated HTML for inspection
        output_file = "test_commercial_invoice_output.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"✅ Commercial Invoice generated successfully!")
        print(f"📁 Output saved to: {output_file}")
        
        # Check if key fields are populated
        if "SO-2961" in html_content or "2961" in html_content:
            print("✅ SO Number populated correctly")
        else:
            print("❌ SO Number not found in output")
            
        if "Test Customer Inc." in html_content:
            print("✅ Customer name populated correctly")
        else:
            print("❌ Customer name not found in output")
            
        if "REOLUBE 46XC DRUM" in html_content:
            print("✅ Item description populated correctly")
        else:
            print("❌ Item description not found in output")
            
        if "USD" in html_content:
            print("✅ Currency populated correctly")
        else:
            print("❌ Currency not found in output")
            
        print("\n🎯 Commercial Invoice generation test completed!")
        
    except Exception as e:
        print(f"❌ Error generating Commercial Invoice: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_commercial_invoice_generation()
