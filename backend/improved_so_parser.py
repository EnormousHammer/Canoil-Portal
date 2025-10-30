# Improved SO Parser for better data extraction
import re
import pdfplumber
import os
from typing import Dict, Any, List

def extract_so_data_enhanced(pdf_path: str) -> Dict[str, Any]:
    """Enhanced SO data extraction with better pattern matching"""
    
    so_data = {
        'so_number': '',
        'customer_name': '',
        'billing_address': {},
        'shipping_address': {},
        'order_details': {
            'order_date': '',
            'ship_date': '',
            'po_number': '',
            'business_number': '',
            'terms': ''
        },
        'items': [],
        'financial': {
            'subtotal': 0.0,
            'tax': 0.0,
            'total_amount': 0.0,
            'currency': 'CAD'
        },
        'special_instructions': '',
        'status': 'Found in system',
        'file_path': pdf_path
    }
    
    try:
        # Extract text using pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
        
        # Extract SO number from filename first
        filename = os.path.basename(pdf_path)
        so_match = re.search(r'salesorder[_\s]*(\d+)', filename, re.IGNORECASE)
        if so_match:
            so_data['so_number'] = so_match.group(1)
        
        # Parse line by line for better accuracy
        lines = full_text.split('\n')
        
        # Extract customer name and addresses
        sold_to_started = False
        ship_to_started = False
        billing_lines = []
        shipping_lines = []
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            
            # Look for Sold To section
            if 'Sold To:' in line:
                sold_to_started = True
                ship_to_started = False
                continue
                
            # Look for Ship To section
            if 'Ship To:' in line:
                sold_to_started = False
                ship_to_started = True
                continue
                
            # Collect address lines
            if sold_to_started and line_stripped and not any(x in line for x in ['Date:', 'Accounts Payable']):
                billing_lines.append(line_stripped)
                if len(billing_lines) >= 4:  # Usually company, address, city/prov, country
                    sold_to_started = False
                    
            if ship_to_started and line_stripped and not any(x in line for x in ['Date:', 'Ship Date:']):
                shipping_lines.append(line_stripped)
                if len(shipping_lines) >= 4:
                    ship_to_started = False
        
        # Parse billing address
        if billing_lines:
            so_data['customer_name'] = billing_lines[0]
            so_data['billing_address'] = {
                'company': billing_lines[0],
                'address': billing_lines[1] if len(billing_lines) > 1 else '',
                'city': '',
                'province': '',
                'postal_code': '',
                'country': billing_lines[-1] if len(billing_lines) > 3 else 'Canada'
            }
            
            # Parse city/province/postal from third line
            if len(billing_lines) > 2:
                city_line = billing_lines[2]
                # Pattern: "City, Province PostalCode"
                city_match = re.match(r'([^,]+),\s*([A-Z]{2})\s+([A-Z]\d[A-Z]\s*\d[A-Z]\d)', city_line)
                if city_match:
                    so_data['billing_address']['city'] = city_match.group(1)
                    so_data['billing_address']['province'] = city_match.group(2)
                    so_data['billing_address']['postal_code'] = city_match.group(3)
        
        # Parse shipping address
        if shipping_lines:
            so_data['shipping_address'] = {
                'company': shipping_lines[0],
                'address': shipping_lines[1] if len(shipping_lines) > 1 else '',
                'city': '',
                'province': '',
                'postal_code': '',
                'country': shipping_lines[-1] if len(shipping_lines) > 3 else 'Canada'
            }
            
            if len(shipping_lines) > 2:
                city_line = shipping_lines[2]
                city_match = re.match(r'([^,]+),\s*([A-Z]{2})\s+([A-Z]\d[A-Z]\s*\d[A-Z]\d)', city_line)
                if city_match:
                    so_data['shipping_address']['city'] = city_match.group(1)
                    so_data['shipping_address']['province'] = city_match.group(2)
                    so_data['shipping_address']['postal_code'] = city_match.group(3)
        
        # Extract dates
        date_match = re.search(r'Date:\s*(\d{2}/\d{2}/\d{2})', full_text)
        if date_match:
            so_data['order_details']['order_date'] = date_match.group(1)
            
        ship_date_match = re.search(r'Ship Date:\s*(\d{2}/\d{2}/\d{2})', full_text)
        if ship_date_match:
            so_data['order_details']['ship_date'] = ship_date_match.group(1)
        
        # Extract PO number - look in multiple places
        # First check for PO in comments/notes section
        po_patterns = [
            r'(?:^|\n)\s*PO\s+(\d+)',  # PO at start of line
            r'PO\s*#?\s*:?\s*(\d+)',    # Various PO formats
            r'Purchase Order\s*:?\s*(\d+)',
            r'Customer PO\s*:?\s*(\d+)'
        ]
        
        for pattern in po_patterns:
            po_match = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
            if po_match:
                so_data['order_details']['po_number'] = po_match.group(1)
                break
                
        # If still no PO, check in special instructions area
        if not so_data['order_details']['po_number']:
            # Look for lines that might contain PO info
            for line in lines:
                if 'PO' in line and re.search(r'\d{5,}', line):  # PO with at least 5 digits
                    po_num_match = re.search(r'(\d{5,})', line)
                    if po_num_match:
                        so_data['order_details']['po_number'] = po_num_match.group(1)
                        break
        
        # Extract items
        items = []
        in_items_section = False
        
        for i, line in enumerate(lines):
            # Start of items section
            if 'Item No.' in line and 'Description' in line:
                in_items_section = True
                continue
                
            # End of items section
            if in_items_section and any(x in line for x in ['Subtotal:', 'E-mail', 'Comments:']):
                break
                
            # Parse item lines
            if in_items_section and line.strip():
                # Enhanced pattern for various item formats
                # Format: ITEM_CODE QTY UNIT DESCRIPTION [TAX] PRICE TOTAL
                parts = line.split()
                if len(parts) >= 4:
                    # Try to identify the pattern
                    if re.match(r'^[A-Z0-9-]+$', parts[0]):  # Likely item code
                        item = {
                            'item_code': parts[0],
                            'quantity': '',
                            'unit': '',
                            'description': '',
                            'unit_price': 0.0,
                            'total_price': 0.0
                        }
                        
                        # Find quantity (number) - look for first numeric part
                        for j, part in enumerate(parts[1:], 1):
                            if re.match(r'^\d+$', part):
                                item['quantity'] = int(part)
                                
                                # Next part is usually unit (e.g., DR5, CASE60, etc.)
                                if j+1 < len(parts):
                                    # Unit might be combined with number (CASE60) or separate (DR 5)
                                    unit_part = parts[j+1]
                                    if re.match(r'^[A-Z]+\d*$', unit_part):
                                        item['unit'] = unit_part
                                        desc_start = j+2
                                    else:
                                        # Check if it's a split unit like "DR" "5"
                                        if re.match(r'^[A-Z]+$', unit_part) and j+2 < len(parts) and re.match(r'^\d+$', parts[j+2]):
                                            item['unit'] = unit_part + parts[j+2]
                                            desc_start = j+3
                                        else:
                                            item['unit'] = 'EA'  # Default unit
                                            desc_start = j+1
                                    
                                    # Find description and prices
                                    desc_parts = []
                                    price_indices = []
                                    
                                    # Scan for price patterns (numbers with decimals or large numbers)
                                    for k in range(desc_start, len(parts)):
                                        part_clean = parts[k].replace(',', '')
                                        if re.match(r'^\d+\.?\d*$', part_clean):
                                            # This looks like a price
                                            try:
                                                num_val = float(part_clean)
                                                # Prices are usually > 1.00 or whole numbers > 100
                                                if num_val >= 1.0:
                                                    price_indices.append(k)
                                            except:
                                                pass
                                        elif k < len(parts) - 2:  # Not in the last positions where prices usually are
                                            desc_parts.append(parts[k])
                                    
                                    # Set description
                                    if desc_parts:
                                        item['description'] = ' '.join(desc_parts)
                                    
                                    # Extract prices - usually last two numbers are unit price and total
                                    if len(price_indices) >= 2:
                                        # Last price is total, second-to-last is unit price
                                        item['total_price'] = float(parts[price_indices[-1]].replace(',', ''))
                                        item['unit_price'] = float(parts[price_indices[-2]].replace(',', ''))
                                    elif len(price_indices) == 1:
                                        # Only one price found, assume it's total
                                        item['total_price'] = float(parts[price_indices[0]].replace(',', ''))
                                        if item['quantity'] > 0:
                                            item['unit_price'] = item['total_price'] / item['quantity']
                                            
                                break
                        
                        if item['description']:  # Only add if we parsed something
                            items.append(item)
        
        so_data['items'] = items
        
        # Extract financial totals
        # Subtotal
        subtotal_match = re.search(r'Subtotal[:\s]+([\d,]+\.?\d*)', full_text)
        if subtotal_match:
            so_data['financial']['subtotal'] = float(subtotal_match.group(1).replace(',', ''))
            
        # Tax (HST)
        tax_match = re.search(r'HST[:\s]+([\d,]+\.?\d*)', full_text)
        if tax_match:
            so_data['financial']['tax'] = float(tax_match.group(1).replace(',', ''))
            
        # Total
        total_match = re.search(r'Total Amount[:\s]+([\d,]+\.?\d*)', full_text)
        if total_match:
            so_data['financial']['total_amount'] = float(total_match.group(1).replace(',', ''))
        elif so_data['financial']['subtotal'] > 0:
            so_data['financial']['total_amount'] = so_data['financial']['subtotal'] + so_data['financial']['tax']
        
        # Extract special instructions/comments
        comments_section = False
        comments_lines = []
        for line in lines:
            if 'Comments:' in line:
                comments_section = True
                continue
            if comments_section and line.strip():
                if 'Subtotal' in line or 'Total Amount' in line:
                    break
                comments_lines.append(line.strip())
        
        if comments_lines:
            so_data['special_instructions'] = '\n'.join(comments_lines)
            
            # Check for PO in comments if not found yet
            if not so_data['order_details']['po_number']:
                for comment_line in comments_lines:
                    if 'PO' in comment_line:
                        po_in_comment = re.search(r'PO\s*(\d+)', comment_line)
                        if po_in_comment:
                            so_data['order_details']['po_number'] = po_in_comment.group(1)
                            break
        
        return so_data
        
    except Exception as e:
        print(f"❌ Error in enhanced SO parser: {e}")
        import traceback
        traceback.print_exc()
        return so_data
