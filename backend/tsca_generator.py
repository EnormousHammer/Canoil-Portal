"""
TSCA (Toxic Substances Control Act) Certification Generator
Fills TSCA form with items, batch numbers, and HTS codes
"""

import PyPDF2
from PyPDF2 import PdfReader, PdfWriter
from datetime import datetime
import os
from typing import Dict, Any, List

# TSCA template path (with correct address: 62 Todd Road, Georgetown)
TSCA_TEMPLATE = r"G:\Shared drives\IT_Automation\Automating Roles\Logistics\TSCA\TSCA CERTIFICATION_UPDATED.pdf"


def filter_actual_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filter out non-product items like freight, pallet charges, prepay, add, etc."""
    actual_items = []
    
    for item in items:
        description = str(item.get('description', '')).upper()
        
        # Skip non-product items
        if any(keyword in description for keyword in [
            'PALLET', 'FREIGHT', 'BROKERAGE', 'CHARGE', 'FEE', 
            'SURCHARGE', 'HANDLING', 'INSURANCE', 'PREPAY', 
            'PREPAID', 'ADD', 'ADDITIONAL', 'ADJUSTMENT'
        ]):
            continue
        
        actual_items.append(item)
    
    return actual_items


def clean_batch_number_for_tsca(batch: str) -> str:
    """
    Remove quantity indicators from batch numbers for TSCA form
    
    Examples:
        "NT5D14T016 (5)" -> "NT5D14T016"
        "NT5D14T016 (5) + NT5E19T018 (3)" -> "NT5D14T016 + NT5E19T018"
        "2023087285" -> "2023087285"
    
    Args:
        batch: Batch number string (may include quantities in parentheses)
    
    Returns:
        Clean batch number(s) without quantity indicators
    """
    if not batch:
        return ''
    
    import re
    # Remove all parentheses and their contents: (5), (2), etc.
    # This regex matches space + open paren + digits + close paren
    clean_batch = re.sub(r'\s*\(\d+\)', '', batch)
    
    # Clean up any extra spaces
    clean_batch = ' '.join(clean_batch.split())
    
    return clean_batch


def generate_tsca_certification(so_data: Dict[str, Any], items: List[Dict[str, Any]], 
                                 email_analysis: Dict[str, Any] = None) -> tuple:
    """
    Generate TSCA Certification by filling the PDF form
    
    Args:
        so_data: Sales order data
        items: List of items (will be filtered to actual products)
        email_analysis: Email analysis data (for batch numbers)
        
    Returns:
        tuple: (output_filepath, output_filename)
    """
    print("\n" + "="*80)
    print("GENERATING TSCA CERTIFICATION")
    print("="*80)
    
    if not os.path.exists(TSCA_TEMPLATE):
        print(f"ERROR: TSCA template not found at {TSCA_TEMPLATE}")
        return None
    
    # Filter to actual products only
    actual_items = filter_actual_items(items)
    
    if not actual_items:
        print("No actual product items found - skipping TSCA")
        return None
    
    print(f"\n>> Found {len(actual_items)} products for TSCA:")
    
    # Extract batch numbers from email analysis
    batch_numbers = []
    if email_analysis:
        if email_analysis.get('batch_numbers'):
            if isinstance(email_analysis['batch_numbers'], list):
                batch_numbers = email_analysis['batch_numbers']
            elif isinstance(email_analysis['batch_numbers'], str):
                # Split by common separators
                batch_numbers = [b.strip() for b in email_analysis['batch_numbers'].replace(',', ' ').split()]
    
    print(f"   Batch numbers from email: {batch_numbers}")
    
    # Prepare item lines (max 10 products - start from product 1)
    product_lines = []
    
    for idx, item in enumerate(actual_items[:10], 1):  # Max 10 items
        item_code = item.get('item_code', '')
        description = item.get('description', '')
        hts_code = item.get('hts_code', '')
        
        # Get batch number for this item - CHECK ITEM FIRST (handles multiple batches)
        batch = item.get('batch_number', '')  # This can be "NT5D14T016 (5) + NT5E19T018 (3)"
        
        # Fallback to batch_numbers list if item doesn't have batch
        if not batch and idx <= len(batch_numbers):
            batch = batch_numbers[idx - 1]
        
        # Clean batch number for TSCA - remove quantity indicators like (5), (2), etc.
        if batch:
            batch = clean_batch_number_for_tsca(batch)
        
        # Format: Item Description | Batch # XXX | H.T.S. XXX
        # ONLY description (not item code)
        item_desc = description
        
        # Build line parts - ONLY include labels if there's actual data
        line_parts = [item_desc]
        
        # Add batch number if available (already cleaned)
        if batch:
            line_parts.append(f"Batch # {batch}")
        
        # Only add HTS section if we have an HTS code
        if hts_code:
            line_parts.append(f"H.T.S. {hts_code}")
        
        # Join with separator only between parts that exist
        line = ' | '.join(line_parts)
        product_lines.append(line)
        
        print(f"   Item {idx}: {line}")
    
    # Read the template PDF
    print(f"\n>> Reading template: {TSCA_TEMPLATE}")
    reader = PdfReader(TSCA_TEMPLATE)
    writer = PdfWriter()
    
    # Copy page
    writer.add_page(reader.pages[0])
    
    # Prepare form fields to update
    # DO NOT CHANGE pre-filled fields (company name, address, certifier info, etc.)
    # Set date to current date automatically
    current_date = datetime.now().strftime('%Y-%m-%d')
    
    fields_to_update = {
        'date': current_date,  # Auto-fill with current date
        'reference number': f"SO {so_data.get('so_number', '')}"
    }
    
    # Add product lines (product 1-10, start with actual items)
    for idx, line in enumerate(product_lines, 1):
        field_name = f'product {idx}'
        fields_to_update[field_name] = line
    
    # Clear any remaining product fields
    for idx in range(len(product_lines) + 1, 11):
        field_name = f'product {idx}'
        fields_to_update[field_name] = ''
    
    print(f"\n>> Updating fields:")
    print(f"   Date: {current_date} (auto-filled with current date)")
    print(f"   Reference: SO {so_data.get('so_number', '')}")
    print(f"   Products filled: {len(product_lines)}")
    
    # Update form fields
    writer.update_page_form_field_values(
        writer.pages[0],
        fields_to_update
    )
    
    # Generate output filename
    so_number = so_data.get('so_number', 'Unknown')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f"TSCA_Certification_SO{so_number}_{timestamp}.pdf"
    # Use absolute path to avoid nested directory issues
    from logistics_automation import get_uploads_dir
    uploads_dir = get_uploads_dir()
    output_filepath = os.path.join(uploads_dir, output_filename)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_filepath), exist_ok=True)
    
    # Write output PDF
    with open(output_filepath, 'wb') as output_file:
        writer.write(output_file)
    
    print(f"\n✅ TSCA Certification generated: {output_filename}")
    print("="*80 + "\n")
    
    return (output_filepath, output_filename)


if __name__ == '__main__':
    # Test the generator
    test_so_data = {
        'so_number': '2994'
    }
    
    test_items = [
        {
            'item_code': 'REOL46XC',
            'description': 'REOLUBE TURBOFLUID 46XC DRUM 247KG',
            'hts_code': '3819.00.0090',
            'quantity': 32
        }
    ]
    
    test_email = {
        'batch_numbers': ['2023087285']
    }
    
    result = generate_tsca_certification(test_so_data, test_items, test_email)
    print(f"\nTest result: {result}")

