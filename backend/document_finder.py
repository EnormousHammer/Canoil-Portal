"""
Document Finder for Dangerous Goods Shipments
Finds latest SDS and COFA files for products
"""

import os
import re
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from pathlib import Path


# Paths to document folders
SDS_FOLDER = r"G:\Shared drives\RnD_Technical\SDS Sheets"
COFA_FOLDER = r"G:\Shared drives\Production_Inventory\Certificates of Analysis"


def normalize_product_name(name: str) -> str:
    """
    Normalize product name for matching
    REOL46XCDRM → REOLUBE 46XC
    REOL32BGTDRM → REOLUBE 32B GT
    """
    name = name.upper().strip()
    
    # Handle REOLUBE variants
    if 'REOL' in name:
        # Extract the base product code
        if '46XC' in name:
            return 'REOLUBE 46XC'
        elif '46B' in name:
            return 'REOLUBE 46B'
        elif '32BGT' in name or '32B GT' in name:
            return 'REOLUBE 32B GT'
    
    # Remove common suffixes
    name = re.sub(r'(DRUM|DRM|PAIL|TOTE|KEG)$', '', name).strip()
    
    return name


def extract_date_from_filename(filename: str) -> Optional[datetime]:
    """
    Extract date from filename to determine latest version
    Handles formats like:
    - SDS_REOLUBE_46XC_2024-10-13.pdf
    - REOLUBE_46XC_20241013.pdf
    - COFA_REOL46XC_2023087285_2024-10-13.pdf
    """
    # Try different date patterns
    patterns = [
        r'(\d{4}[-_]\d{2}[-_]\d{2})',  # YYYY-MM-DD or YYYY_MM_DD
        r'(\d{8})',                      # YYYYMMDD
        r'(\d{4}[-_]\d{1,2}[-_]\d{1,2})', # Flexible month/day
    ]
    
    for pattern in patterns:
        match = re.search(pattern, filename)
        if match:
            date_str = match.group(1).replace('_', '-')
            try:
                # Try parsing different formats
                for fmt in ['%Y-%m-%d', '%Y%m%d']:
                    try:
                        return datetime.strptime(date_str.replace('-', ''), '%Y%m%d')
                    except:
                        continue
            except:
                continue
    
    # If no date in filename, use file modification time
    return None


def find_latest_sds(product_name: str) -> Optional[str]:
    """
    Find the latest SDS file for a product
    
    Args:
        product_name: Product name (e.g., "REOL46XCDRM" or "REOLUBE 46XC")
    
    Returns:
        Full path to latest SDS file, or None if not found
    """
    print(f"\n[SDS SEARCH] Searching for SDS: {product_name}")
    
    if not os.path.exists(SDS_FOLDER):
        print(f"   [X] SDS folder not found: {SDS_FOLDER}")
        return None
    
    normalized_product = normalize_product_name(product_name)
    print(f"   Normalized product name: {normalized_product}")
    
    # Search patterns for the product
    search_patterns = [
        normalized_product,
        product_name.upper().replace('DRUM', '').replace('DRM', '').strip(),
    ]
    
    # Add specific patterns for REOLUBE (match with or without spaces)
    if 'REOLUBE' in normalized_product or 'REOL' in product_name.upper():
        if '46XC' in normalized_product or '46XC' in product_name.upper():
            search_patterns.extend(['46\\s*XC', 'REOLUBE.*46\\s*XC', 'REOL.*46\\s*XC'])
        elif '46B' in normalized_product or '46B' in product_name.upper():
            search_patterns.extend(['46\\s*B', 'REOLUBE.*46\\s*B', 'REOL.*46\\s*B'])
        elif '32B' in normalized_product or '32B' in product_name.upper():
            search_patterns.extend(['32\\s*B.*GT', 'REOLUBE.*32\\s*B', 'REOL.*32\\s*B'])
    
    print(f"   Search patterns: {search_patterns}")
    
    # Find all matching SDS files - SIMPLE APPROACH (like Google Drive)
    matching_files = []
    
    for root, dirs, files in os.walk(SDS_FOLDER):
        for file in files:
            if file.lower().endswith(('.pdf', '.PDF')):
                file_upper = file.upper()
                
                # SIMPLE: Just check if ANY of our search terms are in the filename
                # No complex patterns, just substring search
                for pattern in search_patterns:
                    # Remove regex special chars, just do simple substring match
                    simple_pattern = pattern.replace('.*', '').replace('\\s*', '')
                    if simple_pattern in file_upper:
                        full_path = os.path.join(root, file)
                        matching_files.append(full_path)
                        print(f"      [OK] Found: {file}")
                        break
    
    if not matching_files:
        print(f"   [X] No SDS files found for {product_name}")
        return None
    
    # Sort by date (filename date or modification time)
    def get_file_date(filepath):
        filename = os.path.basename(filepath)
        date_from_name = extract_date_from_filename(filename)
        if date_from_name:
            return date_from_name
        # Fall back to file modification time
        return datetime.fromtimestamp(os.path.getmtime(filepath))
    
    matching_files.sort(key=get_file_date, reverse=True)
    
    latest_file = matching_files[0]
    print(f"   [OK] Latest SDS: {os.path.basename(latest_file)}")
    
    return latest_file


def find_latest_cofa(product_name: str, batch_number: str) -> Optional[str]:
    """
    Find the latest COFA (Certificate of Analysis) for a product and batch number
    
    Args:
        product_name: Product name (e.g., "REOL46XCDRM" or "REOLUBE 46XC")
        batch_number: Batch/lot number (e.g., "2023087285")
    
    Returns:
        Full path to latest COFA file, or None if not found
    """
    print(f"\n[COFA SEARCH] Searching for COFA: {product_name} | Batch: {batch_number}")
    
    if not os.path.exists(COFA_FOLDER):
        print(f"   [X] COFA folder not found: {COFA_FOLDER}")
        return None
    
    if not batch_number:
        print(f"   [!] No batch number provided - cannot search for COFA")
        return None
    
    normalized_product = normalize_product_name(product_name)
    print(f"   Normalized product name: {normalized_product}")
    print(f"   Batch number: {batch_number}")
    
    # Search patterns
    search_patterns = [
        normalized_product,
        product_name.upper().replace('DRUM', '').replace('DRM', '').strip(),
        'COA',  # Many COFA files start with "COA" prefix
    ]
    
    # Add REOLUBE-specific patterns (match with or without spaces)
    if 'REOLUBE' in normalized_product or 'REOL' in product_name.upper():
        if '46XC' in normalized_product or '46XC' in product_name.upper():
            search_patterns.extend(['46\\s*XC', 'REOLUBE.*46\\s*XC', 'REOL.*46\\s*XC'])
        elif '46B' in normalized_product or '46B' in product_name.upper():
            search_patterns.extend(['46\\s*B', 'REOLUBE.*46\\s*B', 'REOL.*46\\s*B'])
        elif '32B' in normalized_product or '32B' in product_name.upper():
            search_patterns.extend(['32\\s*B.*GT', 'REOLUBE.*32\\s*B', 'REOL.*32\\s*B'])
    
    # Clean batch number (remove spaces, dashes) - MUST BE EXACT
    clean_batch = batch_number.replace(' ', '').replace('-', '').strip().upper()
    
    print(f"   Search patterns: {search_patterns}")
    print(f"   Clean batch (EXACT): {clean_batch}")
    
    # Find all matching COFA files - SIMPLE APPROACH (like Google Drive search)
    matching_files = []
    
    for root, dirs, files in os.walk(COFA_FOLDER):
        for file in files:
            if file.lower().endswith(('.pdf', '.PDF', '.xlsx', '.xls')):
                file_upper = file.upper()
                
                # SIMPLE: Just check if batch number is in the filename (case-insensitive)
                if clean_batch in file_upper.replace(' ', '').replace('-', '').replace('_', '').replace('#', ''):
                    # Also check if it looks like it's for the right product (optional, helps narrow results)
                    # If product pattern is in filename, it's a good match
                    # If not, still include it (batch number match is most important)
                    is_likely_match = False
                    for pattern in search_patterns:
                        if re.search(pattern.replace(' ', '.*'), file_upper):
                            is_likely_match = True
                            break
                    
                    # Include ANY file with the batch number
                    # (Product match is just a bonus for ranking, not required)
                    full_path = os.path.join(root, file)
                    matching_files.append((full_path, is_likely_match))
                    print(f"      [OK] Found: {file}")
    
    # Sort by product match (True first), then by date
    matching_files.sort(key=lambda x: (not x[1], -os.path.getmtime(x[0])))
    
    # Extract just the paths
    matching_files = [path for path, _ in matching_files]
    
    if not matching_files:
        print(f"   [X] No COFA files found for {product_name} batch {batch_number}")
        print(f"   [!] CRITICAL: Batch number '{batch_number}' not found in COFA folder")
        print(f"   Searched in: {COFA_FOLDER}")
        return None
    
    # Sort by date (filename date or modification time)
    def get_file_date(filepath):
        filename = os.path.basename(filepath)
        date_from_name = extract_date_from_filename(filename)
        if date_from_name:
            return date_from_name
        return datetime.fromtimestamp(os.path.getmtime(filepath))
    
    matching_files.sort(key=get_file_date, reverse=True)
    
    latest_file = matching_files[0]
    latest_filename = os.path.basename(latest_file)
    
    # VERIFY the batch number is actually in the filename (double-check)
    if clean_batch not in latest_filename.replace(' ', '').replace('-', '').replace('_', '').upper():
        print(f"   [!] WARNING: Batch '{batch_number}' verification failed in selected file!")
        print(f"   Selected file: {latest_filename}")
        print(f"   [!] Please manually verify this is the correct COFA")
    else:
        print(f"   [OK] Latest COFA (VERIFIED): {latest_filename}")
        print(f"   [OK] Batch '{batch_number}' confirmed in filename")
    
    return latest_file


def find_documents_for_dg_item(product_name: str, batch_number: str = None) -> Dict[str, Optional[str]]:
    """
    Find both SDS and COFA for a dangerous goods item
    
    Args:
        product_name: Product name
        batch_number: Batch/lot number (optional, required for COFA)
    
    Returns:
        Dictionary with 'sds' and 'cofa' file paths
    """
    print(f"\n{'='*80}")
    print(f"FINDING DOCUMENTS FOR DANGEROUS GOODS ITEM")
    print(f"Product: {product_name}")
    print(f"Batch: {batch_number or 'Not provided'}")
    print(f"{'='*80}")
    
    result = {
        'sds': find_latest_sds(product_name),
        'cofa': find_latest_cofa(product_name, batch_number) if batch_number else None
    }
    
    print(f"\n[OK] SEARCH COMPLETE:")
    print(f"   SDS: {'[OK] Found' if result['sds'] else '[X] Not found'}")
    print(f"   COFA: {'[OK] Found' if result['cofa'] else '[X] Not found' if batch_number else '[SKIP] Skipped (no batch number)'}")
    print(f"{'='*80}\n")
    
    return result


# Test function
if __name__ == '__main__':
    # Test with REOLUBE products
    test_products = [
        ('REOL46XCDRM', '2023087285'),
        ('REOL32BGTDRM', '2024010101'),
        ('REOL46BDRM', '2024020202'),
    ]
    
    for product, batch in test_products:
        docs = find_documents_for_dg_item(product, batch)
        print(f"\nResults for {product}:")
        print(f"  SDS: {docs['sds']}")
        print(f"  COFA: {docs['cofa']}")
        print()

