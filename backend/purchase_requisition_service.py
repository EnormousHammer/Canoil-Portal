"""
Purchase Requisition Service
Auto-fills requisition forms from PO data with Excel generation
Uses DIRECT XML editing to preserve all template structure (drawings, images, etc.)
Supports BOTH local G: Drive AND Cloud Run (Google Drive API)
"""

from flask import Blueprint, jsonify, request, send_file
import os
import json
from datetime import datetime, timedelta
import io
import zipfile
import re
from lxml import etree

# Google Cloud Storage for persistent storage on Cloud Run
try:
    from google.cloud import storage
    GCS_AVAILABLE = True
except ImportError:
    GCS_AVAILABLE = False
    print("[PR] WARNING: google-cloud-storage not available - using local storage only")

pr_service = Blueprint('pr_service', __name__)

# Use environment variable for path (works for both local and Cloud Run)
# Default to Windows path for local, but can be overridden via environment variable
GDRIVE_BASE = os.getenv('GDRIVE_BASE', r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions")
# Use relative path for Docker compatibility
_current_dir = os.path.dirname(os.path.abspath(__file__))
PR_TEMPLATE = os.path.join(_current_dir, 'templates', 'purchase_requisition', 'PR-Template-Clean.xlsx')

# Environment detection - Render or Cloud Run (NOT local)
IS_CLOUD_RUN = os.getenv('K_SERVICE') is not None
IS_RENDER = os.getenv('RENDER') is not None or os.getenv('RENDER_SERVICE_ID') is not None
IS_CLOUD_ENVIRONMENT = IS_CLOUD_RUN or IS_RENDER
# Only use local G: Drive if explicitly on localhost AND G: Drive is accessible
IS_LOCAL = not IS_CLOUD_ENVIRONMENT and (os.path.exists(r"G:\Shared drives") if os.name == 'nt' else False)

# Print environment detection on module load
if IS_RENDER:
    print("[PR] ✅ Running on Render - Will use Google Drive API (G: Drive not accessible)")
elif IS_CLOUD_RUN:
    print("[PR] ✅ Running on Cloud Run - Will use Google Drive API (G: Drive not accessible)")
else:
    if IS_LOCAL:
        print("[PR] ✅ Running locally - Will use G: Drive if accessible")
    else:
        print("[PR] ⚠️ Not on Render/Cloud Run and G: Drive not accessible - Will use Google Drive API")

# Cache for Google Drive data to avoid repeated API calls
_gdrive_data_cache = {}
_gdrive_cache_time = None
_GDRIVE_CACHE_DURATION = 300  # 5 minutes

# PR History storage
# Uses Google Cloud Storage on Cloud Run for persistence, local file otherwise
GCS_BUCKET_NAME = 'canoil-portal-data'
GCS_PR_HISTORY_BLOB = 'pr_history.json'
PR_HISTORY_RETENTION_DAYS = 30

# In-memory cache for PR history (survives across requests in same container)
_pr_history_cache = None


def _get_gcs_client():
    """Get GCS client if available"""
    if GCS_AVAILABLE and IS_CLOUD_RUN:
        try:
            return storage.Client()
        except Exception as e:
            print(f"[PR] ⚠️ Could not create GCS client: {e}")
    return None


def load_pr_history():
    """Load PR history from GCS (Cloud Run) or local file"""
    global _pr_history_cache
    
    try:
        history = []
        
        # On Cloud Run, try GCS first
        if IS_CLOUD_ENVIRONMENT and GCS_AVAILABLE:
            try:
                client = _get_gcs_client()
                if client:
                    bucket = client.bucket(GCS_BUCKET_NAME)
                    blob = bucket.blob(GCS_PR_HISTORY_BLOB)
                    if blob.exists():
                        content = blob.download_as_text()
                        history = json.loads(content)
                        print(f"[PR] ✅ Loaded PR history from GCS ({len(history)} records)")
            except Exception as gcs_err:
                print(f"[PR] ⚠️ Could not load from GCS: {gcs_err}")
        else:
            # Local - use file
            local_file = os.path.join(_current_dir, 'pr_history.json')
            if os.path.exists(local_file):
                with open(local_file, 'r', encoding='utf-8') as f:
                    history = json.load(f)
        
        # Filter to last 30 days
        if history:
            cutoff = datetime.now() - timedelta(days=PR_HISTORY_RETENTION_DAYS)
            cutoff_str = cutoff.strftime('%Y-%m-%d')
            history = [h for h in history if h.get('date', '') >= cutoff_str]
        
        _pr_history_cache = history
        return history
        
    except Exception as e:
        print(f"[PR] Error loading PR history: {e}")
        if _pr_history_cache is not None:
            return _pr_history_cache
        return []


def save_pr_history(history):
    """Save PR history to GCS (Cloud Run) or local file"""
    global _pr_history_cache
    
    try:
        # Filter to last 30 days before saving
        cutoff = datetime.now() - timedelta(days=PR_HISTORY_RETENTION_DAYS)
        cutoff_str = cutoff.strftime('%Y-%m-%d')
        history = [h for h in history if h.get('date', '') >= cutoff_str]
        
        # Always update cache
        _pr_history_cache = history
        
        # On Cloud Run, save to GCS
        if IS_CLOUD_ENVIRONMENT and GCS_AVAILABLE:
            try:
                client = _get_gcs_client()
                if client:
                    bucket = client.bucket(GCS_BUCKET_NAME)
                    blob = bucket.blob(GCS_PR_HISTORY_BLOB)
                    blob.upload_from_string(
                        json.dumps(history, indent=2, ensure_ascii=False),
                        content_type='application/json'
                    )
                    print(f"[PR] ✅ Saved PR history to GCS ({len(history)} records)")
                    return True
            except Exception as gcs_err:
                print(f"[PR] ⚠️ Could not save to GCS: {gcs_err}")
                return False
        else:
            # Local - use file
            local_file = os.path.join(_current_dir, 'pr_history.json')
            with open(local_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
            print(f"[PR] ✅ Saved PR history to {local_file}")
            return True
            
    except Exception as e:
        print(f"[PR] ⚠️ Could not save PR history: {e}")
        return False


def add_pr_to_history(pr_record):
    """Add a new PR record to history"""
    try:
        history = load_pr_history()
        history.insert(0, pr_record)  # Add to beginning (most recent first)
        save_pr_history(history)
        print(f"[PR] ✅ Added PR to history: {pr_record.get('id')}")
        return True
    except Exception as e:
        print(f"[PR] Error adding to PR history: {e}")
        return False


def get_google_drive_service():
    """Get Google Drive service from app.py - lazy initialization"""
    try:
        import sys
        if 'app' in sys.modules:
            app_module = sys.modules['app']
            gds_func = getattr(app_module, 'get_google_drive_service', None)
            if gds_func:
                return gds_func()
    except Exception as e:
        print(f"[PR] Error getting Google Drive service: {e}")
    return None


def load_json_from_gdrive(file_name):
    """
    Load a JSON file - works on BOTH local G: Drive AND Cloud Run (Google Drive API)
    
    On local: Reads from G: Drive file system
    On Cloud Run: Uses Google Drive API to download the file
    
    Returns: List/Dict of JSON data, or [] if not found
    """
    global _gdrive_data_cache, _gdrive_cache_time
    
    # Check cache first (for Cloud Run - avoids repeated API calls)
    if _gdrive_cache_time:
        cache_age = (datetime.now() - _gdrive_cache_time).total_seconds()
        if cache_age < _GDRIVE_CACHE_DURATION and file_name in _gdrive_data_cache:
            print(f"[PR] Using cached data for {file_name}")
            return _gdrive_data_cache[file_name]
    
    try:
        # CRITICAL FIX: Check Cloud Environment (Render/Cloud Run) FIRST - ALWAYS use Google Drive API
        if IS_CLOUD_ENVIRONMENT:
            # Render/Cloud Run: Use Google Drive API directly (don't need folder name)
            env_name = "Render" if IS_RENDER else "Cloud Run"
            print(f"[PR] ☁️ {env_name}: Loading {file_name} via Google Drive API")
            service = get_google_drive_service()
            if not service or not service.authenticated:
                print(f"[PR] ❌ Google Drive service not available or not authenticated")
                return []
            
            # Find the shared drive and folder
            from google_drive_service import SHARED_DRIVE_NAME, BASE_FOLDER_PATH
            
            drive_id = service.find_shared_drive(SHARED_DRIVE_NAME)
            if not drive_id:
                print(f"[PR] ❌ Shared drive not found: {SHARED_DRIVE_NAME}")
                return []
            
            base_folder_id = service.find_folder_by_path(drive_id, BASE_FOLDER_PATH)
            if not base_folder_id:
                print(f"[PR] ❌ Base folder not found: {BASE_FOLDER_PATH}")
                return []
            
            # Find the latest date folder
            latest_folder_id, latest_folder_name = service.get_latest_folder(base_folder_id, drive_id)
            if not latest_folder_id:
                print(f"[PR] ❌ Latest folder not found")
                return []
            
            # Load the specific file
            data = service.load_specific_files(latest_folder_id, drive_id, [file_name])
            file_data = data.get(file_name, [])
            
            # Cache for future use
            _gdrive_data_cache[file_name] = file_data
            _gdrive_cache_time = datetime.now()
            
            print(f"[PR] ✅ Loaded {file_name}: {len(file_data) if isinstance(file_data, list) else 'object'}")
            return file_data
        else:
            # Local: Read from G: Drive file system
            latest = get_latest_folder()
            if not latest:
                print(f"[PR] ⚠️ No latest folder found for local access")
                return []
            
            file_path = os.path.join(GDRIVE_BASE, latest, file_name)
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    print(f"[PR] ✅ Loaded {file_name} from local: {len(data) if isinstance(data, list) else 'object'}")
                    return data
            else:
                print(f"[PR] ⚠️ File not found: {file_path}")
                return []
                
    except Exception as e:
        print(f"[PR] ❌ Error loading {file_name}: {e}")
        import traceback
        traceback.print_exc()
        return []


# Excel XML namespace
XLSX_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
XLSX_NSMAP = {None: XLSX_NS}


def col_to_num(col_str):
    """Convert column letter to number (A=1, B=2, ..., Z=26, AA=27, etc.)"""
    result = 0
    for char in col_str:
        result = result * 26 + (ord(char.upper()) - ord('A') + 1)
    return result


def parse_cell_ref(ref):
    """Parse cell reference like 'A1' into (col_letter, row_number)"""
    match = re.match(r'^([A-Z]+)(\d+)$', ref)
    if match:
        return match.group(1), int(match.group(2))
    return None, None


def fill_excel_directly(template_path, cell_values):
    """
    Fill Excel template by directly editing XML - preserves ALL template structure.
    
    cell_values: dict of cell_ref -> value, e.g. {'I7': 'John Doe', 'B16': 'ITEM-001'}
    
    Returns: BytesIO with the filled Excel file
    """
    # Read all files from template
    with zipfile.ZipFile(template_path, 'r') as zin:
        files = {name: zin.read(name) for name in zin.namelist()}
    
    # Parse sheet1.xml
    sheet_xml = etree.fromstring(files['xl/worksheets/sheet1.xml'])
    sheet_data = sheet_xml.find(f'.//{{{XLSX_NS}}}sheetData')
    
    if sheet_data is None:
        raise Exception("Could not find sheetData in worksheet")
    
    # Build a map of existing cells
    cell_map = {}  # ref -> cell element
    row_map = {}   # row_num -> row element
    
    for row in sheet_data:
        row_num = int(row.get('r'))
        row_map[row_num] = row
        for cell in row:
            ref = cell.get('r')
            if ref:
                cell_map[ref] = cell
    
    # Update or create cells
    for ref, value in cell_values.items():
        # Convert None to empty string - but STILL update the cell to clear old data!
        if value is None:
            value = ''
            
        col_letter, row_num = parse_cell_ref(ref)
        if col_letter is None:
            continue
        
        if ref in cell_map:
            # Update existing cell
            cell = cell_map[ref]
            # Remove type attribute to treat as string/inline
            if 't' in cell.attrib:
                del cell.attrib['t']
            # Find or create value element
            v = cell.find(f'{{{XLSX_NS}}}v')
            if v is None:
                v = etree.SubElement(cell, f'{{{XLSX_NS}}}v')
            
            # Handle formulas vs values
            if str(value).startswith('='):
                # It's a formula
                f = cell.find(f'{{{XLSX_NS}}}f')
                if f is None:
                    f = etree.SubElement(cell, f'{{{XLSX_NS}}}f')
                f.text = str(value)[1:]  # Remove the = prefix
                if v is not None:
                    cell.remove(v)
            else:
                # Remove old formula if exists
                f = cell.find(f'{{{XLSX_NS}}}f')
                if f is not None:
                    cell.remove(f)
                
                # Remove old inline string if exists
                is_elem = cell.find(f'{{{XLSX_NS}}}is')
                if is_elem is not None:
                    cell.remove(is_elem)
                
                # Remove old value if exists
                if v is not None:
                    cell.remove(v)
                    v = None
                
                # Handle empty string - CLEAR the cell content (removes old template data!)
                if value == '':
                    # Clear cell - remove type attribute and all content
                    if 't' in cell.attrib:
                        del cell.attrib['t']
                    # Cell is now empty - old Lanxess data cleared!
                    continue
                
                # Check if value is numeric
                is_numeric = False
                try:
                    float(str(value).replace(',', ''))
                    is_numeric = True
                except (ValueError, TypeError):
                    is_numeric = False
                
                if is_numeric:
                    # Store as number - no type attribute, just value
                    if 't' in cell.attrib:
                        del cell.attrib['t']
                    v = etree.SubElement(cell, f'{{{XLSX_NS}}}v')
                    v.text = str(float(str(value).replace(',', '')))
                else:
                    # Store as inline string
                    cell.set('t', 'inlineStr')
                    is_elem = etree.SubElement(cell, f'{{{XLSX_NS}}}is')
                    t_elem = etree.SubElement(is_elem, f'{{{XLSX_NS}}}t')
                    t_elem.text = str(value)
        else:
            # Create new cell - need to find or create the row first
            if row_num not in row_map:
                # Create new row
                new_row = etree.Element(f'{{{XLSX_NS}}}row', r=str(row_num))
                # Insert in correct position
                inserted = False
                for i, existing_row in enumerate(sheet_data):
                    if int(existing_row.get('r')) > row_num:
                        sheet_data.insert(i, new_row)
                        inserted = True
                        break
                if not inserted:
                    sheet_data.append(new_row)
                row_map[row_num] = new_row
            
            row = row_map[row_num]
            
            # Check if value is numeric
            is_numeric = False
            try:
                float(str(value).replace(',', ''))
                is_numeric = True
            except (ValueError, TypeError):
                is_numeric = False
            
            if is_numeric:
                # Create new cell with numeric value
                new_cell = etree.Element(f'{{{XLSX_NS}}}c', r=ref)
                v_elem = etree.SubElement(new_cell, f'{{{XLSX_NS}}}v')
                v_elem.text = str(float(str(value).replace(',', '')))
            else:
                # Create new cell with inline string
                new_cell = etree.Element(f'{{{XLSX_NS}}}c', r=ref, t='inlineStr')
                is_elem = etree.SubElement(new_cell, f'{{{XLSX_NS}}}is')
                t_elem = etree.SubElement(is_elem, f'{{{XLSX_NS}}}t')
                t_elem.text = str(value)
            
            # Insert cell in correct column position
            col_num = col_to_num(col_letter)
            inserted = False
            for i, existing_cell in enumerate(row):
                existing_ref = existing_cell.get('r')
                if existing_ref:
                    existing_col, _ = parse_cell_ref(existing_ref)
                    if existing_col and col_to_num(existing_col) > col_num:
                        row.insert(i, new_cell)
                        inserted = True
                        break
            if not inserted:
                row.append(new_cell)
            
            cell_map[ref] = new_cell
    
    # Clear cached values from formula cells to force Excel to recalculate on open
    # This fixes the issue where formulas show old/wrong values until clicked
    formula_cells_cleared = 0
    for row in sheet_data:
        for cell in row:
            f = cell.find(f'{{{XLSX_NS}}}f')
            if f is not None:
                # This cell has a formula - remove cached value so Excel recalculates
                v = cell.find(f'{{{XLSX_NS}}}v')
                if v is not None:
                    cell.remove(v)
                    formula_cells_cleared += 1
    
    if formula_cells_cleared > 0:
        print(f"[PR] 🔄 Cleared cached values from {formula_cells_cleared} formula cells for recalculation")
    
    # Modify workbook.xml to force Excel to recalculate all formulas on open
    # This fixes the issue where formulas show wrong values until you click and press Enter
    if 'xl/workbook.xml' in files:
        try:
            workbook_xml = etree.fromstring(files['xl/workbook.xml'])
            wb_ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
            
            # Find or create calcPr element
            calc_pr = workbook_xml.find(f'{{{wb_ns}}}calcPr')
            if calc_pr is None:
                # Create calcPr element
                calc_pr = etree.Element(f'{{{wb_ns}}}calcPr')
                workbook_xml.append(calc_pr)
            
            # Set fullCalcOnLoad to force recalculation on open
            calc_pr.set('fullCalcOnLoad', '1')
            calc_pr.set('calcMode', 'auto')
            
            # Save back to files dict
            files['xl/workbook.xml'] = etree.tostring(
                workbook_xml,
                xml_declaration=True,
                encoding='UTF-8',
                standalone='yes'
            )
            print("[PR] 🔄 Set fullCalcOnLoad=1 in workbook.xml to force formula recalculation on open")
        except Exception as e:
            print(f"[PR] ⚠️ Could not modify workbook.xml for auto-calc: {e}")
    
    # Serialize back to XML
    files['xl/worksheets/sheet1.xml'] = etree.tostring(
        sheet_xml, 
        xml_declaration=True, 
        encoding='UTF-8', 
        standalone='yes'
    )
    
    # Create output zip
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)
    
    output.seek(0)
    print(f"[PR] ✅ Filled {len(cell_values)} cells directly - template 100% preserved")
    return output


# Cache for latest folder to avoid repeated API calls
_latest_folder_cache = None
_latest_folder_cache_time = None

def get_latest_folder():
    """
    Get latest MISys API extraction folder
    Always returns the most recent folder by date (YYYY-MM-DD format)
    Works for both local and Google Cloud Run environments
    
    Caches result for 5 minutes to avoid repeated slow API calls
    """
    global _latest_folder_cache, _latest_folder_cache_time
    
    # Check cache (valid for 5 minutes)
    if _latest_folder_cache and _latest_folder_cache_time:
        cache_age = (datetime.now() - _latest_folder_cache_time).total_seconds()
        if cache_age < 300:  # 5 minutes
            return _latest_folder_cache
    
    try:
        # On Render/Cloud Run, use Google Drive API FIRST (don't check local paths)
        if IS_CLOUD_ENVIRONMENT:
            # Import dynamically to avoid circular imports
            import sys
            if 'app' in sys.modules:
                app_module = sys.modules['app']
                get_google_drive_service = getattr(app_module, 'get_google_drive_service', None)
                
                if get_google_drive_service:
                    env_name = "Render" if IS_RENDER else "Cloud Run"
                    print(f"[PR] ☁️ {env_name}: Using Google Drive API to find latest folder...")
                    service = get_google_drive_service()
                    if service and service.authenticated:
                        try:
                            latest_id, latest_name = service.find_latest_api_extractions_folder()
                            if latest_name:
                                print(f"[PR] ✅ Latest MISys API extraction folder (via API): {latest_name}")
                                _latest_folder_cache = latest_name
                                _latest_folder_cache_time = datetime.now()
                                return latest_name
                        except Exception as api_err:
                            print(f"[PR] ❌ Error calling find_latest_api_extractions_folder: {api_err}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print(f"[PR] ❌ Google Drive service not available or not authenticated")
            else:
                print(f"[PR] ⚠️ App module not loaded, cannot access Google Drive service")
            # Don't return None - let it try to use the service in load_json_from_gdrive
            # But log that we're on cloud environment
            print(f"[PR] ⚠️ Could not get latest folder via API, will try in load_json_from_gdrive")
            return None
        
        # Local environment - read from G: drive (ONLY if actually local)
        if not IS_LOCAL:
            print(f"[PR] ⚠️ Not local environment - should use Google Drive API")
            return None
        
        if not os.path.exists(GDRIVE_BASE):
            print(f"[PR] ⚠️ GDRIVE_BASE path not accessible: {GDRIVE_BASE}")
            return None
        
        # Get all folders
        folders = [f for f in os.listdir(GDRIVE_BASE) if os.path.isdir(os.path.join(GDRIVE_BASE, f))]
        
        if not folders:
            print(f"[PR] ⚠️ No folders found in: {GDRIVE_BASE}")
            return None
        
        # Sort by folder name (assuming YYYY-MM-DD format) - most recent first
        folders.sort(reverse=True)
        latest_folder = folders[0]
        
        print(f"[PR] ✅ Latest MISys API extraction folder (local): {latest_folder}")
        _latest_folder_cache = latest_folder
        _latest_folder_cache_time = datetime.now()
        return latest_folder
        
    except Exception as e:
        print(f"❌ Error getting latest folder: {e}")
        import traceback
        traceback.print_exc()
        return None


def load_items():
    """Load items from latest folder - works on BOTH local and Cloud Run"""
    return load_json_from_gdrive('Items.json')


def load_po_data(po_number):
    """Load merged PO data - works on both local and Render/Cloud Run"""
    # On Render/Cloud Run: Build from raw files (merged files not available via API)
    # On local: Try merged files first, fall back to raw files
    
    if IS_CLOUD_ENVIRONMENT:
        # On Render/Cloud Run, build PO data from raw files
        pos = load_json_from_gdrive('PurchaseOrders.json')
        po_details = load_json_from_gdrive('PurchaseOrderDetails.json')
        
        if not pos or not po_details:
            return None
        
        # Find the PO header
        po_header = next((po for po in pos if po.get('PO No.') == po_number), None)
        if not po_header:
            return None
        
        # Find the PO details
        details = [d for d in po_details if d.get('PO No.') == po_number]
        
        # Build a merged structure similar to the local merged files
        return {
            'PO_Number': po_number,
            'Supplier': {
                'Supplier_No': po_header.get('Supplier No.', ''),
                'Name': po_header.get('Name', ''),
                'Contact': po_header.get('Contact', ''),
            },
            'Order_Info': {
                'Order_Date': po_header.get('Order Date', ''),
                'Terms': po_header.get('Terms', ''),
                'Buyer': po_header.get('Buyer', ''),
            },
            'Financial': {
                'Total_Amount': po_header.get('Total Amount', 0),
            },
            'Line_Items': [{
                'Item_No': d.get('Item No.', ''),
                'Description': d.get('Description', ''),
                'Pricing': {
                    'Unit_Cost': d.get('Unit Price', 0),
                    'Quantity_Ordered': d.get('Ordered', 0),
                    'Purchase_Unit_of_Measure': d.get('Purchase U/M', 'EA'),
                }
            } for d in details]
        }
    else:
        # Local: Try merged files first, fall back to raw files if not available
        if IS_LOCAL:
            latest = get_latest_folder()
            if latest:
                merged_folder = os.path.join(GDRIVE_BASE, latest, 'MERGED_POS', 'individual_pos')
                po_file = os.path.join(merged_folder, f'PO_{po_number}.json')
                
                if os.path.exists(po_file):
                    with open(po_file, 'r', encoding='utf-8') as f:
                        return json.load(f)
        
        # Fall back to building from raw files (same as cloud)
        pos = load_json_from_gdrive('PurchaseOrders.json')
        po_details = load_json_from_gdrive('PurchaseOrderDetails.json')
        
        if not pos or not po_details:
            return None
        
        # Find the PO header
        po_header = next((po for po in pos if po.get('PO No.') == po_number), None)
        if not po_header:
            return None
        
        # Find the PO details
        details = [d for d in po_details if d.get('PO No.') == po_number]
        
        # Build a merged structure similar to the local merged files
        return {
            'PO_Number': po_number,
            'Supplier': {
                'Supplier_No': po_header.get('Supplier No.', ''),
                'Name': po_header.get('Name', ''),
                'Contact': po_header.get('Contact', ''),
            },
            'Order_Info': {
                'Order_Date': po_header.get('Order Date', ''),
                'Terms': po_header.get('Terms', ''),
                'Buyer': po_header.get('Buyer', ''),
            },
            'Financial': {
                'Total_Amount': po_header.get('Total Amount', 0),
            },
            'Line_Items': [{
                'Item_No': d.get('Item No.', ''),
                'Description': d.get('Description', ''),
                'Pricing': {
                    'Unit_Cost': d.get('Unit Price', 0),
                    'Quantity_Ordered': d.get('Ordered', 0),
                    'Purchase_Unit_of_Measure': d.get('Purchase U/M', 'EA'),
                }
            } for d in details]
        }


def get_inventory_data(item_no):
    """Get current inventory data for an item from CustomAlert5.json
    
    Works on BOTH local G: Drive AND Cloud Run (Google Drive API)
    """
    try:
        inventory_data = load_json_from_gdrive('CustomAlert5.json')
        
        if not inventory_data:
            return None
        
        # Find the item in inventory data
        for item in inventory_data:
            if item.get('Item No.') == item_no:
                # Helper to parse cost values (can be string like "$1,234.56" or number)
                def parse_cost(value, default=0):
                    if value is None:
                        return default
                    if isinstance(value, (int, float)):
                        return float(value)
                    if isinstance(value, str):
                        return float(value.replace('$', '').replace(',', '')) if value else default
                    return default
                
                # Helper to parse numeric values (can have commas like "9,093.000000")
                def parse_number(value, default=0):
                    if value is None:
                        return default
                    if isinstance(value, (int, float)):
                        return float(value)
                    if isinstance(value, str):
                        # Remove commas and dollar signs
                        cleaned = value.replace('$', '').replace(',', '').strip()
                        return float(cleaned) if cleaned else default
                    return default
                
                return {
                    'stock': parse_number(item.get('Stock')),
                    'wip': parse_number(item.get('WIP')),
                    'reserve': parse_number(item.get('Reserve')),
                    'on_order': parse_number(item.get('On Order')),
                    'minimum': parse_number(item.get('Minimum')),
                    'maximum': parse_number(item.get('Maximum')),
                    'reorder_level': parse_number(item.get('Reorder Level')),
                    'reorder_quantity': parse_number(item.get('Reorder Quantity')),
                    'recent_cost': parse_cost(item.get('Recent Cost')),
                    'average_cost': parse_cost(item.get('Average Cost')),
                    'landed_cost': parse_cost(item.get('Landed Cost')),
                    'stocking_units': item.get('Stocking Units', ''),
                    'purchasing_units': item.get('Purchasing Units', ''),
                    'units_conversion_factor': parse_cost(item.get('Units Conversion Factor'), 1)
                }
        
        return None
        
    except Exception as e:
        print(f"Error getting inventory data for {item_no}: {e}")
        return None

def get_recent_purchase_price(item_no, limit=5):
    """
    Get recent purchase prices for an item from PO details
    Returns list of recent purchases sorted by date (most recent first)
    
    Works on BOTH local G: Drive AND Cloud Run (Google Drive API)
    """
    try:
        # Load PO data using the unified loader
        po_details = load_json_from_gdrive('PurchaseOrderDetails.json')
        pos = load_json_from_gdrive('PurchaseOrders.json')
        
        if not po_details or not pos:
            print(f"[PR] PO data not available for pricing lookup")
            return []
        
        # Create a lookup for PO headers by PO number
        po_lookup = {po.get('PO No.'): po for po in pos}
        
        # Find all purchases for this item
        item_purchases = []
        
        for detail in po_details:
            if detail.get('Item No.') == item_no:
                po_no = detail.get('PO No.')
                po_header = po_lookup.get(po_no, {})
                
                purchase = {
                    'item_no': item_no,  # Include the item number
                    'po_no': po_no,
                    'unit_price': detail.get('Unit Price', 0),
                    'order_date': po_header.get('Order Date', ''),  # From PO header
                    'supplier_no': po_header.get('Supplier No.', ''),  # From PO header
                    'quantity': detail.get('Ordered', 0),
                    'total_amount': round(detail.get('Unit Price', 0) * detail.get('Ordered', 0), 2),
                    'description': detail.get('Description', ''),
                    'supplier_name': po_header.get('Name', ''),
                    'contact': po_header.get('Contact', ''),
                    'terms': po_header.get('Terms', ''),
                    'purchase_unit': detail.get('Purchase U/M', ''),  # Real purchase unit
                    'supplier_item_no': detail.get('Supplier Item No.', '')  # Supplier's item number
                }
                item_purchases.append(purchase)
        
        # Sort by order date (most recent first)
        item_purchases.sort(key=lambda x: x.get('order_date', ''), reverse=True)
        
        # Return the most recent purchase(s)
        return item_purchases[:limit] if item_purchases else []
        
    except Exception as e:
        print(f"Error getting recent prices for {item_no}: {e}")
        import traceback
        traceback.print_exc()
        return []


def load_supplier_contacts_lookup():
    """
    Load manually-maintained supplier contacts lookup file.
    This file can be edited to add/update contact info for suppliers
    that don't have complete data in MISys.
    
    Returns: dict of supplier_no -> contact info
    """
    try:
        lookup_file = os.path.join(_current_dir, 'supplier_contacts.json')
        if os.path.exists(lookup_file):
            with open(lookup_file, 'r', encoding='utf-8') as f:
                suppliers = json.load(f)
            # Convert list to dict for fast lookup
            return {s.get('supplier_no'): s for s in suppliers if s.get('supplier_no')}
        return {}
    except Exception as e:
        print(f"[PR] ⚠️ Could not load supplier_contacts.json: {e}")
        return {}


def get_supplier_info(supplier_no):
    """
    Get supplier information from multiple sources with priority:
    
    Priority Order:
    1. supplier_contacts.json (manually-maintained lookup - highest priority)
    2. PurchaseOrderAdditionalCostsTaxes.json (extended data from MISys)
    3. PurchaseOrders.json (basic data from MISys)
    
    For each field, use the first source that has data.
    This allows manual overrides while still using MISys as default.
    
    Works on BOTH local G: Drive AND Cloud Run (Google Drive API)
    """
    try:
        # FIRST: Check manually-maintained lookup file for overrides
        lookup = load_supplier_contacts_lookup()
        manual_override = lookup.get(supplier_no)
        if manual_override:
            # Check if this entry has real data (not just empty strings)
            has_real_data = any([
                manual_override.get('email'),
                manual_override.get('phone'),
                manual_override.get('address')
            ])
            if has_real_data:
                print(f"[PR] 📋 Using manual override for {supplier_no}")
        
        # Load PO data using the unified loader
        pos = load_json_from_gdrive('PurchaseOrders.json')
        
        if not pos:
            print(f"[PR] PurchaseOrders.json not available")
            return None
        
        # Find most recent PO for this supplier
        supplier_pos = [po for po in pos if po.get('Supplier No.') == supplier_no]
        
        if not supplier_pos:
            print(f"[PR] No POs found for supplier: {supplier_no}")
            return None
        
        # Sort by Order Date (most recent first)
        supplier_pos.sort(key=lambda x: x.get('Order Date', ''), reverse=True)
        most_recent_po = supplier_pos[0]
        
        print(f"[PR] ✅ Found supplier info: {most_recent_po.get('Name', '')} ({len(supplier_pos)} POs)")
        
        # Build base info from PurchaseOrders.json
        info = {
            'supplier_no': supplier_no,
            'name': most_recent_po.get('Name', ''),
            'contact': most_recent_po.get('Contact', ''),
            'phone': '',  # Will try to get from extended data
            'email': '',  # Will try to get from extended data
            'address': '',
            'city': '',
            'province': '',
            'postal': '',
            'country': '',
            'terms': '',
            'fax': '',
            'po_count': len(supplier_pos),
            'last_order_date': most_recent_po.get('Order Date', ''),
            'last_po_no': most_recent_po.get('PO No.', ''),
            'buyer': most_recent_po.get('Buyer', ''),
            'currency': most_recent_po.get('Home Currency', ''),
            'total_amount': most_recent_po.get('Total Amount', 0)
        }
        
        # Try to get extended info (email, phone, address) from PurchaseOrderAdditionalCostsTaxes.json
        # This file has complete supplier contact details for some POs
        try:
            extended_data = load_json_from_gdrive('PurchaseOrderAdditionalCostsTaxes.json')
            
            if extended_data:
                # Find records for THIS supplier only (no mixing!)
                supplier_extended = [
                    e for e in extended_data 
                    if e.get('Supplier No.') == supplier_no
                ]
                
                if supplier_extended:
                    # Sort by Purchase Order Id (descending) to get most recent
                    supplier_extended.sort(
                        key=lambda x: x.get('Purchase Order Id', ''), 
                        reverse=True
                    )
                    most_recent_extended = supplier_extended[0]
                    
                    # Update with extended info - ONLY from same supplier's record
                    email = most_recent_extended.get('E-mail', '')
                    phone = most_recent_extended.get('Telephone', '')
                    
                    if email:
                        info['email'] = email
                        print(f"[PR]   📧 Email found: {email}")
                    if phone:
                        info['phone'] = phone
                        print(f"[PR]   📞 Phone found: {phone}")
                    
                    # Also get address info
                    info['address'] = most_recent_extended.get('Address 1', '')
                    info['city'] = most_recent_extended.get('City', '')
                    info['province'] = most_recent_extended.get('State/Province', '')
                    info['postal'] = most_recent_extended.get('Zip/Postal', '')
                    info['country'] = most_recent_extended.get('Country', '')
                    info['fax'] = most_recent_extended.get('Fax', '')
                    info['terms'] = most_recent_extended.get('Terms', '')
                    
                    # Use contact from extended if available (more recent)
                    extended_contact = most_recent_extended.get('Contact', '')
                    if extended_contact:
                        info['contact'] = extended_contact
                    
                    print(f"[PR]   ✅ Extended info loaded from PO #{most_recent_extended.get('Purchase Order Id', '')}")
                else:
                    print(f"[PR]   ℹ️ No extended info in AdditionalCostsTaxes for {supplier_no}")
        except Exception as ext_err:
            print(f"[PR]   ⚠️ Could not load extended supplier info: {ext_err}")
        
        # FINALLY: Apply data from supplier_contacts.json (our primary source from MISys full export)
        # This is the most complete and accurate source - ALWAYS use it when available
        if manual_override:
            override_applied = False
            
            # ALWAYS use supplier_contacts.json data when available (it's our primary source)
            if manual_override.get('email'):
                info['email'] = manual_override['email']
                override_applied = True
            if manual_override.get('phone'):
                info['phone'] = manual_override['phone']
                override_applied = True
            if manual_override.get('contact'):
                info['contact'] = manual_override['contact']
                override_applied = True
            if manual_override.get('address'):
                info['address'] = manual_override['address']
                override_applied = True
            if manual_override.get('city'):
                info['city'] = manual_override['city']
                override_applied = True
            if manual_override.get('province'):
                info['province'] = manual_override['province']
                override_applied = True
            if manual_override.get('postal'):
                info['postal'] = manual_override['postal']
                override_applied = True
            if manual_override.get('country'):
                info['country'] = manual_override['country']
                override_applied = True
            
            if override_applied:
                print(f"[PR]   📋 Applied supplier data from supplier_contacts.json")
        
        return info
        
    except Exception as e:
        print(f"Error getting supplier info for {supplier_no}: {e}")
        import traceback
        traceback.print_exc()
        return None


# ============================================================================
# BOM EXPLOSION FUNCTIONS - For Multi-Item, Multi-Supplier PR Generation
# ============================================================================

def load_bom_details():
    """Load Bill of Materials from latest extraction folder - works on BOTH local and Cloud Run"""
    return load_json_from_gdrive('BillOfMaterialDetails.json')


def get_current_bom_revision(item_no):
    """
    Get the current BOM revision for an item from CustomAlert5.json.
    
    Items can have multiple BOM revisions (0, 1, 2, etc.) but only ONE is "current".
    This function returns the current revision number so we use the correct BOM.
    
    Returns: revision number as string (e.g., "0", "1") or None if not found
    """
    try:
        inventory_data = load_json_from_gdrive('CustomAlert5.json')
        if not inventory_data:
            return None
        
        for item in inventory_data:
            if item.get('Item No.') == item_no:
                revision = item.get('Current BOM Revision')
                if revision is not None:
                    return str(revision)  # Ensure it's a string for comparison
                return None
        return None
    except Exception as e:
        print(f"Error getting current BOM revision for {item_no}: {e}")
        return None


def get_item_master(item_no):
    """Get item master data including preferred supplier and item type"""
    try:
        items = load_items()
        for item in items:
            if item.get('Item No.') == item_no:
                # Parse conversion factor (can be string or number)
                conv_factor = item.get('Units Conversion Factor', 1)
                if isinstance(conv_factor, str):
                    try:
                        conv_factor = float(conv_factor.replace(',', '')) if conv_factor else 1
                    except:
                        conv_factor = 1
                conv_factor = float(conv_factor) if conv_factor else 1
                
                return {
                    'item_no': item_no,
                    'description': item.get('Description', ''),
                    'item_type': item.get('Item Type', 0),  # 0=Purchased/Raw, 1=Assembled
                    'preferred_supplier': item.get('Preferred Supplier Number', ''),
                    'purchasing_units': item.get('Purchasing Units', 'EA'),
                    'stocking_units': item.get('Stocking Units', 'EA'),
                    'units_conversion_factor': conv_factor,  # Stocking units per purchasing unit
                    'recent_cost': item.get('Recent Cost', 0),
                    'order_lead_days': item.get('Order Lead (Days)', 7),
                    'reorder_quantity': item.get('Reorder Quantity', 0),
                    'minimum': item.get('Minimum', 0),
                    'reorder_level': item.get('Reorder Level', 0)
                }
        return None
    except Exception as e:
        print(f"Error getting item master for {item_no}: {e}")
        return None


def get_stock_level(item_no, location='62TODD'):
    """Get current stock level from CustomAlert5.json"""
    try:
        inventory = get_inventory_data(item_no)
        if inventory:
            stock = inventory.get('stock', 0)
            # Handle string values with commas
            if isinstance(stock, str):
                stock = float(stock.replace(',', ''))
            return float(stock)
        return 0
    except Exception as e:
        print(f"Error getting stock level for {item_no}: {e}")
        return 0


def explode_bom_recursive(parent_item_no, parent_qty, max_depth=5, _visited=None):
    """
    Recursively explode BOM to get all purchasable raw materials.
    
    Handles:
    - Assembled items (Item Type = 1) → recursively explode
    - Formula/Blend items (Item Type = 2) → recursively explode (has raw material components)
    - Raw Materials (Item Type = 0) → add to purchase list
    - Phantoms (qty = 0) → skip
    - Labor items → skip
    
    Returns: List of {item_no, description, qty_needed, item_type, preferred_supplier, ...}
    """
    # Prevent infinite recursion
    if _visited is None:
        _visited = set()
    if parent_item_no in _visited:
        print(f"  ⚠️ Circular BOM reference detected: {parent_item_no}")
        return []
    _visited.add(parent_item_no)
    
    if max_depth <= 0:
        print(f"  ⚠️ Max BOM depth reached for: {parent_item_no}")
        return []
    
    # Load BOM data
    all_bom = load_bom_details()
    
    # Get the CURRENT BOM revision for this item (items can have multiple revisions)
    current_revision = get_current_bom_revision(parent_item_no)
    
    # Find BOM lines for this parent, filtered by current revision
    if current_revision is not None:
        # Filter by both parent item AND current revision
        bom_lines = [b for b in all_bom 
                     if b.get('Parent Item No.') == parent_item_no 
                     and str(b.get('Revision No.', '0')) == current_revision]
        print(f"    📋 Using BOM Revision {current_revision} for: {parent_item_no}")
    else:
        # No revision info - fall back to all lines (legacy behavior)
        # But prefer revision "0" if multiple revisions exist
        all_parent_lines = [b for b in all_bom if b.get('Parent Item No.') == parent_item_no]
        revisions = set(str(b.get('Revision No.', '0')) for b in all_parent_lines)
        if len(revisions) > 1:
            # Multiple revisions exist but no current revision info - use highest
            max_rev = max(revisions)
            bom_lines = [b for b in all_parent_lines if str(b.get('Revision No.', '0')) == max_rev]
            print(f"    ⚠️ No current revision set for {parent_item_no}, using highest: {max_rev}")
        else:
            bom_lines = all_parent_lines
    
    if not bom_lines:
        # No BOM - check if this is a purchased item
        item_data = get_item_master(parent_item_no)
        if item_data:
            item_type = item_data.get('item_type', 0)
            # Item Type 0 = Raw Material/Purchased
            if item_type == 0:
                # NOTE: Do NOT skip TOTE/IBC containers - they are real components
                # within formulas and need to be ordered like any other raw material
                
                print(f"    → Purchased item (no BOM): {parent_item_no}")
                return [{
                    'item_no': parent_item_no,
                    'description': item_data.get('description', ''),
                    'qty_needed': parent_qty,
                    'item_type': 'Raw Material',
                    'preferred_supplier': item_data.get('preferred_supplier', ''),
                    'purchasing_units': item_data.get('purchasing_units', 'EA'),
                    'stocking_units': item_data.get('stocking_units', 'EA'),
                    'units_conversion_factor': item_data.get('units_conversion_factor', 1),
                    'order_lead_days': item_data.get('order_lead_days', 7)
                }]
        return []
    
    components = []
    for line in bom_lines:
        component_no = line.get('Component Item No.', '')
        required_qty = float(line.get('Required Quantity', 0))
        
        # Skip phantom lines (qty = 0)
        if required_qty == 0:
            continue
        
        # Skip labor items
        if component_no.upper().startswith('LABOR'):
            continue
        
        qty_needed = required_qty * parent_qty
        
        # Get component item data
        component_data = get_item_master(component_no)
        if not component_data:
            print(f"    ⚠️ Component not found in item master: {component_no}")
            continue
        
        item_type = component_data.get('item_type', 0)
        
        # Item Type: 0 = Raw Material/Purchased, 1 = Assembled, 2 = Formula/Blend
        if item_type in (1, 2):  # Assembled or Formula - recursively explode
            type_name = "assembled" if item_type == 1 else "formula"
            print(f"    📦 Exploding {type_name}: {component_no} (qty: {round(qty_needed, 4)})")
            sub_components = explode_bom_recursive(
                component_no, 
                qty_needed, 
                max_depth - 1,
                _visited.copy()
            )
            components.extend(sub_components)
        else:  # Raw Material (item_type == 0) - add to purchase list
            # NOTE: Do NOT skip TOTE/IBC containers - they are real components
            # within formulas and need to be ordered like any other raw material
            
            components.append({
                'item_no': component_no,
                'description': component_data.get('description', ''),
                'qty_needed': qty_needed,  # In stocking units (kg, L, etc.)
                'item_type': 'Raw Material',
                'preferred_supplier': component_data.get('preferred_supplier', ''),
                'purchasing_units': component_data.get('purchasing_units', 'EA'),
                'stocking_units': component_data.get('stocking_units', 'EA'),
                'units_conversion_factor': component_data.get('units_conversion_factor', 1),
                'order_lead_days': component_data.get('order_lead_days', 7)
            })
    
    return components


def aggregate_components(components):
    """
    Aggregate same components from multiple BOMs.
    If the same item appears in multiple products, sum the quantities.
    """
    aggregated = {}
    for comp in components:
        item_no = comp['item_no']
        if item_no in aggregated:
            # Sum quantities
            aggregated[item_no]['qty_needed'] += comp['qty_needed']
        else:
            aggregated[item_no] = comp.copy()
    
    return list(aggregated.values())


def calculate_inventory_days(last_po_date_str):
    """
    Calculate days since last order date.
    
    Args:
        last_po_date_str: Order date string (various formats possible)
    
    Returns:
        Number of days since last order, or empty string if date not available/parseable
    """
    if not last_po_date_str:
        return ''
    
    try:
        today = datetime.now()
        
        # Try common date formats
        date_formats = [
            '%Y-%m-%d',           # 2025-01-15
            '%m/%d/%Y',            # 01/15/2025
            '%d/%m/%Y',            # 15/01/2025
            '%Y-%m-%d %H:%M:%S',   # 2025-01-15 10:30:00
            '%m/%d/%y',            # 01/15/25
            '%d/%m/%y',            # 15/01/25
        ]
        
        last_order_date = None
        for fmt in date_formats:
            try:
                last_order_date = datetime.strptime(str(last_po_date_str).strip(), fmt)
                break
            except ValueError:
                continue
        
        if last_order_date:
            days_diff = (today - last_order_date).days
            return str(days_diff) if days_diff >= 0 else ''
        else:
            return ''
    except Exception as e:
        print(f"[PR] Error calculating inventory days from '{last_po_date_str}': {e}")
        return ''


def build_pr_cell_values(user_info, items, supplier_info, lead_days):
    """
    Build cell values dictionary for PR template.
    
    CRITICAL: Only fills text cells. NEVER touches:
    - Formulas (I5 Request ID, I16-I29 line totals, I30 grand total)
    - Images/logos
    - Signatures at the bottom
    - Any merged cells structure
    """
    cell_values = {}
    today = datetime.now()
    
    # === HEADER INFO ===
    cell_values['I7'] = user_info.get('name', '')  # Requested By
    cell_values['I9'] = user_info.get('department', 'Sales')  # Department
    cell_values['B5'] = user_info.get('justification', 'Stock Replenishment')  # Justification
    
    # === DATES ===
    cell_values['I11'] = today.strftime('%Y-%m-%d')  # Date Requested
    date_needed = today + timedelta(days=lead_days)
    cell_values['I13'] = date_needed.strftime('%Y-%m-%d')  # Date Needed
    
    # === SUPPLIER INFO ===
    # ALWAYS set all supplier cells - even if empty - to clear old template data!
    # The template has old Lanxess data that needs to be overwritten or cleared
    
    if supplier_info:
        # B9: Vendor Name
        supplier_name = supplier_info.get('name', '')
        supplier_no = supplier_info.get('supplier_no', '')
        cell_values['B9'] = supplier_name if supplier_name else supplier_no
        
        # B11: Contact Name - ALWAYS set (empty string clears old data)
        cell_values['B11'] = supplier_info.get('contact', '')
        
        # B13: Lead Time
        cell_values['B13'] = f"{lead_days} days"
        
        # C11: Email - ALWAYS set (empty string clears old Lanxess email)
        cell_values['C11'] = supplier_info.get('email', '')
        
        # C13: Phone - ALWAYS set (empty string clears old data)
        cell_values['C13'] = supplier_info.get('phone', '')
        
        # Build address string and ALWAYS set it
        address_parts = []
        if supplier_info.get('address'):
            address_parts.append(supplier_info['address'])
        city_province = []
        if supplier_info.get('city'):
            city_province.append(supplier_info['city'])
        if supplier_info.get('province'):
            city_province.append(supplier_info['province'])
        if city_province:
            address_parts.append(', '.join(city_province))
        if supplier_info.get('postal'):
            address_parts.append(supplier_info['postal'])
        
        # C9: Supplier Address (multi-line)
        cell_values['C9'] = '\n'.join(address_parts) if address_parts else ''
    else:
        # No supplier info at all - still clear all supplier cells!
        cell_values['B9'] = ''   # Vendor name
        cell_values['C9'] = ''   # Address
        cell_values['B11'] = ''  # Contact
        cell_values['B13'] = f"{lead_days} days"  # Lead time
        cell_values['C11'] = ''  # Email
        cell_values['C13'] = ''  # Phone
    
    # === LINE ITEMS (Rows 16-29, max 14 items) ===
    start_row = 16
    max_items = 14  # Template has rows 16-29
    
    for idx, item in enumerate(items[:max_items]):
        row = start_row + idx
        
        # B: Item Number
        cell_values[f'B{row}'] = item.get('item_no', '')
        
        # C: Description
        cell_values[f'C{row}'] = item.get('description', '')
        
        # D: Inventory Days (days since last order)
        last_po_date = item.get('last_po_date', '')
        inventory_days = calculate_inventory_days(last_po_date)
        cell_values[f'D{row}'] = inventory_days
        
        # E: Current Stock
        stock = item.get('stock', '')
        if stock != '':
            cell_values[f'E{row}'] = str(round(float(stock), 2))
        
        # F: Purchasing Unit
        cell_values[f'F{row}'] = item.get('purchasing_units', 'EA')
        
        # G: Quantity to Order
        order_qty = item.get('order_qty', 0)
        cell_values[f'G{row}'] = str(int(round(order_qty))) if order_qty else '0'
        
        # H: Unit Price (from most recent PO)
        unit_price = item.get('unit_price', 0)
        if unit_price:
            cell_values[f'H{row}'] = str(round(float(unit_price), 2))
        
        # I: Total - DO NOT SET - Template has formula =G*H
    
    # Clear unused rows (set to empty string so template stays clean)
    num_items = len(items[:max_items])
    for row in range(start_row + num_items, 30):
        for col in ['B', 'C', 'D', 'E', 'F', 'G', 'H']:
            cell_values[f'{col}{row}'] = ''
    
    return cell_values


@pr_service.route('/api/pr/create-from-bom', methods=['POST'])
def create_pr_from_bom():
    """
    Generate multiple Purchase Requisitions from BOM explosion.
    
    Handles:
    - Multiple finished goods (e.g., customer order with 5 products)
    - Recursive BOM explosion (formulas/assembled items)
    - Grouping by supplier
    - One PR per supplier
    - Most recent PO price for each item
    
    Input JSON:
    {
        "user_info": {
            "name": "John Doe",
            "department": "Sales", 
            "justification": "Customer Order #12345"
        },
        "selected_items": [
            {"item_no": "CC SAE30 4T12X600 CASE", "qty": 5},
            {"item_no": "CC 10W40 4L CASE", "qty": 10}
        ],
        "location": "62TODD"
    }
    
    Output: 
    - Single .xlsx if only one supplier
    - .zip file containing multiple .xlsx files if multiple suppliers
    """
    try:
        # Better error handling for request parsing
        if not request.is_json:
            return jsonify({
                "error": "Request must be JSON",
                "content_type": request.content_type,
                "received_data": str(request.data)[:200]
            }), 400
        
        data = request.get_json()
        
        if data is None:
            return jsonify({
                "error": "Invalid JSON in request body",
                "received_data": str(request.data)[:200]
            }), 400
        
        user_info = data.get('user_info', {})
        selected_items = data.get('selected_items', [])
        location = data.get('location', '62TODD')
        
        print("\n" + "="*80)
        print("🔄 BOM-BASED PR GENERATION")
        print("="*80)
        print(f"User: {user_info.get('name', 'N/A')}")
        print(f"Department: {user_info.get('department', 'N/A')}")
        print(f"Justification: {user_info.get('justification', 'N/A')}")
        print(f"Selected Items: {len(selected_items)}")
        for item in selected_items:
            print(f"  - {item.get('item_no')} x {item.get('qty')}")
        print("="*80 + "\n")
        
        if not selected_items:
            return jsonify({
                "error": "No items provided",
                "received_data": {
                    "user_info": user_info,
                    "selected_items_count": len(selected_items),
                    "selected_items": selected_items,
                    "location": location
                }
            }), 400
        
        # ========================================
        # STEP 1: Explode BOMs for all selected items
        # ========================================
        print("📦 Step 1: Exploding BOMs...")
        
        # Check if BOM data is available
        try:
            bom_data = load_bom_details()
            items_data = load_items()
            print(f"✅ Loaded BOM data: {len(bom_data)} lines, Items: {len(items_data)} items")
        except Exception as data_err:
            print(f"❌ Error loading BOM/Items data: {data_err}")
            import traceback
            traceback.print_exc()
            return jsonify({
                "error": "Failed to load BOM or Items data",
                "details": str(data_err),
                "message": "Check if data files are accessible (BillOfMaterialDetails.json, Items.json)"
            }), 500
        
        all_components = []
        for item in selected_items:
            item_no = item.get('item_no', '')
            qty = item.get('qty', 1)
            
            if not item_no:
                print(f"  ⚠️ Skipping item with no item_no: {item}")
                continue
            
            try:
                qty = float(qty)
            except (ValueError, TypeError):
                print(f"  ⚠️ Invalid quantity for {item_no}: {qty}, using 1")
                qty = 1.0
            
            print(f"\n  Exploding: {item_no} (Qty: {qty})")
            try:
                components = explode_bom_recursive(item_no, qty)
                print(f"    → Found {len(components)} purchasable components")
                all_components.extend(components)
            except Exception as explode_err:
                print(f"    ❌ Error exploding BOM for {item_no}: {explode_err}")
                import traceback
                traceback.print_exc()
                # Continue with other items instead of failing completely
                continue
        
        print(f"\n  Total raw components: {len(all_components)}")
        
        if not all_components:
            return jsonify({
                "error": "No purchasable components found in BOM",
                "message": "The selected items may not have BOMs or all components are assembled items"
            }), 400
        
        # ========================================
        # STEP 2: Aggregate quantities for same items
        # ========================================
        print("\n📦 Step 2: Aggregating components...")
        aggregated = aggregate_components(all_components)
        print(f"  Unique components after aggregation: {len(aggregated)}")
        
        # ========================================
        # STEP 3: Get stock levels and determine shortfall
        # ========================================
        print("\n📦 Step 3: Checking stock levels...")
        short_items = []
        for comp in aggregated:
            item_no = comp['item_no']
            qty_needed = comp['qty_needed']
            
            stock = get_stock_level(item_no, location)
            shortfall = max(0, qty_needed - stock)
            
            if shortfall > 0:
                # Get unit conversion info
                stocking_units = comp.get('stocking_units', 'EA')
                purchasing_units = comp.get('purchasing_units', 'EA')
                conversion_factor = comp.get('units_conversion_factor', 1)
                
                # Convert shortfall from stocking units to purchasing units
                # e.g., if shortfall is 1000 kg and conversion is 180 (kg per drum), order 6 drums
                if conversion_factor and conversion_factor > 0:
                    # Shortfall in stocking units / conversion factor = qty in purchasing units
                    order_qty_raw = shortfall / conversion_factor
                    # Round up - can't order partial drums/pails/etc.
                    import math
                    order_qty = math.ceil(order_qty_raw)
                else:
                    order_qty = shortfall
                
                # Get most recent PO price (price is per purchasing unit)
                recent_prices = get_recent_purchase_price(item_no, limit=1)
                if recent_prices:
                    unit_price = recent_prices[0].get('unit_price', 0)
                    last_po_date = recent_prices[0].get('order_date', '')
                else:
                    # Fallback to item master recent cost
                    item_data = get_item_master(item_no)
                    unit_price = item_data.get('recent_cost', 0) if item_data else 0
                    last_po_date = ''
                
                short_items.append({
                    'item_no': item_no,
                    'description': comp['description'],
                    'qty_needed': qty_needed,  # In stocking units
                    'stock': stock,
                    'shortfall': shortfall,  # In stocking units
                    'order_qty': order_qty,  # In purchasing units (converted!)
                    'unit_price': unit_price,
                    'last_po_date': last_po_date,
                    'preferred_supplier': comp.get('preferred_supplier', ''),
                    'purchasing_units': purchasing_units,
                    'stocking_units': stocking_units,
                    'conversion_factor': conversion_factor,
                    'order_lead_days': comp.get('order_lead_days', 7)
                })
                print(f"  ⚠️ SHORT: {item_no} | Need: {round(qty_needed, 2)} {stocking_units} | Have: {round(stock, 2)} | Order: {order_qty} {purchasing_units}")
            else:
                print(f"  ✅ OK: {item_no} | Need: {round(qty_needed, 2)} | Have: {round(stock, 2)}")
        
        if not short_items:
            return jsonify({
                "success": True,
                "message": "All items are in stock - no PRs needed",
                "files": []
            }), 200
        
        # ========================================
        # STEP 4: Group by supplier
        # ========================================
        print("\n📦 Step 4: Grouping by supplier...")
        by_supplier = {}
        no_supplier = []
        
        for item in short_items:
            supplier = item.get('preferred_supplier', '')
            if supplier:
                if supplier not in by_supplier:
                    by_supplier[supplier] = []
                by_supplier[supplier].append(item)
            else:
                no_supplier.append(item)
        
        print(f"  Suppliers found: {len(by_supplier)}")
        for supplier, items_list in by_supplier.items():
            print(f"    - {supplier}: {len(items_list)} items")
        if no_supplier:
            print(f"  ⚠️ Items without supplier: {len(no_supplier)}")
        
        # ========================================
        # STEP 5: Generate one PR per supplier
        # ========================================
        print("\n📦 Step 5: Generating PR files...")
        generated_files = []
        warnings = []
        
        if not os.path.exists(PR_TEMPLATE):
            return jsonify({"error": f"Template not found: {PR_TEMPLATE}"}), 404
        
        for supplier_no, items_list in by_supplier.items():
            print(f"\n  Creating PR for: {supplier_no} ({len(items_list)} items)")
            
            # Get supplier details
            supplier_info = get_supplier_info(supplier_no)
            if supplier_info:
                print(f"    Supplier Name: {supplier_info.get('name', 'N/A')}")
            else:
                print(f"    ⚠️ Supplier info not found, using supplier code only")
                supplier_info = {'name': supplier_no, 'supplier_no': supplier_no}
            
            # Calculate max lead time for this supplier's items
            max_lead_days = max(item.get('order_lead_days', 7) for item in items_list)
            
            # Handle more than 14 items (create multiple PRs)
            item_batches = [items_list[i:i+14] for i in range(0, len(items_list), 14)]
            
            for batch_num, batch in enumerate(item_batches):
                # Build cell values
                cell_values = build_pr_cell_values(
                    user_info=user_info,
                    items=batch,
                    supplier_info=supplier_info,
                    lead_days=max_lead_days
                )
                
                # Generate Excel using direct XML (preserves template 100%)
                pr_output = fill_excel_directly(PR_TEMPLATE, cell_values)
                
                # Generate filename
                supplier_name_safe = re.sub(r'[^\w\-]', '_', supplier_no)[:30]
                filename = f"PR-{datetime.now().strftime('%Y-%m-%d')}-{supplier_name_safe}"
                if len(item_batches) > 1:
                    filename += f"-Part{batch_num + 1}"
                filename += ".xlsx"
                
                generated_files.append({
                    'supplier_no': supplier_no,
                    'supplier_name': supplier_info.get('name', supplier_no) if supplier_info else supplier_no,
                    'filename': filename,
                    'data': pr_output,
                    'item_count': len(batch)
                })
                
                print(f"    ✅ Generated: {filename}")
        
        # Generate PR for items without suppliers (empty supplier info)
        if no_supplier:
            print(f"\n  Creating PR for items without supplier ({len(no_supplier)} items)")
            
            # Use empty supplier info
            supplier_info = None  # Will result in empty supplier fields
            
            # Calculate max lead time for these items
            max_lead_days = max(item.get('order_lead_days', 7) for item in no_supplier) if no_supplier else 7
            
            # Handle more than 14 items (create multiple PRs)
            item_batches = [no_supplier[i:i+14] for i in range(0, len(no_supplier), 14)]
            
            for batch_num, batch in enumerate(item_batches):
                # Build cell values with empty supplier info
                cell_values = build_pr_cell_values(
                    user_info=user_info,
                    items=batch,
                    supplier_info=supplier_info,  # None = empty supplier fields
                    lead_days=max_lead_days
                )
                
                # Generate Excel using direct XML (preserves template 100%)
                pr_output = fill_excel_directly(PR_TEMPLATE, cell_values)
                
                # Generate filename
                filename = f"PR-{datetime.now().strftime('%Y-%m-%d')}-NO-SUPPLIER"
                if len(item_batches) > 1:
                    filename += f"-Part{batch_num + 1}"
                filename += ".xlsx"
                
                generated_files.append({
                    'supplier_no': 'NO-SUPPLIER',
                    'supplier_name': 'No Supplier Assigned',
                    'filename': filename,
                    'data': pr_output,
                    'item_count': len(batch)
                })
                
                print(f"    ✅ Generated: {filename} (no supplier assigned)")
            
            # Add warnings for items without suppliers
            for item in no_supplier:
                warnings.append(f"No preferred supplier for: {item['item_no']} - Please assign supplier manually")
        
        # ========================================
        # STEP 5.5: Generate Shortage Report
        # ========================================
        print("\n📦 Step 5.5: Generating shortage report...")
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("PURCHASE REQUISITION - SHORTAGE REPORT")
        report_lines.append("=" * 80)
        report_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"Requested By: {user_info.get('name', 'N/A')}")
        report_lines.append(f"Justification: {user_info.get('justification', 'N/A')}")
        report_lines.append(f"Lead Time: {user_info.get('lead_time', 7)} days")
        report_lines.append("")
        
        # Summary section
        report_lines.append("-" * 80)
        report_lines.append("SUMMARY")
        report_lines.append("-" * 80)
        report_lines.append(f"Items Ordered: {len(selected_items)}")
        report_lines.append(f"Total Short Components: {len(short_items)}")
        report_lines.append(f"Unique Suppliers: {len(by_supplier)}")
        report_lines.append(f"Items Without Supplier: {len(no_supplier)} (PR generated with empty supplier - manual assignment needed)")
        report_lines.append("")
        
        # Selected items section
        report_lines.append("-" * 80)
        report_lines.append("ITEMS ORDERED")
        report_lines.append("-" * 80)
        for item in selected_items:
            report_lines.append(f"  • {item.get('item_no')} x {item.get('qty')}")
        report_lines.append("")
        
        # Shortage details by supplier
        report_lines.append("-" * 80)
        report_lines.append("SHORTAGE DETAILS BY SUPPLIER")
        report_lines.append("-" * 80)
        
        for supplier_no, items_list in by_supplier.items():
            supplier_info = get_supplier_info(supplier_no)
            supplier_name = supplier_info.get('name', supplier_no) if supplier_info else supplier_no
            
            report_lines.append(f"\n📦 SUPPLIER: {supplier_name} ({supplier_no})")
            report_lines.append("  " + "-" * 70)
            
            supplier_total = 0
            for item in items_list:
                item_no = item.get('item_no', '')
                description = item.get('description', '')[:40]
                qty_needed = item.get('qty_needed', 0)
                stock = item.get('stock', 0)
                shortfall = item.get('shortfall', 0)
                order_qty = item.get('order_qty', 0)
                unit_price = item.get('unit_price', 0)
                stocking_units = item.get('stocking_units', 'EA')
                purchasing_units = item.get('purchasing_units', 'EA')
                conversion_factor = item.get('conversion_factor', 1)
                line_total = order_qty * unit_price
                supplier_total += line_total
                
                report_lines.append(f"  Item: {item_no}")
                report_lines.append(f"    Description: {description}")
                report_lines.append(f"    Needed: {round(qty_needed, 2):,.2f} {stocking_units} | In Stock: {round(stock, 2):,.2f} {stocking_units} | Short: {round(shortfall, 2):,.2f} {stocking_units}")
                if conversion_factor and conversion_factor != 1:
                    report_lines.append(f"    Conversion: 1 {purchasing_units} = {conversion_factor} {stocking_units}")
                report_lines.append(f"    Order: {int(order_qty)} {purchasing_units} x ${unit_price:,.2f} = ${line_total:,.2f}")
                report_lines.append("")
            
            report_lines.append(f"  SUPPLIER TOTAL: ${supplier_total:,.2f}")
        
        # Items without supplier (PR generated with empty supplier)
        if no_supplier:
            report_lines.append(f"\n⚠️ ITEMS WITHOUT SUPPLIER (PR Generated - Supplier Needs Manual Assignment)")
            report_lines.append("  " + "-" * 70)
            for item in no_supplier:
                item_no = item.get('item_no', '')
                description = item.get('description', '')[:40]
                qty_needed = item.get('qty_needed', 0)
                stock = item.get('stock', 0)
                shortfall = item.get('shortfall', 0)
                order_qty = item.get('order_qty', 0)
                unit_price = item.get('unit_price', 0)
                stocking_units = item.get('stocking_units', 'EA')
                purchasing_units = item.get('purchasing_units', 'EA')
                line_total = order_qty * unit_price
                
                report_lines.append(f"  Item: {item_no}")
                report_lines.append(f"    Description: {description}")
                report_lines.append(f"    Needed: {round(qty_needed, 2):,.2f} {stocking_units} | In Stock: {round(stock, 2):,.2f} {stocking_units} | Short: {round(shortfall, 2):,.2f} {stocking_units}")
                report_lines.append(f"    Order: {int(order_qty)} {purchasing_units} x ${unit_price:,.2f} = ${line_total:,.2f}")
                report_lines.append("")
        
        report_lines.append("")
        report_lines.append("=" * 80)
        report_lines.append("END OF REPORT")
        report_lines.append("=" * 80)
        
        shortage_report = "\n".join(report_lines)
        print("  ✅ Shortage report generated")
        
        # ========================================
        # STEP 5.6: Save to PR History
        # ========================================
        print("\n📋 Step 5.6: Saving to PR history...")
        try:
            pr_id = f"PR-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            
            # Build supplier summary for history
            supplier_summary = []
            for supplier_no, items_list in by_supplier.items():
                supplier_info = get_supplier_info(supplier_no)
                supplier_summary.append({
                    'supplier_no': supplier_no,
                    'supplier_name': supplier_info.get('name', supplier_no) if supplier_info else supplier_no,
                    'item_count': len(items_list)
                })
            
            # Calculate total value
            total_value = sum(
                item.get('order_qty', 0) * item.get('unit_price', 0) 
                for item in short_items
            )
            
            # Build full component breakdown for history (includes TOTE/IBC)
            component_breakdown = []
            for comp in aggregated:
                component_breakdown.append({
                    'item_no': comp['item_no'],
                    'description': comp.get('description', ''),
                    'qty_needed': round(comp['qty_needed'], 4),
                    'stocking_units': comp.get('stocking_units', 'EA'),
                    'purchasing_units': comp.get('purchasing_units', 'EA'),
                    'is_short': any(s['item_no'] == comp['item_no'] for s in short_items)
                })
            
            # Build short items detail for history
            short_items_detail = []
            for item in short_items:
                short_items_detail.append({
                    'item_no': item['item_no'],
                    'description': item.get('description', ''),
                    'qty_needed': round(item['qty_needed'], 4),
                    'stock': round(item.get('stock', 0), 4),
                    'shortfall': round(item.get('shortfall', 0), 4),
                    'order_qty': item.get('order_qty', 0),
                    'unit_price': round(item.get('unit_price', 0), 2),
                    'stocking_units': item.get('stocking_units', 'EA'),
                    'purchasing_units': item.get('purchasing_units', 'EA'),
                    'preferred_supplier': item.get('preferred_supplier', '')
                })
            
            pr_record = {
                'id': pr_id,
                'date': datetime.now().strftime('%Y-%m-%d'),
                'time': datetime.now().strftime('%H:%M:%S'),
                'user': user_info.get('name', 'Unknown'),
                'department': user_info.get('department', 'N/A'),
                'justification': user_info.get('justification', 'N/A'),
                'lead_time': user_info.get('lead_time', 7),
                'items_requested': selected_items,
                'suppliers': supplier_summary,
                'total_prs_generated': len(generated_files),
                'total_components_short': len(short_items),
                'items_without_supplier': len(no_supplier),
                'total_value': round(total_value, 2),
                'status': 'completed',
                'files': [f.get('filename') for f in generated_files],
                # NEW: Full component breakdown for batch planning
                'component_breakdown': component_breakdown,
                'short_items_detail': short_items_detail
            }
            
            add_pr_to_history(pr_record)
            print(f"  ✅ PR history saved: {pr_id}")
        except Exception as hist_err:
            print(f"  ⚠️ Failed to save PR history (non-critical): {hist_err}")
        
        # ========================================
        # STEP 6: Return files
        # ========================================
        print(f"\n📦 Step 6: Returning {len(generated_files)} PR file(s)...")
        
        if len(generated_files) == 0:
            return jsonify({
                "success": False,
                "message": "No PRs generated - all items missing suppliers",
                "warnings": warnings
            }), 400
        
        elif len(generated_files) == 1:
            # Single file - return as ZIP with report
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                file = generated_files[0]
                file['data'].seek(0)
                zf.writestr(file['filename'], file['data'].read())
                # Add shortage report
                report_filename = f"Shortage_Report_{datetime.now().strftime('%Y-%m-%d')}.txt"
                zf.writestr(report_filename, shortage_report)
            
            zip_buffer.seek(0)
            zip_filename = f"PR-{datetime.now().strftime('%Y-%m-%d')}-{file['supplier_name'][:20]}.zip"
            
            print(f"\n✅ SUCCESS: Generated ZIP with PR and shortage report")
            return send_file(
                zip_buffer,
                mimetype='application/zip',
                as_attachment=True,
                download_name=zip_filename
            )
        
        else:
            # Multiple files - return as ZIP with report
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                for file in generated_files:
                    file['data'].seek(0)
                    zf.writestr(file['filename'], file['data'].read())
                # Add shortage report
                report_filename = f"Shortage_Report_{datetime.now().strftime('%Y-%m-%d')}.txt"
                zf.writestr(report_filename, shortage_report)
            
            zip_buffer.seek(0)
            zip_filename = f"PRs-{datetime.now().strftime('%Y-%m-%d')}-{len(generated_files)}_Suppliers.zip"
            
            print(f"\n✅ SUCCESS: Generated ZIP with {len(generated_files)} PRs")
            if warnings:
                print(f"⚠️ Warnings: {warnings}")
            
            return send_file(
                zip_buffer,
                mimetype='application/zip',
                as_attachment=True,
                download_name=zip_filename
            )
        
    except Exception as e:
        print(f"❌ Error in create_pr_from_bom: {e}")
        import traceback
        error_trace = traceback.format_exc()
        print(error_trace)
        return jsonify({
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": error_trace
        }), 500


@pr_service.route('/api/pr/history', methods=['GET'])
def get_pr_history():
    """
    Get PR generation history for the last 30 days.
    
    Returns:
    {
        "history": [
            {
                "id": "PR-2026-01-02-123456",
                "date": "2026-01-02",
                "time": "14:30:25",
                "user": "John Doe",
                "department": "Sales",
                "justification": "Customer Order #12345",
                "items_requested": [
                    {"item_no": "CC SAE30 4T12X600 CASE", "qty": 5}
                ],
                "suppliers": [
                    {"supplier_no": "BRENNTAG USD", "supplier_name": "BRENNTAG CANADA INC. USD", "item_count": 3}
                ],
                "total_prs_generated": 2,
                "total_components_short": 5,
                "status": "completed"
            }
        ]
    }
    """
    try:
        history = load_pr_history()
        return jsonify({
            "success": True,
            "history": history,
            "count": len(history)
        })
    except Exception as e:
        print(f"[PR] Error getting history: {e}")
        return jsonify({"error": str(e), "history": []}), 500


@pr_service.route('/api/pr/search-items', methods=['GET'])
def search_items():
    """Smart search for items with predictions"""
    try:
        query = request.args.get('q', '').lower()
        limit = int(request.args.get('limit', 20))
        
        if not query or len(query) < 2:
            return jsonify({"results": []})
        
        items = load_items()
        matches = []
        
        for item in items:
            item_no = str(item.get('Item No.', '')).lower()
            description = str(item.get('Description', '')).lower()
            
            # Score matches
            score = 0
            if query in item_no:
                score += 100
            if query in description:
                score += 50
            if item_no.startswith(query):
                score += 200
            
            if score > 0:
                matches.append({
                    'score': score,
                    'item_no': item.get('Item No.'),
                    'description': item.get('Description'),
                    'recent_cost': item.get('Recent Cost', 0),
                    'standard_cost': item.get('Standard Cost', 0),
                    'stocking_units': item.get('Stocking Units', 'EA'),
                    'purchasing_units': item.get('Purchasing Units', 'EA'),
                    'preferred_supplier': item.get('Preferred Supplier Number', ''),
                    'reorder_quantity': item.get('Reorder Quantity', 0),
                    'minimum': item.get('Minimum', 0),
                    'reorder_level': item.get('Reorder Level', 0)
                })
        
        # Sort by score and limit
        matches.sort(key=lambda x: x['score'], reverse=True)
        results = matches[:limit]
        
        # Remove score from results
        for r in results:
            del r['score']
        
        return jsonify({"results": results})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pr_service.route('/api/pr/item-details/<item_no>', methods=['GET'])
def get_item_details(item_no):
    """Get complete details for an item"""
    try:
        items = load_items()
        item = next((i for i in items if i.get('Item No.') == item_no), None)
        
        if not item:
            return jsonify({"error": "Item not found"}), 404
        
        return jsonify({
            "item_no": item.get('Item No.'),
            "description": item.get('Description'),
            "extended_description": item.get('Extended Description', ''),
            "recent_cost": item.get('Recent Cost', 0),
            "standard_cost": item.get('Standard Cost', 0),
            "average_cost": item.get('Average Cost', 0),
            "landed_cost": item.get('Landed Cost', 0),
            "stocking_units": item.get('Stocking Units', 'EA'),
            "purchasing_units": item.get('Purchasing Units', 'EA'),
            "preferred_supplier": item.get('Preferred Supplier Number', ''),
            "preferred_location": item.get('Preferred Location Number', ''),
            "minimum": item.get('Minimum', 0),
            "maximum": item.get('Maximum', 0),
            "reorder_level": item.get('Reorder Level', 0),
            "reorder_quantity": item.get('Reorder Quantity', 0)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pr_service.route('/api/pr/item-pricing/<item_no>', methods=['GET'])
def get_item_pricing(item_no):
    """Get recent purchase prices for an item"""
    try:
        recent_prices = get_recent_purchase_price(item_no, 5)
        
        if not recent_prices:
            return jsonify({
                "item_no": item_no,
                "recent_prices": [],
                "message": "No recent purchase history found"
            })
        
        return jsonify({
            "item_no": item_no,
            "recent_prices": recent_prices,
            "latest_price": recent_prices[0]['unit_price'] if recent_prices else 0
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pr_service.route('/api/pr/item-enhanced/<item_no>', methods=['GET'])
def get_item_enhanced(item_no):
    """Get item details with recent pricing and supplier information"""
    try:
        items = load_items()
        item = next((i for i in items if i.get('Item No.') == item_no), None)
        
        if not item:
            return jsonify({"error": "Item not found"}), 404
        
        # Get recent purchase prices
        recent_prices = get_recent_purchase_price(item_no, 3)
        
        # Get supplier info if preferred supplier exists
        supplier_info = None
        preferred_supplier = item.get('Preferred Supplier Number', '')
        if preferred_supplier:
            supplier_info = get_supplier_info(preferred_supplier)
        
        return jsonify({
            "item_no": item.get('Item No.'),
            "description": item.get('Description'),
            "recent_cost": item.get('Recent Cost', 0),
            "standard_cost": item.get('Standard Cost', 0),
            "preferred_supplier": preferred_supplier,
            "recent_prices": recent_prices,
            "supplier_info": supplier_info,
            "reorder_quantity": item.get('Reorder Quantity', 0),
            "minimum": item.get('Minimum', 0),
            "reorder_level": item.get('Reorder Level', 0),
            "stocking_units": item.get('Stocking Units', 'EA'),
            "purchasing_units": item.get('Purchasing Units', 'EA')
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pr_service.route('/api/pr/generate', methods=['POST'])
def generate_requisition():
    """Generate filled Purchase Requisition Excel file using DIRECT XML editing"""
    try:
        # Better error handling for request parsing
        if not request.is_json:
            return jsonify({
                "error": "Request must be JSON",
                "content_type": request.content_type,
                "received_data": str(request.data)[:200]
            }), 400
        
        data = request.get_json()
        
        if data is None:
            return jsonify({
                "error": "Invalid JSON in request body",
                "received_data": str(request.data)[:200]
            }), 400
        
        # Required fields
        user_info = data.get('user_info', {})
        items = data.get('items', [])
        supplier = data.get('supplier', {})
        
        print("\n" + "="*80)
        print("🔍 PR GENERATION (Direct XML - No openpyxl save)")
        print("="*80)
        print(f"User Info: {user_info}")
        print(f"Items Count: {len(items)}")
        print(f"Items: {items}")
        print(f"Supplier: {supplier.get('name', 'N/A')}")
        print(f"Template Path: {PR_TEMPLATE}")
        print(f"Template Exists: {os.path.exists(PR_TEMPLATE)}")
        print("="*80 + "\n")
        
        if not items:
            return jsonify({
                "error": "No items provided",
                "received_data": {
                    "user_info": user_info,
                    "items_count": len(items),
                    "items": items,
                    "supplier": supplier
                }
            }), 400
        
        if not os.path.exists(PR_TEMPLATE):
            return jsonify({
                "error": "Template not found",
                "template_path": PR_TEMPLATE,
                "current_dir": _current_dir
            }), 404
        
        # Build cell values dictionary
        cell_values = {}
        today = datetime.now()
        
        # User info
        cell_values['I7'] = user_info.get('name', 'Haron Alhakimi')
        cell_values['I9'] = user_info.get('department', 'Sales')
        cell_values['B5'] = user_info.get('justification', 'Low Stock')
        cell_values['B13'] = user_info.get('lead_time', '4 weeks')
        
        # Dates
        cell_values['I11'] = today.strftime('%Y-%m-%d')
        try:
            lead_time_weeks = int(user_info.get('lead_time', '4').split()[0])
        except:
            lead_time_weeks = 4
        date_needed = today + timedelta(weeks=lead_time_weeks)
        cell_values['I13'] = date_needed.strftime('%Y-%m-%d')
        
        # Auto-detect supplier from first item
        auto_supplier_info = None
        if items:
            first_item = items[0]
            item_no = first_item.get('item_no', '')
            recent_prices = get_recent_purchase_price(item_no, limit=1)
            
            if recent_prices:
                latest_purchase = recent_prices[0]
                supplier_no = latest_purchase.get('supplier_no', '')
                supplier_info = get_supplier_info(supplier_no)
                
                if supplier_info:
                    auto_supplier_info = {
                        'name': latest_purchase.get('supplier_name', ''),
                        'contact': latest_purchase.get('contact', ''),
                        'email': supplier_info.get('email', ''),
                        'phone': supplier_info.get('phone', ''),
                        'terms': latest_purchase.get('terms', '')
                    }
                    print(f"✅ AUTO-DETECTED SUPPLIER: {auto_supplier_info['name']}")
        
        # Supplier info
        if auto_supplier_info:
            supplier_name = auto_supplier_info.get('name', '')
            supplier_contact = auto_supplier_info.get('contact', '')
            supplier_email = auto_supplier_info.get('email', '')
            supplier_phone = auto_supplier_info.get('phone', '')
            supplier_terms = auto_supplier_info.get('terms', '')
        else:
            supplier_name = supplier.get('name', '')
            supplier_contact = supplier.get('contact', '')
            supplier_email = supplier.get('email', '')
            supplier_phone = supplier.get('phone', '')
            supplier_terms = supplier.get('terms', '')
        
        if supplier_name:
            cell_values['B9'] = supplier_name
        
        if supplier_contact:
            contact_with_phone = supplier_contact
            if supplier_phone:
                contact_with_phone += f" | {supplier_phone}"
            cell_values['B11'] = contact_with_phone
        elif supplier_phone:
            cell_values['B11'] = supplier_phone
        
        # Address
        address = supplier.get('address', {})
        if address:
            address_parts = []
            address_line_1 = address.get('Line_1', '') or address.get('Address', '')
            city = address.get('City', '')
            state = address.get('State', '')
            postal_code = address.get('Postal_Code', '')
            country = address.get('Country', '')
            
            if address_line_1:
                address_parts.append(address_line_1)
            city_state_zip = ', '.join(filter(None, [city, state, postal_code]))
            if city_state_zip:
                address_parts.append(city_state_zip)
            if country:
                address_parts.append(country)
            
            if address_parts:
                cell_values['C9'] = '\n'.join(address_parts)
        
        if supplier_email:
            cell_values['C11'] = supplier_email
        elif supplier_terms:
            cell_values['C11'] = f"Terms: {supplier_terms}"
        
        # Line items (rows 16-25)
        start_row = 16
        num_items = min(len(items), 10)
        
        for idx, item in enumerate(items[:10]):
            row = start_row + idx
            
            item_no = item.get('item_no', '')
            description = item.get('description', '')
            current_stock = item.get('current_stock', '')
            unit = item.get('unit', 'EA')
            quantity = item.get('quantity', 0)
            unit_price = item.get('unit_price', 0)
            
            # Get real data
            if item_no:
                recent_prices = get_recent_purchase_price(item_no, limit=1)
                if recent_prices:
                    item_pricing = recent_prices[0]
                    if not unit_price or unit_price == 0:
                        unit_price = item_pricing.get('unit_price', 0)
                    if not unit or unit == 'EA':
                        unit = item_pricing.get('purchase_unit', unit)
                
                inventory_data = get_inventory_data(item_no)
                if inventory_data:
                    current_stock = inventory_data.get('stock', 0)
                    if not unit_price or unit_price == 0:
                        unit_price = inventory_data.get('recent_cost', 0)
            
            cell_values[f'B{row}'] = item_no
            cell_values[f'C{row}'] = description
            cell_values[f'E{row}'] = str(current_stock) if current_stock else ''
            cell_values[f'F{row}'] = unit
            cell_values[f'G{row}'] = str(int(quantity)) if quantity else '0'
            cell_values[f'H{row}'] = str(round(float(unit_price), 2)) if unit_price else '0'
            cell_values[f'I{row}'] = f'=G{row}*H{row}'
            
            print(f"[PR] Row {row}: {item_no} | Qty: {quantity} | Price: ${unit_price}")
        
        # Clear unused rows
        for row in range(start_row + num_items, 26):
            for col in ['B', 'C', 'D', 'E', 'F', 'G', 'H']:
                cell_values[f'{col}{row}'] = ''
        
        # Total formula
        last_item_row = start_row + num_items - 1
        cell_values['I30'] = f'=SUM(I16:I{last_item_row})'
        
        print(f"[PR] Filling {num_items} items using DIRECT XML editing")
        
        # Generate file using direct XML editing (preserves ALL template structure)
        output = fill_excel_directly(PR_TEMPLATE, cell_values)
        
        filename = f"PR_{today.strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ Error generating requisition: {e}")
        import traceback
        error_trace = traceback.format_exc()
        print(error_trace)
        return jsonify({
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": error_trace
        }), 500


@pr_service.route('/api/pr/from-po/<po_number>', methods=['POST'])
def generate_from_po(po_number):
    """Generate requisition from existing PO data"""
    try:
        # Better error handling for request parsing
        if not request.is_json:
            return jsonify({
                "error": "Request must be JSON",
                "content_type": request.content_type
            }), 400
        
        data = request.get_json()
        
        if data is None:
            return jsonify({
                "error": "Invalid JSON in request body"
            }), 400
        
        user_info = data.get('user_info', {})
        selected_items = data.get('items', [])  # Items with quantities updated by user
        
        print(f"\n[PR FROM PO] PO Number: {po_number}")
        print(f"[PR FROM PO] User Info: {user_info}")
        print(f"[PR FROM PO] Selected Items Count: {len(selected_items)}")
        
        # Load PO data
        po = load_po_data(po_number)
        if not po:
            return jsonify({"error": f"PO {po_number} not found"}), 404
        
        # Prepare supplier info from PO (merged PO data structure)
        supplier = {
            'name': po.get('Supplier', {}).get('Name', ''),
            'contact': po.get('Supplier', {}).get('Contact', ''),
            'email': po.get('Supplier', {}).get('Email', ''),
            'phone': po.get('Supplier', {}).get('Phone', '') or po.get('Supplier', {}).get('Phone_No', '') or po.get('Supplier', {}).get('Telephone', ''),
            'address': po.get('Shipping_Billing', {}).get('Ship_To_Address', {}) or po.get('Shipping_Billing', {}).get('Bill_To_Address', {})
        }
        
        # Also try to get supplier info from merged PO data using supplier number
        supplier_no = po.get('Supplier', {}).get('Supplier_No', '')
        if supplier_no:
            supplier_info = get_supplier_info(supplier_no)
            if supplier_info:
                # Enhance supplier info with data from get_supplier_info
                supplier['email'] = supplier.get('email') or supplier_info.get('email', '')
                supplier['phone'] = supplier.get('phone') or supplier_info.get('phone', '')
                supplier['terms'] = supplier_info.get('terms', '')
        
        print(f"[PR FROM PO] Supplier: {supplier.get('name')} | Contact: {supplier.get('contact')}")
        
        # Prepare items - use user-selected items or all from PO
        items_to_add = []
        if selected_items:
            # User provided specific items with quantities
            for sel_item in selected_items:
                items_to_add.append({
                    'item_no': sel_item['item_no'],
                    'description': sel_item['description'],
                    'unit': sel_item.get('unit', 'EA'),
                    'quantity': sel_item['quantity'],
                    'unit_price': sel_item.get('unit_price', 0),
                    'current_stock': sel_item.get('current_stock', ''),
                    'inventory_turnover': sel_item.get('inventory_turnover', '')
                })
        else:
            # Use all items from PO
            for item in po.get('Line_Items', []):
                unit_price = item.get('Item_Master', {}).get('Cost_History', {}).get('Recent_Cost', 0)
                if unit_price == 0:
                    unit_price = item['Pricing']['Unit_Cost']
                
                items_to_add.append({
                    'item_no': item['Item_No'],
                    'description': item['Description'],
                    'unit': item['Pricing']['Purchase_Unit_of_Measure'],
                    'quantity': item['Pricing']['Quantity_Ordered'],
                    'unit_price': unit_price,
                    'current_stock': '',
                    'inventory_turnover': ''
                })
        
        # Generate requisition
        return generate_requisition_internal(user_info, items_to_add, supplier)
        
    except Exception as e:
        print(f"Error generating from PO: {e}")
        return jsonify({"error": str(e)}), 500


def generate_requisition_internal(user_info, items, supplier):
    """
    Internal function to generate requisition
    Uses the same logic as generate_requisition() but accepts pre-prepared data
    """
    try:
        # Load template with all formatting preserved
        if not os.path.exists(PR_TEMPLATE):
            return jsonify({"error": "Template not found"}), 404
        
        try:
            # DO NOT use keep_vba=True as it corrupts non-VBA xlsx files
            wb = openpyxl.load_workbook(PR_TEMPLATE, data_only=False)
        except Exception as e:
            print(f"Error loading template: {e}")
            return jsonify({"error": f"Failed to load template: {str(e)}"}), 500
        
        sheet = wb['Purchase Requisition']
        
        # Fill user info (CORRECT CELLS FROM TEMPLATE - same as main function)
        sheet['I7'] = user_info.get('name', 'Haron Alhakimi')  # I7: REQUESTED BY
        sheet['I9'] = user_info.get('department', 'Sales')  # I9: DEPARTMENT
        sheet['B5'] = user_info.get('justification', 'Low Stock')  # B5: JUSTIFICATION
        sheet['B13'] = user_info.get('lead_time', '4 weeks')  # B13: LEAD TIME
        
        # Fill dates
        today = datetime.now()
        sheet['I11'] = today.strftime('%Y-%m-%d')  # I11: DATE REQUESTED
        
        # Calculate date needed (add lead time weeks)
        try:
            lead_time_weeks = int(user_info.get('lead_time', '4').split()[0])
        except:
            lead_time_weeks = 4
        date_needed = today + timedelta(weeks=lead_time_weeks)
        sheet['I13'] = date_needed.strftime('%Y-%m-%d')  # I13: DATE NEEDED
        
        # Fill supplier info (CORRECT CELLS FROM TEMPLATE)
        supplier_name = supplier.get('name', '')
        supplier_contact = supplier.get('contact', '')
        supplier_email = supplier.get('email', '')
        supplier_phone = supplier.get('phone', '')
        supplier_terms = supplier.get('terms', '')
        
        # === VENDOR INFO (Based on actual template layout) ===
        # B9: Vendor Name
        if supplier_name:
            sheet['B9'] = supplier_name
        
        # B11: Contact Name (with phone if available)
        if supplier_contact:
            contact_with_phone = supplier_contact
            if supplier_phone:
                contact_with_phone += f" | {supplier_phone}"
            sheet['B11'] = contact_with_phone
        elif supplier_phone:
            sheet['B11'] = supplier_phone
        
        # === VENDOR ADDRESS (Column C) ===
        address = supplier.get('address', {})
        
        # Build full address string
        address_parts = []
        
        if address:
            address_line_1 = address.get('Line_1', '') or address.get('Address', '')
            city = address.get('City', '')
            state = address.get('State', '') or address.get('Province', '')
            postal_code = address.get('Postal_Code', '') or address.get('PostalCode', '')
            country = address.get('Country', '')
            
            if address_line_1:
                address_parts.append(address_line_1)
            
            # City, State, Postal
            city_state_zip = []
            if city:
                city_state_zip.append(city)
            if state:
                city_state_zip.append(state)
            if postal_code:
                city_state_zip.append(postal_code)
            if city_state_zip:
                address_parts.append(', '.join(city_state_zip))
            
            if country:
                address_parts.append(country)
        
        # C9: Full Address (multi-line)
        if address_parts:
            sheet['C9'] = '\n'.join(address_parts)
        elif supplier_name:
            sheet['C9'] = 'Address not available'
        
        # C11: Email
        if supplier_email:
            sheet['C11'] = supplier_email
        elif supplier_terms:
            sheet['C11'] = f"Terms: {supplier_terms}"
        
        # Fill line items - starting at row 16 (same as main function)
        start_row = 16
        for idx, item in enumerate(items):
            if idx >= 10:  # Limit to 10 items
                break
            
            row = start_row + idx
            
            # Clear only this specific row's data cells before filling
            for col in ['B', 'C', 'D', 'E', 'F', 'G', 'H']:
                sheet[f'{col}{row}'].value = ''
            
            item_no = item.get('item_no', '')
            description = item.get('description', '')
            current_stock = item.get('current_stock', '')
            unit = item.get('unit', 'EA')
            quantity = item.get('quantity', 0)
            unit_price = item.get('unit_price', 0)
            
            # Get real pricing and inventory data if item_no is available
            item_pricing_data = None
            inventory_data = None
            if item_no:
                recent_prices = get_recent_purchase_price(item_no, limit=1)
                if recent_prices:
                    item_pricing_data = recent_prices[0]
                    if not unit_price or unit_price == 0:
                        unit_price = item_pricing_data.get('unit_price', 0)
                    if not unit or unit == 'EA':
                        unit = item_pricing_data.get('purchase_unit', unit)
                
                inventory_data = get_inventory_data(item_no)
                if inventory_data:
                    current_stock = inventory_data.get('stock', 0)
                    print(f"[PR INTERNAL] Using real inventory data (Qty On Hand): Stock = {current_stock}")
                    if not unit_price or unit_price == 0:
                        unit_price = inventory_data.get('recent_cost', 0)
                    if not unit or unit == 'EA':
                        unit = inventory_data.get('purchasing_units', unit)
            
            sheet[f'B{row}'] = item_no
            sheet[f'C{row}'] = description
            
            # D: Add supplier item number if available
            if item_pricing_data and item_pricing_data.get('supplier_item_no'):
                sheet[f'D{row}'] = item_pricing_data.get('supplier_item_no', '')
            
            sheet[f'E{row}'] = current_stock
            sheet[f'F{row}'] = unit
            sheet[f'G{row}'] = int(quantity) if quantity else 0
            sheet[f'H{row}'] = round(float(unit_price), 2) if unit_price else 0.0
        
        # Fix formulas for item rows
        num_items = len(items[:10])
        for idx in range(num_items):
            row = 16 + idx
            sheet[f'I{row}'] = f'=G{row}*H{row}'
        
        # Clear unused item rows
        for row in range(16 + num_items, 26):
            for col in ['B', 'C', 'D', 'E', 'F', 'G', 'H']:
                sheet[f'{col}{row}'].value = ''
        
        # Update TOTAL row formula
        last_item_row = 16 + num_items - 1
        if num_items > 0:
            sheet['I30'] = f'=SUM(I16:I{last_item_row})'
        
        # Save to memory
        output = io.BytesIO()
        try:
            wb.save(output)
            output.seek(0)
            
            # Verify the file was saved correctly
            if output.getvalue() is None or len(output.getvalue()) == 0:
                raise Exception("Workbook save resulted in empty file")
            
            # Restore VML drawings, images, and other template components
            output = preserve_template_structure(PR_TEMPLATE, output)
            
            filename = f"PR_{today.strftime('%Y%m%d_%H%M%S')}.xlsx"
            
            return send_file(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=filename
            )
        except Exception as e:
            print(f"Error saving workbook: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"error": f"Failed to save Excel file: {str(e)}"}), 500
        finally:
            # Ensure workbook is closed
            try:
                wb.close()
            except:
                pass
                
    except Exception as e:
        print(f"Error in generate_requisition_internal: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to generate requisition: {str(e)}"}), 500


@pr_service.route('/api/pr/supplier/<supplier_no>', methods=['GET'])
def get_supplier_details(supplier_no):
    """Get full supplier details from most recent PO"""
    try:
        # Use helper function to get robust supplier info
        supplier_info = get_supplier_info(supplier_no)
        
        if not supplier_info:
            # Fallback if helper fails (e.g. invalid supplier number)
            return jsonify({
                'supplier_no': supplier_no,
                'error': 'Supplier not found in PO history',
                'note': 'Please enter supplier details manually'
            }), 404
            
        # Add note only if address is actually missing
        if not supplier_info.get('address'):
            supplier_info['note'] = 'Supplier address not available in system - please enter manually'
        
        return jsonify(supplier_info)
        
    except Exception as e:
        print(f"Error getting supplier details: {e}")
        return jsonify({"error": str(e)}), 500

