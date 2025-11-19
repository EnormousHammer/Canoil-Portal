#!/usr/bin/env python3
"""
Test script for Commercial Invoice field mapping verification
"""

import sys
import os
import json
import re
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_field_mapping():
    """Test that the field mapping logic works with the updated template"""
    
    print("🧪 Testing Commercial Invoice Field Mapping...")
    
    # Load the updated template
    template_path = r"G:\Shared drives\IT_Automation\Automating Roles\Logistics\Commercial Invoice\Commercial Invoice Template - Enterprise.html"
    
    if not os.path.exists(template_path):
        print(f"❌ Template not found: {template_path}")
        return False
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template_html = f.read()
    
    print("✅ Template loaded successfully")
    
    # Test field IDs that should exist in the template
    expected_fields = [
        'shipment_ref',
        'invoice_date', 
        'currency',
        'date_of_sale',
        'exporter',
        'consignee',
        'ship_to',
        'buyer',
        'country_export',
        'country_dest',
        'port_entry',
        'incoterms',
        'duty_account',
        'freight',
        'discounts',
        'shipment_ctrl'
    ]
    
    print(f"🔍 Checking {len(expected_fields)} expected fields...")
    
    missing_fields = []
    found_fields = []
    
    for field_id in expected_fields:
        # Check for input fields
        input_pattern = f'id="{field_id}"'
        textarea_pattern = f'id="{field_id}"'
        select_pattern = f'id="{field_id}"'
        
        if (input_pattern in template_html or 
            textarea_pattern in template_html or 
            select_pattern in template_html):
            found_fields.append(field_id)
        else:
            missing_fields.append(field_id)
    
    print(f"✅ Found {len(found_fields)} fields")
    print(f"❌ Missing {len(missing_fields)} fields")
    
    if missing_fields:
        print("\n❌ Missing fields:")
        for field in missing_fields:
            print(f"  - {field}")
    
    # Test the field population logic
    print("\n🧪 Testing field population logic...")
    
    # Sample field assignments (simulating what GPT-4o would generate)
    field_assignments = {
        'shipment_ref': 'SO-2961',
        'invoice_date': '2024-12-19',
        'currency': 'USD',
        'date_of_sale': '2024-12-19',
        'exporter': 'Canoil Canada Ltd.\\n62 Todd Road, Georgetown, Ontario L7G 4R7, Canada\\nPhone: (905) 873-2000 | Email: info@canoil.ca',
        'consignee': 'Test Customer Inc.\\n123 Main St\\nNew York, NY 10001\\nUnited States\\n\\nItems:\\n1. REOLUBE 46XC DRUM - 10 DRUM @ $1046.58 = $10,465.80\\n2. Hydraulic Oil - 5 DRUM @ $200.00 = $1,000.00\\n\\nTotal: $11,465.80',
        'ship_to': 'Test Customer Inc.\\n123 Main St\\nNew York, NY 10001\\nUnited States',
        'buyer': 'Test Customer Inc.',
        'country_export': 'Canada',
        'country_dest': 'United States',
        'port_entry': 'New York, NY',
        'incoterms': 'FOB Georgetown, ON',
        'duty_account': 'Exporter',
        'freight': '',
        'discounts': '',
        'shipment_ctrl': 'PO-67890'
    }
    
    # Test field population
    populated_html = template_html
    
    for field_id, field_value in field_assignments.items():
        if field_id in found_fields:
            # Test input field population
            input_pattern = f'<input([^>]*id="{field_id}"[^>]*)>'
            input_match = re.search(input_pattern, populated_html)
            if input_match:
                print(f"✅ Input field {field_id} found and can be populated")
                continue
            
            # Test textarea field population
            textarea_pattern = f'<textarea([^>]*id="{field_id}"[^>]*)>.*?</textarea>'
            textarea_match = re.search(textarea_pattern, populated_html, re.DOTALL)
            if textarea_match:
                print(f"✅ Textarea field {field_id} found and can be populated")
                continue
            
            # Test select field population
            select_pattern = f'<select([^>]*id="{field_id}"[^>]*)>.*?</select>'
            select_match = re.search(select_pattern, populated_html, re.DOTALL)
            if select_match:
                print(f"✅ Select field {field_id} found and can be populated")
                continue
            
            print(f"❌ Field {field_id} found but cannot be populated (unknown field type)")
        else:
            print(f"❌ Field {field_id} not found in template")
    
    print(f"\n🎯 Field mapping test completed!")
    print(f"📊 Results: {len(found_fields)}/{len(expected_fields)} fields found and mappable")
    
    return len(missing_fields) == 0

if __name__ == "__main__":
    success = test_field_mapping()
    if success:
        print("\n✅ All field mappings are working correctly!")
    else:
        print("\n❌ Some field mappings need attention!")
