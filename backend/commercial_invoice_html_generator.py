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

# Steel container prices (USD/CAD - 1:1, no conversion)
STEEL_PRICES = {
    'drum': 66.98,      # Steel Drum (200L)
    'keg': 45.00,       # Steel Keg (55kg)
    'pail': 26.00,      # Steel Pail (6 gal/22L)
    'can': 5.38,        # Steel Can (1L)
}

# Products that use steel containers
STEEL_CONTAINER_PRODUCTS = ['MOV', 'VSG', 'REOLUBE', 'AEC', 'CANOIL', 'DIESEL', 'ENGINE FLUSH', 'FUEL SYSTEM']


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
    - container_type: 'drum', 'keg', 'pail', 'can', or None
    - qty_multiplier: number of containers per unit (e.g., 12 cans per case)
    """
    desc_lower = description.lower()
    unit_lower = (unit or '').lower()
    
    # PRIORITY 1: Check UNIT first (most reliable) - unit tells us the container type
    if 'drum' in unit_lower:
        return ('drum', 1)
    
    if 'keg' in unit_lower:
        return ('keg', 1)
    
    if 'pail' in unit_lower:
        return ('pail', 1)
    
    # CASE12, CASE, etc. with 1L products = steel cans
    # BUT: Tube cases (400g, etc.) are NOT steel cans - they're plastic/aluminum tubes
    if 'case' in unit_lower:
        # FIRST: Check if it's a TUBE case (not a can case) - be very aggressive
        # Tube cases: "30x400g", "30X400G", "400g", "tube", "pack tube", "tube case", etc.
        # Check for ANY of these patterns - if found, it's NOT a can case
        tube_patterns = [
            r'\d+\s*x\s*\d+\s*g',  # "30x400g", "30X400G"
            r'\d+\s*g\s+tube',      # "400g tube"
            r'tube',                # "tube" anywhere
            r'pack\s*tube',         # "pack tube", "PACK TUBE"
            r'tube\s*case',         # "tube case"
        ]
        for pattern in tube_patterns:
            if re.search(pattern, desc_lower, re.IGNORECASE):
                # This is a TUBE case, not a can case - NO STEEL CONTAINER
                print(f"DEBUG STEEL: Case unit detected but description contains tube pattern '{pattern}' - NOT a can case, returning None")
                return (None, 0)
        
        # SECOND: Only if NO tube patterns found, check for actual can cases
        # Look for "12x1L" or similar pattern in description (actual can cases)
        case_match = re.search(r'(\d+)\s*x\s*1\s*l', desc_lower, re.IGNORECASE)
        if case_match:
            return ('can', int(case_match.group(1)))
        # Only return cans if it's EXPLICITLY a 1L product
        if '1l' in desc_lower or '1 l' in desc_lower:
            return ('can', 12)
        # DEFAULT: If we can't determine it's cans, return None - NEVER assume cans!
        print(f"DEBUG STEEL: Case unit detected but no clear can/tube pattern - returning None (no steel container)")
        return (None, 0)
    
    # PRIORITY 2: Check description only if unit didn't match
    # But IGNORE "sample pail" mentions - those are appended notes, not the product type
    desc_for_check = desc_lower.split('+')[0].strip()  # Remove "+ 1 Sample pail" suffix
    
    if 'drum' in desc_for_check:
        return ('drum', 1)
    
    if 'keg' in desc_for_check:
        return ('keg', 1)
    
    if 'pail' in desc_for_check and 'sample' not in desc_lower:
        return ('pail', 1)
    
    # Check for cans in description - use word boundary to avoid matching "Canada", "Canoil", etc.
    # Only match actual "can" or "cans" as whole words
    if re.search(r'\bcan[s]?\b', desc_for_check):
        case_match = re.search(r'(\d+)\s*(?:x|per|cans?\s*per)', desc_for_check)
        if case_match:
            return ('can', int(case_match.group(1)))
        return ('can', 1)
    
    return (None, 0)


def needs_steel_separation(description: str) -> bool:
    """
    Check if product is one that uses steel containers (MOV, VSG, Reolube, AEC, etc.)
    These products have steel container cost included in unit price that needs to be separated.
    """
    desc_upper = description.upper()
    return any(prod in desc_upper for prod in STEEL_CONTAINER_PRODUCTS)


def enhance_mov_description_for_crossborder(description: str, unit: str) -> str:
    """
    For MOV products on cross-border shipments, add size and product type.
    Each on separate line:
    MOV Extra 0 - Drums
    180kg/drum
    Petroleum Lubricating Grease
    """
    desc_upper = description.upper()
    unit_lower = unit.lower() if unit else ''
    
    # Only enhance MOV products
    if 'MOV' not in desc_upper:
        return description
    
    # Check if already enhanced (avoid double-adding)
    if 'Petroleum Lubricating Grease' in description:
        return description
    
    # Determine container type and add appropriate info (each on new line)
    if 'drum' in unit_lower or 'DRUM' in desc_upper:
        return f"{description}\n180kg/drum\nPetroleum Lubricating Grease"
    elif 'pail' in unit_lower or 'PAIL' in desc_upper:
        return f"{description}\n17kg/pail\nPetroleum Lubricating Grease"
    else:
        # Default - just add the product type
        return f"{description}\nPetroleum Lubricating Grease"


def enhance_description_for_ci(description: str, unit: str, item_code: str = '') -> str:
    """
    Enhance item descriptions for Commercial Invoice with proper customs naming.
    
    Specific products have required CI naming conventions:
    - ANDEROL FGCS-2: "Petroleum Oil Based Lubricating Grease (Food Grade), ANDEROL FGCS-2, 12kg per case (30 x 400g)"
    """
    desc_upper = description.upper()
    code_upper = (item_code or '').upper()
    
    # ANDEROL FGCS-2 Food Grade Grease - per 2026 USMCA
    if 'FGCS' in desc_upper or 'FGCS' in code_upper or ('ANDEROL' in desc_upper and 'FOOD GRADE' in desc_upper):
        # Check if already enhanced
        if 'Petroleum Lubricating Grease' in description and 'ANDEROL FGCS-2' in description:
            return description
        return "Petroleum Lubricating Grease, ANDEROL FGCS-2, 12kg per case (30 x 400g)"
    
    # MOV products - use existing enhancement
    if 'MOV' in desc_upper:
        return enhance_mov_description_for_crossborder(description, unit)
    
    # Default - return original description
    return description


def process_items_with_steel_separation(items: List[Dict[str, Any]], sample_pail_count: int = 0, is_aec: bool = False) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Process items to separate steel container costs from product costs.
    
    For AEC orders:
    - Convert quantity to LITERS for commercial invoice
    - Sample pails added to liters AND steel count
    
    Args:
        items: List of items to process
        sample_pail_count: Extra pails from samples
        is_aec: True for AEC orders (uses liter conversion)
    
    Returns: (adjusted_items, steel_items)
    """
    adjusted_items = []
    steel_totals = {
        'drum': {'count': 0, 'price': STEEL_PRICES['drum']},
        'keg': {'count': 0, 'price': STEEL_PRICES['keg']},
        'pail': {'count': 0, 'price': STEEL_PRICES['pail']},  # DON'T pre-add sample - already in item qty
        'can': {'count': 0, 'price': STEEL_PRICES['can']},
    }
    
    # Conversion factors to liters
    LITERS_PER_GALLON = 3.785
    LITERS_PER_DRUM = 200  # 200L drum
    LITERS_PER_PAIL_6GAL = 6 * LITERS_PER_GALLON  # ~22.71 L
    
    # Track if we've added sample pail liters to a pail product
    sample_pail_liters_added = False
    
    if sample_pail_count > 0:
        print(f"DEBUG STEEL: Starting with {sample_pail_count} sample pail(s) - will add to steel count AND first pail product liters")
    
    for item in items:
        description = str(item.get('description', ''))
        unit = str(item.get('unit', ''))
        quantity = float(item.get('quantity', 0))
        unit_price = float(item.get('unit_price', 0))
        # Check if item is a sample - but NOT if it just has "Sample pail" appended to description
        is_sample = item.get('is_sample', False)
        # Only treat as sample if description STARTS with "Sample" (not contains "+ 1 Sample pail")
        if not is_sample and description.upper().startswith('SAMPLE'):
            is_sample = True
        
        # Check if this product uses steel containers
        if needs_steel_separation(description):
            container_type, qty_multiplier = detect_steel_container_type(description, unit)
            
            if container_type and qty_multiplier > 0:
                steel_price = STEEL_PRICES[container_type]
                
                # Track total steel containers (always count, even for samples)
                total_containers = int(quantity * qty_multiplier)
                steel_totals[container_type]['count'] += total_containers
                
                print(f"DEBUG STEEL: {description}")
                print(f"  - Container type: {container_type}, multiplier: {qty_multiplier}")
                print(f"  - Original qty: {quantity} {unit}")
                print(f"  - Steel containers: {total_containers}")
                print(f"  - Is AEC order: {is_aec}")
                
                # ============================================================
                # AEC ORDERS: Convert to LITERS, add sample pails
                # ============================================================
                if is_aec:
                    # Calculate quantity in LITERS for AEC commercial invoice
                    if container_type == 'drum':
                        liters_qty = quantity * LITERS_PER_DRUM
                    elif container_type == 'pail':
                        # DON'T add sample pails again - they're already included in quantity
                        # (Sample was merged in logistics_automation.py combine_so_data_for_documents)
                        total_pails = int(quantity)  # Already includes sample if applicable
                        sample_pail_liters_added = True  # Mark as handled
                        print(f"  - Total pails: {total_pails} (sample already included in qty)")
                        liters_qty = total_pails * LITERS_PER_PAIL_6GAL
                    elif container_type == 'can':
                        # 500 cases × 12 cans × 1L = 6000 L
                        liters_qty = quantity * qty_multiplier * 1
                    else:
                        liters_qty = quantity
                    
                    print(f"  - Converted to LITERS: {liters_qty:.1f} L")
                    
                    # For SAMPLES: $0 value
                    if is_sample or unit_price == 0:
                        print(f"  - SAMPLE item - $0 value")
                        adjusted_item = item.copy()
                        # Store original values for package counting
                        adjusted_item['original_quantity'] = quantity
                        adjusted_item['original_unit'] = unit
                        adjusted_item['quantity'] = liters_qty
                        adjusted_item['unit'] = 'L'
                        adjusted_item['unit_price'] = 0.0
                        adjusted_item['is_sample'] = True
                        adjusted_item['steel_separated'] = True
                        adjusted_items.append(adjusted_item)
                    else:
                        # Total value from SO (sample is FREE)
                        total_value = quantity * unit_price
                        # Steel cost = PAID containers only
                        paid_containers = int(quantity * qty_multiplier)
                        steel_cost_to_deduct = paid_containers * steel_price
                        adjusted_total_value = total_value - steel_cost_to_deduct
                        # Price per liter
                        adjusted_price_per_liter = adjusted_total_value / liters_qty if liters_qty > 0 else 0
                        
                        print(f"  - SO total: ${total_value:.2f}")
                        print(f"  - Steel deducted: ${steel_cost_to_deduct:.2f}")
                        print(f"  - Product value: ${adjusted_total_value:.2f}")
                        print(f"  - Price/L: ${adjusted_price_per_liter:.4f}")
                        
                        adjusted_item = item.copy()
                        # Store original values for package counting
                        adjusted_item['original_quantity'] = quantity
                        adjusted_item['original_unit'] = unit
                        adjusted_item['quantity'] = liters_qty
                        adjusted_item['unit'] = 'L'
                        adjusted_item['unit_price'] = adjusted_price_per_liter
                        adjusted_item['total_price'] = adjusted_total_value
                        adjusted_item['steel_separated'] = True
                        adjusted_items.append(adjusted_item)
                
                # ============================================================
                # NON-AEC ORDERS: Keep original units, just separate steel
                # ============================================================
                else:
                    if is_sample or unit_price == 0:
                        adjusted_item = item.copy()
                        adjusted_item['unit_price'] = 0.0
                        adjusted_item['is_sample'] = True
                        adjusted_item['steel_separated'] = True
                        adjusted_items.append(adjusted_item)
                    else:
                        # Subtract steel cost from unit price
                        steel_cost_per_unit = steel_price * qty_multiplier
                        adjusted_unit_price = unit_price - steel_cost_per_unit
                        
                        print(f"  - Steel cost/unit: ${steel_cost_per_unit:.2f}")
                        print(f"  - Adjusted price: ${adjusted_unit_price:.2f}")
                        
                        adjusted_item = item.copy()
                        adjusted_item['unit_price'] = adjusted_unit_price
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
    
    if steel_totals['keg']['count'] > 0:
        steel_items.append({
            'description': 'Steel Keg (55kg)',
            'hts_code': STEEL_HTS_CODE,
            'quantity': steel_totals['keg']['count'],
            'unit': 'Keg',
            'unit_price': STEEL_PRICES['keg'],
            'country_of_origin': 'Canada',
            'is_steel_container': True,
        })
        print(f"DEBUG STEEL: Added {steel_totals['keg']['count']} kegs @ ${STEEL_PRICES['keg']:.2f}")
    
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
        # Extract number from any position in the string (handle commas as thousand separators)
        weight_match = re.search(r'([\d,]+(?:\.\d+)?)', weight_str)
        if weight_match:
            try:
                # Remove commas before converting to float
                weight_value = float(weight_match.group(1).replace(',', ''))
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
    Return buyer info if different COMPANY from consignee, empty if same company
    
    CRITICAL BUSINESS RULE:
    - If buyer COMPANY = consignee COMPANY → Return EMPTY string (even if different addresses)
    - If buyer COMPANY ≠ consignee COMPANY → Return formatted buyer info
    
    Same company with different addresses (billing HQ vs shipping warehouse) should NOT show buyer.
    Only show buyer when it's a DIFFERENT company (e.g., parent company paying for subsidiary).
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
    
    # FIRST: Compare COMPANY NAMES - if same company, don't show buyer (even with different addresses)
    shipping_company = (shipping_addr.get('company_name', '') or 
                        shipping_addr.get('company', '') or '').strip().upper()
    billing_company = (billing_addr.get('company_name', '') or 
                       billing_addr.get('company', '') or '').strip().upper()
    
    # Normalize company names for comparison (remove Inc, Ltd, LLC, etc.)
    def normalize_company(name):
        if not name:
            return ''
        name = name.upper()
        # Remove common suffixes
        for suffix in [' INC', ' INC.', ' LTD', ' LTD.', ' LLC', ' LLC.', ' CORP', ' CORP.', ' CO', ' CO.', ' LIMITED']:
            name = name.replace(suffix, '')
        # Remove extra whitespace
        name = ' '.join(name.split())
        return name.strip()
    
    shipping_company_normalized = normalize_company(shipping_company)
    billing_company_normalized = normalize_company(billing_company)
    
    print(f"🏢 COMPANY COMPARISON:")
    print(f"   Consignee company: '{shipping_company}' → normalized: '{shipping_company_normalized}'")
    print(f"   Buyer company:     '{billing_company}' → normalized: '{billing_company_normalized}'")
    
    # If same company name, don't show buyer (even if different addresses)
    if shipping_company_normalized and billing_company_normalized:
        if shipping_company_normalized == billing_company_normalized:
            print("✅ Same company - NOT filling buyer field (different address is OK)")
            print("🚫 BUYER FIELD WILL REMAIN EMPTY - Same company, different address")
            return ''
    
    # Additional check: If one company name contains the other, likely same company
    if shipping_company_normalized and billing_company_normalized:
        if (shipping_company_normalized in billing_company_normalized or 
            billing_company_normalized in shipping_company_normalized):
            print("✅ Company names overlap - likely same company, NOT filling buyer field")
            return ''
    
    # FALLBACK: If company names are empty, compare addresses
    if not shipping_company_normalized or not billing_company_normalized:
        print("⚠️ Company name missing - falling back to address comparison")
        
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
        
        shipping_core = f"{shipping_street} {shipping_city} {shipping_postal}".strip()
        billing_core = f"{billing_street} {billing_city} {billing_postal}".strip()
        
        shipping_normalized = normalize_address_for_comparison(shipping_core)
        billing_normalized = normalize_address_for_comparison(billing_core)
        
        print(f"🔍 ADDRESS COMPARISON (fallback):")
        print(f"   Shipping normalized: '{shipping_normalized}'")
        print(f"   Billing normalized:  '{billing_normalized}'")
        
        if shipping_normalized == billing_normalized:
            print("✅ Addresses are the same - NOT filling buyer field")
            return ''
        
        if len(shipping_normalized.strip()) < 5 or len(billing_normalized.strip()) < 5:
            print("⚠️ Addresses too short for reliable comparison - NOT filling buyer field")
            return ''
    
    # DIFFERENT COMPANY - show buyer info with full formatting
    print("✅ Different company detected - filling buyer field")
    lines = []
    
    # Company name - SO uses 'company_name', legacy uses 'company'
    company = billing_addr.get('company_name', '') or billing_addr.get('company', '')
    if company:
        lines.append(company.strip())
    
    # Contact person if available (from SO sold_to.contact_person)
    if billing_addr.get('contact_person'):
        lines.append(billing_addr['contact_person'].strip())
    
    # Full address - filter out company if it's duplicated in address
    addr = format_address(billing_addr)
    if addr and company:
        addr_lines = addr.split('\n')
        filtered_lines = [line for line in addr_lines if line.strip().lower() != company.strip().lower()]
        addr = '\n'.join(filtered_lines)
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
    
    # Address formatting - but REMOVE company name if it got included in street address
    if shipping_addr:
        addr = format_address(shipping_addr)
        if addr and company:
            # Remove company name from address if it was duplicated there
            addr_lines = addr.split('\n')
            filtered_lines = [line for line in addr_lines if line.strip().lower() != company.strip().lower()]
            addr = '\n'.join(filtered_lines)
        if addr:
            lines.append(addr)
    
    return '\n'.join(lines)

def detect_terms_of_sale(so_data: Dict[str, Any], email_analysis: Dict[str, Any] = None) -> str:
    """Detect terms of sale (Incoterms) from email and SO data - check all sources"""
    # Build a combined text to search for Incoterms
    search_text = ''
    
    # Priority 1: Check email for incoterms (e.g., "Incoterms: DAP NIORT")
    if email_analysis:
        # Check explicit incoterms field
        if email_analysis.get('incoterms'):
            incoterms = email_analysis['incoterms']
            print(f"DEBUG: Incoterms from email field: {incoterms}")
            return incoterms
        
        # Check email body text
        email_body = email_analysis.get('email_body', '') or email_analysis.get('raw_text', '') or ''
        search_text += ' ' + email_body.upper()
        
        # Check email special_instructions
        search_text += ' ' + str(email_analysis.get('special_instructions', '')).upper()
    
    # Priority 2: Check SO fields
    search_text += ' ' + so_data.get('terms', '').upper()
    
    # Check special_instructions (often contains "DAP ANTWERPEN" etc.)
    search_text += ' ' + so_data.get('special_instructions', '').upper()
    
    # Check comments/notes section (where incoterms often appear)
    search_text += ' ' + so_data.get('comments', '').upper()
    search_text += ' ' + so_data.get('notes', '').upper()
    search_text += ' ' + so_data.get('memo', '').upper()
    
    # Check item descriptions (sometimes Incoterms are in item notes)
    for item in so_data.get('items', []):
        desc = item.get('description', '')
        if desc:
            search_text += ' ' + desc.upper()
    
    # First: Look for explicit "Incoterms:" label (e.g., "Incoterms: DAP NIORT")
    incoterms_labeled = re.search(r'INCOTERMS?\s*:?\s*([A-Z]{3}(?:\s+[A-Z][A-Za-z,\s]+)?)', search_text)
    if incoterms_labeled:
        full_term = incoterms_labeled.group(1).strip()
        print(f"DEBUG: Found labeled Incoterms: {full_term}")
        return full_term
    
    # Look for Incoterms with optional destination (e.g., "DAP ANTWERPEN", "FOB TORONTO")
    # Return the full term with destination if found
    incoterm_patterns = [
        (r'DAP\s+([A-Z][A-Za-z,\s]+?)(?:\s*[,\.\n]|$)', 'DAP'),      # DAP ANTWERPEN, DAP NIORT, DAP Kennesaw, GA
        (r'DDP\s+([A-Z][A-Za-z,\s]+?)(?:\s*[,\.\n]|$)', 'DDP'),      # DDP with destination
        (r'FOB\s+([A-Z][A-Za-z,\s]+?)(?:\s*[,\.\n]|$)', 'FOB'),      # FOB with destination
        (r'CIF\s+([A-Z][A-Za-z,\s]+?)(?:\s*[,\.\n]|$)', 'CIF'),      # CIF with destination
        (r'FCA\s+([A-Z][A-Za-z,\s]+?)(?:\s*[,\.\n]|$)', 'FCA'),      # FCA with destination
        (r'EXW\s+([A-Z][A-Za-z,\s]+?)(?:\s*[,\.\n]|$)', 'EXW'),      # EXW with destination
    ]
    
    for pattern, incoterm in incoterm_patterns:
        match = re.search(pattern, search_text)
        if match:
            destination = match.group(1).strip()
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
            elif not any(keyword in description for keyword in ['pallet', 'charge', 'fee', 'steel']):
                # Use original_unit if available (before liter conversion), otherwise current unit
                unit = str(item.get('original_unit', item.get('unit', ''))).upper()
                # Use original_quantity if available, otherwise current quantity
                quantity = item.get('original_quantity', item.get('quantity', 0))
                
                # For AEC liter conversion: detect original unit from description if unit is now "L"
                if unit == 'L' or unit == '':
                    desc_upper = item.get('description', '').upper()
                    if 'PAIL' in desc_upper:
                        unit = 'PAIL'
                    elif 'CASE' in desc_upper or 'CASE12' in str(item.get('original_unit', '')).upper():
                        unit = 'CASE'
                    elif 'DRUM' in desc_upper:
                        unit = 'DRUM'
                
                # Normalize CASE12 to CASE
                if unit == 'CASE12':
                    unit = 'CASE'
                
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
                    try:
                        package_counts[unit] += int(float(quantity)) if quantity else 0
                    except:
                        pass
    
    # EXPORTER INFO - Use shipper_override if provided, otherwise billing_address/sold_to, otherwise Canoil
    # Calculate exporter info BEFORE building field_values dictionary
    shipper_override = {}
    try:
        shipper_override = email_analysis.get('shipper_override', {}) or so_data.get('shipper_override', {}) or {}
    except Exception as override_err:
        print(f"WARNING: Could not read shipper_override for CI: {override_err}")
        shipper_override = {}

    if isinstance(shipper_override, dict) and (shipper_override.get('company') or shipper_override.get('company_name')):
        exporter_name = shipper_override.get('company') or shipper_override.get('company_name', 'Canoil Canada Ltd')
        exporter_address_parts = [
            shipper_override.get('street') or shipper_override.get('address', ''),
            ' '.join(filter(None, [shipper_override.get('city', ''), shipper_override.get('province') or shipper_override.get('state', '')])).strip(),
            shipper_override.get('postal') or shipper_override.get('postal_code', ''),
            shipper_override.get('country', '')
        ]
        exporter_address_parts = [part for part in exporter_address_parts if part]
        exporter_address = '\n'.join(exporter_address_parts) if exporter_address_parts else '62 Todd Road\nGeorgetown, ON L7G 4R7\nCanada'
    else:
        billing_addr = so_data.get('billing_address', {}) or so_data.get('sold_to', {})
        exporter_name = (billing_addr.get('company_name', '') or 
                        billing_addr.get('company', '') or 
                        'Canoil Canada Ltd')
        
        # Build exporter address from billing_address if available
        if billing_addr.get('street') or billing_addr.get('address'):
            exporter_address_parts = []
            if billing_addr.get('street'):
                exporter_address_parts.append(billing_addr['street'])
            elif billing_addr.get('address'):
                exporter_address_parts.append(billing_addr['address'])
            
            city_prov = []
            if billing_addr.get('city'):
                city_prov.append(billing_addr['city'])
            if billing_addr.get('province') or billing_addr.get('state'):
                city_prov.append(billing_addr.get('province') or billing_addr.get('state', ''))
            if city_prov:
                exporter_address_parts.append(', '.join(city_prov))
            
            if billing_addr.get('postal_code') or billing_addr.get('postal'):
                exporter_address_parts.append(billing_addr.get('postal_code') or billing_addr.get('postal', ''))
            
            if billing_addr.get('country'):
                exporter_address_parts.append(billing_addr['country'])
            
            exporter_address = '\n'.join(exporter_address_parts) if exporter_address_parts else '62 Todd Road\nGeorgetown, ON L7G 4R7\nCanada'
        else:
            exporter_address = '62 Todd Road\nGeorgetown, ON L7G 4R7\nCanada'
    
    # NEW TEMPLATE FIELD MAPPING - Based on actual field analysis
    field_values = {
        # HEADER & CONTACT INFO
        'faxNumber': '',  # Leave empty for manual entry
        'trackingUrl': '',  # Leave empty for manual entry
        'shipmentRef': f"PO#{so_data.get('po_number', '')}" if so_data.get('po_number') else '',  # Add PO# prefix
        'controlNum': '',  # Leave empty for manual entry
        
        # EXPORTER INFO - Use calculated values from above
        'exporterName': exporter_name,
        'exporterAddress': exporter_address,
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
    field_values['dutyAccountOther'] = ''  # Leave empty for manual entry
    
    # Check if Canoil handles brokerage (PREPAID brokerage in SO)
    # Search special_instructions, terms, notes for "PREPAID" + "BROKERAGE"
    brokerage_search_text = ' '.join([
        so_data.get('special_instructions', ''),
        so_data.get('terms', ''),
        so_data.get('notes', ''),
        so_data.get('memo', '')
    ]).upper()
    
    # Check for items that indicate prepaid brokerage
    for item in so_data.get('items', []):
        item_desc = str(item.get('description', '')).upper()
        if 'BROKERAGE' in item_desc and 'PREPAID' in item_desc:
            brokerage_search_text += ' PREPAID BROKERAGE'
        if 'PREPAID' in item_desc and 'BROKER' in item_desc:
            brokerage_search_text += ' PREPAID BROKERAGE'
    
    # Detect if Canoil is handling brokerage (prepaid)
    canoil_handles_brokerage = (
        ('PREPAID' in brokerage_search_text and 'BROKERAGE' in brokerage_search_text) or
        ('PREPAID' in brokerage_search_text and 'BROKER' in brokerage_search_text) or
        'PREPAID BROKERAGE' in brokerage_search_text
    )
    
    # Also check customer - Georgia Western always uses our broker
    customer_name = so_data.get('customer_name', '') or so_data.get('company_name', '') or ''
    is_georgia_western = 'georgia western' in customer_name.lower()
    
    # Brokerage field - Use Near North if Canoil handles brokerage
    brokerage_info = so_data.get('brokerage', {})
    brokerage_text = ""
    extracted_broker = ""
    
    # First: Try to extract broker from "Clearance done by [BROKER]" or "Customs by [BROKER]"
    # Check both SO special_instructions and email_analysis special_instructions
    special_text = so_data.get('special_instructions', '') or ''
    if email_analysis:
        email_special = email_analysis.get('special_instructions', '') or ''
        if email_special:
            special_text = special_text + ' ' + email_special if special_text else email_special
    
    # Also check email raw text for broker patterns
    email_raw_text = ''
    if email_analysis:
        email_raw_text = email_analysis.get('raw_text', '') or email_analysis.get('email_body', '') or ''
    
    # Combine all text sources for broker extraction
    combined_text = special_text
    if email_raw_text:
        combined_text = combined_text + ' ' + email_raw_text if combined_text else email_raw_text
    
    # Patterns to extract broker name from special instructions
    # IMPORTANT: Patterns like "Brokerage: Near North" or "Broker: Near North" mean EXPORTER (Canoil) handles it
    # This triggers Near North Customs Brokers filling + EXPORTER radio button checked
    clearance_patterns = [
        r'[Bb]rokerage\s*:?\s*([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
        r'[Bb]roker\s*:?\s*([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
        r'[Bb]roker\s+on\s+(?:the\s+)?[Ee]xporter\s+(?:and\s+)?using\s+([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
        r'[Bb]roker\s+will\s+be\s+taking\s+care\s+of\s+by\s+(?:exporter\s+)?using\s+([A-Z][A-Za-z0-9\s&]+?)(?:,|\.|\s*$|$)',
        r'[Bb]roker\s+will\s+be\s+handled\s+by\s+(?:exporter\s+)?using\s+([A-Z][A-Za-z0-9\s&]+?)(?:,|\.|\s*$|$)',
        r'[Cc]learance\s+(?:done\s+)?by\s+([A-Z][A-Za-z0-9\s&]+?)(?:,|\.|\s*$|\s+Don)',
        r'[Cc]ustoms\s+(?:done\s+)?by\s+([A-Z][A-Za-z0-9\s&]+?)(?:,|\.|\s*$|\s+Don)',
        r'[Bb]rokerage\s+(?:done\s+)?by\s+([A-Z][A-Za-z0-9\s&]+?)(?:,|\.|\s*$)',
    ]
    
    for pattern in clearance_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            extracted_broker = match.group(1).strip()
            print(f"DEBUG CI: Extracted broker from special instructions/email: {extracted_broker}")
            
            # Normalize "Near North" variations to trigger Near North filling
            # When Near North is mentioned, it means EXPORTER (Canoil) handles brokerage
            extracted_upper = extracted_broker.upper()
            if 'NEAR NORTH' in extracted_upper or 'NEARNORTH' in extracted_upper:
                # This means Near North should be used - set flag if email_analysis exists
                if email_analysis:
                    email_analysis['use_near_north'] = True
                    email_analysis['customs_broker'] = 'Near North Customs Brokers'
                    print(f"DEBUG CI: ✅ Near North detected! Setting use_near_north flag - EXPORTER will handle brokerage")
                # Also set extracted_broker to empty so it doesn't override Near North logic below
                extracted_broker = ''
            break
    
    if canoil_handles_brokerage or is_georgia_western:
        # Canoil handles brokerage - use Near North Customs Brokers
        brokerage_text = "Near North Customs Brokers"
        print(f"DEBUG CI: Canoil handles brokerage (prepaid) - using Near North Customs Brokers")
    elif extracted_broker:
        # Customer has specified their broker in special instructions
        brokerage_text = extracted_broker
        print(f"DEBUG CI: Customer broker from special instructions: {brokerage_text}")
    else:
        # Check if SO has broker info (customer's broker)
        broker_name = brokerage_info.get('broker_name', '').strip() if brokerage_info else ''
        account_num = brokerage_info.get('account_number', '').strip() if brokerage_info else ''
        
        # Only fill if BOTH broker name AND account number are present
        if broker_name and account_num:
            brokerage_text = f"{broker_name} | Account #: {account_num}"
            print(f"DEBUG CI: Customer brokerage info: {brokerage_text}")
        else:
            print(f"DEBUG CI: No brokerage info - leaving blank")
    
    field_values['brokerage'] = brokerage_text
    
    # Check if AEC order (for broker info and IRS number)
    is_aec_order = 'AEC' in customer_name.upper()
    
    # =====================================================================
    # CLEAN BROKER DETECTION - Use simple flag from email processing
    # =====================================================================
    use_near_north = False
    if email_analysis:
        # Primary check: use_near_north flag set by process_email
        use_near_north = email_analysis.get('use_near_north', False)
        
        # Fallback 1: check customs_broker field for Near North
        if not use_near_north:
            customs_broker = str(email_analysis.get('customs_broker') or '').upper()
            use_near_north = 'NEAR NORTH' in customs_broker or 'NEARNORTH' in customs_broker
        
        # Fallback 2: check email raw text for "Brokerage: Near North" pattern
        if not use_near_north and email_raw_text:
            # Check for "Broker: Near North and by Exporter" pattern
            broker_by_exporter_match = re.search(
                r'[Bb]roker\s*:?\s*([Nn]ear\s+[Nn]orth|[Nn]earnorth)\s+(?:and\s+)?by\s+[Ee]xporter',
                email_raw_text,
                re.IGNORECASE
            )
            if broker_by_exporter_match:
                use_near_north = True
                print(f"DEBUG CI: ✅ Found 'Broker: Near North and by Exporter' pattern in email - setting use_near_north flag")
            
            # Check for "Broker on the Exporter" pattern
            if not use_near_north:
                broker_on_exporter_match = re.search(
                    r'[Bb]roker\s+on\s+(?:the\s+)?[Ee]xporter\s+(?:and\s+)?using\s+([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
                    email_raw_text,
                    re.IGNORECASE
                )
                if broker_on_exporter_match:
                    use_near_north = True
                    print(f"DEBUG CI: ✅ Found 'Broker on the Exporter and using Near North' pattern in email - setting use_near_north flag")
            
            # Check for "Brokerage: Near North" or "Broker: Near North" pattern
            if not use_near_north:
                brokerage_near_north_match = re.search(
                    r'(?:[Bb]rokerage|[Bb]roker)\s*:?\s*([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
                    email_raw_text,
                    re.IGNORECASE
                )
                if brokerage_near_north_match:
                    use_near_north = True
                    print(f"DEBUG CI: ✅ Found 'Brokerage: Near North' pattern in email - setting use_near_north flag")
        
        # Fallback 3: check combined_text for Near North mentions
        if not use_near_north and combined_text:
            combined_upper = combined_text.upper()
            if 'NEAR NORTH' in combined_upper or 'NEARNORTH' in combined_upper:
                # Only set if it's in a broker context (not just random mention)
                if any(kw in combined_upper for kw in ['BROKER', 'BROKERAGE', 'CUSTOMS', 'CLEARANCE']):
                    use_near_north = True
                    print(f"DEBUG CI: Found Near North in broker context - setting use_near_north flag")
    
    # FINAL CHECK: Georgia Western always uses Near North
    if is_georgia_western and not use_near_north:
        use_near_north = True
        print(f"DEBUG CI: ✅ Georgia Western customer detected - forcing use_near_north flag")
    
    # CRITICAL DEBUG: Log final state for multi-SO troubleshooting
    print(f"DEBUG CI: 🔍 Broker Detection FINAL STATE:")
    print(f"   is_multi_so: {so_data.get('is_multi_so', False)}")
    print(f"   customer_name: '{customer_name}'")
    print(f"   is_georgia_western: {is_georgia_western}")
    print(f"   use_near_north: {use_near_north}")
    print(f"   email_analysis present: {email_analysis is not None}")
    if email_analysis:
        print(f"   email_analysis.use_near_north: {email_analysis.get('use_near_north', 'NOT SET')}")
        print(f"   email_analysis.customs_broker: {email_analysis.get('customs_broker', 'NOT SET')}")
        print(f"   email_analysis.raw_text length: {len(email_analysis.get('raw_text', ''))}")
    print(f"DEBUG CI: 🔍 Broker Detection:")
    print(f"   email_analysis present: {email_analysis is not None}")
    if email_analysis:
        print(f"   email_analysis keys: {list(email_analysis.keys())}")
        print(f"   use_near_north flag: {email_analysis.get('use_near_north', 'NOT SET')}")
        print(f"   customs_broker: {email_analysis.get('customs_broker', 'NOT SET')}")
        print(f"   raw_text present: {'raw_text' in email_analysis}")
        print(f"   raw_text length: {len(email_analysis.get('raw_text', ''))}")
        if email_analysis.get('raw_text'):
            raw_preview = email_analysis.get('raw_text', '')[:200]
            print(f"   raw_text preview: {raw_preview}...")
    else:
        print(f"   NO EMAIL ANALYSIS PROVIDED!")
    print(f"   Final use_near_north: {use_near_north}")
    
    # CUSTOMS BROKER FIELDS (top-right section)
    # PRIORITY 1: AEC orders use Farrow broker
    if is_aec_order:
        field_values['brokerCompany'] = 'Farrow'
        field_values['brokerPhone'] = '734-955-7799'
        field_values['brokerFax'] = '877-632-7769'
        field_values['brokerPaps'] = 'uscustomsdocs365@farrow.com, Taylor.paps@farrow.com, USCustomssupport@farrow.com'
        field_values['irsNumber'] = '06-1589396'  # AEC IRS number
        field_values['brokerage'] = 'Farrow | Account #: AECGR001'  # Override brokerage field
        print(f"DEBUG CI: AEC order detected - using Farrow broker (Account: AECGR001)")
    # PRIORITY 2: Use Near North when use_near_north flag is set
    # This covers: Near North mentioned in email, prepaid brokerage, Georgia Western
    elif use_near_north:
        # We handle customs - use our broker
        field_values['brokerCompany'] = 'Near North Customs Brokers US Inc'
        field_values['brokerPhone'] = '716-204-4020'
        field_values['brokerFax'] = '716-204-5551'
        field_values['brokerPaps'] = 'ENTRY@NEARNORTHUS.COM'
        field_values['brokerage'] = 'Near North Customs Brokers'
        
        # DIRECT FILL - Don't rely on generic loop, fill broker fields NOW
        broker_company_field = soup.find(id='brokerCompany')
        print(f"DEBUG: brokerCompany field found: {broker_company_field is not None}")
        if broker_company_field:
            broker_company_field['value'] = 'Near North Customs Brokers US Inc'
            print(f"DEBUG: Set brokerCompany value to: {broker_company_field.get('value')}")
        
        broker_phone_field = soup.find(id='brokerPhone')
        print(f"DEBUG: brokerPhone field found: {broker_phone_field is not None}")
        if broker_phone_field:
            broker_phone_field['value'] = '716-204-4020'
            print(f"DEBUG: Set brokerPhone value to: {broker_phone_field.get('value')}")
        
        broker_fax_field = soup.find(id='brokerFax')
        print(f"DEBUG: brokerFax field found: {broker_fax_field is not None}")
        if broker_fax_field:
            broker_fax_field['value'] = '716-204-5551'
            print(f"DEBUG: Set brokerFax value to: {broker_fax_field.get('value')}")
        
        broker_paps_field = soup.find(id='brokerPaps')
        print(f"DEBUG: brokerPaps field found: {broker_paps_field is not None}")
        if broker_paps_field:
            broker_paps_field.string = 'ENTRY@NEARNORTHUS.COM'
            print(f"DEBUG: Set brokerPaps to: ENTRY@NEARNORTHUS.COM")
        
        brokerage_field = soup.find(id='brokerage')
        print(f"DEBUG: brokerage field found: {brokerage_field is not None}")
        if brokerage_field:
            brokerage_field['value'] = 'Near North Customs Brokers'
            print(f"DEBUG: Set brokerage value to: {brokerage_field.get('value')}")
        
        # Set duty account to EXPORTER
        exporter_radio = soup.find(id='dutyExporter')
        print(f"DEBUG: dutyExporter radio found: {exporter_radio is not None}")
        if exporter_radio:
            exporter_radio['checked'] = 'checked'
            print(f"DEBUG: Set dutyExporter checked")
        
        print(f"DEBUG CI: ✅ FILLED Near North broker info directly into HTML")
    elif extracted_broker:
        # Customer specified broker - fill company name
        field_values['brokerCompany'] = extracted_broker
        field_values['brokerPhone'] = ''
        field_values['brokerFax'] = ''
        
        # Special case: AXEL FRANCE with BBL CARGO - add specific email addresses
        customer_name = so_data.get('customer_name', '') or so_data.get('company_name', '') or ''
        is_axel_france = 'AXEL' in customer_name.upper() and 'FRANCE' in customer_name.upper()
        is_bbl_cargo = 'BBL' in extracted_broker.upper() or 'BBL CARGO' in extracted_broker.upper()
        
        if is_axel_france and is_bbl_cargo:
            # AXEL FRANCE uses BBL CARGO with specific email addresses
            field_values['brokerPaps'] = 'greve.victor@bbl-cargo.com, bocquet.julie@bbl-cargo.com, cheminel.christian@bbl-cargo.com, bertin.arnaud@bbl-cargo.com, mallard.camille@bbl-cargo.com'
            print(f"DEBUG CI: AXEL FRANCE with BBL CARGO - added specific email addresses")
        else:
            field_values['brokerPaps'] = ''
        
        print(f"DEBUG CI: Customer broker in top-right: {extracted_broker}")
    else:
        # Leave blank for other customers (they use their own broker)
        field_values['brokerCompany'] = ''
        field_values['brokerPhone'] = ''
        field_values['brokerFax'] = ''
        field_values['brokerPaps'] = ''
    
    # DUTY/BROKERAGE ACCOUNT: Who pays for duties and brokerage fees?
    # - EXPORTER (Canoil) when we handle brokerage (Near North, prepaid, Georgia Western)
    # - CONSIGNEE (customer) when they use their own broker
    if is_aec_order:
        # AEC uses Farrow - customer pays their own broker
        field_values['dutyAccount'] = 'consignee'
        print(f"DEBUG CI: Duty account = CONSIGNEE (AEC uses their Farrow broker)")
    elif use_near_north:
        # Canoil handles brokerage - we pay (EXPORTER)
        field_values['dutyAccount'] = 'exporter'
        print(f"DEBUG CI: Duty account = EXPORTER (Canoil handles brokerage)")
    else:
        # Customer uses their own broker - they pay (CONSIGNEE)
        field_values['dutyAccount'] = 'consignee'
        print(f"DEBUG CI: Duty account = CONSIGNEE (customer handles their own broker)")
    
    field_values['discounts'] = ''  # Leave empty for manual entry
    field_values['portOfEntry'] = ''  # Leave empty for manual entry
    
    # Terms of Sale (Incoterms) - ALWAYS leave empty for manual entry
    field_values['termsOfSale'] = ''
    print(f"DEBUG CI: Terms of Sale left empty for manual entry")
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
    
    # NOTE: Grand total will be calculated AFTER items are processed (after steel separation)
    # This ensures the total matches the actual line items shown on the invoice
    # See below where physical_items is finalized
    
    if total_freight > 0:
        print(f"DEBUG: CI - Total Freight added to field_values: ${total_freight:.2f}")
    if total_brokerage > 0:
        print(f"DEBUG: CI - Total Brokerage added to field_values: ${total_brokerage:.2f}")
    
    
    # DEBUG: Show broker field values before population
    print(f"\n🔍 BROKER FIELDS DEBUG:")
    print(f"   brokerCompany: '{field_values.get('brokerCompany', 'NOT SET')}'")
    print(f"   brokerPhone: '{field_values.get('brokerPhone', 'NOT SET')}'")
    print(f"   brokerFax: '{field_values.get('brokerFax', 'NOT SET')}'")
    print(f"   brokerPaps: '{field_values.get('brokerPaps', 'NOT SET')}'")
    print(f"   brokerage: '{field_values.get('brokerage', 'NOT SET')}'")
    print(f"   dutyAccount: '{field_values.get('dutyAccount', 'NOT SET')}'")
    
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
    
    # Hide Phone and Fax fields when BBL CARGO emails are present (to save space)
    # Also increase font size for BBL emails
    broker_paps = field_values.get('brokerPaps', '')
    if broker_paps and '@bbl-cargo.com' in broker_paps.lower():
        phone_row = soup.find(id='brokerPhoneRow')
        fax_row = soup.find(id='brokerFaxRow')
        if phone_row:
            phone_row['style'] = 'display: none;'
        if fax_row:
            fax_row['style'] = 'display: none;'
        # Increase font size for BBL emails
        broker_paps_textarea = soup.find(id='brokerPaps')
        if broker_paps_textarea:
            current_style = broker_paps_textarea.get('style', '')
            # Update font-size to 11px for BBL emails
            if 'font-size:' in current_style:
                current_style = re.sub(r'font-size:\s*\d+px', 'font-size: 11px', current_style)
            else:
                current_style += ' font-size: 11px;'
            broker_paps_textarea['style'] = current_style
        print(f"DEBUG CI: BBL CARGO emails detected - hiding Phone/Fax and increasing font size")
    
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
    
    # Duty/Brokerage Account - who pays for duties and brokerage
    duty_account = field_values.get('dutyAccount', 'consignee')
    if duty_account == 'exporter':
        exporter_radio = soup.find('input', {'id': 'dutyExporter'})
        if exporter_radio:
            exporter_radio['checked'] = 'checked'
        print(f"DEBUG CI: Set duty account radio = EXPORTER")
    else:
        consignee_radio = soup.find('input', {'id': 'dutyConsignee'})
        if consignee_radio:
            consignee_radio['checked'] = 'checked'
        print(f"DEBUG CI: Set duty account radio = CONSIGNEE")
    
    # Freight Terms - removed from Commercial Invoice (leave empty)
    
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
    # Sample pails (mentioned in email but not on SO) are added to steel pail count.
    sample_pail_count = so_data.get('sample_pail_count', 0)
    
    # Check if AEC order (uses liter conversion)
    customer_name = so_data.get('customer_name', '').upper()
    is_aec = 'AEC' in customer_name
    
    print(f"\n>> Processing steel container separation for {len(physical_items)} items...")
    print(f"   Customer: {customer_name}, Is AEC: {is_aec}")
    if sample_pail_count > 0:
        print(f"   (Including {sample_pail_count} sample pail(s) in steel count)")
    adjusted_items, steel_items = process_items_with_steel_separation(physical_items, sample_pail_count, is_aec)
    
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
    
    # Calculate grand total from ACTUAL line items shown (not SO total which includes freight/brokerage)
    calculated_grand_total = 0.0
    for item in physical_items:
        item_qty = float(item.get('quantity', 0))
        item_price = float(item.get('unit_price', 0))
        item_total = item_qty * item_price
        calculated_grand_total += item_total
        print(f"   Item total: {item.get('description', '')[:30]} = {item_qty} x ${item_price:.2f} = ${item_total:.2f}")
    
    field_values['grandTotal'] = f"${calculated_grand_total:,.2f}"
    print(f">> Calculated Grand Total from line items: ${calculated_grand_total:,.2f}")
    
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
            description = str(item.get('description', ''))
            unit = str(item.get('unit', ''))
            item_code = str(item.get('item_code', ''))
            # Enhance descriptions for cross-border CI (ANDEROL FGCS-2, MOV, etc.)
            description = enhance_description_for_ci(description, unit, item_code)
            # Set rows to match content - no extra space
            line_count = description.count('\n') + 1
            desc_textarea = soup.new_tag('textarea', **{'class': 'item-description'}, rows=str(line_count))
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
            
            # Unit Quantity cell - format as "6000 L" or "361 Pail"
            qty_cell = soup.new_tag('td')
            qty_input = soup.new_tag('input', type='text', **{'class': 'unit-qty'}, 
                                   onchange='calculateItemTotal(this)')
            qty_value = item.get('quantity', 0)
            unit_value = item.get('unit', '')
            # Format qty with unit (e.g. "6,000 L" or "361 Pail")
            try:
                qty_num = float(qty_value)
                if qty_num == int(qty_num):
                    qty_formatted = f"{int(qty_num):,}"
                else:
                    qty_formatted = f"{qty_num:,.1f}"
            except:
                qty_formatted = str(qty_value)
            qty_input['value'] = f"{qty_formatted} {unit_value}".strip()
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
        
        // Only calculate grand total if not already set by backend (SO total takes priority)
        let grandTotalElem = document.getElementById('grandTotal');
        if (grandTotalElem && !grandTotalElem.value) {
            // No pre-set value, calculate from items
            let grandTotal = 0;
            document.querySelectorAll('.item-total').forEach(function(totalInput) {
                if (totalInput.value) {
                    let value = parseFloat(totalInput.value.replace(/[$,]/g, '')) || 0;
                    grandTotal += value;
                }
            });
            if (grandTotal > 0) {
                grandTotalElem.value = '$' + grandTotal.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
            }
        }
        // If grandTotal already has a value from SO, keep it (don't recalculate)
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
