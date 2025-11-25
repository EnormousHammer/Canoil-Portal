from flask import Flask, jsonify, request, Response
from flask_cors import CORS
# from flask_compress import Compress  # Temporarily disabled - causing startup issues
import os
import gzip

# Fix Unicode encoding issues for Windows
import codecs
import sys
import io

# Set UTF-8 encoding for all output
# Only wrap stdout/stderr if not on Vercel (can cause issues on serverless)
IS_VERCEL = os.getenv('VERCEL') == '1' or os.getenv('VERCEL_ENV') is not None
if not IS_VERCEL:
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except (AttributeError, OSError):
        # Already wrapped or not available (e.g., on Vercel)
        pass

# Also set environment variable for Python
os.environ['PYTHONIOENCODING'] = 'utf-8'
import json
import base64
import re
import time
from datetime import datetime, timedelta
from typing import List
import glob
from pathlib import Path
from dotenv import load_dotenv
import PyPDF2
import pdfplumber
from docx import Document
import tempfile
import shutil
import pickle
# Import enterprise analytics safely - it might fail if dependencies are missing
try:
    from enterprise_analytics import EnterpriseAnalytics
    ENTERPRISE_ANALYTICS_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Enterprise Analytics not available: {e}")
    EnterpriseAnalytics = None
    ENTERPRISE_ANALYTICS_AVAILABLE = False

# Load environment variables
load_dotenv()

# Debug flag for SO parsing
DEBUG_SO = True  # Temporarily enabled for debugging

# ============================================================
# SAFE JSON WRITER - PREVENTS CORRUPTION
# ============================================================

def safe_json_write(file_path, data, indent=2):
    """
    Safely write JSON to prevent corruption from crashes/interruptions
    
    Uses atomic writes:
    1. Write to temporary file
    2. Validate JSON is complete
    3. Backup existing file
    4. Atomically rename temp to target
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Create temp file in same directory (for atomic rename)
        temp_fd, temp_path = tempfile.mkstemp(
            dir=os.path.dirname(file_path),
            prefix='.tmp_',
            suffix='.json'
        )
        
        try:
            # Write to temp file
            with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=indent, default=str, ensure_ascii=False)
            
            # Validate JSON can be read back
            with open(temp_path, 'r', encoding='utf-8') as f:
                json.load(f)  # Will raise exception if corrupted
            
            # Backup existing file if it exists
            if os.path.exists(file_path):
                backup_path = file_path + '.backup'
                try:
                    shutil.copy2(file_path, backup_path)
                except:
                    pass  # Backup failure shouldn't stop the write
            
            # Atomic rename (overwrites target)
            # On Windows, need to remove target first
            if os.path.exists(file_path):
                os.remove(file_path)
            os.rename(temp_path, file_path)
            
            return True
            
        except Exception as e:
            # Clean up temp file on error
            try:
                os.remove(temp_path)
            except:
                pass
            raise e
            
    except Exception as e:
        print(f"❌ Safe JSON write failed for {file_path}: {e}")
        return False

# ============================================================

# Import logistics automation module
# Try absolute import first (works when running as script)
# Then try relative import (works when running as package)
try:
    from logistics_automation import logistics_bp
    LOGISTICS_AVAILABLE = True
except ImportError:
    try:
        from .logistics_automation import logistics_bp
        LOGISTICS_AVAILABLE = True
    except ImportError as e:
        print(f"Logistics module not available: {e}")
        LOGISTICS_AVAILABLE = False

# Import purchase requisition service
# Try absolute import first (works when running as script)
# Then try relative import (works when running as package)
try:
    from purchase_requisition_service import pr_service
    PR_SERVICE_AVAILABLE = True
except ImportError:
    try:
        from .purchase_requisition_service import pr_service
        PR_SERVICE_AVAILABLE = True
    except ImportError as e:
        print(f"Purchase Requisition service not available: {e}")
        PR_SERVICE_AVAILABLE = False

# Import Gmail email service
# Try absolute import first (works when running as script)
# Then try relative import (works when running as package)
try:
    from gmail_email_service import get_gmail_service
    GMAIL_SERVICE_AVAILABLE = True
except ImportError:
    try:
        from .gmail_email_service import get_gmail_service
        GMAIL_SERVICE_AVAILABLE = True
    except ImportError as e:
        print(f"Gmail Email service not available: {e}")
        GMAIL_SERVICE_AVAILABLE = False

# Check if Gmail credentials exist
if GMAIL_SERVICE_AVAILABLE:
    credentials_path = Path(__file__).parent / 'gmail_credentials' / 'credentials.json'
    if not credentials_path.exists():
        print("⚠️ Gmail credentials.json not found - Gmail features disabled")
        GMAIL_SERVICE_AVAILABLE = False

# BOL HTML module removed - using the one in logistics_automation.py
BOL_HTML_AVAILABLE = False

def safe_float(value):
    """Safely convert value to float, handling commas, currency symbols, and None values"""
    DEBUG_SF = os.environ.get('DEBUG_SO') == '1'
    if DEBUG_SF and value and isinstance(value, str) and 'US$' in str(value):
        print(f"      [safe_float] Input: '{value}' (type: {type(value)})")
    
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove commas, currency symbols, and extra whitespace
        cleaned = value.replace(',', '').replace('US$', '').replace('CAD$', '').replace('$', '').strip()
        if DEBUG_SF and 'US$' in str(value):
            print(f"      [safe_float] Cleaned: '{cleaned}'")
        if cleaned == '' or cleaned == 'None':
            if DEBUG_SF and 'US$' in str(value):
                print(f"      [safe_float] Empty after cleaning, returning 0.0")
            return 0.0
        try:
            result = float(cleaned)
            if DEBUG_SF and 'US$' in str(value):
                print(f"      [safe_float] Result: {result}")
            return result
        except ValueError as e:
            if DEBUG_SF:
                print(f"      [safe_float] ValueError: {e}, returning 0.0")
            return 0.0
    return 0.0

def extract_so_data_from_docx(docx_path):
    """Extract Sales Order data from Word document - MUCH EASIER than PDF!"""
    try:
        so_data = {
            'so_number': '',
            'customer_name': '',
            'order_date': '',
            'total_amount': 0.0,
            'items': [],
            'status': '',
            'raw_text': ''
        }
        DEBUG_SO = True  # Temporarily enabled for debugging
        
        # Open Word document
        doc = Document(docx_path)
        
        # Extract all text
        full_text = ""
        for paragraph in doc.paragraphs:
            full_text += paragraph.text + "\n"
        
        # Extract from tables (much more reliable in Word!)
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join([cell.text for cell in row.cells])
                full_text += row_text + "\n"
        
        so_data['raw_text'] = full_text
        
        # Extract SO number from filename or text
        filename = os.path.basename(docx_path)
        so_match = re.search(r'salesorder[_\s]*(\d+)', filename, re.IGNORECASE)
        if so_match:
            so_data['so_number'] = so_match.group(1)
        
        # Extract from text if not in filename
        if not so_data['so_number']:
            so_text_match = re.search(r'(?:SO|Order No\.?|Sales Order)[:\s#]*(\d+)', full_text, re.IGNORECASE)
            if so_text_match:
                so_data['so_number'] = so_text_match.group(1)
        
        # Extract customer name (easier in Word!)
        customer_patterns = [
            r'Sold To:\s*([^\n\r|]+)',
            r'Customer:\s*([^\n\r|]+)',
            r'Bill To:\s*([^\n\r|]+)',
            r'Ship To:\s*([^\n\r|]+)',
            r'Company:\s*([^\n\r|]+)'
        ]
        
        for pattern in customer_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                customer_name = match.group(1).strip()
                # Clean up
                if ' - CDN$' in customer_name:
                    customer_name = customer_name.split(' - CDN$')[0].strip()
                if '|' in customer_name:
                    customer_name = customer_name.split('|')[0].strip()
                so_data['customer_name'] = customer_name
                break
        
        # Extract order date
        date_patterns = [
            r'(?:Order Date|Date):\s*([^\n\r|]+)',
            r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})'
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                so_data['order_date'] = match.group(1).strip()
                break
        
        # Extract total amount
        amount_patterns = [
            r'Total:\s*\$?([\d,]+\.?\d*)',
            r'Amount Due:\s*\$?([\d,]+\.?\d*)',
            r'Grand Total:\s*\$?([\d,]+\.?\d*)',
            r'\$([\d,]+\.?\d*)'
        ]
        
        for pattern in amount_patterns:
            matches = re.findall(pattern, full_text, re.IGNORECASE)
            if matches:
                amounts = [safe_float(amount) for amount in matches]
                so_data['total_amount'] = max(amounts) if amounts else 0.0
                break
        
        # Extract items from tables (MUCH better in Word!)
        for table in doc.tables:
            headers = [cell.text.lower() for cell in table.rows[0].cells]
            if any(word in ' '.join(headers) for word in ['item', 'description', 'product']):
                for row in table.rows[1:]:  # Skip header
                    row_data = [cell.text.strip() for cell in row.cells]
                    if any(cell for cell in row_data if cell):  # Non-empty row
                        so_data['items'].append(' | '.join(row_data))
        
        # Determine status from path
        if 'cancelled' in docx_path.lower():
            so_data['status'] = 'Cancelled'
        elif 'completed' in docx_path.lower() or 'closed' in docx_path.lower():
            so_data['status'] = 'Completed'
        elif 'production' in docx_path.lower() or 'scheduled' in docx_path.lower():
            so_data['status'] = 'In Production'
        else:
            so_data['status'] = 'Unknown'
        
        return so_data
        
    except Exception as e:
        print(f"Error extracting SO data from {docx_path}: {str(e)}")
        return None

def extract_so_data_from_pdf(pdf_path):
    """
    NEW PARSING APPROACH: Raw Extraction + OpenAI Structuring
    Parser version: 2025-10-12 (Raw + AI)
    
    Flow:
    1. Extract text and tables from PDF AS-IS (no cleaning, no interpretation)
    2. Send raw data to OpenAI for complete structuring
    3. Return clean structured JSON
    
    This replaces 1800+ lines of regex/parsing logic with a simple 2-step process.
    """
    try:
        # Import the new raw extractor functions
        try:
            from raw_so_extractor import extract_raw_from_pdf, structure_with_openai
        except ImportError:
            from .raw_so_extractor import extract_raw_from_pdf, structure_with_openai
        
        if DEBUG_SO:
            print(f"\n{'='*80}")
            print(f"NEW SO PARSER: Raw Extraction + OpenAI Structuring")
            print(f"File: {os.path.basename(pdf_path)}")
            print(f"{'='*80}\n")
        
        # Step 1: Extract raw data (text + tables AS-IS)
        raw_data = extract_raw_from_pdf(pdf_path)
        if not raw_data:
            print(f"ERROR: Failed to extract raw data from {pdf_path}")
            return None
        
        # Step 2: Structure with OpenAI
        structured_data = structure_with_openai(raw_data)
        if not structured_data:
            print(f"ERROR: Failed to structure data with OpenAI")
            return None

        # Add status based on file path
        if 'cancelled' in pdf_path.lower():
            structured_data['status'] = 'Cancelled'
        elif 'completed' in pdf_path.lower() or 'closed' in pdf_path.lower():
            structured_data['status'] = 'Completed'
        elif 'production' in pdf_path.lower() or 'scheduled' in pdf_path.lower():
            structured_data['status'] = 'In Production'
        else:
            structured_data['status'] = 'Active'
        
        if DEBUG_SO:
            print(f"\nPARSING COMPLETE:")
            print(f"  SO: {structured_data.get('so_number', 'N/A')}")
            print(f"  Customer: {structured_data.get('customer_name', 'N/A')}")
            print(f"  Items: {len(structured_data.get('items', []))}")
            print(f"  Total: ${structured_data.get('total_amount', 0):.2f}")
            print(f"{'='*80}\n")
        
        return structured_data
        
    except Exception as e:
        print(f"ERROR in extract_so_data_from_pdf: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback: Return basic structure with error info
        return {
            'so_number': os.path.basename(pdf_path).replace('SalesOrder_', '').replace('.pdf', ''),
            'customer_name': 'Error - parsing failed',
            'items': [],
            'total_amount': 0.0,
            'error': str(e),
            'status': 'Parse Error',
            'file_info': {
                'filename': os.path.basename(pdf_path),
                'filepath': pdf_path
            }
        }

def parse_sales_order_pdf(pdf_path):
    """Alias for extract_so_data_from_pdf - maintains compatibility with logistics module"""
    print(f"\n{'='*80}")
    print(f"SO PARSER - RAW EXTRACTION + OPENAI STRUCTURING")
    print(f"Version: 2025-10-12 (Raw + AI)")
    print(f"File: {os.path.basename(pdf_path)}")
    print(f"{'='*80}\n")
    return extract_so_data_from_pdf(pdf_path)

def load_real_so_data():
    """Load real Sales Order data from ALL folders and subfolders recursively - OPTIMIZED"""
    so_data = []
    base_directory = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
    
    print(f"SEARCH: OPTIMIZED SO SCAN: Starting efficient recursive scan from {base_directory}")
    
    if not os.path.exists(base_directory):
        print(f"ERROR: Base SO directory not found: {base_directory}")
        return so_data
    
    # Priority folders for faster scanning - ONLY active folders (NO Cancelled/Closed)
    priority_folders = [
        "In Production",
        "New and Revised"
    ]
    
    total_files_found = 0
    total_files_processed = 0
    max_files_per_folder = 25  # HARD LIMIT: Process max 25 files per folder to prevent timeout
    max_total_files = 75  # HARD LIMIT: Total files across all folders
    
    # Scan priority folders first
    for priority_folder in priority_folders:
        folder_path = os.path.join(base_directory, priority_folder)
        if os.path.exists(folder_path):
            print(f"RETRY: Scanning priority folder: {priority_folder}")
            folder_files_processed = 0
            
            for root, dirs, files in os.walk(folder_path):
                # Skip system folders
                dirs[:] = [d for d in dirs if d.lower() not in ['desktop.ini', 'thumbs.db']]
                
                for filename in files:
                    # Check folder limit
                    if folder_files_processed >= max_files_per_folder:
                        print(f"⚠️ Reached folder limit ({max_files_per_folder} files) for {priority_folder}")
                        break
                    
                    # Check total limit
                    if total_files_processed >= max_total_files:
                        print(f"⚠️ Reached total file limit ({max_total_files} files)")
                        break
                        
                    if filename.lower().endswith(('.pdf', '.docx', '.doc')):
                        total_files_found += 1
                        file_path = os.path.join(root, filename)
                        relative_path = os.path.relpath(root, base_directory)
                        
                        so_info = None
                        
                        # Handle Word documents (MUCH FASTER!)
                        if filename.lower().endswith(('.docx', '.doc')):
                            so_info = extract_so_data_from_docx(file_path)
                            if so_info:
                                so_info['folder_path'] = relative_path
                                so_info['file_type'] = 'Word'
                                total_files_processed += 1
                                folder_files_processed += 1
                                print(f"SUCCESS: Word SO: {so_info['so_number']} - {so_info['customer_name']} ({relative_path})")
                        
                        # Handle PDF files (slower, so limit these)
                        elif filename.lower().endswith('.pdf'):
                            so_info = extract_so_data_from_pdf(file_path)
                            if so_info:
                                so_info['folder_path'] = relative_path
                                so_info['file_type'] = 'PDF'
                                total_files_processed += 1
                                folder_files_processed += 1
                                print(f"SUCCESS: PDF SO: {so_info['so_number']} - {so_info['customer_name']} ({relative_path})")
                        
                        if so_info:
                            so_data.append(so_info)
                
                # Check if we've hit the folder limit
                if folder_files_processed >= max_files_per_folder:
                    break
            
            # Check if we've hit the total limit
            if total_files_processed >= max_total_files:
                print(f"⚠️ Total file limit reached ({max_total_files} files) - stopping scan")
                break
    
    print(f"🎉 OPTIMIZED SO SCAN COMPLETE:")
    print(f"   📁 Files Found: {total_files_found}")
    print(f"   SUCCESS: Files Processed: {total_files_processed}")
    print(f"   📊 SO Records Loaded: {len(so_data)}")
    print(f"   SEARCH: Folders Scanned: Priority folders only")
    print(f"   ⚡ Processing: Limited to {max_files_per_folder} files per folder, {max_total_files} total (to prevent timeout)")
    print(f"   ⏱️ Cache Duration: 30 minutes")
    
    return so_data

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')

# Flask-Compress temporarily disabled to test if it's causing startup crash
# Will implement manual GZIP compression instead

# Enable CORS immediately after app creation - CRITICAL for Cloud Run!
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False,
        "max_age": 3600
    }
})

# Configure Flask for Unicode handling
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

# Handle 404 Not Found errors specifically
from werkzeug.exceptions import NotFound

@app.errorhandler(NotFound)
def handle_not_found(e):
    """Handle 404 Not Found errors"""
    print(f"⚠️ Route not found: {request.path}")
    return jsonify({
        'error': {
            'code': '404',
            'message': f'Route not found: {request.path}',
            'type': 'NotFound'
        }
    }), 404

# Global error handler to catch all other exceptions
@app.errorhandler(Exception)
def handle_all_errors(e):
    """Catch all exceptions and return detailed error info"""
    import traceback
    error_trace = traceback.format_exc()
    error_type = type(e).__name__
    error_message = str(e)
    
    print(f"❌ Flask error caught: {error_type}: {error_message}")
    print(f"❌ Traceback:\n{error_trace}")
    
    return jsonify({
        'error': {
            'code': '500',
            'message': error_message,
            'type': error_type,
            'trace': error_trace
        }
    }), 500

# Global Unicode error handler
@app.errorhandler(UnicodeEncodeError)
def handle_unicode_error(e):
    print(f"Unicode error caught: {e}")
    return jsonify({
        'error': 'Unicode encoding error - special characters detected',
        'details': 'Please check for special characters in folder/file names'
    }), 500
# CORS is now initialized immediately after Flask app creation (see line 490)
# This ensures all routes have proper CORS headers

# Register logistics automation blueprint
if LOGISTICS_AVAILABLE:
    app.register_blueprint(logistics_bp)
    print("Logistics automation module loaded")
else:
    print("Logistics automation module not available")

# Register purchase requisition service
if PR_SERVICE_AVAILABLE:
    app.register_blueprint(pr_service)
    print("✓ Purchase Requisition service loaded")
else:
    print("Purchase Requisition service not available")

# Serve frontend at root path
@app.route('/', methods=['GET'])
def serve_frontend():
    """Serve the frontend application"""
    from flask import send_from_directory
    return send_from_directory(app.static_folder, 'index.html')

# Catch-all route for frontend routing (SPA)
@app.route('/<path:path>')
def catch_all(path):
    """Serve frontend files or index.html for SPA routing"""
    from flask import send_from_directory
    # If it's an API route, let Flask handle it normally
    if path.startswith('api/'):
        return jsonify({"error": "API route not found"}), 404
    # Try to serve the static file
    try:
        return send_from_directory(app.static_folder, path)
    except:
        # If file doesn't exist, serve index.html (for SPA routing)
        return send_from_directory(app.static_folder, 'index.html')

# Comprehensive health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    """Comprehensive system health check"""
    health_status = {
        "timestamp": datetime.now().isoformat(),
        "status": "healthy",
        "issues": []
    }
    
    # Check Google Drive API first
    health_status["google_drive_api_enabled"] = USE_GOOGLE_DRIVE_API
    if USE_GOOGLE_DRIVE_API and google_drive_service:
        # Using Google Drive API - don't check local G: drive
        health_status["google_drive_api_initialized"] = True
        health_status["google_drive_authenticated"] = google_drive_service.authenticated
        health_status["gdrive_accessible"] = google_drive_service.authenticated  # API is the data source
        if not google_drive_service.authenticated:
            health_status["issues"].append("Google Drive API not authenticated")
            health_status["status"] = "degraded"
    else:
        # Not using Google Drive API - check local G: drive
        health_status["google_drive_api_initialized"] = False
        health_status["google_drive_authenticated"] = False
        gdrive_accessible = os.path.exists(GDRIVE_BASE)
        health_status["gdrive_accessible"] = gdrive_accessible
        if not gdrive_accessible:
            health_status["issues"].append("G: Drive not accessible")
            health_status["status"] = "degraded"
    
    # Check OpenAI availability
    health_status["openai_available"] = openai_available
    if not openai_available:
        health_status["issues"].append("OpenAI API not available")
    
    # Check cache status
    global _cache_timestamp, _data_cache
    if _cache_timestamp:
        cache_age = time.time() - _cache_timestamp
        health_status["cache_age_seconds"] = round(cache_age, 2)
        health_status["cache_age_minutes"] = round(cache_age / 60, 2)
        
        # Check if cache has data
        if _data_cache:
            cache_has_data = any(
                len(v) > 0 
                for v in _data_cache.values() 
                if isinstance(v, list)
            )
            health_status["cache_has_data"] = cache_has_data
            if not cache_has_data:
                health_status["issues"].append("Cache exists but contains no data")
                health_status["status"] = "degraded"
        else:
            health_status["cache_has_data"] = False
    else:
        health_status["cache_age_seconds"] = None
        health_status["cache_has_data"] = False
    
    # Check Gmail service
    health_status["gmail_service_available"] = GMAIL_SERVICE_AVAILABLE
    
    # Overall status
    if len(health_status["issues"]) > 3:
        health_status["status"] = "unhealthy"
    
    return jsonify(health_status), 200 if health_status["status"] != "unhealthy" else 503

# Register BOL HTML blueprint - DISABLED (duplicate endpoint in logistics_automation.py)
# if BOL_HTML_AVAILABLE:
#     app.register_blueprint(bol_html_bp)
#     print("BOL HTML module loaded")
# else:
#     print("BOL HTML module not available")

# Lazy OpenAI client initialization (avoid import-time conflicts with Google libraries)
client = None
openai_available = False

def get_openai_client_app():
    """Get or create OpenAI client - lazy initialization"""
    global client, openai_available
    if client is None:
        try:
            from openai import OpenAI
            openai_api_key = os.getenv('OPENAI_API_KEY')
            
            if not openai_api_key or openai_api_key == "your_openai_api_key_here":
                print("ERROR: OPENAI_API_KEY environment variable not set or using placeholder")
                openai_available = False
                return None
            
            client = OpenAI(api_key=openai_api_key)
            openai_available = True
            print("OpenAI client initialized successfully")
            return client
        except Exception as e:
            print(f"ERROR: OpenAI client initialization failed: {e}")
            openai_available = False
            return None
    return client

# Check if OpenAI is available at import time (but don't initialize client yet)
try:
    from openai import OpenAI
    if os.getenv('OPENAI_API_KEY'):
        openai_available = True
        print("OpenAI API key detected - client will be initialized on first use")
    else:
        openai_available = False
        print("OpenAI API key not found")
except ImportError:
    print("ERROR: OpenAI library not found")
    openai_available = False

# G: Drive base paths - EXACT paths where data is located
GDRIVE_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
SALES_ORDERS_BASE = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
MPS_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
MPS_EXCEL_PATH = os.path.join(MPS_BASE, "MPS.xlsx")  # Fallback Excel file

# Google Drive API - Use API instead of local mount if configured
USE_GOOGLE_DRIVE_API_ENV = os.getenv('USE_GOOGLE_DRIVE_API', 'false')
USE_GOOGLE_DRIVE_API = USE_GOOGLE_DRIVE_API_ENV.lower() == 'true'
google_drive_service = None

# Initialize Google Drive API service safely
# On Vercel, don't authenticate during import - authenticate lazily on first use
IS_VERCEL = os.getenv('VERCEL') == '1' or os.getenv('VERCEL_ENV') is not None

if USE_GOOGLE_DRIVE_API:
    try:
        print(f"🔍 Initializing Google Drive API: env='{USE_GOOGLE_DRIVE_API_ENV}', parsed={USE_GOOGLE_DRIVE_API}")
        from google_drive_service import GoogleDriveService
        google_drive_service = GoogleDriveService()
        print("✅ Google Drive API service initialized")
        
        # Only authenticate immediately if NOT on Vercel (lazy auth on Vercel)
        if not IS_VERCEL:
            try:
                if not google_drive_service.authenticated:
                    print("🔐 Authenticating Google Drive service...")
                    google_drive_service.authenticate()
                print("✅ Google Drive API service authenticated successfully")
            except Exception as auth_error:
                print(f"⚠️ Google Drive authentication failed: {auth_error}")
                import traceback
                traceback.print_exc()
                # Continue anyway - will retry on first use
        else:
            print("ℹ️ On Vercel - Google Drive authentication will happen on first use (lazy)")
    except ImportError as e:
        print(f"⚠️ Google Drive API not available (ImportError): {e}")
        USE_GOOGLE_DRIVE_API = False
        google_drive_service = None
    except Exception as e:
        print(f"❌ Error initializing Google Drive API service: {e}")
        import traceback
        traceback.print_exc()
        USE_GOOGLE_DRIVE_API = False
        google_drive_service = None
else:
    print(f"ℹ️ Google Drive API disabled: USE_GOOGLE_DRIVE_API='{USE_GOOGLE_DRIVE_API_ENV}'")

def get_latest_folder():
    """Get the latest folder from G: Drive - OPTIMIZED for speed"""
    try:
        print(f"SEARCH: Checking G: Drive path: {GDRIVE_BASE}")
        
        if not os.path.exists(GDRIVE_BASE):
            print(f"ERROR: G: Drive path not accessible: {GDRIVE_BASE}")
            return None, f"G: Drive path not accessible: {GDRIVE_BASE}"
        
        # FAST: Get folders and sort by name (assuming date format YYYY-MM-DD)
        folders = [f for f in os.listdir(GDRIVE_BASE) if os.path.isdir(os.path.join(GDRIVE_BASE, f))]
        print(f"📁 Found folders: {folders}")
        
        if not folders:
            print("ERROR: No folders found in G: Drive path")
            return None, "No folders found in G: Drive path"
        
        # OPTIMIZED: Sort by folder name (assuming YYYY-MM-DD format) instead of checking mtime
        folders.sort(reverse=True)  # Most recent first
        latest_folder = folders[0]
        
        print(f"SUCCESS: Latest folder found: {latest_folder}")
        return latest_folder, None
            
    except Exception as e:
        print(f"ERROR: Error in get_latest_folder: {e}")
        return None, str(e)

def load_json_file(file_path):
    """Load JSON file from G: Drive with proper error handling"""
    try:
        if os.path.exists(file_path):
            print(f"📄 Loading file: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"SUCCESS: Successfully loaded {len(data)} records from {os.path.basename(file_path)}")
                return data
        else:
            print(f"⚠️ File not found: {file_path}")
        return []
    except Exception as e:
        print(f"ERROR: Error loading {file_path}: {e}")
        return []



# Global cache for data - MEMORY OPTIMIZED
_data_cache = None
_cache_timestamp = None
_cache_duration = 86400  # 24 hour cache (data doesn't change daily - avoid reloading 69MB every day)

# Sales Order folder cache - stores folder contents by path
_so_folder_cache = {}
_so_folder_cache_timestamps = {}
_so_folder_cache_duration = 1800  # 30 minutes cache for folders (increased for 24/7 stability)
# Maximum cache size in MB - increased for 2GB instance (leave ~500MB for system/other processes)
_MAX_CACHE_SIZE_MB = 1500  # Maximum cache size in MB (2GB instance - safe limit)

# Persistent cache directory (Cloud Run /tmp persists during container lifetime)
CACHE_DIR = "/tmp/canoil_cache"
CACHE_FILE = os.path.join(CACHE_DIR, "data_cache.pkl")
CACHE_TEMP_FILE = os.path.join(CACHE_DIR, "data_cache.pkl.tmp")
CACHE_METADATA_FILE = os.path.join(CACHE_DIR, "cache_metadata.json")
CACHE_METADATA_TEMP_FILE = os.path.join(CACHE_DIR, "cache_metadata.json.tmp")
CACHE_VERSION = 2  # Increment when cache format changes
CACHE_LOCK_FILE = os.path.join(CACHE_DIR, ".cache_lock")

import hashlib

# File locking for cache operations (Unix only - Windows will skip locking)
try:
    import fcntl
    HAS_FCNTL = True
except ImportError:
    HAS_FCNTL = False  # Windows doesn't have fcntl

def ensure_cache_dir():
    """Ensure cache directory exists - NEVER FAILS"""
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        return True
    except Exception as e:
        print(f"⚠️ Failed to create cache directory: {e}")
        # Don't fail - cache will just use memory
        return False

def _calculate_data_hash(data):
    """Calculate hash of data for corruption detection"""
    try:
        # Create a simple hash of data structure
        data_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.md5(data_str.encode()).hexdigest()
    except Exception:
        return None

def _validate_cache_data(cache_data):
    """Validate cache data structure - NEVER FAILS, returns True if valid"""
    try:
        if not isinstance(cache_data, dict):
            print("⚠️ Cache validation failed: not a dict")
            return False
        
        required_keys = ['data', 'timestamp', 'version']
        for key in required_keys:
            if key not in cache_data:
                print(f"⚠️ Cache validation failed: missing key '{key}'")
                return False
        
        # Check version compatibility
        cache_version = cache_data.get('version', 0)
        if cache_version != CACHE_VERSION:
            print(f"⚠️ Cache version mismatch: {cache_version} != {CACHE_VERSION}")
            return False
        
        # Check timestamp is valid
        timestamp = cache_data.get('timestamp')
        if not isinstance(timestamp, (int, float)) or timestamp <= 0:
            print("⚠️ Cache validation failed: invalid timestamp")
            return False
        
        # Check data exists and is a dict
        data = cache_data.get('data')
        if not isinstance(data, dict):
            print("⚠️ Cache validation failed: data is not a dict")
            return False
        
        # Check data has content
        has_content = any(
            len(v) > 0 
            for v in data.values() 
            if isinstance(v, list)
        )
        if not has_content:
            print("⚠️ Cache validation failed: data has no content")
            return False
        
        # Verify hash if present (optional check)
        if 'data_hash' in cache_data:
            calculated_hash = _calculate_data_hash(data)
            if calculated_hash and cache_data['data_hash'] != calculated_hash:
                print("⚠️ Cache validation failed: data hash mismatch (corruption detected)")
                return False
        
        return True
    except Exception as e:
        print(f"⚠️ Cache validation error: {e}")
        return False

def _acquire_cache_lock():
    """Acquire lock for cache operations - returns lock file handle or None"""
    if not HAS_FCNTL:
        # Windows - skip locking (not critical, atomic writes still work)
        return None
    
    try:
        ensure_cache_dir()
        lock_file = open(CACHE_LOCK_FILE, 'w')
        try:
            # Try to acquire exclusive lock (non-blocking)
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return lock_file
        except (IOError, OSError):
            # Lock already held - return None
            lock_file.close()
            return None
    except Exception:
        # Lock failed - continue without lock (not critical)
        return None

def _release_cache_lock(lock_file):
    """Release cache lock"""
    if not lock_file or not HAS_FCNTL:
        return
    
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        lock_file.close()
        try:
            os.remove(CACHE_LOCK_FILE)
        except:
            pass
    except Exception:
        pass

def save_cache_to_disk(data, folder_info=None):
    """Save cache to disk with atomic write and validation - NEVER FAILS"""
    if not ensure_cache_dir():
        print("⚠️ Cache directory not available - skipping disk save")
        return False
    
    lock_file = None
    try:
        # Acquire lock to prevent concurrent writes
        lock_file = _acquire_cache_lock()
        if not lock_file:
            print("⚠️ Cache lock held - skipping disk save (will retry next time)")
            return False
        
        # Validate data before saving
        if not should_cache_data(data):
            print("⚠️ Data validation failed - not saving to disk")
            return False
        
        # Prepare cache data with version and hash
        data_hash = _calculate_data_hash(data)
        cache_data = {
            'data': data,
            'timestamp': time.time(),
            'folder_info': folder_info,
            'version': CACHE_VERSION,
            'data_hash': data_hash
        }
        
        # Atomic write: write to temp file first, then rename
        try:
            # Write to temp file
            with open(CACHE_TEMP_FILE, 'wb') as f:
                pickle.dump(cache_data, f)
            
            # Verify temp file was written correctly
            if not os.path.exists(CACHE_TEMP_FILE) or os.path.getsize(CACHE_TEMP_FILE) == 0:
                print("⚠️ Temp cache file invalid - not saving")
                try:
                    os.remove(CACHE_TEMP_FILE)
                except:
                    pass
                return False
            
            # Verify we can read it back (corruption check)
            try:
                with open(CACHE_TEMP_FILE, 'rb') as f:
                    test_data = pickle.load(f)
                if not _validate_cache_data(test_data):
                    print("⚠️ Cache validation failed after write - not saving")
                    try:
                        os.remove(CACHE_TEMP_FILE)
                    except:
                        pass
                    return False
            except Exception as e:
                print(f"⚠️ Cache verification failed: {e} - not saving")
                try:
                    os.remove(CACHE_TEMP_FILE)
                except:
                    pass
                return False
            
            # Atomic rename (replaces old file)
            if os.path.exists(CACHE_FILE):
                os.remove(CACHE_FILE)  # Remove old file first
            os.rename(CACHE_TEMP_FILE, CACHE_FILE)
            
            print(f"💾 Cache saved to disk: {CACHE_FILE} (validated)")
            return True
            
        except Exception as e:
            print(f"⚠️ Failed to save cache to disk: {e}")
            # Clean up temp file
            try:
                if os.path.exists(CACHE_TEMP_FILE):
                    os.remove(CACHE_TEMP_FILE)
            except:
                pass
            return False
            
    except Exception as e:
        print(f"⚠️ Cache save error: {e}")
        return False
    finally:
        _release_cache_lock(lock_file)

def load_cache_from_disk():
    """Load cache from disk with validation and corruption handling - NEVER FAILS"""
    try:
        if not os.path.exists(CACHE_FILE):
            return None, None, None
        
        # Check file size (empty file = corrupted)
        file_size = os.path.getsize(CACHE_FILE)
        if file_size == 0:
            print("⚠️ Cache file is empty - removing corrupted cache")
            try:
                os.remove(CACHE_FILE)
            except:
                pass
            return None, None, None
        
        # Load cache data
        try:
            with open(CACHE_FILE, 'rb') as f:
                cache_data = pickle.load(f)
        except (pickle.UnpicklingError, EOFError, ValueError) as e:
            print(f"⚠️ Cache file corrupted (unpickle error): {e} - removing")
            try:
                os.remove(CACHE_FILE)
            except:
                pass
            return None, None, None
        except Exception as e:
            print(f"⚠️ Failed to load cache file: {e}")
            return None, None, None
        
        # Validate cache data structure
        if not _validate_cache_data(cache_data):
            print("⚠️ Cache validation failed - removing corrupted cache")
            try:
                os.remove(CACHE_FILE)
            except:
                pass
            return None, None, None
        
        # Check cache age
        cache_age = time.time() - cache_data['timestamp']
        if cache_age >= _cache_duration:
            print(f"⚠️ Disk cache expired (age: {cache_age:.1f}s)")
            # Don't remove - let it expire naturally
            return None, None, None
        
        # Success - return validated cache
        print(f"✅ Loaded cache from disk (age: {cache_age:.1f}s, validated)")
        return cache_data['data'], cache_data.get('folder_info'), cache_data['timestamp']
        
    except Exception as e:
        print(f"⚠️ Failed to load cache from disk: {e}")
        # Never fail - return None and continue
        return None, None, None

def load_file_times_from_metadata():
    """Load file modification times from metadata for incremental sync - NEVER FAILS"""
    try:
        if not os.path.exists(CACHE_METADATA_FILE):
            return {}
        
        # Check file size
        if os.path.getsize(CACHE_METADATA_FILE) == 0:
            print("⚠️ Metadata file is empty - removing")
            try:
                os.remove(CACHE_METADATA_FILE)
            except:
                pass
            return {}
        
        with open(CACHE_METADATA_FILE, 'r') as f:
            metadata = json.load(f)
        
        # Validate structure
        if not isinstance(metadata, dict):
            print("⚠️ Metadata file invalid structure - removing")
            try:
                os.remove(CACHE_METADATA_FILE)
            except:
                pass
            return {}
        
        file_times = metadata.get('file_times', {})
        if not isinstance(file_times, dict):
            return {}
        
        return file_times
    except (json.JSONDecodeError, ValueError) as e:
        print(f"⚠️ Metadata file corrupted (JSON error): {e} - removing")
        try:
            os.remove(CACHE_METADATA_FILE)
        except:
            pass
        return {}
    except Exception as e:
        print(f"⚠️ Failed to load file times metadata: {e}")
        return {}

def save_file_times_to_metadata(file_times):
    """Save file modification times to metadata with atomic write - NEVER FAILS"""
    if not ensure_cache_dir():
        return False
    
    try:
        # Validate input
        if not isinstance(file_times, dict):
            print("⚠️ Invalid file_times format - not saving")
            return False
        
        # Prepare metadata
        metadata = {
            'file_times': file_times,
            'version': 1,
            'timestamp': time.time()
        }
        
        # Atomic write: write to temp file first, then rename
        try:
            with open(CACHE_METADATA_TEMP_FILE, 'w') as f:
                json.dump(metadata, f)
            
            # Verify temp file
            if not os.path.exists(CACHE_METADATA_TEMP_FILE) or os.path.getsize(CACHE_METADATA_TEMP_FILE) == 0:
                print("⚠️ Temp metadata file invalid - not saving")
                try:
                    os.remove(CACHE_METADATA_TEMP_FILE)
                except:
                    pass
                return False
            
            # Verify we can read it back
            try:
                with open(CACHE_METADATA_TEMP_FILE, 'r') as f:
                    json.load(f)  # Verify JSON is valid
            except json.JSONDecodeError:
                print("⚠️ Metadata verification failed - not saving")
                try:
                    os.remove(CACHE_METADATA_TEMP_FILE)
                except:
                    pass
                return False
            
            # Atomic rename
            if os.path.exists(CACHE_METADATA_FILE):
                os.remove(CACHE_METADATA_FILE)
            os.rename(CACHE_METADATA_TEMP_FILE, CACHE_METADATA_FILE)
            
            return True
        except Exception as e:
            print(f"⚠️ Failed to save metadata: {e}")
            try:
                if os.path.exists(CACHE_METADATA_TEMP_FILE):
                    os.remove(CACHE_METADATA_TEMP_FILE)
            except:
                pass
            return False
    except Exception as e:
        print(f"⚠️ Metadata save error: {e}")
        return False

def estimate_data_size_mb(data):
    """Estimate data size in MB (rough approximation) - MEMORY EFFICIENT"""
    try:
        if data is None:
            return 0
        # Quick estimation without full JSON conversion to save memory
        # Count items in lists and estimate size
        total_items = 0
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, list):
                    total_items += len(value)
                elif isinstance(value, dict):
                    # Estimate dict size
                    total_items += len(value) * 10  # Rough estimate
        elif isinstance(data, list):
            total_items = len(data)
        
        # Rough estimate: ~1KB per item (conservative)
        estimated_bytes = total_items * 1024
        size_mb = estimated_bytes / (1024 * 1024)
        return size_mb
    except Exception as e:
        print(f"⚠️ Error estimating data size: {e}")
        # If estimation fails, assume it's large and don't cache
        return 200  # Return high value to prevent caching

def should_cache_data(data):
    """Check if data should be cached based on size and content - NEVER FAILS"""
    try:
        if data is None:
            print("⚠️ Cannot cache: data is None")
            return False
        
        # CRITICAL: Check if data has actual content
        has_content = False
        if isinstance(data, dict):
            has_content = any(
                len(v) > 0 
                for v in data.values() 
                if isinstance(v, list)
            )
        
        if not has_content:
            print("🚨 CACHE VALIDATION FAILED: Data has no content - refusing to cache empty data!")
            return False
        
        size_mb = estimate_data_size_mb(data)
        if size_mb > _MAX_CACHE_SIZE_MB:
            print(f"⚠️ Data too large to cache: {size_mb:.1f}MB > {_MAX_CACHE_SIZE_MB}MB limit")
            return False
        
        print(f"✅ Cache validation passed: data has content ({size_mb:.1f}MB)")
        return True
    except Exception as e:
        print(f"⚠️ Cache validation error: {e} - not caching")
        return False

def clear_corrupted_cache():
    """Clear corrupted cache files - NEVER FAILS"""
    try:
        corrupted = False
        
        # Check and remove corrupted cache file
        if os.path.exists(CACHE_FILE):
            try:
                # Try to load and validate
                with open(CACHE_FILE, 'rb') as f:
                    cache_data = pickle.load(f)
                if not _validate_cache_data(cache_data):
                    print("🧹 Removing corrupted cache file")
                    os.remove(CACHE_FILE)
                    corrupted = True
            except Exception:
                print("🧹 Removing corrupted cache file (unreadable)")
                try:
                    os.remove(CACHE_FILE)
                    corrupted = True
                except:
                    pass
        
        # Check and remove corrupted temp files
        for temp_file in [CACHE_TEMP_FILE, CACHE_METADATA_TEMP_FILE]:
            if os.path.exists(temp_file):
                print(f"🧹 Removing stale temp file: {temp_file}")
                try:
                    os.remove(temp_file)
                    corrupted = True
                except:
                    pass
        
        # Check and remove corrupted metadata file
        if os.path.exists(CACHE_METADATA_FILE):
            try:
                with open(CACHE_METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
                if not isinstance(metadata, dict):
                    print("🧹 Removing corrupted metadata file")
                    os.remove(CACHE_METADATA_FILE)
                    corrupted = True
            except Exception:
                print("🧹 Removing corrupted metadata file (unreadable)")
                try:
                    os.remove(CACHE_METADATA_FILE)
                    corrupted = True
                except:
                    pass
        
        if corrupted:
            print("✅ Corrupted cache files cleared")
        return corrupted
    except Exception as e:
        print(f"⚠️ Error clearing corrupted cache: {e}")
        return False

def get_cache_status():
    """Get cache status for debugging - NEVER FAILS"""
    try:
        status = {
            'memory_cache': {
                'exists': _data_cache is not None,
                'age_seconds': None,
                'size_mb': None
            },
            'disk_cache': {
                'exists': os.path.exists(CACHE_FILE),
                'age_seconds': None,
                'size_mb': None,
                'valid': False
            },
            'metadata_cache': {
                'exists': os.path.exists(CACHE_METADATA_FILE),
                'file_count': 0
            }
        }
        
        # Memory cache info
        if _data_cache and _cache_timestamp:
            status['memory_cache']['age_seconds'] = time.time() - _cache_timestamp
            status['memory_cache']['size_mb'] = estimate_data_size_mb(_data_cache)
        
        # Disk cache info
        if os.path.exists(CACHE_FILE):
            file_size = os.path.getsize(CACHE_FILE)
            status['disk_cache']['size_mb'] = file_size / (1024 * 1024)
            try:
                with open(CACHE_FILE, 'rb') as f:
                    cache_data = pickle.load(f)
                if _validate_cache_data(cache_data):
                    status['disk_cache']['valid'] = True
                    status['disk_cache']['age_seconds'] = time.time() - cache_data['timestamp']
            except:
                status['disk_cache']['valid'] = False
        
        # Metadata cache info
        if os.path.exists(CACHE_METADATA_FILE):
            try:
                with open(CACHE_METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
                file_times = metadata.get('file_times', {})
                status['metadata_cache']['file_count'] = len(file_times)
            except:
                pass
        
        return status
    except Exception as e:
        print(f"⚠️ Error getting cache status: {e}")
        return {'error': str(e)}

@app.route('/api/data', methods=['GET', 'HEAD', 'OPTIONS'])
def get_all_data():
    """Get all data from latest G: Drive folder - with caching"""
    global _data_cache, _cache_timestamp
    
    try:
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"🔵 /api/data CALLED - Method: {request.method}")
        print(f"🔵 Origin: {request.headers.get('Origin', 'NO ORIGIN')}")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        # Handle HEAD/OPTIONS requests quickly without loading data
        if request.method in ['HEAD', 'OPTIONS']:
            print(f"✅ Returning 200 for {request.method} request")
            return jsonify({"status": "ok"}), 200
        
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        print(f"🔵 GET request - force_refresh={force_refresh}")
        
        # Try loading from disk cache first (survives container restarts)
        if not force_refresh:
            disk_data, disk_folder_info, disk_timestamp = load_cache_from_disk()
            if disk_data and disk_timestamp:
                cache_age = time.time() - disk_timestamp
                has_data = any(v and len(v) > 0 if isinstance(v, list) else v for v in disk_data.values())
                
                if cache_age < _cache_duration and has_data:
                    # Restore to memory cache
                    _data_cache = disk_data
                    _cache_timestamp = disk_timestamp
                    print("✅ Using disk cache (survived container restart)")
                    response_data = {
                        "data": _data_cache,
                        "folderInfo": disk_folder_info or {
                            "folderName": "Cached Data",
                            "syncDate": "Cached",
                            "lastModified": "Cached",
                            "folder": "Cached",
                            "created": "Cached",
                            "size": "Cached",
                            "fileCount": len([k for k, v in _data_cache.items() if v and (len(v) > 0 if isinstance(v, list) else v)])
                        },
                        "LoadTimestamp": "Cached",
                        "cached": True
                    }
                    # Compress large cached responses
                    accept_encoding = request.headers.get('Accept-Encoding', '')
                    if 'gzip' in accept_encoding and estimate_data_size_mb(_data_cache) > 10:
                        json_str = json.dumps(response_data)
                        compressed = gzip.compress(json_str.encode('utf-8'))
                        response = Response(compressed, mimetype='application/json')
                        response.headers['Content-Encoding'] = 'gzip'
                        response.headers['Content-Length'] = len(compressed)
                        return response
                    return jsonify(response_data)
        
        # Check if we have valid cached data (unless forcing refresh)
        if not force_refresh and _data_cache and _cache_timestamp:
            cache_age = time.time() - _cache_timestamp
            
            # Check if cache has actual data (not empty)
            has_data = any(v and len(v) > 0 if isinstance(v, list) else v for v in _data_cache.values())
            
            print(f"SEARCH: Cache check: age={cache_age:.1f}s, duration={_cache_duration}s, valid={cache_age < _cache_duration}, has_data={has_data}")
            
            # Only use cache if it has data AND is fresh
            if cache_age < _cache_duration and has_data:
                print("SUCCESS: Returning cached data (no G: Drive access needed)")
                response_data = {
                    "data": _data_cache,
                    "folderInfo": {
                        "folderName": "Cached Data",
                        "syncDate": "Cached",
                        "lastModified": "Cached",
                        "folder": "Cached",
                        "created": "Cached",
                        "size": "Cached",
                        "fileCount": len([k for k, v in _data_cache.items() if v and (len(v) > 0 if isinstance(v, list) else v)])
                    },
                    "LoadTimestamp": "Cached",
                    "cached": True
                }
                # Compress large cached responses
                accept_encoding = request.headers.get('Accept-Encoding', '')
                if 'gzip' in accept_encoding and estimate_data_size_mb(_data_cache) > 10:
                    json_str = json.dumps(response_data)
                    compressed = gzip.compress(json_str.encode('utf-8'))
                    response = Response(compressed, mimetype='application/json')
                    response.headers['Content-Encoding'] = 'gzip'
                    response.headers['Content-Length'] = len(compressed)
                    return response
                return jsonify(response_data)
            elif not has_data:
                print("⚠️ Cache exists but is empty - forcing refresh")
        
        print("RETRY: Cache expired or missing, loading fresh data...")
        
        # Try Google Drive API first if enabled
        print(f"[INFO] Checking Google Drive API: USE_GOOGLE_DRIVE_API={USE_GOOGLE_DRIVE_API}, google_drive_service={google_drive_service is not None}")
        if USE_GOOGLE_DRIVE_API and google_drive_service:
            try:
                # Get cached file modification times for incremental sync
                cached_file_times = load_file_times_from_metadata()
                
                # Use incremental sync if we have cached data, otherwise full load
                if _data_cache and cached_file_times:
                    print("[INFO] Using incremental sync (only changed files)...")
                    data, folder_info, new_file_times = google_drive_service.get_all_data_incremental(cached_file_times)
                    
                    # Merge with existing cache (for unchanged files)
                    for filename, file_data in _data_cache.items():
                        if filename not in data:  # File unchanged
                            data[filename] = file_data
                    
                    # Update file times for next sync
                    # Merge new times with existing (keep unchanged file times)
                    for filename, file_time in cached_file_times.items():
                        if filename not in new_file_times:  # File unchanged
                            new_file_times[filename] = file_time
                    
                    save_file_times_to_metadata(new_file_times)
                else:
                    print("[INFO] Loading all data from Google Drive API (full sync)...")
                    # Google Drive version uses SAME extraction functions (extract_so_data_from_pdf, extract_so_data_from_docx)
                    result = google_drive_service.get_all_data()
                    if result and len(result) >= 2:
                        data, folder_info = result[0], result[1]
                        if data is None:
                            print(f"[ERROR] Google Drive API returned None for data. Error: {folder_info}")
                            data = {}
                            folder_info = {"error": folder_info or "Unknown error"}
                    else:
                        print(f"[ERROR] get_all_data returned invalid result: {result}")
                        data = {}
                        folder_info = {"error": "Invalid response from Google Drive API"}
                    
                    # Save file times for next incremental sync
                    # Get file modification times from Google Drive
                    try:
                        latest_folder_id, _ = google_drive_service.find_latest_api_extractions_folder()
                        if latest_folder_id:
                            query = f"('{latest_folder_id}' in parents) and (mimeType='application/json' or name contains '.json') and trashed=false"
                            list_params = {
                                'q': query,
                                'supportsAllDrives': True,
                                'includeItemsFromAllDrives': True,
                                'fields': "files(name, modifiedTime)"
                            }
                            if google_drive_service.shared_drive_id:
                                list_params['corpora'] = 'drive'
                                list_params['driveId'] = google_drive_service.shared_drive_id
                            
                            results = google_drive_service.service.files().list(**list_params).execute()
                            files = results.get('files', [])
                            file_times = {f['name']: f.get('modifiedTime', '') for f in files}
                            save_file_times_to_metadata(file_times)
                    except Exception as e:
                        print(f"⚠️ Failed to save file times: {e}")
                print(f"[INFO] Google Drive API returned: data type={type(data)}, data length={len(data) if data else 0}, folder_info={folder_info}")
                print(f"[INFO] Data keys: {list(data.keys()) if data and isinstance(data, dict) else 'not a dict'}")
                if data and isinstance(data, dict) and len(data) > 0:
                    # Load Sales Orders from important folders - WITH TIMEOUT to prevent hanging
                    # Load "In Production" (includes Scheduled subfolder) and "New and Revised"
                    print("📦 LOADING: Sales Orders (In Production, New and Revised) for initial load...")
                    so_filter_folders = ['In Production', 'New and Revised']
                    
                    # Set empty defaults first (so response can return even if Sales Orders fail)
                    data['SalesOrders.json'] = []
                    data['SalesOrdersByStatus'] = {}
                    data['TotalOrders'] = 0
                    data['StatusFolders'] = []
                    
                    try:
                        import signal
                        import threading
                        
                        # Use threading with timeout to prevent blocking
                        sales_data_result = [None]
                        sales_data_error = [None]
                        
                        def load_sales_orders_thread():
                            try:
                                if google_drive_service and google_drive_service.authenticated:
                                    print("[INFO] Using Google Drive API for Sales Orders")
                                    sales_data_result[0] = google_drive_service.load_sales_orders_data(None, filter_folders=so_filter_folders)
                                else:
                                    print("[INFO] Using local filesystem for Sales Orders")
                                    sales_data_result[0] = load_sales_orders(filter_folders=so_filter_folders)
                            except Exception as e:
                                sales_data_error[0] = e
                        
                        # Start loading in thread with 30 second timeout (increased for reliability)
                        thread = threading.Thread(target=load_sales_orders_thread, daemon=True)
                        thread.start()
                        thread.join(timeout=30)  # 30 second max wait (increased from 10s)
                        
                        if thread.is_alive():
                            print("⚠️ Sales Orders loading timed out after 30s - returning without Sales Orders")
                            print("⚠️ Use /api/sales-orders endpoint for full Sales Orders data")
                        elif sales_data_error[0]:
                            print(f"⚠️ Error loading Sales Orders: {sales_data_error[0]}")
                            import traceback
                            traceback.print_exc()
                        elif sales_data_result[0]:
                            # Success - add Sales Orders to data
                            sales_data = sales_data_result[0]
                            data['SalesOrders.json'] = sales_data.get('SalesOrders.json', [])
                            data['SalesOrdersByStatus'] = sales_data.get('SalesOrdersByStatus', {})
                            data['TotalOrders'] = sales_data.get('TotalOrders', 0)
                            data['StatusFolders'] = sales_data.get('StatusFolders', [])
                            data['ScanMethod'] = sales_data.get('ScanMethod', 'Google Drive API')
                            print(f"✅ Loaded {data['TotalOrders']} Sales Orders from {len(data['SalesOrdersByStatus'])} folders")
                    except Exception as e:
                        print(f"⚠️ Error in Sales Orders loading thread: {e}")
                        import traceback
                        traceback.print_exc()
                    
                    # CRITICAL: Validate data has content before caching
                    if should_cache_data(data):
                        _data_cache = data
                        _cache_timestamp = time.time()
                        save_cache_to_disk(data, folder_info)  # Save to disk for persistence
                        cache_size_mb = estimate_data_size_mb(data)
                        print(f"[OK] Data loaded successfully from Google Drive API: {len(data)} files (cached, {cache_size_mb:.1f}MB)")
                    else:
                        # Don't cache empty or large datasets
                        _data_cache = None
                        _cache_timestamp = None
                        print(f"[WARN] Data not cached - either empty or too large")
                    return jsonify({
                        "data": data,
                        "folderInfo": folder_info,
                        "LoadTimestamp": datetime.now().isoformat(),
                        "source": "Google Drive API"
                    })
                else:
                    print(f"[WARN] Google Drive API returned no data (data={data}, folder_info={folder_info}), falling back to local")
            except Exception as e:
                print(f"[ERROR] Google Drive API error: {e}")
                import traceback
                traceback.print_exc()
                print("[WARN] Falling back to local G: Drive")
        
        # Check if G: Drive is accessible (local fallback)
        if not os.path.exists(GDRIVE_BASE):
            print(f"ERROR: G: Drive not accessible at: {GDRIVE_BASE}")
            # Return empty data structure using REAL G: Drive file names that frontend expects
            empty_data = {
                # PRIMARY DATA FILES - EXACT FILE NAMES FROM G: DRIVE
                'CustomAlert5.json': [],           # PRIMARY: Complete item data
                'Items.json': [],
                'MIITEM.json': [],
                'MIILOC.json': [],                # Inventory location data
                'BillsOfMaterial.json': [],
                'BillOfMaterialDetails.json': [],
                'MIBOMH.json': [],
                'MIBOMD.json': [],
                'ManufacturingOrderHeaders.json': [],
                'ManufacturingOrderDetails.json': [],
                'ManufacturingOrderRoutings.json': [],
                'MIMOH.json': [],
                'MIMOMD.json': [],
                'MIMORD.json': [],
                'Jobs.json': [],
                'JobDetails.json': [],
                'MIJOBH.json': [],
                'MIJOBD.json': [],
                'MIPOH.json': [],
                'MIPOD.json': [],
                'MIPOHX.json': [],
                'MIPOC.json': [],
                'MIPOCV.json': [],
                'MIPODC.json': [],
                'MIWOH.json': [],
                'MIWOD.json': [],
                'MIBORD.json': [],
                'PurchaseOrderDetails.json': [],
                'PurchaseOrderExtensions.json': [],
                'PurchaseOrders.json': [],
                'WorkOrderHeaders.json': [],
                'WorkOrderDetails.json': [],
                'SalesOrderHeaders.json': [],
                'SalesOrderDetails.json': [],
                'PurchaseOrderAdditionalCosts.json': [],
                'PurchaseOrderAdditionalCostsTaxes.json': [],
                'PurchaseOrderDetailAdditionalCosts.json': [],
                # SALES ORDERS DATA FROM PDF SCANNING
                'SalesOrders.json': [],
                'SalesOrdersByStatus': {},
                'TotalOrders': 0,
                'StatusFolders': [],
                'ScanMethod': 'No G: Drive Access'
            }
            return jsonify({
                "data": empty_data,
                "folderInfo": {
                    "folderName": "No G: Drive Access",
                    "syncDate": datetime.now().isoformat(),
                    "lastModified": datetime.now().isoformat(),
                    "folder": "Not Connected",
                    "created": datetime.now().isoformat(),
                    "size": "0",
                    "fileCount": 0
                },
                "LoadTimestamp": datetime.now().isoformat(),
                "warning": "G: Drive not accessible - returning empty data"
            })
        
        latest_folder, error = get_latest_folder()
        if error:
            print(f"ERROR: Error getting latest folder: {error}")
            return jsonify({"error": error}), 500
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        print(f"📂 Loading data from folder: {folder_path}")
        
        # LOAD ACTUAL DATA FROM JSON FILES
        raw_data = {}
        
        print(f"📥 LOADING: ALL MiSys data files from API Extractions (HTTP/2 enabled - no size limit)...")
        
        # Load ALL JSON files from the folder (HTTP/2 removes 32MB limit)
        json_files = glob.glob(os.path.join(folder_path, "*.json"))
        for json_file in json_files:
            file_name = os.path.basename(json_file)
            raw_data[file_name] = load_json_file(json_file)
        
        print(f"✅ LOADED: {len(raw_data)} JSON files from API Extractions folder")
        print(f"   Files: {', '.join(sorted(raw_data.keys()))}")
        print(f"📦 Sales Orders: Default loads 'In Production' + 'New and Revised' only (~8.6MB)")
        
        # Use data AS-IS - no conversion needed!
        
        # Get folder info
        folder_info = {
            "folderName": latest_folder,
            "syncDate": datetime.fromtimestamp(os.path.getmtime(folder_path)).isoformat(),
            "lastModified": datetime.fromtimestamp(os.path.getmtime(folder_path)).isoformat(),
            "folder": folder_path,
            "created": datetime.fromtimestamp(os.path.getctime(folder_path)).isoformat(),
            "size": "G: Drive",
            "fileCount": len([f for f in raw_data.keys() if f.endswith('.json')])
        }
        
        # Load Sales Orders from important folders
        # Load "In Production" (includes Scheduled subfolder) and "New and Revised"
        print("📦 Loading Sales Orders from: In Production, New and Revised")
        so_filter_folders = ['In Production', 'New and Revised']
        
        try:
            if USE_GOOGLE_DRIVE_API and google_drive_service and google_drive_service.authenticated:
                print("[INFO] Using Google Drive API for Sales Orders")
                sales_data = google_drive_service.load_sales_orders_data(None, filter_folders=so_filter_folders)
            else:
                print("[INFO] Using local filesystem for Sales Orders")
                sales_data = load_sales_orders(filter_folders=so_filter_folders)
            
            # Extract data from sales_data response
            raw_data['SalesOrders.json'] = sales_data.get('SalesOrders.json', [])
            raw_data['SalesOrdersByStatus'] = sales_data.get('SalesOrdersByStatus', {})
            raw_data['TotalOrders'] = sales_data.get('TotalOrders', 0)
            raw_data['StatusFolders'] = sales_data.get('StatusFolders', [])
            
            print(f"✅ Loaded {raw_data['TotalOrders']} Sales Orders from {len(raw_data['SalesOrdersByStatus'])} folders")
        except Exception as e:
            print(f"⚠️ Error loading Sales Orders: {e}")
            import traceback
            traceback.print_exc()
            # Don't fail the entire request if Sales Orders fail - set empty defaults
            raw_data['SalesOrders.json'] = []
            raw_data['SalesOrdersByStatus'] = {}
            raw_data['TotalOrders'] = 0
            raw_data['StatusFolders'] = []
        
        # Enterprise SO Service integration
        try:
            from enterprise_so_service import get_so_service_health
            so_health = get_so_service_health()
            raw_data['SOServiceHealth'] = so_health
            print(f"SUCCESS: SO Service Health: {so_health['status']} - {so_health['total_sos']} SOs cached")
        except Exception as e:
            print(f"⚠️ Enterprise SO Service not available: {e}")
        
        # Skip MPS data - load on-demand via /api/mps endpoint
        print("⏭️ SKIP: MPS data (load on-demand)")
        raw_data['MPS.json'] = {"mps_orders": [], "summary": {"total_orders": 0}}
        
        print(f"SUCCESS: Successfully loaded data from {latest_folder}")
        
        # SAFE DATA SUMMARY - Only process list data types
        safe_summary = []
        for k, v in raw_data.items():
            if isinstance(v, list):
                safe_summary.append(f'{k}: {len(v)} records')
            elif isinstance(v, (str, int, float, bool)):
                safe_summary.append(f'{k}: {type(v).__name__} value')
            else:
                safe_summary.append(f'{k}: {type(v).__name__}')
        
        print(f"📊 Data summary: {safe_summary}")
        
        # Cache the data for future requests - only if size is reasonable
        print(f"🔵 About to cache data...")
        if should_cache_data(raw_data):
            _data_cache = raw_data
            _cache_timestamp = time.time()
            save_cache_to_disk(raw_data, folder_info)  # Save to disk for persistence
            cache_size_mb = estimate_data_size_mb(raw_data)
            print(f"💾 Data cached for {_cache_duration} seconds ({cache_size_mb:.1f}MB)")
        else:
            # Don't cache large datasets to prevent OOM
            _data_cache = None
            _cache_timestamp = None
            print(f"⚠️ Data too large to cache - skipping cache to prevent OOM")
        
        print(f"🔵 Creating JSON response...")
        response_data = {
            "data": raw_data,
            "folderInfo": folder_info,
            "LoadTimestamp": datetime.now().isoformat(),
            "cached": False  # Indicate this was fresh data
        }
        print(f"🔵 About to jsonify and return...")
        result = jsonify(response_data)
        
        # Compress large responses (69MB -> ~10-15MB with gzip)
        accept_encoding = request.headers.get('Accept-Encoding', '')
        if 'gzip' in accept_encoding and estimate_data_size_mb(raw_data) > 10:
            print(f"📦 Compressing response ({estimate_data_size_mb(raw_data):.1f}MB)...")
            json_str = json.dumps(response_data)
            compressed = gzip.compress(json_str.encode('utf-8'))
            print(f"✅ Compressed to {len(compressed) / 1024 / 1024:.1f}MB ({len(compressed) / len(json_str.encode('utf-8')) * 100:.1f}% of original)")
            response = Response(compressed, mimetype='application/json')
            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Content-Length'] = len(compressed)
            return response
        
        print(f"✅ JSON created successfully, returning 200")
        return result
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_type = type(e).__name__
        error_message = str(e)
        
        print(f"❌ ERROR in get_all_data: {error_type}: {error_message}")
        print(f"❌ Traceback:\n{error_trace}")
        
        return jsonify({
            'error': {
                'code': '500',
                'message': error_message,
                'type': error_type,
                'trace': error_trace
            }
        }), 500

def scan_folder_recursively(folder_path, status, path_parts=[]):
    """Recursively scan any folder structure and find all PDF files"""
    orders = []
    
    try:
        if not os.path.exists(folder_path):
            return orders
            
        items = os.listdir(folder_path)
        so_files = [item for item in items if item.lower().endswith(('.pdf', '.doc', '.docx'))]
        subfolders = [item for item in items if os.path.isdir(os.path.join(folder_path, item)) and item.lower() not in ['desktop.ini', 'thumbs.db']]
        
        # Process ALL SO files in current folder (PDF, DOC, DOCX)
        for file in so_files:
            # Look for any SO pattern, not just "salesorder_"
            if any(pattern in file.lower() for pattern in ['salesorder', 'sales order', 'so_', 'so-', 'order']):
                try:
                    # Extract order number from various filename patterns
                    order_num = 'Unknown'
                    import re
                    
                    # Try different patterns to extract SO number
                    patterns = [
                        r'salesorder[_\s-]*(\d+)',
                        r'sales\s*order[_\s-]*(\d+)',
                        r'so[_\s-]*(\d+)',
                        r'order[_\s-]*(\d+)',
                        r'(\d+)'  # fallback - any number
                    ]
                    
                    for pattern in patterns:
                        match = re.search(pattern, file.lower())
                        if match:
                            order_num = match.group(1)
                            break
                    
                    file_path = os.path.join(folder_path, file)
                    file_stat = os.stat(file_path)
                    
                    # Determine actual status - check if in Scheduled subfolder
                    actual_status = status
                    if path_parts and 'scheduled' in '/'.join(path_parts).lower():
                        actual_status = 'Scheduled'
                    
                    # Build comprehensive path hierarchy
                    path_info = {
                        'Order No.': order_num,
                        'Customer': 'Customer Data',
                        'Order Date': datetime.fromtimestamp(file_stat.st_ctime).strftime('%Y-%m-%d'),
                        'Ship Date': datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d'),
                        'Status': actual_status,  # Use actual status (Scheduled if in Scheduled subfolder)
                        'File': file,
                        'File Path': file_path,
                        'File Type': file.split('.')[-1].upper(),
                        'Last Modified': datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                        'Folder Path': '/'.join(path_parts) if path_parts else 'Root',
                        'Full Path': '/'.join([status] + path_parts) if path_parts else status,
                        'Parent Status': status  # Keep original parent folder status for reference
                    }
                    
                    # Add dynamic path levels
                    for i, part in enumerate(path_parts):
                        path_info[f'Level_{i+1}'] = part
                    
                    orders.append(path_info)
                    
                except Exception as e:
                    print(f"ERROR: Error processing file {file}: {e}")
        
        # Recursively process subfolders - EXCLUDE "Closed" and "Cancelled"
        excluded_subfolders = ['Closed', 'Cancelled', 'closed', 'cancelled', 'Completed and Closed']
        for subfolder in subfolders:
            # SKIP excluded folders
            if subfolder in excluded_subfolders:
                print(f"[INFO] SKIPPING excluded subfolder: {subfolder}")
                continue
            
            # Also skip if subfolder name contains excluded terms
            if any(excluded in subfolder for excluded in excluded_subfolders):
                print(f"[INFO] SKIPPING subfolder containing excluded term: {subfolder}")
                continue
            
            subfolder_path = os.path.join(folder_path, subfolder)
            new_path_parts = path_parts + [subfolder]
            subfolder_orders = scan_folder_recursively(subfolder_path, status, new_path_parts)
            orders.extend(subfolder_orders)
            
            if subfolder_orders:
                path_str = '/'.join(new_path_parts)
                print(f"📄 Found {len(subfolder_orders)} orders in {status}/{path_str}")
        
        return orders
        
    except Exception as e:
        print(f"ERROR: Error scanning folder {folder_path}: {e}")
        return orders

def load_cached_so_data():
    """Load cached parsed SO data for instant lookups"""
    try:
        cache_dir = "cache"
        parsed_sos_file = os.path.join(cache_dir, "ParsedSalesOrders.json")
        item_index_file = os.path.join(cache_dir, "SOItemIndex.json")
        cache_status_file = os.path.join(cache_dir, "SOCacheStatus.json")
        
        cached_data = {}
        
        # Load parsed SOs
        if os.path.exists(parsed_sos_file):
            with open(parsed_sos_file, 'r') as f:
                parsed_sos = json.load(f)
                cached_data['ParsedSalesOrders.json'] = parsed_sos
                print(f"SUCCESS: Loaded {len(parsed_sos)} parsed SOs from cache")
        
        # Load item index
        if os.path.exists(item_index_file):
            with open(item_index_file, 'r') as f:
                item_index = json.load(f)
                cached_data['SOItemIndex.json'] = item_index
                print(f"SUCCESS: Loaded {len(item_index)} item index entries from cache")
        
        # Load cache status
        if os.path.exists(cache_status_file):
            with open(cache_status_file, 'r') as f:
                cache_status = json.load(f)
                cached_data['SOCacheStatus'] = cache_status
                print(f"SUCCESS: Cache last updated: {cache_status.get('last_updated', 'Unknown')}")
        
        return cached_data if cached_data else None
        
    except Exception as e:
        print(f"ERROR: Error loading cached SO data: {e}")
        return None

def load_sales_orders(filter_folders=None):
    """Smart Sales Orders loader - discovers ANY folder structure dynamically
    
    Args:
        filter_folders: List of specific folders to load (e.g., ['In Production', 'New and Revised'])
                       If None, loads all folders
    """
    try:
        print(f"SEARCH: Smart scanning Sales Orders from: {SALES_ORDERS_BASE}")
        
        if not os.path.exists(SALES_ORDERS_BASE):
            print(f"ERROR: Sales Orders path not accessible: {SALES_ORDERS_BASE}")
            return {}
        
        # Discover all status folders dynamically
        base_items = os.listdir(SALES_ORDERS_BASE)
        all_status_folders = [item for item in base_items if os.path.isdir(os.path.join(SALES_ORDERS_BASE, item)) and item != 'desktop.ini']
        
        # ALWAYS exclude "Closed" and "Cancelled" from main loading (unless explicitly requested)
        excluded_folders = ['Closed', 'Cancelled', 'closed', 'cancelled', 'Completed and Closed']
        all_status_folders = [f for f in all_status_folders if f not in excluded_folders]
        
        # Apply filter if specified
        if filter_folders:
            status_folders = [f for f in all_status_folders if f in filter_folders]
            print(f"SEARCH: Filtered to specific folders: {status_folders} (out of {all_status_folders})")
        else:
            status_folders = all_status_folders
            print(f"SEARCH: Discovered all status folders: {status_folders}")
        
        sales_data = {}
        all_orders = []
        
        for status in status_folders:
            folder_path = os.path.join(SALES_ORDERS_BASE, status)
            print(f"RETRY: Scanning {status}...")
            
            # Recursively scan this status folder
            try:
                orders = scan_folder_recursively(folder_path, status)
            except Exception as e:
                print(f"ERROR: Failed to scan folder {status}: {e}")
                import traceback
                traceback.print_exc()
                orders = []
            
            # Separate Scheduled orders from In Production
            scheduled_orders = []
            production_orders = []
            
            try:
                for order in orders:
                    if not isinstance(order, dict):
                        continue
                    # Check if order is in Scheduled subfolder
                    folder_path_str = str(order.get('Folder Path', '') or order.get('Full Path', ''))
                    level_1 = str(order.get('Level_1', ''))
                    if 'scheduled' in folder_path_str.lower() or 'scheduled' in level_1.lower():
                        scheduled_orders.append(order)
                        order['Status'] = 'Scheduled'  # Override status for Scheduled orders
                    else:
                        production_orders.append(order)
            except Exception as e:
                print(f"ERROR: Failed to separate Scheduled orders: {e}")
                import traceback
                traceback.print_exc()
                # Fallback: just use all orders as production orders
                production_orders = orders
                scheduled_orders = []
            
            # Store orders by their actual status
            # IMPORTANT: Scheduled orders are part of "In Production" - count them in both places
            if scheduled_orders:
                if 'Scheduled' not in sales_data:
                    sales_data['Scheduled'] = []
                sales_data['Scheduled'].extend(scheduled_orders)
                print(f"SUCCESS: Found {len(scheduled_orders)} Scheduled orders in {status}/Scheduled")
            
            # For "In Production", include ALL orders (both production and scheduled) in the main count
            # This way "In Production" shows the total, and "Scheduled" shows the subset
            if status == 'In Production':
                # Include all orders (both production and scheduled) in In Production
                sales_data[status] = orders  # Use original orders list which includes both
                print(f"SUCCESS: Found {len(orders)} total orders in {status} (including {len(scheduled_orders)} Scheduled)")
            elif production_orders:
                # For other statuses, only show production orders
                sales_data[status] = production_orders
                print(f"SUCCESS: Found {len(production_orders)} orders in {status}")
            
            all_orders.extend(orders)
        
        # Smart sorting by order number
        def smart_sort(order):
            try:
                order_num = order['Order No.']
                import re
                numbers = re.findall(r'\d+', order_num)
                return int(numbers[0]) if numbers else 0
            except:
                return 0
        
        all_orders.sort(key=smart_sort, reverse=True)
        
        # Update status folders list to include Scheduled if it exists
        final_status_folders = list(status_folders)
        if 'Scheduled' in sales_data and 'Scheduled' not in final_status_folders:
            final_status_folders.append('Scheduled')
        
        print(f"🎉 Smart scan complete! Found {len(all_orders)} total sales orders across {len(final_status_folders)} status folders")
        if 'Scheduled' in sales_data:
            print(f"📅 Found {len(sales_data['Scheduled'])} Scheduled orders in In Production/Scheduled")
        
        return {
            'SalesOrders.json': all_orders,
            'SalesOrdersByStatus': sales_data,
            'LoadTimestamp': datetime.now().isoformat(),
            'TotalOrders': len(all_orders),
            'StatusFolders': final_status_folders,
            'ScanMethod': 'Smart Recursive Discovery'
        }
        
    except Exception as e:
        print(f"ERROR: Error in smart sales orders loading: {e}")
        return {}

def load_mps_from_excel():
    """Fallback: Load MPS data from Excel file"""
    try:
        MPS_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
        MPS_EXCEL_PATH = os.path.join(MPS_BASE, "MPS.xlsx")
        
        if not os.path.exists(MPS_EXCEL_PATH):
            print(f"ERROR: MPS Excel file not found at: {MPS_EXCEL_PATH}")
            return {"error": "MPS file not found"}
        
        print(f"📊 Loading MPS data from Excel: {MPS_EXCEL_PATH}")
        
        # Load Excel file using openpyxl (lighter than pandas)
        import openpyxl
        wb = openpyxl.load_workbook(MPS_EXCEL_PATH, data_only=True)
        sheet = wb.active
        
        # Get headers from first row
        headers = [cell.value for cell in sheet[1]]
        
        print(f"📊 Loaded Excel file with {sheet.max_row} rows")
        
        # Convert to MPS format
        mps_orders = []
        for row in sheet.iter_rows(min_row=2, values_only=False):
            row_dict = {}
            for i, cell in enumerate(row):
                if i < len(headers):
                    row_dict[headers[i]] = cell.value
            
            mps_order = {
                'order_id': str(row_dict.get('Order ID', '')),
                'item_code': str(row_dict.get('Item Code', '')),
                'description': str(row_dict.get('Description', '')),
                'quantity': float(row_dict.get('Quantity', 1)) if row_dict.get('Quantity') else 1.0,
                'start_date': str(row_dict.get('Start Date', '')),
                'due_date': str(row_dict.get('Due Date', '')),
                'status': str(row_dict.get('Status', 'scheduled')),
                'priority': str(row_dict.get('Priority', 'medium')),
                'customer': str(row_dict.get('Customer', '')),
                'work_center': str(row_dict.get('Work Center', 'Production')),
                'estimated_hours': float(row_dict.get('Estimated Hours', 8)) if row_dict.get('Estimated Hours') else 8.0,
                'actual_hours': float(row_dict.get('Actual Hours', 0)) if row_dict.get('Actual Hours') else 0.0,
                'materials': [],
                'revenue': float(row_dict.get('Revenue', 0)) if row_dict.get('Revenue') else 0.0
            }
            mps_orders.append(mps_order)
        
        print(f"📊 Processed {len(mps_orders)} MPS orders from Excel")
        
        return {
            'mps_orders': mps_orders,
            'source': 'excel',
            'total_orders': len(mps_orders)
        }
        
    except Exception as e:
        print(f"ERROR: Failed to load MPS from Excel: {e}")
        return {"error": f"Excel loading failed: {e}"}

def load_mps_data():
    """Load MPS (Master Production Schedule) data from Google Sheets using alternative method"""
    # Import requests at the function level
    import requests
    
    try:
        # Use Google Sheets API to read the MPS data directly
        sheet_id = "1zAOY7ngP2mLVi-W_FL9tsPiKDPqbU6WEUmrrTDeKygw"
        
        print(f"Loading MPS data from Google Sheets: {sheet_id}")
        
        # Use the working URL format immediately (format 4 that works)
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
        
        print(f"Using working Google Sheets URL: {csv_url}")
        
        try:
            response = requests.get(csv_url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            })
            
            if response.status_code == 200:
                csv_data = response.text
                print(f"Success with Google Sheets URL")
            else:
                print(f"ERROR: Google Sheets failed: Status {response.status_code}")
                return load_mps_from_excel()
                
        except Exception as e:
            print(f"ERROR: Google Sheets error: {e}")
            return load_mps_from_excel()
        
        
        # Parse CSV data
        import csv
        import io
        
        reader = csv.reader(io.StringIO(csv_data))
        rows = list(reader)
        
        print(f"Retrieved {len(rows)} rows from Google Sheets")
        
        if len(rows) < 5:
            print("ERROR: Not enough data in Google Sheets")
            return load_mps_from_excel()
        
        # Find header row (should be row 4, index 3)
        headers = None
        data_start_row = 4  # Row 5 in 1-based indexing
        
        if len(rows) > 3:
            headers = rows[3]  # Row 4 (0-based index 3)
            print(f"Headers: {headers[:10]}...")  # Show first 10 headers
        
        if not headers:
            print("ERROR: Could not find headers in Google Sheets")
            return load_mps_from_excel()
        
        # Process production orders
        mps_orders = []
        
        for i, row in enumerate(rows[data_start_row:], start=data_start_row + 1):
            if len(row) < 2:  # Skip empty rows
                continue
            
            # Skip rows where first column is empty or just whitespace
            if not row[0] or not row[0].strip():
                continue
            
            try:
                # Map row data to our structure
                order_data = {
                    'order_number': row[0].strip() if len(row) > 0 else '',
                    'so_number': row[1].strip() if len(row) > 1 else '',
                    'mo_number': row[2].strip() if len(row) > 2 else '',
                    'work_center': row[3].strip() if len(row) > 3 else '',
                    'status': row[4].strip() if len(row) > 4 else '',
                    'product': row[5].strip() if len(row) > 5 else '',
                    'customer': row[6].strip() if len(row) > 6 else '',
                    'packaging': row[7].strip() if len(row) > 7 else '',
                    'required': row[8].strip() if len(row) > 8 else '',
                    'ready': row[9].strip() if len(row) > 9 else '',
                    'planned': row[10].strip() if len(row) > 10 else '',
                    'actual': row[11].strip() if len(row) > 11 else '',
                    'promised': row[12].strip() if len(row) > 12 else '',
                    'start_date': row[13].strip() if len(row) > 13 else '',
                    'end_date': row[14].strip() if len(row) > 14 else '',
                    'duration': row[15].strip() if len(row) > 15 else '',
                    'dtc': row[16].strip() if len(row) > 16 else '',
                    'action_items': row[17].strip() if len(row) > 17 else ''
                }
                
                # Only add if we have essential data
                if order_data['order_number'] and order_data['so_number']:
                    mps_orders.append(order_data)
                    
            except Exception as e:
                print(f"⚠️ Error processing row {i}: {e}")
                continue
        
        print(f"SUCCESS: Processed {len(mps_orders)} MPS orders from Google Sheets")
        
        if mps_orders:
            print(f"Sample order: {mps_orders[0]}")
        
        return {
            "mps_orders": mps_orders,
            "summary": {
                "total_orders": len(mps_orders),
                "source": "Google Sheets API",
                "sheet_id": sheet_id,
                "last_updated": datetime.now().isoformat()
            }
        }
        
    except requests.RequestException as e:
        print(f"ERROR: Error accessing Google Sheets: {e}")
        return {"error": f"Could not access Google Sheets: {str(e)}"}
    except Exception as e:
        print(f"ERROR: Error parsing Google Sheets data: {e}")
        return {"error": f"Error parsing data: {str(e)}"}

@app.route('/api/mps', methods=['GET'])
def get_mps_data():
    """Get MPS data only - without Unicode issues"""
    try:
        import requests
        mps_data = load_mps_data()
        return jsonify(mps_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/data/clear-cache', methods=['POST'])
def clear_data_cache():
    """Clear the data cache - both memory and disk"""
    global _data_cache, _cache_timestamp
    _data_cache = None
    _cache_timestamp = None
    
    # Also clear disk cache
    try:
        if os.path.exists(CACHE_FILE):
            os.remove(CACHE_FILE)
        if os.path.exists(CACHE_METADATA_FILE):
            os.remove(CACHE_METADATA_FILE)
        if os.path.exists(CACHE_TEMP_FILE):
            os.remove(CACHE_TEMP_FILE)
        if os.path.exists(CACHE_METADATA_TEMP_FILE):
            os.remove(CACHE_METADATA_TEMP_FILE)
        print("✅ Cache cleared (memory + disk)")
    except Exception as e:
        print(f"⚠️ Error clearing disk cache: {e}")
    
    return jsonify({"status": "Cache cleared", "memory": True, "disk": True})

@app.route('/api/data/cache-status', methods=['GET'])
def get_cache_status_endpoint():
    """Get cache status for debugging"""
    status = get_cache_status()
    return jsonify(status)

@app.route('/api/data/fix-cache', methods=['POST'])
def fix_cache_endpoint():
    """Fix corrupted cache by clearing it"""
    cleared = clear_corrupted_cache()
    global _data_cache, _cache_timestamp
    _data_cache = None
    _cache_timestamp = None
    return jsonify({
        "status": "Cache fixed" if cleared else "Cache already clean",
        "corrupted_files_removed": cleared
    })

@app.route('/api/data/lazy-load', methods=['POST'])
def lazy_load_additional_data():
    """Lazy load additional data files when needed - supports files or groups"""
    try:
        data = request.get_json()
        requested_files = data.get('files', [])
        requested_groups = data.get('groups', [])
        
        # Define groups (same as in get_all_data)
        lazy_load_groups = {
            'manufacturing': [
                'ManufacturingOrderHeaders.json', 'ManufacturingOrderDetails.json',
                'ManufacturingOrderRoutings.json', 'MIMOH.json', 'MIMOMD.json', 'MIMORD.json'
            ],
            'bom': [
                'BillsOfMaterial.json', 'BillOfMaterialDetails.json',
                'MIBOMH.json', 'MIBOMD.json'
            ],
            'purchasing': [
                'PurchaseOrders.json', 'PurchaseOrderDetails.json',
                'MIPOH.json', 'MIPOD.json', 'MIPOHX.json', 'MIPOC.json', 'MIPOCV.json', 'MIPODC.json',
                'PurchaseOrderExtensions.json', 'PurchaseOrderAdditionalCosts.json',
                'PurchaseOrderAdditionalCostsTaxes.json', 'PurchaseOrderDetailAdditionalCosts.json'
            ],
            'jobs': [
                'Jobs.json', 'JobDetails.json', 'MIJOBH.json', 'MIJOBD.json'
            ],
            'workorders': [
                'WorkOrders.json', 'WorkOrderDetails.json',
                'MIWOH.json', 'MIWOD.json', 'MIBORD.json'
            ],
            'items': [
                'Items.json', 'MIITEM.json'
            ]
        }
        
        # Expand groups into files
        all_files_to_load = list(requested_files)
        for group in requested_groups:
            if group in lazy_load_groups:
                all_files_to_load.extend(lazy_load_groups[group])
                print(f"📦 Loading group '{group}' with {len(lazy_load_groups[group])} files")
        
        if not all_files_to_load:
            return jsonify({"error": "No files or groups specified"}), 400
        
        # Check if G: Drive is accessible
        if not os.path.exists(GDRIVE_BASE):
            return jsonify({"error": "G: Drive not accessible"}), 500
        
        latest_folder, error = get_latest_folder()
        if error:
            return jsonify({"error": error}), 500
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        loaded_files = {}
        
        for file_name in all_files_to_load:
            file_path = os.path.join(folder_path, file_name)
            if os.path.exists(file_path):
                file_data = load_json_file(file_path)
                loaded_files[file_name] = file_data
                print(f"SUCCESS: Lazy loaded {file_name} with {len(file_data) if isinstance(file_data, list) else 1} records")
            else:
                loaded_files[file_name] = []
                print(f"⚠️ {file_name} not found")
        
        return jsonify({
            "data": loaded_files,
            "LoadTimestamp": datetime.now().isoformat(),
            "filesLoaded": len(loaded_files)
        })
        
    except Exception as e:
        print(f"ERROR: Error in lazy_load_additional_data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales-orders', methods=['GET'])
def get_sales_orders():
    """Get Sales Orders from G: Drive - BY DEFAULT loads only ACTIVE orders
    
    Query params:
    - folders: Comma-separated list of folders to load (e.g., "In Production,New and Revised")
    - all: Set to 'true' to load all folders (including historical)
    
    DEFAULT BEHAVIOR (no params): Loads only "In Production" and "New and Revised" (~8.6MB)
    """
    try:
        # Get folder filter from query params
        folders_param = request.args.get('folders', '')
        load_all = request.args.get('all', 'false').lower() == 'true'
        
        # Determine which folders to load
        if load_all:
            filter_folders = None  # Load all
            print("[INFO] Loading ALL Sales Orders folders (active + historical)")
        elif folders_param:
            filter_folders = [f.strip() for f in folders_param.split(',')]
            print(f"[INFO] Loading Sales Orders from specific folders: {filter_folders}")
        else:
            # DEFAULT: Load only active folders
            filter_folders = ['In Production', 'New and Revised']
            print(f"[INFO] Loading ACTIVE Sales Orders only: {filter_folders}")
        
        # Check if using Google Drive API (Cloud Run) or local filesystem
        if USE_GOOGLE_DRIVE_API and google_drive_service and google_drive_service.authenticated:
            print("[INFO] Using Google Drive API for Sales Orders")
            sales_data = google_drive_service.load_sales_orders_data(None, filter_folders=filter_folders)
        else:
            print("[INFO] Using local filesystem for Sales Orders")
            sales_data = load_sales_orders(filter_folders=filter_folders)
        
        return jsonify(sales_data)
    except Exception as e:
        print(f"ERROR: Error in get_sales_orders: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales-orders/historical', methods=['GET'])
def get_historical_sales_orders():
    """Get HISTORICAL Sales Orders (Cancelled, Completed and Closed)
    
    Only load when user specifically requests historical data.
    """
    try:
        print("[INFO] Loading HISTORICAL Sales Orders (Cancelled, Completed and Closed)")
        filter_folders = ['Cancelled', 'Completed and Closed']
        
        # Check if using Google Drive API or local filesystem
        if USE_GOOGLE_DRIVE_API and google_drive_service and google_drive_service.authenticated:
            print("[INFO] Using Google Drive API for historical Sales Orders")
            sales_data = google_drive_service.load_sales_orders_data(None, filter_folders=filter_folders)
        else:
            print("[INFO] Using local filesystem for historical Sales Orders")
            sales_data = load_sales_orders(filter_folders=filter_folders)
        
        return jsonify(sales_data)
    except Exception as e:
        print(f"ERROR: Error in get_historical_sales_orders: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/enterprise/so-service/health', methods=['GET'])
def get_enterprise_so_health():
    """Get Enterprise SO Service health status"""
    try:
        from enterprise_so_service import get_so_service_health
        health = get_so_service_health()
        return jsonify(health)
    except Exception as e:
        return jsonify({"error": str(e), "status": "unavailable"}), 500

@app.route('/api/so-performance', methods=['GET'])
def get_so_performance():
    """Get SO loading performance statistics"""
    try:
        from so_performance_optimizer import get_so_performance_stats
        stats = get_so_performance_stats()
        return jsonify({
            "status": "success",
            "performance": stats,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "status": "unavailable"}), 500

@app.route('/api/so-performance/refresh', methods=['POST'])
def refresh_so_performance_cache():
    """Force refresh SO performance cache"""
    try:
        from so_performance_optimizer import force_so_refresh
        refreshed_data = force_so_refresh()
        return jsonify({
            "status": "success",
            "message": "SO cache refreshed successfully",
            "data": {
                "total_orders": refreshed_data.get('TotalOrders', 0),
                "load_time": refreshed_data.get('LoadTime', 0),
                "load_method": refreshed_data.get('LoadMethod', 'Unknown')
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "status": "failed"}), 500

@app.route('/api/so-background-refresh', methods=['GET'])
def get_so_background_refresh_status():
    """Get SO background refresh service status"""
    try:
        from so_background_refresh import get_so_refresh_status
        status = get_so_refresh_status()
        return jsonify({
            "status": "success",
            "background_refresh": status,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "status": "unavailable"}), 500

@app.route('/api/so-background-refresh/force', methods=['POST'])
def force_so_background_refresh():
    """Force immediate SO background refresh"""
    try:
        from so_background_refresh import force_so_refresh_now
        force_so_refresh_now()
        return jsonify({
            "status": "success",
            "message": "Background refresh triggered successfully",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e), "status": "failed"}), 500

@app.route('/api/enterprise/so-service/refresh', methods=['POST'])
def refresh_so_cache():
    """Trigger incremental SO cache refresh"""
    try:
        from enterprise_so_service import EnterpriseSO, get_so_service_health
        service = EnterpriseSO()
        service.incremental_parse()
        
        health = get_so_service_health()
        return jsonify({
            "success": True,
            "message": "SO cache refreshed",
            "health": health
        })
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/api/sales-order-pdf/<path:file_path>', methods=['GET'])
def get_sales_order_pdf(file_path):
    """Serve a Sales Order PDF file by full path or Google Drive file ID"""
    try:
        print(f"[INFO] Serving PDF: {file_path}")
        
        # Decode URL encoding
        import urllib.parse
        decoded_path = urllib.parse.unquote(file_path)
        
        # Check if this is a Google Drive file ID (gdrive:// prefix)
        if decoded_path.startswith('gdrive://'):
            file_id = decoded_path.replace('gdrive://', '')
            print(f"[INFO] Detected Google Drive file ID: {file_id}")
            
            # Try Google Drive API if enabled
            if USE_GOOGLE_DRIVE_API and google_drive_service and google_drive_service.authenticated:
                try:
                    # Download file from Google Drive
                    print(f"[INFO] Downloading file from Google Drive: {file_id}")
                    file_content = google_drive_service.download_file_content(file_id)
                    
                    if file_content:
                        # Get file name from Google Drive
                        try:
                            file_metadata = google_drive_service.service.files().get(
                                fileId=file_id,
                                fields='name'
                            ).execute()
                            filename = file_metadata.get('name', 'sales_order.pdf')
                        except:
                            filename = 'sales_order.pdf'
                        
                        print(f"[OK] Successfully downloaded file from Google Drive: {filename}")
                        
                        # Serve the file content
                        from flask import Response
                        return Response(
                            file_content,
                            mimetype='application/pdf',
                            headers={
                                'Content-Disposition': f'inline; filename="{filename}"',
                                'Content-Type': 'application/pdf'
                            }
                        )
                    else:
                        print(f"[ERROR] Failed to download file from Google Drive: {file_id}")
                        return jsonify({"error": f"Failed to download PDF from Google Drive: {file_id}"}), 404
                        
                except Exception as e:
                    print(f"[ERROR] Google Drive API error: {e}")
                    import traceback
                    traceback.print_exc()
                    return jsonify({"error": f"Error downloading PDF from Google Drive: {str(e)}"}), 500
            else:
                print(f"[ERROR] Google Drive API not available")
                return jsonify({"error": "Google Drive API not available"}), 500
        
        # Handle local file path (fallback for local development)
        if not os.path.exists(decoded_path):
            print(f"[ERROR] PDF file not found: {decoded_path}")
            return jsonify({"error": f"PDF file not found: {decoded_path}"}), 404
        
        # Serve the PDF file directly
        from flask import send_file
        filename = os.path.basename(decoded_path)
        
        return send_file(
            decoded_path,
            as_attachment=False,
            download_name=filename,
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"[ERROR] Error serving PDF {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales-orders/folder/<path:folder_path>', methods=['GET', 'HEAD', 'OPTIONS'])
def get_sales_order_folder(folder_path):
    """Get Sales Order folder contents dynamically - REAL TIME SYNC from Google Drive with caching"""
    global _so_folder_cache, _so_folder_cache_timestamps
    
    try:
        # Handle HEAD/OPTIONS requests quickly
        if request.method in ['HEAD', 'OPTIONS']:
            return jsonify({"status": "ok"}), 200
        
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        print(f"[INFO] Loading Sales Order folder: {folder_path} (force_refresh={force_refresh})")
        
        # Check cache first (unless forcing refresh)
        if not force_refresh and folder_path in _so_folder_cache and folder_path in _so_folder_cache_timestamps:
            cache_age = time.time() - _so_folder_cache_timestamps[folder_path]
            cached_data = _so_folder_cache[folder_path]
            
            if cache_age < _so_folder_cache_duration and cached_data:
                print(f"[OK] Returning cached folder data (age: {cache_age:.1f}s, duration: {_so_folder_cache_duration}s)")
                return jsonify({
                    **cached_data,
                    'cached': True,
                    'cache_age': cache_age
                })
            else:
                print(f"[INFO] Cache expired (age: {cache_age:.1f}s), loading fresh data...")
                # Remove expired cache
                if folder_path in _so_folder_cache:
                    del _so_folder_cache[folder_path]
                if folder_path in _so_folder_cache_timestamps:
                    del _so_folder_cache_timestamps[folder_path]
        
        # Try Google Drive API first if enabled
        if USE_GOOGLE_DRIVE_API and google_drive_service and google_drive_service.authenticated:
            try:
                # Find Sales_CSR drive
                sales_csr_drive_id = google_drive_service.find_shared_drive("Sales_CSR")
                if not sales_csr_drive_id:
                    print(f"[ERROR] Sales_CSR drive not found")
                    # Fall back to local
                else:
                    # Build the full path: Customer Orders/Sales Orders/{folder_path}
                    full_path = f"Customer Orders/Sales Orders/{folder_path}" if folder_path else "Customer Orders/Sales Orders"
                    
                    # Find the folder by path
                    folder_id = google_drive_service.find_folder_by_path(sales_csr_drive_id, full_path)
                    if not folder_id:
                        # Try alternative path (maybe folder_path is already the full path)
                        folder_id = google_drive_service.find_folder_by_path(sales_csr_drive_id, folder_path)
                    
                    if folder_id:
                        print(f"[OK] Found folder in Google Drive: {full_path} (ID: {folder_id})")
                        
                        # Get folder contents
                        folders = []
                        files = []
                        
                        # Get subfolders
                        query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
                        list_params = {
                            'q': query,
                            'corpora': 'drive',
                            'driveId': sales_csr_drive_id,
                            'includeItemsFromAllDrives': True,
                            'supportsAllDrives': True,
                            'fields': "files(id, name)",
                            'pageSize': 100
                        }
                        results = google_drive_service.service.files().list(**list_params).execute()
                        subfolders = results.get('files', [])
                        
                        for subfolder in subfolders:
                            subfolder_id = subfolder['id']
                            subfolder_name = subfolder['name']
                            
                            # Count files in subfolder RECURSIVELY (like local version)
                            # Use _scan_folder_recursively to get all files
                            try:
                                files_by_folder = google_drive_service._scan_folder_recursively(
                                    subfolder_id, subfolder_name, sales_csr_drive_id, 
                                    depth=0, max_depth=3, start_time=None, max_scan_time=10
                                )
                                # Count all files across all subfolders
                                file_count = sum(len(files) for files in files_by_folder.values())
                            except Exception as e:
                                print(f"[WARN] Error counting files recursively for {subfolder_name}: {e}")
                                # Fallback to immediate files only
                                file_query = f"'{subfolder_id}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or name contains '.pdf' or name contains '.docx') and trashed=false"
                                file_results = google_drive_service.service.files().list(
                                    q=file_query,
                                    corpora='drive',
                                    driveId=sales_csr_drive_id,
                                    includeItemsFromAllDrives=True,
                                    supportsAllDrives=True,
                                    fields="files(id, name)",
                                    pageSize=100
                                ).execute()
                                file_count = len(file_results.get('files', []))
                            
                            # Count subfolders
                            folder_query = f"'{subfolder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
                            folder_results = google_drive_service.service.files().list(
                                q=folder_query,
                                corpora='drive',
                                driveId=sales_csr_drive_id,
                                includeItemsFromAllDrives=True,
                                supportsAllDrives=True,
                                fields="files(id, name)",
                                pageSize=100
                            ).execute()
                            folder_count = len(folder_results.get('files', []))
                            
                            folders.append({
                                'name': subfolder_name,
                                'type': 'folder',
                                'file_count': file_count,
                                'folder_count': folder_count,
                                'path': f"{folder_path}/{subfolder_name}" if folder_path else subfolder_name
                            })
                        
                        # Get files in current folder
                        file_query = f"'{folder_id}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or name contains '.pdf' or name contains '.docx') and trashed=false"
                        file_results = google_drive_service.service.files().list(
                            q=file_query,
                            corpora='drive',
                            driveId=sales_csr_drive_id,
                            includeItemsFromAllDrives=True,
                            supportsAllDrives=True,
                            fields="files(id, name, size, modifiedTime, mimeType)",
                            pageSize=100
                        ).execute()
                        drive_files = file_results.get('files', [])
                        
                        for drive_file in drive_files:
                            file_name = drive_file['name']
                            file_size = int(drive_file.get('size', 0))
                            modified_time = drive_file.get('modifiedTime', '')
                            file_id = drive_file['id']
                            
                            # Format modified time
                            if modified_time:
                                try:
                                    from dateutil import parser
                                    dt = parser.parse(modified_time)
                                    modified = dt.strftime('%Y-%m-%d %H:%M')
                                except:
                                    modified = modified_time[:16].replace('T', ' ')
                            else:
                                modified = 'Unknown'
                            
                            files.append({
                                'name': file_name,
                                'type': 'file',
                                'size': file_size,
                                'modified': modified,
                                'path': f"gdrive://{file_id}",  # Use Google Drive file ID
                                'file_id': file_id,
                                'is_pdf': file_name.lower().endswith('.pdf') or 'pdf' in drive_file.get('mimeType', '').lower(),
                                'is_excel': file_name.lower().endswith(('.xlsx', '.xls'))
                            })
                        
                        # Sort folders and files
                        folders.sort(key=lambda x: x['name'])
                        files.sort(key=lambda x: x['name'])
                        
                        print(f"[OK] Loaded {len(folders)} folders and {len(files)} files from Google Drive: {folder_path}")
                        
                        # Cache the result
                        folder_data = {
                            'path': folder_path,
                            'full_path': full_path,
                            'folders': folders,
                            'files': files,
                            'total_folders': len(folders),
                            'total_files': len(files),
                            'source': 'Google Drive API'
                        }
                        _so_folder_cache[folder_path] = folder_data
                        _so_folder_cache_timestamps[folder_path] = time.time()
                        print(f"[OK] Cached folder data for: {folder_path}")
                        
                        return jsonify({
                            **folder_data,
                            'cached': False
                        })
                    else:
                        print(f"[WARN] Folder not found in Google Drive: {full_path}, falling back to local")
            except Exception as e:
                print(f"[ERROR] Google Drive API error: {e}")
                import traceback
                traceback.print_exc()
                print("[WARN] Falling back to local G: Drive")
        
        # Fallback to local G: Drive (for local development)
        full_path = os.path.join(SALES_ORDERS_BASE, folder_path)
        
        if not os.path.exists(full_path):
            return jsonify({"error": f"Folder not found: {folder_path}"}), 404
        
        # Get folder contents
        items = os.listdir(full_path)
        folders = []
        files = []
        
        for item in items:
            item_path = os.path.join(full_path, item)
            if os.path.isdir(item_path) and item != 'desktop.ini':
                # Count files in subfolder
                try:
                    subfolder_items = os.listdir(item_path)
                    file_count = len([f for f in subfolder_items if os.path.isfile(os.path.join(item_path, f))])
                    folder_count = len([f for f in subfolder_items if os.path.isdir(os.path.join(item_path, f))])
                    
                    folders.append({
                        'name': item,
                        'type': 'folder',
                        'file_count': file_count,
                        'folder_count': folder_count,
                        'path': os.path.join(folder_path, item).replace('\\', '/')
                    })
                except:
                    folders.append({
                        'name': item,
                        'type': 'folder',
                        'file_count': 0,
                        'folder_count': 0,
                        'path': os.path.join(folder_path, item).replace('\\', '/')
                    })
                    
            elif os.path.isfile(item_path) and not item.startswith('.'):
                # Get file info
                try:
                    stat = os.stat(item_path)
                    size = stat.st_size
                    modified = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M')
                    
                    files.append({
                        'name': item,
                        'type': 'file',
                        'size': size,
                        'modified': modified,
                        'path': item_path,
                        'is_pdf': item.lower().endswith('.pdf'),
                        'is_excel': item.lower().endswith(('.xlsx', '.xls'))
                    })
                except:
                    files.append({
                        'name': item,
                        'type': 'file',
                        'size': 0,
                        'modified': 'Unknown',
                        'path': item_path,
                        'is_pdf': item.lower().endswith('.pdf'),
                        'is_excel': item.lower().endswith(('.xlsx', '.xls'))
                    })
        
        # Sort folders and files
        folders.sort(key=lambda x: x['name'])
        files.sort(key=lambda x: x['name'])
        
        print(f"[OK] Loaded {len(folders)} folders and {len(files)} files from local G: Drive: {folder_path}")
        
        # Cache the result
        folder_data = {
            'path': folder_path,
            'full_path': full_path,
            'folders': folders,
            'files': files,
            'total_folders': len(folders),
            'total_files': len(files),
            'source': 'Local G: Drive'
        }
        _so_folder_cache[folder_path] = folder_data
        _so_folder_cache_timestamps[folder_path] = time.time()
        print(f"[OK] Cached folder data for: {folder_path}")
        
        return jsonify({
            **folder_data,
            'cached': False
        })
        
    except Exception as e:
        print(f"[ERROR] Error loading folder {folder_path}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales-orders/find/<so_number>', methods=['GET'])
def find_sales_order_file(so_number):
    """Find a specific Sales Order file by SO number"""
    try:
        print(f"SEARCH: Searching for SO file: {so_number}")
        
        # Use the actual Sales Orders path from G: Drive
        base_path = SALES_ORDERS_BASE
        
        if not os.path.exists(base_path):
            return jsonify({"found": False, "error": "Sales Orders folder not found"}), 404
        
        # Search through all subfolders for the SO file - PRIORITIZE LATEST VERSION
        matching_files = []
        
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if file.lower().endswith('.pdf'):
                    # Check if SO number is in filename
                    if so_number in file or f"SO_{so_number}" in file or f"SO{so_number}" in file:
                        file_path = os.path.join(root, file)
                        matching_files.append(file_path)
                        print(f"📄 Found SO PDF: {file_path}")
        
        # Sort files to prioritize latest revision (R999 > R3 > R2 > R1 > original)
        if matching_files:
            def get_version_priority(filepath):
                filename = os.path.basename(filepath).lower()
                # Extract revision number from filename - handles any revision number
                import re
                rev_match = re.search(r'_r(\d+)', filename)
                if rev_match:
                    rev_num = int(rev_match.group(1))
                    return 1000 + rev_num  # R999=1999, R3=1003, R2=1002, R1=1001
                else:
                    return 1  # Original version (lowest priority)
            
            matching_files.sort(key=get_version_priority, reverse=True)
            so_file_path = matching_files[0]
            selected_file = os.path.basename(so_file_path)
            print(f"SUCCESS: Selected latest version: {selected_file}")
            
            # Verify it's actually the latest
            if len(matching_files) > 1:
                print(f"📋 Available versions: {[os.path.basename(f) for f in matching_files[:3]]}")
            
            return jsonify({
                "found": True,
                "filePath": so_file_path,
                "fileName": selected_file,
                "folder": os.path.basename(os.path.dirname(so_file_path))
            })
        
        print(f"ERROR: SO file not found: {so_number}")
        return jsonify({"found": False, "error": f"SO {so_number} file not found"}), 404
        
    except Exception as e:
        print(f"ERROR: Error searching for SO file {so_number}: {e}")
        return jsonify({"found": False, "error": str(e)}), 500

@app.route('/api/sales-orders/parse/<so_number>', methods=['GET'])
def parse_sales_order_on_demand(so_number):
    """Parse a specific Sales Order PDF on-demand (when user clicks it)"""
    try:
        print(f"📄 PARSE ON-DEMAND: SO {so_number}")
        
        # Check if already cached
        cache_path = os.path.join(os.path.dirname(__file__), 'cache', 'ParsedSOsOnDemand.json')
        parsed_cache = {}
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    parsed_cache = json.load(f)
                if so_number in parsed_cache:
                    print(f"   ✓ Cache hit for SO {so_number}")
                    return jsonify(parsed_cache[so_number])
            except:
                parsed_cache = {}
        
        # Find the SO file
        base_path = SALES_ORDERS_BASE
        if not os.path.exists(base_path):
            return jsonify({"error": "Sales Orders folder not accessible"}), 500
        
        # Find SO file
        so_file_path = None
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if file.lower().endswith('.pdf') and so_number in file.lower():
                    so_file_path = os.path.join(root, file)
                    break
            if so_file_path:
                break
        
        if not so_file_path:
            return jsonify({"error": f"SO {so_number} not found"}), 404
        
        print(f"   Parsing: {os.path.basename(so_file_path)}")
        
        # Parse the PDF
        parsed_data = extract_so_data_from_pdf(so_file_path)
        
        if not parsed_data:
            return jsonify({"error": "Failed to parse SO"}), 500
        
        # Add metadata
        parsed_data['so_number'] = so_number
        parsed_data['file_path'] = so_file_path
        parsed_data['parsed_at'] = datetime.now().isoformat()
        
        # Cache it
        parsed_cache[so_number] = parsed_data
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        safe_json_write(cache_path, parsed_cache)
        
        print(f"   ✓ Parsed and cached SO {so_number}")
        return jsonify(parsed_data)
        
    except Exception as e:
        print(f"❌ Error parsing SO {so_number}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/check-changes', methods=['GET'])
def check_changes():
    """Check for real-time changes in G: Drive folders"""
    try:
        current_time = time.time()
        changes_detected = []
        
        # Check MISys data folder
        if os.path.exists(GDRIVE_BASE):
            for filename in os.listdir(GDRIVE_BASE):
                if filename.endswith('.json'):
                    file_path = os.path.join(GDRIVE_BASE, filename)
                    file_stat = os.stat(file_path)
                    
                    # Check if file was modified since last check
                    if not hasattr(check_changes, 'last_check_time'):
                        check_changes.last_check_time = {}
                    
                    if filename not in check_changes.last_check_time:
                        check_changes.last_check_time[filename] = file_stat.st_mtime
                    elif check_changes.last_check_time[filename] < file_stat.st_mtime:
                        changes_detected.append({
                            'type': 'file_modified',
                            'file': filename,
                            'path': GDRIVE_BASE
                        })
                        check_changes.last_check_time[filename] = file_stat.st_mtime
        
        # Check Sales Orders folder
        if os.path.exists(SALES_ORDERS_BASE):
            for status_folder in os.listdir(SALES_ORDERS_BASE):
                status_path = os.path.join(SALES_ORDERS_BASE, status_folder)
                if os.path.isdir(status_path):
                    # Check for new files or modifications
                    for root, dirs, files in os.walk(status_path):
                        for file in files:
                            if file.endswith('.pdf'):
                                file_path = os.path.join(root, file)
                                file_stat = os.stat(file_path)
                                
                                file_key = f"{status_folder}_{file}"
                                if not hasattr(check_changes, 'sales_last_check_time'):
                                    check_changes.sales_last_check_time = {}
                                
                                if file_key not in check_changes.sales_last_check_time:
                                    check_changes.sales_last_check_time[file_key] = file_stat.st_mtime
                                elif check_changes.sales_last_check_time[file_key] < file_stat.st_mtime:
                                    changes_detected.append({
                                        'type': 'sales_order_modified',
                                        'file': file,
                                        'file_path': file_path,
                                        'status': status_folder
                                    })
                                    check_changes.sales_last_check_time[file_key] = file_stat.st_mtime
        
        return jsonify({
            'hasChanges': len(changes_detected) > 0,
            'changes': changes_detected,
            'changeType': 'File modifications detected' if changes_detected else 'No changes',
            'folderPath': GDRIVE_BASE if changes_detected else '',
            'timestamp': current_time
        })
        
    except Exception as e:
        print(f"ERROR: Error checking for changes: {e}")
        return jsonify({"error": str(e)}), 500

def analyze_inventory_data(data, query):
    """Analyze inventory data to answer user queries - COMPREHENSIVE DATA ACCESS"""
    try:
        # Extract ALL relevant data structures from ALL sources
        customalert5_items = data.get('CustomAlert5.json', [])
        items = data.get('Items.json', [])
        miitem = data.get('MIITEM.json', [])
        miiloc = data.get('MIILOC.json', [])  # Inventory location data
        
        bom_headers = data.get('BillsOfMaterial.json', [])
        bom_details = data.get('BillOfMaterialDetails.json', [])
        mibomh = data.get('MIBOMH.json', [])
        mibomd = data.get('MIBOMD.json', [])
        
        mo_headers = data.get('ManufacturingOrderHeaders.json', [])
        mo_details = data.get('ManufacturingOrderDetails.json', [])
        mo_routings = data.get('ManufacturingOrderRoutings.json', [])
        mimoh = data.get('MIMOH.json', [])
        mimomd = data.get('MIMOMD.json', [])
        mimord = data.get('MIMORD.json', [])
        
        po_headers = data.get('PurchaseOrders.json', [])
        po_details = data.get('PurchaseOrderDetails.json', [])
        po_extensions = data.get('PurchaseOrderExtensions.json', [])
        mipoh = data.get('MIPOH.json', [])
        mipod = data.get('MIPOD.json', [])
        mipohx = data.get('MIPOHX.json', [])
        mipoc = data.get('MIPOC.json', [])
        mipocv = data.get('MIPOCV.json', [])
        mipodc = data.get('MIPODC.json', [])
        
        so_headers = data.get('SalesOrderHeaders.json', [])
        so_details = data.get('SalesOrderDetails.json', [])
        sales_orders = data.get('SalesOrders.json', [])
        parsed_sos = data.get('ParsedSalesOrders.json', [])
        
        jobs = data.get('Jobs.json', [])
        job_details = data.get('JobDetails.json', [])
        mijobh = data.get('MIJOBH.json', [])
        mijobd = data.get('MIJOBD.json', [])
        
        wo_headers = data.get('WorkOrderHeaders.json', [])
        wo_details = data.get('WorkOrderDetails.json', [])
        miwoh = data.get('MIWOH.json', [])
        miwod = data.get('MIWOD.json', [])
        
        mps_data = data.get('MPS.json', {})
        mps_orders = mps_data.get('mps_orders', []) if isinstance(mps_data, dict) else []
        
        # Create a comprehensive data summary for ChatGPT
        data_summary = {
            "total_items": len(customalert5_items),
            "items_with_stock": len([item for item in customalert5_items if safe_float(item.get("Stock", 0)) > 0]),
            "total_boms": len(bom_headers),
            "active_manufacturing_orders": len([mo for mo in mo_headers if mo.get("Status", 0) in [1, 2]]),
            "active_purchase_orders": len([po for po in po_headers if po.get("Status", 0) == 1]),
            "total_sales_orders": len(so_headers) + len(sales_orders) + len(parsed_sos),
            "total_jobs": len(jobs),
            "total_work_orders": len(wo_headers),
            "mps_orders": len(mps_orders),
            "inventory_locations": len(miiloc),
        }
        
        # Sample some data for context
        sample_items = customalert5_items[:3] if customalert5_items else []
        sample_boms = bom_headers[:3] if bom_headers else []
        sample_mos = mo_headers[:3] if mo_headers else []
        sample_sos = (so_headers[:2] if so_headers else []) + (parsed_sos[:2] if parsed_sos else [])
        
        return {
            "data_summary": data_summary,
            "sample_items": sample_items,
            "sample_boms": sample_boms,
            "sample_mos": sample_mos,
            "sample_sos": sample_sos,
            "available_data_files": list(data.keys())
        }
    except Exception as e:
        print(f"ERROR: Error analyzing inventory data: {e}")
        return {"error": str(e)}

def find_item_usage_and_availability(data, item_description_or_no, quantity_needed=None):
    """Find detailed information about item usage and availability"""
    try:
        # Use ONLY CustomAlert5.json for item data - it has everything
        customalert5_items = data.get('CustomAlert5.json', [])
        bom_details = data.get('BillOfMaterialDetails.json', [])
        mo_headers = data.get('ManufacturingOrderHeaders.json', [])
        mo_details = data.get('ManufacturingOrderDetails.json', [])
        
        # Find the item - CustomAlert5 has all item info AND stock info
        target_item = None
        for item in customalert5_items:
            if (item_description_or_no.lower() in (item.get("Description", "").lower()) or 
                item_description_or_no.upper() == item.get("Item No.", "").upper()):
                target_item = item
                break
        
        if not target_item:
            return {"error": f"Item '{item_description_or_no}' not found"}
        
        item_no = target_item.get("Item No.", "")
        
        # Stock information is ALREADY in CustomAlert5 - no need for separate lookup
        stock_info = target_item  # CustomAlert5 has all stock fields: Stock, WIP, Reserve, On Order
        
        # Find where this item is used in BOMs
        used_in_boms = []
        for bom_detail in bom_details:
            if bom_detail.get("Component Item No.") == item_no:
                used_in_boms.append({
                    "parent_item": bom_detail.get("Parent Item No."),
                    "quantity_per": bom_detail.get("Quantity Per", 0),
                    "scrap_factor": bom_detail.get("Scrap Factor", 0)
                })
        
        # Find active manufacturing orders using this item
        active_usage = []
        for mo in mo_headers:
            if mo.get("Status", 0) in [1, 2]:  # Released or WIP
                # Check if this MO uses our item
                mo_no = mo.get("Mfg. Order No.", "")
                for mo_detail in mo_details:
                    if (mo_detail.get("Mfg. Order No.") == mo_no and 
                        mo_detail.get("Item No.") == item_no):
                        active_usage.append({
                            "mo_number": mo_no,
                            "build_item": mo.get("Build Item No."),
                            "quantity_needed": mo_detail.get("Quantity", 0),
                            "status": mo.get("Status"),
                            "due_date": mo.get("Due Date")
                        })
        
        # Calculate current stock and availability
        current_stock = 0
        if stock_info:
            current_stock = safe_float(stock_info.get("Quantity on Hand", 0))
        elif target_item:
            current_stock = safe_float(target_item.get("Quantity on Hand", 0))
        
        # Calculate allocated quantity
        allocated_qty = sum([usage.get("quantity_needed", 0) for usage in active_usage])
        available_qty = current_stock - allocated_qty
        
        result = {
            "item": target_item,
            "current_stock": current_stock,
            "allocated_quantity": allocated_qty,
            "available_quantity": available_qty,
            "used_in_boms": used_in_boms,
            "active_usage": active_usage,
            "stock_info": stock_info
        }
        
        # If quantity needed is specified, check if we have enough
        if quantity_needed:
            result["quantity_requested"] = quantity_needed
            result["sufficient_stock"] = available_qty >= quantity_needed
            result["shortfall"] = max(0, quantity_needed - available_qty)
        
        return result
        
    except Exception as e:
        print(f"ERROR: Error finding item usage: {e}")
        return {"error": str(e)}

@app.route('/api/chat', methods=['POST'])
def chat_query():
    """Handle ChatGPT queries about inventory data with smart SO search"""
    try:
        data = request.get_json()
        user_query = data.get('query', '')
        date_context = data.get('dateContext', {})
        frontend_data_sources = data.get('dataSources', {})  # Data sources summary from frontend
        
        # 🧠 SMART SALES ORDER DETECTION AND SEARCH
        import re
        
        # Only do smart search if OpenAI is available
        if not openai_available:
            print("⚠️ OpenAI not available, skipping smart SO search")
        
        # Check if this is a Sales Order query
        so_patterns = [
            r'sales?\s*order\s*#?\s*\d+',
            r'so\s*#?\s*\d+',
            r'order\s*#?\s*\d+',
            r'salesorder[_\s]*\d+'
        ]
        
        is_so_query = any(re.search(pattern, user_query.lower()) for pattern in so_patterns)
        
        if is_so_query and openai_available and client:
            print(f"🧠 Detected Sales Order query - using smart search")
            from smart_so_search import get_smart_search
            smart_search = get_smart_search(client)
            smart_result = smart_search.smart_so_search(user_query)
            
            if smart_result['success']:
                # Found the SO! Use this data for the AI response
                print(f"SUCCESS: Smart search found SO {smart_result['so_number']}")
                
                # Create a focused response using the found data
                so_data = smart_result['extracted_data'][0]  # Use first match
                
                focused_response = f"""**SALES ORDER #{smart_result['so_number']} FOUND!**

**📋 ORDER DETAILS:**
- **SO Number:** {so_data.get('so_number', 'N/A')}
- **Customer:** {so_data.get('customer_name', 'N/A')}
- **Order Date:** {so_data.get('order_date', 'N/A')}
- **Due Date:** {so_data.get('due_date', 'N/A')}
- **Total Amount:** ${so_data.get('total_amount', 0):,.2f}
- **Status:** {so_data.get('folder_status', so_data.get('status', 'N/A'))}
- **Items:** {len(so_data.get('items', []))} items

**📦 ITEMS:**"""
                
                for i, item in enumerate(so_data.get('items', [])[:5], 1):
                    focused_response += f"\n{i}. {item.get('description', 'N/A')} - Qty: {item.get('quantity', 'N/A')}"
                
                if len(so_data.get('items', [])) > 5:
                    focused_response += f"\n... and {len(so_data.get('items', [])) - 5} more items"
                
                focused_response += f"\n\n**📁 File Location:** {so_data.get('folder_status', 'N/A')} folder"
                focused_response += f"\n**📄 Source:** {os.path.basename(so_data.get('file_path', 'N/A'))}"
                
                return jsonify({
                    "query": user_query,
                    "response": focused_response,
                    "smart_search_used": True,
                    "so_number": smart_result['so_number'],
                    "data_context": {
                        "folder": "Smart SO Search",
                        "total_items": len(so_data.get('items', [])),
                        "so_total": so_data.get('total_amount', 0)
                    }
                })
            else:
                # Smart search failed, continue with normal processing but mention the search attempt
                print(f"ERROR: Smart search failed: {smart_result.get('error', 'Unknown error')}")
                user_query += f" [Smart search attempted but no files found for the requested SO number]"
        
        if not user_query:
            return jsonify({"error": "No query provided"}), 400
        
        print(f"🤖 Processing ChatGPT query: {user_query}")
        
        # Check if OpenAI is available
        if not openai_available:
            return jsonify({
                "query": user_query,
                "response": "OpenAI library is not properly installed. Please install it with: pip install openai",
                "data_context": {
                    "folder": "OpenAI Required",
                    "total_items": 0,
                    "active_orders": 0
                }
            })
        
        # OPTIMIZATION: Use cached data first (same as /api/data endpoint)
        global _data_cache, _cache_timestamp
        raw_data = {}
        
        # Check if we have valid cached data
        if _data_cache and _cache_timestamp:
            cache_age = time.time() - _cache_timestamp
            has_data = any(v and len(v) > 0 if isinstance(v, list) else v for v in _data_cache.values())
            
            if cache_age < _cache_duration and has_data:
                print(f"✅ Using cached data for AI chat (age: {cache_age:.1f}s)")
                raw_data = _data_cache.copy()  # Use cached data
            else:
                print(f"⚠️ Cache expired or empty (age: {cache_age:.1f}s), loading fresh data...")
                raw_data = {}
        
        # If no cached data, load fresh from G: Drive (same logic as /api/data)
        if not raw_data:
            print("📂 Loading fresh data for AI chat...")
            latest_folder, error = get_latest_folder()
            if error:
                return jsonify({"error": f"Cannot access data: {error}"}), 500
            
            folder_path = os.path.join(GDRIVE_BASE, latest_folder)
            
            # Load essential files first (same as /api/data)
            essential_files = [
                "CustomAlert5.json",  # PRIMARY: Complete item data
                "MIILOC.json",        # Inventory location data
                "SalesOrderHeaders.json",  # Sales orders
                "SalesOrderDetails.json",  # Sales order details
                "ManufacturingOrderHeaders.json",  # Manufacturing orders
                "ManufacturingOrderDetails.json",  # Manufacturing order details
                "BillsOfMaterial.json",  # BOM data
                "BillOfMaterialDetails.json",  # BOM details
                "PurchaseOrders.json",  # Purchase orders
                "PurchaseOrderDetails.json"  # Purchase order details
            ]
            
            for file_name in essential_files:
                file_path = os.path.join(folder_path, file_name)
                if os.path.exists(file_path):
                    print(f"📊 Loading {file_name}...")
                    file_data = load_json_file(file_path)
                    raw_data[file_name] = file_data
                else:
                    raw_data[file_name] = []
            
            # Load other expected files
            other_files = [
                'Items.json', 'MIITEM.json', 'MIBOMH.json', 'MIBOMD.json',
                'ManufacturingOrderRoutings.json', 'MIMOH.json', 'MIMOMD.json', 'MIMORD.json',
                'Jobs.json', 'JobDetails.json', 'MIJOBH.json', 'MIJOBD.json',
                'MIPOH.json', 'MIPOD.json', 'MIPOHX.json', 'MIPOC.json', 'MIPOCV.json',
                'MIPODC.json', 'MIWOH.json', 'MIWOD.json', 'MIBORD.json',
                'PurchaseOrderExtensions.json', 'WorkOrderHeaders.json', 'WorkOrderDetails.json',
                'PurchaseOrderAdditionalCosts.json', 'PurchaseOrderAdditionalCostsTaxes.json',
                'PurchaseOrderDetailAdditionalCosts.json'
            ]
            
            for file_name in other_files:
                file_path = os.path.join(folder_path, file_name)
                if os.path.exists(file_path):
                    file_data = load_json_file(file_path)
                    raw_data[file_name] = file_data
                else:
                    raw_data[file_name] = []
        
        # CRITICAL: Load Sales Orders data from separate G: Drive location (if not in cache)
        # ONLY load active folders (In Production, New and Revised) - NO Cancelled/Closed
        if 'SalesOrders.json' not in raw_data or not raw_data.get('SalesOrders.json'):
            print("📋 Loading Sales Orders for AI chat (active folders only)...")
            so_filter_folders = ['In Production', 'New and Revised']
            sales_orders_data = load_sales_orders(filter_folders=so_filter_folders)
            if sales_orders_data:
                raw_data.update(sales_orders_data)
                total_so_count = sales_orders_data.get('TotalOrders', 0)
                print(f"✅ AI chat now has access to {total_so_count} real Sales Orders (active only)")
            else:
                print("⚠️ No Sales Orders data available")
        
        # Load cached parsed SO data (if not in cache)
        if 'ParsedSalesOrders.json' not in raw_data or not raw_data.get('ParsedSalesOrders.json'):
            print("📋 Loading cached parsed SO data...")
            cached_so_data = load_cached_so_data()
            if cached_so_data:
                raw_data.update(cached_so_data)
                print(f"✅ Added {len(cached_so_data.get('ParsedSalesOrders.json', []))} parsed SOs")
        
        # Load MPS (Master Production Schedule) data (if not in cache)
        if 'MPS.json' not in raw_data or not raw_data.get('MPS.json'):
            print("📋 Loading MPS data...")
            mps_data = load_mps_data()
            if mps_data and 'error' not in mps_data:
                raw_data['MPS.json'] = mps_data
                print(f"✅ Added MPS data with {len(mps_data.get('mps_orders', []))} production orders")
            else:
                raw_data['MPS.json'] = {"mps_orders": [], "summary": {"total_orders": 0}}
        
        # Enterprise SO Service integration (if not in cache)
        if 'SOServiceHealth' not in raw_data:
            try:
                from enterprise_so_service import get_so_service_health
                so_health = get_so_service_health()
                raw_data['SOServiceHealth'] = so_health
                print(f"✅ SO Service Health: {so_health['status']} - {so_health['total_sos']} SOs cached")
            except Exception as e:
                print(f"⚠️ Enterprise SO Service not available: {e}")
        
        print(f"✅ AI chat has access to {len([k for k, v in raw_data.items() if v])} data sources")
        
        # Analyze the data for ChatGPT context
        analysis = analyze_inventory_data(raw_data, user_query)
        
        # Check if analysis was successful
        if 'error' in analysis:
            print(f"ERROR: Analysis error: {analysis['error']}")
            return jsonify({"error": f"Data analysis failed: {analysis['error']}"}), 500
        
        # Build data sources context from frontend and backend
        data_sources_context = ""
        if frontend_data_sources:
            data_sources_context = "\n**FRONTEND DATA SOURCES AVAILABLE:**\n"
            if frontend_data_sources.get('inventory', {}).get('available'):
                data_sources_context += f"- Inventory: {frontend_data_sources['inventory']['count']} items from {', '.join(frontend_data_sources['inventory']['sources'])}\n"
            if frontend_data_sources.get('salesOrders', {}).get('available'):
                data_sources_context += f"- Sales Orders: {frontend_data_sources['salesOrders']['count']} orders from {', '.join(frontend_data_sources['salesOrders']['sources'])}\n"
            if frontend_data_sources.get('manufacturingOrders', {}).get('available'):
                data_sources_context += f"- Manufacturing Orders: {frontend_data_sources['manufacturingOrders']['count']} orders from {', '.join(frontend_data_sources['manufacturingOrders']['sources'])}\n"
            if frontend_data_sources.get('purchaseOrders', {}).get('available'):
                data_sources_context += f"- Purchase Orders: {frontend_data_sources['purchaseOrders']['count']} orders from {', '.join(frontend_data_sources['purchaseOrders']['sources'])}\n"
            if frontend_data_sources.get('boms', {}).get('available'):
                data_sources_context += f"- Bills of Material: {frontend_data_sources['boms']['count']} BOMs from {', '.join(frontend_data_sources['boms']['sources'])}\n"
            if frontend_data_sources.get('jobs', {}).get('available'):
                data_sources_context += f"- Jobs: {frontend_data_sources['jobs']['count']} jobs from {', '.join(frontend_data_sources['jobs']['sources'])}\n"
            if frontend_data_sources.get('workOrders', {}).get('available'):
                data_sources_context += f"- Work Orders: {frontend_data_sources['workOrders']['count']} work orders from {', '.join(frontend_data_sources['workOrders']['sources'])}\n"
            if frontend_data_sources.get('mps', {}).get('available'):
                data_sources_context += f"- Master Production Schedule: {frontend_data_sources['mps']['count']} production orders from {', '.join(frontend_data_sources['mps']['sources'])}\n"
            if frontend_data_sources.get('allAvailableFiles'):
                data_sources_context += f"- Total Data Files Available: {len(frontend_data_sources['allAvailableFiles'])} files\n"
        
        # Create system prompt with data context
        system_prompt = f"""You are a friendly, conversational AI assistant for Canoil Canada Ltd with complete access to all ERP data.

**COMMUNICATION STYLE:**
- Write naturally and conversationally like ChatGPT - NO formal report structures
- NO heading formats like "SUMMARY:", "KEY METRICS:", "SALES PERFORMANCE ANALYSIS", etc.
- Just chat naturally, like you're talking to a colleague
- Use bullet points for lists, but keep the tone casual and helpful
- Be specific with numbers and data, but present it naturally in sentences

{data_sources_context}

**YOUR CAPABILITIES:**
You have complete access to all business data and can help with:

**COMPLETE INVENTORY MASTERY:**
- Any stock question, any item, any quantity, any scenario
- Cross-reference everything: items, locations, suppliers, costs, alternatives
- Understand partial names, codes, descriptions - be intelligent about matching
- Calculate complex requirements, availability, and feasibility instantly
- Real-time inventory analysis from CustomAlert5.json with {analysis['data_summary']['total_items']} items

**TOTAL SALES ORDER (SO) EXPERTISE:**
- Analyze any SO by number, customer, item, or scenario
- "Can we fulfill SO 2296?" "What stock is needed for SO 1234?" 
- Complex SO feasibility: "Customer wants 500 units by Tuesday - possible?"
- Hidden commitments analysis, SO without MO detection
- Revenue impact, profitability analysis, customer prioritization
- Access to both PDF-scanned SOs and structured SO data from multiple sources

**COMPREHENSIVE MANUFACTURING ORDER (MO) ANALYSIS:**
- Complete MO tracking from ManufacturingOrderHeaders.json and ManufacturingOrderDetails.json
- Production scheduling, capacity planning, and resource allocation
- WIP analysis, completion forecasting, and efficiency metrics
- Cross-MO dependencies and critical path analysis
- Real-time production status with {analysis['data_summary']['active_manufacturing_orders']} active MOs

**COMPLETE PURCHASE ORDER (PO) INTELLIGENCE:**
- Full PO analysis from PurchaseOrders.json, PurchaseOrderDetails.json
- Supplier performance tracking and procurement insights
- Cost analysis, delivery tracking, and vendor management
- Purchase planning and budget analysis
- Access to {analysis['data_summary']['active_purchase_orders']} active POs

**ADVANCED SALES ORDER (ASO) DATA ACCESS:**
- Multi-source SO data: SalesOrderHeaders.json, SalesOrderDetails.json
- Real-time SO scanning from PDF documents
- Customer order patterns and sales trends analysis
- Order fulfillment optimization and delivery planning

📋 SALES ORDER INFORMATION:
When discussing sales orders, naturally include the SO number, customer, order date, status, total value, items ordered (with descriptions, quantities, prices), delivery requirements, stock availability, and any recommendations. Present this conversationally, not as a formal structured report.

Use this format for ANY SO query - whether asking about specific SO numbers, customer orders, or general SO analysis.

**COMPLETE MANUFACTURING ORDER (MO) INTELLIGENCE:**
- Any MO analysis, status, requirements, capacity planning
- Production bottlenecks, resource allocation, scheduling optimization
- WIP analysis, completion forecasting, efficiency metrics
- Cross-MO dependencies and critical path analysis

**UNLIMITED BOM & COMPONENT ANALYSIS:**
- Multi-level BOM explosions, cost rollups, margin analysis from BillsOfMaterial.json and BillOfMaterialDetails.json
- Component substitutions, supplier alternatives, risk assessment
- "What if" scenarios: supply disruptions, cost changes, design modifications
- Lead time optimization, procurement strategies
- Access to {analysis['data_summary']['total_boms']} BOMs with complete component relationships
- Cross-reference with MIBOMH.json and MIBOMD.json for detailed BOM structures

**BUSINESS INTELLIGENCE WITHOUT LIMITS:**
- Strategic planning: "How much can we produce this quarter?"
- Risk analysis: "What happens if our main supplier fails?"
- Cost optimization: "Cheapest way to fulfill this large order?"
- Capacity planning: "Can we handle 50% more orders next month?"
- Financial analysis: "What's our inventory value by category?"
- Operational efficiency: "Where are our biggest bottlenecks?"

**COMPREHENSIVE REPORTS & TRENDS ANALYSIS:**
- Sales trends analysis across all time periods with real customer data
- Inventory turnover reports and stock optimization recommendations
- Production efficiency metrics and manufacturing performance trends
- Supplier performance analysis and procurement optimization
- Customer behavior patterns and order frequency analysis
- Revenue forecasting based on historical sales data and current pipeline
- Cost analysis reports across all product lines and categories
- Capacity utilization reports and resource allocation optimization
- Quality metrics and defect analysis across production runs
- Seasonal demand patterns and inventory planning recommendations

**CONVERSATIONAL & HELPFUL:**
- Natural conversation for greetings and casual questions
- Deep business insights for operational questions
- Proactive suggestions and recommendations
- No question too complex, no analysis too detailed

📊 COMPLETE DATA ACCESS - YOU HAVE EVERYTHING:
You have FULL ACCESS to ALL business data including:

**INVENTORY & ITEMS:**
- {analysis['data_summary']['total_items']} inventory items with complete details (CustomAlert5.json, Items.json, MIITEM.json)
- Stock levels, costs, locations, and availability (MIILOC.json)
- Item descriptions, part numbers, and specifications

**BILLS OF MATERIAL (BOM):**
- {analysis['data_summary']['total_boms']} BOMs with full component relationships (BillsOfMaterial.json, BillOfMaterialDetails.json)
- Detailed BOM structures and quantities (MIBOMH.json, MIBOMD.json)
- Multi-level component explosions and cost rollups

**MANUFACTURING ORDERS (MO):**
- {analysis['data_summary']['active_manufacturing_orders']} manufacturing orders with status and schedules (ManufacturingOrderHeaders.json, ManufacturingOrderDetails.json)
- Production routings and work center data (ManufacturingOrderRoutings.json)
- MO details and routing information (MIMOH.json, MIMOMD.json, MIMORD.json)

**PURCHASE ORDERS (PO):**
- {analysis['data_summary']['active_purchase_orders']} purchase orders with suppliers and delivery dates (PurchaseOrders.json, PurchaseOrderDetails.json)
- PO extensions and additional costs (PurchaseOrderExtensions.json, PurchaseOrderAdditionalCosts.json)
- Detailed PO information (MIPOH.json, MIPOD.json, MIPOHX.json, MIPOC.json, MIPOCV.json, MIPODC.json)

**SALES ORDERS (SO/ASO):**
- {analysis['data_summary'].get('total_sales_orders', 0)} Sales Orders with complete customer details, quantities, and status
- Multiple SO data sources: SalesOrderHeaders.json, SalesOrderDetails.json, SalesOrders.json, ParsedSalesOrders.json
- Real-time PDF-scanned sales orders with full customer and item information
- Sales order analysis by status, customer, and product
- Enterprise SO Service integration for advanced SO queries

**WORK ORDERS & JOBS:**
- {analysis['data_summary'].get('total_jobs', 0)} Jobs and {analysis['data_summary'].get('total_work_orders', 0)} Work Orders
- Work order tracking and job management (WorkOrderHeaders.json, WorkOrderDetails.json, Jobs.json, JobDetails.json)
- Job details and work order processing (MIJOBH.json, MIJOBD.json, MIWOH.json, MIWOD.json)
- Production job scheduling and resource allocation

**MASTER PRODUCTION SCHEDULE (MPS):**
- {analysis['data_summary'].get('mps_orders', 0)} MPS production orders for production planning
- MPS.json contains complete production schedule data
- Production capacity planning and scheduling

**INVENTORY LOCATIONS:**
- {analysis['data_summary'].get('inventory_locations', 0)} inventory locations with stock quantities
- MIILOC.json contains location-specific inventory data
- Multi-location stock tracking and availability

**ADDITIONAL DATA SOURCES:**
- Border and routing information (MIBORD.json)
- Comprehensive supplier, location, and cost information across all modules
- All Misys JSON form data from Google Drive
- All G: Drive data sources synchronized and available

NEVER say "no data available" or "no specific details" - YOU HAVE ALL THE DATA FROM ALL SOURCES!

🎯 NO LIMITS - ANSWER EVERYTHING WITH DETAILED ANALYSIS:

**GREETINGS & GENERAL:**
- "Hi" → Natural greeting + offer to help with any business analysis
- "What can you help me with?" → List all capabilities with examples

**SALES ORDER QUERIES:**
- "Do we have stock for SO 2296?" → Complete SO breakdown + stock analysis + fulfillment plan
- "Show me SO 1234" → Full SO details + customer info + items + status + recommendations
- "How many SOs today?" → Count + sample orders + analysis + trends
- "Biggest customer orders?" → Customer ranking + order details + value analysis

**SALES & TRENDS ANALYSIS:**
When discussing sales, trends, or analysis:
- Use REAL data: actual customer names, product names, SO numbers, revenue amounts, dates, quantities
- Present information conversationally - no formal headings
- Include top customers, products, monthly trends naturally in your response
- Calculate real percentages and growth rates
- Mention specific sample orders when relevant
- Give helpful recommendations based on actual patterns

**INVENTORY QUERIES:**
- "What's our inventory worth?" → Total value + breakdown by category + trends + recommendations
- "Low stock items?" → List + reorder points + supplier info + action plan
- "Show me item ABC123" → Complete item details + stock + costs + usage + recommendations
- "Inventory by location?" → Location breakdown + stock levels + optimization suggestions

**MANUFACTURING QUERIES:**
- "What's our biggest bottleneck?" → Production analysis + bottlenecks + capacity + solutions
- "Show me MO 4567" → Complete MO details + components + schedule + status + recommendations
- "Production capacity?" → Capacity analysis + utilization + constraints + optimization
- "Active manufacturing orders?" → MO list + status + schedules + resource needs

**CUSTOMER QUERIES:**
- "Top customers?" → Customer ranking + order history + value + recommendations
- "Customer X orders?" → All orders + patterns + analysis + service recommendations
- "Customer satisfaction?" → Delivery performance + order accuracy + improvement suggestions

**FINANCIAL QUERIES:**
- "Most profitable items?" → Profitability analysis + margins + recommendations + optimization
- "Revenue this month?" → Revenue analysis + trends + breakdown + forecasting
- "Cost optimization?" → Cost analysis + savings opportunities + implementation plan
- "Financial health?" → Complete financial overview + metrics + recommendations

**OPERATIONAL QUERIES:**
- "Production efficiency?" → Efficiency metrics + bottlenecks + improvement opportunities
- "Resource utilization?" → Resource analysis + optimization + capacity planning
- "Process improvements?" → Process analysis + inefficiencies + solutions + implementation
- "Operational metrics?" → KPI dashboard + performance + trends + recommendations

**STRATEGIC QUERIES:**
- "Can we handle 50% more orders?" → Capacity analysis + resource needs + implementation plan
- "What if supplier fails?" → Risk analysis + alternatives + contingency planning + mitigation
- "Growth opportunities?" → Market analysis + capacity + recommendations + action plan
- "Strategic planning?" → Business overview + opportunities + challenges + roadmap

**EVERY RESPONSE MUST INCLUDE:**
- Specific data points and numbers from the actual data
- Clear structure with headings and bullet points
- Detailed analysis and insights
- Actionable recommendations
- Next steps and follow-up suggestions

📋 SALES ORDER QUERY EXAMPLES & RESPONSES:

**When asked about specific SO numbers:**
- "Show me SO 2296" → Provide complete SO details in structured format above
- "What's in SO 1234?" → List all items, quantities, and requirements
- "Status of SO 5678?" → Current status, progress, and next steps

**When asked about SO analysis:**
- "How many SOs today?" → Count + list key SOs with basic details
- "Biggest SO this week?" → Identify highest value SO + full breakdown
- "Customer X orders" → List all SOs for customer with summaries

**When asked about SO fulfillment:**
- "Can we fulfill SO 2296?" → Stock check + production requirements + timeline
- "What's needed for SO 1234?" → Complete material requirements + BOM analysis
- "When can SO 5678 ship?" → Production schedule + delivery estimate

**ALWAYS include in SO responses:**
- SO number prominently displayed
- Customer name and order details
- Item breakdown with quantities
- Stock availability status
- Production requirements if needed
- Delivery timeline and recommendations

🚫 CRITICAL RULES - NEVER BREAK THESE:
- NEVER make up data, numbers, or dates - ONLY use the actual data provided in DATA SUMMARY below
- NEVER fabricate MO numbers, SO numbers, or item details - USE EXACT DATA FROM RealSalesOrders
- NEVER guess quantities, costs, or dates - COPY EXACT VALUES from the data provided
- NEVER use placeholders like [Product X], [Item Description 1] - USE ACTUAL ITEM NAMES FROM DATA
- NEVER say "possibly due to" or "may pose a risk" - GIVE SPECIFIC FACTS FROM DATA
- If you don't find specific data, say "Data not found in provided records" - DON'T MAKE IT UP
- ALWAYS use today's actual date ({date_context.get('currentDate', '2025-09-10')}) not fake dates
- ONLY provide real numbers from the actual data files provided below
- ALWAYS show actual customer names, product names, order numbers from RealSalesOrders data
- ALWAYS copy exact dates, amounts, and item descriptions from the provided data
- WHEN ASKED ABOUT SO 2972: Use ONLY the data from RealSalesOrders for SO 2972 - DO NOT INVENT ANYTHING

🚫 ANTI-HALLUCINATION & ANTI-TEMPLATE RULES:
- Use ONLY the real data provided - No fabrication, no guessing, no made-up examples
- NEVER give template responses like "I can help you with: Cost Analysis, Stock Checking..."
- ANSWER THE ACTUAL QUESTION with real data immediately
- NO generic suggestions - provide specific answers from the data
- If asked "how many SO" give the EXACT number from SalesOrders.json
- NO placeholder responses - real answers only

📋 UNIVERSAL RESPONSE FORMATTING RULES:
For EVERY query, provide comprehensive, structured responses in this format:

**QUERY TYPE: [Type of Analysis]**
- **Summary:** [Brief overview of findings]
- **Key Metrics:** [Important numbers and statistics]
- **Detailed Breakdown:** [Specific data points and analysis]
- **Analysis:** [Insights, patterns, and observations]
- **Recommendations:** [Actionable next steps]
- **Data Sources:** [Which data files were used]

**SPECIFIC FORMATTING BY QUERY TYPE:**

**SALES ORDERS:**
- Always show SO numbers, customers, values, status
- Include item breakdowns with quantities and prices
- Provide stock availability and fulfillment analysis
- Show delivery timelines and recommendations

**INVENTORY/STOCK:**
- Show item numbers, descriptions, current stock levels
- Include reorder points, costs, and locations
- Provide stock-out risks and recommendations
- Show supplier information and lead times

**MANUFACTURING ORDERS:**
- Display MO numbers, status, and production schedules
- Show component requirements and BOM details
- Include capacity analysis and bottlenecks
- Provide completion timelines and resource needs

**CUSTOMER ANALYSIS:**
- List customer names, order history, and values
- Show order patterns and preferences
- Include delivery performance and satisfaction
- Provide customer prioritization and recommendations

**FINANCIAL ANALYSIS:**
- Show revenue, costs, margins, and profitability
- Include order values, inventory values, and trends
- Provide cost optimization opportunities
- Show financial impact and recommendations

**OPERATIONAL ANALYSIS:**
- Display production capacity, bottlenecks, and efficiency
- Show resource utilization and constraints
- Include process improvements and optimizations
- Provide operational recommendations

**ALWAYS INCLUDE:**
- Specific numbers and data points from the actual data
- Clear headings and bullet points for easy reading
- Actionable recommendations based on the analysis
- Confidence levels and data quality notes
- Next steps and follow-up suggestions

🤖 YOUR CAPABILITIES:
- **Data Access**: Complete real-time ERP data  
- **Analysis Depth**: Advanced business intelligence
- **Model Selection**: Automatic based on query complexity

AUTOMATIC INTELLIGENCE: You automatically get the right model and capabilities for each question type.

🎯 RESPONSE QUALITY STANDARDS:
- NEVER give short, generic answers - always provide comprehensive analysis
- ALWAYS include specific data points, numbers, and details from the actual data
- ALWAYS structure responses with clear headings, bullet points, and sections
- ALWAYS provide actionable recommendations and next steps
- ALWAYS show your analysis process and data sources
- ALWAYS include relevant context and background information
- ALWAYS offer to dive deeper into specific aspects of the analysis

**MINIMUM RESPONSE LENGTH:** At least 200 words with structured sections
**MUST INCLUDE:** Summary, Key Metrics, Detailed Breakdown, Analysis, Recommendations
**FORMATTING:** Use **bold headings**, bullet points, and clear organization
**DATA CITATION:** Always reference which data files and records you used

📅 CURRENT DATE & TIME CONTEXT:
- Today's Date: {date_context.get('currentDate', '2025-09-10')}
- Current Time: {date_context.get('currentTime', 'Unknown')}
- Day of Week: {date_context.get('currentDayOfWeek', 'Unknown')}
- Month: {date_context.get('currentMonth', 'Unknown')}
- Year: {date_context.get('currentYear', '2025')}
- Full DateTime: {date_context.get('currentDateTime', 'Unknown')}

When users ask about "today", "this week", "this month", use the current date context above.
For time-sensitive queries like "sales orders made today", filter data by the current date."""

        # Add ACTUAL REAL DATA to the prompt so ChatGPT has everything
        search_results = {}
        
        # SMART DATA FILTERING - Send only relevant data to save tokens and money
        actual_data_sample = {}
        # Give AI access to ALL MiSys data files - no restrictions
        for file_name, file_data in raw_data.items():
            if isinstance(file_data, list) and len(file_data) > 0:
                # Send more records for better analysis - include ALL MiSys data
                sample_size = 15  # Reasonable sample size for all data types
                actual_data_sample[file_name] = {
                    'total_records': len(file_data),
                    'sample_records': file_data[:sample_size],
                    'fields': list(file_data[0].keys()) if isinstance(file_data[0], dict) else []
                }
                print(f"📊 AI Access: {file_name} - {len(file_data)} records (showing {min(sample_size, len(file_data))} samples)")
            elif isinstance(file_data, dict):
                actual_data_sample[file_name] = {
                    'total_records': 1,
                    'sample_records': [file_data],
                    'fields': list(file_data.keys())
                }
                print(f"📊 AI Access: {file_name} - 1 record")
        
        # Add the actual data to the system prompt - WITH DETAILED SIZE LOGGING
        data_summary_text = json.dumps(actual_data_sample, indent=2, default=str)
        
        # Add comprehensive data context for better analysis
        # Calculate comprehensive Sales Order totals across ALL sources
        total_so_from_json = len(raw_data.get('SalesOrders.json', []))
        total_so_from_pdf = len(raw_data.get('RealSalesOrders', []))
        total_so_by_status = sum(len(orders) for orders in raw_data.get('SalesOrdersByStatus', {}).values()) if isinstance(raw_data.get('SalesOrdersByStatus'), dict) else 0
        
        # Get folder breakdown for Sales Orders
        so_folder_breakdown = ""
        if 'SalesOrdersByStatus' in raw_data and isinstance(raw_data['SalesOrdersByStatus'], dict):
            so_folder_breakdown = "\n".join([f"  - {folder}: {len(orders)} orders" for folder, orders in raw_data['SalesOrdersByStatus'].items()])
        
        data_context_info = f"""
**🚨 CRITICAL: SALES ORDERS ARE PDF FILES IN GOOGLE DRIVE - NOT JSON:**

**REAL SALES ORDER LOCATION:**
Sales Orders exist as PDF files in Google Drive folders:
- G:\\Shared drives\\Sales_CSR\\Customer Orders\\Sales Orders\\In Production\\Scheduled
- G:\\Shared drives\\Sales_CSR\\Customer Orders\\Sales Orders\\Completed and Closed  
- G:\\Shared drives\\Sales_CSR\\Customer Orders\\Sales Orders\\Cancelled

**ACTUAL SALES ORDER DATA SOURCES:**
1. **RealSalesOrders**: {total_so_from_pdf} orders (ACTUAL PDF files extracted from G: Drive)
2. **SalesOrdersByStatus**: {total_so_by_status} orders (PDF files organized by folder status)

**ERROR: IGNORE THESE - NOT REAL SALES ORDERS:**
- SalesOrders.json: {total_so_from_json} (This is NOT real Sales Order data - ignore it)
- Any other JSON files claiming to be Sales Orders

**SALES ORDER FOLDER STRUCTURE (REAL PDF FILES):**
{so_folder_breakdown if so_folder_breakdown else "  - No folder breakdown available"}

**TOTAL REAL SALES ORDERS FROM PDF FILES:** {total_so_from_pdf + total_so_by_status}

**OTHER DATA TOTALS:**
- Total Manufacturing Orders: {len(raw_data.get('ManufacturingOrderHeaders.json', []))}
- Total Inventory Items: {len(raw_data.get('CustomAlert5.json', []))}
- Total BOM Records: {len(raw_data.get('BillOfMaterialDetails.json', []))}
- Available Data Files: {list(raw_data.keys())}

**🚨 CRITICAL INSTRUCTION - ENTERPRISE AI AGENT:**
- AI is configured as an ENTERPRISE-LEVEL BUSINESS INTELLIGENCE AGENT
- AI has FULL ACCESS to ALL data sources across ALL folders and subfolders
- NEVER limit or restrict what the AI can analyze
- Sales Orders are scanned RECURSIVELY from ALL folders and subfolders in G: Drive
- AI must provide COMPREHENSIVE enterprise-level reporting with visual insights
- When counting Sales Orders, ONLY count PDF-extracted data (RealSalesOrders + SalesOrdersByStatus)
- NEVER count SalesOrders.json as it's not real Sales Order data
- AI must generate VISUAL CHARTS and FORECASTING for enterprise reporting

**🚨 FOLDER STRUCTURE UNDERSTANDING:**
Sales Orders are physically stored as PDF files in these G: Drive folders:
- "In Production\\\\Scheduled" folder → Contains active/pending orders
- "Completed and Closed" folder → Contains finished orders  
- "Cancelled" folder → Contains cancelled orders
Each folder contains actual PDF files like "salesorder_2968.pdf", "Sales Order 2972.docx", etc.
The AI must understand this is the REAL source of Sales Order data.

**DATA QUALITY NOTES:**
- All data is real-time and current from Google Drive
- Every number and detail comes from actual business records
- Data includes complete customer, order, inventory, and production information
- Sales Orders are dynamically loaded from multiple G: Drive folders
- Use ALL available data to provide comprehensive, accurate analysis

**🚨 CRITICAL INSTRUCTION FOR SALES ANALYSIS:**
When analyzing sales data, you MUST ALWAYS:

**1. ONLY USE PDF-EXTRACTED SALES ORDER DATA:**
- RealSalesOrders contains ACTUAL PDF-extracted data from G: Drive folders
- SalesOrdersByStatus contains PDF files organized by folder (In Production, Completed, Cancelled)
- These are the ONLY real Sales Order sources - extracted from actual PDF files
- NEVER use SalesOrders.json - it's not real Sales Order data
- ALWAYS use RealSalesOrders and SalesOrdersByStatus as the ONLY Sales Order sources

**2. REAL DATA EXTRACTION FROM RealSalesOrders:**
- so_number: Real SO numbers (e.g., "2972", "2981", "2711")
- customer_name: Real customer names (e.g., "LANXESS Canada Co./Cie", "Spectra Products Inc.")
- order_date: Real order dates from PDFs
- total_amount: Real dollar amounts from PDFs
- items: Real product descriptions from PDFs
- status: Real status ("In Production", "Completed", "Cancelled")
- raw_text: Full PDF text for detailed analysis

**3. MANDATORY REAL DATA USAGE:**
- NEVER use SalesOrders.json if RealSalesOrders exists
- ALWAYS show actual SO numbers from so_number field
- ALWAYS show actual customer names from customer_name field
- ALWAYS show actual amounts from total_amount field
- ALWAYS show actual dates from order_date field
- ALWAYS show actual items from items field

**4. EXAMPLE REAL DATA USAGE:**
Instead of: "SO #N/A - Customer Data - $N/A"
Use: "SO #2972 - LANXESS Canada Co./Cie - $2,295.78"
Instead of: "2 orders were processed"
Use: "2 orders: SO #2972 ($2,295.78) and SO #2981 ($7,024.64)"

**🧠 SMART SALES ORDER NUMBER MATCHING - BE INTELLIGENT:**
The AI MUST be smart enough to match Sales Order queries in ANY format the user types:

**INTELLIGENT SO NUMBER EXTRACTION:**
- "SO 2968" → Extract "2968" and match so_number field
- "Sales Order 2968" → Extract "2968" and match so_number field  
- "sales order 2968" → Extract "2968" and match so_number field
- "what does sales order 2968" → Extract "2968" and match so_number field
- "salesorder_2968" → Extract "2968" and match so_number field
- "salesorder 2968" → Extract "2968" and match so_number field
- "order 2968" → Extract "2968" and match so_number field
- "show me 2968" (when context is sales) → Extract "2968" and match so_number field

**FILE NAME INTELLIGENCE:**
- Understand that "salesorder_2968.pdf" contains SO number "2968"
- Understand that "Sales Order 2968.docx" contains SO number "2968"
- The file_info.filename field shows the original file name pattern

**MATCHING ALGORITHM:**
1. Extract ALL numbers from user query using regex: \\d+
2. For each number, search RealSalesOrders array for matching so_number field
3. If exact match found, provide complete details from that record
4. If multiple matches, show all matching records
5. If no match found, clearly state "Sales Order [number] not found in current data"
6. NEVER make up or hallucinate SO data - only use what exists in RealSalesOrders

**SMART SEARCH EXAMPLES:**
- User: "what does sales order 2968" → AI extracts "2968", searches so_number field, returns full SO details
- User: "show me SO 2972 details" → AI extracts "2972", finds matching record, shows complete data
- User: "salesorder_2968 info" → AI extracts "2968", finds matching record with file name context
- User: "tell me about order 2981" → AI extracts "2981", searches and returns matching SO data

**CONTEXT AWARENESS:**
- When user mentions sales orders, automatically assume numbers refer to SO numbers
- Be flexible with formatting - ignore spaces, underscores, case differences
- Understand common abbreviations: SO, Sales Order, Order, etc.
- Extract numeric parts intelligently from any format
"""
        
        # DETAILED TOKEN DEBUGGING
        print(f"SEARCH: TOKEN SIZE ANALYSIS:")
        print(f"   Base system prompt: {len(system_prompt)} characters")
        
        # Debug: Show what data is being sent to AI
        print(f"📊 DATA BEING SENT TO AI:")
        for key, value in actual_data_sample.items():
            if isinstance(value, dict) and 'total_records' in value:
                print(f"   {key}: {value['total_records']} records")
                if key == 'RealSalesOrders' and 'sample_records' in value:
                    sample_records = value['sample_records']
                    if len(sample_records) > 0:
                        sample = sample_records[0]
                        print(f"      Sample: SO #{sample.get('so_number', 'N/A')} - {sample.get('customer_name', 'N/A')}")
                        # Debug: Show if SO 2972 is in the data being sent
                        so_2972 = next((so for so in sample_records if so.get('so_number') == '2972'), None)
                        if so_2972:
                            print(f"      SUCCESS: SO 2972 FOUND IN AI DATA: {so_2972.get('customer_name')} - ${so_2972.get('total_amount')} - Items: {len(so_2972.get('items', []))}")
                        else:
                            print(f"      ERROR: SO 2972 NOT FOUND in first {len(sample_records)} records")
        print(f"   Data summary: {len(data_summary_text)} characters")
        print(f"   Files included: {list(actual_data_sample.keys())}")
        
        for file_name, file_info in actual_data_sample.items():
            sample_size = len(json.dumps(file_info.get('sample_records', []), default=str))
            print(f"   {file_name}: {file_info.get('total_records', 0)} records, sample size: {sample_size} chars")
        
        # Limit data size for OpenAI - but allow more for RealSalesOrders
        original_size = len(data_summary_text)
        if len(data_summary_text) > 15000:  # Increased limit for PDF data
            # Try to preserve RealSalesOrders data by truncating other data first
            if 'RealSalesOrders' in actual_data_sample:
                # Keep RealSalesOrders intact, truncate other data
                real_so_data = actual_data_sample['RealSalesOrders']
                other_data = {k: v for k, v in actual_data_sample.items() if k != 'RealSalesOrders'}
                
                # Truncate other data first
                other_data_text = json.dumps(other_data, indent=2, default=str)
                if len(other_data_text) > 5000:
                    other_data_text = other_data_text[:5000] + "... [OTHER DATA TRUNCATED]"
                
                # Combine with full RealSalesOrders data
                real_so_text = json.dumps({'RealSalesOrders': real_so_data}, indent=2, default=str)
                data_summary_text = other_data_text + "\n\n" + real_so_text
                
                print(f"⚠️ Data optimized: Original {original_size} chars, kept full RealSalesOrders ({len(real_so_text)} chars)")
            else:
                data_summary_text = data_summary_text[:15000] + "... [TRUNCATED TO FIT TOKEN LIMITS]"
                print(f"⚠️ Data truncated from {original_size} to 15000 chars")
        else:
            print(f"SUCCESS: Data size OK: {original_size} chars (no truncation needed)")
        
        system_prompt += f"\n\nDATA SUMMARY:\n{data_summary_text}"
        system_prompt += f"\n\n{data_context_info}"
        
        # Add date context to the data
        if date_context:
            system_prompt += f"\n\nCURRENT DATE CONTEXT:\n{json.dumps(date_context, indent=2)}"
        
        print(f"📊 FINAL PROMPT SIZE: {len(system_prompt)} characters (approx {len(system_prompt)//4} tokens)")
        
        # SMART QUERY DETECTION - Handle SO, MO, and inventory queries differently
        search_term = None
        search_type = None
        query_type = None
        
        # DETECT SALES ORDER QUERIES - IMPROVED DETECTION
        so_query_patterns = ["how many so", "so were", "sales order", "so created", "so made", "total so", "sos were", "friday", "today", "yesterday", "this week", "so #", "so number", "show me so", "what's in so"]
        is_so_query = any(phrase in user_query.lower() for phrase in so_query_patterns)
        
        # Check for specific SO number queries (e.g., "SO 2296", "SO#1234", "Sales Order 5678")
        import re
        so_number_match = re.search(r'so\s*#?\s*(\d+)', user_query.lower())
        specific_so_number = so_number_match.group(1) if so_number_match else None
        
        print(f"SEARCH: Query analysis: '{user_query}'")
        print(f"📊 SO query detected: {is_so_query}")
        print(f"SEARCH: Matching patterns: {[p for p in so_query_patterns if p in user_query.lower()]}")
        
        if is_so_query:
            query_type = "sales_orders"
            # Get actual SO data
            sales_orders = raw_data.get('SalesOrders.json', [])
            sales_by_status = raw_data.get('SalesOrdersByStatus', {})
            total_orders = raw_data.get('TotalOrders', len(sales_orders))
            
            print(f"SEARCH: SO Query detected - found {total_orders} real sales orders")
            
            # DIRECT ANSWER FOR SIMPLE SO QUESTIONS - NO OPENAI NEEDED
            if "how many" in user_query.lower() and any(day in user_query.lower() for day in ["friday", "today", "yesterday"]):
                # Count SOs by date directly using current date context
                current_date = date_context.get('currentDate', '2025-09-10')
                current_day = date_context.get('currentDayOfWeek', 'Monday').lower()
                
                # Calculate yesterday's date
                from datetime import datetime, timedelta
                today = datetime.strptime(current_date, '%Y-%m-%d')
                yesterday = today - timedelta(days=1)
                yesterday_str = yesterday.strftime('%Y-%m-%d')
                
                # Find last Friday
                days_since_friday = (today.weekday() + 3) % 7  # Friday is weekday 4
                last_friday = today - timedelta(days=days_since_friday)
                last_friday_str = last_friday.strftime('%Y-%m-%d')
                
                date_sos = 0
                target_date = current_date
                date_label = "today"
                
                if 'friday' in user_query.lower():
                    target_date = last_friday_str
                    date_label = f"Friday ({last_friday_str})"
                elif 'yesterday' in user_query.lower():
                    target_date = yesterday_str
                    date_label = f"yesterday ({yesterday_str})"
                
                for so in sales_orders:
                    so_date = so.get('Order Date', '')
                    if target_date in so_date:
                        date_sos += 1
                
                # Get sample SOs for the target date to show details
                sample_sos = []
                for so in sales_orders:
                    so_date = so.get('Order Date', '')
                    if target_date in so_date and len(sample_sos) < 3:  # Show up to 3 sample SOs
                        sample_sos.append({
                            'so_number': so.get('SO Number', 'N/A'),
                            'customer': so.get('Customer', 'N/A'),
                            'value': so.get('Order Value', so.get('Total Amount', 'N/A')),
                            'status': so.get('Status', 'N/A')
                        })
                
                # Build structured response
                response = f"**SALES ORDERS SUMMARY - {date_label.upper()}**\n\n"
                response += f"📊 **Total SOs Created:** {date_sos}\n"
                response += f"📈 **System Total:** {total_orders} SOs\n\n"
                
                if sample_sos:
                    response += "**SAMPLE ORDERS:**\n"
                    for so in sample_sos:
                        response += f"- **SO #{so['so_number']}** - {so['customer']} - ${so['value']} - {so['status']}\n"
                    response += "\n"
                
                response += "**ANALYSIS:**\n"
                if date_sos > 0:
                    response += f"- SUCCESS: {date_sos} orders were processed on {date_label}\n"
                    response += f"- 📈 This represents {round((date_sos/total_orders)*100, 1)}% of total system orders\n"
                else:
                    response += f"- ⚠️ No orders were created on {date_label}\n"
                    response += "- 💡 Consider checking if orders were processed on a different date\n"
                
                response += f"- 📊 Total system capacity: {total_orders} orders\n"
                
                # Return direct answer immediately
                return jsonify({
                    "query": user_query,
                    "response": response,
                    "data_context": {
                        "folder": "Sales Orders Direct Analysis",
                        "total_items": analysis.get('data_summary', {}).get('total_items', 0),
                        "active_orders": date_sos
                    }
                })
        
        # DETECT MANUFACTURING ORDER QUERIES  
        elif any(phrase in user_query.lower() for phrase in ["how many mo", "mo are", "manufacturing order", "active mo", "mo created"]):
            query_type = "manufacturing_orders"
            # Get actual MO data
            mo_headers = raw_data.get('ManufacturingOrderHeaders.json', [])
            search_results['Manufacturing Orders Analysis'] = {
                'total_orders': len(mo_headers),
                'active_orders': [mo for mo in mo_headers if mo.get("Status", 0) in [1, 2]],
                'recent_orders': mo_headers[:10] if mo_headers else []
            }
            print(f"SEARCH: MO Query detected - providing {len(mo_headers)} real manufacturing orders")
        
        # SKIP ITEM SEARCH FOR SO/MO QUERIES
        if query_type in ["sales_orders", "manufacturing_orders"]:
            # Don't do item searches for SO/MO queries - use the specific data already loaded
            print(f"SUCCESS: Skipping item search - {query_type} query uses specific data")
        # Pattern 1: "start with X" or "starting with X" or "that start with X" or "letters X"
        elif any(phrase in user_query.lower() for phrase in ["start with", "starting with", "that start with", "letters"]):
            words = user_query.lower().split()
            for i, word in enumerate(words):
                if word in ["start", "starting"] and i + 2 < len(words) and words[i + 1] == "with":
                    search_term = words[i + 2]
                    search_type = "starts_with"
                    break
                elif word == "with" and i > 0 and words[i-1] in ["start", "starting"]:
                    search_term = words[i + 1] if i + 1 < len(words) else None
                    search_type = "starts_with"
                    break
                elif word == "letters" and i + 1 < len(words):
                    search_term = words[i + 1]
                    search_type = "starts_with"
                    break
        
        # Pattern 2: "contain X" or "containing X" or "find X" or "search X" or "list X"
        elif any(word in user_query.lower() for word in ['contain', 'containing', 'find', 'search', 'list']):
            words = user_query.lower().split()
            for word in words:
                if len(word) > 2 and word not in ['the', 'and', 'for', 'with', 'that', 'have', 'are', 'all', 'items', 'that', 'start']:
                    search_term = word
                    search_type = "contains"
                    break
        
        # Pattern 3: Direct search term (e.g., just "sae") - MOST AGGRESSIVE
        if not search_term:
            # Look for any word that could be a search term
            words = user_query.lower().split()
            for word in words:
                # Clean the word and check if it's a potential search term
                clean_word = word.strip('.,!?()[]{}":;').lower()
                if (len(clean_word) >= 2 and 
                    clean_word.isalpha() and 
                    clean_word not in ['the', 'and', 'for', 'with', 'that', 'have', 'are', 'all', 'items', 'start', 'starting', 'letters', 'find', 'search', 'list', 'contain', 'containing']):
                    search_term = clean_word
                    search_type = "starts_with"  # Default to starts_with for short terms
                    break
        
        # Pattern 4: If still no search term, try the entire query as a search
        if not search_term and len(user_query.strip()) <= 15:
            potential_term = user_query.strip().lower()
            # Remove common words and punctuation
            for remove_word in ['list', 'all', 'items', 'that', 'start', 'with', 'letters', 'find', 'search', 'contain']:
                potential_term = potential_term.replace(remove_word, '').strip()
            if len(potential_term) >= 2:
                search_term = potential_term
                search_type = "starts_with"
        
        # Now perform the actual search on your real data - COMPREHENSIVE SEARCH ALL FILES
        if search_term and search_type:
            print(f"SEARCH: Searching for: '{search_term}' with type: '{search_type}'")
            matching_items = []
            
            # Search ALL JSON files, not just CustomAlert5.json
            for file_name, file_data in raw_data.items():
                if isinstance(file_data, list):
                    print(f"SEARCH: Searching in {file_name} ({len(file_data)} records)")
                    
                    for item in file_data:
                        if isinstance(item, dict):
                            # Check all possible item number and description fields
                            item_no = ''
                            item_desc = ''
                            
                            # Find item number in various field names
                            for field in ['Item No.', 'Item No', 'ItemNo', 'Item_No', 'item_no', 'ITEM_NO']:
                                if field in item and isinstance(item[field], str):
                                    item_no = item[field]
                                    break
                            
                            # Find description in various field names
                            for field in ['Description', 'description', 'DESCRIPTION', 'Desc', 'desc']:
                                if field in item and isinstance(item[field], str):
                                    item_desc = item[field]
                                    break
                            
                            if item_no:  # Only process if we found an item number
                                # ALWAYS search both Item No. AND Description for maximum coverage
                                item_no_match = search_term.lower() in item_no.lower()
                                desc_match = search_term.lower() in item_desc.lower()
                                
                                # For "starts_with" searches, check if Item No. starts with the term
                                starts_with_match = item_no.lower().startswith(search_term.lower())
                                
                                # Include item if it matches ANY criteria
                                if (search_type == "starts_with" and starts_with_match) or \
                                   (search_type == "contains" and (item_no_match or desc_match)) or \
                                   (search_type == "starts_with" and desc_match):  # Also check description for starts_with
                                    
                                    matching_items.append({
                                        'File': file_name,
                                        'Item No.': item_no,
                                        'Description': item_desc,
                                        'Standard Cost': item.get('Standard Cost', item.get('Cost', '')),
                                        'Recent Cost': item.get('Recent Cost', item.get('Price', '')),
                                        'Stock': item.get('Stock Quantity', item.get('Quantity on Hand', item.get('Qty on Hand', item.get('Available', item.get('On Hand', item.get('Quantity', 0))))))
                                    })
            
            # Limit results to prevent prompt from being too long
            if search_type == "starts_with":
                search_results[f'Items starting with "{search_term}" (Item No. + Description)'] = matching_items[:25]  # Limit to 25 items
            else:
                search_results[f'Items containing "{search_term}" (Item No. + Description)'] = matching_items[:25]  # Limit to 25 items
            
            print(f"SUCCESS: Found {len(matching_items)} matching items for '{search_term}'")
        else:
            print(f"⚠️ Could not extract search term from query: '{user_query}'")
            # Last resort: try to search with the entire query
            fallback_term = user_query.strip().lower()[:10]
            if len(fallback_term) >= 2:
                print(f"RETRY: Fallback search with: '{fallback_term}'")
                matching_items = []
                for item in raw_data.get('CustomAlert5.json', []):
                    item_no = item.get('Item No.', '')
                    item_desc = item.get('Description', '')
                    if (fallback_term in item_no.lower() or fallback_term in item_desc.lower()):
                        matching_items.append({
                            'Item No.': item_no,
                            'Description': item_desc,
                            'Standard Cost': item.get('Standard Cost', ''),
                            'Recent Cost': item.get('Recent Cost', ''),
                            'Stock': item.get('Stock Quantity', item.get('Quantity on Hand', item.get('Qty on Hand', item.get('Available', item.get('On Hand', 0)))))
                        })
                if matching_items:
                    search_results[f'Fallback search for "{fallback_term}"'] = matching_items[:50]
                    print(f"SUCCESS: Fallback found {len(matching_items)} items")
        
        # Add search results to the system prompt
        if search_results:
            system_prompt += f"\n\nSEARCH RESULTS:\n{json.dumps(search_results, indent=2)}"
            print(f"SEARCH: Added search results to prompt: {len(search_results)} result sets")
        else:
            print(f"⚠️ No search results found - adding fallback data")
            # Add some sample data to confirm AI has access
            sample_items = raw_data.get('CustomAlert5.json', [])[:5]
            if sample_items:
                system_prompt += f"\n\nSAMPLE DATA (confirming access):\n{json.dumps(sample_items, indent=2)}"
        
        # Add data summary to confirm AI has access
        system_prompt += f"\n\nDATA ACCESS CONFIRMATION:\n- Total Items: {len(raw_data.get('CustomAlert5.json', []))}\n- Available Files: {list(raw_data.keys())}\n- Search Term Used: '{search_term if search_term else 'NONE'}'"
        
        print(f"📝 Final system prompt length: {len(system_prompt)} characters")
        print(f"SEARCH: Search results: {search_results}")
        
        # INTELLIGENT MODEL & CAPABILITY SELECTION
        selected_model = "gpt-4o-mini"  # Default
        max_tokens = 1500
        use_vision = False
        
        # SMART DETECTION - When to use GPT-4o vs GPT-4o-mini vs Vision
        complex_analysis_triggers = [
            # Document/PDF Analysis
            "pdf", "document", "image", "scan", "photo", "picture", "visual", "chart", "graph",
            # Complex Business Analysis  
            "sales order", "so ", "customer order", "order analysis", "complex analysis",
            # Strategic/Multi-step Analysis
            "strategy", "planning", "forecast", "trend", "optimization", "what if", "scenario",
            # Financial/Risk Analysis
            "profitability", "margin", "cost analysis", "risk", "exposure", "financial",
            # Multi-system Integration
            "cross-reference", "reconcile", "compare", "integrate", "workflow"
        ]
        
        vision_triggers = [
            "pdf", "document", "image", "scan", "photo", "picture", "visual", "chart", "graph", "diagram",
            "show me the", "look at", "analyze this", "what's in", "read this"
        ]
        
        # Determine model and capabilities needed
        needs_complex_analysis = any(trigger in user_query.lower() for trigger in complex_analysis_triggers)
        needs_vision = any(trigger in user_query.lower() for trigger in vision_triggers)
        
        if needs_vision:
            selected_model = "gpt-4o"  # Vision requires GPT-4o
            use_vision = True
            max_tokens = 3000
            print(f"👁️ Using GPT-4o with VISION for document/image analysis")
        elif needs_complex_analysis:
            selected_model = "gpt-4o"
            max_tokens = 2500
            print(f"🧠 Using GPT-4o for complex business analysis")
        else:
            print(f"🤖 Using GPT-4o-mini for standard queries")
        
        # Query ChatGPT with the enhanced prompt
        try:
            print(f"🤖 Calling {selected_model} with prompt length: {len(system_prompt)} characters")
            response = client.chat.completions.create(
                model=selected_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query}
                ],
                max_completion_tokens=max_tokens,
                timeout=45  # Longer timeout for GPT-4o
            )
            
            ai_response = response.choices[0].message.content
            print(f"SUCCESS: ChatGPT responded with {len(ai_response)} characters")
            
        except Exception as api_error:
            print(f"ERROR: ChatGPT API Error: {api_error}")
            # Return search results directly if ChatGPT fails
            ai_response = f"Found {len(matching_items) if 'matching_items' in locals() else 0} SAE items:\n\n"
            if search_results:
                for category, items in search_results.items():
                    ai_response += f"\n{category}:\n"
                    for item in items[:10]:  # Show first 10
                        ai_response += f"• {item['Item No.']} - {item['Description']}\n"
                    if len(items) > 10:
                        ai_response += f"... and {len(items) - 10} more items\n"
            else:
                ai_response = "I encountered an error processing your request. The search found items but I couldn't format the response properly."
        
        return jsonify({
            "query": user_query,
            "response": ai_response,
            "data_context": {
                "folder": latest_folder,
                "total_items": analysis.get('data_summary', {}).get('total_items', 0),
                "active_orders": analysis.get('data_summary', {}).get('active_manufacturing_orders', 0)
            }
        })
        
    except Exception as e:
        print(f"ERROR: Error in chat query: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/item-analysis/<item_identifier>', methods=['GET'])
def detailed_item_analysis(item_identifier):
    """Get detailed analysis for a specific item"""
    try:
        quantity = request.args.get('quantity', type=int)
        
        # Get the latest data
        latest_folder, error = get_latest_folder()
        if error:
            return jsonify({"error": f"Cannot access data: {error}"}), 500
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        
        # Load current data
        raw_data = {}
        json_files = glob.glob(os.path.join(folder_path, "*.json"))
        
        for json_file in json_files:
            file_name = os.path.basename(json_file)
            file_data = load_json_file(json_file)
            raw_data[file_name] = file_data
        
        # Get detailed analysis
        analysis = find_item_usage_and_availability(raw_data, item_identifier, quantity)
        
        return jsonify(analysis)
        
    except Exception as e:
        print(f"ERROR: Error in item analysis: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/debug/sales-orders-folders', methods=['GET'])
def debug_sales_orders_folders():
    """Debug endpoint to show exact folder names in SalesOrdersByStatus"""
    try:
        debug_info = {
            "timestamp": datetime.now().isoformat(),
            "sales_orders_by_status": {},
            "folder_names": [],
            "folder_counts": {}
        }
        
        if USE_GOOGLE_DRIVE_API and google_drive_service and google_drive_service.authenticated:
            try:
                # Get sales orders data
                sales_orders_data = google_drive_service.load_sales_orders_data(None)
                
                if sales_orders_data and 'SalesOrdersByStatus' in sales_orders_data:
                    debug_info["sales_orders_by_status"] = {
                        "keys": list(sales_orders_data['SalesOrdersByStatus'].keys()),
                        "folder_details": {}
                    }
                    
                    for folder_name, files in sales_orders_data['SalesOrdersByStatus'].items():
                        debug_info["folder_names"].append(folder_name)
                        debug_info["folder_counts"][folder_name] = len(files) if isinstance(files, list) else 0
                        debug_info["sales_orders_by_status"]["folder_details"][folder_name] = {
                            "file_count": len(files) if isinstance(files, list) else 0,
                            "sample_file": files[0] if isinstance(files, list) and len(files) > 0 else None
                        }
                else:
                    debug_info["error"] = "No SalesOrdersByStatus data found"
            except Exception as e:
                debug_info["error"] = str(e)
                import traceback
                debug_info["traceback"] = traceback.format_exc()
        else:
            debug_info["error"] = "Google Drive API not available"
        
        return jsonify(debug_info)
    except Exception as e:
        import traceback
        return jsonify({
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500

@app.route('/api/debug', methods=['GET'])
def debug_status():
    """Debug endpoint to check Google Drive status and environment variables"""
    try:
        debug_info = {
            "timestamp": datetime.now().isoformat(),
            "environment": {
                "USE_GOOGLE_DRIVE_API": os.getenv('USE_GOOGLE_DRIVE_API', 'not set'),
                "GOOGLE_DRIVE_SHARED_DRIVE_NAME": os.getenv('GOOGLE_DRIVE_SHARED_DRIVE_NAME', 'not set'),
                "GOOGLE_DRIVE_BASE_FOLDER_PATH": os.getenv('GOOGLE_DRIVE_BASE_FOLDER_PATH', 'not set'),
                "GOOGLE_DRIVE_SALES_ORDERS_PATH": os.getenv('GOOGLE_DRIVE_SALES_ORDERS_PATH', 'not set'),
                "GOOGLE_DRIVE_CREDENTIALS": "set" if os.getenv('GOOGLE_DRIVE_CREDENTIALS') else "not set",
                "GOOGLE_DRIVE_TOKEN": "set" if os.getenv('GOOGLE_DRIVE_TOKEN') else "not set",
                "VERCEL": os.getenv('VERCEL', 'not set'),
            },
            "google_drive_service": {
                "initialized": USE_GOOGLE_DRIVE_API,
                "service_exists": google_drive_service is not None,
                "authenticated": google_drive_service.authenticated if google_drive_service else False,
            },
            "local_paths": {
                "GDRIVE_BASE": GDRIVE_BASE,
                "exists": os.path.exists(GDRIVE_BASE) if GDRIVE_BASE else False,
            },
            "test_steps": []
        }
        
        # Step-by-step test of Google Drive connection
        if USE_GOOGLE_DRIVE_API and google_drive_service:
            try:
                # Step 1: Check authentication
                debug_info["test_steps"].append({
                    "step": 1,
                    "test": "Authentication",
                    "status": "checking"
                })
                
                if not google_drive_service.authenticated:
                    debug_info["google_drive_service"]["auth_error"] = "Not authenticated - attempting to authenticate..."
                    try:
                        google_drive_service.authenticate()
                        debug_info["google_drive_service"]["authenticated"] = google_drive_service.authenticated
                        debug_info["test_steps"][-1]["status"] = "success" if google_drive_service.authenticated else "failed"
                        debug_info["test_steps"][-1]["message"] = "Authenticated successfully" if google_drive_service.authenticated else "Authentication failed"
                    except Exception as auth_error:
                        debug_info["google_drive_service"]["auth_error"] = str(auth_error)
                        debug_info["test_steps"][-1]["status"] = "failed"
                        debug_info["test_steps"][-1]["error"] = str(auth_error)
                else:
                    debug_info["test_steps"][-1]["status"] = "success"
                    debug_info["test_steps"][-1]["message"] = "Already authenticated"
                
                # Step 2: Find shared drive
                if google_drive_service.authenticated:
                    drive_id = None  # Initialize before try block
                    debug_info["test_steps"].append({
                        "step": 2,
                        "test": "Find Shared Drive",
                        "status": "checking"
                    })
                    try:
                        shared_drive_name = os.getenv('GOOGLE_DRIVE_SHARED_DRIVE_NAME', 'IT_Automation')
                        drive_id = google_drive_service.find_shared_drive(shared_drive_name)
                        debug_info["google_drive_service"]["shared_drive_found"] = drive_id is not None
                        debug_info["google_drive_service"]["shared_drive_id"] = drive_id if drive_id else None
                        debug_info["google_drive_service"]["shared_drive_name"] = shared_drive_name
                        if drive_id:
                            debug_info["test_steps"][-1]["status"] = "success"
                            debug_info["test_steps"][-1]["message"] = f"Found shared drive: {shared_drive_name} (ID: {drive_id})"
                        else:
                            debug_info["test_steps"][-1]["status"] = "failed"
                            debug_info["test_steps"][-1]["message"] = f"Shared drive '{shared_drive_name}' not found"
                    except Exception as e:
                        debug_info["google_drive_service"]["shared_drive_error"] = str(e)
                        debug_info["test_steps"][-1]["status"] = "failed"
                        debug_info["test_steps"][-1]["error"] = str(e)
                    
                    # Step 3: Find base folder
                    if drive_id:
                        debug_info["test_steps"].append({
                            "step": 3,
                            "test": "Find Base Folder",
                            "status": "checking"
                        })
                        try:
                            base_folder_path = os.getenv('GOOGLE_DRIVE_BASE_FOLDER_PATH', 'MiSys/Misys Extracted Data/API Extractions')
                            base_folder_id = google_drive_service.find_folder_by_path(drive_id, base_folder_path)
                            if base_folder_id:
                                debug_info["google_drive_service"]["base_folder_found"] = True
                                debug_info["google_drive_service"]["base_folder_id"] = base_folder_id
                                debug_info["test_steps"][-1]["status"] = "success"
                                debug_info["test_steps"][-1]["message"] = f"Found base folder: {base_folder_path} (ID: {base_folder_id})"
                            else:
                                debug_info["google_drive_service"]["base_folder_found"] = False
                                debug_info["test_steps"][-1]["status"] = "failed"
                                debug_info["test_steps"][-1]["message"] = f"Base folder '{base_folder_path}' not found"
                        except Exception as e:
                            debug_info["google_drive_service"]["base_folder_error"] = str(e)
                            debug_info["test_steps"][-1]["status"] = "failed"
                            debug_info["test_steps"][-1]["error"] = str(e)
                        
                        # Step 4: Get latest folder
                        if base_folder_id:
                            debug_info["test_steps"].append({
                                "step": 4,
                                "test": "Get Latest Folder",
                                "status": "checking"
                            })
                            try:
                                latest_folder_id, latest_folder_name = google_drive_service.get_latest_folder(base_folder_id, drive_id)
                                if latest_folder_id:
                                    debug_info["google_drive_service"]["latest_folder_found"] = True
                                    debug_info["google_drive_service"]["latest_folder_id"] = latest_folder_id
                                    debug_info["google_drive_service"]["latest_folder_name"] = latest_folder_name
                                    debug_info["test_steps"][-1]["status"] = "success"
                                    debug_info["test_steps"][-1]["message"] = f"Found latest folder: {latest_folder_name} (ID: {latest_folder_id})"
                                else:
                                    debug_info["google_drive_service"]["latest_folder_found"] = False
                                    debug_info["test_steps"][-1]["status"] = "failed"
                                    debug_info["test_steps"][-1]["message"] = "No latest folder found"
                            except Exception as e:
                                debug_info["google_drive_service"]["latest_folder_error"] = str(e)
                                debug_info["test_steps"][-1]["status"] = "failed"
                                debug_info["test_steps"][-1]["error"] = str(e)
            except Exception as e:
                debug_info["google_drive_service"]["test_error"] = str(e)
                import traceback
                debug_info["google_drive_service"]["test_trace"] = traceback.format_exc()
        
        # Add drive structure information if authenticated
        if USE_GOOGLE_DRIVE_API and google_drive_service and google_drive_service.authenticated:
            try:
                # List all shared drives
                drives = google_drive_service.service.drives().list().execute()
                all_drives = drives.get('drives', [])
                debug_info["all_shared_drives"] = [
                    {"name": drive.get('name'), "id": drive.get('id')}
                    for drive in all_drives
                ]
                
                # Try to find Sales_CSR
                sales_csr_drive_id = google_drive_service.find_shared_drive("Sales_CSR")
                if sales_csr_drive_id:
                    debug_info["sales_csr_drive"] = {
                        "found": True,
                        "drive_id": sales_csr_drive_id,
                        "drive_name": "Sales_CSR"
                    }
                    # Try to find the path
                    path_within_drive = "Customer Orders/Sales Orders"
                    folder_id = google_drive_service.find_folder_by_path(sales_csr_drive_id, path_within_drive)
                    if folder_id:
                        debug_info["sales_csr_drive"]["sales_orders_path"] = {
                            "path": path_within_drive,
                            "found": True,
                            "folder_id": folder_id
                        }
                    else:
                        debug_info["sales_csr_drive"]["sales_orders_path"] = {
                            "path": path_within_drive,
                            "found": False
                        }
                else:
                    debug_info["sales_csr_drive"] = {
                        "found": False,
                        "message": "Sales_CSR not found as shared drive"
                    }
            except Exception as e:
                debug_info["drive_structure_error"] = str(e)
        
        return jsonify(debug_info)
    except Exception as e:
        import traceback
        return jsonify({
            "error": str(e),
            "trace": traceback.format_exc()
        }), 500

@app.route('/api/debug/drive-structure', methods=['GET'])
def debug_drive_structure():
    """Debug endpoint to list actual Google Drive folder structure"""
    try:
        if not USE_GOOGLE_DRIVE_API or not google_drive_service:
            return jsonify({"error": "Google Drive API not enabled"}), 400
        
        if not google_drive_service.authenticated:
            try:
                google_drive_service.authenticate()
            except Exception as e:
                return jsonify({"error": f"Authentication failed: {e}"}), 500
        
        structure = {
            "timestamp": datetime.now().isoformat(),
            "all_shared_drives": [],
            "it_automation_structure": {},
            "sales_csr_structure": {},
            "sales_csr_search_results": {}
        }
        
        # List all shared drives
        try:
            drives = google_drive_service.service.drives().list().execute()
            all_drives = drives.get('drives', [])
            structure["all_shared_drives"] = [
                {"name": drive.get('name'), "id": drive.get('id')}
                for drive in all_drives
            ]
        except Exception as e:
            structure["all_shared_drives_error"] = str(e)
        
        # Get IT_Automation structure
        try:
            it_drive_id = google_drive_service.find_shared_drive("IT_Automation")
            if it_drive_id:
                structure["it_automation_structure"] = {
                    "drive_id": it_drive_id,
                    "drive_name": "IT_Automation",
                    "folders": _list_drive_folders(google_drive_service, it_drive_id, max_depth=3)
                }
        except Exception as e:
            structure["it_automation_error"] = str(e)
        
        # Get Sales_CSR structure
        try:
            sales_csr_drive_id = google_drive_service.find_shared_drive("Sales_CSR")
            if sales_csr_drive_id:
                structure["sales_csr_structure"] = {
                    "drive_id": sales_csr_drive_id,
                    "drive_name": "Sales_CSR",
                    "folders": _list_drive_folders(google_drive_service, sales_csr_drive_id, max_depth=4)
                }
                
                # Try to find Customer Orders folder
                customer_orders_id = google_drive_service.find_folder_by_path(sales_csr_drive_id, "Customer Orders")
                if customer_orders_id:
                    structure["customer_orders_structure"] = {
                        "folder_id": customer_orders_id,
                        "folder_name": "Customer Orders",
                        "subfolders": _list_folder_contents_recursive(google_drive_service, customer_orders_id, sales_csr_drive_id, max_depth=3)
                    }
                    
                    # Try to find the sales orders path
                    path_within_drive = "Customer Orders/Sales Orders"
                    folder_id = google_drive_service.find_folder_by_path(sales_csr_drive_id, path_within_drive)
                    if folder_id:
                        structure["sales_csr_search_results"] = {
                            "path": path_within_drive,
                            "found": True,
                            "folder_id": folder_id,
                            "subfolders": _list_folder_contents_recursive(google_drive_service, folder_id, sales_csr_drive_id, max_depth=3)
                        }
                    else:
                        structure["sales_csr_search_results"] = {
                            "path": path_within_drive,
                            "found": False,
                            "message": "Path not found"
                        }
                else:
                    structure["customer_orders_structure"] = {
                        "found": False,
                        "message": "Customer Orders folder not found"
                    }
            else:
                structure["sales_csr_structure"] = {
                    "drive_id": None,
                    "message": "Sales_CSR not found as shared drive"
                }
        except Exception as e:
            structure["sales_csr_error"] = str(e)
        
        return jsonify(structure)
    except Exception as e:
        import traceback
        return jsonify({
            "error": str(e),
            "trace": traceback.format_exc()
        }), 500

def _list_drive_folders(service, drive_id, parent_id=None, depth=0, max_depth=3):
    """Recursively list folders in a drive"""
    if depth > max_depth:
        return []
    
    try:
        if parent_id is None:
            parent_id = drive_id
        
        query = f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.service.files().list(
            q=query,
            corpora='drive',
            driveId=drive_id,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            fields="files(id, name)",
            pageSize=50
        ).execute()
        
        folders = []
        for folder in results.get('files', []):
            folder_info = {
                "name": folder.get('name'),
                "id": folder.get('id'),
                "depth": depth
            }
            if depth < max_depth:
                folder_info["children"] = _list_drive_folders(service, drive_id, folder.get('id'), depth + 1, max_depth)
            folders.append(folder_info)
        
        return folders
    except Exception as e:
        return [{"error": str(e)}]

def _list_folder_contents_recursive(service, folder_id, drive_id, depth=0, max_depth=3):
    """Recursively list all folders and their contents with file counts"""
    if depth > max_depth:
        return []
    
    try:
        # Get all subfolders
        query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.service.files().list(
            q=query,
            corpora='drive',
            driveId=drive_id,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            fields="files(id, name)",
            pageSize=100
        ).execute()
        
        folders = []
        for folder in results.get('files', []):
            subfolder_id = folder.get('id')
            subfolder_name = folder.get('name')
            
            # Count PDF/DOCX files in this folder
            file_query = f"'{subfolder_id}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or name contains '.pdf' or name contains '.docx') and trashed=false"
            file_results = service.service.files().list(
                q=file_query,
                corpora='drive',
                driveId=drive_id,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                fields="files(id, name)",
                pageSize=100
            ).execute()
            file_count = len(file_results.get('files', []))
            
            folder_info = {
                "name": subfolder_name,
                "id": subfolder_id,
                "depth": depth,
                "file_count": file_count
            }
            
            # Recursively get children
            if depth < max_depth:
                children = _list_folder_contents_recursive(service, subfolder_id, drive_id, depth + 1, max_depth)
                folder_info["children"] = children
                folder_info["total_file_count"] = file_count + sum(c.get("total_file_count", 0) for c in children)
            else:
                folder_info["total_file_count"] = file_count
            
            folders.append(folder_info)
        return folders
    except Exception as e:
        return [{"error": str(e), "depth": depth}]

@app.route('/api/test-data-access', methods=['GET'])
def test_data_access():
    """Test endpoint to confirm data access and search functionality"""
    try:
        latest_folder, error = get_latest_folder()
        if error:
            return jsonify({"error": f"Cannot access data: {error}"}), 500
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        
        # Load current data
        raw_data = {}
        json_files = glob.glob(os.path.join(folder_path, "*.json"))
        
        for json_file in json_files:
            file_name = os.path.basename(json_file)
            file_data = load_json_file(json_file)
            raw_data[file_name] = file_data
        
        # Test SAE search specifically - CHECK ALL FILES WITH SAFE TYPE CHECKING
        sae_items = []
        for file_name, file_data in raw_data.items():
            # SAFE TYPE CHECK - Only process lists
            if isinstance(file_data, list) and len(file_data) > 0:
                for item in file_data:
                    if isinstance(item, dict):
                        # Check all possible item number fields
                        for field in ['Item No.', 'Item No', 'ItemNo', 'Item_No', 'item_no', 'ITEM_NO']:
                            item_no = item.get(field, '')
                            if isinstance(item_no, str) and item_no.lower().startswith('sae'):
                                sae_items.append({
                                    'File': file_name,
                                    'Item No.': item_no,
                                    'Description': item.get('Description', item.get('description', '')),
                                    'Raw Item': item  # Show the full record
                                })
                                break
        
        return jsonify({
            "data_access": True,
            "total_items": len(raw_data.get('CustomAlert5.json', [])),
            "available_files": list(raw_data.keys()),
            "sae_search_test": {
                "search_term": "sae",
                "items_found": len(sae_items),
                "sample_items": sae_items[:5]  # Show first 5 SAE items
            },
            "folder_info": {
                "folder": latest_folder,
                "path": folder_path,
                "json_files": len([f for f in raw_data.keys() if f.endswith('.json')])
            }
        })
        
    except Exception as e:
        print(f"ERROR: Error in test data access: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/enterprise_analytics', methods=['POST'])
def enterprise_analytics():
    """Generate fast enterprise-level analytics and insights"""
    try:
        print("🏢 Generating Enterprise Analytics...")
        
        # Get the latest data
        latest_folder, error = get_latest_folder()
        if error:
            return jsonify({"error": f"Cannot access data: {error}"}), 500
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        
        # Load all data sources
        raw_data = {}
        json_files = glob.glob(os.path.join(folder_path, "*.json"))
        
        for json_file in json_files:
            file_name = os.path.basename(json_file)
            file_data = load_json_file(json_file)
            raw_data[file_name] = file_data
        
        # Load Sales Orders data - ONLY active folders (In Production, New and Revised)
        # NO Cancelled/Closed for analytics
        print("📋 Loading Sales Orders for analytics (active folders only)...")
        so_filter_folders = ['In Production', 'New and Revised']
        sales_orders_data = load_sales_orders(filter_folders=so_filter_folders)
        if sales_orders_data:
            raw_data.update(sales_orders_data)
        
        # SMART SO LOADING: Use existing cache system for ultra-fast performance
        print("SMART SO LOADING: Checking cache system...")
        
        global cached_pdf_data, pdf_cache_time
        
        # First try to load from existing cache (much faster than processing 1,353 PDFs)
        cached_so_data = load_cached_so_data()
        if cached_so_data and 'ParsedSalesOrders.json' in cached_so_data:
            cached_sos = cached_so_data['ParsedSalesOrders.json']
            if len(cached_sos) > 1000:  # We have substantial cached data (1,353 SOs)
                raw_data['RealSalesOrders'] = cached_sos
                print(f"⚡ CACHE HIT: Using {len(cached_sos)} cached SOs (ultra-fast)")
            else:
                print("📥 Cache exists but limited, loading fresh data...")
                current_time = time.time()
                
                if 'cached_pdf_data' not in globals() or 'pdf_cache_time' not in globals() or (current_time - pdf_cache_time) > 300:
                    cached_pdf_data = load_real_so_data()
                    pdf_cache_time = current_time
                
                if cached_pdf_data:
                    raw_data['RealSalesOrders'] = cached_pdf_data
        else:
            print("📥 No cache found, loading fresh data...")
            current_time = time.time()
            
            if 'cached_pdf_data' not in globals() or 'pdf_cache_time' not in globals() or (current_time - pdf_cache_time) > 300:
                cached_pdf_data = load_real_so_data()
                pdf_cache_time = current_time
            
            if cached_pdf_data:
                raw_data['RealSalesOrders'] = cached_pdf_data
        
        # Initialize analytics engine
        if not ENTERPRISE_ANALYTICS_AVAILABLE or EnterpriseAnalytics is None:
            return jsonify({"error": "Enterprise Analytics not available"}), 503
        analytics_engine = EnterpriseAnalytics()
        
        # Generate comprehensive analytics
        dashboard = analytics_engine.generate_executive_dashboard(raw_data)
        
        print(f"SUCCESS: Generated enterprise analytics with {len(dashboard)} sections")
        
        return jsonify({
            "status": "success",
            "analytics": dashboard,
            "timestamp": datetime.now().isoformat(),
            "data_sources": list(raw_data.keys())
        })
        
    except Exception as e:
        print(f"ERROR: Error generating enterprise analytics: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/enterprise_analytics_ai', methods=['POST'])
def enterprise_analytics_ai():
    """Generate AI-enhanced enterprise analytics (optional, slower)"""
    try:
        print("🤖 Generating AI-Enhanced Enterprise Analytics...")
        
        # Get the latest data
        latest_folder, error = get_latest_folder()
        if error:
            return jsonify({"error": f"Cannot access data: {error}"}), 500
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        
        # Load all data sources
        raw_data = {}
        json_files = glob.glob(os.path.join(folder_path, "*.json"))
        
        for json_file in json_files:
            file_name = os.path.basename(json_file)
            file_data = load_json_file(json_file)
            raw_data[file_name] = file_data
        
        # Load Sales Orders data - ONLY active folders (In Production, New and Revised)
        # NO Cancelled/Closed for AI analytics
        print("📋 Loading Sales Orders for AI analytics (active folders only)...")
        so_filter_folders = ['In Production', 'New and Revised']
        sales_orders_data = load_sales_orders(filter_folders=so_filter_folders)
        if sales_orders_data:
            raw_data.update(sales_orders_data)
        
        # Load real SO data from PDFs
        global cached_pdf_data, pdf_cache_time
        current_time = time.time()
        
        if 'cached_pdf_data' not in globals() or 'pdf_cache_time' not in globals() or (current_time - pdf_cache_time) > 300:
            cached_pdf_data = load_real_so_data()
            pdf_cache_time = current_time
        
        if cached_pdf_data:
            raw_data['RealSalesOrders'] = cached_pdf_data
        
        # Initialize analytics engine
        if not ENTERPRISE_ANALYTICS_AVAILABLE or EnterpriseAnalytics is None:
            return jsonify({"error": "Enterprise Analytics not available"}), 503
        analytics_engine = EnterpriseAnalytics()
        
        # Generate fast analytics first
        dashboard = analytics_engine.generate_executive_dashboard(raw_data)
        
        # Add GPT-4o insights
        sales_data = raw_data.get('RealSalesOrders', [])
        inventory_data = raw_data.get('CustomAlert5.json', [])
        gpt_insights = analytics_engine.generate_gpt4o_insights(sales_data, inventory_data)
        
        dashboard['ai_enhanced_insights'] = gpt_insights
        
        print(f"SUCCESS: Generated AI-enhanced enterprise analytics")
        
        return jsonify({
            "status": "success",
            "analytics": dashboard,
            "timestamp": datetime.now().isoformat(),
            "data_sources": list(raw_data.keys()),
            "processing_type": "AI-Enhanced (GPT-4o)"
        })
        
    except Exception as e:
        print(f"ERROR: Error generating AI-enhanced enterprise analytics: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai/so-question', methods=['POST'])
def ai_so_question():
    """AI-powered Sales Order question answering"""
    try:
        if not openai_available or not client:
            return jsonify({
                'success': False,
                'error': 'OpenAI service not available'
            }), 503
        
        data = request.get_json()
        question = data.get('question', '')
        so_data = data.get('soData', [])
        conversation_history = data.get('conversationHistory', [])
        
        if not question:
            return jsonify({
                'success': False,
                'error': 'Question is required'
            }), 400
        
        # Prepare context from SO data
        context = "Sales Order Data:\n"
        for i, so in enumerate(so_data):
            context += f"\n--- Order {i+1} ---\n"
            context += f"Order Number: {so.get('orderNumber', 'N/A')}\n"
            context += f"Customer: {so.get('customerName', 'N/A')}\n"
            context += f"Order Date: {so.get('orderDate', 'N/A')}\n"
            context += f"Due Date: {so.get('dueDate', 'N/A')}\n"
            context += f"Total Amount: {so.get('totalAmount', 'N/A')}\n"
            context += f"Status: {so.get('status', 'N/A')}\n"
            if so.get('items'):
                context += "Items:\n"
                for item in so['items']:
                    context += f"  - {item.get('itemNumber', 'N/A')}: {item.get('description', 'N/A')} (Qty: {item.get('quantity', 'N/A')})\n"
            context += f"Raw Text: {so.get('rawText', '')[:500]}...\n"
        
        # Prepare conversation history
        history_context = ""
        if conversation_history:
            history_context = "\n\nPrevious conversation:\n"
            for msg in conversation_history[-3:]:  # Last 3 messages
                history_context += f"{msg['type']}: {msg['content']}\n"
        
        # Create the prompt
        prompt = f"""You are an AI assistant specialized in analyzing Sales Order data. 
        You have access to detailed Sales Order information including order numbers, customers, dates, amounts, items, and full text content.
        
        {context}
        
        {history_context}
        
        Question: {question}
        
        Please provide a helpful, accurate answer based on the Sales Order data provided. 
        If you need to reference specific orders, mention their order numbers.
        If the data doesn't contain enough information to answer the question, say so clearly.
        Be specific and cite relevant details from the data when possible.
        
        Answer:"""
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant that analyzes Sales Order data to answer business questions. Provide accurate, specific answers based on the data provided."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        answer = response.choices[0].message.content
        
        # Extract sources (order numbers mentioned in the answer)
        sources = []
        for so in so_data:
            if so.get('orderNumber') and so['orderNumber'] in answer:
                sources.append(f"SO-{so['orderNumber']}")
        
        return jsonify({
            'success': True,
            'answer': answer,
            'sources': sources
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error processing AI question: {str(e)}'
        }), 500

@app.route('/api/smart-so-search', methods=['POST'])
def smart_so_search_endpoint():
    """Smart Sales Order search endpoint"""
    try:
        if not openai_available or not client:
            return jsonify({
                'success': False,
                'error': 'OpenAI not available'
            }), 503
        
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({
                'success': False,
                'error': 'Query is required'
            }), 400
        
        from smart_so_search import get_smart_search
        smart_search = get_smart_search(client)
        result = smart_search.smart_so_search(query)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Smart search failed: {str(e)}'
        }), 500

@app.route('/api/vision-analyze-so', methods=['POST'])
def vision_analyze_so():
    """GPT-4 Vision analysis of Sales Order files"""
    try:
        if not openai_available or not client:
            return jsonify({
                'success': False,
                'error': 'OpenAI not available'
            }), 503
        
        data = request.get_json()
        so_number = data.get('so_number', '')
        
        if not so_number:
            return jsonify({
                'success': False,
                'error': 'SO number is required'
            }), 400
        
        from smart_so_search import get_smart_search
        smart_search = get_smart_search(client)
        
        # Find the SO file
        found_files = smart_search.find_so_files_by_number(so_number)
        
        if not found_files:
            return jsonify({
                'success': False,
                'error': f'No files found for SO {so_number}'
            }), 404
        
        # Analyze the first found file with Vision
        file_path = found_files[0][0]
        vision_result = smart_search.analyze_so_with_vision(file_path)
        
        return jsonify(vision_result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Vision analysis failed: {str(e)}'
        }), 500


# ========================================
# EMAIL ASSISTANT API ROUTES
# ========================================

@app.route('/api/email/status', methods=['GET'])
def email_status():
    """Get Gmail connection status"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'connected': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        return jsonify(gmail_service.get_status())
    except Exception as e:
        return jsonify({
            'connected': False,
            'error': str(e)
        }), 500

@app.route('/api/email/auth/start', methods=['GET'])
def email_auth_start():
    """Start Gmail OAuth flow"""
    print("\n🔑 ===== GMAIL AUTH START REQUEST =====")
    
    if not GMAIL_SERVICE_AVAILABLE:
        print("❌ Gmail service not available")
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        print("📡 Getting Gmail service instance...")
        gmail_service = get_gmail_service()
        print("✅ Gmail service obtained")
        
        print("🚀 Starting OAuth flow...")
        result = gmail_service.start_oauth_flow()
        print(f"✅ OAuth flow started: {result.get('success', False)}")
        print("🔑 ===== AUTH START COMPLETE =====\n")
        
        return jsonify(result)
    except Exception as e:
        print(f"❌ Error in auth start: {e}")
        import traceback
        traceback.print_exc()
        print("🔑 ===== AUTH START FAILED =====\n")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/auth/submit-code', methods=['POST'])
def email_auth_submit_code():
    """Handle Gmail OAuth code submission from user"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        data = request.get_json()
        code = data.get('code')
        
        if not code:
            return jsonify({
                'success': False,
                'error': 'Authorization code is required'
            }), 400
        
        gmail_service = get_gmail_service()
        result = gmail_service.handle_oauth_code(code)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/auth/logout', methods=['POST'])
def email_auth_logout():
    """Logout from Gmail"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        result = gmail_service.logout()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/inbox', methods=['GET'])
def email_inbox():
    """Fetch inbox emails with intelligent caching"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        max_results = request.args.get('max', 1000, type=int)
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        
        result = gmail_service.fetch_inbox(max_results=max_results, force_refresh=force_refresh)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/clear-cache', methods=['POST'])
def clear_email_cache():
    """Clear all email caches for dev mode"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        gmail_service._clear_all_caches()
        return jsonify({
            'success': True,
            'message': 'All caches cleared successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/thread/<thread_id>', methods=['GET'])
def email_thread(thread_id):
    """Fetch full email thread/conversation"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        result = gmail_service.fetch_thread(thread_id)
        return jsonify(result)
    except Exception as e:
        print(f"❌ Error fetching thread: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/analyze-style', methods=['POST'])
def email_analyze_style():
    """Analyze user's writing style from sent emails"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        # Handle both JSON and empty body
        try:
            data = request.get_json(silent=True) or {}
        except:
            data = {}
        max_emails = data.get('maxEmails', 250)
        
        print(f"📧 Starting writing style analysis (max {max_emails} emails)...")
        result = gmail_service.analyze_writing_style(max_emails=max_emails)
        return jsonify(result)
    except Exception as e:
        print(f"❌ Error in analyze_writing_style endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/generate-response', methods=['POST'])
def email_generate_response():
    """Generate AI response to an email"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        # Handle JSON parsing gracefully
        try:
            data = request.get_json(silent=True) or {}
        except:
            return jsonify({
                'success': False,
                'error': 'Invalid JSON in request body'
            }), 400
        
        email_id = data.get('emailId')
        from_email = data.get('from')
        subject = data.get('subject')
        snippet = data.get('snippet')
        
        if not email_id:
            return jsonify({
                'success': False,
                'error': 'Email ID is required'
            }), 400
        
        print(f"✍️ Generating response for email: {subject[:50] if subject else email_id}")
        result = gmail_service.generate_response(
            email_id=email_id,
            from_email=from_email,
            subject=subject,
            snippet=snippet
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/download-attachment', methods=['POST'])
def email_download_attachment():
    """Download email attachment"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        data = request.get_json()
        
        email_id = data.get('emailId')
        attachment_id = data.get('attachmentId')
        filename = data.get('filename')
        
        if not all([email_id, attachment_id, filename]):
            return jsonify({
                'success': False,
                'error': 'Email ID, attachment ID, and filename are required'
            }), 400
        
        result = gmail_service.download_attachment(email_id, attachment_id, filename)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/analyze-customer-po', methods=['POST'])
def email_analyze_customer_po():
    """Analyze customer PO from email attachment and check stock"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        data = request.get_json()
        
        email_id = data.get('emailId')
        attachment_id = data.get('attachmentId')
        filename = data.get('filename')
        
        if not all([email_id, attachment_id, filename]):
            return jsonify({
                'success': False,
                'error': 'Email ID, attachment ID, and filename are required'
            }), 400
        
        print(f"\n📧 ===  ANALYZING CUSTOMER PO: {filename} ===")
        
        # Step 1: Download attachment
        print("  Step 1: Downloading attachment...")
        download_result = gmail_service.download_attachment(email_id, attachment_id, filename)
        if not download_result['success']:
            return jsonify(download_result), 400
        
        pdf_path = download_result['file_path']
        print(f"  ✅ Downloaded to: {pdf_path}")
        
        # Step 2: Parse customer PO
        print("  Step 2: Parsing customer PO...")
        parse_result = gmail_service.parse_customer_po(pdf_path)
        if not parse_result['success']:
            return jsonify(parse_result), 400
        
        po_data = parse_result['po_data']
        print(f"  ✅ Parsed PO #{po_data.get('po_number', 'Unknown')}")
        print(f"     Items: {len(po_data.get('items', []))}")
        
        # Step 3: Get inventory data from cache or load fresh
        print("  Step 3: Loading inventory data...")
        latest_folder, error = get_latest_folder()
        if error:
            return jsonify({
                'success': False,
                'error': f'Cannot access inventory data: {error}'
            }), 500
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        
        # Load only CustomAlert5 inventory file (primary source)
        inventory_data = {}
        try:
            ca5_path = os.path.join(folder_path, 'CustomAlert5.json')
            if os.path.exists(ca5_path):
                with open(ca5_path, 'r', encoding='utf-8') as f:
                    inventory_data['CustomAlert5.json'] = json.load(f)
                    print(f"  ✅ Loaded inventory data")
                    print(f"     CustomAlert5 records: {len(inventory_data['CustomAlert5.json'])}")
            else:
                print(f"  ⚠️ CustomAlert5.json not found!")
                inventory_data = {'CustomAlert5.json': []}
        except Exception as e:
            print(f"  ⚠️ Error loading inventory: {e}")
            inventory_data = {'CustomAlert5.json': []}
        
        # Step 4: Check stock
        print("  Step 4: Checking stock availability...")
        stock_result = gmail_service.check_stock_for_po(po_data, inventory_data)
        if not stock_result['success']:
            return jsonify(stock_result), 400
        
        print(f"  ✅ Stock check complete")
        print(f"     All items available: {stock_result['all_items_available']}")
        print(f"     Items with shortfall: {stock_result['insufficient_items']}")
        
        print(f"📧 === ANALYSIS COMPLETE ===\n")
        
        return jsonify({
            'success': True,
            'po_data': po_data,
            'stock_check': stock_result,
            'file_path': pdf_path
        })
    except Exception as e:
        print(f"❌ Error analyzing customer PO: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/email/auto-draft-po-response', methods=['POST'])
def email_auto_draft_po_response():
    """Auto-draft intelligent response based on PO analysis"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        data = request.get_json()
        
        po_data = data.get('po_data')
        stock_check = data.get('stock_check')
        customer_email = data.get('from_email', '')
        
        if not po_data or not stock_check:
            return jsonify({
                'success': False,
                'error': 'PO data and stock check results are required'
            }), 400
        
        # Build context for AI response
        if stock_check['all_items_available']:
            scenario = "all_items_available"
            context = f"""Customer PO #{po_data.get('po_number', 'Unknown')} - ALL ITEMS IN STOCK

Items requested: {len(po_data.get('items', []))}
All items are available in stock and ready to ship.

Stock details:
{chr(10).join([f"- {item['item_no']}: Need {item['qty_needed']}, Have {item['stock_available']}" for item in stock_check['stock_analysis']])}

Draft a professional response confirming we have everything in stock and can ship promptly."""
        else:
            scenario = "partial_or_no_stock"
            available_count = stock_check['available_items']
            shortfall_count = stock_check['insufficient_items']
            
            context = f"""Customer PO #{po_data.get('po_number', 'Unknown')} - STOCK SHORTFALL

Total items: {stock_check['total_items']}
Available: {available_count}
Short: {shortfall_count}

Items we HAVE:
{chr(10).join([f"- {item['item_no']}: Need {item['qty_needed']}, Have {item['stock_available']} ✅" for item in stock_check['stock_analysis'] if item['sufficient']])}

Items we need to ORDER:
{chr(10).join([f"- {item['item_no']}: Need {item['qty_needed']}, Have {item['stock_available']}, Short {item['shortfall']} ❌" for item in stock_check['insufficient_details']])}

Draft a professional response explaining:
1. Which items we have in stock (can ship now)
2. Which items we need to order (mention lead time is needed)
3. Ask if they want partial shipment or wait for complete order"""
        
        # Generate response using writing style
        if not gmail_service.writing_style_profile:
            # No writing style analyzed yet, use professional default
            prompt = f"""{context}

Write a professional business email response. Be clear, concise, and helpful."""
        else:
            # Use learned writing style
            style_profile = gmail_service.writing_style_profile.get('profile', '')
            prompt = f"""{context}

Using this writing style profile:
{style_profile}

Write a response that matches this style."""
        
        response = gmail_service.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are an email assistant writing on behalf of a user. Match their writing style and be professional but personable."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        draft_body = response.choices[0].message.content
        
        # Generate subject
        subject = f"Re: PO {po_data.get('po_number', 'Your Order')}"
        
        return jsonify({
            'success': True,
            'draft': {
                'subject': subject,
                'body': draft_body,
                'confidence': 0.9 if gmail_service.writing_style_profile else 0.7,
                'reasoning': f'Stock check: {scenario}',
                'scenario': scenario,
                'stock_summary': {
                    'all_available': stock_check['all_items_available'],
                    'needs_pr': stock_check['needs_pr'],
                    'total_items': stock_check['total_items'],
                    'available_items': stock_check['available_items'],
                    'insufficient_items': stock_check['insufficient_items']
                }
            }
        })
    except Exception as e:
        print(f"❌ Error auto-drafting response: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========================================
# AI EMAIL ASSISTANT API ROUTES
# ========================================

@app.route('/api/ai/generate-email', methods=['POST'])
def generate_ai_email():
    """
    Generate an AI-powered email reply using OpenAI
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400

        # Extract parameters
        prompt = data.get('prompt', '')
        system_prompt = data.get('system_prompt', '')
        writing_style = data.get('writing_style', '')
        user_name = data.get('user_name', 'User')

        if not prompt:
            return jsonify({
                'success': False,
                'error': 'Prompt is required'
            }), 400

        # Check if OpenAI is available
        try:
            import openai
            if not os.getenv('OPENAI_API_KEY'):
                return jsonify({
                    'success': False,
                    'error': 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
                }), 500
        except ImportError:
            return jsonify({
                'success': False,
                'error': 'OpenAI library not installed. Run: pip install openai'
            }), 500

        # Generate the email reply using OpenAI - NEW API v1.0.0+
        from openai import OpenAI
        
        client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        # Create the full prompt with context
        full_prompt = f"""
System: {system_prompt}

User's Writing Style Analysis:
{writing_style}

User Request: {prompt}

Please generate a professional email reply that matches the user's writing style.
The email should be appropriate for the context and maintain the user's voice and tone.
"""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_prompt}
            ],
            max_tokens=500,
            temperature=0.7,
            presence_penalty=0.1,
            frequency_penalty=0.1
        )

        reply = response.choices[0].message.content.strip()

        return jsonify({
            'success': True,
            'reply': reply,
            'model': 'gpt-3.5-turbo',
            'tokens_used': len(reply.split())  # Rough estimate
        })

    except Exception as e:
        print(f"Error generating AI email: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to generate email: {str(e)}'
        }), 500

@app.route('/api/ai/learn-from-sent', methods=['POST'])
def ai_learn_from_sent():
    """
    Learn from sent emails - AI endpoint that matches frontend expectation
    """
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Gmail service not available'
        }), 503
    
    try:
        gmail_service = get_gmail_service()
        # Handle both JSON and empty body
        try:
            data = request.get_json(silent=True) or {}
        except:
            data = {}
        max_emails = data.get('maxEmails', 250)
        
        print(f"🧠 AI Learning from sent emails (max {max_emails} emails)...")
        result = gmail_service.analyze_writing_style(max_emails=max_emails)
        
        # Return in the format expected by frontend
        if result.get('success'):
            return jsonify({
                'success': True,
                'emailsAnalyzed': result.get('emailsAnalyzed', 0),
                'writingStyle': result.get('writingStyle', ''),
                'message': 'Successfully learned from sent emails!'
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Unknown error occurred')
            })
            
    except Exception as e:
        print(f"❌ Error in AI learn-from-sent endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/debug-gmail', methods=['GET'])
def debug_gmail():
    """Debug Gmail API to see what's available"""
    if not GMAIL_SERVICE_AVAILABLE:
        return jsonify({'error': 'Gmail service not available'}), 503
    
    try:
        gmail_service = get_gmail_service()
        service = gmail_service.service
        
        if not service:
            return jsonify({'error': 'Gmail not connected'}), 400
        
        # Get all labels
        labels = service.users().labels().list(userId='me').execute()
        label_names = [label['name'] for label in labels.get('labels', [])]
        
        # Try to get sent emails
        sent_results = service.users().messages().list(
            userId='me',
            labelIds=['SENT'],
            maxResults=10
        ).execute()
        
        # Try to get all messages
        all_results = service.users().messages().list(
            userId='me',
            maxResults=10
        ).execute()
        
        return jsonify({
            'labels': label_names,
            'sent_messages_count': len(sent_results.get('messages', [])),
            'all_messages_count': len(all_results.get('messages', [])),
            'sent_results': sent_results,
            'all_results': all_results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/health', methods=['GET'])
def ai_health_check():
    """
    AI service health check
    """
    try:
        import openai
        openai_available = bool(os.getenv('OPENAI_API_KEY'))
    except ImportError:
        openai_available = False
    
    return jsonify({
        'status': 'healthy',
        'openai_available': openai_available,
        'service': 'AI Email Assistant'
    })

# ========================================
# END EMAIL ASSISTANT API ROUTES
# ========================================

def preload_backend_data():
    """Preload all backend data on startup so it's ready when user logs in"""
    global _data_cache, _cache_timestamp
    
    print("\n" + "="*60)
    print("🔄 PRELOADING BACKEND DATA ON STARTUP")
    print("="*60 + "\n")
    
    try:
        # Check if Google Drive API is enabled
        if USE_GOOGLE_DRIVE_API and google_drive_service:
            print("📡 Using Google Drive API for data...")
            try:
                # Use incremental sync for faster preload
                cached_file_times = {}
                try:
                    ensure_cache_dir()
                    if os.path.exists(CACHE_METADATA_FILE):
                        with open(CACHE_METADATA_FILE, 'r') as f:
                            metadata = json.load(f)
                            cached_file_times = metadata.get('file_times', {})
                        print(f"✅ Loaded {len(cached_file_times)} file times from disk for incremental sync")
                except Exception as e:
                    print(f"⚠️ Failed to load cache metadata for incremental sync: {e}")
                
                # Use incremental sync to only download changed files
                data, folder_info, new_file_times = google_drive_service.get_all_data_incremental(cached_file_times)
                
                if data and isinstance(data, dict) and len(data) > 0:
                    # Load Sales Orders from important folders - WITH TIMEOUT
                    print("📦 LOADING: Sales Orders (In Production, New and Revised) for preload...")
                    so_filter_folders = ['In Production', 'New and Revised']
                    
                    # Set empty defaults first
                    data['SalesOrders.json'] = []
                    data['SalesOrdersByStatus'] = {}
                    data['TotalOrders'] = 0
                    data['StatusFolders'] = []
                    
                    try:
                        import threading
                        
                        # Use threading with timeout to prevent blocking
                        sales_data_result = [None]
                        sales_data_error = [None]
                        
                        def load_sales_orders_thread():
                            try:
                                if google_drive_service and google_drive_service.authenticated:
                                    print("[INFO] Using Google Drive API for Sales Orders (preload)")
                                    sales_data_result[0] = google_drive_service.load_sales_orders_data(None, filter_folders=so_filter_folders)
                            except Exception as e:
                                sales_data_error[0] = e
                        
                        # Start loading in thread with 30 second timeout
                        thread = threading.Thread(target=load_sales_orders_thread, daemon=True)
                        thread.start()
                        thread.join(timeout=30)  # 30 second max wait
                        
                        if thread.is_alive():
                            print("⚠️ Sales Orders preload timed out after 30s - will load on first request")
                        elif sales_data_error[0]:
                            print(f"⚠️ Error loading Sales Orders during preload: {sales_data_error[0]}")
                        elif sales_data_result[0]:
                            sales_data = sales_data_result[0]
                            # Add Sales Orders to data
                            data['SalesOrders.json'] = sales_data.get('SalesOrders.json', [])
                            data['SalesOrdersByStatus'] = sales_data.get('SalesOrdersByStatus', {})
                            data['TotalOrders'] = sales_data.get('TotalOrders', 0)
                            data['StatusFolders'] = sales_data.get('StatusFolders', [])
                            data['ScanMethod'] = sales_data.get('ScanMethod', 'Google Drive API')
                            
                            print(f"✅ Preloaded {data['TotalOrders']} Sales Orders from {len(data['SalesOrdersByStatus'])} folders")
                    except Exception as e:
                        print(f"⚠️ Error in Sales Orders preload thread: {e}")
                    
                    # Save new file times for next incremental sync
                    try:
                        ensure_cache_dir()
                        with open(CACHE_METADATA_FILE, 'w') as f:
                            json.dump({'file_times': new_file_times}, f)
                        print(f"💾 Saved {len(new_file_times)} file times to disk for next incremental sync")
                    except Exception as e:
                        print(f"⚠️ Failed to save cache metadata to disk: {e}")
                    
                    # Cache the data
                    if should_cache_data(data):
                        _data_cache = data
                        _cache_timestamp = time.time()
                        save_cache_to_disk(data, folder_info)  # Save to disk for persistence
                        cache_size_mb = estimate_data_size_mb(data)
                        print(f"✅ Preloaded {len(data)} data files from Google Drive API ({cache_size_mb:.1f}MB)")
                        print("✅ Backend data preloaded - ready for users!")
                        return True
                    else:
                        print("⚠️ Data too large to cache during preload")
                        return False
            except Exception as e:
                print(f"⚠️ Google Drive API preload failed: {e}")
                import traceback
                traceback.print_exc()
                print("   Backend will load data on first request")
        
        # Check if local G: Drive is accessible
        if not os.path.exists(GDRIVE_BASE):
            print(f"⚠️ G: Drive not accessible: {GDRIVE_BASE}")
            print("   Backend will load data on first request")
            return False
        
        # Get latest folder
        latest_folder, error = get_latest_folder()
        if error:
            print(f"❌ Error getting latest folder: {error}")
            return False
        
        folder_path = os.path.join(GDRIVE_BASE, latest_folder)
        print(f"📂 Loading data from: {latest_folder}")
        
        # Don't preload MiSys data - let it load on first request
        print(f"   ⏭️ Skipping preload (data will load on first request)")
        return False  # Don't cache empty data
        
        # Scan Sales Orders metadata (FAST - always fresh)
        print("📦 Scanning Sales Orders...")
        sales_orders_base = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
        if os.path.exists(sales_orders_base):
            metadata_list = []
            folder_counts = {}
            
            for root, dirs, files in os.walk(sales_orders_base):
                folder_name = os.path.basename(root) or "Root"
                for file in files:
                    if file.lower().endswith('.pdf') and 'salesorder_' in file.lower():
                        file_path = os.path.join(root, file)
                        so_number = file.replace('salesorder_', '').replace('SalesOrder_', '').replace('.pdf', '').replace('.PDF', '')
                        file_stat = os.stat(file_path)
                        
                        metadata_list.append({
                            'SalesOrderNumber': so_number,
                            'Title': f"SO {so_number}",
                            'FileName': file,
                            'FilePath': file_path,
                            'Folder': folder_name,
                            'ModifiedDate': datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                            'Status': folder_name
                        })
                        folder_counts[folder_name] = folder_counts.get(folder_name, 0) + 1
            
            raw_data['SalesOrders.json'] = metadata_list
            raw_data['TotalOrders'] = len(metadata_list)
            raw_data['SalesOrdersByStatus'] = folder_counts
            print(f"   ✓ {len(metadata_list)} SOs")
        else:
            raw_data['SalesOrders.json'] = []
            raw_data['TotalOrders'] = 0
            raw_data['SalesOrdersByStatus'] = {}
        
        # Skip MPS data - load on-demand
        print("⏭️ Skipping MPS data (load on-demand)")
        raw_data['MPS.json'] = {"mps_orders": [], "summary": {"total_orders": 0}}
        
        # Cache the data
        if should_cache_data(raw_data):
            _data_cache = raw_data
            _cache_timestamp = time.time()
            save_cache_to_disk(raw_data, None)  # Save to disk for persistence
            cache_size_mb = estimate_data_size_mb(raw_data)
            print(f"\n💾 Data cached: {cache_size_mb:.1f}MB")
            print("✅ Backend data preloaded - ready for users!")
            return True
        else:
            print("⚠️ Data too large to cache")
            return False
            
    except Exception as e:
        print(f"❌ Preload error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        print("\n" + "="*60 + "\n")

if __name__ == '__main__':
    print("Starting Flask backend...")
    print(f"G: Drive path: {GDRIVE_BASE}")
    
    # Print Gmail service status
    if GMAIL_SERVICE_AVAILABLE:
        print("✅ Gmail Email Assistant service loaded")
    else:
        print("❌ Gmail Email Assistant service not available")
    
    # PRELOAD DATA BEFORE STARTING SERVER
    # Enabled: Preloads data on startup so first user request is fast
    print("🔄 Preloading backend data on startup...")
    
    # Clear any corrupted cache files first
    clear_corrupted_cache()
    
    # Preload data
    preload_backend_data()
    
    # Get port from environment variable (for deployment) or use default
    port = int(os.environ.get('PORT', 5002))
    host = os.environ.get('HOST', '0.0.0.0')  # Use 0.0.0.0 for deployment
    
    # Detect environment
    is_cloud_run = os.getenv('K_SERVICE') is not None
    is_vercel = os.getenv('VERCEL') == '1'
    
    if is_cloud_run:
        print(f"🚀 Flask server starting on Cloud Run - {host}:{port}...")
    elif is_vercel:
        print(f"🚀 Flask server starting on Vercel - {host}:{port}...")
    else:
        print(f"🚀 Flask server starting locally - {host}:{port}...")
    
    app.run(host=host, port=port, debug=False)
