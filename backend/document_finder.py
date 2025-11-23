"""
Document Finder for Dangerous Goods Shipments
Finds latest SDS and COFA files for products
Now supports both local file system AND Google Drive API
"""

import os
import re
from typing import Optional, Dict
from datetime import datetime
import tempfile
import time

# Cache for folder scans (to avoid re-scanning same folders repeatedly)
_folder_scan_cache = {}
_cache_timestamps = {}
_CACHE_DURATION = 300  # 5 minutes cache


# Paths to document folders (for local/fallback)
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


def find_latest_sds(product_name: str, google_drive_service=None) -> Optional[str]:
    """
    Find the latest SDS file for a product
    Uses Google Drive API if available, falls back to local
    
    Args:
        product_name: Product name (e.g., "REOL46XCDRM" or "REOLUBE 46XC")
        google_drive_service: Optional Google Drive service
    
    Returns:
        Full path to latest SDS file, or None if not found
    """
    print(f"\n[SDS SEARCH] Searching for SDS: {product_name}")
    
    # Try Google Drive API first if available
    if google_drive_service and google_drive_service.authenticated:
        try:
            print(f"   [INFO] Using Google Drive API...")
            
            # Find RnD_Technical shared drive
            rnd_drive_id = google_drive_service.find_shared_drive("RnD_Technical")
            if rnd_drive_id:
                # Find SDS Sheets folder
                sds_folder_id = google_drive_service.find_folder_by_path(rnd_drive_id, "SDS Sheets")
                if sds_folder_id:
                    normalized_product = normalize_product_name(product_name)
                    
                    # Use cached folder scan if available (much faster)
                    cache_key = f"sds_{sds_folder_id}"
                    if cache_key in _folder_scan_cache:
                        cache_age = time.time() - _cache_timestamps.get(cache_key, 0)
                        if cache_age < _CACHE_DURATION:
                            print(f"   [CACHE] Using cached folder scan (age: {cache_age:.1f}s)")
                            files_by_folder = _folder_scan_cache[cache_key]
                        else:
                            # Cache expired
                            del _folder_scan_cache[cache_key]
                            del _cache_timestamps[cache_key]
                            files_by_folder = None
                    else:
                        files_by_folder = None
                    
                    # Scan only if not cached (optimized: max_depth=1, max_scan_time=15s)
                    if files_by_folder is None:
                        print(f"   [SCAN] Scanning SDS Sheets folder (optimized: depth=1, timeout=15s)...")
                        files_by_folder = google_drive_service._scan_folder_recursively(
                            sds_folder_id, "SDS Sheets", rnd_drive_id, 
                            depth=0, max_depth=1, max_scan_time=15
                        )
                        # Ensure we have a dict (scan might return None on error)
                        if files_by_folder is None:
                            files_by_folder = {}
                        # Cache the result
                        _folder_scan_cache[cache_key] = files_by_folder
                        _cache_timestamps[cache_key] = time.time()
                    
                    matching_files = []
                    for folder_path, files in files_by_folder.items():
                        for file_info in files:
                            file_name = file_info.get('file_name', '').upper()
                            if file_name.endswith('.PDF') and (normalized_product.replace(' ', '') in file_name.replace(' ', '')):
                                matching_files.append(file_info)
                                print(f"      [OK] Found: {file_info.get('file_name')}")
                    
                    if matching_files:
                        # Download the first one
                        latest_file = matching_files[0]
                        file_id = latest_file.get('file_id')
                        file_name = latest_file.get('file_name')
                        
                        # Download to temp file
                        temp_path = os.path.join(tempfile.gettempdir(), file_name)
                        google_drive_service.download_file(file_id, temp_path)
                        print(f"   [OK] Downloaded SDS from Google Drive: {file_name}")
                        return temp_path
        except Exception as e:
            print(f"   [!] Google Drive search failed: {e}, falling back to local")
    
    # Fallback to local file system
    if not os.path.exists(SDS_FOLDER):
        print(f"   [X] SDS folder not found (local or Google Drive)")
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
    
    # Find all matching SDS files
    matching_files = []
    
    for root, dirs, files in os.walk(SDS_FOLDER):
        for file in files:
            if file.lower().endswith(('.pdf', '.PDF')):
                file_upper = file.upper()
                
                for pattern in search_patterns:
                    simple_pattern = pattern.replace('.*', '').replace('\\s*', '')
                    if simple_pattern in file_upper:
                        full_path = os.path.join(root, file)
                        matching_files.append(full_path)
                        print(f"      [OK] Found: {file}")
                        break
    
    if not matching_files:
        print(f"   [X] No SDS files found for {product_name}")
        return None
    
    # Sort by date
    def get_file_date(filepath):
        filename = os.path.basename(filepath)
        date_from_name = extract_date_from_filename(filename)
        if date_from_name:
            return date_from_name
        return datetime.fromtimestamp(os.path.getmtime(filepath))
    
    matching_files.sort(key=get_file_date, reverse=True)
    
    latest_file = matching_files[0]
    print(f"   [OK] Latest SDS: {os.path.basename(latest_file)}")
    
    return latest_file


def find_latest_cofa(product_name: str, batch_number: str, google_drive_service=None) -> Optional[str]:
    """
    Find the latest COFA (Certificate of Analysis) for a product and batch number
    Uses Google Drive API if available, falls back to local
    
    Args:
        product_name: Product name (e.g., "REOL46XCDRM" or "REOLUBE 46XC")
        batch_number: Batch/lot number (e.g., "2023087285")
        google_drive_service: Optional Google Drive service
    
    Returns:
        Full path to latest COFA file, or None if not found
    """
    print(f"\n[COFA SEARCH] Searching for COFA: {product_name} | Batch: {batch_number}")
    
    if not batch_number:
        print(f"   [!] No batch number provided - cannot search for COFA")
        return None
    
    # Try Google Drive API first if available
    if google_drive_service and google_drive_service.authenticated:
        try:
            print(f"   [INFO] Using Google Drive API...")
            
            # Find Production_Inventory shared drive
            prod_drive_id = google_drive_service.find_shared_drive("Production_Inventory")
            if prod_drive_id:
                # Find Certificates of Analysis folder
                cofa_folder_id = google_drive_service.find_folder_by_path(prod_drive_id, "Certificates of Analysis")
                if cofa_folder_id:
                    clean_batch = batch_number.replace(' ', '').replace('-', '').strip().upper()
                    
                    # Use cached folder scan if available (much faster)
                    cache_key = f"cofa_{cofa_folder_id}"
                    if cache_key in _folder_scan_cache:
                        cache_age = time.time() - _cache_timestamps.get(cache_key, 0)
                        if cache_age < _CACHE_DURATION:
                            print(f"   [CACHE] Using cached folder scan (age: {cache_age:.1f}s)")
                            files_by_folder = _folder_scan_cache[cache_key]
                        else:
                            # Cache expired
                            del _folder_scan_cache[cache_key]
                            del _cache_timestamps[cache_key]
                            files_by_folder = None
                    else:
                        files_by_folder = None
                    
                    # Scan only if not cached (optimized: max_depth=1, max_scan_time=15s)
                    if files_by_folder is None:
                        print(f"   [SCAN] Scanning COFA folder (optimized: depth=1, timeout=15s)...")
                        files_by_folder = google_drive_service._scan_folder_recursively(
                            cofa_folder_id, "Certificates of Analysis", prod_drive_id, 
                            depth=0, max_depth=1, max_scan_time=15
                        )
                        # Ensure we have a dict (scan might return None on error)
                        if files_by_folder is None:
                            files_by_folder = {}
                        # Cache the result
                        _folder_scan_cache[cache_key] = files_by_folder
                        _cache_timestamps[cache_key] = time.time()
                    
                    matching_files = []
                    for folder_path, files in files_by_folder.items():
                        for file_info in files:
                            file_name = file_info.get('file_name', '').upper().replace(' ', '').replace('-', '').replace('_', '')
                            if clean_batch in file_name:
                                matching_files.append(file_info)
                                print(f"      [OK] Found: {file_info.get('file_name')}")
                    
                    if matching_files:
                        # Download the first one
                        latest_file = matching_files[0]
                        file_id = latest_file.get('file_id')
                        file_name = latest_file.get('file_name')
                        
                        # Download to temp file
                        temp_path = os.path.join(tempfile.gettempdir(), file_name)
                        google_drive_service.download_file(file_id, temp_path)
                        print(f"   [OK] Downloaded COFA from Google Drive: {file_name}")
                        return temp_path
        except Exception as e:
            print(f"   [!] Google Drive search failed: {e}, falling back to local")
    
    # Fallback to local file system
    if not os.path.exists(COFA_FOLDER):
        print(f"   [X] COFA folder not found (local or Google Drive)")
        return None
    
    normalized_product = normalize_product_name(product_name)
    print(f"   Normalized product name: {normalized_product}")
    print(f"   Batch number: {batch_number}")
    
    # Search patterns
    search_patterns = [
        normalized_product,
        product_name.upper().replace('DRUM', '').replace('DRM', '').strip(),
        'COA',
    ]
    
    # Add REOLUBE-specific patterns
    if 'REOLUBE' in normalized_product or 'REOL' in product_name.upper():
        if '46XC' in normalized_product or '46XC' in product_name.upper():
            search_patterns.extend(['46\\s*XC', 'REOLUBE.*46\\s*XC', 'REOL.*46\\s*XC'])
        elif '46B' in normalized_product or '46B' in product_name.upper():
            search_patterns.extend(['46\\s*B', 'REOLUBE.*46\\s*B', 'REOL.*46\\s*B'])
        elif '32B' in normalized_product or '32B' in product_name.upper():
            search_patterns.extend(['32\\s*B.*GT', 'REOLUBE.*32\\s*B', 'REOL.*32\\s*B'])
    
    clean_batch = batch_number.replace(' ', '').replace('-', '').strip().upper()
    
    print(f"   Search patterns: {search_patterns}")
    print(f"   Clean batch (EXACT): {clean_batch}")
    
    # Find all matching COFA files
    matching_files = []
    
    for root, dirs, files in os.walk(COFA_FOLDER):
        for file in files:
            if file.lower().endswith(('.pdf', '.PDF', '.xlsx', '.xls')):
                file_upper = file.upper()
                
                if clean_batch in file_upper.replace(' ', '').replace('-', '').replace('_', '').replace('#', ''):
                    is_likely_match = False
                    for pattern in search_patterns:
                        if re.search(pattern.replace(' ', '.*'), file_upper):
                            is_likely_match = True
                            break
                    
                    full_path = os.path.join(root, file)
                    matching_files.append((full_path, is_likely_match))
                    print(f"      [OK] Found: {file}")
    
    # Sort by product match, then by date
    matching_files.sort(key=lambda x: (not x[1], -os.path.getmtime(x[0])))
    matching_files = [path for path, _ in matching_files]
    
    if not matching_files:
        print(f"   [X] No COFA files found for {product_name} batch {batch_number}")
        return None
    
    # Sort by date
    def get_file_date(filepath):
        filename = os.path.basename(filepath)
        date_from_name = extract_date_from_filename(filename)
        if date_from_name:
            return date_from_name
        return datetime.fromtimestamp(os.path.getmtime(filepath))
    
    matching_files.sort(key=get_file_date, reverse=True)
    
    latest_file = matching_files[0]
    latest_filename = os.path.basename(latest_file)
    
    # Verify batch number
    if clean_batch not in latest_filename.replace(' ', '').replace('-', '').replace('_', '').upper():
        print(f"   [!] WARNING: Batch '{batch_number}' verification failed in selected file!")
        print(f"   Selected file: {latest_filename}")
    else:
        print(f"   [OK] Latest COFA (VERIFIED): {latest_filename}")
        print(f"   [OK] Batch '{batch_number}' confirmed in filename")
    
    return latest_file


def find_documents_for_dg_item(product_name: str, batch_number: str = None, google_drive_service=None) -> Dict[str, Optional[str]]:
    """
    Find both SDS and COFA for a dangerous goods item
    
    Args:
        product_name: Product name
        batch_number: Batch/lot number (optional, required for COFA)
        google_drive_service: Optional Google Drive service
    
    Returns:
        Dictionary with 'sds' and 'cofa' file paths
    """
    print(f"\n{'='*80}")
    print(f"FINDING DOCUMENTS FOR DANGEROUS GOODS ITEM")
    print(f"Product: {product_name}")
    print(f"Batch: {batch_number or 'Not provided'}")
    print(f"{'='*80}")
    
    result = {
        'sds': find_latest_sds(product_name, google_drive_service),
        'cofa': find_latest_cofa(product_name, batch_number, google_drive_service) if batch_number else None
    }
    
    print(f"\n[OK] SEARCH COMPLETE:")
    print(f"   SDS: {'[OK] Found' if result['sds'] else '[X] Not found'}")
    print(f"   COFA: {'[OK] Found' if result['cofa'] else '[X] Not found' if batch_number else '[SKIP] Skipped (no batch number)'}")
    print(f"{'='*80}\n")
    
    return result
