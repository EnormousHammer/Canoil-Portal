"""
Commercial Invoice HTML Generator - Field Population
Uses the actual Commercial Invoice HTML template
"""

import os
import re
from datetime import datetime
from typing import Dict, Any, List, Tuple
from bs4 import BeautifulSoup

# Use relative path for Docker compatibility
_current_dir = os.path.dirname(os.path.abspath(__file__))
COMMERCIAL_INVOICE_TEMPLATE = os.path.join(_current_dir, 'templates', 'commercial_invoice', 'Commerical Invoice New.html')

# ============================================================================
# STEEL CONTAINER SEPARATION FOR CUSTOMS (HTS 7310.10)
# ============================================================================
# Steel containers must be declared separately for cross-border shipments
# This separates the steel cost from product cost for proper customs declaration

STEEL_HTS_CODE = '7310.10'

# Steel container prices (USD)
STEEL_PRICES = {
    'drum': 66.98,      # Steel Drum (200L)
    'pail': 26.00,      # Steel Pail (6 gal/22L)
    'can': 5.38,        # Steel Can (1L)
}

# Products that use steel containers
STEEL_CONTAINER_PRODUCTS = ['MOV', 'VSG', 'REOLUBE', 'AEC', 'CANOIL']


def is_european_shipment(so_data: Dict[str, Any]) -> bool:
    """
    Check if the order is for a European destination (e.g., Axel France).
    European shipments require only 6-digit HTS codes.
    """
    customer_name = so_data.get('customer_name', '').upper()
    
    # Check ship_to address
    ship_to = so_data.get('ship_to', {}) or so_data.get('shipping_address', {})
    if isinstance(ship_to, dict):
        ship_country = str(ship_to.get('country', '')).upper()
        ship_company = str(ship_to.get('company_name', '') or ship_to.get('company', '')).upper()
    else:
        ship_country = ''
        ship_company = ''
    
    # European countries
    european_countries = ['FRANCE', 'GERMANY', 'SPAIN', 'ITALY', 'UK', 'UNITED KINGDOM', 
                          'NETHERLANDS', 'BELGIUM', 'POLAND', 'SWEDEN', 'AUSTRIA',
                          'SWITZERLAND', 'PORTUGAL', 'IRELAND', 'DENMARK', 'FINLAND']
    
    # Check for Axel France specifically
    is_axel = 'AXEL' in customer_name or 'AXEL' in ship_company
    
    # Check if ship-to country is in Europe
    is_europe_country = any(ec in ship_country for ec in european_countries)
    
    result = is_axel or is_europe_country
    print(f"🌍 European Shipment Detection: customer={customer_name}, ship_country={ship_country}, is_european={result}")
    
    return result


def truncate_hts_to_6_digits(hts_code: str) -> str:
    """
    Truncate HTS code to first 6 digits (format: XXXX.XX).
    European shipments only require the first 6 digits.
    
    Examples:
        '3819.00.0090' -> '3819.00'
        '7310.10.0000' -> '7310.10'
        '2710.19.9100' -> '2710.19'
    """
    if not hts_code:
        return ''
    
    # Remove any non-numeric/dot characters and split
    clean_code = str(hts_code).strip()
    parts = clean_code.split('.')
    
    if len(parts) >= 2:
        # Return first 4 digits + "." + next 2 digits
        return f"{parts[0]}.{parts[1][:2]}"
    elif len(parts) == 1 and len(parts[0]) >= 6:
        # No dots, just numbers - format as XXXX.XX
        return f"{parts[0][:4]}.{parts[0][4:6]}"
    
    return clean_code  # Return as-is if we can't parse


def detect_steel_container_type(description: str, unit: str) -> Tuple[str, int]:
    """
    Detect if product uses steel container and return type and quantity multiplier.
    
    Returns: (container_type, qty_multiplier) or (None, 0)
    - container_type: 'drum', 'pail', 'can', or None
    - qty_multiplier: number of containers per unit (e.g., 12 cans per case)
    """
    desc_lower = description.lower()
    unit_lower = (unit or '').lower()
    
    # Check for drums
    if 'drum' in desc_lower or 'drum' in unit_lower:
        return ('drum', 1)
    
    # Check for pails
    if 'pail' in desc_lower or 'pail' in unit_lower:
        return ('pail', 1)
    
    # Check for cans - handle cases of cans
    if 'can' in desc_lower or 'can' in unit_lower:
        # Check if it's a case containing multiple cans
        # Look for patterns like "12x1L", "12 per case", "case of 12"
        case_match = re.search(r'(\d+)\s*(?:x|per|cans?\s*per)', desc_lower)
        if case_match:
            return ('can', int(case_match.group(1)))
        # Default 1 can per unit
        return ('can', 1)
    
    # Check for cases that might contain cans
    if 'case' in unit_lower:
        # Cases of 1L products typically have 12 cans
        if '1l' in desc_lower or '1 l' in desc_lower:
            return ('can', 12)
    
    return (None, 0)


def needs_steel_separation(description: str) -> bool:
    """
    Check if product is one that uses steel containers (MOV, VSG, Reolube, AEC, etc.)
    These products have steel container cost included in unit price that needs to be separated.
    """
    desc_upper = description.upper()
    return any(prod in desc_upper for prod in STEEL_CONTAINER_PRODUCTS)


def process_items_with_steel_separation(items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Process items to separate steel container costs from product costs.
    
    For products in steel containers:
    - Subtract steel cost from unit price
    - Track steel containers for separate line items
    
    Returns: (adjusted_items, steel_items)
    - adjusted_items: Original items with adjusted prices
    - steel_items: New line items for steel containers
    """
    adjusted_items = []
    steel_totals = {
        'drum': {'count': 0, 'price': STEEL_PRICES['drum']},
        'pail': {'count': 0, 'price': STEEL_PRICES['pail']},
        'can': {'count': 0, 'price': STEEL_PRICES['can']},
    }
    
    for item in items:
        description = str(item.get('description', ''))
        unit = str(item.get('unit', ''))
        quantity = float(item.get('quantity', 0))
        unit_price = float(item.get('unit_price', 0))
        
        # Check if this product uses steel containers
        if needs_steel_separation(description):
            container_type, qty_multiplier = detect_steel_container_type(description, unit)
            
            if container_type and qty_multiplier > 0:
                steel_price = STEEL_PRICES[container_type]
                
                # Calculate adjusted unit price (subtract steel cost per container)
                # If multiple containers per unit (e.g., case of 12 cans), multiply
                steel_cost_per_unit = steel_price * qty_multiplier
                adjusted_unit_price = unit_price - steel_cost_per_unit
                
                # Track total steel containers
                total_containers = int(quantity * qty_multiplier)
                steel_totals[container_type]['count'] += total_containers
                
                print(f"DEBUG STEEL: {description}")
                print(f"  - Original unit price: ${unit_price:.2f}")
                print(f"  - Steel type: {container_type}, multiplier: {qty_multiplier}")
                print(f"  - Steel cost per unit: ${steel_cost_per_unit:.2f}")
                print(f"  - Adjusted unit price: ${adjusted_unit_price:.2f}")
                print(f"  - Total containers: {total_containers}")
                
                # Create adjusted item (copy to avoid modifying original)
                adjusted_item = item.copy()
                adjusted_item['unit_price'] = adjusted_unit_price
                adjusted_item['original_unit_price'] = unit_price  # Keep original for reference
                adjusted_item['steel_separated'] = True
                adjusted_items.append(adjusted_item)
            else:
                # No steel container detected, keep original
                adjusted_items.append(item.copy())
        else:
            # Not a steel container product, keep original
            adjusted_items.append(item.copy())
    
    # Create steel line items for containers that were found
    steel_items = []
    
    if steel_totals['drum']['count'] > 0:
        steel_items.append({
            'description': 'Steel Drum (200L)',
            'hts_code': STEEL_HTS_CODE,
            'quantity': steel_totals['drum']['count'],
            'unit': 'Drum',
            'unit_price': STEEL_PRICES['drum'],
            'country_of_origin': 'Canada',
            'is_steel_container': True,
        })
        print(f"DEBUG STEEL: Added {steel_totals['drum']['count']} drums @ ${STEEL_PRICES['drum']:.2f}")
    
    if steel_totals['pail']['count'] > 0:
        steel_items.append({
            'description': 'Steel pails (6 gal/22 L)',
            'hts_code': STEEL_HTS_CODE,
            'quantity': steel_totals['pail']['count'],
            'unit': 'Pail',
            'unit_price': STEEL_PRICES['pail'],
            'country_of_origin': 'Canada',
            'is_steel_container': True,
        })
        print(f"DEBUG STEEL: Added {steel_totals['pail']['count']} pails @ ${STEEL_PRICES['pail']:.2f}")
    
    if steel_totals['can']['count'] > 0:
        steel_items.append({
            'description': 'Steel cans (1L)',
            'hts_code': STEEL_HTS_CODE,
            'quantity': steel_totals['can']['count'],
            'unit': 'Can',
            'unit_price': STEEL_PRICES['can'],
            'country_of_origin': 'Canada',
            'is_steel_container': True,
        })
        print(f"DEBUG STEEL: Added {steel_totals['can']['count']} cans @ ${STEEL_PRICES['can']:.2f}")
    
    return adjusted_items, steel_items

def normalize_date_format(date_str: str) -> str:
    """
    Convert various date formats to YYYY-MM-DD for HTML date inputs
    Handles: MM/DD/YY, MM/DD/YYYY, M/D/YY, YYYY-MM-DD
    Returns empty string if can't parse or if date is invalid
    """
    if not date_str:
        return ''
    
    date_str = str(date_str).strip()
    
    # Already in correct format YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    
    # Try MM/DD/YY or MM/DD/YYYY format
    date_match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', date_str)
    if date_match:
        month, day, year = date_match.groups()
        # Convert 2-digit year to 4-digit (assume 20xx for years < 50, 19xx for >= 50)
        if len(year) == 2:
            year = '20' + year if int(year) < 50 else '19' + year
        # Format as YYYY-MM-DD with zero-padding
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # Try YYYY/MM/DD format
    date_match = re.match(r'(\d{4})/(\d{1,2})/(\d{1,2})', date_str)
    if date_match:
        year, month, day = date_match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # If can't parse, return empty string (will use today's date as fallback)
    print(f"WARNING: Could not parse date format: {date_str}")
    return ''

def extract_weight_from_email(email_analysis: Dict[str, Any]) -> str:
    """Extract weight from email analysis data, similar to BOL logic"""
    if not email_analysis:
        return ''
    
    # Try email analysis - check multiple possible locations
    email_weight = None
    if email_analysis.get('extracted_details', {}).get('total_weight'):
        email_weight = email_analysis['extracted_details']['total_weight']
    elif email_analysis.get('total_weight'):
        email_weight = email_analysis['total_weight']
    elif email_analysis.get('weight'):
        email_weight = email_analysis['weight']
    
    if email_weight:
        weight_str = str(email_weight)
        # Extract number from any position in the string
        weight_match = re.search(r'(\d+(?:\.\d+)?)', weight_str)
        if weight_match:
            try:
                weight_value = float(weight_match.group(1))
                if 'kg' in weight_str.lower():
                    # Keep in kg for Commercial Invoice
                    return f"{weight_value:.1f} kg"
                elif 'lb' in weight_str.lower():
                    # Convert lbs to kg for Commercial Invoice
                    kg_value = weight_value / 2.20462
                    return f"{kg_value:.1f} kg"
                else:
                    # Assume kg for Commercial Invoice
                    return f"{weight_value:.1f} kg"
            except Exception as e:
                print(f"Error parsing weight from email: {e}")
                return ''
    
    return ''

def format_address(address_dict: Dict[str, Any]) -> str:
    """Format address dictionary into properly organized multi-line string"""
    if not address_dict:
        return ''
    
    lines = []
    
    # Line 1-N: Street address (support multiple field names from different parsers)
    # Handle multi-line addresses from OpenAI (e.g., "1600 Drew Road\nDept CW")
    street = address_dict.get('address') or address_dict.get('street1') or address_dict.get('street_address', '')
    if street:
        # Split on newlines in case OpenAI embedded multiple address lines
        street_lines = street.strip().split('\n')
        for line in street_lines:
            if line.strip():
                lines.append(line.strip())
    
    # Additional street info if available (from separate field)
    if address_dict.get('street2'):
        lines.append(address_dict['street2'].strip())
    
    # Line 3: City, State/Province Postal Code (properly formatted)
    city_line_parts = []
    if address_dict.get('city'):
        city_line_parts.append(address_dict['city'].strip())
    
    # Add state/province
    state_prov = address_dict.get('state') or address_dict.get('province', '')
    if state_prov:
        city_line_parts.append(state_prov.strip())
    
    # Add postal/zip code
    postal = address_dict.get('postal_code') or address_dict.get('zip', '')
    if postal:
        city_line_parts.append(postal.strip())
    
    if city_line_parts:
        lines.append(', '.join(city_line_parts))
    
    # Line 4: Country (separate line)
    if address_dict.get('country'):
        lines.append(address_dict['country'].strip())
    
    # Clean up empty lines and return
    clean_lines = [line for line in lines if line.strip()]
    return '\n'.join(clean_lines)

def normalize_address_for_comparison(address: str) -> str:
    """Normalize address string for comparison by handling abbreviations, punctuation, etc."""
    if not address:
        return ''
    
    # Convert to lowercase
    normalized = address.lower().strip()
    
    # Street type abbreviations
    street_abbrevs = {
        'road': 'rd', 'street': 'st', 'avenue': 'ave', 'ave': 'ave',
        'drive': 'dr', 'lane': 'ln', 'boulevard': 'blvd', 'court': 'ct',
        'place': 'pl', 'parkway': 'pkwy', 'highway': 'hwy', 'crescent': 'cres',
        'circle': 'cir', 'way': 'wy', 'trail': 'trl', 'terrace': 'ter'
    }
    
    for full, abbrev in street_abbrevs.items():
        normalized = normalized.replace(f' {full}', f' {abbrev}')
        normalized = normalized.replace(f'.{full}', f'.{abbrev}')
    
    # Building/Unit abbreviations
    unit_abbrevs = {
        'apartment': 'apt', 'suite': 'ste', 'unit': 'u', 'room': 'rm',
        'department': 'dept', 'building': 'bldg', 'floor': 'fl'
    }
    
    for full, abbrev in unit_abbrevs.items():
        normalized = normalized.replace(f' {full}', f' {abbrev}')
        normalized = normalized.replace(f'.{full}', f'.{abbrev}')
    
    # Directional abbreviations
    direction_abbrevs = {
        'north': 'n', 'south': 's', 'east': 'e', 'west': 'w',
        'northeast': 'ne', 'northwest': 'nw', 'southeast': 'se', 'southwest': 'sw'
    }
    
    for full, abbrev in direction_abbrevs.items():
        normalized = normalized.replace(f' {full}', f' {abbrev}')
        normalized = normalized.replace(f'.{full}', f'.{abbrev}')
    
    # Province/State abbreviations
    province_abbrevs = {
        'ontario': 'on', 'quebec': 'qc', 'alberta': 'ab', 'british columbia': 'bc',
        'manitoba': 'mb', 'saskatchewan': 'sk', 'nova scotia': 'ns',
        'new brunswick': 'nb', 'newfoundland': 'nl', 'prince edward island': 'pe',
        'texas': 'tx', 'california': 'ca', 'new york': 'ny', 'florida': 'fl'
    }
    
    for full, abbrev in province_abbrevs.items():
        normalized = normalized.replace(f' {full}', f' {abbrev}')
        normalized = normalized.replace(f'.{full}', f'.{abbrev}')
    
    # PO Box normalization
    po_box_patterns = ['p.o. box', 'p.o.box', 'pobox', 'p o box', 'po box']
    for pattern in po_box_patterns:
        normalized = normalized.replace(pattern, 'po box')
    
    # Remove punctuation that doesn't affect meaning
    import re
    normalized = re.sub(r'[.,:;()\[\]{}#/\\-]', ' ', normalized)
    
    # Normalize whitespace
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    # Remove attention names and contact details using regex patterns
    attention_patterns = [
        r'attention\s*:?\s*[a-zA-Z\s]+',  # "Attention: Mark Henry"
        r'attn\s*:?\s*[a-zA-Z\s]+',       # "Attn: John Smith"
        r'c/o\s*:?\s*[a-zA-Z\s]+',        # "c/o Jane Doe"
        r'mr\.?\s+[a-zA-Z\s]+',           # "Mr. Smith"
        r'mrs\.?\s+[a-zA-Z\s]+',          # "Mrs. Johnson"
        r'ms\.?\s+[a-zA-Z\s]+',           # "Ms. Brown"
        r'dr\.?\s+[a-zA-Z\s]+',           # "Dr. Wilson"
        r'prof\.?\s+[a-zA-Z\s]+',         # "Prof. Davis"
    ]
    
    for pattern in attention_patterns:
        normalized = re.sub(pattern, '', normalized, flags=re.IGNORECASE)
    
    # Remove common noise words
    noise_words = [
        'canada', 'usa', 'united states', 'contact', 'person', 
        'manager', 'director', 'supervisor', 'department'
    ]
    
    for word in noise_words:
        # Remove with various patterns
        patterns = [
            f' {word} ',
            f' {word}',
            f'{word} ',
        ]
        for pattern in patterns:
            normalized = normalized.replace(pattern, ' ')
    
    # Clean up any double spaces created by removals
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized

def format_buyer_if_different(shipping_addr: Dict[str, Any], billing_addr: Dict[str, Any]) -> str:
    """
    Return buyer info if different from consignee, empty if same
    
    CRITICAL BUSINESS RULE:
    - If buyer address = shipping address → Return EMPTY string (no buyer field)
    - If buyer address ≠ shipping address → Return formatted buyer info
    
    This prevents duplicate address information in forms when they're the same location.
    """
    
    # DEBUG: Print actual field names to see what we're working with
    print(f"\n=== DEBUG format_buyer_if_different ===")
    print(f"shipping_addr keys: {list(shipping_addr.keys()) if shipping_addr else 'None'}")
    print(f"billing_addr keys: {list(billing_addr.keys()) if billing_addr else 'None'}")
    if shipping_addr:
        print(f"shipping_addr full data: {shipping_addr}")
    if billing_addr:
        print(f"billing_addr full data: {billing_addr}")
    
    if not billing_addr:
        return ''
    
    # Check if billing is different from shipping - compare FULL ADDRESS, not just company
    # Same company can have different Ship To and Sold To locations (e.g. Calgary HQ vs Winnipeg warehouse)
    
    # Compare key address fields - USE ACTUAL SO FIELD NAMES from raw_so_extractor.py
    # SO uses: street_address, city, province, postal_code, company_name
    shipping_street = (shipping_addr.get('street_address', '') or 
                       shipping_addr.get('street', '') or 
                       shipping_addr.get('address', '')).strip()
    billing_street = (billing_addr.get('street_address', '') or 
                     billing_addr.get('street', '') or 
                     billing_addr.get('address', '')).strip()
    
    shipping_city = shipping_addr.get('city', '').strip()
    billing_city = billing_addr.get('city', '').strip()
    
    shipping_postal = shipping_addr.get('postal_code', '').strip()
    billing_postal = billing_addr.get('postal_code', '').strip()
    
    # CRITICAL: Only compare actual address components, ignore attention names, contact persons, etc.
    # Extract just the core address parts for comparison
    shipping_core = f"{shipping_street} {shipping_city} {shipping_postal}".strip()
    billing_core = f"{billing_street} {billing_city} {billing_postal}".strip()
    
    # Normalize addresses for comparison (this removes attention names, contact persons, etc.)
    shipping_normalized = normalize_address_for_comparison(shipping_core)
    billing_normalized = normalize_address_for_comparison(billing_core)
    
    print(f"🔍 ADDRESS COMPARISON:")
    print(f"   Shipping normalized: '{shipping_normalized}'")
    print(f"   Billing normalized:  '{billing_normalized}'")
    print(f"   Are they different?  {shipping_normalized != billing_normalized}")
    
    # CRITICAL: If addresses are the same after normalization, NEVER show buyer
    if shipping_normalized == billing_normalized:
        print("✅ Addresses are the same - NOT filling buyer field")
        print("🚫 BUYER FIELD WILL REMAIN EMPTY - This is correct behavior!")
        return ''
    
    # Additional safety check - if normalized addresses are empty or too short, don't fill buyer
    if len(shipping_normalized.strip()) < 5 or len(billing_normalized.strip()) < 5:
        print("⚠️ Addresses too short for reliable comparison - NOT filling buyer field")
        return ''
    
    # Different addresses - show buyer info with full formatting
    print("✅ Addresses are different - filling buyer field")
    lines = []
    
    # Company name - SO uses 'company_name', legacy uses 'company'
    company = billing_addr.get('company_name', '') or billing_addr.get('company', '')
    if company:
        lines.append(company.strip())
    
    # Contact person if available (from SO sold_to.contact_person)
    if billing_addr.get('contact_person'):
        lines.append(billing_addr['contact_person'].strip())
    
    # Full address
    addr = format_address(billing_addr)
    if addr:
        lines.append(addr)
    
    return '\n'.join(lines) if lines else ''

def test_address_comparison():
    """Test function to verify address comparison logic works correctly"""
    print("\n🧪 TESTING ADDRESS COMPARISON LOGIC:")
    
    # Test case 1: Same addresses (should return empty)
    shipping1 = {
        'street_address': '123 Main Street',
        'city': 'Toronto',
        'postal_code': 'M1A 1A1'
    }
    billing1 = {
        'street_address': '123 Main St',
        'city': 'Toronto',
        'postal_code': 'M1A 1A1'
    }
    result1 = format_buyer_if_different(shipping1, billing1)
    print(f"Test 1 - Same addresses: '{result1}' (should be empty)")
    
    # Test case 2: Same addresses with attention name (should return empty)
    shipping2 = {
        'street_address': '123 Main Street',
        'city': 'Toronto',
        'postal_code': 'M1A 1A1'
    }
    billing2 = {
        'street_address': '123 Main St, Attention: Mark Henry',
        'city': 'Toronto',
        'postal_code': 'M1A 1A1'
    }
    result2 = format_buyer_if_different(shipping2, billing2)
    print(f"Test 2 - Same addresses with attention: '{result2}' (should be empty)")
    
    # Test case 3: Different addresses (should return buyer info)
    shipping3 = {
        'street_address': '123 Main Street',
        'city': 'Toronto',
        'postal_code': 'M1A 1A1'
    }
    billing3 = {
        'street_address': '456 Oak Avenue',
        'city': 'Vancouver',
        'postal_code': 'V1B 2C2'
    }
    result3 = format_buyer_if_different(shipping3, billing3)
    print(f"Test 3 - Different addresses: '{result3[:50]}...' (should have content)")
    
    print("✅ Address comparison tests completed\n")

def format_customs_docs_to(shipping_addr: Dict[str, Any]) -> str:
    """Format customs documents recipient info with proper line organization"""
    if not shipping_addr:
        return ''
    
    lines = []
    
    # Line 1: Company name
    if shipping_addr.get('company'):
        lines.append(shipping_addr['company'].strip())
    
    # Lines 2-5: Formatted address (each component on separate line)
    addr = format_address(shipping_addr)
    if addr:
        # Don't add as single block, it's already formatted with line breaks
        lines.append(addr)
    
    # Additional lines: Contact info if available
    if shipping_addr.get('phone'):
        lines.append(f"Phone: {shipping_addr['phone'].strip()}")
    if shipping_addr.get('email'):
        lines.append(f"Email: {shipping_addr['email'].strip()}")
    
    return '\n'.join(lines)

def format_consignee_info(shipping_addr: Dict[str, Any], customer_name: str) -> str:
    """Format consignee information for new template"""
    
    # DEBUG: Print actual field names
    print(f"\n=== DEBUG format_consignee_info ===")
    print(f"shipping_addr keys: {list(shipping_addr.keys()) if shipping_addr else 'None'}")
    print(f"customer_name: {customer_name}")
    if shipping_addr:
        print(f"shipping_addr full data: {shipping_addr}")
    
    if not shipping_addr and not customer_name:
        return ''
    
    lines = []
    
    # Company name - SO uses 'company_name', legacy uses 'company'
    company = (shipping_addr.get('company_name', '') or 
               shipping_addr.get('company', '')) if shipping_addr else ''
    if not company and customer_name:
        company = customer_name
    
    if company:
        lines.append(company.strip())
    
    # Contact person if available (from SO ship_to.contact_person)
    if shipping_addr and shipping_addr.get('contact_person'):
        lines.append(shipping_addr['contact_person'].strip())
    
    # Address formatting
    if shipping_addr:
        addr = format_address(shipping_addr)
        if addr:
            lines.append(addr)
    
    return '\n'.join(lines)

def detect_terms_of_sale(so_data: Dict[str, Any]) -> str:
    """Detect terms of sale (Incoterms) from SO data - check terms, special_instructions, and items"""
    import re
    
    # Build a combined text to search for Incoterms
    search_text = ''
    
    # Check SO terms field
    search_text += ' ' + so_data.get('terms', '').upper()
    
    # Check special_instructions (often contains "DAP ANTWERPEN" etc.)
    search_text += ' ' + so_data.get('special_instructions', '').upper()
    
    # Check item descriptions (sometimes Incoterms are in item notes)
    for item in so_data.get('items', []):
        desc = item.get('description', '')
        if desc:
            search_text += ' ' + desc.upper()
    
    # Look for Incoterms with optional destination (e.g., "DAP ANTWERPEN", "FOB TORONTO")
    # Return the full term with destination if found
    incoterm_patterns = [
        (r'DAP\s+([A-Z]+)', 'DAP'),      # DAP ANTWERPEN, DAP NIORT, etc.
        (r'DDP\s+([A-Z]+)', 'DDP'),      # DDP with destination
        (r'FOB\s+([A-Z]+)', 'FOB'),      # FOB with destination
        (r'CIF\s+([A-Z]+)', 'CIF'),      # CIF with destination
        (r'FCA\s+([A-Z]+)', 'FCA'),      # FCA with destination
        (r'EXW\s+([A-Z]+)', 'EXW'),      # EXW with destination
    ]
    
    for pattern, incoterm in incoterm_patterns:
        match = re.search(pattern, search_text)
        if match:
            destination = match.group(1)
            full_term = f"{incoterm} {destination}"
            print(f"DEBUG: Detected terms of sale: {full_term}")
            return full_term
    
    # Simple check without destination
    if 'EXW' in search_text:
        return 'EXW'
    elif 'FOB' in search_text:
        return 'FOB'
    elif 'CIF' in search_text:
        return 'CIF'
    elif 'DAP' in search_text:
        return 'DAP'
    elif 'DDP' in search_text:
        return 'DDP'
    elif 'FCA' in search_text:
        return 'FCA'
    
    # Leave empty if not found - NO DEFAULT
    return ''

def generate_commercial_invoice_html(so_data: Dict[str, Any], items: list, email_analysis: Dict[str, Any] = None) -> str:
    """
    Generate Commercial Invoice HTML using the actual template with field population
    """
    
    print(f"DEBUG: CI - Processing {len(items)} items for Commercial Invoice")
    
    # Load the template
    if not os.path.exists(COMMERCIAL_INVOICE_TEMPLATE):
        raise FileNotFoundError(f"Commercial Invoice template not found: {COMMERCIAL_INVOICE_TEMPLATE}")
    
    with open(COMMERCIAL_INVOICE_TEMPLATE, 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    # Parse with BeautifulSoup
    soup = BeautifulSoup(template_content, 'html.parser')
    
    # Keep all JavaScript - needed for automatic total calculations!
    print(f"DEBUG: CI - Template parsed successfully, JavaScript preserved for calculations")
    
    # FIRST: Calculate freight, brokerage, packages, and weight from SO items
    total_freight = 0.0
    total_brokerage = 0.0
    total_weight = 0.0
    package_counts = {}  # Count packages by type (DRUM, PAIL, etc.)
    
    if items:
        for item in items:
            item_code = str(item.get('item_code', '')).upper()
            description = str(item.get('description', '')).lower()
            
            # Identify FREIGHT charges
            if any(['freight' in item_code.lower(), 'freight' in description, 'shipping' in description]):
                freight_amount = float(item.get('total_price', 0))
                total_freight += freight_amount
                print(f"DEBUG: CI - Freight found: {item.get('description', '')} = ${freight_amount:.2f}")
            
            # Identify BROKERAGE charges  
            elif any(['brokerage' in item_code.lower(), 'brokerage' in description, 'broker' in description]):
                brokerage_amount = float(item.get('total_price', 0))
                total_brokerage += brokerage_amount
                print(f"DEBUG: CI - Brokerage found: {item.get('description', '')} = ${brokerage_amount:.2f}")
            
            # Count packages and calculate weight for physical items
            elif not any(keyword in description for keyword in ['pallet', 'charge', 'fee']):
                unit = str(item.get('unit', '')).upper()
                quantity = item.get('quantity', 0)
                
                # Calculate weight from item data or description
                weight_per_unit = 0
                
                # First: Try direct weight_kg field
                if item.get('weight_kg'):
                    weight_per_unit = float(item.get('weight_kg', 0))
                
                # Second: Extract weight from description (e.g., "230KG", "17KG", "180kg")
                elif re.search(r'(\d+)\s*KG', description.upper()):
                    weight_match = re.search(r'(\d+)\s*KG', description.upper())
                    weight_per_unit = float(weight_match.group(1))
                
                if weight_per_unit > 0:
                    total_weight += weight_per_unit * quantity
                
                # Count packages by unit type
                if unit in ['DRUM', 'PAIL', 'CASE', 'GALLON', 'TUBE']:
                    if unit not in package_counts:
                        package_counts[unit] = 0
                    package_counts[unit] += quantity
    
    # NEW TEMPLATE FIELD MAPPING - Based on actual field analysis
    field_values = {
        # HEADER & CONTACT INFO
        'faxNumber': '',  # Leave empty for manual entry
        'trackingUrl': '',  # Leave empty for manual entry
        'shipmentRef': f"PO#{so_data.get('po_number', '')}" if so_data.get('po_number') else '',  # Add PO# prefix
        'controlNum': '',  # Leave empty for manual entry
        
        # EXPORTER INFO - Canoil Canada Ltd (our company)
        'exporterName': 'Canoil Canada Ltd',
        'exporterAddress': '62 Todd Road\nGeorgetown, ON L7G 4R7\nCanada',
        'producerInfo': '',  # Leave empty if same as exporter
        
        # CONSIGNEE & BUYER INFO - from SO addresses (support both field name formats)
        'consigneeInfo': format_consignee_info(
            so_data.get('shipping_address', {}) or so_data.get('ship_to', {}), 
            so_data.get('customer_name', '')
        ),
        'irsNumber': '',  # Leave empty for manual entry
        'buyerInfo': format_buyer_if_different(
            so_data.get('shipping_address', {}) or so_data.get('ship_to', {}), 
            so_data.get('billing_address', {}) or so_data.get('sold_to', {})
        ),
        
        # TRANSACTION DETAILS (support both field name formats)
        'finalDestination': (
            so_data.get('shipping_address', {}).get('country') or 
            so_data.get('ship_to', {}).get('country') or 
            'USA'
        ),
        # INVOICE DATE = TODAY (when invoice document is generated)
        'invoiceDate': datetime.now().strftime('%Y-%m-%d'),
        # DATE OF SALE = SO Ship Date (when goods are shipped/transaction occurs) - NORMALIZE FORMAT!
        'saleDate': '',  # Will be set after with proper normalization and debug
    }
    
    # Handle sale date separately with debugging
    # Date of Sale = Order Date (when customer placed order)
    raw_sale_date = so_data.get('order_date', '') or so_data.get('ship_date', '') or so_data.get('shipping_date', '')
    print(f"DEBUG CI: Raw sale date (order date) from SO: '{raw_sale_date}'")
    normalized_sale_date = normalize_date_format(raw_sale_date)
    print(f"DEBUG CI: Normalized sale date: '{normalized_sale_date}'")
    field_values['saleDate'] = normalized_sale_date
    
    # Additional duty and terms fields
    field_values['dutyAccountOther'] = ''  # Leave empty (default radio is consignee)
    
    # Brokerage field - Show broker name and account number (not brokerage cost)
    # ONLY fill if we have BOTH name AND account (all or nothing)
    brokerage_info = so_data.get('brokerage', {})
    brokerage_text = ""
    broker_name = brokerage_info.get('broker_name', '').strip() if brokerage_info else ''
    account_num = brokerage_info.get('account_number', '').strip() if brokerage_info else ''
    
    # Only fill if BOTH broker name AND account number are present
    if broker_name and account_num:
        brokerage_text = f"{broker_name} | Account #: {account_num}"
        print(f"DEBUG CI: Brokerage info: {brokerage_text}")
    else:
        if broker_name and not account_num:
            print(f"DEBUG CI: Brokerage incomplete (name only) - leaving blank")
        elif account_num and not broker_name:
            print(f"DEBUG CI: Brokerage incomplete (account only) - leaving blank")
        else:
            print(f"DEBUG CI: No brokerage info")
    
    field_values['brokerage'] = brokerage_text
    
    field_values['discounts'] = ''  # Leave empty for manual entry
    field_values['portOfEntry'] = ''  # Leave empty for manual entry
    field_values['termsOfSale'] = detect_terms_of_sale(so_data)  # Detect from SO or default to EXW
    field_values['currencyOther'] = ''  # Leave empty (default radio handles USD/CAD)
    
    # SHIPPING DETAILS
    field_values['marksNumbers'] = ''  # Leave empty for manual entry
    field_values['packagesDescription'] = ''  # Will be calculated from SO items
    field_values['shippingWeight'] = ''  # Will be calculated from SO items
    field_values['freightIncluded'] = f"${total_freight:.2f}" if total_freight > 0 else ''  # From SO items
    field_values['freightToBorder'] = ''  # Leave empty for manual entry
    
    # DECLARATION FIELDS
    field_values['usPort'] = ''  # Leave empty for manual entry
    field_values['signatureDate'] = datetime.now().strftime('%Y-%m-%d')  # Auto-fill DATE SIGNED with today
    field_values['preparerName'] = ''  # Leave blank for manual entry
    field_values['responsibleEmployee'] = ''  # Leave blank for manual entry
    
    # Calculate package description (e.g., "4 - 230KG Drums")
    if package_counts:
        package_parts = []
        for unit_type, count in package_counts.items():
            # Make singular/plural (e.g., "1 Drum" vs "4 Drums")
            unit_name = unit_type.title() + ('s' if count > 1 else '')
            package_parts.append(f"{int(count)} {unit_name}")
        field_values['packagesDescription'] = ', '.join(package_parts)
        print(f"DEBUG: CI - Packages: {field_values['packagesDescription']}")
    
    # Calculate shipping weight
    if total_weight > 0:
        field_values['shippingWeight'] = f"{total_weight:.1f} kg"
        print(f"DEBUG: CI - Total Weight: {total_weight:.1f} kg")
    else:
        # Fallback to email if available
        email_weight = extract_weight_from_email(email_analysis)
        if email_weight:
            field_values['shippingWeight'] = email_weight
    
    # Calculate grand total from SO total_amount
    if so_data.get('total_amount'):
        field_values['grandTotal'] = f"${so_data.get('total_amount'):.2f}"
        print(f"DEBUG: CI - Grand Total from SO: ${so_data.get('total_amount'):.2f}")
    
    if total_freight > 0:
        print(f"DEBUG: CI - Total Freight added to field_values: ${total_freight:.2f}")
    if total_brokerage > 0:
        print(f"DEBUG: CI - Total Brokerage added to field_values: ${total_brokerage:.2f}")
    
    
    # Populate all input fields and textareas using ID-based lookup
    for field_id, value in field_values.items():
        if not value:  # Skip empty values
            continue
            
        field = soup.find(id=field_id)
        if field:
            if field.name == 'input':
                if field.get('type') in ['text', 'date', 'number']:
                    field['value'] = str(value)
                elif field.get('type') == 'radio':
                    # Handle radio buttons - check if this is the right value
                    if field.get('value') == str(value):
                        field['checked'] = 'checked'
                elif field.get('type') == 'checkbox':
                    # Handle checkboxes
                    if value:
                        field['checked'] = 'checked'
            elif field.name == 'textarea':
                field.string = str(value)
            elif field.name == 'select':
                # Handle select dropdowns - mark the matching option as selected
                for option in field.find_all('option'):
                    if option.get('value') == str(value):
                        option['selected'] = 'selected'
                        break
        else:
            print(f"DEBUG: CI - Field '{field_id}' not found in template")
    
    # Special handling for termsOfSale with destination (e.g., "DAP ANTWERPEN")
    terms_value = field_values.get('termsOfSale', '')
    if terms_value and ' ' in terms_value:
        # Custom term with destination - set dropdown to "other" and fill custom field
        terms_select = soup.find('select', id='termsOfSale')
        if terms_select:
            # Clear any selected options
            for option in terms_select.find_all('option'):
                if 'selected' in option.attrs:
                    del option['selected']
            # Select "other" option
            other_option = terms_select.find('option', {'value': 'other'})
            if other_option:
                other_option['selected'] = 'selected'
        # Fill custom input field
        custom_input = soup.find('input', id='termsOfSaleCustom')
        if custom_input:
            custom_input['value'] = terms_value
            custom_input['style'] = 'display: inline-block; width: 150px; border-bottom: 1px solid #000;'
        print(f"DEBUG: CI - Set custom terms of sale: {terms_value}")
    
    # Handle radio button groups with special logic
    # Currency selection - detect USD vs CAD from SO data
    raw_text = str(so_data.get('raw_text', '')).upper()
    if 'US$' in raw_text or 'USD' in raw_text:
        # Set USD radio button
        usd_radio = soup.find('input', {'name': 'currency', 'value': 'USD'})
        if usd_radio:
            usd_radio['checked'] = 'checked'
    else:
        # Set CAD radio button (default for Canoil)
        cad_radio = soup.find('input', {'name': 'currency', 'value': 'CAD'})
        if cad_radio:
            cad_radio['checked'] = 'checked'
    
    # Separate products from charges (freight, brokerage, etc.) for items table
    physical_items = []
    
    if items:
        for item in items:
            item_code = str(item.get('item_code', '')).upper()
            description = str(item.get('description', '')).lower()
            
            # Identify FREIGHT charges
            is_freight = any([
                'freight' in item_code.lower(),
                'freight' in description,
                'shipping' in description,
                'prepaid' in description and 'freight' in description,
            ])
            
            # Identify BROKERAGE charges
            is_brokerage = any([
                'brokerage' in item_code.lower(),
                'brokerage' in description,
                'broker' in description
            ])
            
            # Identify OTHER non-product charges (pallets, boxes, misc fees)
            is_other_charge = any([
                item_code in ['PALLET', 'BOX', 'MISC', 'MISCELLANEOUS', 'CHARGE'],
                'pallet' in description,  # Any pallet charge
                'pallet' in item_code.lower(),  # Pallet in item code
                'box' in description and 'charge' in description,
                'miscellaneous' in description,
                description.startswith('prepaid') and not is_freight,
                'add shipment' in description
            ])
            
            # Only include physical products in items table
            if not (is_freight or is_brokerage or is_other_charge):
                physical_items.append(item)
                print(f"DEBUG: CI - Including product in items table: {item.get('description', '')}")
            else:
                # Log what we're excluding
                if is_freight:
                    print(f"DEBUG: CI - Excluding freight: {item.get('description', '')}")
                elif is_brokerage:
                    print(f"DEBUG: CI - Excluding brokerage: {item.get('description', '')}")
                elif is_other_charge:
                    print(f"DEBUG: CI - Excluding other charge: {item.get('description', '')}")
    
    # ========================================================================
    # HTS CODE TRUNCATION FOR EUROPEAN SHIPMENTS
    # ========================================================================
    # European shipments (e.g., Axel France) only use 6-digit HTS codes
    is_europe = is_european_shipment(so_data)
    if is_europe:
        print(f"🇪🇺 European shipment detected - truncating HTS codes to 6 digits")
        for item in physical_items:
            original_hts = item.get('hts_code', '')
            if original_hts:
                truncated_hts = truncate_hts_to_6_digits(original_hts)
                item['hts_code'] = truncated_hts
                print(f"   HTS: '{original_hts}' -> '{truncated_hts}'")
    
    # ========================================================================
    # STEEL CONTAINER SEPARATION FOR CUSTOMS
    # ========================================================================
    # For cross-border shipments, steel containers must be declared separately
    # with HTS code 7310.10. This adjusts product prices and adds steel line items.
    print(f"\n>> Processing steel container separation for {len(physical_items)} items...")
    adjusted_items, steel_items = process_items_with_steel_separation(physical_items)
    
    # If European shipment, also truncate steel HTS codes
    if is_europe and steel_items:
        for steel_item in steel_items:
            original_hts = steel_item.get('hts_code', '')
            if original_hts:
                truncated_hts = truncate_hts_to_6_digits(original_hts)
                steel_item['hts_code'] = truncated_hts
                print(f"   Steel HTS: '{original_hts}' -> '{truncated_hts}'")
    
    # Replace physical_items with adjusted items + steel items
    physical_items = adjusted_items + steel_items
    print(f">> After steel separation: {len(adjusted_items)} products + {len(steel_items)} steel line items")
    
    # NEW TEMPLATE: Handle class-based items table with dynamic rows
    items_tbody = soup.find('tbody', id='itemsBody')
    if items_tbody and physical_items:
        # Clear existing rows first
        items_tbody.clear()
        
        # Add rows for each physical item
        for item in physical_items:
            # Create new row
            new_row = soup.new_tag('tr')
            
            # Country of Origin cell
            country_cell = soup.new_tag('td')
            country_input = soup.new_tag('input', type='text', **{'class': 'country-origin'})
            country_input['value'] = str(item.get('country_of_origin', ''))  # User will fill manually
            country_cell.append(country_input)
            new_row.append(country_cell)
            
            # Description cell (separate from HTS now)
            desc_cell = soup.new_tag('td')
            desc_textarea = soup.new_tag('textarea', **{'class': 'item-description'}, rows='2')
            description = str(item.get('description', ''))
            desc_textarea.string = description
            desc_cell.append(desc_textarea)
            new_row.append(desc_cell)
            
            # HTS Code cell (new separate field)
            hts_cell = soup.new_tag('td')
            hts_input = soup.new_tag('input', type='text', **{'class': 'hts-code'})
            hts_code = str(item.get('hts_code', ''))
            print(f"DEBUG CI: Item {item.get('description', '')} - HTS Code: '{hts_code}'")
            hts_input['value'] = hts_code
            hts_cell.append(hts_input)
            new_row.append(hts_cell)
            
            # Unit Quantity cell
            qty_cell = soup.new_tag('td')
            qty_input = soup.new_tag('input', type='number', **{'class': 'unit-qty'}, 
                                   step='1', min='0', onchange='calculateItemTotal(this)')
            qty_input['value'] = str(item.get('quantity', ''))
            qty_cell.append(qty_input)
            new_row.append(qty_cell)
            
            # Unit Price cell
            price_cell = soup.new_tag('td')
            price_input = soup.new_tag('input', type='text', **{'class': 'unit-price'}, 
                                     onchange='calculateItemTotal(this)', placeholder='$0.00')
            unit_price = float(item.get('unit_price', 0))
            # Add $ sign for money format
            price_input['value'] = f"${unit_price:,.2f}"
            price_cell.append(price_input)
            new_row.append(price_cell)
            
            # Item Total cell (editable)
            total_cell = soup.new_tag('td')
            total_input = soup.new_tag('input', type='text', **{'class': 'item-total'}, placeholder='$0.00')
            total_input['style'] = 'background: #f5f5f5; font-weight: bold;'
            # Calculate with $ sign and commas
            item_total = float(item.get('quantity', 0)) * unit_price
            total_input['value'] = f"${item_total:,.2f}"
            total_cell.append(total_input)
            new_row.append(total_cell)
            
            # Add the row to tbody
            items_tbody.append(new_row)
            
        print(f"DEBUG: CI - Added {len(physical_items)} item rows to new template")
    else:
        print(f"DEBUG: CI - No items table found or no physical items to populate")
    
    # Add script for auto-calculations ONLY (dates already set in HTML by backend)
    script_tag = soup.new_tag('script')
    script_tag.string = """
    // Auto-expand textareas and calculate totals (dates are handled by backend)
    document.addEventListener('DOMContentLoaded', function() {
        // Trigger auto-expand for all pre-filled textareas
        document.querySelectorAll('textarea').forEach(function(textarea) {
            if (textarea.value) {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }
        });
        
        // Calculate invoice total for pre-filled items
        let grandTotal = 0;
        document.querySelectorAll('.item-total').forEach(function(totalInput) {
            if (totalInput.value) {
                // Remove $ and commas, then parse
                let value = parseFloat(totalInput.value.replace(/[$,]/g, '')) || 0;
                grandTotal += value;
            }
        });
        
        // Set grand total with $ and commas
        let grandTotalElem = document.getElementById('grandTotal');
        if (grandTotalElem && grandTotal > 0) {
            grandTotalElem.value = '$' + grandTotal.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
        }
    });
    """
    # Insert at the beginning of body, before template's script
    if soup.body:
        soup.body.insert(0, script_tag)
    else:
        soup.append(script_tag)
    
    # CRITICAL: Remove ALL placeholders from entire document
    # Placeholders show as grey text and are visible when printing - must be removed!
    print("\n>> Removing all placeholder text from Commercial Invoice...")
    placeholder_count = 0
    for input_field in soup.find_all(['input', 'textarea']):
        if input_field.has_attr('placeholder'):
            del input_field['placeholder']
            placeholder_count += 1
    print(f"   Removed {placeholder_count} placeholder attributes")
    
    return str(soup)

def save_commercial_invoice_html(html_content: str, so_number: str) -> tuple:
    """Save commercial invoice HTML and return filepath and filename"""
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"CommercialInvoice_SO{so_number}_{timestamp}.html"
    # Use absolute path to avoid nested directory issues
    from logistics_automation import get_uploads_dir
    uploads_dir = get_uploads_dir()
    filepath = os.path.join(uploads_dir, filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    return filepath, filename
