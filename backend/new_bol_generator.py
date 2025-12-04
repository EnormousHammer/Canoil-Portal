"""
New BOL Generator - Professional 8-Row Format
Uses final_bol_template.html with 2 rows per item (product + batch/skid)
"""

import os
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup

# Template location
# Use relative path for Docker compatibility
_current_dir = os.path.dirname(os.path.abspath(__file__))
NEW_BOL_TEMPLATE = os.path.join(_current_dir, 'templates', 'bol', 'final_bol_template.html')

# Dangerous Goods product mapping - ALL REOLUBE products are DG
DANGEROUS_GOODS_PRODUCTS = {
    # REOLUBE products - ALL are UN 3082, Class 9, PG III
    'REOLUBE': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},  # Catch-all for any REOLUBE
    'REOL': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},  # Catch item codes
    'TURBOFLUID': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},  # Alternative name
    '46XC': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},
    '46B': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},
    '32B GT': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},
    '32BGT': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},
    'BVA': {'un': 'UN 3082', 'class': '9', 'pg': 'III'},
}


def format_unit_description(unit_name: str) -> str:
    """
    Convert unit name to professional description
    DRUM -> "Drum of"
    PAIL -> "Pail of"
    etc.
    """
    unit = unit_name.upper()
    
    if 'DRUM' in unit:
        return "Drum of"
    elif 'PAIL' in unit:
        return "Pail of"
    elif 'CASE' in unit:
        return "Case of"
    elif 'GALLON' in unit:
        return "Gallon of"
    elif 'TUBE' in unit:
        return "Tube of"
    elif 'BOTTLE' in unit:
        return "Bottle of"
    elif 'JUG' in unit:
        return "Jug of"
    else:
        # Default: use unit name as-is
        return f"{unit} of"


def detect_dangerous_goods_item(item: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """
    Check if an item is dangerous goods
    Returns DG info dict if DG, None if not
    """
    description = item.get('description', '').upper()
    item_code = item.get('item_code', '').upper()
    
    # Check against known DG products
    for product_name, dg_info in DANGEROUS_GOODS_PRODUCTS.items():
        if product_name.upper() in description or product_name.upper() in item_code:
            return dg_info
    
    return None


def extract_weight_in_kg(email_analysis: Dict[str, Any], so_data: Dict[str, Any], items: List[Dict]) -> float:
    """
    Extract total weight in KG (keep as kg, don't convert to lbs)
    Priority: Email > SO > Estimate
    """
    total_weight_kg = 0.0
    
    # Priority 1: Email analysis
    email_weight = None
    if email_analysis:
        if email_analysis.get('extracted_details', {}).get('total_weight'):
            email_weight = email_analysis['extracted_details']['total_weight']
        elif email_analysis.get('total_weight'):
            email_weight = email_analysis['total_weight']
        elif email_analysis.get('weight'):
            email_weight = email_analysis['weight']
    
    if email_weight:
        weight_str = str(email_weight)
        weight_match = re.search(r'(\d+(?:\.\d+)?)', weight_str)
        if weight_match:
            try:
                weight_value = float(weight_match.group(1))
                if 'lb' in weight_str.lower():
                    # Convert LBS to KG
                    total_weight_kg = weight_value / 2.20462
                else:
                    # Already in KG or assume KG
                    total_weight_kg = weight_value
                
                print(f"   Weight from email: {email_weight} -> {total_weight_kg:.1f} kg")
                return total_weight_kg
            except Exception as e:
                print(f"   Error parsing email weight: {e}")
    
    # Priority 2: SO data
    if so_data.get('total_weight'):
        weight_str = str(so_data['total_weight'])
        weight_match = re.search(r'(\d+(?:\.\d+)?)', weight_str)
        if weight_match:
            try:
                weight_value = float(weight_match.group(1))
                if 'lb' in weight_str.lower():
                    total_weight_kg = weight_value / 2.20462
                else:
                    total_weight_kg = weight_value
                
                print(f"   Weight from SO: {so_data['total_weight']} -> {total_weight_kg:.1f} kg")
                return total_weight_kg
            except Exception as e:
                print(f"   Error parsing SO weight: {e}")
    
    # Priority 3: Estimate from items
    if items:
        print("   Estimating weight from items...")
        estimated_kg = 0
        for item in items:
            qty = int(item.get('quantity', 1))
            desc = item.get('description', '').lower()
            
            # Typical weights in KG
            if 'drum' in desc:
                estimated_kg += qty * 180  # 180kg per drum
            elif 'pail' in desc:
                estimated_kg += qty * 20   # 20kg per pail
            elif 'gallon' in desc:
                estimated_kg += qty * 4    # 4kg per gallon
            elif 'case' in desc:
                estimated_kg += qty * 15   # 15kg per case
            else:
                estimated_kg += qty * 25   # 25kg default
        
        total_weight_kg = estimated_kg
        print(f"   Estimated weight: {total_weight_kg:.1f} kg")
        return total_weight_kg
    
    return 0.0


def extract_batch_numbers(email_analysis: Dict[str, Any], so_data: Dict[str, Any]) -> List[str]:
    """
    Extract batch numbers AS-IS - no filtering, check all possible locations
    """
    batch_numbers = []
    
    # Check ALL possible locations in email
    if email_analysis:
        # Direct batch_numbers field
        if email_analysis.get('batch_numbers'):
            batch_numbers = email_analysis['batch_numbers']
        # Nested extracted_details
        elif email_analysis.get('extracted_details', {}).get('batch_numbers'):
            batch_numbers = email_analysis['extracted_details']['batch_numbers']
        # Single batch_number field
        elif email_analysis.get('batch_number'):
            batch_numbers = [email_analysis['batch_number']]
        # In items
        elif email_analysis.get('items'):
            for item in email_analysis.get('items', []):
                if item.get('batch_number'):
                    batch_numbers.append(item['batch_number'])
    
    # Fallback to SO data
    if not batch_numbers:
        if so_data.get('batch_numbers'):
            batch_numbers = so_data['batch_numbers']
        elif so_data.get('batch_number'):
            batch_numbers = [so_data['batch_number']]
        # Check SO items
        elif so_data.get('items'):
            for item in so_data.get('items', []):
                if item.get('batch_number'):
                    batch_numbers.append(item['batch_number'])
    
    # Ensure it's a list and handle string-formatted batch numbers
    if isinstance(batch_numbers, str):
        # Handle various separators: comma, plus sign, or just spaces
        if ' + ' in batch_numbers:
            batch_numbers = [b.strip() for b in batch_numbers.split(' + ')]
        elif ',' in batch_numbers:
            batch_numbers = [b.strip() for b in batch_numbers.split(',')]
        else:
            # Single batch number
            batch_numbers = [batch_numbers.strip()]
    elif not isinstance(batch_numbers, list):
        batch_numbers = []
    
    # Remove empty strings and duplicates
    batch_numbers = list(dict.fromkeys([b for b in batch_numbers if b]))
    
    print(f"   DEBUG: Batch numbers extracted: {batch_numbers}")
    
    return batch_numbers


def extract_skid_info(email_analysis: Dict[str, Any]) -> tuple:                 
    """
    Extract pallet/skid dimensions from email
    Returns: (dimensions_string, total_skid_count)
    NEVER makes up dimensions - returns empty string if not found
    """
    if not email_analysis:
        print("   DEBUG: No email_analysis provided for skid info")
        return "", 0
    
    # FIRST: Check for pre-formatted skid_info from parsing (highest priority)
    if email_analysis.get('skid_info'):
        skid = email_analysis['skid_info']
        print(f"   DEBUG: Using skid_info from parsing: {skid}")
        # Try to extract count from string like "2 pallets (48x40x48)" or "1 box 27×22×20 inches"
        count = 1
        import re
        count_match = re.search(r'(\d+)\s*(?:pallet|skid|box|case)', skid, re.IGNORECASE)
        if count_match:
            count = int(count_match.group(1))
        print(f"   DEBUG: Extracted count from skid_info: {count}")
        return skid, count
    
    # Check multiple possible locations for pallet info
    pallet_info = None
    source = None
    
    # Try extracted_details first
    if email_analysis.get('extracted_details', {}).get('pallet_info'):
        pallet_info = email_analysis['extracted_details']['pallet_info']
        source = "extracted_details.pallet_info"
    # Try direct pallet_info
    elif email_analysis.get('pallet_info'):
        pallet_info = email_analysis['pallet_info']
        source = "pallet_info"
    # Try pallet_dimensions
    elif email_analysis.get('pallet_dimensions'):
        pallet_info = email_analysis['pallet_dimensions']
        source = "pallet_dimensions"
    # Try dimensions directly
    elif email_analysis.get('dimensions'):
        pallet_info = email_analysis['dimensions']
        source = "dimensions"
    
    if not pallet_info:
        # Try to build skid_info from pallet_dimensions and packaging_type if available
        pallet_dims = email_analysis.get('pallet_dimensions')
        packaging_type = email_analysis.get('packaging_type', 'pallet')
        pallet_count = email_analysis.get('pallet_count')
        
        if pallet_dims:
            # Use "box" for display if packaging_type is "case" (case = box in shipping)
            display_type = 'box' if packaging_type == 'case' else packaging_type
            
            if pallet_count and pallet_count > 0:
                if pallet_count == 1:
                    skid_info = f"1 {display_type} {pallet_dims}"
                else:
                    skid_info = f"{pallet_count} {display_type}s {pallet_dims} each"
            else:
                skid_info = f"{display_type} {pallet_dims}"
            
            print(f"   DEBUG: Built skid_info from pallet_dimensions and packaging_type: {skid_info}")
            return skid_info, pallet_count or 1
        
        print(f"   DEBUG: No pallet info found in email_analysis. Keys: {list(email_analysis.keys())}")
        print(f"   DEBUG: Checking for skid_info directly: {email_analysis.get('skid_info', 'NOT FOUND')}")
        print(f"   DEBUG: Checking for pallet_dimensions: {email_analysis.get('pallet_dimensions', 'NOT FOUND')}")
        print(f"   DEBUG: Checking for packaging_type: {email_analysis.get('packaging_type', 'NOT FOUND')}")
        print(f"   ⚠️ WARNING: No skid dimensions in email - leaving blank")
        return "", 0
    
    print(f"   DEBUG: Found pallet info from {source}: {pallet_info}")
    
    # If string format
    if isinstance(pallet_info, str):
        # Try to extract count from string - check for box/case first, then pallet/skid
        count = 1
        import re
        # Check for box/case first (not a skid or pallet)
        box_match = re.search(r'(\d+)\s*(?:box|case)', pallet_info, re.IGNORECASE)
        if box_match:
            count = int(box_match.group(1))
            # This is a box, not a skid/pallet - use the string as-is or format it
            return pallet_info.strip(), count
        
        # Check for pallet/skid
        count_match = re.search(r'(\d+)\s*(?:pallet|skid)', pallet_info, re.IGNORECASE)
        if count_match:
            count = int(count_match.group(1))
        return pallet_info.strip(), count
    
    # If dict format
    if isinstance(pallet_info, dict):
        dimensions = pallet_info.get('dimensions', '')
        count = pallet_info.get('count', 1)
        packaging_type = email_analysis.get('packaging_type', 'pallet')
        # Use "box" for display if packaging_type is "case" (case = box in shipping)
        display_type = 'box' if packaging_type == 'case' else 'pallet'
        
        if dimensions:
            if count > 1:
                return f"{count} {display_type}s ({dimensions})", count
            else:
                return f"{display_type} {dimensions}", count
        else:
            print(f"   DEBUG: Pallet info is dict but no dimensions. Keys: {list(pallet_info.keys())}")
            print(f"   ⚠️ WARNING: No skid dimensions in pallet info - leaving blank")
            return "", 0
    
    print(f"   ⚠️ WARNING: Unknown pallet_info format - leaving blank")
    return "", 0


def filter_actual_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Filter out charges/fees - only keep actual products
    """
    actual_items = []
    
    for item in items:
        item_code = item.get('item_code', '').upper()
        description = item.get('description', '').lower()
        
        # Identify charges by code
        is_charge_by_code = any([
            item_code in ['PALLET', 'FREIGHT', 'BROKERAGE', 'MISC', 'MISCELLANEOUS'],
            'CHARGE' in item_code,
            'FREIGHT' in item_code
        ])
        
        # Identify charges by description
        is_charge_by_desc = any([
            'charge' in description and 'pallet' in description,
            'freight' in description and 'prepaid' in description,
            'brokerage' in description,
            'miscellaneous' in description,
            'add shipment' in description,
            description.startswith('prepaid')
        ])
        
        # Only include actual products
        if not (is_charge_by_code or is_charge_by_desc):
            actual_items.append(item)
    
    return actual_items


def extract_consignee_address(so_data: Dict[str, Any], email_analysis: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract and format consignee address
    Priority: Email ship_to > SO shipping_address
    """
    consignee = {
        'name': '',
        'street': '',
        'city_state': '',
        'postal': ''
    }
    
    # Priority 1: SO shipping_address (most reliable)
    if so_data.get('shipping_address'):
        ship_addr = so_data['shipping_address']
        consignee['name'] = ship_addr.get('company', '')
        
        # Street address with proper spacing
        street_parts = []
        if ship_addr.get('street') or ship_addr.get('street_address') or ship_addr.get('address'):
            street = ship_addr.get('street') or ship_addr.get('street_address') or ship_addr.get('address')
            street_parts.append(street)
        if ship_addr.get('street2') or ship_addr.get('street_address2'):
            street2 = ship_addr.get('street2') or ship_addr.get('street_address2')
            street_parts.append(street2)
        
        # Join with space or newline
        consignee['street'] = ' '.join(street_parts) if street_parts else ''
        
        # City, State
        city_parts = []
        if ship_addr.get('city'):
            city_parts.append(ship_addr['city'])
        if ship_addr.get('province') or ship_addr.get('state'):
            city_parts.append(ship_addr.get('province') or ship_addr.get('state'))
        
        consignee['city_state'] = ', '.join(city_parts) if city_parts else ''
        
        # Postal code - check multiple field names
        postal = (ship_addr.get('postal_code') or 
                 ship_addr.get('postal') or 
                 ship_addr.get('zip') or 
                 ship_addr.get('zip_code') or '')
        consignee['postal'] = postal.strip() if postal else ''
    
    # Priority 2: Email ship_to (if SO address is incomplete)
    elif email_analysis and email_analysis.get('ship_to'):
        ship_to = email_analysis['ship_to']
        consignee['name'] = ship_to.get('company_name', '') or ship_to.get('contact_person', '')
        
        # Address from email might be combined
        if ship_to.get('address'):
            addr_str = ship_to['address']
            consignee['street'] = addr_str
    
    # Fallback to customer name
    if not consignee['name']:
        consignee['name'] = so_data.get('customer_name', '')
    
    return consignee


def determine_freight_terms(so_data: Dict[str, Any]) -> str:
    """
    Determine if Collect or Prepaid
    Returns: 'Collect' or 'Prepaid'
    """
    raw_text = so_data.get('raw_text', '').lower()
    
    if 'prepaid' in raw_text:
        return 'Prepaid'
    elif 'collect' in raw_text:
        return 'Collect'
    else:
        return 'Collect'  # Default


def generate_bol_rows(items: List[Dict[str, Any]], batch_numbers: List[str], 
                      skid_info: str, total_weight_kg: float, 
                      po_number: str, so_number: str, total_skids: int = 0,
                      email_analysis: Dict[str, Any] = None) -> List[Dict[str, str]]:
    """
    Generate the 8 rows for the BOL table
    Shows ALL items with their batch numbers and skid dimensions
    Handles TOTE orders: shows 1 piece + "(XXX L filled)" in description
    """
    rows = []
    
    # Extract liters info from email for tote orders
    email_liters_info = {}
    if email_analysis:
        email_text = str(email_analysis).lower()
        is_tote_shipment = 'tote' in email_text
        
        # Look for liters in email items
        for email_item in email_analysis.get('items', []):
            desc = (email_item.get('description') or '').upper()
            qty = email_item.get('quantity', '')
            if qty and desc:
                email_liters_info[desc] = qty
        
        # Also check for liters mentioned in the email body
        import re
        liters_match = re.search(r'(\d+[,.]?\d*)\s*liters?', email_text, re.IGNORECASE)
        if liters_match:
            email_liters_info['_default_liters'] = liters_match.group(1).replace(',', '')
    else:
        is_tote_shipment = False
    
    total_pieces = sum(int(item.get('quantity', 0)) for item in items)
    
    # Calculate individual item weights (proportional)
    for i, item in enumerate(items):
        item_qty = int(item.get('quantity', 0))
        
        # Check if this is a TOTE order (unit LITER/TOTE/IBC with qty 1)
        unit = (item.get('unit') or '').upper()
        is_tote_item = (unit in ['LITER', 'LITRE', 'TOTE', 'IBC'] and item_qty == 1) or is_tote_shipment
        
        if total_pieces > 0 and total_weight_kg > 0:
            item_weight_kg = (item_qty / total_pieces) * total_weight_kg
        else:
            item_weight_kg = 0.0
        
        # Product description (MUST come before using it in debug print)
        product = item.get('description', '')
        
        # For TOTE orders, add liters filled to description
        if is_tote_item:
            # Find liters from email matching this product
            product_upper = product.upper()
            liters_filled = None
            
            # Try to match with email items
            for email_desc, email_qty in email_liters_info.items():
                if email_desc != '_default_liters' and (email_desc in product_upper or product_upper in email_desc):
                    liters_filled = email_qty
                    break
            
            # Fallback to default liters from email body
            if not liters_filled and '_default_liters' in email_liters_info:
                liters_filled = email_liters_info['_default_liters']
            
            if liters_filled:
                product = f"{product} ({liters_filled}L filled)"
                print(f"   📦 TOTE ORDER: Added liters to description: {product}")
        
        # Get batch number from item (preserves full string with quantities)
        batch = item.get('batch_number', '')
        
        # DEBUG: Show batch extraction for each item
        print(f"   DEBUG ROW: Item {i+1}/{len(items)}: {product}")
        print(f"             Item has batch_number field: {'batch_number' in item}")
        print(f"             Batch value: '{batch}'")
        
        # Format unit description
        unit = item.get('unit', 'EA')
        unit_desc = format_unit_description(unit)
        
        # Check if dangerous goods
        dg_info = detect_dangerous_goods_item(item)
        
        # SMART ROW BUILDING:
        # Row 1: Item | Batch(es) (batches on first row)
        row_parts = [f"{unit_desc} {product}"]
        
        # Handle batch numbers smartly
        if batch:
            # Check if multiple batches (contains '+')
            if '+' in batch:
                # Split multiple batches: "NT5D14T016 (5) + NT5E19T018 (3)"
                batches = [b.strip() for b in batch.split('+')]
                # Add each batch separately with | separator
                for b in batches:
                    row_parts.append(f"Batch: {b}")
            else:
                # Single batch
                row_parts.append(f"Batch: {batch}")
        
        # Row 1: Main line (item + batches)
        rows.append({
            'pieces': str(item_qty),
            'description': ' | '.join(row_parts),
            'weight': f"{item_weight_kg:.1f} kg" if item_weight_kg > 0 else ""
        })
        
        # Row 2: DANGEROUS GOODS (if applicable) - ALWAYS row 2, highest priority
        if dg_info:
            dg_line = f"Dangerous Goods: {dg_info['un']}, Class {dg_info['class']}, PG {dg_info['pg']}"
            rows.append({
                'pieces': '',
                'description': dg_line,
                'weight': ''
            })
        
        # NO empty row between items - pack tightly
    
    # After all items are added, add pallet/skid/case information ONCE
    # This ensures it's always included even with 3+ items
    # Always add skid info if we have either skid_info string or total_skids count
    if skid_info and skid_info.strip():
        # skid_info already contains the correct label (case, skid, pallet) from email parsing
        # Just use it directly - don't add "Skid:" prefix
        rows.append({
            'pieces': '',
            'description': skid_info,
            'weight': ''
        })
        print(f"   ✅ Added packaging info to BOL: {skid_info}")
    elif total_skids > 0:
        # No skid info string, but we have total skids count - use that
        skid_text = f"{total_skids} Total Skid{'s' if total_skids > 1 else ''}"
        rows.append({
            'pieces': '',
            'description': skid_text,
            'weight': ''
        })
        print(f"   ✅ Added total skids to BOL: {skid_text}")
    else:
        print(f"   ⚠️  No skid info available (skid_info='{skid_info}', total_skids={total_skids})")
    
    # Add PO# and SO# on next available row
    ref_parts = []
    ref_parts.append(f"PO# {po_number if po_number else 'N/A'}")
    ref_parts.append(f"SO# {so_number if so_number else 'N/A'}")
    
    rows.append({
        'pieces': '',
        'description': ' | '.join(ref_parts),
        'weight': ''
    })
    
    # Add Total Skids on next available row (if we have both skid_info and total_skids, and total not already shown)
    if total_skids > 0 and skid_info and skid_info.strip():
        # Check if skid_info already contains the total count
        if str(total_skids) not in skid_info:
            skid_text = f"{total_skids} Total Skid{'s' if total_skids > 1 else ''}"
            rows.append({'pieces': '', 'description': skid_text, 'weight': ''})
            print(f"   ✅ Added total skids (additional) to BOL: {skid_text}")
    
    return rows


def populate_new_bol_html(so_data: Dict[str, Any], email_analysis: Dict[str, Any] = None) -> str:
    """
    Main function: Generate professional BOL using new template
    """
    print("\n" + "="*80)
    print("GENERATING NEW BOL (Professional Format)")
    print("="*80)
    
    # Load template
    if not os.path.exists(NEW_BOL_TEMPLATE):
        raise FileNotFoundError(f"New BOL template not found: {NEW_BOL_TEMPLATE}")
    
    with open(NEW_BOL_TEMPLATE, 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    soup = BeautifulSoup(template_content, 'html.parser')
    
    # Extract data
    print("\n>> Extracting data...")
    
    # Items
    all_items = so_data.get('items', [])
    items = filter_actual_items(all_items)
    print(f"   Items: {len(items)} products (filtered from {len(all_items)} total)")
    
    # Calculations
    total_pieces = sum(int(item.get('quantity', 0)) for item in items)
    total_weight_kg = extract_weight_in_kg(email_analysis, so_data, items)
    batch_numbers = extract_batch_numbers(email_analysis, so_data)
    skid_info, total_skids = extract_skid_info(email_analysis)  # Now returns tuple
    
    print(f"   Total pieces: {total_pieces}")
    print(f"   Total weight: {total_weight_kg:.1f} kg")
    print(f"   Batch numbers: {batch_numbers} (count: {len(batch_numbers)})")
    print(f"   Skid info: {skid_info}")
    print(f"   Total skids: {total_skids}")
    
    # DEBUG: Check for dangerous goods
    dg_items = [item for item in items if detect_dangerous_goods_item(item)]
    if dg_items:
        print(f"   ⚠️  DANGEROUS GOODS DETECTED: {len(dg_items)} item(s)")
        for dg_item in dg_items:
            print(f"      - {dg_item.get('item_code', '')}: {dg_item.get('description', '')}")
    else:
        print(f"   ✅ No dangerous goods detected")
    
    # Reference numbers - MUST ALWAYS HAVE THESE (ensure strings, not None)
    # Try multiple locations for PO number
    po_number = str(
        so_data.get('po_number', '') or 
        so_data.get('order_details', {}).get('po_number', '') or
        (email_analysis.get('po_number', '') if email_analysis else '') or
        ''
    )
    
    # Try multiple locations for SO number
    so_number = str(
        so_data.get('so_number', '') or
        so_data.get('order_details', {}).get('so_number', '') or
        (email_analysis.get('so_number', '') if email_analysis else '') or
        ''
    )
    
    print(f"\n📋 REFERENCE NUMBERS (REQUIRED):")
    print(f"   PO Number: '{po_number}' (from: {'SO data' if so_data.get('po_number') else 'email' if email_analysis and email_analysis.get('po_number') else 'MISSING'})")
    print(f"   SO Number: '{so_number}' (from: {'SO data' if so_data.get('so_number') else 'email' if email_analysis and email_analysis.get('so_number') else 'MISSING'})")
    
    # Consignee
    consignee = extract_consignee_address(so_data, email_analysis)
    print(f"   Consignee: {consignee['name']}")
    print(f"   Street: {consignee['street']}")
    print(f"   City/State: {consignee['city_state']}")
    print(f"   Postal: {consignee['postal']}")
    
    # Freight terms
    freight_terms = determine_freight_terms(so_data)
    print(f"   Freight: {freight_terms}")
    
    # Brokerage info - Format: "Brokerage: [name] | Account #: [number]"
    # ONLY use if BOTH name AND account are present (all or nothing)
    brokerage = so_data.get('brokerage', {})
    carrier_value = ""
    broker_name = brokerage.get('broker_name', '').strip() if brokerage else ''
    account_num = brokerage.get('account_number', '').strip() if brokerage else ''
    
    # Only fill if we have BOTH broker name AND account number
    if broker_name and account_num:
        carrier_value = f"Brokerage: {broker_name} | Account #: {account_num}"
        print(f"   Brokerage: {carrier_value}")
    else:
        if broker_name and not account_num:
            print(f"   Brokerage: Incomplete (name only) - leaving blank")
        elif account_num and not broker_name:
            print(f"   Brokerage: Incomplete (account only) - leaving blank")
        else:
            print(f"   Brokerage: None")
    
    # Date - ALWAYS use current date for shipper section
    shipment_date = datetime.now().strftime('%Y-%m-%d')
    print(f"   Shipment Date: {shipment_date}")
    
    print("\n>> Populating template...")
    
    # Populate shipper dates (both in shipper section)
    # The shipper table has 2 date-related fields we should fill
    # Leave driver date and consignee date empty for manual entry
    date_count = 0
    all_tables = soup.find_all('table', class_='shipper-table')
    if all_tables:
        shipper_table = all_tables[0]
        # Find ALL Date: labels in shipper table and fill them
        for strong in shipper_table.find_all('strong'):
            text = strong.get_text().strip()
            if text == 'Date:' or 'Date' in text:
                next_input = strong.find_next('input', {'type': 'text'})
                if next_input:
                    # Check if this input is in the shipper table (not signatures)
                    parent_table = next_input.find_parent('table', class_='shipper-table')
                    if parent_table:
                        next_input['value'] = shipment_date
                        date_count += 1
                        print(f"   Set shipper date #{date_count}: {shipment_date}")
    
    # Fallback if table class not found
    if date_count == 0:
        # Fill first 2 date inputs (shipper section dates)
        all_inputs = soup.find_all('input', {'type': 'text'})
        if len(all_inputs) >= 2:
            all_inputs[1]['value'] = shipment_date
            print(f"   Set shipper date (fallback): {shipment_date}")
    
    # Populate carrier field with brokerage info
    carrier_div = soup.find('div', class_='carrier-row')
    if carrier_div and carrier_value:
        carrier_input = carrier_div.find('input', {'type': 'text'})
        if carrier_input:
            carrier_input['value'] = carrier_value
            print(f"   Set carrier (brokerage): {carrier_value}")
    
    # Populate consignee fields - more reliable approach
    all_strongs = soup.find_all('strong')
    consignee_section_started = False
    
    for strong in all_strongs:
        text = strong.get_text().strip()
        
        # Detect when we enter consignee section
        if 'Consignee:' in text:
            consignee_section_started = True
            next_input = strong.find_next('input', {'type': 'text'})
            if next_input and consignee['name']:
                next_input['value'] = consignee['name']
                print(f"   Set consignee name: {consignee['name']}")
        
        # Street field (comes after Consignee section starts)
        elif consignee_section_started and text == 'Street:':
            next_input = strong.find_next('input', {'type': 'text'})
            if next_input and consignee['street']:
                next_input['value'] = consignee['street']
                print(f"   Set street: {consignee['street']}")
        
        # City/State field
        elif consignee_section_started and 'City: Prov./State' in text:
            next_input = strong.find_next('input', {'type': 'text'})
            if next_input and consignee['city_state']:
                next_input['value'] = consignee['city_state']
                print(f"   Set city/state: {consignee['city_state']}")
        
        # Postal code - comes right after City/State
        elif consignee_section_started and 'Postal/Zip Code:' in text:
            next_input = strong.find_next('input', {'type': 'text'})
            if next_input and consignee['postal']:
                next_input['value'] = consignee['postal']
                print(f"   Set postal: {consignee['postal']}")
            # Exit consignee section after postal
            consignee_section_started = False
    
    # Set U.S./Canadian funds checkbox based on SO total amount
    # Template has checkboxes with labels "Cdn" and "U.S" (no IDs)
    raw_text = so_data.get('raw_text', '')
    is_us_order = bool(raw_text and re.search(r'US\s*\$', raw_text, re.IGNORECASE))
    
    # Find all checkboxes and their labels
    for label in soup.find_all('label'):
        label_text = label.get_text().strip()
        checkbox = label.find('input', {'type': 'checkbox'})
        
        if checkbox and label_text in ['U.S', 'Cdn', 'Canadian']:
            # Check U.S. if US order
            if is_us_order and label_text == 'U.S':
                checkbox['checked'] = 'checked'
                print(f"   Set funds: U.S. ✓ (detected 'US$' in SO total)")
            # Check Cdn if Canadian order
            elif not is_us_order and label_text in ['Cdn', 'Canadian']:
                checkbox['checked'] = 'checked'
                print(f"   Set funds: Cdn ✓ (no 'US$' in SO total)")
    
    # Set freight checkboxes
    freight_checkboxes = soup.find_all('input', {'type': 'checkbox'})
    for cb in freight_checkboxes:
        label_text = ''
        if cb.parent:
            label_text = cb.parent.get_text()
        
        if 'Collect' in label_text and 'C.O.D' not in label_text:
            if freight_terms == 'Collect':
                cb['checked'] = 'checked'
            else:
                if cb.has_attr('checked'):
                    del cb['checked']
        elif 'Prepaid' in label_text and 'C.O.D' not in label_text:
            if freight_terms == 'Prepaid':
                cb['checked'] = 'checked'
            else:
                if cb.has_attr('checked'):
                    del cb['checked']
    
    # Check "kg" checkbox for weight unit (not lb)
    weight_checkboxes = soup.find_all('input', {'type': 'checkbox', 'class': 'cb-mini'})
    for cb in weight_checkboxes:
        if cb.get('id') == 'w_kg':
            cb['checked'] = 'checked'
        elif cb.get('id') == 'w_lb':
            if cb.has_attr('checked'):
                del cb['checked']
    
    # Generate row data (pass email_analysis for tote order handling)
    rows = generate_bol_rows(items, batch_numbers, skid_info, total_weight_kg, po_number, so_number, total_skids, email_analysis)
    
    # Populate table rows
    tbody = soup.find('tbody')
    if tbody:
        table_rows = tbody.find_all('tr', recursive=False)
        
        # Fill first 8 rows with data
        for i, row_data in enumerate(rows):
            if i < len(table_rows) - 1:  # Skip total row
                row = table_rows[i]
                cells = row.find_all('td', recursive=False)
                
                if len(cells) >= 3:
                    # Pieces column
                    pieces_input = cells[0].find('input')
                    if pieces_input and row_data['pieces']:
                        pieces_input['value'] = row_data['pieces']
                    
                    # Description column - ALWAYS clear placeholder and set value
                    desc_input = cells[1].find('input') or cells[1].find('textarea')
                    if desc_input:
                        # Set value (even if empty - this clears placeholder)
                        if desc_input.name == 'textarea':
                            desc_input.string = row_data['description']
                        else:
                            desc_input['value'] = row_data['description']
                        
                        # ALWAYS remove placeholder (clears grey example text)
                        if desc_input.has_attr('placeholder'):
                            del desc_input['placeholder']
                    
                    # Weight column
                    weight_input = cells[2].find('input')
                    if weight_input and row_data['weight']:
                        weight_input['value'] = row_data['weight']
        
        # Fill total row
        if len(table_rows) >= 9:
            total_row = table_rows[8]  # 9th row is total
            cells = total_row.find_all('td', recursive=False)
            
            if len(cells) >= 3:
                # Total pieces
                pieces_input = cells[0].find('input')
                if pieces_input:
                    pieces_input['value'] = str(total_pieces)
                
                # Total weight
                weight_input = cells[2].find('input')
                if weight_input:
                    weight_input['value'] = f"{total_weight_kg:.1f} kg"
    
    # CRITICAL: Remove ALL remaining placeholders from entire document
    # Placeholders show as grey text and are visible when printing - must be removed!
    print("\n>> Removing all placeholder text from document...")
    placeholder_count = 0
    for input_field in soup.find_all(['input', 'textarea']):
        if input_field.has_attr('placeholder'):
            del input_field['placeholder']
            placeholder_count += 1
    print(f"   Removed {placeholder_count} placeholder attributes")
    
    print("SUCCESS: Template populated successfully")
    print("="*80 + "\n")
    
    return str(soup)


def save_new_bol(html_content: str, so_number: str) -> tuple:
    """
    Save BOL HTML to file
    Returns: (filepath, filename)
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"BOL_New_SO{so_number}_{timestamp}.html"
    # Use absolute path to avoid nested directory issues
    from logistics_automation import get_uploads_dir
    uploads_dir = get_uploads_dir()
    filepath = os.path.join(uploads_dir, filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    return filepath, filename


