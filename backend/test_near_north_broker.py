"""
Test Near North Broker Detection and Commercial Invoice Filling
This test verifies that when "Near North" is mentioned in an email,
the broker information is correctly filled in the Commercial Invoice.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from commercial_invoice_html_generator import generate_commercial_invoice_html
from bs4 import BeautifulSoup

def test_near_north_from_email():
    """Test that Near North broker info fills when mentioned in email"""
    
    print("=" * 70)
    print("TEST: Near North Broker Detection from Email")
    print("=" * 70)
    
    # Simulate SO data
    so_data = {
        'so_number': '3091',
        'customer_name': 'Chalmers & Kubeck Inc. - PA',
        'order_date': '12/09/2025',
        'ship_date': '12/09/2025',
        'po_number': 'L120225EG',
        'billing_address': {
            'company': 'Chalmers & Kubeck Inc. - PA',
            'street': '150 Commerce Drive',
            'city': 'Ashton',
            'province': 'PA',
            'postal': '19014-0447',
            'country': 'USA'
        },
        'shipping_address': {
            'company': 'Chalmers & Kubeck Inc. - PA',
            'street': '100 Commerce Drive',
            'city': 'Aston',
            'province': 'PA',
            'postal': '19014',
            'country': 'USA'
        },
        'items': [
            {
                'item_code': 'MOVEXT0DRM',
                'description': 'MOV Extra 0 - Drums',
                'quantity': 2,
                'unit': 'DRUM',
                'unit_price': 2500.00,
                'total_price': 5000.00,
                'hts_code': '2710.19.3500',
                'country_of_origin': 'Canada'
            }
        ],
        'subtotal': 5000.00,
        'total_amount': 5000.00,
        'raw_text': 'FREIGHT CHARGE'  # Has freight charge
    }
    
    # Simulate email analysis WITH raw_text containing "Near North"
    email_analysis = {
        'so_number': '3091',
        'po_number': 'L120225EG',
        'company_name': 'Chalmers & Kubeck Inc. - PA',
        'items': [{'description': 'MOV Extra 0', 'quantity': '2', 'unit': 'drums', 'batch_number': 'CCL-25342'}],
        'total_weight': '375 kg',
        'pallet_count': 1,
        'pallet_dimensions': '45×45×40 inches',
        # KEY FIELDS - Near North mentioned in email
        'raw_text': 'Chalmers & Kubeck Inc. - PA purchase order number L120225EG is ready to go out the door. Broker: Near North',
        'customs_broker': 'Near North Customs Brokers',
        'customs_broker_phone': '716-204-4020',
        'customs_broker_fax': '716-204-5551',
        'customs_broker_email': 'entry@nearnorthus.com'
    }
    
    items = so_data['items']
    
    print("\n📧 Email Analysis Data:")
    print(f"   raw_text: '{email_analysis.get('raw_text', 'NOT SET')}'")
    print(f"   customs_broker: '{email_analysis.get('customs_broker', 'NOT SET')}'")
    
    print("\n🔄 Generating Commercial Invoice...")
    
    # Generate the Commercial Invoice
    html_content = generate_commercial_invoice_html(so_data, items, email_analysis)
    
    # Parse the output HTML
    soup = BeautifulSoup(html_content, 'html.parser')
    
    print("\n" + "=" * 70)
    print("RESULTS: Checking Commercial Invoice HTML Output")
    print("=" * 70)
    
    # Check broker fields
    broker_company = soup.find(id='brokerCompany')
    broker_phone = soup.find(id='brokerPhone')
    broker_fax = soup.find(id='brokerFax')
    broker_paps = soup.find(id='brokerPaps')
    brokerage = soup.find(id='brokerage')
    duty_exporter = soup.find(id='dutyExporter')
    duty_consignee = soup.find(id='dutyConsignee')
    
    results = []
    
    # Check brokerCompany
    if broker_company:
        value = broker_company.get('value', '')
        expected = 'Near North Customs Brokers US Inc'
        passed = expected in value
        results.append(('brokerCompany', value, expected, passed))
        print(f"\n✅ brokerCompany field found")
        print(f"   Value: '{value}'")
        print(f"   Expected: '{expected}'")
        print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
    else:
        results.append(('brokerCompany', 'NOT FOUND', 'Near North Customs Brokers US Inc', False))
        print(f"\n❌ brokerCompany field NOT FOUND in HTML!")
    
    # Check brokerPhone
    if broker_phone:
        value = broker_phone.get('value', '')
        expected = '716-204-4020'
        passed = expected in value
        results.append(('brokerPhone', value, expected, passed))
        print(f"\n✅ brokerPhone field found")
        print(f"   Value: '{value}'")
        print(f"   Expected: '{expected}'")
        print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
    else:
        results.append(('brokerPhone', 'NOT FOUND', '716-204-4020', False))
        print(f"\n❌ brokerPhone field NOT FOUND in HTML!")
    
    # Check brokerFax
    if broker_fax:
        value = broker_fax.get('value', '')
        expected = '716-204-5551'
        passed = expected in value
        results.append(('brokerFax', value, expected, passed))
        print(f"\n✅ brokerFax field found")
        print(f"   Value: '{value}'")
        print(f"   Expected: '{expected}'")
        print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
    else:
        results.append(('brokerFax', 'NOT FOUND', '716-204-5551', False))
        print(f"\n❌ brokerFax field NOT FOUND in HTML!")
    
    # Check brokerPaps (email)
    if broker_paps:
        # Could be in value or text content
        value = broker_paps.get('value', '') or broker_paps.get_text() or ''
        expected = 'ENTRY@NEARNORTHUS.COM'
        passed = expected in value.upper()
        results.append(('brokerPaps', value, expected, passed))
        print(f"\n✅ brokerPaps field found")
        print(f"   Value: '{value}'")
        print(f"   Expected: '{expected}'")
        print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
    else:
        results.append(('brokerPaps', 'NOT FOUND', 'ENTRY@NEARNORTHUS.COM', False))
        print(f"\n❌ brokerPaps field NOT FOUND in HTML!")
    
    # Check brokerage field
    if brokerage:
        value = brokerage.get('value', '')
        expected = 'Near North'
        passed = expected in value
        results.append(('brokerage', value, expected, passed))
        print(f"\n✅ brokerage field found")
        print(f"   Value: '{value}'")
        print(f"   Expected contains: '{expected}'")
        print(f"   {'✅ PASS' if passed else '❌ FAIL'}")
    else:
        results.append(('brokerage', 'NOT FOUND', 'Near North', False))
        print(f"\n❌ brokerage field NOT FOUND in HTML!")
    
    # Check duty account radio
    if duty_exporter:
        checked = duty_exporter.get('checked') is not None
        results.append(('dutyExporter', 'checked' if checked else 'not checked', 'checked', checked))
        print(f"\n✅ dutyExporter radio found")
        print(f"   Checked: {checked}")
        print(f"   Expected: checked (because Canoil handles brokerage)")
        print(f"   {'✅ PASS' if checked else '❌ FAIL'}")
    else:
        results.append(('dutyExporter', 'NOT FOUND', 'checked', False))
        print(f"\n❌ dutyExporter radio NOT FOUND in HTML!")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    passed_count = sum(1 for r in results if r[3])
    total_count = len(results)
    
    print(f"\nPassed: {passed_count}/{total_count}")
    
    if passed_count == total_count:
        print("\n🎉 ALL TESTS PASSED! Near North broker info is correctly filled.")
        return True
    else:
        print("\n❌ SOME TESTS FAILED:")
        for field, actual, expected, passed in results:
            if not passed:
                print(f"   - {field}: got '{actual}', expected '{expected}'")
        return False


def test_no_broker_default():
    """Test that broker fields are empty when no broker is mentioned"""
    
    print("\n" + "=" * 70)
    print("TEST: No Broker Mentioned (should be empty)")
    print("=" * 70)
    
    so_data = {
        'so_number': '9999',
        'customer_name': 'Random Customer Inc',
        'billing_address': {
            'company': 'Random Customer Inc',
            'street': '123 Main St',
            'city': 'Buffalo',
            'province': 'NY',
            'postal': '14201',
            'country': 'USA'
        },
        'shipping_address': {
            'company': 'Random Customer Inc',
            'street': '123 Main St',
            'city': 'Buffalo',
            'province': 'NY',
            'postal': '14201',
            'country': 'USA'
        },
        'items': [{'description': 'Test Product', 'quantity': 1, 'unit_price': 100}]
    }
    
    # Email with NO Near North mentioned
    email_analysis = {
        'raw_text': 'Just a normal shipment, nothing special',
        'customs_broker': None
    }
    
    items = so_data['items']
    
    print("\n📧 Email Analysis Data:")
    print(f"   raw_text: '{email_analysis.get('raw_text', 'NOT SET')}'")
    print(f"   customs_broker: '{email_analysis.get('customs_broker', 'NOT SET')}'")
    
    html_content = generate_commercial_invoice_html(so_data, items, email_analysis)
    soup = BeautifulSoup(html_content, 'html.parser')
    
    broker_company = soup.find(id='brokerCompany')
    
    if broker_company:
        value = broker_company.get('value', '')
        if not value or value.strip() == '':
            print(f"\n✅ brokerCompany correctly empty for regular customer")
            return True
        else:
            print(f"\n❌ brokerCompany should be empty but got: '{value}'")
            return False
    else:
        print(f"\n❌ brokerCompany field NOT FOUND")
        return False


if __name__ == '__main__':
    print("\n" + "=" * 70)
    print("NEAR NORTH BROKER TEST SUITE")
    print("=" * 70)
    
    test1_passed = test_near_north_from_email()
    test2_passed = test_no_broker_default()
    
    print("\n" + "=" * 70)
    print("FINAL RESULTS")
    print("=" * 70)
    
    if test1_passed and test2_passed:
        print("\n🎉🎉🎉 ALL TESTS PASSED! 🎉🎉🎉")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        if not test1_passed:
            print("   - Near North detection test FAILED")
        if not test2_passed:
            print("   - No broker default test FAILED")
        sys.exit(1)

