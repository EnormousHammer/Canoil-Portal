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

PACKING_SLIP_TEMPLATE = os.path.join(_current_dir, 'templates', 'packing_slip', 'Packing Slip Template.html')

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
    
    # Shipped By - Use shipper_override if provided, otherwise billing_address/sold_to, otherwise default to Canoil
    shipped_by = 'Canoil Canada Ltd'
    shipper_override = {}
    try:
        shipper_override = email_shipping.get('shipper_override', {}) or so_data.get('shipper_override', {}) or {}
    except Exception as override_err:
        print(f"WARNING: Could not read shipper_override for Packing Slip: {override_err}")
        shipper_override = {}

    if isinstance(shipper_override, dict) and (shipper_override.get('company') or shipper_override.get('company_name')):
        shipped_by = shipper_override.get('company') or shipper_override.get('company_name', shipped_by)
    else:
        billing_addr = so_data.get('billing_address', {}) or so_data.get('sold_to', {})
        shipped_by = (billing_addr.get('company_name', '') or 
                     billing_addr.get('company', '') or 
                     shipped_by)
    field_values['shipped_by'] = shipped_by
    
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
    
    # Clean PICK UP from customer name if present (it's an instruction, not part of name)
    if customer_name:
        customer_name = re.sub(r'\s*-?\s*PICK\s*UP\s*', '', customer_name, flags=re.IGNORECASE).strip()
    
    # Build Sold To address - USE ANY DATA AVAILABLE, NO FILTERING
    billing_addr = so_data.get('billing_address', {}) or so_data.get('sold_to', {})
    
    sold_to_lines = []
    company = billing_addr.get('company_name') or billing_addr.get('company') or customer_name or ''
    
    # Use full_address if available, otherwise build from individual fields
    full_addr = billing_addr.get('full_address', '').strip()
    street = (billing_addr.get('street_address') or billing_addr.get('address') or billing_addr.get('street') or '').strip()
    city = billing_addr.get('city', '').strip()
    province = billing_addr.get('province') or billing_addr.get('state', '').strip()
    postal = billing_addr.get('postal_code') or billing_addr.get('postal', '').strip()
    country = billing_addr.get('country', 'Canada').strip()
    
    # Only add company name if it's NOT already in full_address
    if company and (not full_addr or company.lower() not in full_addr.lower()):
        sold_to_lines.append(company.strip())
    
    if full_addr:
        # Use full_address as-is - don't filter anything
        sold_to_lines.append(full_addr)
    else:
        # Build from individual fields - use whatever exists
        addr_parts = []
        if street:
            addr_parts.append(street)
        if city or province or postal:
            city_prov_postal = f"{city}, {province} {postal}".strip(', ').strip()
            if city_prov_postal and city_prov_postal != ',':
                addr_parts.append(city_prov_postal)
        if country:
            addr_parts.append(country)
        if addr_parts:
            sold_to_lines.append('\n'.join(addr_parts))
    
    field_values['sold_to'] = '\n'.join(sold_to_lines) if sold_to_lines else ''
    
    # Build Ship To address - USE ANY DATA AVAILABLE, NO FILTERING
    shipping_addr = so_data.get('shipping_address', {}) or so_data.get('ship_to', {})
    is_pickup_order = shipping_addr.get('is_pickup', False) or so_data.get('is_pickup_order', False)
    
    ship_to_lines = []
    ship_company = shipping_addr.get('company_name') or shipping_addr.get('company') or customer_name or ''
    
    # Use full_address if available, otherwise build from individual fields
    ship_full_addr = shipping_addr.get('full_address', '').strip()
    
    # Only add company name if it's NOT already in full_address
    if ship_company and (not ship_full_addr or ship_company.lower() not in ship_full_addr.lower()):
        ship_to_lines.append(ship_company.strip())
    
    if is_pickup_order:
        ship_to_lines.append("- PICK UP")
    ship_street = (shipping_addr.get('street_address') or shipping_addr.get('address') or shipping_addr.get('street') or '').strip()
    ship_city = shipping_addr.get('city', '').strip()
    ship_province = shipping_addr.get('province') or shipping_addr.get('state', '').strip()
    ship_postal = shipping_addr.get('postal_code') or shipping_addr.get('postal', '').strip()
    ship_country = shipping_addr.get('country', 'Canada').strip()
    
    if ship_full_addr:
        # Use full_address as-is - don't filter anything
        ship_to_lines.append(ship_full_addr)
    else:
        # Build from individual fields - use whatever exists
        addr_parts = []
        if ship_street:
            addr_parts.append(ship_street)
        if ship_city or ship_province or ship_postal:
            city_prov_postal = f"{ship_city}, {ship_province} {ship_postal}".strip(', ').strip()
            if city_prov_postal and city_prov_postal != ',':
                addr_parts.append(city_prov_postal)
        if ship_country:
            addr_parts.append(ship_country)
        if addr_parts:
            ship_to_lines.append('\n'.join(addr_parts))
    
    field_values['ship_to'] = '\n'.join(ship_to_lines) if ship_to_lines else ''
    
    # Items - USE COMBINED SO DATA (items parameter) - it has correct sample placement
    # DO NOT use email_shipping.get('items') - that's raw email data without proper sample handling
    items_to_show = []
    
    print(f"\n=== DEBUG PACKING SLIP ITEMS ===")
    print(f"items parameter count: {len(items) if items else 0}")
    
    if items:
        print(f"DEBUG: SO ITEMS RAW DATA:")
        for i, item in enumerate(items, 1):
            print(f"  Item {i}: {item}")
        # For No-SO mode, be more permissive - only filter obvious charges
        physical_items = []
        for item in items:
            item_code = item.get('item_code', '').upper()
            description = str(item.get('description', '')).lower()
            
            # Only filter out OBVIOUS charges - be very permissive
            is_obvious_charge = (
                item_code in ['PALLET', 'FREIGHT', 'BROKERAGE'] or
                item_code == 'FREIGHT CHARGE' or
                item_code == 'BROKERAGE CHARGE' or
                (description == 'pallet charge' or description == 'freight charge' or description == 'brokerage charge')
            )
            
            # Include everything else - don't filter too aggressively
            if not is_obvious_charge:
                physical_items.append(item)
            else:
                print(f"DEBUG: Filtered out obvious charge: {item_code} / {description}")
        
        # If filtering removed everything, use original items (might be No-SO mode with clean data)
        if not physical_items and items:
            print(f"DEBUG: Filtering removed all items, using original items (likely No-SO mode)")
            physical_items = items
        
        items_to_show = physical_items[:5]  # Max 5 items (template has 5 pre-defined rows)
        print(f"DEBUG: Using {len(items_to_show)} items for packing slip")
    
    # Populate only the items that exist
    for i, item in enumerate(items_to_show, 1):
        quantity = item.get('quantity', '')
        field_values[f'item_description_{i}'] = item.get('description', '')
        field_values[f'unit_{i}'] = item.get('unit', '')
        field_values[f'ordered_qty_{i}'] = str(quantity)
        field_values[f'shipped_qty_{i}'] = str(quantity)
        
        # Batch/Lot Number - support for new template with batch column
        # Template uses 'lot_batch_X' IDs for the batch/lot number fields
        batch_number = item.get('batch_number', '') or item.get('lot_number', '') or ''
        field_values[f'lot_batch_{i}'] = str(batch_number)
            
        print(f"DEBUG: Item {i}: {item.get('description', '')} - Qty: {quantity} - Batch: {batch_number}")
    
    # Populate ALL fields
    print(f"\n🔍 DEBUG: PACKING SLIP FIELD_VALUES BEFORE POPULATION:")
    for key, val in field_values.items():
        print(f"   {key}: '{val}'")
    print(f"🔍 Total field_values: {len(field_values)}")
    
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
