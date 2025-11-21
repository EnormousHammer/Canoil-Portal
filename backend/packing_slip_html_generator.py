"""
Packing Slip HTML Generator - Field Population
Uses the actual Packing Slip HTML template
"""

import os
import re
from datetime import datetime
from typing import Dict, Any
from bs4 import BeautifulSoup

# Use relative path for Docker compatibility
_current_dir = os.path.dirname(os.path.abspath(__file__))
PACKING_SLIP_TEMPLATE = os.path.join(_current_dir, 'templates', 'packing_slip', 'Packing Slip Template 2.html')

def generate_packing_slip_html(so_data: Dict[str, Any], email_shipping: Dict[str, Any], items: list) -> str:
    """
    Generate Packing Slip HTML using the actual template - ONLY POPULATE FIELDS, DO NOT MODIFY STRUCTURE
    """
    
    print(f"DEBUG: PACKING SLIP - SO Number: {so_data.get('so_number', 'NOT FOUND')}")
    print(f"DEBUG: PACKING SLIP - Customer Name: {so_data.get('customer_name', 'NOT FOUND')}")
    print(f"DEBUG: PACKING SLIP - Items count: {len(items) if items else 0}")
    
    # Load the template
    if not os.path.exists(PACKING_SLIP_TEMPLATE):
        raise FileNotFoundError(f"Packing Slip template not found: {PACKING_SLIP_TEMPLATE}")
    
    with open(PACKING_SLIP_TEMPLATE, 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    print(f"DEBUG: PACKING SLIP - Template loaded successfully")
    
    # Parse with BeautifulSoup for field population ONLY
    soup = BeautifulSoup(template_content, 'html.parser')
    
    # Build all field values first
    field_values = {}
    
    # Header fields
    field_values['packing_slip_number'] = f"PS-{so_data.get('so_number', '')}"
    
    # PACKING DATE - Use order date from parsed SO, fallback to today if not available
    order_date_raw = so_data.get('order_date', '')
    if order_date_raw:
        try:
            # Try different date formats including short year formats
            for date_format in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%B %d, %Y', '%m/%d/%y', '%d/%m/%y']:
                try:
                    parsed_date = datetime.strptime(str(order_date_raw), date_format)
                    field_values['packing_date'] = parsed_date.strftime('%B %d, %Y')
                    print(f"DEBUG: Parsed order_date '{order_date_raw}' as '{field_values['packing_date']}'")
                    break
                except ValueError:
                    continue
            else:
                # If parsing fails, use as-is
                print(f"WARNING: Could not parse order_date '{order_date_raw}', using as-is")
                field_values['packing_date'] = str(order_date_raw)
        except Exception as e:
            print(f"ERROR: Exception parsing order_date '{order_date_raw}': {e}")
            field_values['packing_date'] = str(order_date_raw)
    else:
        # Fallback to today's date if order date not available
        today = datetime.now()
        field_values['packing_date'] = today.strftime('%B %d, %Y')
        print(f"DEBUG: No order_date found, using today's date: {field_values['packing_date']}")
    
    field_values['sales_order_number'] = so_data.get('so_number', '')
    field_values['shipped_by'] = 'Canoil Canada Ltd'
    
    # SCHEDULED SHIP DATE - Use ship date from parsed SO data ONLY - NO FAKE DATA
    ship_date_raw = (
        so_data.get('ship_date') or 
        so_data.get('order_details', {}).get('ship_date') or 
        so_data.get('scheduled_ship_date') or
        email_shipping.get('ship_date')
    )
    
    if ship_date_raw:
        # Parse the date and format as "October 02, 2025"
        try:
            # Try different date formats including short year formats
            for date_format in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%B %d, %Y', '%m/%d/%y', '%d/%m/%y']:
                try:
                    parsed_date = datetime.strptime(str(ship_date_raw), date_format)
                    field_values['scheduled_ship_date'] = parsed_date.strftime('%B %d, %Y')
                    print(f"DEBUG: Parsed ship_date '{ship_date_raw}' as '{field_values['scheduled_ship_date']}'")
                    break
                except ValueError:
                    continue
            else:
                # If parsing fails, try to handle it manually
                print(f"WARNING: Could not parse ship_date '{ship_date_raw}', using as-is")
                field_values['scheduled_ship_date'] = str(ship_date_raw)
        except Exception as e:
            print(f"ERROR: Exception parsing ship_date '{ship_date_raw}': {e}")
            field_values['scheduled_ship_date'] = str(ship_date_raw)
    else:
        field_values['scheduled_ship_date'] = ''  # Leave empty if not in SO - NO FAKE DATA
    
    # TRACKING NUMBER - from email only, leave empty if not present - NO FAKE DATA
    field_values['tracking_number'] = email_shipping.get('tracking_number', '')
    
    # PO NUMBER - Extract from parsed SO data ONLY - NO FAKE DATA
    po_number = so_data.get('order_details', {}).get('po_number', '') or so_data.get('po_number', '')
    # Add PO# prefix if PO number exists and doesn't already have it
    if po_number:
        if not po_number.upper().startswith('PO'):
            field_values['comments'] = f"PO#{po_number}"
        else:
            field_values['comments'] = po_number
    else:
        field_values['comments'] = ''  # Leave empty if not in SO
    
    # DO NOT FILL SOLD BY - leave empty for manual filling
    
    # Address fields - COMPLETE FORMATTING WITH ALL PARSED FIELDS
    customer_name = so_data.get('customer_name', '')
    
    # Build Sold To address with ALL fields from billing address
    # Support both 'billing_address' and 'sold_to' field names (from different parsers)
    sold_to_lines = []
    billing_addr = so_data.get('billing_address', {}) or so_data.get('sold_to', {})
    
    # Company name
    if customer_name:
        sold_to_lines.append(customer_name)
    
    # Attention line (if exists) - support multiple field names
    contact = billing_addr.get('attention') or billing_addr.get('attn') or billing_addr.get('contact_person')
    if contact:
        sold_to_lines.append(f"Attn: {contact}")
    
    # Street address - support multiple field names
    street = billing_addr.get('address') or billing_addr.get('street1') or billing_addr.get('street_address')
    if street:
        sold_to_lines.append(street)
    
    # City, Province/State, Postal Code
    if billing_addr.get('city'):
        city_parts = [billing_addr.get('city', '')]
        if billing_addr.get('province') or billing_addr.get('state'):
            city_parts.append(billing_addr.get('province') or billing_addr.get('state'))
        if billing_addr.get('postal_code'):
            city_parts.append(billing_addr.get('postal_code'))
        city_line = ', '.join([p for p in city_parts if p]).strip()
        sold_to_lines.append(city_line)
    
    # Country
    if billing_addr.get('country'):
        sold_to_lines.append(billing_addr.get('country'))
    
    field_values['sold_to'] = '\n'.join(sold_to_lines)
    
    # Build Ship To address with ALL fields from shipping address
    # Support both 'shipping_address' and 'ship_to' field names (from different parsers)
    ship_to_lines = []
    shipping_addr = so_data.get('shipping_address', {}) or so_data.get('ship_to', {})
    
    # Company name
    if shipping_addr.get('company'):
        ship_to_lines.append(shipping_addr.get('company'))
    elif customer_name:
        ship_to_lines.append(customer_name)
    
    # Attention line (if exists) - support multiple field names
    contact = shipping_addr.get('attention') or shipping_addr.get('attn') or shipping_addr.get('contact_person')
    if contact:
        ship_to_lines.append(f"Attn: {contact}")
    
    # Street address - support multiple field names
    street = shipping_addr.get('address') or shipping_addr.get('street1') or shipping_addr.get('street_address')
    if street:
        ship_to_lines.append(street)
    
    # City, Province/State, Postal Code
    if shipping_addr.get('city'):
        city_parts = [shipping_addr.get('city', '')]
        if shipping_addr.get('province') or shipping_addr.get('state'):
            city_parts.append(shipping_addr.get('province') or shipping_addr.get('state'))
        if shipping_addr.get('postal_code'):
            city_parts.append(shipping_addr.get('postal_code'))
        ship_city_line = ', '.join([p for p in city_parts if p]).strip()
        ship_to_lines.append(ship_city_line)
    
    # Country
    if shipping_addr.get('country'):
        ship_to_lines.append(shipping_addr.get('country'))
    
    # Phone/Tel (if exists)
    if shipping_addr.get('phone') or shipping_addr.get('tel'):
        phone = shipping_addr.get('phone') or shipping_addr.get('tel')
        ship_to_lines.append(f"Tel: {phone}")
    
    field_values['ship_to'] = '\n'.join(ship_to_lines)
    
    # Items - USE EMAIL DATA ONLY (SO parser is broken)
    items_to_show = []
    
    print(f"\n=== DEBUG PACKING SLIP ITEMS ===")
    print(f"email_shipping has items: {bool(email_shipping.get('items'))}")
    print(f"email_shipping.items count: {len(email_shipping.get('items', []))}")
    print(f"items parameter count: {len(items) if items else 0}")
    
    if email_shipping.get('items'):
        email_items = email_shipping.get('items', [])
        print(f"DEBUG: EMAIL ITEMS RAW DATA:")
        for i, item in enumerate(email_items, 1):
            print(f"  Item {i}: {item}")
        items_to_show = email_items[:5]  # Max 5 items (template has 5 pre-defined rows)
        print(f"DEBUG: Using {len(items_to_show)} EMAIL items")
    elif items:
        print(f"DEBUG: SO ITEMS RAW DATA:")
        for i, item in enumerate(items, 1):
            print(f"  Item {i}: {item}")
        # Fallback to SO items - BULLETPROOF filtering for PRODUCTS ONLY
        physical_items = []
        for item in items:
            item_code = item.get('item_code', '').upper()
            description = str(item.get('description', '')).lower()
            
            # Identify charges/fees by item code patterns
            is_charge_by_code = any([
                item_code in ['PALLET', 'FREIGHT', 'BROKERAGE', 'MISC', 'MISCELLANEOUS'],
                item_code == 'FREIGHT CHARGE',
                item_code == 'BROKERAGE CHARGE',
                'CHARGE' in item_code
            ])
            
            # Identify charges/fees by description patterns
            is_charge_by_description = any([
                'charge' in description,
                'freight' in description,
                'brokerage' in description,
                'miscellaneous' in description,
                'misc' in description,
                'pallet' in description and 'charge' in description,
                'prepaid' in description,
                'shipment' in description and ('prepaid' in description or 'add' in description),
                description.startswith('prepaid'),
                'add shipment' in description
            ])
            
            # Only include if it's NOT a charge/fee
            is_actual_product = not (is_charge_by_code or is_charge_by_description)
            
            if is_actual_product:
                physical_items.append(item)
        items_to_show = physical_items[:5]  # Max 5 items (template has 5 pre-defined rows)
        print(f"DEBUG: Using {len(items_to_show)} SO items")
    
    # Populate only the items that exist
    for i, item in enumerate(items_to_show, 1):
        quantity = item.get('quantity', '')
        field_values[f'item_description_{i}'] = item.get('description', '')
        field_values[f'unit_{i}'] = item.get('unit', '')
        field_values[f'ordered_qty_{i}'] = str(quantity)
        field_values[f'shipped_qty_{i}'] = str(quantity)
            
        print(f"DEBUG: Item {i}: {item.get('description', '')} - Qty: {quantity}")
    
    # Populate ALL fields
    populated_count = 0
    for field_id, value in field_values.items():
        field = soup.find(id=field_id)
        if field:
            if field.name == 'input':
                field['value'] = str(value)
                populated_count += 1
            elif field.name == 'textarea':
                field.clear()
                field.string = str(value)
                populated_count += 1
    
    # HIDE EMPTY ROWS - Only show rows with data
    num_items = len(items_to_show)
    for row_num in range(num_items + 1, 6):  # Hide rows beyond what we have data for (rows 1-5)
        row = soup.find(id=f'item_row_{row_num}')
        if row:
            row['style'] = 'display: none;'
            print(f"DEBUG: Hiding empty row {row_num}")
    
    print(f"DEBUG: PACKING SLIP - Populated {populated_count} fields successfully")
    print(f"DEBUG: PACKING SLIP - Showing {num_items} item rows, hiding {5 - num_items} empty rows")
    
    return str(soup)

def save_packing_slip_html(html_content: str, so_number: str) -> tuple:
    """Save packing slip HTML and return filepath and filename"""
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"PackingSlip_SO{so_number}_{timestamp}.html"
    # Use absolute path to avoid nested directory issues
    from logistics_automation import get_uploads_dir
    uploads_dir = get_uploads_dir()
    filepath = os.path.join(uploads_dir, filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    return filepath, filename
