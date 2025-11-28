"""
USMCA HTS Code Validator
Checks if item HTS codes are valid for USMCA Certificate of Origin
"""

# HTS codes that are approved/listed on Canoil's USMCA Certificate
# These are the products that qualify for USMCA preferential tariff treatment
# Source: SIGNED USMCA FORM.pdf (All HTS codes from certificate)
APPROVED_USMCA_HTS_CODES = {
    # Petroleum Lubricating Greases - 2710.19.3500
    '2710.19.3500': {
        'description': 'Petroleum Lubricating Grease',
        'products': ['MOV Extra', 'MOV Long Life', 'MOV LL', 'Anderol 86EP-2 Lubricating Grease']
    },
    
    # Petroleum Oils - 2710.19.3080
    '2710.19.3080': {
        'description': 'Petroleum Oils',
        'products': ['Petro Canada Purity 2204', 'Petro Canada Spray Oil 10/13/15/22', 
                     'Xiameter PMX 200', 'VanFlex DIDP Lube Oil', 'Naugalube-750', 
                     'Anderol 555 Synthetic Compressor/Vacuum Oil']
    },
    
    # Base Oils - 2710.19.4590
    '2710.19.4590': {
        'description': 'Base oils (Cansol, Canox)',
        'products': ['Cansol 2, 35 & 70 base oil', 'Canox 02']
    },
    
    # Empty Metal Drums - 7310.10.0015
    '7310.10.0015': {
        'description': 'Empty Metal Drum',
        'products': ['Empty Metal Drum']
    },
    
    # Heat Transfer Fluids - 3811.21.0000
    '3811.21.0000': {
        'description': 'Heat transfer fluids',
        'products': ['Duratherm Heat Transfer Systems Fluids']
    },
    
    # Fuel System Cleaning Solutions - 3811.90
    '3811.90': {
        'description': 'Fuel system cleaning solutions',
        'products': ['Advantage Diesel Fuel System Cleaning Solution', 
                     'Advantage Petrol Fuel Systems Cleaning Solution']
    },
    
    # Engine Flush Solutions - 3403.19
    '3403.19': {
        'description': 'Engine flush and lubricating oils',
        'products': ['Engine Flush Solution RDS Lubricating Oil']
    },
    
    # Biodegradable Greases - 3403.19.5000
    '3403.19.5000': {
        'description': 'Biodegradable greases',
        'products': ['VSG Biodegradable Canola-Oil Based Grease']
    }
}


def is_hts_code_on_usmca(hts_code: str) -> bool:
    """
    Check if an HTS code is approved on the USMCA certificate
    
    Args:
        hts_code: The HTS code to check
        
    Returns:
        True if the HTS code is on the USMCA certificate, False otherwise
    """
    if not hts_code:
        return False
    
    # Clean the HTS code
    cleaned_code = str(hts_code).strip()
    
    # Check exact match
    if cleaned_code in APPROVED_USMCA_HTS_CODES:
        return True
    
    # Check partial match (some codes may have additional digits)
    for approved_code in APPROVED_USMCA_HTS_CODES.keys():
        if cleaned_code.startswith(approved_code):
            return True
    
    return False


def get_usmca_info_for_hts(hts_code: str) -> dict:
    """
    Get USMCA information for a given HTS code
    
    Args:
        hts_code: The HTS code to look up
        
    Returns:
        Dictionary with USMCA info, or None if not found
    """
    if not hts_code:
        return None
    
    cleaned_code = str(hts_code).strip()
    
    # Check exact match first
    if cleaned_code in APPROVED_USMCA_HTS_CODES:
        return {
            'hts_code': cleaned_code,
            'on_usmca': True,
            **APPROVED_USMCA_HTS_CODES[cleaned_code]
        }
    
    # Check partial match
    for approved_code, info in APPROVED_USMCA_HTS_CODES.items():
        if cleaned_code.startswith(approved_code):
            return {
                'hts_code': cleaned_code,
                'on_usmca': True,
                **info
            }
    
    return {
        'hts_code': cleaned_code,
        'on_usmca': False,
        'description': 'Not on USMCA certificate',
        'products': []
    }


def check_items_for_usmca(items: list, destination: str = None, so_data: dict = None) -> dict:
    """
    Check if any items have HTS codes that qualify for USMCA
    
    Args:
        items: List of item dictionaries with 'hts_code' field
        destination: Destination country (USA only - USMCA not for Mexico or other countries)
        so_data: Sales order data (for additional context)
        
    Returns:
        Dictionary with USMCA eligibility information
    """
    # USMCA Rule 1: Destination must be USA (not Mexico or other countries)
    if destination:
        dest_upper = destination.upper().strip()
        if dest_upper not in ['USA', 'US', 'UNITED STATES']:
            return {
                'requires_usmca': False,
                'reason': f'USMCA not applicable for destination: {destination} (USMCA only for USA shipments)',
                'matching_items': [],
                'non_matching_items': [],
                'blocked_items': [],
                'total_items_checked': 0
            }
    
    items_with_hts = [item for item in items if item.get('hts_code')]
    
    if not items_with_hts:
        return {
            'requires_usmca': False,
            'reason': 'No items have HTS codes',
            'matching_items': [],
            'non_matching_items': [],
            'blocked_items': [],
            'total_items_checked': 0
        }
    
    matching_items = []
    non_matching_items = []
    blocked_items = []  # HTS approved but COO blocks it
    
    for item in items_with_hts:
        hts_code = item.get('hts_code')
        item_code = item.get('item_code', 'Unknown')
        description = item.get('description', 'Unknown')
        
        # Get COO (Country of Origin)
        coo = item.get('country_of_origin', '') or item.get('origin_country', '')
        
        # USMCA Rule 2: HTS code must be approved
        if is_hts_code_on_usmca(hts_code):
            usmca_info = get_usmca_info_for_hts(hts_code)
            
            # USMCA Rule 3: COO must be CA, US, or MX
            if coo:
                coo_upper = coo.upper().strip()
                if coo_upper in ['CA', 'US', 'MX', 'CANADA', 'USA', 'MEXICO']:
                    # ✅ All 3 rules pass: Destination + HTS + COO
                    matching_items.append({
                        'item_code': item_code,
                        'description': description,
                        'hts_code': hts_code,
                        'country_of_origin': coo,
                        'usmca_category': usmca_info.get('description')
                    })
                else:
                    # ❌ HTS approved but COO not North American
                    blocked_items.append({
                        'item_code': item_code,
                        'description': description,
                        'hts_code': hts_code,
                        'country_of_origin': coo,
                        'reason': f'COO "{coo}" not in CA/US/MX'
                    })
            else:
                # ⚠️ COO missing - treat as blocked (needs review)
                blocked_items.append({
                    'item_code': item_code,
                    'description': description,
                    'hts_code': hts_code,
                    'country_of_origin': 'UNKNOWN',
                    'reason': 'COO not specified - needs review'
                })
        else:
            # HTS not on approved list
            non_matching_items.append({
                'item_code': item_code,
                'description': description,
                'hts_code': hts_code,
                'country_of_origin': coo
            })
    
    requires_usmca = len(matching_items) > 0
    
    # Build detailed reason
    if requires_usmca:
        reason = f'{len(matching_items)} items qualify (HTS + COO + Destination all match)'
    elif blocked_items:
        reason = f'No items qualify: {len(blocked_items)} blocked by COO (not CA/US/MX)'
    else:
        reason = 'No items match USMCA HTS codes'
    
    return {
        'requires_usmca': requires_usmca,
        'reason': reason,
        'matching_items': matching_items,
        'blocked_items': blocked_items,  # New: items blocked by COO
        'non_matching_items': non_matching_items,
        'total_items_checked': len(items_with_hts)
    }

