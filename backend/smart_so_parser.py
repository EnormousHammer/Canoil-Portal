"""
Smart SO Parser - Extracts data from any SO format without limitations
"""

def parse_so_smart(text):
    """
    Parse SO with maximum flexibility - no fixed patterns or limitations
    Just extract data from sections as they appear
    """
    lines = text.split('\n')
    so_data = {
        'billing_lines': [],
        'shipping_lines': [],
        'all_comments': [],
        'items_area': []
    }
    
    current_section = None
    billing_started = False
    shipping_started = False
    items_started = False
    
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        
        # Section detection - be very flexible
        if 'sold to' in line_lower or 'bill to' in line_lower:
            current_section = 'billing'
            billing_started = True
            continue
            
        if 'ship to' in line_lower:
            current_section = 'shipping'
            shipping_started = True
            # Check if there's text before "ship to" on same line
            if 'ship to:' in line_lower:
                before_ship = line.split('Ship To:')[0].strip()
                if before_ship and current_section == 'billing':
                    # Add any text before "Ship To:" to billing
                    so_data['billing_lines'].append(before_ship)
            continue
            
        if any(word in line_lower for word in ['item no', 'description', 'ordered']) and 'unit' in line_lower:
            current_section = 'items'
            items_started = True
            so_data['items_area'].append(line)
            continue
        
        # Collect lines based on current section
        if current_section == 'billing' and line.strip():
            # Stop if we hit another section marker
            if any(marker in line_lower for marker in ['ship to:', 'item no', 'comment:']):
                # Extract text before the marker
                if 'ship to:' in line_lower:
                    before = line.split('Ship To:')[0].strip()
                    if before:
                        so_data['billing_lines'].append(before)
                current_section = None
            else:
                so_data['billing_lines'].append(line.strip())
                
        elif current_section == 'shipping' and line.strip():
            # Stop at next section
            if any(marker in line_lower for marker in ['item no', 'comment:', 'subtotal']):
                current_section = None
            else:
                so_data['shipping_lines'].append(line.strip())
                
        elif current_section == 'items':
            # Collect everything in items area
            so_data['items_area'].append(line)
            
        # Collect comments from anywhere
        if 'comment:' in line_lower:
            so_data['all_comments'].append(line.strip())
            
    return so_data


def extract_company_name(lines):
    """Extract company name from address lines - be smart about it"""
    for line in lines:
        # Look for company indicators
        if any(indicator in line for indicator in ['Ltd', 'Inc', 'Corp', 'Co.', 'Company', 'LLC']):
            return line
    return None


def format_address(lines):
    """Format address lines into a single string"""
    return '\n'.join(lines)


# Test it
if __name__ == "__main__":
    test_text = """
Sold To:
Central Warehouse
1600 Drew Rd, Dept: CW
Mississauga, ON  L5S 1S5Canadian Bearings Ltd.Ship To:
Canadian Bearings Ltd.
Dept CW
1600 Drew Road
Mississauga, ON  L5S 1S5
Canada
Comment: PO: PO-10-1075631Terms: Net 30. Due 10/05/25.Business No.: 81751 0654Ship Date: 09/19/25
Item No. Ordered Unit Description Tax Unit Price Amount
REOL46XCDRM 8 DRUM REOLUBE 46XC DRUM H 11,046.58 88,372.64
Ship Via Manitoulin COLLECT 4337
***CHEMRISK LABEL - RED***
-SDS
-SHELF LIFE
-COA
"""
    
    result = parse_so_smart(test_text)
    print("=== SMART PARSING RESULTS ===")
    print(f"\nBilling lines: {result['billing_lines']}")
    print(f"\nShipping lines: {result['shipping_lines']}")
    print(f"\nComments: {result['all_comments']}")
    print(f"\nItems area has {len(result['items_area'])} lines")
    
    # Extract company names
    billing_company = extract_company_name(result['billing_lines'])
    shipping_company = extract_company_name(result['shipping_lines'])
    
    print(f"\nBilling company: {billing_company}")
    print(f"Shipping company: {shipping_company}")
