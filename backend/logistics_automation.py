# Logistics Automation Module - REAL DATA VERSION with GPT-4o
from flask import Blueprint, request, jsonify, send_file
import re
import os
import json
from datetime import datetime
import traceback

def generate_document_filename(doc_type: str, so_data: dict, file_ext: str = '.html') -> str:
    """
    Generate consistent filename format: "DOC_TYPE SO# | PO# | Date"
    
    Args:
        doc_type: Document type (e.g., "BOL", "PackingSlip", "CommercialInvoice")
        so_data: Sales order data dictionary
        file_ext: File extension (default: '.html')
    
    Returns:
        Formatted filename (e.g., "BOL SO3039 | PO4500684127 | 2025-11-23.html")
    """
    so_number = so_data.get('so_number', 'Unknown')
    po_number = so_data.get('po_number', '') or so_data.get('order_details', {}).get('po_number', '')
    
    # ALWAYS use CURRENT DATE for filename
    # This ensures files are named with the date when paperwork is actually generated
    date_str = datetime.now().strftime('%Y-%m-%d')
    
    # Build filename: "DOC_TYPE SO# | PO# | Date.ext"
    if po_number:
        filename = f"{doc_type} SO{so_number} | PO{po_number} | {date_str}{file_ext}"
    else:
        filename = f"{doc_type} SO{so_number} | {date_str}{file_ext}"
    
    # Clean filename (remove invalid characters for file system)
    # Windows doesn't allow: \ / : * ? " < > |
    filename = filename.replace('/', '-').replace('\\', '-').replace(':', '-')
    filename = filename.replace('*', '-').replace('?', '-').replace('"', '-')
    filename = filename.replace('<', '-').replace('>', '-').replace('|', '-')
    
    return filename

def get_uploads_dir():
    """Get the correct uploads directory path, handling nested directory structure"""
    # Get the directory containing this file
    current_dir = os.path.dirname(__file__)
    
    # Check if we're in a nested structure
    if 'canoil-portal' in current_dir and current_dir.count('canoil-portal') > 1:
        # We're in a nested structure, go up 2 levels
        parent_dir = os.path.dirname(os.path.dirname(current_dir))
        result = os.path.join(parent_dir, 'uploads', 'logistics')
    else:
        # We're in the correct backend directory, just add uploads/logistics
        result = os.path.join(current_dir, 'uploads', 'logistics')
    
    return result

def get_document_folder_structure(so_data: dict) -> dict:
    """
    Generate hierarchical folder structure for documents:
    CompanyName/Year/Month/CompanyName_SO_PO/HTML Format & PDF Format
    
    ZIP structure will be:
    CompanyName.zip
    └── CompanyName/
        └── 2026/
            └── January/
                └── CompanyName_SO1234_PO5678/
                    ├── HTML Format/
                    └── PDF Format/
    
    Args:
        so_data: Sales order data dictionary
        
    Returns:
        Dictionary with folder paths and names for document generation
    """
    # Get company name
    company_name = (
        so_data.get('customer_name', '') or
        so_data.get('billing_address', {}).get('company', '') or
        so_data.get('billing_address', {}).get('company_name', '') or
        so_data.get('ship_to', {}).get('company', '') or
        so_data.get('shipping_address', {}).get('company', '') or
        'Unknown'
    )
    
    # Clean company name for folder name (remove invalid characters)
    clean_company = company_name.replace('/', '-').replace('\\', '-').replace(':', '-')
    clean_company = clean_company.replace('*', '-').replace('?', '-').replace('"', '-')
    clean_company = clean_company.replace('<', '-').replace('>', '-').replace('|', '-')
    clean_company = clean_company.strip()
    
    # Get SO number
    so_number = so_data.get('so_number', 'Unknown')
    
    # Get PO number
    po_number = so_data.get('po_number', '') or so_data.get('order_details', {}).get('po_number', '')
    
    # ALWAYS use CURRENT DATE for folder structure
    # This ensures files are saved in the month when paperwork is actually generated
    # (SO date is just reference - shipment goes out when we make the paperwork)
    parsed_date = datetime.now()
    
    # Extract year and month name
    year_str = parsed_date.strftime('%Y')
    month_name = parsed_date.strftime('%B')  # Full month name (January, February, etc.)
    
    # Build order folder name: CompanyName_SO{SO}_PO{PO}
    if po_number:
        order_folder_name = f"{clean_company}_SO{so_number}_PO{po_number}"
    else:
        order_folder_name = f"{clean_company}_SO{so_number}"
    
    # Get base uploads directory
    uploads_dir = get_uploads_dir()
    
    # Build hierarchical path: CompanyName/Year/Month/OrderFolder
    company_folder = os.path.join(uploads_dir, clean_company)
    year_folder = os.path.join(company_folder, year_str)
    month_folder = os.path.join(year_folder, month_name)
    base_folder = os.path.join(month_folder, order_folder_name)
    
    html_folder_name = 'HTML Format'
    pdf_folder_name = 'PDF Format'
    html_folder = os.path.join(base_folder, html_folder_name)
    pdf_folder = os.path.join(base_folder, pdf_folder_name)
    
    # Create folders if they don't exist
    os.makedirs(html_folder, exist_ok=True)
    os.makedirs(pdf_folder, exist_ok=True)
    
    # For ZIP: the folder_name is the relative path from company folder
    # This ensures ZIP contains: CompanyName/Year/Month/OrderFolder/...
    relative_path = os.path.join(year_str, month_name, order_folder_name)
    
    return {
        'base_folder': base_folder,
        'html_folder': html_folder,
        'pdf_folder': pdf_folder,
        'html_folder_name': html_folder_name,
        'pdf_folder_name': pdf_folder_name,
        'folder_name': relative_path,  # Used for download URLs
        'order_folder_name': order_folder_name,  # Just the order folder name
        'company_name': clean_company,  # For ZIP naming
        'company_folder': company_folder,  # Full path to company folder (for ZIP)
        'year': year_str,
        'month': month_name
    }
import PyPDF2
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError as e:
    print(f"WARNING: OpenAI not available: {e}")
    OpenAI = None
    OPENAI_AVAILABLE = False

import tempfile
try:
    from hts_matcher import get_hts_code_for_item
    HTS_MATCHER_AVAILABLE = True
except ImportError as e:
    print(f"WARNING: hts_matcher not available: {e}")
    def get_hts_code_for_item(*args, **kwargs):
        return None
    HTS_MATCHER_AVAILABLE = False
# Simple dangerous goods detection - no complex imports needed

# =============================================================================
# MULTI-SO SUPPORT - Extract multiple Sales Orders from one email
# =============================================================================

def extract_all_so_numbers(text: str) -> list:
    """
    Extract ALL SO numbers from email text.
    Returns list of unique SO numbers found.
    
    Examples:
        "SO 3004 & 3020" → ["3004", "3020"]
        "sales orders 3004 & 3020" → ["3004", "3020"]
        "SO 3004" → ["3004"]
        "SO 3012, SO 3022, and SO 3222" → ["3012", "3022", "3222"]
        "s0 3012" → ["3012"]  (handles typo s0 instead of SO)
        "2) PO C092525-2 / SO 3024" → ["3024"]  (numbered format)
    """
    so_numbers = []
    
    # Pattern 1: "sales orders 3004 & 3020" or "SOs 3004, 3020"
    multi_pattern = r'(?:sales\s*orders?|SOs?)\s*[#:]?\s*(\d{3,5})\s*(?:&|,|and)\s*(\d{3,5})'
    multi_matches = re.findall(multi_pattern, text, re.IGNORECASE)
    for match in multi_matches:
        so_numbers.extend(match)
    
    # Pattern 2: Individual SO mentions - "Sales Order 3004:", "SO 3004", "s0 3004" (typo)
    # Also handles "SO 3012, SO 3022, and SO 3222" format
    # CRITICAL: Also handles numbered format like "2) PO C092525-2 / SO 3024"
    individual_pattern = r'(?:sales\s*order|[Ss][Oo0])\s*[#:]?\s*(\d{3,5})'
    individual_matches = re.findall(individual_pattern, text, re.IGNORECASE)
    so_numbers.extend(individual_matches)
    
    # Pattern 3: Just numbers after commas/and in SO context
    # "SO 3012, 3022, and 3222" → catches 3022 and 3222
    comma_and_pattern = r'(?:,\s*|\band\s+)(\d{3,5})(?=\s*(?:,|\band\b|\.|$|\s+we|\s+need))'
    comma_matches = re.findall(comma_and_pattern, text, re.IGNORECASE)
    so_numbers.extend(comma_matches)
    
    # Pattern 4: Numbered format like "2) PO C092525-2 / SO 3024" or "3) PO C110525-1 / SO 3064"
    # This pattern specifically handles the "/ SO" format after PO numbers
    numbered_po_so_pattern = r'\d+\)\s*PO\s+[A-Z0-9\-]+\s*/\s*SO\s*(\d{3,5})'
    numbered_matches = re.findall(numbered_po_so_pattern, text, re.IGNORECASE)
    so_numbers.extend(numbered_matches)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_so_numbers = []
    for so in so_numbers:
        if so not in seen:
            seen.add(so)
            unique_so_numbers.append(so)
    
    return unique_so_numbers


def extract_requested_documents(text: str) -> dict:
    """
    Extract which documents the user is requesting from email text.
    
    IMPORTANT: This function was causing issues by detecting "invoice" in normal emails
    and only generating Commercial Invoice. Now it ALWAYS returns all documents = True
    unless the user EXPLICITLY says "only" or "just" with a specific document.
    
    Examples:
        "BOL only" → {'bol': True, others: False}
        "just the packing slip" → {'packing_slip': True, others: False}
        Everything else → all True (default behavior - generate all documents)
    
    Returns:
        dict with keys: 'bol', 'packing_slip', 'commercial_invoice', 'usmca', 'tsca', 'dangerous_goods'
        Values are True if requested, False if not
    """
    # ALWAYS default to ALL documents - this is the safe behavior
    # Only restrict if user EXPLICITLY says "only" or "just"
    all_docs = {
        'bol': True,
        'packing_slip': True,
        'commercial_invoice': True,
        'usmca': True,
        'tsca': True,
        'dangerous_goods': True,
        'all_documents': True
    }
    
    text_lower = text.lower()
    
    # Only restrict documents if user explicitly says "only" or "just"
    # e.g., "BOL only", "just the packing slip", "only need commercial invoice"
    only_patterns = [
        r'\bbol\s+only\b',
        r'\bonly\s+bol\b',
        r'\bjust\s+(the\s+)?bol\b',
        r'\bpacking\s+slip\s+only\b',
        r'\bonly\s+(the\s+)?packing\s+slip\b',
        r'\bjust\s+(the\s+)?packing\s+slip\b',
        r'\bcommercial\s+invoice\s+only\b',
        r'\bonly\s+(the\s+)?commercial\s+invoice\b',
        r'\bjust\s+(the\s+)?commercial\s+invoice\b',
    ]
    
    import re
    for pattern in only_patterns:
        if re.search(pattern, text_lower):
            # User explicitly requested only specific document(s)
            result = {k: False for k in all_docs}
            result['all_documents'] = False
            
            if 'bol' in pattern:
                result['bol'] = True
                print(f"📋 User explicitly requested BOL ONLY")
            elif 'packing' in pattern:
                result['packing_slip'] = True
                print(f"📋 User explicitly requested Packing Slip ONLY")
            elif 'commercial' in pattern or 'invoice' in pattern:
                result['commercial_invoice'] = True
                print(f"📋 User explicitly requested Commercial Invoice ONLY")
            
            return result
    
    # Default: Generate ALL documents (safe behavior)
    print(f"📋 Generating ALL documents (default behavior)")
    return all_docs


def parse_multi_so_email_with_gpt4(email_text: str) -> dict:
    """
    Parse email with MULTIPLE Sales Orders.
    Returns structured data with items grouped by SO number.
    """
    openai_client = get_openai_client()
    if not openai_client:
        print("OpenAI not available - falling back to regex multi-SO parsing")
        return parse_multi_so_fallback(email_text)
    
    prompt = f"""
    Parse this logistics email that contains MULTIPLE Sales Orders shipping together.
    
    CRITICAL: Extract data EXACTLY as written in the email. DO NOT use example values.
    
    Email Content:
    {email_text}
    
    Return JSON with this structure (use ACTUAL values from email above, NOT these examples):
    {{
        "so_numbers": ["XXXX", "YYYY"],  // Extract actual SO numbers from email
        "po_numbers": ["AAAA", "BBBB"],  // Extract actual PO numbers from email
        "company_name": "Extract from email",  // Extract actual company name
        "items_by_so": {{
            "XXXX": [
                {{
                    "description": "Extract actual product name",
                    "quantity": "Extract actual quantity",
                    "unit": "Extract actual unit",
                    "batch_number": "Extract actual batch",
                    "gross_weight": "Extract actual weight with kg",
                    "pallet_count": 0,
                    "pallet_dimensions": "Extract actual dimensions",
                    "totes_info": "Extract totes information if mentioned (e.g., '5 totes – 4 empty + 1 partial (approx. 149 kg)')"
                }}
            ],
            "YYYY": [
                {{
                    "description": "Extract actual product name for second SO",
                    "quantity": "Extract actual quantity",
                    "unit": "Extract actual unit",
                    "batch_number": "Extract actual batch",
                    "gross_weight": "Extract actual weight with kg",
                    "pallet_count": 0,
                    "pallet_dimensions": "Extract actual dimensions",
                    "totes_info": "Extract totes information if mentioned"
                }}
            ]
        }},
        "combined_totals": {{
            "total_gross_weight": "Sum ALL weights from ALL SOs (e.g., if SO 3024 has 4,506 kg and SO 3064 has 1,512 kg, return '6,018 kg')",
            "total_pallet_count": 0  // Sum ALL pallets from ALL SOs (e.g., 6 + 2 = 8)
        }},
        "totes_info": "Combined totes information from all SOs if mentioned"
    }}
    
    CRITICAL: Extract the EXACT weight values from the email. Do NOT invent or use default values.
    CRITICAL: For combined_totals.total_gross_weight, you MUST ADD all individual SO weights together.
    CRITICAL: For combined_totals.total_pallet_count, you MUST ADD all individual SO pallet counts together.
    
    IMPORTANT RULES:
    1. Extract EACH SO's items separately under items_by_so - EVERY SO MUST HAVE ITS OWN ENTRY
    2. Match batch numbers to their correct SO
    3. Calculate combined totals for the entire shipment
    4. Keep weight values as strings with units
    5. CRITICAL NUMBERED FORMAT PARSING:
       If email uses numbered format like:
       "2) PO C092525-2 / SO 3024 – BRO SAE 0W-20 Full Synthetic..."
       "3) PO C110525-1 / SO 3064 – BRO SAE 10W-30 Heavy Duty..."
       
       You MUST:
       - Extract SO 3024 from "2) PO C092525-2 / SO 3024"
       - Extract SO 3064 from "3) PO C110525-1 / SO 3064"
       - Put ALL items mentioned under "2)" into items_by_so["3024"]
       - Put ALL items mentioned under "3)" into items_by_so["3064"]
       - Each numbered section is a COMPLETE SO with its own items, batch, weight, pallets
    6. The SO number in items_by_so keys MUST match exactly the SO numbers in so_numbers array (as strings: "3024", "3064")
    7. MANDATORY: If you find 2 SOs, you MUST create items_by_so entries for BOTH. Do NOT skip any SO.
    
    SPECIAL INSTRUCTIONS (CRITICAL):
    Look for instructions at the end of the email like:
    - "add 1 pail to SO 3020" → Add this item to that SO's items
    - "free of charge" / "sample" / "no value" → Set is_sample: true, unit_price: 0
    - "no need to add weight" → Set gross_weight: "N/A"
    
    Example: "add 1 pail to 3020, free of charge, no weight" should add:
    {{
        "description": "Sample Pail",
        "quantity": "1",
        "unit": "pail",
        "is_sample": true,
        "unit_price": 0,
        "gross_weight": "N/A",
        "batch_number": "N/A"
    }}
    
    These sample/free items MUST appear on customs paperwork even if $0 value!
    
    Return ONLY valid JSON, no explanations.
    """
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a logistics parsing expert. Parse multi-SO shipping emails accurately. Include any special instructions like samples or free items."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            max_tokens=3000,
            response_format={"type": "json_object"}
        )
        
        result = response.choices[0].message.content.strip()
        
        # Clean response
        if result.startswith('```json'):
            result = result[7:]
        if result.startswith('```'):
            result = result[3:]
        if result.endswith('```'):
            result = result[:-3]
        result = result.strip()
        
        parsed_data = json.loads(result)
        print(f"✅ Multi-SO GPT parsing successful: {len(parsed_data.get('so_numbers', []))} SOs found")
        return parsed_data
        
    except Exception as e:
        print(f"❌ Multi-SO GPT parsing failed: {e}")
        return parse_multi_so_fallback(email_text)


def parse_multi_so_fallback(email_text: str) -> dict:
    """
    Fallback regex parser for multi-SO emails when GPT is unavailable.
    """
    so_numbers = extract_all_so_numbers(email_text)
    
    data = {
        'so_numbers': so_numbers,
        'po_numbers': [],
        'company_name': '',
        'items_by_so': {},
        'combined_totals': {}
    }
    
    # Extract PO numbers
    po_pattern = r'(?:purchase\s*orders?\s*(?:numbers?)?|POs?)\s*[#:]?\s*(\d+)\s*(?:&|,|and)\s*(\d+)'
    po_match = re.search(po_pattern, email_text, re.IGNORECASE)
    if po_match:
        data['po_numbers'] = list(po_match.groups())
    
    # Try to extract items per SO from structured format
    # Handle both "Sales Order 3004:" format AND numbered format "2) PO C092525-2 / SO 3024"
    for so_num in so_numbers:
        items = []
        
        # Pattern 1: Numbered format like "2) PO C092525-2 / SO 3024 – BRO SAE 0W-20..."
        numbered_pattern = rf'\d+\)\s*PO\s+[A-Z0-9\-]+\s*/\s*SO\s*{so_num}[^\d].*?(?=\d+\)\s*PO|SO\s*\d+|$)'
        numbered_match = re.search(numbered_pattern, email_text, re.IGNORECASE | re.DOTALL)
        
        if numbered_match:
            section_text = numbered_match.group(0)
            print(f"   📋 Fallback: Found numbered section for SO {so_num}")
            
            # Extract product description (after the dash/em dash)
            desc_match = re.search(r'[–—]\s*([^\n]+)', section_text)
            if desc_match:
                description = desc_match.group(1).strip()
                
                # Extract quantity
                qty_match = re.search(r'Quantity:\s*(\d+)\s*(\w+)', section_text, re.IGNORECASE)
                if qty_match:
                    quantity = qty_match.group(1)
                    unit = qty_match.group(2)
                else:
                    # Try alternative format
                    qty_match = re.search(r'(\d+)\s*(cases?|pallets?|drums?|kegs?|pails?)', section_text, re.IGNORECASE)
                    if qty_match:
                        quantity = qty_match.group(1)
                        unit = qty_match.group(2)
                    else:
                        quantity = "1"
                        unit = "case"
                
                # Extract batch
                batch_match = re.search(r'Batch:\s*([A-Z0-9\-]+)', section_text, re.IGNORECASE)
                batch_number = batch_match.group(1) if batch_match else ''
                
                # Extract weight
                weight_match = re.search(r'Total\s+gross\s+weight:\s*([\d,]+)\s*kg', section_text, re.IGNORECASE)
                gross_weight = weight_match.group(1) + ' kg' if weight_match else ''
                
                # Extract pallets
                pallet_match = re.search(r'Pallets:\s*(\d+)\s*pallets', section_text, re.IGNORECASE)
                pallet_count = int(pallet_match.group(1)) if pallet_match else 0
                
                # Extract pallet dimensions
                dim_match = re.search(r'(\d+[×x]\d+[×x]\d+)\s*inches', section_text, re.IGNORECASE)
                pallet_dimensions = dim_match.group(1) + ' inches' if dim_match else ''
                
                item = {
                    'description': description,
                    'quantity': quantity,
                    'unit': unit,
                    'batch_number': batch_number,
                    'gross_weight': gross_weight,
                    'pallet_count': pallet_count,
                    'pallet_dimensions': pallet_dimensions
                }
                items.append(item)
                print(f"   ✅ Extracted item: {description} ({quantity} {unit})")
        
        # Pattern 2: Traditional format like "Sales Order 3004:\n360 pails..."
        if not items:
            section_pattern = rf'Sales\s*Order\s*{so_num}[:\s]*\n(.*?)(?=Sales\s*Order|\Z)'
            section_match = re.search(section_pattern, email_text, re.IGNORECASE | re.DOTALL)
            
            if section_match:
                section_text = section_match.group(1)
                
                # Extract item from section
                item_pattern = r'(\d+)\s+(pails?|drums?|cases?|gallons?)\s+of\s+([^\n,]+)'
                item_match = re.search(item_pattern, section_text, re.IGNORECASE)
                if item_match:
                    item = {
                        'quantity': item_match.group(1),
                        'unit': item_match.group(2),
                        'description': item_match.group(3).strip()
                    }
                    
                    # Extract batch
                    batch_match = re.search(r'batch\s*(?:number)?\s*[#:]?\s*([A-Z0-9\-]+)', section_text, re.IGNORECASE)
                    if batch_match:
                        item['batch_number'] = batch_match.group(1)
                    
                    # Extract weight
                    weight_match = re.search(r'([\d,\.]+)\s*kg\s*(?:total\s*)?gross', section_text, re.IGNORECASE)
                    if weight_match:
                        item['gross_weight'] = f"{weight_match.group(1)} kg"
                    
                    # Extract pallet info
                    pallet_match = re.search(r'[Oo]n\s+(\d+)\s+pallets?', section_text)
                    if pallet_match:
                        item['pallet_count'] = int(pallet_match.group(1))
                    
                    items.append(item)
        
        if items:
            data['items_by_so'][str(so_num)] = items
            print(f"   ✅ Fallback: Added {len(items)} items for SO {so_num}")
        else:
            print(f"   ⚠️ Fallback: No items extracted for SO {so_num}")
    
    return data


# Create blueprint
try:
    logistics_bp = Blueprint('logistics', __name__, url_prefix='')
    # Use ASCII-only logging to avoid Unicode console issues on Windows
    print("Logistics blueprint created successfully")
except Exception as e:
    print(f"ERROR: Failed to create logistics blueprint: {e}")
    import traceback
    traceback.print_exc()
    raise

# Add CORS headers to ALL responses from this blueprint
@logistics_bp.after_request
def add_cors_headers(response):
    """Add CORS headers to every response from logistics blueprint"""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Origin, X-Requested-With'
    response.headers['Access-Control-Max-Age'] = '3600'
    return response

# Handle preflight OPTIONS requests
@logistics_bp.route('/api/logistics/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    """Handle preflight CORS requests"""
    from flask import Response
    response = Response()
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Origin, X-Requested-With'
    response.headers['Access-Control-Max-Age'] = '3600'
    return response

# Lazy OpenAI client initialization (only when needed)
client = None

# SO data cache to avoid re-parsing same PDFs (10 minute TTL)
_so_data_cache = {}
_so_cache_timestamps = {}
_SO_CACHE_TTL = 600  # 10 minutes

def get_openai_client():
    """Initialize OpenAI client only when needed and API key is available"""
    global client
    if not OPENAI_AVAILABLE or OpenAI is None:
        print("ERROR: OpenAI library not available")
        return None
    
    if client is None:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key or api_key == "your_openai_api_key_here" or len(api_key) < 20:
            print("ERROR: OPENAI_API_KEY not set or invalid")
            return None
        try:
            # Fix for httpx version incompatibility - don't pass proxies
            import httpx
            # Create httpx client without proxies to avoid version conflicts
            http_client = httpx.Client(timeout=60.0)
            client = OpenAI(api_key=api_key, http_client=http_client)
            print("SUCCESS: OpenAI client initialized")
            return client
        except TypeError as te:
            # If httpx client approach fails, try without it (for older OpenAI versions)
            try:
                client = OpenAI(api_key=api_key)
                print("SUCCESS: OpenAI client initialized (fallback method)")
                return client
            except Exception as e2:
                import traceback
                print(f"ERROR: OpenAI client initialization failed (both methods): {e2}")
                print(f"Original error: {te}")
                print(traceback.format_exc())
                return None
        except Exception as e:
            import traceback
            print(f"ERROR: OpenAI client initialization failed: {e}")
            print(traceback.format_exc())
            return None
    return client

def extract_core_product_name(description):
    """Extract core product name from description for better matching"""
    if not description:
        return ""
    
    # Remove common prefixes and suffixes
    desc = description.upper().strip()
    
    # Handle different formats:
    # Email: "CANOIL HEAVY DUTY EP2" -> "HEAVY DUTY EP2"
    # SO: "CC HDEP2 DRM 2 DRUM CANOIL HEAVY DUTY EP2 - 180 KG DRUM" -> "HEAVY DUTY EP2"
    
    words = desc.split()
    clean_words = []
    
    # Skip technical prefixes and find the actual product name
    skip_prefixes = ['CC', 'HDEP2', 'MPWB2', 'DRM', 'PAIL', 'DRUM', 'TUBE', 'GALLON', 'KG', 'LBS', 'US$', 'CAD$']
    found_product_start = False
    
    for i, word in enumerate(words):
        # Skip initial technical codes and numbers
        if not found_product_start:
            if (word in skip_prefixes or 
                word.isdigit() or 
                (len(word) <= 4 and any(c.isdigit() for c in word) and word not in ['EP2']) or
                word in ['2']):
                continue
            # Look for actual product name start
            if word in ['CANOIL', 'CASTROL', 'SHELL', 'MOBIL', 'TEXACO', 'HEAVY', 'MULTIPURPOSE']:
                found_product_start = True
        
        if found_product_start:
            # Stop at technical specifications but include product specs like EP2, #2
            if (word in ['DRUM', 'PAIL', 'TUBE', 'GALLON', 'KG', 'LBS'] or
                word.startswith('US$') or word.startswith('CAD$') or
                (word.isdigit() and len(word) > 2 and word not in ['EP2']) or
                word == '-'):
                break
            clean_words.append(word)
    
    # Join and clean up
    core_name = ' '.join(clean_words)
    
    # Remove "CANOIL" prefix if present (since both email and SO might have it)
    if core_name.startswith('CANOIL '):
        core_name = core_name[7:]
    
    return core_name.strip()

def determine_final_destination(so_data, email_data):
    """Intelligently determine final destination country from available data"""
    
    # Check email data first
    if email_data.get('final_destination'):
        return email_data['final_destination']
    
    # Check shipping address in SO data
    shipping_address = so_data.get('shipping_address', {})
    if shipping_address.get('country'):
        return shipping_address['country']
    
    # Check customer address patterns
    customer_name = so_data.get('customer_name', '').upper()
    
    # Common patterns for determining country
    if any(indicator in customer_name for indicator in ['CANADA', 'ONTARIO', 'ALBERTA', 'BC', 'QUEBEC']):
        return 'Canada'
    elif any(indicator in customer_name for indicator in ['USA', 'UNITED STATES', 'TEXAS', 'CALIFORNIA', 'NEW YORK']):
        return 'United States'
    elif any(indicator in customer_name for indicator in ['MEXICO', 'MEXICAN']):
        return 'Mexico'
    
    # Check postal code patterns
    billing_address = so_data.get('billing_address', {})
    postal_code = billing_address.get('postal_code', '') or shipping_address.get('postal_code', '')
    
    if postal_code:
        # Canadian postal codes: A1A 1A1 format
        if re.match(r'^[A-Z]\d[A-Z]\s?\d[A-Z]\d$', postal_code.upper()):
            return 'Canada'
        # US ZIP codes: 12345 or 12345-6789 format
        elif re.match(r'^\d{5}(-\d{4})?$', postal_code):
            return 'United States'
    
    # Default to Canada for Canoil shipments
    return 'Canada'

def validate_sold_to_ship_to_with_gpt4(email_data, so_data):
    """Use GPT-4o to intelligently validate Sold To vs Ship To scenarios"""
    try:
        if not client:
            print("WARNING: OpenAI client not available for smart validation")
            return {"valid": True, "confidence": "low", "reason": "No GPT-4o validation available"}
        
        # Prepare validation data
        email_info = {
            "sold_to": email_data.get('sold_to', {}),
            "ship_to": email_data.get('ship_to', {}),
            "primary_company": email_data.get('primary_company', ''),
            "so_number": email_data.get('so_number', '')
        }
        
        so_info = {
            "customer_name": so_data.get('customer_name', ''),
            "so_number": so_data.get('so_number', ''),
            "billing_address": so_data.get('billing_address', {}),
            "shipping_address": so_data.get('shipping_address', {})
        }
        
        validation_prompt = f"""
        Analyze this B2B shipping scenario to determine if it's a valid "Sold To" vs "Ship To" situation.
        
        EMAIL DATA:
        - Primary Company: {email_info['primary_company']}
        - Company Name: {email_info.get('company_name', 'Not specified')}
        - SO Number: {email_info['so_number']}
        
        SALES ORDER DATA:
        - Customer Name (Sold To): {so_info['customer_name']}
        - Billing Company: {so_info.get('billing_address', {}).get('company', 'Not specified')}
        - Shipping Contact: {so_info.get('shipping_address', {}).get('company', 'Not specified')}
        - SO Number: {so_info['so_number']}
        
        BUSINESS RULES:
        1. EMAIL company should match SO "Sold To" (billing company) - this is who placed the order
        2. SO "Ship To" can be a different contact person for delivery - this is normal B2B
        3. Example: TransCanada (email company) = TransCanada (SO Sold To), Steve McLean (SO Ship To) = delivery contact
        4. This is VALID when email company matches SO billing company, even if Ship To is different
        
        VALIDATION LOGIC:
        - If email company matches SO customer/billing company: VALID B2B scenario
        - If SO Ship To is different contact person: NORMAL, not a mismatch
        - Only flag as invalid if email company doesn't match SO billing company at all
        
        Analyze and return JSON:
        {{
            "valid": true/false,
            "confidence": "high/medium/low",
            "scenario_type": "b2b_sold_to_ship_to/direct_customer/mismatch",
            "reason": "detailed explanation of why this is valid or invalid",
            "recommendation": "what action to take"
        }}
        
        Return ONLY the JSON, no explanations.
        """
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a B2B logistics validation expert. Analyze shipping scenarios for validity."},
                {"role": "user", "content": validation_prompt}
            ],
            temperature=0,
            max_tokens=500
        )
        
        result = response.choices[0].message.content.strip()
        
        # Clean up JSON response
        if result.startswith('```json'):
            result = result[7:]
        if result.startswith('```'):
            result = result[3:]
        if result.endswith('```'):
            result = result[:-3]
        result = result.strip()
        
        validation_result = json.loads(result)
        print(f"GPT-4o Validation: {validation_result['scenario_type']} - {validation_result['confidence']} confidence")
        return validation_result
        
    except Exception as e:
        print(f"ERROR: GPT-4o validation failed: {e}")
        return {"valid": True, "confidence": "low", "reason": f"Validation error: {str(e)}"}

def parse_email_deterministic(email_text: str) -> dict:
    """Deterministic email parser (no GPT). Extracts SO, PO, company, items, pallet info.
    Returns a dict compatible with GPT parser output. Conservative; no invention.
    """
    import re, json
    data = {
        'so_number': '',
        'po_number': '',
        'company_name': '',
        'items': [],
        'total_weight': None,
        'pallet_count': None,
        'pallet_dimensions': None,
        'batch_numbers': '',
        'carrier': None,
        'so_line_numbers': None,
        'is_partial_shipment': False
    }

    text = email_text or ''
    lines = [ln.strip() for ln in text.splitlines()]

    # SO number AND line numbers
    # IMPORTANT: Only match line numbers that appear IMMEDIATELY after SO number (same phrase)
    # Example: "SO 2707 line 2, attached" → partial shipment ✓
    # Example: "SO 2932, attached)\n\nLine 1: product" → full shipment (ignore "Line 1:") ✓
    
    # Match SO number with optional line number right after it (before any punctuation)
    # This ensures we only catch: "sales order 2707 line 2" not "sales order 2932) ... Line 1:"
    so_match = re.search(r'(?:Canoil\s+sales\s+order|sales\s+order|SO)\s*(?:[#No.:]*\s*)?(\d+)\s+line\s+(?:item\s+)?(\d+)', text, re.IGNORECASE)
    
    if so_match:
        # Found SO with line number right after (e.g., "SO 2707 line 2")
        data['so_number'] = so_match.group(1)
        data['so_line_numbers'] = [int(so_match.group(2))]
        data['is_partial_shipment'] = True
        print(f"✅ PARTIAL SHIPMENT: SO {data['so_number']} line {so_match.group(2)}")
    else:
        # Try to match SO number without line number
        so_only = re.search(r'(?:Canoil\s+sales\s+order|sales\s+order|SO)\s*(?:[#No.:]*\s*)?(\d+)', text, re.IGNORECASE)
        if so_only:
            data['so_number'] = so_only.group(1)
            data['so_line_numbers'] = None
            data['is_partial_shipment'] = False
            print(f"✅ FULL SHIPMENT: SO {data['so_number']} (no line number specified)")

    # PO number - multiple patterns
    po_patterns = [
        r'purchase\s+order\s+number\s*:?\s*([A-Za-z0-9\-]+)',
        r'PO\s*Number\s*:?\s*([A-Za-z0-9\-]+)',
        r'PO\s*:?\s*([A-Za-z0-9\-]{5,})',
        r'P\.O\.\s*:?\s*([A-Za-z0-9\-]+)'
    ]
    for pattern in po_patterns:
        po_match = re.search(pattern, text, re.IGNORECASE)
        if po_match:
            data['po_number'] = po_match.group(1)
            break

    # Company name – take text before "purchase order number" on the same line, else first line start
    for ln in lines:
        m = re.search(r'^(.*?)\s*purchase\s+order\s+number\s*[A-Za-z0-9\-]+', ln, re.IGNORECASE)
        if m:
            name = m.group(1).strip(' ,:\u00a0')
            if len(name) >= 2:
                data['company_name'] = name
                break
    if not data['company_name']:
        # Fallback: first non-empty line without greeting
        for ln in lines:
            if ln and not re.match(r'^(hi|hello|dear)\b', ln, re.IGNORECASE):
                data['company_name'] = ln.strip()
                break

    # Extract batch numbers - FULL STRING with quantities if present
    # e.g., "Batch Number NT5D14T016 (5) + NT5E19T018 (3)" -> keep the whole thing
    batch_full_string = None
    batch_numbers = []
    batch_pattern = r'batch\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+(?:\s*\([0-9]+\))?\s*(?:\+\s*[A-Z0-9\-]+(?:\s*\([0-9]+\))?)*)'
    for ln in lines:
        batch_match = re.search(batch_pattern, ln, re.IGNORECASE)
        if batch_match:
            # Keep FULL batch string with quantities: "NT5D14T016 (5) + NT5E19T018 (3)"
            batch_full_string = batch_match.group(1).strip()
            # Extract ONLY actual batch codes (letters + numbers, min 5 chars), NOT quantity numbers
            # Match pattern: letters/numbers together, at least 5 characters
            batch_codes = re.findall(r'\b([A-Z0-9\-]{5,})\b', batch_full_string)
            batch_numbers.extend(batch_codes)
    
    # Items with batches (scan windowed)
    items = []
    for i, ln in enumerate(lines):
        m = re.search(r'^(\d+)\s+(drums?|pails?|gallons?|containers?)\s+of\s+(.+)$', ln, re.IGNORECASE)
        if not m:
            continue
        qty, unit, desc = m.groups()
        # CRITICAL FIX: Stop description at comma or weight/batch keywords to avoid capturing extra text
        # "3 drums of MOV Extra 0, 540 kg..." should extract just "MOV Extra 0"
        desc = desc.strip(' .')
        # Remove everything after comma (weight, batch info, etc.)
        if ',' in desc:
            desc = desc.split(',')[0].strip()
        # Also stop at common weight/batch patterns if no comma
        desc = re.split(r',\s*(?:total|batch|kg|lbs)', desc, flags=re.IGNORECASE)[0].strip()
        # Look ahead a few lines for batch and weight
        batch = None
        weight_raw = None
        for j in range(i+1, min(i+4, len(lines))):
            nxt = lines[j]
            # Look for FULL batch string with quantities
            b = re.search(r'batch\s*(?:number|#)?\s*:?\s*([A-Z0-9]+(?:\s*\([0-9]+\))?\s*(?:\+\s*[A-Z0-9]+(?:\s*\([0-9]+\))?)*)', nxt, re.IGNORECASE)
            if b and not batch:
                batch = b.group(1).strip()  # Keep full string: "NT5D14T016 (5) + NT5E19T018 (3)"
            if weight_raw is None and re.search(r'total\s+net\s+weight', nxt, re.IGNORECASE):
                weight_raw = nxt
        
        # If no batch found in lookahead, use full batch string
        if not batch and batch_full_string:
            batch = batch_full_string
        
        items.append({
            'description': desc,
            'quantity': qty,
            'unit': unit.lower(),
            'batch_number': batch,
            'total_weight_raw': weight_raw
        })

    data['items'] = items
    print(f"DEBUG: Items list has {len(items)} items")
    for idx, it in enumerate(items, 1):
        print(f"DEBUG: Item {idx}: {it}")
    
    # Store batch numbers as STRING with " + " separator (no duplicates)
    if batch_numbers:
        # Remove duplicates while preserving order
        unique_batches = []
        seen = set()
        for batch in batch_numbers:
            if batch not in seen:
                unique_batches.append(batch)
                seen.add(batch)
        # Convert to string with " + " separator (matches batch_full_string format)
        data['batch_numbers'] = ' + '.join(unique_batches)
        print(f"DEBUG: Batch numbers (cleaned): {data['batch_numbers']}")
    if batch_full_string:
        data['batch_full_string'] = batch_full_string  # Full string with quantities
        print(f"DEBUG: Batch full string: {batch_full_string}")
    
    # Calculate total weight from items
    print(f"DEBUG: Calculating weight from {len(items)} items")
    total_weight_kg = 0
    weight_breakdown = []
    
    for i, item in enumerate(items, 1):
        print(f"DEBUG: Item {i} total_weight_raw: {item.get('total_weight_raw')}")
        if item.get('total_weight_raw'):
            # Extract number from "7,360 kg total net weight" or similar
            # Handle commas as thousand separators (e.g., 7,360 or 1,234.56)
            weight_match = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:kg|total|net)', item['total_weight_raw'], re.IGNORECASE)
            if weight_match:
                # Remove commas before converting to float
                weight_str = weight_match.group(1).replace(',', '')
                weight = float(weight_str)
                print(f"DEBUG: Extracted weight: {weight} kg")
                total_weight_kg += weight
                weight_breakdown.append(f"Line {i}: {weight:,.0f} kg")
                # Store cleaned weight on item for frontend
                item['weight_kg'] = weight
            else:
                print(f"DEBUG: No weight match found in: {item['total_weight_raw']}")
        else:
            print(f"DEBUG: Item has no total_weight_raw field")
    
    print(f"DEBUG: Total weight calculated: {total_weight_kg} kg")
    if total_weight_kg > 0:
        # Format: "1,200 kg + 1,020 kg + 1,760 kg = 3,980 kg"
        if len(weight_breakdown) > 1:
            # Extract just the weight values (e.g., "1,200 kg" from "Line 1: 1,200 kg")
            weight_values = [wb.split(': ')[1] for wb in weight_breakdown]
            data['total_weight'] = f"{' + '.join(weight_values)} = {total_weight_kg:,.0f} kg"
        else:
            data['total_weight'] = f"{total_weight_kg:,.0f} kg"
        
        data['weight_breakdown'] = weight_breakdown  # Keep for other displays
        print(f"DEBUG: Setting data['total_weight'] = '{data['total_weight']}'")
        print(f"DEBUG: Weight breakdown: {weight_breakdown}")
    else:
        # Only try old patterns if we didn't calculate from items
        # PREFER GROSS WEIGHT if mentioned
        gross_match = re.search(r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(kg|lbs?|pounds?)\s*gross', text, re.IGNORECASE)
        if not gross_match:
            gross_match = re.search(r'gross\s*weight:?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(kg|lbs?|pounds?)', text, re.IGNORECASE)
        
        if gross_match:
            weight_val = gross_match.group(1).replace(',', '')
            data['total_weight'] = f"{weight_val} {gross_match.group(2).lower()}"
            print(f"DEBUG: Found GROSS weight: {data['total_weight']}")
        else:
            # No gross - use net or any weight
            weight_patterns = [
                r'Total\s+(?:Net\s+)?Weight\s*:?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(kg|lbs?|pounds?)',
                r'Weight\s*:?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(kg|lbs?|pounds?)',
                r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(kg|lbs?|pounds?)\s+total'
            ]
            for pattern in weight_patterns:
                weight_match = re.search(pattern, text, re.IGNORECASE)
                if weight_match:
                    weight_val = weight_match.group(1).replace(',', '')
                    data['total_weight'] = f"{weight_val} {weight_match.group(2).lower()}"
                    print(f"DEBUG: Found weight: {data['total_weight']}")
                    break
    
    # Pallet info - multiple patterns
    pallet_patterns = [
        r'On\s+(\d+)\s+pallets?',
        r'(\d+)\s+pallets?\s+of',
        r'Pallets?\s*:?\s*(\d+)'
    ]
    for pattern in pallet_patterns:
        pal = re.search(pattern, text, re.IGNORECASE)
        if pal:
            try:
                data['pallet_count'] = int(pal.group(1))
                break
            except:
                pass
    
    # Pallet dimensions - flexible pattern (2 or 3 dimensions, with/without "inches")
    # Extract dimensions and detect packaging type (case, skid, pallet)
    packaging_type = None
    dims = None
    
    # CRITICAL: Check if email mentions "case" or "cases" - this means BOX, NOT pallet
    has_cases = bool(re.search(r'\b(case|cases)\b', text, re.IGNORECASE))
    has_pallets = bool(re.search(r'\b(pallet|pallets|skid|skids)\b', text, re.IGNORECASE))
    
    # Look for packaging type with dimensions: "In 1 case 27×22×20 inches", "on 2 pallets 48x40", etc.
    # Pattern 1: "In 1 case 27×22×20 inches" or "in 1 case 27x22x20"
    case_match = re.search(r'in\s+(\d+)\s+(?:case|cases)\s+(\d+)\s*[xX×]\s*(\d+)(?:\s*[xX×]\s*(\d+))?\s*(?:inches|inch|in)?', text, re.IGNORECASE)
    if case_match:
        packaging_type = 'case'
        dims = [case_match.group(2), case_match.group(3)]
        if case_match.group(4):
            dims.append(case_match.group(4))
    
    # Pattern 2: "on 2 pallets 48x40" or "2 pallets 48x40" - ONLY if no cases mentioned
    if not dims and has_pallets and not has_cases:
        pallet_match = re.search(r'(?:on\s+)?(\d+)\s+(?:pallet|pallets|skid|skids)\s+(\d+)\s*[xX×]\s*(\d+)(?:\s*[xX×]\s*(\d+))?\s*(?:inches|inch|in)?', text, re.IGNORECASE)
        if pallet_match:
            packaging_type = 'pallet'
            dims = [pallet_match.group(2), pallet_match.group(3)]
            if pallet_match.group(4):
                dims.append(pallet_match.group(4))
    
    # Pattern 3: Just dimensions with packaging type nearby: "case 27×22×20" or "pallet 48x40"
    if not dims:
        pkg_match = re.search(r'\b(case|cases|pallet|pallets|skid|skids)\b.*?(\d+)\s*[xX×]\s*(\d+)(?:\s*[xX×]\s*(\d+))?\s*(?:inches|inch|in)?', text, re.IGNORECASE)
        if pkg_match:
            pkg_word = pkg_match.group(1).lower()
            if 'case' in pkg_word:
                packaging_type = 'case'
            else:
                packaging_type = 'pallet'
            dims = [pkg_match.group(2), pkg_match.group(3)]
            if pkg_match.group(4):
                dims.append(pkg_match.group(4))
    
    # Fallback: just extract dimensions if no packaging type found
    if not dims:
        dims_match = re.search(r'(\d+)\s*[xX×]\s*(\d+)(?:\s*[xX×]\s*(\d+))?\s*(?:inches|inch|in)?', text)
        if dims_match:
            dims = [dims_match.group(1), dims_match.group(2)]
            if dims_match.group(3):
                dims.append(dims_match.group(3))
            # Try to infer packaging type from context - prioritize case if mentioned
            if has_cases:
                packaging_type = 'case'
            elif has_pallets:
                packaging_type = 'pallet'
    
    if dims:
        dimensions_str = '×'.join(dims) + ' inches'
        data['pallet_dimensions'] = dimensions_str
        # CRITICAL: If email mentions "case" but no "pallet", it's a case/box, NOT a pallet
        if has_cases and not has_pallets:
            data['packaging_type'] = 'case'
        else:
            data['packaging_type'] = packaging_type or 'pallet'  # Default to pallet only if no case mentioned
    else:
        # Even without dimensions, if email mentions cases but no pallets, it's a case
        if has_cases and not has_pallets:
            data['packaging_type'] = 'case'
        else:
            data['packaging_type'] = None
    
    # Create skid_info combining packaging type, count and dimensions for BOL
    # Note: "case" = box in shipping terminology
    if data.get('pallet_count') and data.get('pallet_dimensions'):
        pallet_count = data['pallet_count']
        pallet_dims = data['pallet_dimensions']
        pkg_type = data.get('packaging_type', 'pallet')
        # Use "box" for display if packaging_type is "case" (case = box in shipping)
        display_type = 'box' if pkg_type == 'case' else pkg_type
        if pallet_count == 1:
            data['skid_info'] = f"1 {display_type} {pallet_dims}"
        else:
            data['skid_info'] = f"{pallet_count} {display_type}s {pallet_dims} each"
    elif data.get('pallet_dimensions'):
        pkg_type = data.get('packaging_type', 'pallet')
        # Use "box" for display if packaging_type is "case" (case = box in shipping)
        display_type = 'box' if pkg_type == 'case' else pkg_type
        data['skid_info'] = f"{display_type} {data['pallet_dimensions']}"
    else:
        data['skid_info'] = ""
    
    # Detect destination country from email or company name
    destination_country = None
    # Look for country indicators in email
    if re.search(r'\b(USA|United States|U\.S\.|US)\b', text, re.IGNORECASE):
        destination_country = 'US'
    elif re.search(r'\b(Canada|Canadian)\b', text, re.IGNORECASE):
        destination_country = 'CAD'
    # Also check in company name
    if not destination_country and data.get('company_name'):
        if re.search(r'\b(USA|United States|U\.S\.|US)\b', data['company_name'], re.IGNORECASE):
            destination_country = 'US'
        elif re.search(r'\b(Canada|Canadian)\b', data['company_name'], re.IGNORECASE):
            destination_country = 'CAD'
    if destination_country:
        data['destination_country'] = destination_country
    
    # Carrier info - capture everything after "Ship via:"
    carrier_patterns = [
        r'Ship\s+via\s*:?\s*(.+?)(?:\n|$)',
        r'Carrier\s*:?\s*(.+?)(?:\n|$)',
        r'Shipping\s+Carrier\s*:?\s*(.+?)(?:\n|$)'
    ]
    for pattern in carrier_patterns:
        carrier_match = re.search(pattern, text, re.IGNORECASE)
        if carrier_match:
            data['carrier'] = carrier_match.group(1).strip()
            break
    
    # NO FALLBACK for line numbers!
    # We ONLY extract line numbers if they appear right after the SO number
    # This prevents false positives from email body formatting like "Line 1: product..."
    
    return data

def parse_text_with_gpt4(prompt_text, retry_count=0):
    """Parse text input using GPT-4o to extract logistics information (for manual text input)"""
    try:
        # Get OpenAI client (lazy loading)
        openai_client = get_openai_client()
        if not openai_client:
            print("OpenAI not available - cannot parse text")
            return None
            
        print(f"✅ GPT-4o client available - Parsing text with GPT-4o (attempt {retry_count + 1})...")
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a logistics data extraction assistant. Extract shipping information from text and return valid JSON only."},
                {"role": "user", "content": prompt_text}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content.strip()
        print(f"📥 GPT Response (first 200 chars): {result_text[:200]}...")
        
        # Clean up the response (remove markdown code blocks if present)
        if result_text.startswith('```json'):
            result_text = result_text[7:]
        if result_text.startswith('```'):
            result_text = result_text[3:]
        if result_text.endswith('```'):
            result_text = result_text[:-3]
        result_text = result_text.strip()
        
        # Parse JSON response
        parsed = json.loads(result_text)
        print(f"✅ Successfully parsed text input")
        return parsed
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        print(f"   Response text: {result_text[:500] if 'result_text' in locals() else 'N/A'}")
        if retry_count < 2:
            print(f"   Retrying... (attempt {retry_count + 2})")
            return parse_text_with_gpt4(prompt_text, retry_count + 1)
        return None
    except Exception as e:
        print(f"❌ Error parsing text with GPT: {e}")
        import traceback
        traceback.print_exc()
        if retry_count < 2:
            print(f"   Retrying... (attempt {retry_count + 2})")
            return parse_text_with_gpt4(prompt_text, retry_count + 1)
        return None

def parse_email_with_gpt4(email_text, retry_count=0):
    """Parse email content using GPT-4o to extract ALL logistics information with retry logic"""
    try:
        # Get OpenAI client (lazy loading)
        openai_client = get_openai_client()
        if not openai_client:
            print("OpenAI not available - using fallback parser")
            return parse_email_fallback(email_text)
            
        print(f"✅ GPT-4o client available - Parsing email with GPT-4o (attempt {retry_count + 1})...")
        print(f"Email length: {len(email_text)} characters")
        print(f"Email preview: {email_text[:200]}...")
        
        # SIMPLIFIED PROMPT - NO CONFUSION
        prompt = f"""
        Parse this logistics email. Extract ONLY the essential information.
        
        SIMPLE RULES:
        1. Find SO number (e.g. "SO 3012" or "sales order 3012")
        2. Find company name (e.g. "TransCanada PipeLines Limited")
        3. Find products and quantities (e.g. "2 drums of REOLUBE 32B GT DRUM")
        4. Find batch numbers (e.g. "2023087285")
        5. Find weights (e.g. "460 kg")
        6. Find dimensions (e.g. "45×45×40 inches")
        
        IMPORTANT: 
        - "Sold To" = Billing company (who pays)
        - "Ship To" = Delivery contact (who receives)
        - These are DIFFERENT people/addresses - never mix them up!
        
        Email Content:
        {email_text}
        
        Extract and return as JSON:
        {{
            "so_number": "extract sales order number (just the number, e.g. 3012)",
            "so_line_numbers": [CRITICAL] Extract line numbers as INTEGER ARRAY if ANY of these phrases appear: 'line 2', 'line 1', 'lines 1 and 3', 'line item 2', etc. ALWAYS return as array like [2] or [1,3]. If NO line mention, return null. EXAMPLES: 'SO 2707 line 2' → [2], 'SO 3000 lines 1 and 3' → [1,3], 'SO 5000' → null",
            "is_partial_shipment": [CRITICAL] Set to TRUE if so_line_numbers has any values, FALSE if null. This determines if we ship specific lines only or the entire SO.",
            "po_number": "purchase order number if mentioned (e.g. 4500684127)",
            "company_name": "[CRITICAL] CUSTOMER company name - the company BUYING from us. NEVER extract 'Canoil' as company_name - Canoil is the SELLER (us). Look for the customer company name (e.g. 'Mississippi Power purchase order...' → company_name='Mississippi Power', 'TransCanada PipeLines Limited purchase order' → company_name='TransCanada PipeLines Limited')",
            "contact_person": "delivery contact person if mentioned (e.g. Steve McLean)",
            "sold_to_company": "billing company name (who pays the bill)",
            "ship_to_company": "shipping company/contact (who receives goods)",
            "sold_to_address": "billing address if mentioned",
            "ship_to_address": "shipping address if mentioned",
            "items": [
                {{
                    "description": "[CRITICAL] Extract ONLY the product name, stop at first comma or weight/batch keywords. Example: '3 drums of MOV Extra 0, 540 kg total net weight' → extract 'MOV Extra 0' (NOT 'MOV Extra 0, 540 kg...'). Stop at comma, 'kg', 'lbs', 'total', 'batch', etc.",
                    "quantity": "numeric quantity only (e.g. 2)",
                    "unit": "container type only (drum, pail, etc.)",
                    "batch_number": "[CRITICAL] Extract batch number for THIS SPECIFIC ITEM ONLY. If email says 'Line 1: product A, batch WH5H01G002' and 'Line 2: product B, batch NT4J28T025', then item 1 gets WH5H01G002 and item 2 gets NT4J28T025. ALWAYS include batch_number field for each item, even if same batch used for all items."
                }}
            ],
            "total_weight": "[CRITICAL] If GROSS WEIGHT is mentioned, use GROSS weight (it's the total including packaging). If only NET WEIGHT is mentioned, use net weight. Example: '180 kg net weight, 380 kg gross weight' → use '380 kg'. If multiple line weights, sum them all.",
            "pallet_count": "[CRITICAL] TOTAL number of pallets/skids/cases as integer. Look for phrases like 'on X pallets', 'X skids', 'In X case', 'On 2 pallets... On 2 pallets... On 4 pallets' (add them: 2+2+4=8). Search entire email for skid/pallet/case counts. If multiple mentioned, ADD THEM ALL. Required field - must extract if ANY pallet/skid/case mention exists.",
            "pallet_dimensions": "[CRITICAL] Pallet/skid/case dimensions. Look for: '48x40', '45×45×40', '48 x 40 x 48', 'pallet dimensions: 48x40x48', 'skid size 48x40', 'In 1 case 27×22×20 inches', etc. Include units if mentioned (inches/cm). Search entire email. Required field - must extract if ANY dimension mention exists.",
            "packaging_type": "[CRITICAL] Type of packaging: 'case', 'pallet', or 'skid'. Look for phrases like 'In 1 case 27×22×20 inches' → 'case', 'on 2 pallets 48x40' → 'pallet', 'on 3 skids' → 'skid'. If email says 'case' use 'case', if 'pallet' or 'skid' use 'pallet'. Default to 'pallet' if not specified. Required field.",
            "special_instructions": "any special handling notes",
            "ship_date": "ship date if mentioned",
            "carrier": "carrier/shipping company name (e.g., 'R+L Carriers', 'Day & Ross', 'FedEx')",
            "tracking_number": "tracking number, PRO number, or BOL number if mentioned (e.g., 'PRO# 123456', 'Tracking: ABC123', 'BOL# 789')",
            "truck_info": "truck details if any",
            "broker_carrier_ref": "broker or carrier reference number if mentioned",
            "terms_of_sale": "payment terms if mentioned (e.g. Net 30, Net 60)",
            "final_destination": "final destination country if different from shipping address",
            "customs_broker": "[CRITICAL] Extract customs broker/brokerage company name if mentioned. Look for patterns: 'cleared by [broker name]', 'customs clearance by [broker]', 'brokerage by [broker]', 'broker: [name]', 'brokerage: [name]', 'broker will be taking care of by exporter using [broker name]', 'broker will be taking care of by [exporter] using [broker name]', 'broker on the exporter and using [broker name]', 'broker on exporter using [broker name]'. IMPORTANT: If you see 'Brokerage: Near North', 'Broker: Near North', or 'Broker on the Exporter and using Near North', this means the EXPORTER (Canoil) will handle brokerage using Near North Customs Brokers. Common brokers: 'Near North Brokers', 'Near North Customs Brokers US Inc', 'Near North', 'Farrow', 'Livingston International', 'Cole International'. Example: 'This will be cleared by Near North Brokers US Inc' → 'Near North Brokers US Inc'. Example: 'Broker will be taking care of by exporter using Near North' → 'Near North Customs Brokers'. Example: 'Brokerage: Near North' → 'Near North Customs Brokers'. Example: 'Broker on the Exporter and using Near North' → 'Near North Customs Brokers'"
        }}
        
        CRITICAL EXAMPLES FOR LINE NUMBERS (MUST EXTRACT CORRECTLY):
        
        PARTIAL SHIPMENT (line number mentioned with SO - even without spaces):
        - "sales order3005 line 4" → so_number="3005", so_line_numbers=[4], is_partial_shipment=true
        - "Canoil sales order 2707 line 2, attached" → so_number="2707", so_line_numbers=[2], is_partial_shipment=true
        - "SO 5000 line 3" → so_number="5000", so_line_numbers=[3], is_partial_shipment=true
        - "order 3005 line 4 is ready" → so_number="3005", so_line_numbers=[4], is_partial_shipment=true
        
        FULL SHIPMENT (no line number after SO, or "Line X:" is formatting):
        - "Canoil sales order 3012" → so_number="3012", so_line_numbers=null, is_partial_shipment=false
        - "SO 2932, attached)\n\nLine 1: 100 cases\nLine 2: 60 pails" → so_number="2932", so_line_numbers=null, is_partial_shipment=false
        
        NOTE: "Line 1:", "Line 2:" in email body is just FORMATTING (listing items), NOT line numbers!
        
        OTHER EXAMPLES:
        - "TransCanada PipeLines Limitedpurchase order number 4500684127" → company_name="TransCanada PipeLines Limited", po_number="4500684127"
        - "2 drums of REOLUBE 32B GT DRUM" → {{"description": "REOLUBE 32B GT DRUM", "quantity": "2", "unit": "drums"}}
        - "batch number 2023087285" → {{"batch_number": "2023087285"}}
        - "460 kg total net weight" → {{"total_weight": "460 kg"}}
        - "On 1 pallet, 45×45×40 inches" → {{"pallet_count": 1, "pallet_dimensions": "45×45×40 inches"}}
        
        BATCH NUMBER EXTRACTION (CRITICAL):
        For email: "Line 1: 100 cases CSW-400, batch WH5H01G002\nLine 2: 60 pails CSW-17, batch WH5H01G002\nLine 3: 32 kegs CSW-55, batch WH5H01G002"
        MUST extract as:
        "items": [
            {{"description": "CSW-400 PRO-LUB 30x400g tube case", "quantity": "100", "unit": "cases", "batch_number": "WH5H01G002"}},
            {{"description": "CSW-17 PRO-LUB PAIL 17kg", "quantity": "60", "unit": "pails", "batch_number": "WH5H01G002"}},
            {{"description": "CSW-55 PRO-LUB KEG 55kg", "quantity": "32", "unit": "kegs", "batch_number": "WH5H01G002"}}
        ]
        
        PALLET/SKID/CASE EXTRACTION (CRITICAL - MUST ALWAYS EXTRACT):
        Look EVERYWHERE in the email for pallet/skid/case information. Common formats:
        - "On 1 pallet 48x40x48" → {{"pallet_count": 1, "pallet_dimensions": "48x40x48", "packaging_type": "pallet"}}
        - "2 pallets, 48x40 each" → {{"pallet_count": 2, "pallet_dimensions": "48x40", "packaging_type": "pallet"}}
        - "skid dimensions: 45x45x40 inches" → {{"pallet_count": 1, "pallet_dimensions": "45x45x40 inches", "packaging_type": "pallet"}}
        - "On 3 skids 48 x 40 x 48" → {{"pallet_count": 3, "pallet_dimensions": "48 x 40 x 48", "packaging_type": "pallet"}}
        - "pallet size 48x40" → {{"pallet_count": 1, "pallet_dimensions": "48x40", "packaging_type": "pallet"}}
        - "In 1 case 27×22×20 inches" → {{"pallet_count": 1, "pallet_dimensions": "27×22×20 inches", "packaging_type": "case"}}
        - "case 27×22×20 inches" → {{"pallet_count": 1, "pallet_dimensions": "27×22×20 inches", "packaging_type": "case"}}
        
        CRITICAL: Extract packaging_type correctly:
        - If email says "case" or "cases" → packaging_type = "case"
        - If email says "pallet", "pallets", "skid", or "skids" → packaging_type = "pallet"
        - Default to "pallet" if not specified
        
        If multiple pallets mentioned per item: "Line 1: On 2 pallets... Line 2: On 2 pallets... Line 3: On 4 pallets"
        → ADD THEM: 2+2+4 = 8 total pallets → {{"pallet_count": 8, "pallet_dimensions": "...", "packaging_type": "pallet"}}
        
        If NO pallet count but dimensions mentioned: "48x40x48" → {{"pallet_count": 1, "pallet_dimensions": "48x40x48", "packaging_type": "pallet"}}
        
        WEIGHT EXTRACTION (CRITICAL):
        If email says "Line 1: 1,200 kg... Line 2: 1,020 kg... Line 3: 1,760 kg", you MUST add them: 1200+1020+1760 = 3,980 kg total
        Extract total_weight by ADDING all individual line weights.
        
        MULTI-ITEM EMAILS (CRITICAL):
        When email has "Line 1: item A\nLine 2: item B\nLine 3: item C", this means 3 SEPARATE ITEMS.
        You MUST extract ALL items listed. DO NOT skip any items.
        Each "Line X:" with a colon followed by product details is a SEPARATE item to extract.
        
        IGNORE these as products: weight numbers, dimensions, pallet sizes
        
        Return ONLY the JSON, no explanations.
        """
        
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a logistics parsing expert. Extract shipping data with 100% accuracy. CRITICAL RULES: 1) When email has 'Line 1: product A, Line 2: product B, Line 3: product C' you MUST extract ALL 3 items - never skip items! 2) Extract batch number for EACH item separately. 3) Add all pallet counts together (2+2+4=8 total). 4) 'Line X:' with colon means multiple items, NOT partial shipment. 5) Partial shipment is ONLY when SO number is followed by 'line X' like 'SO 2707 line 2'. Return only valid JSON with ALL items."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            max_tokens=3000,  # Increased for multi-item emails
            response_format={"type": "json_object"}
        )
        
        result = response.choices[0].message.content.strip()
        print(f"\n{'='*80}")
        print(f"GPT-4o-mini RAW RESPONSE:")
        print(f"{'='*80}")
        print(result)
        print(f"{'='*80}\n")
        
        # Clean up the response
        if result.startswith('```json'):
            result = result[7:]
        if result.startswith('```'):
            result = result[3:]
        if result.endswith('```'):
            result = result[:-3]
        result = result.strip()
        
        # Parse JSON
        try:
            parsed_data = json.loads(result)
            print(f"[OK] Successfully parsed JSON from GPT")
            print(f"[OK] Extracted SO: {parsed_data.get('so_number', 'N/A')}")
            print(f"[OK] Extracted company_name: {parsed_data.get('company_name', 'N/A')}")
        except Exception as json_err:
            print(f"[X] FAILED to parse JSON: {type(json_err).__name__}: {str(json_err)}")
            raise
        
        # CRITICAL: ALWAYS run manual line number extraction as verification
        # GPT sometimes misses line numbers or returns wrong values
        import re
        
        # More flexible pattern that handles spaces in SO number (e.g., "order3 005 line 4")
        pattern = r'(?:sales\s*order|order|SO)\s*[#No.:]*\s*([\d\s]+?)\s*line\s*(\d+)'
        manual_line_match = re.search(pattern, email_text, re.IGNORECASE)
        
        if manual_line_match:
            # Clean SO number (remove any spaces)
            so_from_match = manual_line_match.group(1).replace(' ', '').strip()
            line_from_match = manual_line_match.group(2)
            print(f"✅ MANUAL LINE DETECTION: Found SO '{so_from_match}' line '{line_from_match}' in email")
        
        # Get GPT's extraction
        gpt_line_numbers = parsed_data.get('so_line_numbers')
        print(f"   GPT extracted so_line_numbers: {gpt_line_numbers}")
        
        # Use manual extraction if GPT missed it or got it wrong
        if manual_line_match:
            manual_line_num = int(line_from_match)
            # Always trust manual extraction for line numbers
            parsed_data['so_line_numbers'] = [manual_line_num]
            parsed_data['is_partial_shipment'] = True
            print(f"✅ USING MANUAL EXTRACTION: SO {so_from_match} line {manual_line_num}")
        elif gpt_line_numbers and isinstance(gpt_line_numbers, list) and len(gpt_line_numbers) > 0:
            # GPT found line numbers and manual didn't - trust GPT
            parsed_data['is_partial_shipment'] = True
            print(f"✅ USING GPT EXTRACTION: line numbers {gpt_line_numbers}")
        else:
            # Neither found line numbers - full shipment
            parsed_data['so_line_numbers'] = None
            parsed_data['is_partial_shipment'] = False
            print(f"✅ NO LINE NUMBERS FOUND - FULL SHIPMENT")
        
        print(f"\n🔍 FINAL LINE NUMBER CHECK:")
        print(f"   so_line_numbers: {parsed_data.get('so_line_numbers')}")
        print(f"   is_partial_shipment: {parsed_data.get('is_partial_shipment')}\n")
        
        # Validate critical fields
        if not parsed_data.get('so_number'):
            raise ValueError("No SO number found in parsed data")
        
        # Extract batch numbers from items for frontend display
        batch_numbers = []
        for item in parsed_data.get('items', []):
            if item.get('batch_number'):
                # Extract just the batch code without quantities
                batch_str = item['batch_number']
                # Find all batch codes (remove quantities like "(5)")
                import re
                batch_codes = re.findall(r'\b([A-Z0-9\-]{5,})\b', str(batch_str))
                batch_numbers.extend(batch_codes)
        
        if batch_numbers:
            # Remove duplicates while preserving order
            unique_batches = []
            seen = set()
            for batch in batch_numbers:
                if batch not in seen:
                    unique_batches.append(batch)
                    seen.add(batch)
            # Use " + " separator (consistent with fallback parser)
            parsed_data['batch_numbers'] = ' + '.join(unique_batches)
        else:
            # If no batch numbers in items, check if there's a general batch number
            if parsed_data.get('batch_number'):
                parsed_data['batch_numbers'] = parsed_data['batch_number']
        
        print(f"✅ GPT EXTRACTED - Using data AS-IS (no filtering):")
        print(f"   Batch numbers: {parsed_data.get('batch_numbers', 'None')}")
        print(f"   Company name: {parsed_data.get('company_name', 'None')}")
        print(f"   Total items extracted: {len(parsed_data.get('items', []))}")
        print(f"   Items with batches: {[(item.get('description', 'N/A'), item.get('batch_number', 'N/A')) for item in parsed_data.get('items', [])]}")
        
        # VALIDATION: Check if email has multiple "Line X:" patterns but GPT only extracted 1 item
        import re
        line_count = len(re.findall(r'Line\s+\d+:', email_text, re.IGNORECASE))
        item_count = len(parsed_data.get('items', []))
        if line_count > 1 and item_count < line_count:
            print(f"⚠️  WARNING: Email has {line_count} 'Line X:' patterns but only {item_count} item(s) extracted!")
            print(f"   GPT may have missed items. Consider using fallback parser or re-prompting.")
        
        # BACKWARD COMPATIBILITY: Ensure frontend gets company_name in expected field
        if not parsed_data.get('company_name'):
            if parsed_data.get('primary_company'):
                parsed_data['company_name'] = parsed_data['primary_company']
                print(f"SUCCESS: GPT-4o set company_name from primary_company: {parsed_data['company_name']}")
            elif parsed_data.get('sold_to', {}).get('company_name'):
                parsed_data['company_name'] = parsed_data['sold_to']['company_name']
                print(f"SUCCESS: GPT-4o set company_name from sold_to: {parsed_data['company_name']}")
        
        # CRITICAL CHECK: Ensure company_name is NEVER "Canoil" (that's us, the seller!)
        try:
            company_name = parsed_data.get('company_name', '')
            if company_name and any(term in company_name.upper() for term in ['CANOIL', 'CANOIL COMPANY', 'CANOIL INC', 'CANOIL CORP']):
                print(f"[X] ERROR: GPT extracted 'CANOIL' as customer! Attempting to extract real customer from email...")
                # Try to extract customer company from email (usually appears before "purchase order number")
                customer_match = re.search(r'^([A-Za-z\s&.,()-]+?)\s+purchase\s+order', email_text, re.IGNORECASE | re.MULTILINE)
                if customer_match:
                    real_customer = customer_match.group(1).strip()
                    parsed_data['company_name'] = real_customer
                    print(f"[OK] Fixed: company_name = '{real_customer}'")
                else:
                    # Clear it so validation will catch it
                    parsed_data['company_name'] = ''
                    print(f"[X] Could not auto-fix - cleared company_name to trigger validation error")
        except Exception as check_error:
            print(f"[X] ERROR in Canoil check: {type(check_error).__name__}: {str(check_error)}")
            import traceback
            traceback.print_exc()
        
        # Create skid_info from packaging_type, pallet_count, and pallet_dimensions (if extracted by GPT-4)
        # Note: "case" = box in shipping terminology
        if parsed_data.get('pallet_dimensions'):
            pkg_type = parsed_data.get('packaging_type', 'pallet')  # Default to pallet if not specified
            pallet_count = parsed_data.get('pallet_count')
            pallet_dims = parsed_data.get('pallet_dimensions')
            # Use "box" for display if packaging_type is "case" (case = box in shipping)
            display_type = 'box' if pkg_type == 'case' else pkg_type
            
            if pallet_count and pallet_count > 0:
                if pallet_count == 1:
                    parsed_data['skid_info'] = f"1 {display_type} {pallet_dims}"
                else:
                    parsed_data['skid_info'] = f"{pallet_count} {display_type}s {pallet_dims} each"
            else:
                parsed_data['skid_info'] = f"{display_type} {pallet_dims}"
        elif parsed_data.get('packaging_type'):
            # If we have packaging_type but no dimensions, still store it
            parsed_data['skid_info'] = ""
        
        print(f"Successfully parsed email - SO: {parsed_data.get('so_number')}, Company: {parsed_data.get('company_name', 'None')}, Items: {len(parsed_data.get('items', []))}")
        print(f"   Packaging type: {parsed_data.get('packaging_type', 'None')}, Skid info: {parsed_data.get('skid_info', 'None')}")
        return parsed_data
        
    except json.JSONDecodeError as je:
        print(f"ERROR: JSON parsing error: {je}")
        print(f"ERROR: Failed to parse GPT response as JSON: {result[:200]}...")
        
        # Retry up to 3 times
        if retry_count < 2:
            print(f"Retrying GPT-4o parsing...")
            return parse_email_with_gpt4(email_text, retry_count + 1)
        else:
            print(f"ERROR: GPT-4o parsing failed after 3 attempts, using fallback")
            return parse_email_fallback(email_text)
            
    except Exception as e:
        import traceback
        print(f"ERROR: GPT-4o parsing error: {type(e).__name__}: {str(e)}")
        print(f"ERROR: Full error: {traceback.format_exc()}")
        
        # Retry for other errors too
        if retry_count < 2:
            print(f"Retrying due to error...")
            return parse_email_with_gpt4(email_text, retry_count + 1)
        else:
            print(f"ERROR: Using fallback parser after failures")
            return parse_email_fallback(email_text)

def parse_email_fallback(email_text):
    """Enhanced fallback regex parsing with comprehensive patterns and Sold To/Ship To support"""
    print("DEBUG: Using enhanced fallback parser with B2B support...")
    data = {
        'so_number': None,
        'sold_to': {
            'company_name': None,
            'contact_person': None,
            'address': None
        },
        'ship_to': {
            'company_name': None,
            'contact_person': None,
            'address': None,
            'phone': None
        },
        'primary_company': None,
        'delivery_contact': None,
        'company_name': None,  # Backward compatibility
        'contact_person': None,  # Backward compatibility
        'po_number': None,
        'items': [],
        'total_weight': None,
        'pallet_count': None,
        'pallet_dimensions': None,
        'special_instructions': None,
        'ship_date': None,
        'carrier': None,
        'truck_info': None
    }
    
    # Enhanced SO patterns - more comprehensive
    so_patterns = [
        r'(?:sales\s*order|SO|S\.O\.|order)\s*#?\s*(\d{3,6})',
        r'SO\s*[-#:]?\s*(\d{3,6})',
        r'order\s+(\d{3,6})',
        r'Sales\s+Order\s+(\d{3,6})',
        r'SO(\d{3,6})',
        r'#(\d{3,6})\s*(?:sales|order)',
        r'^\s*(\d{3,6})\s*$'  # Just the number on its own line
    ]
    
    for pattern in so_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE | re.MULTILINE)
        if match:
            data['so_number'] = match.group(1)
            print(f"SUCCESS: Fallback found SO: {data['so_number']}")
            break
    
    # Extract PO number from email - enhanced patterns
    po_patterns = [
        r'PO\s*Number:?\s*(\d{8,12})',  # PO Number: 4500684127
        r'purchase\s*order\s*number:?\s*(\d{8,12})',
        r'PO\s*#?\s*(\d{8,12})',
        r'P\.O\.\s*(\d{8,12})',
        r'order\s*number:?\s*(\d{8,12})'
    ]
    
    for pattern in po_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            data['po_number'] = match.group(1)
            print(f"SUCCESS: Fallback found PO: {data['po_number']}")
            break
    
    # Smart extraction for Sold To and Ship To information
    # Enhanced parsing for TransCanada-style emails with multi-line addresses
    lines = email_text.split('\n')
    
    # Look for "Sold To:" section
    sold_to_section = False
    ship_to_section = False
    current_section = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        if 'sold to:' in line.lower():
            sold_to_section = True
            current_section = 'sold_to'
            print(f"DEBUG: Found Sold To section at line {i}")
            continue
        elif 'ship to:' in line.lower():
            ship_to_section = True
            current_section = 'ship_to'
            print(f"DEBUG: Found Ship To section at line {i}")
            continue
        elif line.lower().startswith(('sales order', 'po number', 'items:', 'total weight')):
            current_section = None
            continue
            
        # Parse content based on current section
        if current_section == 'sold_to' and line:
            if not data['sold_to']['company_name'] and any(company_word in line for company_word in ['Limited', 'Ltd', 'Corp', 'Inc', 'Company']):
                data['sold_to']['company_name'] = line
                data['primary_company'] = line
                print(f"SUCCESS: Fallback found Sold To company: {line}")
            elif not data['sold_to']['contact_person'] and any(name in line for name in ['Ross', 'Smith', 'Johnson', 'Williams']):
                data['sold_to']['contact_person'] = line
                print(f"SUCCESS: Fallback found Sold To contact: {line}")
            elif not data['sold_to']['address'] and any(addr_word in line for addr_word in ['Box', 'Street', 'Road', 'Avenue', 'Calgary', 'Toronto']):
                data['sold_to']['address'] = line
                print(f"SUCCESS: Fallback found Sold To address: {line}")
                
        elif current_section == 'ship_to' and line:
            if not data['ship_to']['contact_person'] and any(name in line for name in ['Steve', 'McLean', 'John', 'David', 'Mike']):
                data['ship_to']['contact_person'] = line
                data['delivery_contact'] = line
                print(f"SUCCESS: Fallback found Ship To contact: {line}")
            elif any(addr_word in line for addr_word in ['STN', 'Street', 'Road', 'TWP', 'Haileybury', 'ON ', 'P0J']):
                # Collect all address lines for Ship To
                if data['ship_to']['address']:
                    data['ship_to']['address'] += ', ' + line
                else:
                    data['ship_to']['address'] = line
                print(f"SUCCESS: Fallback found Ship To address part: {line}")
    
    # Fallback to regex patterns if sections not found
    if not data['sold_to']['company_name']:
        sold_to_patterns = [
            r'sold\s+to:?\s*([A-Z][A-Za-z\s&,.-]+?)(?:\n|$)',
            r'bill\s+to:?\s*([A-Z][A-Za-z\s&,.-]+?)(?:\n|$)',
            r'customer:?\s*([A-Z][A-Za-z\s&,.-]+?)(?:\n|$)'
        ]
        
        for pattern in sold_to_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                data['sold_to']['company_name'] = match.group(1).strip()
                data['primary_company'] = match.group(1).strip()
                print(f"SUCCESS: Fallback regex found Sold To: {data['sold_to']['company_name']}")
                break
    
    if not data['ship_to']['contact_person']:
        ship_to_patterns = [
            r'ship\s+to:?\s*([A-Z][A-Za-z\s&,.-]+?)(?:\n|$)',
            r'deliver\s+to:?\s*([A-Z][A-Za-z\s&,.-]+?)(?:\n|$)',
            r'contact:?\s*([A-Z][A-Za-z\s&,.-]+?)(?:\n|$)'
        ]
        
        for pattern in ship_to_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                contact_info = match.group(1).strip()
                # Check if it looks like a person name vs company name
                if any(indicator in contact_info.lower() for indicator in ['ltd', 'inc', 'corp', 'company', 'llc']):
                    data['ship_to']['company_name'] = contact_info
                else:
                    data['ship_to']['contact_person'] = contact_info
                    data['delivery_contact'] = contact_info
                print(f"SUCCESS: Fallback regex found Ship To: {contact_info}")
                break
    
    # Extract general company name if no specific Sold To/Ship To found
    if not data['sold_to']['company_name'] and not data['ship_to']['company_name']:
        # SMART COMPANY EXTRACTION - Handle missing spaces and common patterns
        company_name = None
        
        # Pattern 1: Handle "TransCanada PipeLines Limitedpurchase" specifically
        transcanada_match = re.search(r'(TransCanada\s+PipeLines?\s+Limited)', email_text, re.IGNORECASE)
        if transcanada_match:
            company_name = transcanada_match.group(1)
            print(f"SUCCESS: Found TransCanada with regex: {company_name}")
        
        # Pattern 2: Handle company names that run into other words (missing spaces)
        elif not company_name:
            # Look for company indicators followed by other words (missing space)
            space_fix_patterns = [
                r'([A-Z][A-Za-z\s&,.-]*Limited)(?:purchase|order|po|number)',  # "Limitedpurchase"
                r'([A-Z][A-Za-z\s&,.-]*Inc)(?:purchase|order|po|number)',     # "Incpurchase"  
                r'([A-Z][A-Za-z\s&,.-]*Corp)(?:purchase|order|po|number)',    # "Corppurchase"
                r'([A-Z][A-Za-z\s&,.-]*Company)(?:purchase|order|po|number)', # "Companypurchase"
            ]
            
            for pattern in space_fix_patterns:
                match = re.search(pattern, email_text, re.IGNORECASE)
                if match:
                    company_name = match.group(1).strip()
                    print(f"SUCCESS: Found company with missing space fix: {company_name}")
                    break
        
        # Pattern 3: Standard company patterns (fallback)
        if not company_name:
            company_patterns = [
                r'([A-Z][A-Za-z\s&,.-]+(?:INC|LLC|LTD|CORP|CO\.?|COMPANY|LIMITED))',
                r'ACTUATOR\s+SPECIALTIES'  # Specific known company
            ]
            
            for pattern in company_patterns:
                match = re.search(pattern, email_text, re.IGNORECASE)
                if match:
                    company_name = match.group(1).strip()
                    # Simple cleanup - just remove obvious junk
                    if not any(junk in company_name.lower() for junk in ['hi ', 'dear ', 'hello ']):
                        print(f"SUCCESS: Found company with standard pattern: {company_name}")
                        break
        
        # Set the company name if found
        if company_name:
            data['company_name'] = company_name  # Backward compatibility
            data['primary_company'] = company_name
            data['sold_to']['company_name'] = company_name
    
    # Extract addresses for both Sold To and Ship To
    address_patterns = [
        r'(?:address|location):\s*([A-Za-z0-9\s,.-]+?)(?:\n\n|\n[A-Z])',
        r'(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)[A-Za-z0-9\s,.-]*?)(?:\n|$)',
        r'([A-Za-z\s]+,\s*[A-Z]{2}\s+[A-Z0-9\s]+)(?:\n|$)'  # City, State ZIP pattern
    ]
    
    for pattern in address_patterns:
        matches = re.finditer(pattern, email_text, re.IGNORECASE)
        for i, match in enumerate(matches):
            address = match.group(1).strip()
            if i == 0 and not data['sold_to']['address']:
                data['sold_to']['address'] = address
            elif i == 1 and not data['ship_to']['address']:
                data['ship_to']['address'] = address
            elif not data['ship_to']['address']:  # Default to ship_to if only one address
                data['ship_to']['address'] = address
    
    # Extract items with batch numbers - enhanced patterns for Canoil email format
    # Look for patterns like:
    # "2 drums of Canoil Heavy Duty EP2"
    # "batch number WH5B25G049"
    
    print(f"DEBUG: Extracting items from full email text")
    
    # Extract item description and quantity from the entire email
    item_patterns = [
        r'(\d+)\s*(drums?|pails?|gallons?|containers?|cases?|kegs?|barrels?|totes?)\s+(?:of\s+)?([A-Za-z0-9\s\-\.&#]+)',
    ]
    
    items_found = []
    lines = email_text.split('\n')
    
    # Process each line to find items and their associated batch numbers
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Look for item patterns
        for pattern in item_patterns:
            matches = re.finditer(pattern, line, re.IGNORECASE)
            for match in matches:
                quantity, unit, description = match.groups()
                
                # Clean up description
                description = description.strip()
                
                # Look for batch number in the next few lines
                batch_number = None
                for j in range(i, min(i + 3, len(lines))):  # Check current and next 2 lines
                    next_line = lines[j].strip()
                    batch_match = re.search(r'batch\s*number\s*([A-Za-z0-9\-]+)', next_line, re.IGNORECASE)
                    if batch_match:
                        batch_number = batch_match.group(1)
                        break
                
                items_found.append({
                    'quantity': quantity,
                    'unit': unit,
                    'description': description,
                    'batch_number': batch_number
                })
                print(f"SUCCESS: Fallback found item: '{description}' (batch: {batch_number})")
    
    # Set items in data
    data['items'] = items_found
    
    # Extract all batch numbers for backward compatibility
    batch_patterns = [
        r'batch\s*number\s*([A-Za-z0-9]+)',  # "batch number 2023087285"
        r'batch\s*#\s*([A-Za-z0-9]+)',       # "batch # 2023087285"
        r'batch\s*:\s*([A-Za-z0-9]+)',       # "batch: 2023087285"
    ]
    
    all_batch_numbers = []
    for item in items_found:
        if item.get('batch_number'):
            all_batch_numbers.append(item['batch_number'])
    
    # Also extract any standalone batch numbers
    for pattern in batch_patterns:
        matches = re.findall(pattern, email_text, re.IGNORECASE)
        for batch in matches:
            if batch not in all_batch_numbers:
                all_batch_numbers.append(batch)
                print(f"SUCCESS: Fallback found additional batch number: {batch}")
    
    # Set batch numbers in data
    if all_batch_numbers:
        data['batch_numbers'] = ' + '.join(all_batch_numbers)
        data['batch_number'] = all_batch_numbers[0]  # For backward compatibility
    
    # Extract weight - PREFER GROSS WEIGHT if both mentioned, otherwise use whatever is there
    # First check for gross weight
    gross_match = re.search(r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)\s*(?:gross|total\s+gross)', email_text, re.IGNORECASE)
    if not gross_match:
        gross_match = re.search(r'gross\s*(?:weight)?:?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)', email_text, re.IGNORECASE)
    
    if gross_match:
        weight_val = gross_match.group(1).replace(',', '')
        data['total_weight'] = f"{weight_val} {gross_match.group(2)}"
        print(f"SUCCESS: Fallback found GROSS weight: {data['total_weight']}")
    else:
        # No gross weight - use net weight or any weight mentioned
        weight_patterns = [
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)\s*(?:net|total)',
            r'(?:net|total)\s*weight:?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)',
            r'weight:?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)',
            r'(\d+(?:,\d+)?(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)'
        ]
        
        for pattern in weight_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                weight_val = match.group(1).replace(',', '')
                data['total_weight'] = f"{weight_val} {match.group(2)}"
                print(f"SUCCESS: Fallback found weight: {data['total_weight']}")
                break
    
    # Extract pallets with enhanced patterns
    pallet_patterns = [
        r'(\d+)\s*(?:pallets?|skids?)',
        r'(?:pallets?|skids?):\s*(\d+)',
        r'on\s*(\d+)\s*(?:pallets?|skids?)',
        r'(\d+)\s*(?:standard\s*)?(?:pallets?|skids?)'
    ]
    
    for pattern in pallet_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            data['pallet_count'] = int(match.group(1))
            print(f"SUCCESS: Fallback found pallets: {data['pallet_count']}")
            break
    
    # Extract pallet dimensions
    dim_match = re.search(r'(\d+)\s*[xX×]\s*(\d+)(?:\s*[xX×]\s*(\d+))?', email_text)
    if dim_match:
        dims = [dim_match.group(1), dim_match.group(2)]
        if dim_match.group(3):
            dims.append(dim_match.group(3))
        data['pallet_dimensions'] = 'x'.join(dims) + ' inches'
    
    # Extract ship date - enhanced patterns
    ship_date_patterns = [
        r'ship\s*date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
        r'delivery\s*date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
        r'expected\s*ship:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})'
    ]
    
    for pattern in ship_date_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            data['ship_date'] = match.group(1)
            print(f"SUCCESS: Fallback found ship date: {data['ship_date']}")
            break
    
    # Extract carrier information
    carrier_patterns = [
        r'Logistics\s+Pick\s*up:?\s*([A-Za-z0-9\s&,.-]+?)\s*[-–]\s*([A-Za-z0-9-]+)',  # "Logistics Pick up: Gateway - P358521"
        r'carrier:?\s*([A-Za-z\s&,.-]+?)(?:\n|$)',
        r'shipping\s*company:?\s*([A-Za-z\s&,.-]+?)(?:\n|$)',
        r'transport:?\s*([A-Za-z\s&,.-]+?)(?:\n|$)'
    ]
    
    for pattern in carrier_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            # Special handling for "Logistics Pick up: Gateway - P358521" format
            if 'Logistics' in pattern:
                data['carrier'] = match.group(1).strip()
                data['tracking_number'] = match.group(2).strip()
                print(f"SUCCESS: Fallback found carrier: {data['carrier']}, tracking: {data['tracking_number']}")
            else:
                data['carrier'] = match.group(1).strip()
                print(f"SUCCESS: Fallback found carrier: {data['carrier']}")
            break
    
    # Extract tracking number separately if not found with carrier
    if not data.get('tracking_number'):
        tracking_patterns = [
            r'PRO\s*#?\s*:?\s*([A-Za-z0-9-]+)',
            r'Tracking\s*#?\s*:?\s*([A-Za-z0-9-]+)',
            r'BOL\s*#?\s*:?\s*([A-Za-z0-9-]+)',
            r'Reference\s*#?\s*:?\s*([A-Za-z0-9-]+)'
        ]
        for pattern in tracking_patterns:
            match = re.search(pattern, email_text, re.IGNORECASE)
            if match:
                data['tracking_number'] = match.group(1).strip()
                print(f"SUCCESS: Fallback found tracking: {data['tracking_number']}")
                break
    
    # BACKWARD COMPATIBILITY: Ensure frontend gets company_name in expected field
    if not data.get('company_name'):
        if data.get('primary_company'):
            data['company_name'] = data['primary_company']
            print(f"SUCCESS: Set company_name from primary_company: {data['company_name']}")
        elif data.get('sold_to', {}).get('company_name'):
            data['company_name'] = data['sold_to']['company_name']
            print(f"SUCCESS: Set company_name from sold_to: {data['company_name']}")
    
    print(f"INFO: Fallback parser results: SO={data['so_number']}, Company={data.get('company_name', 'None')}, Items={len(data['items'])}, Weight={data['total_weight']}")
    return data

def get_so_data_from_system(so_number):
    """Get SO data by extracting from PDF file - PARSES ACTUAL SO PDF - NO MOCK DATA"""
    import tempfile
    import os
    import time
    
    # Check cache first (avoid re-parsing same PDFs)
    global _so_data_cache, _so_cache_timestamps
    if so_number in _so_data_cache:
        cache_age = time.time() - _so_cache_timestamps.get(so_number, 0)
        if cache_age < _SO_CACHE_TTL:
            print(f"⚡ OPTIMIZATION: Using cached SO data for {so_number} (age: {cache_age:.1f}s)")
            return _so_data_cache[so_number]
        else:
            # Cache expired, remove it
            del _so_data_cache[so_number]
            del _so_cache_timestamps[so_number]
    
    try:
        print(f"SEARCH: LOGISTICS: Looking up SO {so_number} by parsing PDF...")
        
        # Check if Google Drive API is enabled - handle import errors gracefully
        USE_GOOGLE_DRIVE_API = False
        IS_CLOUD_ENVIRONMENT = False
        google_drive_service = None
        try:
            from app import USE_GOOGLE_DRIVE_API, get_google_drive_service, IS_CLOUD_ENVIRONMENT
            # CRITICAL: Call the function to get the lazily-initialized service!
            if USE_GOOGLE_DRIVE_API:
                google_drive_service = get_google_drive_service()
                print(f"[INFO] LOGISTICS: Got Google Drive service: {google_drive_service is not None}, authenticated: {google_drive_service.authenticated if google_drive_service and hasattr(google_drive_service, 'authenticated') else 'N/A'}")
        except ImportError as import_err:
            print(f"INFO: Could not import Google Drive settings: {import_err}")
            # Try alternative import path
            try:
                import sys
                if 'app' in sys.modules:
                    app_module = sys.modules['app']
                    USE_GOOGLE_DRIVE_API = getattr(app_module, 'USE_GOOGLE_DRIVE_API', False)
                    IS_CLOUD_ENVIRONMENT = getattr(app_module, 'IS_CLOUD_ENVIRONMENT', False)
                    get_google_drive_service = getattr(app_module, 'get_google_drive_service', None)
                    if USE_GOOGLE_DRIVE_API and get_google_drive_service:
                        google_drive_service = get_google_drive_service()
            except Exception as e:
                print(f"INFO: Alternative import also failed: {e}")
        
        so_file_path = None
        so_file_content = None
        
        if USE_GOOGLE_DRIVE_API and google_drive_service and hasattr(google_drive_service, 'authenticated') and google_drive_service.authenticated:
            # Use Google Drive API to find SO file
            print(f"[INFO] LOGISTICS: Using Google Drive API to find SO {so_number}...")
            try:
                # Find Sales_CSR drive
                sales_csr_drive_id = google_drive_service.find_shared_drive("Sales_CSR")
                if sales_csr_drive_id:
                    # Find Customer Orders/Sales Orders folder
                    customer_orders_folder_id = google_drive_service.find_folder_by_path(sales_csr_drive_id, "Customer Orders")
                    if customer_orders_folder_id:
                        sales_orders_folder_id = google_drive_service.find_folder_by_path(sales_csr_drive_id, "Customer Orders/Sales Orders")
                        if sales_orders_folder_id:
                            # OPTIMIZATION: Use direct Google Drive search instead of recursive scan (10-20x faster)
                            # Search for files matching SO number pattern directly
                            print(f"[INFO] LOGISTICS: Searching for SO {so_number} using Google Drive query (fast search)...")
                            matching_files = []
                            
                            # Build search query for files containing SO number - search entire drive
                            search_patterns = [
                                f"salesorder_{so_number}",
                                f"SO_{so_number}",
                                so_number
                            ]
                            
                            for pattern in search_patterns:
                                # Search entire Sales_CSR drive for files matching pattern
                                query = f"name contains '{pattern}' and (mimeType='application/pdf' or name contains '.pdf') and trashed=false"
                                
                                list_params = {
                                    'q': query,
                                    'supportsAllDrives': True,
                                    'includeItemsFromAllDrives': True,
                                    'fields': "files(id, name, parents, modifiedTime)",
                                    'pageSize': 50
                                }
                                
                                if sales_csr_drive_id:
                                    list_params['corpora'] = 'drive'
                                    list_params['driveId'] = sales_csr_drive_id
                                
                                try:
                                    results = google_drive_service.service.files().list(**list_params).execute()
                                    files = results.get('files', [])
                                    
                                    for file_info in files:
                                        file_name = file_info.get('name', '')
                                        # Double-check the file name contains SO number and is in Sales Orders
                                        if (so_number in file_name or f"SO_{so_number}" in file_name or f"salesorder_{so_number}" in file_name):
                                            matching_files.append({
                                                'file_id': file_info.get('id'),
                                                'file_name': file_name,
                                                'modified_time': file_info.get('modifiedTime', '')
                                            })
                                    
                                    if matching_files:
                                        break  # Found files, no need to try other patterns
                                except Exception as search_error:
                                    print(f"[WARN] LOGISTICS: Direct search failed for pattern '{pattern}': {search_error}")
                                    continue
                            
                            # If direct search found nothing, fall back to recursive scan (slower but more thorough)
                            if not matching_files:
                                print(f"[INFO] LOGISTICS: Direct search found nothing, falling back to recursive scan...")
                                files_by_folder = google_drive_service._scan_folder_recursively(sales_orders_folder_id, "Sales Orders", sales_csr_drive_id, depth=0, max_depth=3)
                                
                                for folder_path, files in files_by_folder.items():
                                    for file_info in files:
                                        file_name = file_info.get('file_name', '')
                                        if file_name.lower().endswith('.pdf'):
                                            if so_number in file_name or f"SO_{so_number}" in file_name or f"salesorder_{so_number}" in file_name:
                                                matching_files.append(file_info)
                            
                            # Sort by revision (same logic as local)
                            if matching_files:
                                def get_version_priority(file_info):
                                    filename = file_info.get('file_name', '').lower()
                                    import re
                                    rev_match = re.search(r'_r(\d+)', filename)
                                    if rev_match:
                                        return 1000 + int(rev_match.group(1))
                                    return 1
                                
                                matching_files.sort(key=get_version_priority, reverse=True)
                                selected_file = matching_files[0]
                                file_id = selected_file.get('file_id')
                                file_name = selected_file.get('file_name', '')
                                
                                print(f"[OK] LOGISTICS: Found SO file in Google Drive: {file_name}")
                                
                                # Download file content with retry for SSL errors
                                so_file_content = None
                                download_error = None
                                for download_attempt in range(3):
                                    try:
                                        print(f"[INFO] LOGISTICS: Downloading SO file (attempt {download_attempt + 1}/3)...")
                                        so_file_content = google_drive_service.download_file_content(file_id)
                                        if so_file_content:
                                            print(f"[OK] LOGISTICS: Download successful ({len(so_file_content)} bytes)")
                                            break
                                    except Exception as download_err:
                                        download_error = download_err
                                        print(f"[WARN] LOGISTICS: Download attempt {download_attempt + 1} failed: {download_err}")
                                        if download_attempt < 2:
                                            import time
                                            time.sleep(2 * (download_attempt + 1))  # Longer backoff for SSL errors
                                
                                # If download failed after all retries, return proper error
                                if not so_file_content:
                                    error_msg = f"SO {so_number} found in Google Drive but download failed after 3 attempts"
                                    if download_error:
                                        error_msg += f": {str(download_error)}"
                                    print(f"[ERROR] LOGISTICS: {error_msg}")
                                    return {
                                        "status": "Error",
                                        "error": error_msg,
                                        "hint": "SSL/network error downloading from Google Drive - file exists but cannot be downloaded"
                                    }
                                
                                if so_file_content:
                                    # Save to PERSISTENT CACHE for frontend viewing
                                    # Create cache directory if not exists
                                    try:
                                        cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'so_pdfs')
                                        os.makedirs(cache_dir, exist_ok=True)
                                        
                                        # Create safe filename
                                        safe_filename = "".join([c for c in file_name if c.isalpha() or c.isdigit() or c in (' ', '.', '_', '-')]).strip()
                                        if not safe_filename.endswith('.pdf'):
                                            safe_filename += '.pdf'
                                            
                                        cached_path = os.path.join(cache_dir, safe_filename)
                                        
                                        with open(cached_path, 'wb') as f:
                                            f.write(so_file_content)
                                            
                                        so_file_path = cached_path
                                        print(f"[OK] LOGISTICS: Downloaded SO file to CACHE location: {so_file_path}")
                                    except Exception as cache_error:
                                        print(f"[WARN] LOGISTICS: Could not save to cache, falling back to temp: {cache_error}")
                                        # Fallback to temp file if cache fails
                                        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                                            tmp_file.write(so_file_content)
                                            so_file_path = tmp_file.name
                                        print(f"[OK] LOGISTICS: Downloaded SO file to temp location: {so_file_path}")
            except Exception as e:
                print(f"[WARN] LOGISTICS: Google Drive API search failed: {e}, falling back to local")
        
        # On cloud (Render/Vercel): NEVER try G: drive - it doesn't exist. Return clear error if API failed.
        if not so_file_path and IS_CLOUD_ENVIRONMENT:
            print(f"[ERROR] LOGISTICS: Cloud environment - G: drive not available. Google Drive API must be authenticated.")
            return {
                "status": "Error",
                "error": f"SO {so_number} not accessible on cloud. Google Drive API authentication required.",
                "hint": "Set GOOGLE_DRIVE_SA_JSON or GOOGLE_DRIVE_TOKEN in Render environment variables. See LOCAL_VS_VERCEL_LOGISTICS_ANALYSIS.md"
            }
        
        # Fallback to local filesystem search (LOCAL ONLY - G: drive)
        if not so_file_path:
            sales_orders_base = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders"
            matching_files = []
            
            # Check if G: drive is accessible (will be False when accessed remotely via ngrok)
            if not os.path.exists(sales_orders_base):
                print(f"[WARN] LOGISTICS: G: drive not accessible (normal for remote/ngrok access)")
                print(f"[INFO] LOGISTICS: Set USE_GOOGLE_DRIVE_API=true to enable remote SO access")
                return {
                    "status": "Error", 
                    "error": f"SO {so_number} not accessible. G: drive not available and Google Drive API not configured.",
                    "hint": "Enable Google Drive API for remote access"
                }
            
            if os.path.exists(sales_orders_base):
                for root, dirs, files in os.walk(sales_orders_base):
                    for file in files:
                        if file.lower().endswith('.pdf'):
                            if so_number in file or f"SO_{so_number}" in file or f"salesorder_{so_number}" in file:
                                file_path = os.path.join(root, file)
                                matching_files.append(file_path)
                                print(f"Found SO PDF: {file_path}")
                
                # Sort files to prioritize latest revision
                if matching_files:
                    def get_version_priority(filepath):
                        filename = os.path.basename(filepath).lower()
                        import re
                        rev_match = re.search(r'_r(\d+)', filename)
                        if rev_match:
                            return 1000 + int(rev_match.group(1))
                        return 1
                    
                    matching_files.sort(key=get_version_priority, reverse=True)
                    so_file_path = matching_files[0]
                    print(f"SUCCESS: Selected latest version: {os.path.basename(so_file_path)}")
        
        if not so_file_path:
            print(f"ERROR: LOGISTICS: SO {so_number} PDF file not found")
            return {"status": "Not found", "error": f"SO {so_number} PDF not found"}
        
        # Parse SO PDF using raw_so_extractor (GPT-4o based - better for international addresses)
        try:
            print(f"LOGISTICS: Parsing SO PDF with GPT-4o based parser (raw_so_extractor)")
            # Import parse_sales_order_pdf with error handling
            # PRIORITY: Use raw_so_extractor.py (better GPT-based parsing with table extraction)
            # FALLBACK: Use app.py parser if raw_so_extractor fails
            try:
                from raw_so_extractor import parse_sales_order_pdf
                print(f"✅ Using raw_so_extractor (GPT-4o) for better address parsing")
            except ImportError as import_err:
                print(f"⚠️ Could not import raw_so_extractor: {import_err} - falling back to app.py parser")
                try:
                    from app import parse_sales_order_pdf
                except ImportError as app_import_err:
                    print(f"ERROR: Could not import parse_sales_order_pdf: {app_import_err}")
                    import sys
                    if 'app' in sys.modules:
                        app_module = sys.modules['app']
                        parse_sales_order_pdf = getattr(app_module, 'parse_sales_order_pdf', None)
                        if not parse_sales_order_pdf:
                            return {"status": "Error", "error": f"parse_sales_order_pdf function not available: {app_import_err}"}
                    else:
                        return {"status": "Error", "error": f"Could not import parse_sales_order_pdf: {app_import_err}"}
            
            print(f"DEBUG: Calling parse_sales_order_pdf with file: {so_file_path}")
            print(f"DEBUG: File exists: {os.path.exists(so_file_path) if so_file_path else 'N/A'}")
            
            so_data = parse_sales_order_pdf(so_file_path)
            
            print(f"DEBUG: parse_sales_order_pdf returned: {type(so_data).__name__}")
            if so_data:
                print(f"DEBUG: so_data keys: {list(so_data.keys()) if isinstance(so_data, dict) else 'Not a dict'}")
                print(f"DEBUG: so_data status: {so_data.get('status') if isinstance(so_data, dict) else 'N/A'}")
            else:
                print(f"ERROR: LOGISTICS: PDF parsing failed - parse_sales_order_pdf returned None or empty")
                return {"status": "Error", "error": f"Could not parse PDF data - parser returned None. File: {os.path.basename(so_file_path) if so_file_path else 'unknown'}"}
            
            # CRITICAL: Check if parsing returned error structure (shouldn't happen with new code, but safety check)
            if isinstance(so_data, dict) and (so_data.get('status') == 'Parse Error' or so_data.get('customer_name') == 'Error - parsing failed'):
                error_msg = so_data.get('error', 'Unknown parsing error')
                print(f"ERROR: LOGISTICS: PDF parsing failed: {error_msg}")
                return {"status": "Error", "error": f"PDF parsing failed: {error_msg}"}

            so_data['status'] = "Found in system"
            so_data['data_source'] = "Original PDF parsing"
            
            # Store file path (or Google Drive reference)
            if USE_GOOGLE_DRIVE_API and so_file_path:
                # Temp file - will clean up after parsing
                so_data['file_path'] = so_file_path
                so_data['source'] = "Google Drive API"
            else:
                so_data['file_path'] = so_file_path
                so_data['source'] = "Local filesystem"
            total_amount = so_data.get('total_amount', 0)
            formatted_total = f"${total_amount:,.2f}" if total_amount else "$0.00"
            print(f"SUCCESS: LOGISTICS: Original parsing successful - Total: {formatted_total}")
            
            # Add HTS codes to all items (same logic as process_email)
            print("\nMatching HTS codes for items...")
            for item in so_data.get('items', []):
                hts_info = get_hts_code_for_item(
                    item.get('description', ''), 
                    item.get('item_code', '')
                )
                if hts_info:
                    item['hts_code'] = hts_info['hts_code']
                    item['country_of_origin'] = hts_info.get('country_of_origin', 'Canada')
                    print(f"  MATCHED {item.get('item_code')}: HTS {hts_info['hts_code']}")
                else:
                    # Don't add HTS for non-product items like Pallet, Freight, etc.
                    if not any(keyword in item.get('description', '').upper() 
                              for keyword in ['PALLET', 'FREIGHT', 'BROKERAGE', 'CHARGE']):
                        print(f"  NO MATCH {item.get('item_code')}: No HTS code found")
            
            # DEBUG: Show what SO data was parsed
            print(f"\nDEBUG SO DATA PARSED:")
            print(f"  SO Number: {so_data.get('so_number')}")
            print(f"  Customer: {so_data.get('customer_name')}")
            print(f"  Items Count: {len(so_data.get('items', []))}")
            print(f"  Billing Company: {so_data.get('billing_address', {}).get('company')}")
            print(f"  Shipping Company: {so_data.get('shipping_address', {}).get('company')}")
            print(f"  Sold To Company: {so_data.get('sold_to', {}).get('company_name')}")
            print(f"  Ship To Company: {so_data.get('ship_to', {}).get('company_name')}")
            for i, item in enumerate(so_data.get('items', [])[:5], 1):
                hts = item.get('hts_code', 'NO HTS')
                print(f"  Item {i}: {item.get('item_code')} - {item.get('description')} - {item.get('quantity')} {item.get('unit')} - HTS: {hts}")
            print()
            
            # Clean up temp file if it was created from Google Drive
            if USE_GOOGLE_DRIVE_API and so_file_path and os.path.exists(so_file_path) and tempfile.gettempdir() in so_file_path:
                try:
                    os.unlink(so_file_path)
                    print(f"[OK] LOGISTICS: Cleaned up temp file: {so_file_path}")
                except:
                    pass
            
            # Cache successful result (only cache valid SO data, not errors)
            if isinstance(so_data, dict) and so_data.get('status') not in ['Error', 'Not found']:
                _so_data_cache[so_number] = so_data
                _so_cache_timestamps[so_number] = time.time()
                print(f"💾 Cached SO data for {so_number} (TTL: {_SO_CACHE_TTL}s)")
            
            return so_data
        except Exception as e:
            # Clean up temp file if it was created from Google Drive
            if USE_GOOGLE_DRIVE_API and so_file_path and os.path.exists(so_file_path) and tempfile.gettempdir() in so_file_path:
                try:
                    os.unlink(so_file_path)
                except:
                    pass
            
            import traceback
            error_trace = traceback.format_exc()
            print(f"\n{'='*80}")
            print(f"ERROR: PDF PARSING FAILED")
            print(f"{'='*80}")
            print(f"Error Type: {type(e).__name__}")
            print(f"Error Message: {str(e)}")
            print(f"\nFull Traceback:")
            print(error_trace)
            print(f"{'='*80}\n")
            return {"status": "Error", "error": f"PDF read error: {str(e)}", "traceback": error_trace}
    
    except Exception as e:
        # Clean up temp file if it was created from Google Drive
        if 'so_file_path' in locals() and so_file_path and os.path.exists(so_file_path):
            try:
                if tempfile.gettempdir() in so_file_path:
                    os.unlink(so_file_path)
            except:
                pass
        
        import traceback
        error_trace = traceback.format_exc()
        print(f"\n{'='*80}")
        print(f"ERROR: get_so_data_from_system FAILED")
        print(f"{'='*80}")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {str(e)}")
        print(f"\nFull Traceback:")
        print(error_trace)
        print(f"{'='*80}\n")
        return {"status": "Error", "error": str(e), "traceback": error_trace}

# Test endpoint to verify blueprint is working
@logistics_bp.route('/api/logistics/test', methods=['GET'])
def test_logistics_endpoint():
    """Test endpoint to verify logistics module is loaded"""
    return jsonify({
        'status': 'success',
        'message': 'Logistics module is working',
        'openai_available': OPENAI_AVAILABLE
    }), 200

def _build_multi_so_pallet_info(multi_so_email_data: dict):
    """
    Build combined skid/pallet info string for MULTI-SO shipments.
    Uses ONLY data already parsed by GPT (items_by_so) - no guessing.
    Returns (skid_info: str, total_skids: int, pallet_dimensions: str)
    """
    try:
        items_by_so = multi_so_email_data.get('items_by_so', {}) or {}
    except AttributeError:
        items_by_so = {}

    dims_parts = []
    total_skids = 0

    for so_num, email_items in items_by_so.items():
        if not email_items:
            continue
        for email_item in email_items:
            pallet_count = email_item.get('pallet_count')
            pallet_dims = email_item.get('pallet_dimensions')

            # Normalize count to int where possible
            count_int = 0
            if pallet_count is not None:
                try:
                    count_int = int(str(pallet_count).strip())
                except (ValueError, TypeError):
                    count_int = 0

            if count_int > 0:
                total_skids += count_int

            if pallet_dims:
                dims_str = str(pallet_dims).strip()
                if dims_str and dims_str not in dims_parts:
                    dims_parts.append(dims_str)

    if not dims_parts and total_skids <= 0:
        # Nothing usable found – let existing logic handle it (no skid info)
        return "", 0, ""

    # Build a human-readable pallet dimensions string
    pallet_dimensions = ", ".join(dims_parts)

    # Build skid_info using actual count when available
    if total_skids <= 0:
        skid_info = pallet_dimensions
    elif total_skids == 1:
        skid_info = f"1 pallet {pallet_dimensions}"
    else:
        skid_info = f"{total_skids} pallets {pallet_dimensions} each"

    return skid_info, total_skids, pallet_dimensions


def detect_and_apply_broker_info(email_content: str, email_data: dict, so_data: dict, gpt_email_data: dict = None):
    """
    SHARED BROKER DETECTION LOGIC - Used by BOTH single-SO and multi-SO paths.
    
    Detects if Near North Customs Brokers should be used based on:
    1. "Near North" mentioned in email
    2. Georgia Western customer (always uses Near North)
    3. Prepaid brokerage in SO items
    4. "Broker on the Exporter and using Near North" patterns
    5. Freight + Brokerage charges in SO
    
    Updates email_data in place with broker info.
    
    Args:
        email_content: Raw email text
        email_data: Dict to update with broker info (modified in place)
        so_data: SO data dict with items, customer_name, etc.
        gpt_email_data: Optional GPT-parsed email data (for customs_broker field)
    
    Returns:
        bool: True if Near North should be used
    """
    import re
    
    # Build search text from SO data
    brokerage_search_text = ' '.join([
        so_data.get('special_instructions', ''),
        so_data.get('terms', ''),
        so_data.get('notes', ''),
        so_data.get('memo', '')
    ]).upper()
    
    # Check items for prepaid brokerage AND freight+brokerage charges
    has_freight_charge = False
    has_brokerage_charge = False
    for item in so_data.get('items', []):
        item_desc = str(item.get('description', '')).upper()
        item_code = str(item.get('item_code', '')).upper()
        if 'BROKERAGE' in item_desc and 'PREPAID' in item_desc:
            brokerage_search_text += ' PREPAID BROKERAGE'
        if 'PREPAID' in item_desc and 'BROKER' in item_desc:
            brokerage_search_text += ' PREPAID BROKERAGE'
        # Check for freight charge line item
        if 'FREIGHT' in item_desc or 'FREIGHT' in item_code:
            has_freight_charge = True
        # Check for brokerage charge line item  
        if 'BROKERAGE' in item_desc or 'BROKER' in item_desc:
            has_brokerage_charge = True
    
    # If SO has BOTH freight charge AND brokerage charge → Canoil handles brokerage (Near North)
    so_has_freight_and_brokerage = has_freight_charge and has_brokerage_charge
    if so_has_freight_and_brokerage:
        print(f"   📦 SO has BOTH freight + brokerage charges - Canoil handles brokerage")
    
    # Detect customer and special rules
    customer_name = so_data.get('customer_name', '') or so_data.get('company_name', '') or email_data.get('company_name', '') or ''
    is_georgia_western = 'georgia western' in customer_name.lower()
    
    # Detect if Canoil handles brokerage
    email_upper = email_content.upper()
    canoil_handles_brokerage = (
        ('PREPAID' in brokerage_search_text and 'BROKERAGE' in brokerage_search_text) or
        ('PREPAID' in brokerage_search_text and 'BROKER' in brokerage_search_text) or
        'PREPAID BROKERAGE' in brokerage_search_text or
        'EXPORTER' in brokerage_search_text or
        so_has_freight_and_brokerage
    )
    
    # Check GPT-extracted customs_broker field
    gpt_broker = ''
    if gpt_email_data:
        gpt_broker = (gpt_email_data.get('customs_broker') or '').upper()
    elif email_data:
        gpt_broker = (email_data.get('customs_broker') or '').upper()
    
    # Keywords that indicate broker mention
    broker_keywords = ['BROKER', 'BROKERAGE', 'CUSTOMS BROKER', 'CUSTOM BROKER', 
                      'CLEARANCE', 'CLEARED BY', 'CUSTOMS CLEARANCE']
    
    # Check if Near North is specifically mentioned (in email or GPT extraction)
    exporter_using_pattern = re.search(
        r'broker\s+will\s+be\s+taking\s+care\s+of\s+by\s+(?:exporter\s+)?using\s+([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
        email_content, re.IGNORECASE
    )
    # Pattern for "Broker: Near North and by Exporter"
    broker_by_exporter_pattern = re.search(
        r'[Bb]roker\s*:?\s*([Nn]ear\s+[Nn]orth|[Nn]earnorth)\s+(?:and\s+)?by\s+[Ee]xporter',
        email_content, re.IGNORECASE
    )
    brokerage_near_north_pattern = re.search(
        r'(?:[Bb]rokerage|[Bb]roker)\s*:?\s*(?:on\s+(?:the\s+)?exporter\s+(?:and\s+)?using\s+)?([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
        email_content, re.IGNORECASE
    )
    broker_on_exporter_pattern = re.search(
        r'[Bb]roker\s+on\s+(?:the\s+)?[Ee]xporter\s+(?:and\s+)?using\s+([Nn]ear\s+[Nn]orth|[Nn]earnorth)',
        email_content, re.IGNORECASE
    )
    
    near_north_in_email = (
        'NEAR NORTH' in email_upper or 
        'NEARNORTH' in email_upper or
        'NEAR NORTH' in gpt_broker or
        'NEARNORTH' in gpt_broker or
        exporter_using_pattern is not None or
        broker_by_exporter_pattern is not None or
        brokerage_near_north_pattern is not None or
        broker_on_exporter_pattern is not None
    )
    
    # Check if any broker keyword is mentioned in email
    has_broker_keyword = any(kw in email_upper for kw in broker_keywords)
    
    print(f"\n{'='*60}")
    print(f"🔍 BROKER DETECTION (SHARED LOGIC):")
    print(f"   Customer: {customer_name}")
    print(f"   Is Georgia Western: {is_georgia_western}")
    print(f"   GPT extracted broker: '{gpt_broker}'")
    print(f"   Near North in email/GPT: {near_north_in_email}")
    print(f"   Has broker keywords: {has_broker_keyword}")
    print(f"   Canoil handles brokerage: {canoil_handles_brokerage}")
    print(f"   SO has freight+brokerage: {so_has_freight_and_brokerage}")
    print(f"{'='*60}")
    
    # Determine if Near North should be used
    use_near_north = near_north_in_email or canoil_handles_brokerage or is_georgia_western
    
    # Apply broker info to email_data
    email_data['use_near_north'] = use_near_north
    
    if use_near_north:
        email_data['customs_broker'] = 'Near North Customs Brokers'
        email_data['customs_broker_phone'] = '716-204-4020'
        email_data['customs_broker_fax'] = '716-204-5551'
        email_data['customs_broker_email'] = 'entry@nearnorthus.com'
        
        if near_north_in_email:
            print(f"   ✅ Near North mentioned in email - will use Near North Customs Brokers")
        elif is_georgia_western:
            print(f"   ✅ Georgia Western customer - will use Near North Customs Brokers")
        elif canoil_handles_brokerage:
            print(f"   ✅ Canoil handles brokerage (prepaid) - will use Near North Customs Brokers")
    else:
        print(f"   ℹ️ No Near North broker detected - broker section will be empty")
    
    return use_near_north


def match_batch_numbers_to_so_items(email_items: list, so_items: list) -> dict:
    """
    SHARED BATCH MATCHING LOGIC - Used by BOTH single-SO and multi-SO paths.
    
    Matches batch numbers from email items to SO items using multiple methods:
    1. Exact description match
    2. Contained description match
    3. Core product name match
    4. Item code match
    5. Abbreviation matching
    
    Args:
        email_items: List of items from email with batch_number field
        so_items: List of SO items to update with batch numbers
    
    Returns:
        dict with 'matched_count', 'unmatched_items', 'so_items' (updated)
    """
    import re
    
    if not email_items or not so_items:
        return {'matched_count': 0, 'unmatched_items': [], 'so_items': so_items}
    
    print(f"   🔄 BATCH MATCHING: {len(email_items)} email items → {len(so_items)} SO items")
    
    # Build email item mapping by description
    email_items_by_desc = {}
    for email_item in email_items:
        desc = (email_item.get('description') or '').upper().strip()
        batch = (email_item.get('batch_number') or '').strip()
        
        if desc and batch:
            item_info = {
                'batch_number': batch,
                'quantity': email_item.get('quantity', ''),
                'unit': email_item.get('unit', ''),
                'original_desc': email_item.get('description', ''),
                'full_desc': desc
            }
            email_items_by_desc[desc] = item_info
            
            # Also map by core product name
            core_name = extract_core_product_name(desc)
            if core_name and core_name != desc:
                email_items_by_desc[core_name] = item_info
    
    matched_count = 0
    unmatched_items = []
    
    for so_item in so_items:
        matched = False
        so_desc = so_item.get('description', '').upper().strip()
        so_code = so_item.get('item_code', '').upper().strip()
        
        # Skip charge items
        if any(skip in so_desc for skip in ['FREIGHT', 'CHARGE', 'PALLET', 'BROKERAGE']):
            continue
        
        # Method 1: Exact description match
        if so_desc in email_items_by_desc:
            match_info = email_items_by_desc[so_desc]
            so_item['batch_number'] = match_info['batch_number']
            matched = True
            matched_count += 1
        
        # Method 2: Contained description match
        if not matched:
            for email_desc, match_info in email_items_by_desc.items():
                if email_desc in so_desc or so_desc in email_desc:
                    so_item['batch_number'] = match_info['batch_number']
                    matched = True
                    matched_count += 1
                    break
        
        # Method 3: Core product name matching
        if not matched:
            so_core = extract_core_product_name(so_desc)
            for email_desc, match_info in email_items_by_desc.items():
                email_core = extract_core_product_name(email_desc)
                if email_core and so_core and len(email_core) >= 5:
                    if email_core in so_core or so_core in email_core:
                        so_item['batch_number'] = match_info['batch_number']
                        matched = True
                        matched_count += 1
                        break
        
        # Method 4: Item code matching
        if not matched and so_code:
            for email_desc, match_info in email_items_by_desc.items():
                email_clean = re.sub(r'[\s\-_]', '', email_desc)
                code_clean = re.sub(r'[\s\-_]', '', so_code)
                
                if (email_clean == code_clean or 
                    email_clean in code_clean or 
                    code_clean in email_clean or
                    (len(email_clean) >= 5 and len(code_clean) >= 5 and 
                     (email_clean[:5] == code_clean[:5] or email_clean[-5:] == code_clean[-5:]))):
                    so_item['batch_number'] = match_info['batch_number']
                    matched = True
                    matched_count += 1
                    break
        
        # Method 5: Abbreviation matching
        if not matched:
            abbrev_map = {
                'VSG': ['VANE SPINDLE GREASE', 'VANE SPINDLE', 'SPINDLE GREASE'],
                'MOV': ['MOTOR OIL', 'MOV LONG LIFE', 'MOV EXTRA'],
                'HDEP': ['HEAVY DUTY EP', 'HEAVY DUTY'],
                'MPWB': ['MULTIPURPOSE', 'MULTI PURPOSE', 'MULTI-PURPOSE'],
            }
            
            for email_desc, match_info in email_items_by_desc.items():
                email_upper = email_desc.upper().strip()
                
                for abbrev, full_names in abbrev_map.items():
                    if abbrev in so_desc or abbrev in so_code:
                        for full_name in full_names:
                            if full_name in email_upper:
                                so_item['batch_number'] = match_info['batch_number']
                                matched = True
                                matched_count += 1
                                break
                    if abbrev in email_upper:
                        for full_name in full_names:
                            if full_name in so_desc:
                                so_item['batch_number'] = match_info['batch_number']
                                matched = True
                                matched_count += 1
                                break
                    if matched:
                        break
                if matched:
                    break
        
        if not matched:
            unmatched_items.append(so_item.get('description', 'Unknown'))
    
    if unmatched_items:
        print(f"   ⚠️ {len(unmatched_items)} SO items have no batch match")
    else:
        print(f"   ✅ All {matched_count} items matched with batch numbers")
    
    return {
        'matched_count': matched_count,
        'unmatched_items': unmatched_items,
        'so_items': so_items
    }


def apply_hts_codes_to_items(items: list) -> None:
    """
    SHARED HTS CODE LOGIC - Used by BOTH single-SO and multi-SO paths.
    
    Adds HTS codes and country of origin to items.
    Modifies items list in place.
    
    Args:
        items: List of item dicts to update with HTS codes
    """
    print("   📋 Matching HTS codes for items...")
    for item in items:
        # Skip charge items
        if any(keyword in (item.get('description') or '').upper() 
              for keyword in ['PALLET', 'FREIGHT', 'BROKERAGE', 'CHARGE']):
            continue
        
        hts_info = get_hts_code_for_item(
            item.get('description', ''), 
            item.get('item_code', '')
        )
        if hts_info:
            item['hts_code'] = hts_info['hts_code']
            item['country_of_origin'] = hts_info.get('country_of_origin', 'Canada')


def process_multi_so_email(email_content: str, so_numbers: list):
    """
    Process email containing MULTIPLE Sales Orders.
    Fetches data for each SO, validates items, and returns combined result.
    
    Args:
        email_content: Raw email text
        so_numbers: List of SO numbers found in email ["3004", "3020"]
    
    Returns:
        Flask JSON response with combined SO data
    """
    import concurrent.futures
    
    print(f"\n{'='*80}")
    print(f"MULTI-SO PROCESSING: {so_numbers}")
    print(f"{'='*80}")
    
    # Parse email to get items grouped by SO
    multi_so_email_data = parse_multi_so_email_with_gpt4(email_content)
    print(f"📧 Multi-SO Email Data: {json.dumps(multi_so_email_data, indent=2, default=str)}")
    
    # CRITICAL DEBUG: Verify items_by_so has entries for ALL SOs
    items_by_so_raw = multi_so_email_data.get('items_by_so', {})
    print(f"\n🔍 CRITICAL DEBUG: items_by_so verification")
    print(f"   SOs expected: {so_numbers}")
    print(f"   items_by_so keys from GPT: {list(items_by_so_raw.keys())}")
    for so_num in so_numbers:
        so_num_str = str(so_num)
        items_count = len(items_by_so_raw.get(so_num_str, []))
        print(f"   SO {so_num_str}: {items_count} items in items_by_so")
        if items_count == 0:
            print(f"   ⚠️ WARNING: SO {so_num_str} has NO items in items_by_so!")
            # Try alternative key formats
            for key in items_by_so_raw.keys():
                key_str = str(key).strip()
                if key_str == so_num_str or key_str.lstrip('0') == so_num_str.lstrip('0'):
                    print(f"   ✅ Found items under key '{key}' instead, will normalize")
                    break
    
    # Fetch SO data for ALL SOs in parallel
    # CRITICAL: Increase timeout for multi-SO (SSL retries can take longer)
    # 4 SOs × 60s each = 240s max, but with retries we need more headroom
    so_data_list = []
    timeout_per_so = 120  # 2 minutes per SO to handle SSL retries
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(so_numbers)) as executor:
        # Start all fetches
        future_to_so = {executor.submit(get_so_data_from_system, so_num): so_num for so_num in so_numbers}
        
        # Collect results
        for future in concurrent.futures.as_completed(future_to_so):
            so_num = future_to_so[future]
            try:
                so_data = future.result(timeout=timeout_per_so)
                if so_data and isinstance(so_data, dict) and so_data.get('status') != 'Error':
                    so_data_list.append(so_data)
                    print(f"✅ Fetched SO {so_num}: {len(so_data.get('items', []))} items")
                else:
                    print(f"❌ Failed to fetch SO {so_num}: {so_data.get('error', 'Unknown error')}")
            except concurrent.futures.TimeoutError:
                print(f"⏱️ Timeout fetching SO {so_num} after {timeout_per_so}s - SSL retries may be taking too long")
            except Exception as e:
                print(f"❌ Exception fetching SO {so_num}: {e}")
    
    if not so_data_list:
        return jsonify({'error': f"Could not fetch any SO data for: {so_numbers}"}), 500
    
    # Validate items per SO
    validation_details = {
        'is_multi_so': True,
        'so_numbers': so_numbers,
        'per_so_validation': [],
        'overall_status': 'passed'
    }
    
    items_by_so = multi_so_email_data.get('items_by_so', {})
    
    # CRITICAL: Normalize items_by_so keys to strings for consistent matching
    # GPT might return keys as strings or numbers, so normalize everything
    normalized_items_by_so = {}
    for key, value in items_by_so.items():
        # Normalize key to string (handle both "3024" and 3024)
        normalized_key = str(key).strip()
        normalized_items_by_so[normalized_key] = value
    
    # CRITICAL: Ensure ALL SOs have entries, even if GPT missed them
    for so_num in so_numbers:
        so_num_str = str(so_num).strip()
        if so_num_str not in normalized_items_by_so:
            print(f"   ⚠️ CRITICAL: SO {so_num_str} missing from items_by_so! GPT may have failed to extract items.")
            print(f"   Available keys: {list(normalized_items_by_so.keys())}")
            # Try to find by alternative formats
            found = False
            for key in normalized_items_by_so.keys():
                key_str = str(key).strip()
                if key_str == so_num_str or key_str.lstrip('0') == so_num_str.lstrip('0'):
                    print(f"   ✅ Found items under alternative key '{key}', copying to '{so_num_str}'")
                    normalized_items_by_so[so_num_str] = normalized_items_by_so[key]
                    found = True
                    break
            if not found:
                print(f"   ⚠️ No items found for SO {so_num_str} - will process from SO PDF as fallback")
                normalized_items_by_so[so_num_str] = []  # Empty list, will be handled by fallback logic
    
    items_by_so = normalized_items_by_so
    print(f"   ✅ Final normalized items_by_so keys: {list(items_by_so.keys())}")
    for key, items in items_by_so.items():
        print(f"      SO {key}: {len(items)} items")
    
    for so_data in so_data_list:
        # Normalize SO number to string for consistent matching
        so_num_raw = so_data.get('so_number', '')
        so_num = str(so_num_raw).strip() if so_num_raw else ''
        
        # Try multiple lookup strategies
        email_items_for_so = items_by_so.get(so_num, [])
        
        # If not found, try without leading zeros or with different formats
        if not email_items_for_so and so_num:
            # Try as integer string (remove leading zeros if any)
            try:
                so_num_int = str(int(so_num))
                if so_num_int != so_num:
                    email_items_for_so = items_by_so.get(so_num_int, [])
            except:
                pass
        
        print(f"🔍 DEBUG: SO {so_num} (raw: {repr(so_num_raw)}) - Found {len(email_items_for_so)} items in email")
        so_items = so_data.get('items', [])
        
        print(f"\n📦 Processing SO {so_num}...")
        
        # =====================================================================
        # SHARED LOGIC: Batch number matching (same as single-SO)
        # =====================================================================
        batch_result = match_batch_numbers_to_so_items(email_items_for_so, so_items)
        
        # =====================================================================
        # SHARED LOGIC: HTS code application (same as single-SO)
        # =====================================================================
        apply_hts_codes_to_items(so_items)
        
        # Build list of SO item descriptions for validation
        so_item_names = [item.get('description', '').upper() for item in so_items 
                        if not any(skip in item.get('description', '').upper() 
                                  for skip in ['FREIGHT', 'CHARGE', 'PALLET', 'BROKERAGE'])]
        
        matched_count = 0
        unmatched_items = []
        
        for email_item in email_items_for_so:
            # SKIP sample items in validation - they're special instructions, not SO items
            if email_item.get('is_sample'):
                print(f"   🎁 Skipping sample item in validation: {email_item.get('description')}")
                continue
                
            email_desc = (email_item.get('description') or '').upper().strip()
            matched = False
            
            for so_desc in so_item_names:
                # Flexible matching: substring OR significant keyword overlap
                email_words = set(email_desc.replace('-', ' ').split())
                so_words = set(so_desc.replace('-', ' ').split())
                common_words = email_words & so_words
                significant = [w for w in common_words if len(w) > 3]
                
                if (email_desc in so_desc or so_desc in email_desc or 
                    len(significant) >= 2):  # At least 2 significant words match
                    matched = True
                    matched_count += 1
                    break
            
            if not matched:
                unmatched_items.append({'email_item': email_item.get('description', '')})
        
        so_validation = {
            'so_number': so_num,
            'status': 'passed' if not unmatched_items else 'failed',
            'total_email_items': len(email_items_for_so),
            'matched_items': matched_count,
            'unmatched_items': unmatched_items,
            'batch_matched': batch_result['matched_count'],
            'batch_unmatched': len(batch_result['unmatched_items'])
        }
        validation_details['per_so_validation'].append(so_validation)
        
        if unmatched_items:
            validation_details['overall_status'] = 'warning'
        
        print(f"📊 SO {so_num} validation: {matched_count}/{len(email_items_for_so)} items, {batch_result['matched_count']} batches matched")
    
    # Combine SO data for document generation
    combined_so_data = combine_so_data_for_documents(so_data_list, multi_so_email_data)
    
    # Calculate combined totals from GPT-parsed data
    combined_totals = multi_so_email_data.get('combined_totals', {})
    
    # CRITICAL: Ensure weights and pallets are properly summed
    # If GPT didn't sum them correctly, calculate from items_by_so
    total_weight_str = combined_totals.get('total_gross_weight', '')
    total_pallets = combined_totals.get('total_pallet_count', 0)
    
    # If totals are missing or zero, calculate from individual SO items
    if not total_weight_str or total_pallets == 0:
        print(f"   🔄 Calculating combined totals from items_by_so...")
        weight_values = []
        total_pallets_calc = 0
        
        for so_num, items in items_by_so.items():
            for item in items:
                item_weight = item.get('gross_weight', '')
                item_pallets = item.get('pallet_count', 0)
                
                if item_weight:
                    # Extract numeric value from weight string (e.g., "4,506 kg" -> 4506)
                    weight_match = re.search(r'([\d,]+(?:\.\d+)?)', str(item_weight))
                    if weight_match:
                        weight_val = float(weight_match.group(1).replace(',', ''))
                        weight_values.append(weight_val)
                
                if item_pallets:
                    try:
                        total_pallets_calc += int(str(item_pallets).strip())
                    except (ValueError, TypeError):
                        pass
        
        if weight_values:
            total_weight_kg = sum(weight_values)
            total_weight_str = f"{total_weight_kg:,.0f} kg"
            print(f"   ✅ Calculated total weight: {total_weight_str} (from {len(weight_values)} items)")
        
        if total_pallets_calc > 0:
            total_pallets = total_pallets_calc
            print(f"   ✅ Calculated total pallets: {total_pallets}")
    
    # Build email_data structure for frontend compatibility
    email_data = {
        'so_number': ' & '.join(so_numbers),  # "3004 & 3020" (Windows-safe)
        'so_numbers': so_numbers,
        'is_multi_so': True,
        'po_number': ' & '.join(multi_so_email_data.get('po_numbers', [])) if multi_so_email_data.get('po_numbers') else '',
        'company_name': multi_so_email_data.get('company_name', ''),
        'items': [],  # Combined items
        'total_weight': total_weight_str,
        'pallet_count': total_pallets,
        'items_by_so': items_by_so,
        'totes_info': multi_so_email_data.get('totes_info', ''),  # Include totes information
        # Preserve original email text so downstream generators (BOL/CI)
        # can run broker/exporter detection exactly like single-SO flow.
        'raw_text': email_content,
        'email_body': email_content
    }
    
    # Flatten items for backward compatibility (EXCLUDE samples - they only affect steel count)
    # ALSO apply AEC deduplication here to avoid duplicates from email parsing
    for so_num, items in items_by_so.items():
        for item in items:
            # SKIP sample items - they should NOT appear as line items
            if item.get('is_sample'):
                print(f"   🎁 Skipping sample item from line items: {item.get('description')}")
                continue
            item['so_number'] = so_num  # Tag which SO this item belongs to
            email_data['items'].append(item)
    
    # AEC-SPECIFIC DEDUPLICATION: Remove items from email_data that will be duplicated in combined_so_data
    # This prevents the BOL from showing both "Solution" (from email) and "Soultion" (from SO PDF)
    if 'AEC' in (multi_so_email_data.get('company_name') or '').upper():
        print("   🏭 AEC order detected - applying typo-tolerant deduplication to email_data")
        # Don't add email items to email_data - they'll come from combined_so_data with proper pricing
        email_data['items'] = []
        print("   ✅ Cleared email_data items (will use combined_so_data items only)")
    
    # Count pallets from raw email
    pallet_matches = re.findall(r'[Oo]n\s+(\d+)\s+(?:pallet|skid)', email_content)
    if pallet_matches:
        email_data['pallet_count'] = sum(int(p) for p in pallet_matches)
        print(f"📦 Total pallets from email: {email_data['pallet_count']}")

    # For MULTI-SO, also build combined skid_info / pallet_dimensions from GPT-parsed items_by_so
    try:
        skid_info, total_skids, pallet_dimensions = _build_multi_so_pallet_info(multi_so_email_data)
        if skid_info:
            email_data['skid_info'] = skid_info
            print(f"📦 Combined skid_info for MULTI-SO: {skid_info}")
        if total_skids > 0:
            # Trust explicit per-SO counts from GPT over regex count, but don't zero out an existing non-zero value
            prev_count = email_data.get('pallet_count', 0) or 0
            email_data['pallet_count'] = total_skids if total_skids >= prev_count else prev_count
            print(f"📦 Combined pallet_count for MULTI-SO: {email_data['pallet_count']}")
        if pallet_dimensions:
            email_data['pallet_dimensions'] = pallet_dimensions
            print(f"📦 Combined pallet_dimensions for MULTI-SO: {pallet_dimensions}")
    except Exception as e:
        # Never let skid_info building break the flow
        print(f"⚠️ Failed to build MULTI-SO skid_info: {e}")
    
    # =========================================================================
    # BROKER DETECTION - Uses SHARED function (same logic as single-SO)
    # =========================================================================
    try:
        detect_and_apply_broker_info(
            email_content=email_content,
            email_data=email_data,
            so_data=combined_so_data,
            gpt_email_data=multi_so_email_data
        )
    except Exception as e:
        print(f"⚠️ Failed broker detection: {e}")
    
    # =========================================================================
    # DOCUMENT REQUEST DETECTION - What documents does the user want?
    # =========================================================================
    requested_documents = extract_requested_documents(email_content)
    email_data['requested_documents'] = requested_documents
    
    # Build result
    result = {
        'success': True,
        'is_multi_so': True,
        'so_numbers': so_numbers,
        'so_data': combined_so_data,
        'so_data_list': so_data_list,  # Individual SO data for reference
        'email_data': email_data,
        'email_analysis': email_data,
        'items': combined_so_data.get('items', []),
        'email_shipping': {
            'total_weight': email_data.get('total_weight'),
            'pallet_count': email_data.get('pallet_count'),
            'company_name': email_data.get('company_name')
        },
        'validation_details': validation_details,
        'validation_passed': validation_details['overall_status'] != 'failed',
        'auto_detection': {
            'so_number': ' & '.join(so_numbers),
            'is_multi_so': True
        },
        'requested_documents': requested_documents
    }
    
    print(f"\n{'='*80}")
    print(f"✅ MULTI-SO PROCESSING COMPLETE")
    print(f"   SOs: {so_numbers}")
    print(f"   Total items: {len(combined_so_data.get('items', []))}")
    print(f"   Validation: {validation_details['overall_status']}")
    print(f"{'='*80}\n")
    
    return jsonify(result), 200


def combine_so_data_for_documents(so_data_list: list, multi_so_email_data: dict) -> dict:
    """
    Combine multiple SO data into a single structure for document generation.
    
    CRITICAL: Multi-SO support means SAME functions as single-SO parsing, but with multi-SO support.
    - If SOs are the same customer/order, addresses should be the same
    - Use the SAME address parsing logic as single-SO (don't combine or merge addresses)
    - Just use the address from the first SO (they should all be the same if it's the same order)
    
    Args:
        so_data_list: List of individual SO data dicts
        multi_so_email_data: Parsed email data with items_by_so
    
    Returns:
        Combined SO data dict for BOL/Packing Slip/Commercial Invoice generation
    """
    if not so_data_list:
        return {}
    
    # Use first SO as base - addresses should be the same for all SOs in multi-SO
    # This is the SAME logic as single-SO parsing - just use the address from the PDF
    base_so = so_data_list[0]
    so_numbers = [so.get('so_number', '') for so in so_data_list]
    
    # CRITICAL: Use the EXACT same address structure as single-SO parsing
    # Don't combine addresses - if SOs are the same, they should have the same address
    # Just use the first SO's address (parsed from PDF, same as single-SO)
    # IMPORTANT: Use deep copy to ensure nested structures are properly copied
    import copy
    
    def deep_copy_address(addr_dict):
        """Deep copy address dictionary to ensure all nested fields are preserved"""
        if not addr_dict:
            return {}
        return copy.deepcopy(addr_dict)
    
    combined = {
        'so_number': ' & '.join(so_numbers),  # "3004 & 3020" (Windows-safe)
        'so_numbers': so_numbers,
        'is_multi_so': True,
        'customer_name': base_so.get('customer_name', ''),
        # Use addresses from first SO - same as single-SO parsing
        # These are already parsed correctly from the PDF (no stock comments, no merging)
        # CRITICAL: Use deep copy to preserve all nested address fields
        'billing_address': deep_copy_address(base_so.get('billing_address')),
        'shipping_address': deep_copy_address(base_so.get('shipping_address')),
        'sold_to': deep_copy_address(base_so.get('sold_to')),
        'ship_to': deep_copy_address(base_so.get('ship_to')),
        'order_date': base_so.get('order_date', ''),
        'ship_date': base_so.get('ship_date', ''),
        'items': [],
        'subtotal': 0.0,
        'total': 0.0
    }
    
    # DEBUG: Log address structure to verify they're being copied correctly
    print(f"\n🔍 DEBUG: Address structure after combining:")
    print(f"   billing_address keys: {list(combined.get('billing_address', {}).keys())}")
    print(f"   shipping_address keys: {list(combined.get('shipping_address', {}).keys())}")
    if combined.get('billing_address'):
        billing = combined['billing_address']
        print(f"   billing_address.company: {billing.get('company', 'N/A')}")
        print(f"   billing_address.street: {billing.get('street', 'N/A')}")
        print(f"   billing_address.city: {billing.get('city', 'N/A')}")
    if combined.get('shipping_address'):
        shipping = combined['shipping_address']
        print(f"   shipping_address.company: {shipping.get('company', 'N/A')}")
        print(f"   shipping_address.street: {shipping.get('street', 'N/A')}")
        print(f"   shipping_address.city: {shipping.get('city', 'N/A')}")
    
    # Combine PO numbers
    po_numbers = multi_so_email_data.get('po_numbers', [])
    if po_numbers:
        combined['po_number'] = ' & '.join(po_numbers)
    else:
        # Try to get from individual SOs
        po_list = [so.get('po_number', '') for so in so_data_list if so.get('po_number')]
        combined['po_number'] = ' & '.join(po_list) if po_list else ''
    
    # Combine items from all SOs, grouped by SO
    # CRITICAL: Only include items that are MENTIONED IN THE EMAIL for each SO
    # Don't blindly pull all items from SO PDFs - only what the email says to ship
    items_by_so = multi_so_email_data.get('items_by_so', {})
    total_subtotal = 0.0
    
    # CRITICAL: Normalize items_by_so keys to strings for consistent matching
    # GPT might return keys as strings or numbers, so normalize everything
    normalized_items_by_so = {}
    for key, value in items_by_so.items():
        # Normalize key to string (handle both "3024" and 3024)
        normalized_key = str(key).strip()
        normalized_items_by_so[normalized_key] = value
    items_by_so = normalized_items_by_so
    
    # Debug: Log what SOs we have in items_by_so
    print(f"\n🔍 DEBUG: items_by_so keys: {list(items_by_so.keys())}")
    for key, items in items_by_so.items():
        print(f"   📦 SO {key}: {len(items)} items from email")
    
    # FIRST: Sum total_amount from each SO (this includes pallets, charges, everything)
    combined_total_from_sos = 0.0
    for so_data in so_data_list:
        so_total = so_data.get('total_amount', 0)
        if so_total:
            try:
                combined_total_from_sos += float(so_total)
                print(f"   💵 SO {so_data.get('so_number', '')}: ${float(so_total):,.2f}")
            except:
                pass
    print(f"   💰 Combined SO totals: ${combined_total_from_sos:,.2f}")
    
    for so_data in so_data_list:
        # Normalize SO number to string for consistent matching
        so_num_raw = so_data.get('so_number', '')
        so_num = str(so_num_raw).strip() if so_num_raw else ''
        
        # Try multiple lookup strategies
        email_items = items_by_so.get(so_num, [])
        
        # If not found, try without leading zeros or with different formats
        if not email_items and so_num:
            # Try as integer string (remove leading zeros if any)
            try:
                so_num_int = str(int(so_num))
                if so_num_int != so_num:
                    email_items = items_by_so.get(so_num_int, [])
            except:
                pass
        
        # Debug: Log lookup result
        print(f"\n🔍 DEBUG: Looking up SO {so_num} (raw: {repr(so_num_raw)})")
        print(f"   Found {len(email_items)} items in items_by_so")
        
        # FALLBACK: If no items found for this SO, try to find items by searching all items_by_so
        # This handles cases where GPT might have used a slightly different SO number format
        if not email_items:
            print(f"   ⚠️ SO {so_num}: No direct match in items_by_so")
            print(f"   Available keys in items_by_so: {list(items_by_so.keys())}")
            
            # Try to find items by matching SO numbers more flexibly
            for key in items_by_so.keys():
                key_str = str(key).strip()
                so_num_str = str(so_num).strip()
                # Check if SO numbers match (with or without leading zeros, case insensitive)
                if key_str == so_num_str or key_str.lstrip('0') == so_num_str.lstrip('0'):
                    email_items = items_by_so[key]
                    print(f"   ✅ Found items using flexible matching: key '{key}' → {len(email_items)} items")
                    break
            
            # If still no items, this SO might not have been mentioned in the email
            # But we should still process its items from the PDF (user might have missed it in email)
            if not email_items:
                print(f"   ⚠️ SO {so_num}: No items found in email parsing - will process all items from SO PDF")
                # Process all items from SO PDF as fallback
                for so_item in so_data.get('items', []):
                    # Skip freight/charges
                    desc = so_item.get('description', '').upper()
                    if any(skip in desc for skip in ['FREIGHT', 'CHARGE', 'PALLET CHARGE', 'BROKERAGE']):
                        continue
                    
                    item_copy = so_item.copy()
                    item_copy['source_so'] = so_num
                    combined['items'].append(item_copy)
                    
                    # Add to subtotal
                    try:
                        item_total = float(str(so_item.get('total', 0)).replace('$', '').replace(',', ''))
                        total_subtotal += item_total
                    except:
                        pass
                
                print(f"   ✅ Added {len([i for i in combined['items'] if i.get('source_so') == so_num])} items from SO PDF as fallback")
                continue
        
        print(f"   📋 SO {so_num}: Processing {len(email_items)} items from email")
        
        # For each email item, find matching SO PDF item to enrich with pricing/HTS
        for email_item in email_items:
            # Skip samples - they're handled separately below
            if email_item.get('is_sample') == True:
                print(f"   🎁 Skipping sample item: {email_item.get('description', 'Unknown')}")
                continue
                
            email_desc = (email_item.get('description') or '').upper()
            email_words = set(email_desc.split())
            
            # Find matching item from SO PDF
            matched_so_item = None
            for so_item in so_data.get('items', []):
                # Skip freight/charges
                desc = so_item.get('description', '').upper()
                if any(skip in desc for skip in ['FREIGHT', 'CHARGE', 'PALLET CHARGE', 'BROKERAGE']):
                    continue
                
                so_words = set(desc.split())
                common_words = email_words & so_words
                
                # Match if: substring match OR at least 2 significant words in common
                significant_common = [w for w in common_words if len(w) > 3]
                matches = (email_desc in desc or desc in email_desc or 
                          len(significant_common) >= 2)
                
                if matches:
                    matched_so_item = so_item
                    print(f"   ✅ Matched email item '{email_desc[:40]}' to SO item '{desc[:40]}'")
                    break
            
            if matched_so_item:
                # Use SO PDF item enriched with email batch/weight info
                item_copy = matched_so_item.copy()
                item_copy['source_so'] = so_num
                
                # Add batch number and weight from email
                if email_item.get('batch_number'):
                    item_copy['batch_number'] = email_item['batch_number']
                    print(f"   📝 Batch: {email_item['batch_number']}")
                if email_item.get('gross_weight'):
                    item_copy['gross_weight'] = email_item['gross_weight']
                
                combined['items'].append(item_copy)
                
                # Add to subtotal
                try:
                    item_total = float(str(matched_so_item.get('total', 0)).replace('$', '').replace(',', ''))
                    total_subtotal += item_total
                except:
                    pass
            else:
                # Email mentions an item but no match found in SO PDF - add from email only
                print(f"   ⚠️ No SO PDF match for email item: {email_desc[:50]}")
                item_copy = {
                    'description': email_item.get('description', ''),
                    'quantity': email_item.get('quantity', 0),
                    'unit': email_item.get('unit', ''),
                    'batch_number': email_item.get('batch_number', ''),
                    'gross_weight': email_item.get('gross_weight', ''),
                    'source_so': so_num
                }
                combined['items'].append(item_copy)
    
    # ==========================================================================
    # DEDUPLICATION: Remove duplicate items with near-identical descriptions
    # ==========================================================================
    # This handles cases where:
    # - SO PDF has typo: "Diesel - Fuel System 12x1L Cleaning Soultion"
    # - Email has correct: "Diesel - Fuel System 12x1L Cleaning Solution"
    # Both get added but they're the SAME item - dedupe by word similarity
    print("\n🔍 DEDUPLICATING items (handling typos like 'Solution' vs 'Soultion')...")
    
    def normalize_description(desc):
        """Normalize description for comparison - remove common typo variations"""
        if not desc:
            return ""
        d = desc.upper().strip()
        # Common typo fixes for comparison only
        d = d.replace('SOULTION', 'SOLUTION')  # AEC typo
        d = d.replace('SOLTUION', 'SOLUTION')
        d = d.replace('SOLUTON', 'SOLUTION')
        return d
    
    def get_description_fingerprint(desc):
        """Get a fingerprint of significant words (4+ chars) for matching"""
        if not desc:
            return set()
        normalized = normalize_description(desc)
        words = set(w for w in normalized.split() if len(w) > 3)
        return words
    
    seen_fingerprints = {}  # fingerprint -> index of item to keep
    items_to_remove = set()
    
    for i, item in enumerate(combined['items']):
        desc = item.get('description', '')
        so_num = item.get('source_so', '')
        qty = str(item.get('quantity', ''))
        
        fp = get_description_fingerprint(desc)
        fp_key = (frozenset(fp), so_num, qty)  # Same SO, same qty, similar description
        
        if fp_key in seen_fingerprints:
            existing_idx = seen_fingerprints[fp_key]
            existing_item = combined['items'][existing_idx]
            
            # Keep the one with more data (unit_price, hts_code, etc.)
            existing_has_price = bool(existing_item.get('unit_price') or existing_item.get('total_price'))
            current_has_price = bool(item.get('unit_price') or item.get('total_price'))
            
            if current_has_price and not existing_has_price:
                # Current is better - remove existing, keep current
                items_to_remove.add(existing_idx)
                seen_fingerprints[fp_key] = i
                print(f"   🔄 Replacing item {existing_idx} with item {i} (has pricing)")
            else:
                # Existing is better or equal - remove current
                items_to_remove.add(i)
                print(f"   🗑️ DUPLICATE REMOVED: '{desc[:50]}...' (duplicate of item {existing_idx})")
        else:
            seen_fingerprints[fp_key] = i
    
    # Remove duplicates (in reverse order to preserve indices)
    if items_to_remove:
        combined['items'] = [item for i, item in enumerate(combined['items']) if i not in items_to_remove]
        print(f"   ✅ Removed {len(items_to_remove)} duplicate item(s)")
    else:
        print(f"   ✅ No duplicates found")
    
    # ==========================================================================
    # SPECIAL INSTRUCTIONS: Sample pails are MERGED into the SO item
    # ==========================================================================
    # Sample pails don't appear as separate line items - they get added to:
    # 1. The description of the item they're associated with (+ 1 Sample pail)
    # 2. The quantity (+1)
    # 3. The steel pail count on commercial invoice
    sample_pail_count = 0
    for so_num, email_items in items_by_so.items():
        for email_item in email_items:
            if email_item.get('is_sample') == True:
                unit = (email_item.get('unit') or '').upper()
                sample_qty = int(email_item.get('quantity', 1))
                
                if 'PAIL' in unit:
                    sample_pail_count += sample_qty
                    
                    # Find ANY PAIL product in the shipment (not just this SO) and add sample info
                    # Sample pail goes with the pail product, not cases
                    for item in combined['items']:
                        item_unit = str(item.get('unit', '')).upper()
                        item_desc = str(item.get('description', '')).upper()
                        # Only add to PAIL products (unit is PAIL), not cases or drums
                        if 'PAIL' in item_unit:
                            # Add to description
                            item['description'] = f"{item['description']} + {sample_qty} Sample pail"
                            # Add to quantity
                            item['quantity'] = int(item.get('quantity', 0)) + sample_qty
                            print(f"   🎁 SAMPLE MERGED: Added +{sample_qty} pail to PAIL product: {item['description'][:50]}...")
                            break
    
    combined['sample_pail_count'] = sample_pail_count
    
    # Use item totals only (DECLARED VALUE = products, NOT pallets/charges)
    # Calculate totals - SAME LOGIC as single-SO parsing
    # Just sum up all items from all SOs (same as single-SO sums items from one SO)
    combined['subtotal'] = f"${total_subtotal:,.2f}"
    combined['total_amount'] = total_subtotal  # For Commercial Invoice declared value (products only)
    
    # HST calculation - SAME as single-SO (13% Ontario standard rate)
    hst_rate = 0.13
    hst = total_subtotal * hst_rate
    combined['hst'] = f"${hst:,.2f}"
    grand_total = total_subtotal + hst
    combined['total'] = f"${grand_total:,.2f}"
    
    print(f"   💰 Multi-SO Totals (SAME logic as single-SO, just multiple SOs):")
    print(f"      Subtotal: ${total_subtotal:,.2f}")
    print(f"      HST (13%): ${hst:,.2f}")
    print(f"      Grand Total: ${grand_total:,.2f}")
    print(f"      Commercial Invoice declared value: ${total_subtotal:,.2f} (products only, NO pallets)")
    
    # Add HTS codes to all items (including samples)
    print("\n📋 Matching HTS codes for combined items...")
    for item in combined['items']:
        hts_info = get_hts_code_for_item(
            item.get('description', ''), 
            item.get('item_code', '')
        )
        if hts_info:
            item['hts_code'] = hts_info['hts_code']
            item['country_of_origin'] = hts_info.get('country_of_origin', 'Canada')
            print(f"  ✅ {item.get('item_code')}: HTS {hts_info['hts_code']}")
    
    print(f"\n📊 Combined SO data:")
    print(f"   SO Numbers: {combined['so_number']}")
    print(f"   PO Numbers: {combined.get('po_number', 'N/A')}")
    print(f"   Total Items: {len(combined['items'])}")
    print(f"   Subtotal: {combined['subtotal']}")
    
    return combined


@logistics_bp.route('/api/logistics/process-email', methods=['POST', 'OPTIONS'])
def process_email():
    """Process email content with GPT-4o and extract SO data - REAL DATA ONLY"""
    import traceback
    import sys
    
    # Handle OPTIONS preflight request for CORS
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response, 200
    
    # CRITICAL: Catch ALL errors including import errors, attribute errors, etc.
    try:
        print("\n" + "="*80)
        print("EMAIL: === PROCESSING LOGISTICS EMAIL WITH GPT-4o ===")
        print("="*80)
        print(f"DEBUG: Function called successfully")
        print(f"DEBUG: Flask request available: {request is not None}")
        print(f"DEBUG: Flask jsonify available: {jsonify is not None}")
        
        # Check if request object is available
        if request is None:
            error_msg = "Request object is None"
            print(f"ERROR: {error_msg}")
            return jsonify({'error': error_msg}), 500
        
        print(f"DEBUG: Request method: {request.method}")
        print(f"DEBUG: Request content type: {request.content_type}")
        print(f"DEBUG: Request has data: {bool(request.data)}")
        
        # Safely get JSON data with error handling
        data = None
        try:
            if request.is_json:
                data = request.get_json(force=True)
                print(f"DEBUG: Parsed JSON from request.is_json path")
            elif request.data:
                data = json.loads(request.data.decode('utf-8'))
                print(f"DEBUG: Parsed JSON from request.data path")
            else:
                # Try regular get_json as fallback
                data = request.get_json()
                print(f"DEBUG: Parsed JSON from request.get_json() fallback")
        except json.JSONDecodeError as json_error:
            error_msg = f"Invalid JSON in request: {str(json_error)}"
            print(f"ERROR: {error_msg}")
            print(f"ERROR: Request data preview: {request.data[:200] if request.data else 'No data'}")
            print(traceback.format_exc())
            return jsonify({'error': error_msg}), 400
        except Exception as json_error:
            error_msg = f"Failed to parse request JSON: {str(json_error)}"
            print(f"ERROR: {error_msg}")
            print(traceback.format_exc())
            return jsonify({'error': error_msg}), 400
        
        if not data:
            print("ERROR: LOGISTICS: No data in request")
            return jsonify({'error': 'No data provided in request'}), 400
        
        email_content = data.get('email_content', '') if isinstance(data, dict) else ''
        trust_email_quantities = data.get('trust_email_quantities', False) if isinstance(data, dict) else False
        
        if not email_content:
            print("ERROR: LOGISTICS: No email content provided")
            return jsonify({'error': 'No email content provided'}), 400
        
        if trust_email_quantities:
            print(f"✏️ TRUST EMAIL MODE: Quantity validation will be SKIPPED - using email quantities as source of truth")
        
        print(f"EMAIL: LOGISTICS: Email content length: {len(email_content)} characters")
        
        # DEBUG: Show email preview to help diagnose truncation issues
        email_preview = email_content[:500] if len(email_content) > 500 else email_content
        print(f"📧 Email preview (first 500 chars): {email_preview}")
        if len(email_content) > 500:
            print(f"⚠️ WARNING: Email content is longer than 500 chars ({len(email_content)} total) - showing preview only")
        
        # =============================================================================
        # MULTI-SO DETECTION: Check if email contains multiple Sales Orders
        # =============================================================================
        all_so_numbers = extract_all_so_numbers(email_content)
        print(f"📋 SO Detection: Found {len(all_so_numbers)} SO(s): {all_so_numbers}")
        
        # DEBUG: If only 1 SO found but email seems long, warn about potential truncation
        if len(all_so_numbers) == 1 and len(email_content) < 300:
            print(f"⚠️ WARNING: Only 1 SO detected but email is short ({len(email_content)} chars).")
            print(f"   This might indicate email content was truncated. Check if multi-SO content is missing.")
        
        # If multiple SOs detected, use multi-SO processing path
        if len(all_so_numbers) > 1:
            print(f"\n{'='*80}")
            print(f"🔀 MULTI-SO MODE: Processing {len(all_so_numbers)} Sales Orders together")
            print(f"{'='*80}")
            return process_multi_so_email(email_content, all_so_numbers)
        
        # =============================================================================
        # SINGLE SO PATH (UNCHANGED) - Backwards compatible
        # =============================================================================
        
        # OPTIMIZATION: Quick SO number extraction with regex (fast, <1ms)
        # This allows us to start fetching SO data in parallel with GPT parsing
        import re
        quick_so_match = re.search(r'(?:sales order|SO|order)\s*[#:]?\s*(\d{3,5})', email_content, re.IGNORECASE)
        quick_so_number = quick_so_match.group(1) if quick_so_match else None
        
        # Start GPT parsing and SO data fetch in parallel (if we found SO number quickly)
        import concurrent.futures
        executor = None
        so_data_promise = None
        if quick_so_number:
            print(f"⚡ OPTIMIZATION: Quick SO extraction found: {quick_so_number} - starting SO data fetch in parallel with GPT parsing...")
            # Start SO data fetch in background (non-blocking)
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            so_data_promise = executor.submit(get_so_data_from_system, quick_so_number)
        
        try:
            # Use GPT parser for accurate multi-item extraction
            print("INFO: Parsing email with GPT-4o-mini for multi-item support...")
            email_data = parse_email_with_gpt4(email_content)
            
            # CRITICAL: Store original email text for downstream broker detection
            # (BOL/CI generators need raw_text to detect "cleared by Near North" etc.)
            email_data['raw_text'] = email_content
            
            # CRITICAL: Count pallets from RAW EMAIL - NEVER trust GPT for counting
            # Patterns: "On 3 pallets", "On 1 pallet", "on 2 skids", etc.
            pallet_matches = re.findall(r'[Oo]n\s+(\d+)\s+(?:pallet|skid)', email_content)
            if pallet_matches:
                correct_pallet_count = sum(int(p) for p in pallet_matches)
                gpt_pallet_count = email_data.get('pallet_count', 0) or 0
                print(f"📦 PALLET COUNT FROM EMAIL: {correct_pallet_count} (found: {pallet_matches})")
                print(f"   GPT said: {gpt_pallet_count}")
                
                # ALWAYS use the email count, not GPT's count
                email_data['pallet_count'] = correct_pallet_count
                
                # Rebuild skid_info with correct count
                pallet_dims = email_data.get('pallet_dimensions', '')
                pkg_type = email_data.get('packaging_type', 'pallet')
                if correct_pallet_count == 1:
                    email_data['skid_info'] = f"1 {pkg_type} {pallet_dims}".strip()
                else:
                    email_data['skid_info'] = f"{correct_pallet_count} {pkg_type}s {pallet_dims} each".strip()
                print(f"   skid_info: {email_data['skid_info']}")
            
            print(f"\n{'='*80}")
            print(f"EMAIL DATA PARSED:")
            print(f"  SO Number: {email_data.get('so_number')}")
            print(f"  Line Numbers: {email_data.get('so_line_numbers')}")
            print(f"  Is Partial Shipment: {email_data.get('is_partial_shipment')}")
            print(f"  PO Number: {email_data.get('po_number')}")
            print(f"  Total Weight: {email_data.get('total_weight')}")
            print(f"  Pallet Count: {email_data.get('pallet_count')}")
            print(f"  Pallet Dimensions: {email_data.get('pallet_dimensions')}")
            print(f"  Carrier: {email_data.get('carrier')}")
            print(f"{'='*80}\n")
            
            if not email_data.get('so_number'):
                print("ERROR: LOGISTICS: No SO number found in email")
                return jsonify({'error': 'No SO number found in email', 'email_data': email_data}), 400
            
            so_number = email_data['so_number']
            print(f"EMAIL: LOGISTICS: Found SO number: {so_number}")
            print(f"DEBUG: quick_so_number from regex: {quick_so_number}")
            print(f"DEBUG: so_number from GPT: {so_number}")
            print(f"DEBUG: so_data_promise exists: {so_data_promise is not None}")
            
            # Get REAL SO data from system - NO MOCK DATA
            # Use pre-fetched data if available, otherwise fetch now
            if so_data_promise and quick_so_number == so_number:
                print("⚡ OPTIMIZATION: Using pre-fetched SO data (loaded in parallel with GPT parsing)...")
                try:
                    so_data = so_data_promise.result(timeout=60)  # Wait up to 60s for result
                except concurrent.futures.TimeoutError:
                    print("⚠️ Pre-fetch timed out, fetching SO data now...")
                    so_data = get_so_data_from_system(so_number)
                except Exception as fetch_error:
                    print(f"⚠️ Pre-fetch failed: {fetch_error}, fetching SO data now...")
                    so_data = get_so_data_from_system(so_number)
            else:
                # SO number from GPT doesn't match quick extraction, or quick extraction failed
                so_data = get_so_data_from_system(so_number)
        finally:
            # Always clean up executor
            if executor:
                executor.shutdown(wait=False)
        
        
        print(f"DEBUG: SO data status: {so_data.get('status') if isinstance(so_data, dict) else 'Not a dict'}")
        print(f"DEBUG: SO data keys: {list(so_data.keys()) if isinstance(so_data, dict) else 'N/A'}")
        
        if not isinstance(so_data, dict):
            print(f"ERROR: LOGISTICS: SO data is not a dict, got: {type(so_data).__name__}")
            return jsonify({'error': f"Invalid SO data format: expected dict, got {type(so_data).__name__}"}), 500
        
        if so_data.get('status') == 'Error':
            error_msg = so_data.get('error', 'Unknown error')
            print(f"ERROR: LOGISTICS: Error getting SO data: {error_msg}")
            return jsonify({'error': f"Error loading SO data: {error_msg}"}), 500
        
        if so_data.get('status') == 'Not found':
            print(f"ERROR: LOGISTICS: SO {so_number} not found in system")
            return jsonify({'error': f"SO {so_number} not found in system"}), 404
        
        # CRITICAL VALIDATION: Verify email matches SO data
        validation_errors = []
        validation_details = {
            'so_number_check': {},
            'company_check': {},
            'items_check': {}
        }
        
        # 1. Validate SO Number matches
        email_so = email_data.get('so_number', '').strip()
        pdf_so = so_data.get('so_number', '').strip()
        
        if email_so and pdf_so:
            if email_so != pdf_so:
                validation_errors.append(f"SO Number mismatch")
                validation_details['so_number_check'] = {
                    'status': 'failed',
                    'email_value': email_so,
                    'so_value': pdf_so,
                    'message': f"Email mentions SO #{email_so} but PDF is for SO #{pdf_so}"
                }
            else:
                validation_details['so_number_check'] = {
                    'status': 'passed',
                    'value': email_so
                }
        elif not email_so:
            validation_errors.append("No SO number found in email")
            validation_details['so_number_check'] = {
                'status': 'failed',
                'message': "Could not extract SO number from email"
            }
        
        # 2. Smart validation for Sold To vs Ship To scenarios
        # Extract company information from new structure
        sold_to_company = ""
        ship_to_contact = ""
        primary_company = ""
        
        # Handle new structure (sold_to/ship_to) or fallback to old structure
        if email_data.get('sold_to') or email_data.get('ship_to'):
            sold_to_company = (email_data.get('sold_to', {}).get('company_name') or '').upper().strip()
            ship_to_contact = (email_data.get('ship_to', {}).get('contact_person') or '').upper().strip()
            primary_company = (email_data.get('primary_company') or '').upper().strip()
            
            # If no primary_company specified, use sold_to as primary
            if not primary_company and sold_to_company:
                primary_company = sold_to_company
        else:
            # Fallback to old structure for backward compatibility
            # Use 'or' pattern to handle None values (when key exists but value is None)
            primary_company = (email_data.get('company_name') or '').upper().strip()
        
        so_customer = (so_data.get('customer_name') or '').upper().strip()
        
        if primary_company and so_customer:
            # Smart matching logic for B2B scenarios
            companies_to_check = [primary_company]
            if sold_to_company and sold_to_company != primary_company:
                companies_to_check.append(sold_to_company)
            
            match_found = False
            match_details = None
            
            for company_name in companies_to_check:
                # More flexible matching - check if key parts match
                email_words = set(company_name.split())
                so_words = set(so_customer.split())
                common_words = email_words.intersection(so_words)
                
                # Check for common company identifiers
                if (company_name in so_customer or 
                    so_customer in company_name or
                    len(common_words) >= 2 or  # At least 2 words in common
                    any(word in so_customer for word in email_words if len(word) > 4)):  # Key words match
                    
                    match_found = True
                    match_details = {
                        'matched_company': company_name,
                        'so_customer': so_customer,
                        'match_type': 'sold_to' if company_name == sold_to_company else 'primary'
                    }
                    break
            
            if not match_found:
                # Use GPT-4o to intelligently validate potential B2B scenarios
                print("🤖 No direct match found - Using GPT-4o for smart B2B validation...")
                gpt_validation = validate_sold_to_ship_to_with_gpt4(email_data, so_data)
                
                if gpt_validation.get('valid') and gpt_validation.get('confidence') in ['high', 'medium']:
                    # GPT-4o determined this is a valid B2B scenario
                    print(f"✅ GPT-4o validated B2B scenario: {gpt_validation.get('scenario_type')}")
                    validation_details['company_check'] = {
                        'status': 'passed_with_ai',
                        'sold_to_company': sold_to_company,
                        'ship_to_contact': ship_to_contact,
                        'primary_company': primary_company,
                        'so_customer': so_customer,
                        'ai_validation': gpt_validation,
                        'message': f"GPT-4o validated B2B scenario: {gpt_validation.get('reason', 'Valid sold-to/ship-to arrangement')}"
                    }
                else:
                    # GPT-4o also thinks this is invalid
                    error_msg = f"Company mismatch detected"
                    if sold_to_company and ship_to_contact:
                        error_msg = f"Neither Sold To company '{sold_to_company}' nor Ship To contact '{ship_to_contact}' matches SO customer '{so_customer}'"
                    elif primary_company:
                        error_msg = f"Email company '{primary_company}' does not match SO customer '{so_customer}'"
                    
                    validation_errors.append("Customer name mismatch")
                    validation_details['company_check'] = {
                        'status': 'failed',
                        'sold_to_company': sold_to_company,
                        'ship_to_contact': ship_to_contact,
                        'primary_company': primary_company,
                        'so_customer': so_customer,
                        'ai_validation': gpt_validation,
                        'message': error_msg,
                        'ai_reason': gpt_validation.get('reason', 'AI validation also failed'),
                        'suggestion': gpt_validation.get('recommendation', "Verify if the SO customer matches either the billing company or shipping contact.")
                    }
            else:
                validation_details['company_check'] = {
                    'status': 'passed',
                    'match_details': match_details,
                    'sold_to_company': sold_to_company,
                    'ship_to_contact': ship_to_contact,
                    'so_customer': so_customer,
                    'message': f"Successfully matched {match_details['match_type']} company with SO customer"
                }
        elif not primary_company and not sold_to_company:
            # Warning only - not critical
            validation_details['company_check'] = {
                'status': 'warning',
                'message': "No company information found in email",
                'suggestion': "Email may not contain clear Sold To or Ship To information"
            }
        
        # 3. Validate items exist in SO - CHECK SPECIFIC LINES IF MENTIONED
        print(f"\n🔍 STARTING ITEM VALIDATION")
        print(f"   Email has items: {bool(email_data.get('items'))}")
        print(f"   Email items count: {len(email_data.get('items', []))}")
        items_validation = []
        try:
            if email_data.get('items'):
                so_item_names = []
                so_item_codes = []
                so_items_to_check = []
                
                # DEBUG: Check what SO data contains
                so_items_raw = so_data.get('items', [])
                print(f"\n🔍 DEBUG: SO ITEMS CHECK")
                print(f"   SO items count: {len(so_items_raw) if so_items_raw else 0}")
                print(f"   SO items type: {type(so_items_raw)}")
                print(f"   SO items is list: {isinstance(so_items_raw, list)}")
                if not so_items_raw:
                    print(f"   ⚠️ WARNING: SO items list is EMPTY or None!")
                    print(f"   SO data keys: {list(so_data.keys())}")
                    import sys
                    sys.stdout.flush()
                    # CRITICAL: If SO has no items, all email items will fail
                    validation_errors.append("SO has no items to match against")
                    validation_details['items_check'] = {
                        'status': 'failed',
                        'message': "SO has no items - cannot validate email items",
                        'total_email_items': len(email_data.get('items', [])),
                        'matched_items': 0,
                        'unmatched_items': [{'email_item': item.get('description')} for item in email_data.get('items', [])]
                    }
                elif not isinstance(so_items_raw, list):
                    print(f"   ⚠️ ERROR: SO items is not a list! Type: {type(so_items_raw)}")
                    so_items_raw = []
                else:
                    print(f"   First item type: {type(so_items_raw[0]) if so_items_raw else 'N/A'}")
                    if so_items_raw and isinstance(so_items_raw[0], dict):
                        print(f"   First item keys: {list(so_items_raw[0].keys())}")
                    for idx, item in enumerate(so_items_raw[:3], 1):
                        if isinstance(item, dict):
                            print(f"   Item {idx}: code='{item.get('item_code')}', desc='{item.get('description')}', qty='{item.get('quantity')}'")
                        else:
                            print(f"   Item {idx}: NOT A DICT - {type(item)}: {item}")
                
                # Check if this is a PARTIAL SHIPMENT (specific lines mentioned)
                is_partial_shipment = email_data.get('is_partial_shipment', False)
                line_numbers = email_data.get('so_line_numbers', None)
                
                if is_partial_shipment and line_numbers:
                    print(f"\n⚠️  PARTIAL SHIPMENT DETECTED - Only validating lines: {line_numbers}")
                    # Only check SPECIFIC lines from the SO
                    for idx, so_item in enumerate(so_items_raw, start=1):
                        if idx in line_numbers:
                            so_items_to_check.append(so_item)
                            print(f"   Including Line {idx}: {so_item.get('item_code')} - {so_item.get('description')}")
                else:
                    print(f"\n✅ FULL SHIPMENT - Validating all items")
                    # Check ALL items in SO
                    so_items_to_check = so_items_raw.copy() if so_items_raw else []
                    print(f"   Total SO items to check: {len(so_items_to_check)}")
                
                # Build list of SO items for comparison (from filtered list)
                # CRITICAL: Keep indices aligned - only add items that pass the filter
                items_before_filter = len(so_items_to_check)
                filtered_so_items = []  # Store only the items that pass the filter
                for so_item in so_items_to_check:
                    desc = so_item.get('description', '').upper()
                    code = so_item.get('item_code', '').upper()
                    
                    # Skip non-product items
                    if any(skip in desc for skip in ['FREIGHT', 'CHARGE', 'PALLET CHARGE', 'BROKERAGE']):
                        print(f"   ⏭️  SKIPPED (non-product): {desc}")
                        continue
                        
                    so_item_names.append(desc)
                    filtered_so_items.append(so_item)  # Keep aligned with so_item_names
                    if code:
                        so_item_codes.append(code)
                    print(f"   ✅ ADDED to matching list: '{desc}' (code: {code})")
                
                # Replace so_items_to_check with filtered list to keep indices aligned
                so_items_to_check = filtered_so_items
                
                print(f"\n📊 SO ITEMS SUMMARY:")
                print(f"   Items before filter: {items_before_filter}")
                print(f"   Items after filter: {len(so_item_names)}")
                print(f"   SO item names: {so_item_names}")
                print(f"   SO item codes: {so_item_codes}")
                print(f"\n📧 EMAIL ITEMS TO MATCH:")
                for email_item in email_data.get('items', []):
                    print(f"   - '{email_item.get('description')}' (qty: {email_item.get('quantity')})")
                
                # Check each email item
                for email_item in email_data.get('items', []):
                    item_desc = (email_item.get('description') or '').upper().strip()
                    item_qty = email_item.get('quantity', '')
                    item_batch = email_item.get('batch_number', '')
                    item_code = (email_item.get('item_code') or '').upper().strip()
                    
                    print(f"\n🔍 MATCHING EMAIL ITEM: '{item_desc}' (qty: {item_qty})")
                    print(f"   Available SO items: {so_item_names[:5]}...")  # Show first 5
                    
                    matched = False
                    match_details = None
                    matched_so_item = None  # Initialize to avoid UnboundLocalError
                    
                    # Try to find matching SO item - SMART MATCHING
                    for i, so_desc in enumerate(so_item_names):
                        so_item = so_items_to_check[i]  # Get the actual SO item object
                        # Debug: Show what we're comparing
                        print(f"   🔍 COMPARING: Email='{item_desc}' vs SO='{so_desc}'")
                        
                        # Normalize descriptions for comparison (remove extra spaces, handle variations)
                        item_desc_normalized = ' '.join(item_desc.split())  # Normalize whitespace
                        so_desc_normalized = ' '.join(so_desc.split())
                        
                        # Also normalize by removing hyphens and special chars for comparison
                        item_desc_clean = item_desc_normalized.replace('-', ' ').replace('/', ' ').replace('#', ' ')
                        so_desc_clean = so_desc_normalized.replace('-', ' ').replace('/', ' ').replace('#', ' ')
                        
                        # Exact match check (with and without special chars)
                        exact_match_1 = item_desc_normalized in so_desc_normalized or item_desc_clean in so_desc_clean
                        exact_match_2 = so_desc_normalized in item_desc_normalized or so_desc_clean in item_desc_clean
                        
                        # Also check if all words from email item appear in SO description
                        email_words = set(item_desc_clean.split())
                        so_words = set(so_desc_clean.split())
                        # Remove common packaging words for comparison
                        packaging_words = {'KG', 'KEG', 'DRUM', 'PAIL', 'DRUMS', 'PAILS', 'KEGS', '55KG', '247KG', '18KG', '20L', 'TOTE', 'IBC', 'CALCIUM', 'SULFONATE', 'GREASE'}
                        email_core_words = email_words - packaging_words
                        so_core_words = so_words - packaging_words
                        word_match = email_core_words and len(email_core_words) >= 2 and email_core_words.issubset(so_words)
                        
                        # Additional check: if key product identifiers match (like "CC LOW TEMP EP-0")
                        # Extract alphanumeric product codes
                        import re
                        email_codes = set(re.findall(r'[A-Z]+\d+|EP\d+|[A-Z]{2,}\s+[A-Z]+\s+[A-Z]+', item_desc_normalized))
                        so_codes = set(re.findall(r'[A-Z]+\d+|EP\d+|[A-Z]{2,}\s+[A-Z]+\s+[A-Z]+', so_desc_normalized))
                        code_match = bool(email_codes & so_codes) if email_codes else False
                        
                        print(f"      Check 1 (email in SO): {exact_match_1}")
                        print(f"      Check 2 (SO in email): {exact_match_2}")
                        print(f"      Check 3 (word match): {word_match} (email words: {email_core_words})")
                        print(f"      Check 4 (code match): {code_match} (codes: {email_codes & so_codes if email_codes else 'none'})")
                        
                        if exact_match_1 or exact_match_2 or word_match or code_match:
                            # Check if this is a TOTE order - totes are treated as single units regardless of volume
                            is_tote_order = False
                            email_text_lower = str(email_data).lower()
                            so_unit = (so_item.get('unit') or '').upper()
                            
                            # Detect tote orders: email mentions "tote" OR SO unit is TOTE/LITER with qty 1
                            if 'tote' in email_text_lower or (so_unit in ['TOTE', 'LITER', 'IBC'] and so_item.get('quantity', 0) == 1):
                                is_tote_order = True
                                print(f"      📦 TOTE ORDER DETECTED - matching on description only")
                            
                            # For tote orders, match on description only (skip qty check)
                            # Store the liters info from email for BOL formatting: "Product Name (XXX L filled)"
                            if is_tote_order:
                                matched = True
                                matched_so_item = so_item
                                # Store liters from email for BOL description formatting
                                liters_filled = item_qty if item_qty else ''
                                match_details = f"TOTE order matched by description: {so_desc}"
                                if liters_filled:
                                    match_details += f" | Liters filled: {liters_filled}L"
                                    # Update the email item with tote info for BOL generation
                                    email_item['is_tote_order'] = True
                                    email_item['liters_filled'] = liters_filled
                                    email_item['bol_quantity'] = 1  # 1 tote
                                    email_item['bol_description'] = f"{email_item.get('description', '')} ({liters_filled}L filled)"
                                print(f"   ✅ TOTE MATCH: '{item_desc}' = '{so_desc}' (Liters: {liters_filled})")
                                break
                            
                            # For non-tote orders, check quantity
                            if item_qty:
                                try:
                                    email_qty_num = float(str(item_qty).replace(',', '')) if item_qty else 0
                                    so_qty = so_item.get('quantity', 0)
                                    if isinstance(so_qty, str):
                                        import re
                                        qty_match = re.search(r'(\d+\.?\d*)', str(so_qty).replace(',', ''))
                                        so_qty_num = float(qty_match.group(1)) if qty_match else float(so_qty)
                                    else:
                                        so_qty_num = float(so_qty)
                                    
                                    # Allow email qty <= SO qty (partial shipments are normal)
                                    # Only reject if email claims MORE than SO has
                                    if email_qty_num > so_qty_num + 0.01:
                                        print(f"      ⏭️  DESCRIPTION MATCHES but EMAIL QTY EXCEEDS SO: Email={email_qty_num}, SO={so_qty_num} - skipping")
                                        continue
                                    else:
                                        print(f"      ✅ DESCRIPTION MATCH: Email={email_qty_num}, SO={so_qty_num} (partial shipment OK)")
                                except Exception as qty_err:
                                    print(f"      ⚠️  QTY CHECK ERROR: {qty_err} - proceeding with description match only")
                            
                            # Only accept match if we got here (either qty matches or qty check failed/not available)
                            matched = True
                            matched_so_item = so_item  # Store the matched item
                            match_details = f"Matched with SO item: {so_desc}"
                            print(f"   ✅ EXACT MATCH: '{item_desc}' = '{so_desc}'")
                            break
                        
                        # MOV product matching - handle all MOV variants:
                        # - "MOV Extra 0" vs "MOVEXT0DRM" or "MOV Extra 0 - Drums"
                        # - "MOV LONG LIFE 0" vs "MOV LONG LIFE 0 55kg KEG"
                        # CRITICAL: Check this BEFORE smart matching to avoid matching "MOV Extra 1" with "MOV Extra 0"
                        if 'MOV' in item_desc and 'MOV' in so_desc:
                            import re
                            # First check: Does email description appear in SO description? (handles "MOV LONG LIFE 0" in "MOV LONG LIFE 0 55kg KEG")
                            if item_desc in so_desc:
                                matched = True
                                matched_so_item = so_item
                                match_details = f"MOV product exact match: {item_desc} found in {so_desc}"
                                print(f"   ✅ MOV EXACT MATCH: '{item_desc}' found in '{so_desc}'")
                                break
                            
                            # Second check: Extract numbers and match by product number
                            email_nums = re.findall(r'\d+', item_desc)
                            so_nums = re.findall(r'\d+', so_desc)
                            # If both have MOV and share a number, it's a match
                            if email_nums and so_nums and any(e_num in so_desc for e_num in email_nums):
                                # Additional check: Make sure the product type matches (LONG LIFE vs Extra)
                                email_type = 'LONG LIFE' if 'LONG LIFE' in item_desc else ('EXTRA' if 'EXTRA' in item_desc else 'MOV')
                                so_type = 'LONG LIFE' if 'LONG LIFE' in so_desc else ('EXTRA' if 'EXTRA' in so_desc else 'MOV')
                                if email_type == so_type or email_type == 'MOV' or so_type == 'MOV':
                                    matched = True
                                    matched_so_item = so_item
                                    match_details = f"MOV product matched by number: {item_desc} = {so_desc}"
                                    print(f"   ✅ MOV MATCH: '{item_desc}' = '{so_desc}' (shared number: {[n for n in email_nums if n in so_desc][0]})")
                                    break
                        
                        # Direct VSG fix - if email has VSG and SO has VSG, it's a match
                        if 'VSG' in item_desc and 'VSG' in so_desc:
                            matched = True
                            matched_so_item = so_item  # Store the matched item
                            match_details = f"VSG product matched: {item_desc} = {so_desc}"
                            break
                        
                        # Smart matching for similar products
                        # Extract key product identifiers
                        email_words = set(re.findall(r'\b[A-Z]{2,}\b', item_desc))  # Get abbreviations like VSG, MOV
                        so_words = set(re.findall(r'\b[A-Z]{2,}\b', so_desc))
                        
                        # If they share key abbreviations, consider it a match
                        # BUT: For MOV products, DO NOT use smart matching - only use exact match or MOV-specific matching
                        # This prevents "MOV Extra 1" from matching "MOV Extra 0" through shared words
                        if email_words & so_words:  # Intersection of sets
                            # CRITICAL: Skip smart matching entirely for MOV products - they need number matching
                            if 'MOV' in item_desc and 'MOV' in so_desc:
                                continue  # Skip smart matching for MOV - use exact match or MOV-specific matching only
                            
                            matched = True
                            matched_so_item = so_item  # Store the matched item
                            match_details = f"Smart matched with SO item: {so_desc} (shared: {email_words & so_words})"
                            break
                        
                        # Check for product base name matches (ignore packaging format)
                        # If they share key product abbreviations, consider it a match even if packaging differs
                        if email_words & so_words:
                            # Additional check: if the base product matches, accept different packaging
                            base_products = ['VSG', 'MOV', 'GREASE', 'OIL', 'FLUID']
                            shared_products = email_words & so_words & set(base_products)
                            if shared_products:
                                # For MOV, still require number match
                                if 'MOV' in shared_products:
                                    email_nums = re.findall(r'\d+', item_desc)
                                    so_nums = re.findall(r'\d+', so_desc)
                                    if email_nums and so_nums and not any(e_num in so_desc for e_num in email_nums):
                                        continue  # Skip - MOV numbers must match
                                
                                matched = True
                                matched_so_item = so_item  # Store the matched item
                                match_details = f"Product match (packaging may differ): {shared_products}"
                                break
                        
                        # Check for common product variations
                        variations = [
                            ('VANE SPINDLE GREASE', 'VSG'),
                            ('MOV EXTRA', 'MOV'),
                            ('DRUMS', 'DRUM'),
                            ('PAILS', 'PAIL')
                        ]
                        
                        for long_form, short_form in variations:
                            if ((long_form in item_desc and short_form in so_desc) or 
                                (short_form in item_desc and long_form in so_desc)):
                                matched = True
                                matched_so_item = so_item  # Store the matched item
                                match_details = f"Variation matched: {long_form} = {short_form}"
                                break
                        
                        if matched:
                            break
                    
                    if not matched and so_item_codes and item_code:
                        # Try matching by item code
                        for i, code in enumerate(so_item_codes):
                            so_item = so_items_to_check[i]  # Get the actual SO item object
                            if code and (item_code in code or code in item_code):
                                matched = True
                                matched_so_item = so_item  # Store the matched item
                                match_details = f"Matched with SO item code: {code}"
                                break
                            
                            # Check for similar item codes (allow 1-2 character differences)
                            if code and len(code) > 3 and len(item_code) > 3:
                                # Check if most characters match (fuzzy matching)
                                if abs(len(code) - len(item_code)) <= 2:  # Similar length
                                    matches = sum(1 for a, b in zip(code, item_code) if a == b)
                                    if matches >= len(code) - 2:  # Allow 1-2 character differences
                                        matched = True
                                        matched_so_item = so_item  # Store the matched item
                                        match_details = f"Fuzzy matched with SO item code: {code} (similarity: {matches}/{len(code)})"
                                        break
                    
                    # If matched, also check quantity (use the SAME matched SO item, not search again)
                    quantity_match = True
                    quantity_details = ""
                    if matched and item_qty and matched_so_item is not None:
                        email_qty_num = float(item_qty) if item_qty else 0
                        
                        # Use the EXACT matched SO item (no searching again - prevents wrong item match)
                        so_qty = matched_so_item.get('quantity', 0)
                        print(f"   📊 QUANTITY CHECK: Email qty='{item_qty}' ({email_qty_num}), SO qty='{so_qty}' (type: {type(so_qty).__name__})")
                        try:
                            # Handle different quantity formats from SO
                            if isinstance(so_qty, str):
                                # Extract number from string like "3 DRUM" or "3.0"
                                import re
                                qty_match = re.search(r'(\d+\.?\d*)', str(so_qty))
                                so_qty_num = float(qty_match.group(1)) if qty_match else float(so_qty)
                            else:
                                so_qty_num = float(so_qty)
                            
                            print(f"   📊 QUANTITY COMPARISON: Email={email_qty_num}, SO={so_qty_num}, Diff={abs(email_qty_num - so_qty_num)}")
                            
                            # Allow partial shipments (email qty <= SO qty is normal)
                            # Only flag as mismatch if email claims MORE than SO has
                            # UNLESS trust_email_quantities is True - then always accept email qty
                            if trust_email_quantities:
                                # Trust Email Mode: Accept email quantities, calculate price using SO unit price
                                quantity_match = True
                                so_unit_price = matched_so_item.get('unit_price', 0) or matched_so_item.get('price', 0)
                                if so_unit_price:
                                    calculated_total = email_qty_num * float(str(so_unit_price).replace('$', '').replace(',', ''))
                                    quantity_details = f"✏️ TRUST EMAIL: Using email qty {email_qty_num} (SO has {so_qty_num}). Calculated total: ${calculated_total:,.2f}"
                                else:
                                    quantity_details = f"✏️ TRUST EMAIL: Using email qty {email_qty_num} (SO has {so_qty_num})"
                                print(f"   ✏️ TRUST EMAIL MODE: {quantity_details}")
                            elif email_qty_num > so_qty_num + 0.01:
                                quantity_match = False
                                quantity_details = f"Quantity EXCEEDS SO: Email says {email_qty_num}, SO only has {so_qty_num}"
                                print(f"   ❌ QUANTITY EXCEEDS SO: {quantity_details}")
                            elif email_qty_num < so_qty_num - 0.01:
                                # Partial shipment - note it but don't fail
                                quantity_match = True
                                quantity_details = f"Partial shipment: Email says {email_qty_num}, SO has {so_qty_num}"
                                print(f"   📦 PARTIAL SHIPMENT: {quantity_details}")
                            else:
                                quantity_details = f"Quantity matches: {email_qty_num}"
                                print(f"   ✅ QUANTITY MATCH: {quantity_details}")
                        except Exception as qty_err:
                            print(f"   ⚠️ QUANTITY PARSE ERROR: {qty_err} - Email qty: {item_qty}, SO qty: {so_qty}")
                            pass
                    
                    item_validation = {
                        'email_item': email_item.get('description'),
                        'quantity': item_qty,
                        'batch': item_batch,
                        'matched': matched,
                        'match_details': match_details,
                        'quantity_match': quantity_match,
                        'quantity_details': quantity_details
                    }
                    
                    if not matched:
                        print(f"   ❌ NO MATCH FOUND for '{item_desc}'")
                        item_validation['error'] = f"No matching item found in SO"
                    elif not quantity_match:
                        print(f"   ⚠️ QUANTITY MISMATCH: {quantity_details}")
                        item_validation['error'] = quantity_details
                    else:
                        print(f"   ✅ MATCHED: {match_details}")
                        
                    items_validation.append(item_validation)
                
                # Count unmatched items and quantity mismatches
                unmatched_items = [iv for iv in items_validation if not iv['matched']]
                # In trust_email mode, quantity_match is always True, so this should be empty
                # But we also explicitly skip quantity mismatch errors in trust_email mode
                quantity_mismatches = [iv for iv in items_validation if iv.get('matched') and not iv.get('quantity_match', True)]
                
                # In TRUST EMAIL MODE: Only fail on unmatched items, NOT quantity mismatches
                if trust_email_quantities:
                    if unmatched_items:
                        error_messages = [f"{len(unmatched_items)} item(s) from email not found in SO"]
                        validation_errors.extend(error_messages)
                        validation_details['items_check'] = {
                            'status': 'failed',
                            'total_email_items': len(email_data.get('items', [])),
                            'matched_items': len(email_data.get('items', [])) - len(unmatched_items),
                            'unmatched_items': unmatched_items,
                            'quantity_mismatches': [],  # Ignored in trust_email mode
                            'items_details': items_validation
                        }
                    else:
                        validation_details['items_check'] = {
                            'status': 'passed',
                            'total_items': len(email_data.get('items', [])),
                            'message': f"✏️ TRUST EMAIL MODE: All {len(email_data.get('items', []))} items matched - using email quantities",
                            'items_details': items_validation
                        }
                elif unmatched_items or quantity_mismatches:
                    error_messages = []
                    if unmatched_items:
                        error_messages.append(f"{len(unmatched_items)} item(s) from email not found in SO")
                    if quantity_mismatches:
                        error_messages.append(f"{len(quantity_mismatches)} item(s) have QUANTITY MISMATCH")
                    
                    validation_errors.extend(error_messages)
                    validation_details['items_check'] = {
                        'status': 'failed',
                        'total_email_items': len(email_data.get('items', [])),
                        'matched_items': len(email_data.get('items', [])) - len(unmatched_items),
                        'unmatched_items': unmatched_items,
                        'quantity_mismatches': quantity_mismatches,
                        'items_details': items_validation
                    }
                else:
                    validation_details['items_check'] = {
                        'status': 'passed',
                        'total_items': len(email_data.get('items', [])),
                        'message': f"All {len(email_data.get('items', []))} items matched successfully with correct quantities",
                        'items_details': items_validation
                    }
            else:
                validation_details['items_check'] = {
                    'status': 'warning',
                    'message': "No items found in email to validate"
                }
        except Exception as items_err:
            import traceback
            print(f"\n❌ CRITICAL ERROR IN ITEM VALIDATION:")
            print(f"Error: {items_err}")
            print(f"Traceback:\n{traceback.format_exc()}")
            validation_details['items_check'] = {
                'status': 'error',
                'message': f"Item validation failed: {str(items_err)}",
                'error_traceback': traceback.format_exc()
            }
            items_validation = []
            # CRITICAL: Add error to validation_errors so it gets returned
            validation_errors.append(f"Item validation crashed: {str(items_err)}")
        
        # If there are validation errors, return detailed summary
        if validation_errors:
            import sys
            print(f"\n{'='*80}", flush=True)
            print(f"❌ VALIDATION FAILED - {len(validation_errors)} ERROR(S):", flush=True)
            print(f"{'='*80}", flush=True)
            for i, error in enumerate(validation_errors, 1):
                print(f"  ERROR #{i}: {error}", flush=True)
            print(f"\nVALIDATION DETAILS:", flush=True)
            print(f"  SO Number Check: {validation_details.get('so_number_check', {}).get('status', 'unknown')}", flush=True)
            if validation_details.get('so_number_check', {}).get('status') == 'failed':
                print(f"    Email SO: {validation_details.get('so_number_check', {}).get('email_value')}", flush=True)
                print(f"    PDF SO: {validation_details.get('so_number_check', {}).get('so_value')}", flush=True)
            print(f"  Company Check: {validation_details.get('company_check', {}).get('status', 'unknown')}", flush=True)
            if validation_details.get('company_check', {}).get('status') == 'failed':
                print(f"    Email Company: {validation_details.get('company_check', {}).get('primary_company')}", flush=True)
                print(f"    SO Customer: {validation_details.get('company_check', {}).get('so_customer')}", flush=True)
            print(f"  Items Check: {validation_details.get('items_check', {}).get('status', 'unknown')}", flush=True)
            items_check = validation_details.get('items_check', {})
            if items_check.get('status') == 'failed':
                print(f"    Matched: {items_check.get('matched_items', 0)}/{items_check.get('total_email_items', 0)}", flush=True)
                for item in items_check.get('unmatched_items', []):
                    print(f"      ❌ UNMATCHED: '{item.get('email_item')}'", flush=True)
                for item in items_check.get('quantity_mismatches', []):
                    print(f"      ⚠️  QTY MISMATCH: '{item.get('email_item')}' - {item.get('quantity_details')}", flush=True)
            elif items_check.get('status') == 'error':
                print(f"    ❌ ITEM VALIDATION CRASHED: {items_check.get('message')}", flush=True)
            print(f"{'='*80}\n", flush=True)
            sys.stdout.flush()
            
            # Create detailed summary
            summary_parts = []
            
            # SO Number summary
            if validation_details['so_number_check'].get('status') == 'failed':
                summary_parts.append(f"ERROR: SO Number: {validation_details['so_number_check'].get('message', 'Mismatch')}")
            
            # Company summary  
            if validation_details['company_check'].get('status') == 'failed':
                summary_parts.append(f"ERROR: Company: {validation_details['company_check'].get('message', 'Mismatch')}")
            
            # Items summary
            if validation_details['items_check'].get('status') == 'failed':
                items_detail = validation_details['items_check']
                summary_parts.append(f"ERROR: Items: {items_detail.get('matched_items', 0)}/{items_detail.get('total_email_items', 0)} matched")
                
                # List unmatched items
                for item in items_detail.get('unmatched_items', []):
                    summary_parts.append(f"   • '{item['email_item']}' - Not found in SO")
                
                # List quantity mismatches
                for item in items_detail.get('quantity_mismatches', []):
                    summary_parts.append(f"   • '{item['email_item']}' - {item.get('quantity_details', 'Quantity mismatch')}")
            
            detailed_summary = "Validation Failed:\n" + "\n".join(summary_parts)
            
            return jsonify({
                'error': 'Email does not match Sales Order - Cannot proceed with document generation',
                'validation_errors': validation_errors,
                'validation_summary': detailed_summary,
                'validation_details': validation_details,
                'email_data': email_data,
                'so_data': so_data
            }), 400
        
        print(f"SUCCESS: LOGISTICS: Email validated successfully against SO {so_number}")
        
        # SIMPLE DANGEROUS GOODS CHECK - Just check for REOLUBE item codes
        dangerous_goods_codes = ['REOL32BGTDRM', 'REOL46BDRM', 'REOL46XCDRM']
        has_dangerous_goods = False
        dangerous_items = []
        
        for item in so_data.get('items', []):
            item_code = item.get('item_code', '')
            if item_code in dangerous_goods_codes:
                has_dangerous_goods = True
                dangerous_items.append(item)
                print(f"DANGEROUS GOODS: Found {item_code} - {item.get('description', '')}")
        
        if not has_dangerous_goods:
            print("No dangerous goods detected - standard shipping")
        
        # Add validation success details to result
        validation_details['overall_status'] = 'passed'
        validation_details['message'] = 'All validations passed successfully'
        validation_details['dangerous_goods'] = {'has_dangerous_goods': has_dangerous_goods, 'items': dangerous_items}
        
        # Add pallet count to SO data for frontend comparison (even though it's not in SO PDF)
        # Pallet count is determined at shipping, not in the order
        so_data['pallet_count'] = email_data.get('pallet_count')  # Use email value for reference
        so_data['pallet_count_note'] = 'From shipping email (not in SO PDF)'
        
        # Enhanced email shipping data from GPT-4o
        email_shipping = {
            'weight': email_data.get('total_weight'),
            'pallet_info': {
                'count': email_data.get('pallet_count', 1),
                'dimensions': email_data.get('pallet_dimensions')
            },
            'batch_numbers': email_data.get('batch_numbers'),
            'pieces': email_data.get('pallet_count', 1),
            'carrier': email_data.get('carrier'),
            'special_instructions': email_data.get('special_instructions')
        }
        
        # Determine final destination from shipping address or email data
        final_destination = determine_final_destination(so_data, email_data)
        
        # Add comprehensive origin and transaction details for Commercial Invoice
        origin_details = {
            'country_of_origin': 'Canada',
            'final_destination': final_destination,
            'exporter_seller': {
                'company': 'Canoil Canada Ltd',
                'address': '62 Todd Road',
                'city': 'Georgetown',
                'province': 'ON',
                'postal_code': 'L7G 4R7',
                'country': 'Canada',
                'tax_id': ''  # To be filled from company data
            },
            'producer': {
                'company': 'Canoil Canada Ltd',  # Same as exporter for Canoil products
                'address': '62 Todd Road',
                'city': 'Georgetown', 
                'province': 'ON',
                'postal_code': 'L7G 4R7',
                'country': 'Canada'
            }
        }
        
        # Transaction details for Commercial Invoice
        transaction_details = {
            'currency': 'CAD',  # Default to CAD, can be overridden from SO data
            'parties_relationship': 'NOT RELATED',  # Standard for B2B sales
            'duty_brokerage_for': 'CONSIGNEE',  # Standard setting
            'terms_of_sale': email_data.get('terms_of_sale', 'Net 60. Due 11/18/25.'),  # From email or default
            'broker_carrier_ref': email_data.get('broker_carrier_ref', ''),
            'invoice_date': datetime.now().strftime('%Y-%m-%d'),
            'sale_date': datetime.now().strftime('%Y-%m-%d'),
            'irs_tax_number': ''  # To be filled if needed
        }
        
        # =====================================================================
        # SHARED LOGIC: Batch number matching (same as multi-SO)
        # =====================================================================
        if email_data.get('items') and so_data.get('items'):
            batch_result = match_batch_numbers_to_so_items(
                email_data.get('items', []), 
                so_data.get('items', [])
            )
            print(f"   Batch matching: {batch_result['matched_count']} matched, {len(batch_result['unmatched_items'])} unmatched")
        
        # =====================================================================
        # TRUST EMAIL MODE: Override SO quantities with email quantities
        # Also calculate new totals using SO unit prices
        # =====================================================================
        if trust_email_quantities and email_data.get('items') and so_data.get('items'):
            print(f"\n✏️ TRUST EMAIL MODE: Updating SO items with email quantities...")
            
            # Track which SO items have been matched to avoid double-matching
            matched_so_indices = set()
            
            for email_item in email_data.get('items', []):
                email_desc = (email_item.get('description') or '').upper().strip()
                email_qty_str = email_item.get('quantity', '')
                
                try:
                    email_qty = float(str(email_qty_str).replace(',', '')) if email_qty_str else 0
                except:
                    email_qty = 0
                
                if not email_desc or not email_qty:
                    continue
                
                print(f"\n   🔍 Looking for match for email item: '{email_desc}' (qty: {email_qty})")
                
                # Extract key identifying words from email description
                # Focus on product-specific words, not generic ones
                generic_words = {'CANOIL', 'KG', 'DRUM', 'PAIL', 'CASE', 'EACH', '180', '17', '55', 'X', 'DARK', 'GREEN'}
                email_words = set(email_desc.replace('-', ' ').replace('#', ' ').split())
                email_key_words = email_words - generic_words
                
                # Find best matching SO item
                best_match_idx = None
                best_match_score = 0
                
                for idx, so_item in enumerate(so_data.get('items', [])):
                    if idx in matched_so_indices:
                        continue  # Skip already matched items
                    
                    so_desc = (so_item.get('description') or '').upper().strip()
                    so_words = set(so_desc.replace('-', ' ').replace('#', ' ').split())
                    so_key_words = so_words - generic_words
                    
                    # Calculate match score based on key words
                    common_words = email_key_words & so_key_words
                    score = len(common_words)
                    
                    # Bonus for exact key product matches
                    key_products = ['EP2', 'EP1', 'EP0', 'MULTIPURPOSE', 'WHEEL', 'BEARING', 'HEAVY', 'DUTY']
                    for kp in key_products:
                        if kp in email_desc and kp in so_desc:
                            score += 5  # Strong bonus for key product match
                    
                    print(f"      Checking SO item {idx}: '{so_desc[:50]}...' - score: {score}, common: {common_words}")
                    
                    if score > best_match_score:
                        best_match_score = score
                        best_match_idx = idx
                
                # Apply the match if we found one with reasonable confidence
                if best_match_idx is not None and best_match_score >= 1:
                    matched_so_indices.add(best_match_idx)
                    so_item = so_data['items'][best_match_idx]
                    
                    original_qty = so_item.get('quantity', 0)
                    unit_price = so_item.get('unit_price', 0) or so_item.get('price', 0)
                    
                    # Parse unit price
                    try:
                        unit_price_num = float(str(unit_price).replace('$', '').replace(',', '').strip()) if unit_price else 0
                    except:
                        unit_price_num = 0
                    
                    # Update quantity with email value
                    so_item['original_quantity'] = original_qty  # Keep original for reference
                    so_item['quantity'] = email_qty
                    so_item['quantity_source'] = 'email_override'
                    
                    # Recalculate total if we have unit price
                    if unit_price_num > 0:
                        new_total = email_qty * unit_price_num
                        so_item['original_total'] = so_item.get('total', so_item.get('total_price', 0))
                        so_item['total'] = new_total
                        so_item['total_price'] = new_total
                        print(f"   ✏️ MATCHED & UPDATED '{so_item.get('description', '')[:40]}...': qty {original_qty} → {email_qty}, total ${new_total:,.2f}")
                    else:
                        print(f"   ✏️ MATCHED & UPDATED '{so_item.get('description', '')[:40]}...': qty {original_qty} → {email_qty} (no unit price for recalc)")
                else:
                    print(f"   ⚠️ NO MATCH FOUND for '{email_desc}'")
            
            # Recalculate SO totals
            new_subtotal = 0.0
            for item in so_data.get('items', []):
                item_total = item.get('total', item.get('total_price', 0))
                try:
                    item_total_num = float(str(item_total).replace('$', '').replace(',', '').strip()) if item_total else 0
                except:
                    item_total_num = 0
                new_subtotal += item_total_num
            
            so_data['original_subtotal'] = so_data.get('subtotal', so_data.get('total_amount', 0))
            so_data['subtotal'] = new_subtotal
            so_data['total_amount'] = new_subtotal  # Update total as well
            so_data['trust_email_mode'] = True
            print(f"   ✏️ Updated SO subtotal: ${new_subtotal:,.2f}")
        
        # =====================================================================
        # SHARED LOGIC: HTS code application (same as multi-SO)
        # =====================================================================
        apply_hts_codes_to_items(so_data.get('items', []))
        
        # FILTER SO ITEMS IF PARTIAL SHIPMENT (specific lines mentioned)
        if email_data.get('is_partial_shipment') and email_data.get('so_line_numbers'):
            line_numbers = email_data.get('so_line_numbers', [])
            original_item_count = len(so_data.get('items', []))
            
            print(f"\n🔥 FILTERING SO DATA - Partial shipment detected for lines: {line_numbers}")
            print(f"   Original SO has {original_item_count} items")
            
            filtered_items = []
            for idx, item in enumerate(so_data.get('items', []), start=1):
                if idx in line_numbers:
                    filtered_items.append(item)
                    print(f"   ✅ INCLUDING Line {idx}: {item.get('item_code')} - {item.get('description')}")
                else:
                    print(f"   ❌ EXCLUDING Line {idx}: {item.get('item_code')} - {item.get('description')}")
            
            so_data['items'] = filtered_items
            so_data['is_partial_shipment'] = True
            so_data['line_numbers'] = line_numbers
            print(f"   ✅ Filtered SO now has {len(filtered_items)} item(s) for shipment")
            
            # RECALCULATE TOTALS FOR FILTERED ITEMS ONLY
            print(f"\n💰 CALCULATING TOTALS FROM {len(filtered_items)} FILTERED ITEM(S):")
            subtotal = 0.0
            
            for idx, item in enumerate(filtered_items, 1):
                item_total = 0.0
                
                # Debug: Show what fields are available
                print(f"\n   Item {idx} of {len(filtered_items)}:")
                print(f"   Available fields: {list(item.keys())}")
                print(f"   Item Code: {item.get('item_code')}")
                print(f"   Description: {item.get('description')}")
                
                if 'total' in item:
                    try:
                        total_str = str(item['total']).replace('$', '').replace(',', '').strip()
                        item_total = float(total_str)
                        print(f"   ✅ Found 'total' field: ${item_total:,.2f}")
                    except Exception as e:
                        print(f"   ❌ Error parsing 'total' ({item.get('total')}): {e}")
                
                elif 'total_price' in item:
                    try:
                        total_str = str(item['total_price']).replace('$', '').replace(',', '').strip()
                        item_total = float(total_str)
                        print(f"   ✅ Found 'total_price' field: ${item_total:,.2f}")
                    except Exception as e:
                        print(f"   ❌ Error parsing 'total_price' ({item.get('total_price')}): {e}")
                
                elif 'quantity' in item and 'unit_price' in item:
                    try:
                        qty = float(str(item['quantity']).replace(',', ''))
                        price_str = str(item['unit_price']).replace('$', '').replace(',', '').strip()
                        price = float(price_str)
                        item_total = qty * price
                        print(f"   ✅ Calculated from qty ({qty}) × price (${price:,.2f}): ${item_total:,.2f}")
                    except Exception as e:
                        print(f"   ❌ Error calculating qty×price: {e}")
                else:
                    print(f"   ⚠️ WARNING: No price field found for this item!")
                
                print(f"   → Item Total: ${item_total:,.2f}")
                subtotal += item_total
            
            print(f"\n   📊 SUBTOTAL (from {len(filtered_items)} item(s)): ${subtotal:,.2f}")
            
            # Canadian HST (13% - Ontario standard rate)
            hst_rate = 0.13
            hst_amount = subtotal * hst_rate
            grand_total = subtotal + hst_amount
            
            # Update SO data with partial shipment totals
            so_data['subtotal'] = f"${subtotal:,.2f}"
            so_data['hst'] = f"${hst_amount:,.2f}"
            so_data['total'] = f"${grand_total:,.2f}"
            so_data['partial_shipment_notice'] = f"⚠️ PARTIAL SHIPMENT: This is for line {line_numbers} ONLY. Total recalculated for selected line(s)."
            
            print(f"\n💰 RECALCULATED TOTALS FOR PARTIAL SHIPMENT:")
            print(f"   Subtotal: ${subtotal:,.2f}")
            print(f"   HST (13%): ${hst_amount:,.2f}")
            print(f"   Grand Total: ${grand_total:,.2f}")
            print(f"   ⚠️ This is for line {line_numbers} only - NOT the full SO!\n")
        
        # =========================================================================
        # BROKER DETECTION - Uses SHARED function (same logic as multi-SO)
        # =========================================================================
        detect_and_apply_broker_info(
            email_content=email_content,
            email_data=email_data,
            so_data=so_data,
            gpt_email_data=email_data  # For single-SO, GPT data is in email_data
        )
        
        # =========================================================================
        # DOCUMENT REQUEST DETECTION - What documents does the user want?
        # =========================================================================
        requested_documents = extract_requested_documents(email_content)
        email_data['requested_documents'] = requested_documents
        
        result = {
            'success': True,
            'so_data': so_data,
            'email_data': email_data,
            'email_analysis': email_data,  # For backward compatibility
            'items': so_data.get('items', []),
            'email_shipping': email_shipping,
            'origin_details': origin_details,
            'transaction_details': transaction_details,
            'so_pdf_file': so_data.get('file_path'),
            'auto_detection': {
                'so_number': so_number,
                'filename': os.path.basename(so_data.get('file_path', '')),
                'file_path': so_data.get('file_path')
            },
            'validation_details': validation_details,
            'validation_passed': True,
            'requested_documents': requested_documents,
            'trust_email_mode': trust_email_quantities  # Flag indicating email quantities were used
        }
        
        print(f"\n{'='*80}")
        print(f"SERVER RESTART CHECK")
        print(f"If you see this message, the server is running LATEST code!")
        print(f"Timestamp: {datetime.now()}")
        print(f"{'='*80}\n")
        
        print(f"SUCCESS: LOGISTICS: Successfully processed SO {so_number} with REAL DATA")
        print(f"DEBUG: email_data being returned: {json.dumps(email_data, indent=2, ensure_ascii=False)}")
        
        # CRITICAL DEBUG: Show EXACT addresses being sent to frontend
        print(f"\n{'='*80}")
        print(f"ADDRESSES BEING SENT TO FRONTEND:")
        print(f"{'='*80}")
        print(f"Billing Address:")
        print(f"  company: {so_data.get('billing_address', {}).get('company')}")
        print(f"  contact: {so_data.get('billing_address', {}).get('contact')}")
        print(f"  street: {so_data.get('billing_address', {}).get('street')}")
        print(f"  city: {so_data.get('billing_address', {}).get('city')}")
        print(f"  province: {so_data.get('billing_address', {}).get('province')}")
        print(f"  postal: {so_data.get('billing_address', {}).get('postal')}")
        print(f"  country: {so_data.get('billing_address', {}).get('country')}")
        print(f"\nShipping Address:")
        print(f"  company: {so_data.get('shipping_address', {}).get('company')}")
        print(f"  street: {so_data.get('shipping_address', {}).get('street')}")
        print(f"  city: {so_data.get('shipping_address', {}).get('city')}")
        print(f"  province: {so_data.get('shipping_address', {}).get('province')}")
        print(f"  postal: {so_data.get('shipping_address', {}).get('postal')}")
        print(f"  country: {so_data.get('shipping_address', {}).get('country')}")
        print(f"{'='*80}\n")
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        error_type = type(e).__name__
        
        print("\n" + "="*80)
        print("FATAL ERROR IN PROCESS EMAIL")
        print("="*80)
        print(f"Error Type: {error_type}")
        print(f"Error Message: {error_msg}")
        print(f"Error Args: {e.args if hasattr(e, 'args') else 'N/A'}")
        print("\nFull Traceback:")
        print(error_trace)
        print("="*80 + "\n")
        
        # Try to return error response, but if that fails, at least log it
        try:
            return jsonify({
                'error': error_msg, 
                'error_type': error_type,
                'traceback': error_trace
            }), 500
        except Exception as response_error:
            print(f"CRITICAL: Could not create error response: {response_error}")
            print(f"Original error was: {error_msg}")
            # Return minimal error
            return f"Internal Server Error: {error_msg}", 500

@logistics_bp.route('/api/logistics/generate-bol-html', methods=['POST'])
def generate_bol():
    """Generate BOL using NEW professional 8-row format template"""
    try:
        print("\n=== GENERATING BOL (Professional Format) ===")
        data = request.get_json()
        
        so_data = data.get('so_data', {})
        # FIX: Frontend sends email_analysis, not email_shipping - get the correct one
        email_analysis = data.get('email_analysis', {}) or data.get('email_shipping', {}) or data.get('email_data', {})
        shipper_override = data.get('shipper_override') or {}
        try:
            if isinstance(shipper_override, dict) and shipper_override:
                so_data['shipper_override'] = shipper_override
                email_analysis['shipper_override'] = shipper_override
        except Exception as override_err:
            print(f"WARNING: Failed to apply shipper_override in BOL: {override_err}")
        
        print(f"DEBUG BOL: email_analysis keys: {list(email_analysis.keys())}")
        print(f"DEBUG BOL: skid_info = {email_analysis.get('skid_info')}")
        print(f"DEBUG BOL: pallet_dimensions = {email_analysis.get('pallet_dimensions')}")
        
        # Use the NEW BOL generator (professional format)
        from new_bol_generator import populate_new_bol_html
        
        html_content = populate_new_bol_html(so_data, email_analysis)
        
        # Save the generated HTML with new naming format
        html_filename = generate_document_filename("BOL", so_data, '.html')
        uploads_dir = get_uploads_dir()
        html_filepath = os.path.join(uploads_dir, html_filename)
        
        os.makedirs(os.path.dirname(html_filepath), exist_ok=True)
        with open(html_filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"SUCCESS: New BOL generated: {html_filename}")
        
        return jsonify({
            'success': True,
            'message': 'BOL generated successfully (Professional Format)',
            'filename': html_filename,
            'download_url': f'/download/logistics/{html_filename}',
            'file_type': 'html'
        })
        
    except Exception as e:
        print(f"ERROR: LOGISTICS: Error generating BOL: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Routes are already defined above, removing duplicates

@logistics_bp.route('/download/logistics/<path:filepath>', methods=['GET', 'OPTIONS'])
def download_file(filepath):
    """Download generated logistics files automatically - Forces download dialog
    Supports nested paths like: CompanyName/Year/Month/OrderFolder/HTML Format/filename.html
    Also supports ZIP downloads: CompanyName.zip (creates ZIP of entire company folder with hierarchy)
    
    ZIP Structure:
    CompanyName.zip
    └── CompanyName/
        └── 2026/
            └── January/
                └── CompanyName_SO1234_PO5678/
                    ├── HTML Format/
                    │   ├── BOL.html
                    │   ├── PackingSlip.html
                    │   └── CommercialInvoice.html
                    └── PDF Format/
                        ├── TSCA.pdf
                        └── USMCA.pdf
    """
    import zipfile
    import shutil
    
    try:
        uploads_dir = get_uploads_dir()
        print(f"📥 Download request for: {filepath}")
        
        # Check if this is a ZIP request for a company folder
        if filepath.endswith('.zip'):
            # The filepath could be:
            # 1. "CompanyName.zip" - ZIP entire company folder
            # 2. "CompanyName/2026/January/OrderFolder.zip" - ZIP specific order folder
            
            folder_path_without_zip = filepath[:-4]  # Remove .zip extension
            
            # Check if it's a company-level ZIP (just company name, no slashes)
            if '/' not in folder_path_without_zip and '\\' not in folder_path_without_zip:
                # Company-level ZIP - ZIP the entire company folder
                company_name = folder_path_without_zip
                company_folder = os.path.join(uploads_dir, company_name)
                
                print(f"📦 Company ZIP request for: {company_name}")
                print(f"📁 Company folder path: {company_folder}")
                print(f"📁 Folder exists: {os.path.exists(company_folder)}")
                
                if os.path.exists(company_folder) and os.path.isdir(company_folder):
                    # Create ZIP file
                    zip_path = os.path.join(uploads_dir, f"{company_name}.zip")
                    
                    # Create the ZIP file with hierarchical structure
                    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for root, dirs, files in os.walk(company_folder):
                            for file in files:
                                file_path = os.path.join(root, file)
                                # Archive name is relative to uploads_dir, so it includes CompanyName/Year/Month/...
                                arcname = os.path.relpath(file_path, uploads_dir)
                                zipf.write(file_path, arcname)
                                print(f"   Added to ZIP: {arcname}")
                    
                    print(f"✅ Company ZIP created: {zip_path}")
                    
                    # Send the ZIP file
                    response = send_file(
                        zip_path,
                        as_attachment=True,
                        download_name=f"{company_name}.zip",
                        mimetype='application/zip'
                    )
                    response.headers['Access-Control-Allow-Origin'] = '*'
                    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                    response.headers['Access-Control-Allow-Headers'] = '*'
                    return response
                else:
                    print(f"❌ Company folder not found: {company_folder}")
                    return jsonify({'error': f'Company folder not found: {company_name}'}), 404
            else:
                # Order-level ZIP - ZIP a specific order folder (Year/Month/OrderFolder)
                folder_path = os.path.join(uploads_dir, folder_path_without_zip)
                # Get just the order folder name for the ZIP filename
                order_folder_name = os.path.basename(folder_path_without_zip)
                
                print(f"📦 Order ZIP request for: {folder_path_without_zip}")
                print(f"📁 Folder path: {folder_path}")
                print(f"📁 Folder exists: {os.path.exists(folder_path)}")
                
                if os.path.exists(folder_path) and os.path.isdir(folder_path):
                    # Create ZIP file
                    zip_path = os.path.join(uploads_dir, f"{order_folder_name}.zip")
                    
                    # Create the ZIP file - include full path structure
                    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for root, dirs, files in os.walk(folder_path):
                            for file in files:
                                file_path = os.path.join(root, file)
                                # Archive name is relative to uploads_dir to preserve hierarchy
                                arcname = os.path.relpath(file_path, uploads_dir)
                                zipf.write(file_path, arcname)
                                print(f"   Added to ZIP: {arcname}")
                    
                    print(f"✅ Order ZIP created: {zip_path}")
                    
                    # Send the ZIP file
                    response = send_file(
                        zip_path,
                        as_attachment=True,
                        download_name=f"{order_folder_name}.zip",
                        mimetype='application/zip'
                    )
                    response.headers['Access-Control-Allow-Origin'] = '*'
                    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                    response.headers['Access-Control-Allow-Headers'] = '*'
                    return response
                else:
                    print(f"❌ Order folder not found: {folder_path}")
                    return jsonify({'error': f'Folder not found: {folder_path_without_zip}'}), 404
        
        # Regular file download
        # filepath can be just filename or nested path like "folder/subfolder/file.html"
        full_path = os.path.join(uploads_dir, filepath)
        filename = os.path.basename(filepath)
        print(f"📁 Full path: {full_path}")
        print(f"📁 File exists: {os.path.exists(full_path)}")
        
        if os.path.exists(full_path):
            # Determine mimetype based on file extension
            mimetype = 'application/octet-stream'  # Default to force download
            
            if filename.endswith('.html'):
                mimetype = 'text/html'
            elif filename.endswith('.pdf'):
                mimetype = 'application/pdf'
            elif filename.endswith('.docx'):
                mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            elif filename.endswith('.doc'):
                mimetype = 'application/msword'
            elif filename.endswith('.xlsx'):
                mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            elif filename.endswith('.xls'):
                mimetype = 'application/vnd.ms-excel'
            elif filename.endswith('.txt'):
                mimetype = 'text/plain'
            elif filename.endswith('.csv'):
                mimetype = 'text/csv'
            elif filename.endswith('.zip'):
                mimetype = 'application/zip'
            
            print(f"📄 MIME type: {mimetype}")
            
            # Create response with CORS headers
            from flask import Response
            response = send_file(
                full_path, 
                as_attachment=True,  # This forces download dialog
                download_name=filename,
                mimetype=mimetype
            )
            
            # Add CORS headers
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = '*'
            
            return response
        else:
            print(f"❌ File not found: {full_path}")
            return jsonify({'error': f'File not found: {filepath}'}), 404
    except Exception as e:
        print(f"❌ Error serving file {filename}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@logistics_bp.route('/api/logistics/generate-packing-slip', methods=['POST'])
def generate_packing_slip():
    """Generate Packing Slip HTML using actual template with GPT-4o"""
    try:
        print("\n📦 === GENERATING PACKING SLIP ===")
        data = request.get_json()
        
        so_data = data.get('so_data', {})
        email_shipping = data.get('email_shipping', {})
        shipper_override = data.get('shipper_override') or {}
        try:
            if isinstance(shipper_override, dict) and shipper_override:
                so_data['shipper_override'] = shipper_override
                email_shipping['shipper_override'] = shipper_override
        except Exception as override_err:
            print(f"WARNING: Failed to apply shipper_override in Packing Slip: {override_err}")
        items = data.get('items', [])
        
        # Use the actual packing slip generator
        from packing_slip_html_generator import generate_packing_slip_html
        
        html_content = generate_packing_slip_html(so_data, email_shipping, items)
        
        filename = generate_document_filename("PackingSlip", so_data, '.html')
        uploads_dir = get_uploads_dir()
        filepath = os.path.join(uploads_dir, filename)
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Return HTML directly (skip PDF conversion for now)
        print(f"SUCCESS: Packing Slip HTML generated: {filename}")
        
        return jsonify({
            'success': True,
            'message': 'Packing Slip generated successfully (HTML)',
            'packing_slip_file': filename,
            'download_url': f'/download/logistics/{filename}',
            'file_type': 'html'
        })
        
    except Exception as e:
        print(f"ERROR: Error generating packing slip: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@logistics_bp.route('/api/logistics/generate-commercial-invoice', methods=['POST'])
def generate_commercial_invoice():
    """Generate Commercial Invoice HTML using actual template with GPT-4o"""
    try:
        print("\n💰 === GENERATING COMMERCIAL INVOICE ===")
        data = request.get_json()
        
        so_data = data.get('so_data', {})
        items = data.get('items', [])
        # FIX: Frontend might send email_shipping OR email_analysis - accept both
        email_analysis = data.get('email_analysis', {}) or data.get('email_shipping', {}) or data.get('email_data', {})
        shipper_override = data.get('shipper_override') or {}
        try:
            if isinstance(shipper_override, dict) and shipper_override:
                so_data['shipper_override'] = shipper_override
                email_analysis['shipper_override'] = shipper_override
        except Exception as override_err:
            print(f"WARNING: Failed to apply shipper_override in Commercial Invoice: {override_err}")
        origin_details = data.get('origin_details', {})
        transaction_details = data.get('transaction_details', {})
        
        print(f"DEBUG CI: email_analysis keys: {list(email_analysis.keys())}")
        print(f"DEBUG CI: total_weight = {email_analysis.get('total_weight')}")
        print(f"DEBUG CI: weight = {email_analysis.get('weight')}")
        print(f"DEBUG CI: SO ship_date = {so_data.get('ship_date')}")
        
        # Use the actual commercial invoice generator with enhanced data
        from commercial_invoice_html_generator import generate_commercial_invoice_html
        
        html_content = generate_commercial_invoice_html(
            so_data, 
            items, 
            email_analysis
        )
        
        uploads_dir = get_uploads_dir()
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Save HTML file
        html_filename = generate_document_filename("CommercialInvoice", so_data, '.html')
        html_filepath = os.path.join(uploads_dir, html_filename)
        with open(html_filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"SUCCESS: Commercial invoice HTML generated: {html_filename}")
        
        # HTML only - no PDF conversion
        response_data = {
            'success': True,
            'commercial_invoice_file': html_filename,
            'download_url': f'/download/logistics/{html_filename}',
            'file_type': 'html'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"ERROR: Error generating commercial invoice: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@logistics_bp.route('/api/logistics/generate-tsca', methods=['POST'])
def generate_tsca_only():
    """Generate TSCA Certification only"""
    try:
        print("\n📋 === GENERATING TSCA CERTIFICATION (Individual) ===")
        data = request.get_json()
        
        so_data = data.get('so_data', {})
        items = data.get('items', [])
        email_analysis = data.get('email_analysis', {})
        
        from tsca_generator import generate_tsca_certification
        
        tsca_result = generate_tsca_certification(so_data, items, email_analysis)
        
        if tsca_result:
            tsca_filepath, tsca_filename = tsca_result
            
            return jsonify({
                'success': True,
                'filename': tsca_filename,
                'download_url': f'/download/logistics/{tsca_filename}',
                'message': 'TSCA Certification generated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No products to certify or TSCA not required for this shipment'
            })
            
    except Exception as e:
        print(f"❌ TSCA generation error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@logistics_bp.route('/api/logistics/generate-dangerous-goods', methods=['POST'])
def generate_dangerous_goods_only():
    """Generate only dangerous goods declarations"""
    try:
        print("\n⚠️ === GENERATING DANGEROUS GOODS ONLY ===")
        data = request.get_json()
        
        so_data = data.get('so_data', {})
        items = data.get('items', [])
        # FIX: Accept both email_shipping and email_analysis
        email_shipping = data.get('email_shipping', {}) or data.get('email_analysis', {}) or data.get('email_data', {})
        
        print(f"DEBUG DG: Items to check: {len(items)}")
        print(f"DEBUG DG: SO data keys: {list(so_data.keys())}")
        print(f"DEBUG DG: Email shipping keys: {list(email_shipping.keys())}")
        print(f"DEBUG DG: First item: {items[0] if items else 'NO ITEMS'}")
        
        from dangerous_goods_generator import generate_dangerous_goods_declarations
        import shutil
        
        dg_result = generate_dangerous_goods_declarations(so_data, items, email_shipping)
        
        if dg_result and dg_result.get('dg_forms'):
            print(f"✅ Found {len(dg_result['dg_forms'])} dangerous goods file(s)")
            
            dangerous_goods_results = []
            sds_results = []
            cofa_results = []
            
            # Process DG forms - with individual error handling
            for dg_filepath, dg_original_filename in dg_result['dg_forms']:
                try:
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    new_dg_filename = generate_document_filename("DangerousGoods", so_data, '.docx')
                    uploads_dir = get_uploads_dir()
                    new_dg_path = os.path.join(uploads_dir, new_dg_filename)
                    
                    os.makedirs(os.path.dirname(new_dg_path), exist_ok=True)
                    shutil.copy2(dg_filepath, new_dg_path)
                    
                    dangerous_goods_results.append({
                        'success': True,
                        'filename': new_dg_filename,
                        'download_url': f'/download/logistics/{new_dg_filename}'
                    })
                    print(f"✅ Copied DG Form: {new_dg_filename}")
                except Exception as dg_err:
                    print(f"❌ Failed to process DG form {dg_original_filename}: {dg_err}")
                    # Continue to next DG form
            
            # Process SDS files - with individual error handling
            for sds_path, sds_filename, product_name in dg_result.get('sds_files', []):
                try:
                    # Get file extension from original
                    file_ext = os.path.splitext(sds_filename)[1]
                    
                    # Create consistent filename: SDS_ProductName_Date.ext
                    timestamp_sds = datetime.now().strftime('%Y%m%d')
                    clean_product = product_name.replace(' ', '_').replace('/', '_')
                    new_sds_filename = f"SDS_{clean_product}_{timestamp_sds}{file_ext}"
                    
                    # Copy SDS to uploads folder with new name
                    uploads_dir = get_uploads_dir()
                    new_sds_path = os.path.join(uploads_dir, new_sds_filename)
                    shutil.copy2(sds_path, new_sds_path)
                    
                    sds_results.append({
                        'success': True,
                        'filename': new_sds_filename,
                        'download_url': f'/download/logistics/{new_sds_filename}',
                        'product': product_name
                    })
                    print(f"✅ SDS renamed: {new_sds_filename}")
                except Exception as sds_err:
                    print(f"❌ Failed to process SDS for {product_name}: {sds_err}")
                    # Continue to next SDS file
            
            # Process COFA files - with individual error handling
            for cofa_path, cofa_filename, product_name, batch in dg_result.get('cofa_files', []):
                try:
                    # Get file extension from original
                    file_ext = os.path.splitext(cofa_filename)[1]
                    
                    # Create consistent filename: COFA_ProductName_Batch_Date.ext
                    timestamp_cofa = datetime.now().strftime('%Y%m%d')
                    clean_product = product_name.replace(' ', '_').replace('/', '_')
                    new_cofa_filename = f"COFA_{clean_product}_Batch{batch}_{timestamp_cofa}{file_ext}"
                    
                    # Copy COFA to uploads folder with new name
                    uploads_dir = get_uploads_dir()
                    new_cofa_path = os.path.join(uploads_dir, new_cofa_filename)
                    shutil.copy2(cofa_path, new_cofa_path)
                    
                    cofa_results.append({
                        'success': True,
                        'filename': new_cofa_filename,
                        'download_url': f'/download/logistics/{new_cofa_filename}',
                        'product': product_name,
                        'batch': batch
                    })
                    print(f"✅ COFA renamed: {new_cofa_filename}")
                except Exception as cofa_err:
                    print(f"❌ Failed to process COFA for {product_name} batch {batch}: {cofa_err}")
                    # Continue to next COFA file
            
            return jsonify({
                'success': True,
                'dangerous_goods_files': dangerous_goods_results,
                'sds_files': sds_results,
                'cofa_files': cofa_results,
                'message': f'Generated {len(dangerous_goods_results)} DG declaration(s), {len(sds_results)} SDS, {len(cofa_results)} COFA'
            })
        else:
            print("ℹ️  No dangerous goods detected")
            return jsonify({
                'success': False,
                'message': 'No dangerous goods detected in this shipment'
            })
            
    except Exception as e:
        print(f"❌ ERROR generating dangerous goods: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@logistics_bp.route('/api/logistics/generate-manual', methods=['POST', 'OPTIONS'])
def generate_manual_documents():
    """Generate logistics documents from text input - AI parses everything (no SO number required)"""
    # Handle OPTIONS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response, 200
    
    try:
        print("\n📋 === GENERATING MANUAL LOGISTICS DOCUMENTS FROM TEXT ===")
        data = request.get_json()
        
        if data is None:
            return jsonify({
                'success': False,
                'error': 'No data received. Make sure Content-Type is application/json'
            }), 400
        
        # Get text input
        text_input = data.get('text_input', '').strip()
        
        if not text_input:
            return jsonify({
                'success': False,
                'error': 'Text input is required'
            }), 400
        
        print(f"📝 Parsing text input with AI (length: {len(text_input)} chars)...")
        
        # Use GPT to parse the text input with much smarter logic
        parse_prompt = f"""
        You are a logistics expert parsing shipping information. Extract ALL details accurately.
        
        CRITICAL RULES:
        1. "Going from" = SHIPPER (who is sending/shipping FROM)
        2. "Going to" = CONSIGNEE (who is receiving TO)
        3. If text says "Going from: [Company A]" and "Going to: [Company B]", then:
           - Shipper = Company A (the FROM address)
           - Consignee = Company B (the TO address)
        4. NEVER assume Canoil is the shipper unless explicitly stated
        5. If multiple orders/materials are mentioned, extract ALL items separately
        6. Match weights, pallets, and quantities to the correct items
        7. Extract release numbers, delivery numbers, customer POs, sales orders if mentioned
        
        Text Input:
        {text_input}
        
        Extract and return as JSON with this EXACT structure:
        {{
            "so_number": "sales order number if mentioned (just the number, e.g. 3110)",
            "po_number": "primary PO number if mentioned (e.g. 20260109 or PO-20260109)",
            "shipper": {{
                "company": "EXTRACT from 'Going from:' section - the company name sending the shipment",
                "address": "full street address from 'Going from:' section",
                "city": "city name",
                "state": "province/state abbreviation (e.g., ON, AB, BC)",
                "postal": "postal code",
                "country": "country (default: Canada if not specified)",
                "phone": "phone if mentioned",
                "email": "email if mentioned",
                "contact_person": "contact name if mentioned"
            }},
            "consignee": {{
                "company": "EXTRACT from 'Going to:' section - the company name receiving the shipment",
                "address": "full street address from 'Going to:' section",
                "city": "city name",
                "state": "province/state abbreviation (e.g., ON, AB, BC)",
                "postal": "postal code",
                "country": "country (default: Canada if not specified)",
                "phone": "phone if mentioned",
                "email": "email if mentioned",
                "contact_person": "contact name if mentioned"
            }},
            "items": [
                {{
                    "description": "product/material name (e.g., 'Material G-2015-2', 'G-2032-0', product code)",
                    "quantity": "total quantity as string (e.g., '34' for 34 drums)",
                    "unit": "unit type: drum, pail, case, keg, tote, box, or pieces",
                    "batch_number": "batch number if mentioned",
                    "sales_order": "sales order number if mentioned for this item",
                    "delivery_number": "delivery number if mentioned for this item",
                    "customer_po": "customer PO number if mentioned for this item",
                    "release_number": "release number if mentioned for this item"
                }}
            ],
            "weights": {{
                "total_weight": "TOTAL gross weight across ALL items as string (sum if multiple items)",
                "weight_unit": "kg or lbs (extract from text)",
                "weight_per_pallet": "weight per pallet if mentioned"
            }},
            "skids": {{
                "count": "TOTAL number of pallets/skids across ALL items as string (sum if multiple items)",
                "dimensions": "dimensions if mentioned (e.g., 45×45×40 inches)",
                "pieces": "total pieces count if mentioned"
            }},
            "carrier": "carrier/shipping company name if mentioned",
            "release_numbers": "release numbers as array if mentioned (e.g., ['4000599546', '4000603468'])",
            "special_instructions": "all special instructions, shipping hours, gate instructions, check-in procedures, etc."
        }}
        
        EXAMPLES:
        
        Example 1:
        "Going from: LANXESS Canada Co/Cie c/o West Hill 10 Chemical Court SCARBOROUGH ON M1E 2K3 CANADA
         Going to: Canoil Canada LTD / 62 Todd Road GEORGETOWN-HALTON HILLS ON L7G 4R7 CANADA
         Material G-2015-2: 34 drums, 9 pallets, 6885 kg"
        
        Result:
        - shipper.company = "LANXESS Canada Co/Cie"
        - shipper.address = "10 Chemical Court"
        - shipper.city = "SCARBOROUGH"
        - shipper.state = "ON"
        - shipper.postal = "M1E 2K3"
        - consignee.company = "Canoil Canada LTD"
        - consignee.address = "62 Todd Road"
        - consignee.city = "GEORGETOWN-HALTON HILLS"
        - consignee.state = "ON"
        - consignee.postal = "L7G 4R7"
        - items[0].description = "Material G-2015-2"
        - items[0].quantity = "34"
        - items[0].unit = "drum"
        - skids.count = "9"
        - weights.total_weight = "6885"
        - weights.weight_unit = "kg"
        
        Example 2 (Multiple items):
        "Material G-2015-2: 34 drums, 9 pallets, 6885 kg
         Material G-2032-0: 8 totes, 8 pallets, 7680 kg"
        
        Result:
        - items = [
            {{"description": "Material G-2015-2", "quantity": "34", "unit": "drum"}},
            {{"description": "Material G-2032-0", "quantity": "8", "unit": "tote"}}
          ]
        - skids.count = "17" (9 + 8)
        - weights.total_weight = "14565" (6885 + 7680)
        
        CRITICAL EXTRACTION RULES:
        - Parse addresses carefully - extract street number, street name, city, province, postal code separately
        - If "Going from:" and "Going to:" are clearly labeled, use those EXACTLY
        - Sum pallet counts if multiple items have different pallet counts
        - Sum weights if multiple items have different weights
        - Extract ALL items separately - don't combine them
        - Match sales orders, delivery numbers, POs to the correct items
        - Extract release numbers as an array if multiple mentioned
        - Include ALL special instructions (shipping hours, gate procedures, check-in, etc.)
        
        Return ONLY valid JSON, no explanations.
        """
        
        # Parse with GPT
        parsed_data = parse_text_with_gpt4(parse_prompt)
        
        if not parsed_data:
            return jsonify({
                'success': False,
                'error': 'Failed to parse text input. Please provide clearer information.'
            }), 400
        
        print(f"✅ Parsed data: Shipper={parsed_data.get('shipper', {}).get('company')}, Consignee={parsed_data.get('consignee', {}).get('company')}")
        print(f"📦 RAW PARSED DATA FROM GPT:")
        print(f"   Full parsed_data: {parsed_data}")
        
        # Extract parsed data
        shipper = parsed_data.get('shipper', {})
        consignee = parsed_data.get('consignee', {})
        items = parsed_data.get('items', [])
        
        print(f"📍 SHIPPER EXTRACTED: {shipper}")
        print(f"📍 CONSIGNEE EXTRACTED: {consignee}")
        print(f"📦 ITEMS EXTRACTED: {items}")
        weights = parsed_data.get('weights', {})
        skids = parsed_data.get('skids', {})
        carrier = parsed_data.get('carrier', '')
        po_number = parsed_data.get('po_number', '')
        so_number = parsed_data.get('so_number', '')
        release_numbers = parsed_data.get('release_numbers', [])
        special_instructions = parsed_data.get('special_instructions', '')

        # Fallback: extract SO/PO from raw text if GPT didn't provide them
        try:
            if not so_number:
                so_matches = re.findall(r'(?:\bSO\b|Sales\s*Order)\s*#?:?\s*(\d{3,6})', text_input, re.IGNORECASE)
                if so_matches:
                    so_number = so_matches[0]
            if not po_number:
                po_match = re.search(r'(?:\bPO\b|P\.?O\.?|Purchase\s*Order)\s*#?:?\s*([A-Za-z0-9-]+)', text_input, re.IGNORECASE)
                if po_match:
                    po_number = po_match.group(1)
        except Exception as parse_err:
            print(f"WARNING: Manual SO/PO fallback parse failed: {parse_err}")
        
        # Validate that we have shipper and consignee
        if not shipper.get('company') or not consignee.get('company'):
            return jsonify({
                'success': False,
                'error': 'Could not identify shipper (from) and/or consignee (to). Please include "Going from:" and "Going to:" sections.'
            }), 400
        
        # If multiple items have individual pallet counts, sum them
        if items and len(items) > 1:
            # Check if items have individual pallet info
            total_pallets_from_items = 0
            total_weight_from_items = 0.0
            for item in items:
                if item.get('pallets'):
                    try:
                        total_pallets_from_items += int(item.get('pallets', 0))
                    except:
                        pass
                if item.get('weight'):
                    try:
                        total_weight_from_items += float(item.get('weight', 0))
                    except:
                        pass
            
            # Use summed values if available
            if total_pallets_from_items > 0:
                skids['count'] = str(total_pallets_from_items)
            if total_weight_from_items > 0:
                weights['total_weight'] = str(int(total_weight_from_items))
        
        print(f"📊 Extracted: {len(items)} items, {skids.get('count', '?')} pallets, {weights.get('total_weight', '?')} {weights.get('weight_unit', 'kg')}")
        
        # Validate required fields
        if not shipper.get('company') or not consignee.get('company'):
            return jsonify({
                'success': False,
                'error': 'Shipper and Consignee company names are required'
            }), 400
        
        if not items or len(items) == 0:
            return jsonify({
                'success': False,
                'error': 'At least one item is required'
            }), 400
        
        # Format items properly for document generators
        formatted_items = []
        for item in items:
            formatted_item = {
                'description': item.get('description', ''),
                'quantity': str(item.get('quantity', '')),
                'unit': item.get('unit', 'drum'),
                'batch_number': item.get('batch_number', ''),
                'item_code': item.get('item_code', '') or item.get('description', ''),  # Use description as item_code if not provided
                'hts_code': item.get('hts_code', ''),
                'country_of_origin': item.get('country_of_origin', 'Canada'),
                'sales_order': item.get('sales_order', ''),
                'delivery_number': item.get('delivery_number', ''),
                'customer_po': item.get('customer_po', '')
            }
            formatted_items.append(formatted_item)
        
        print(f"📦 Formatted {len(formatted_items)} items for document generation")
        for idx, item in enumerate(formatted_items, 1):
            print(f"   Item {idx}: {item.get('quantity', '?')} {item.get('unit', '?')} of {item.get('description', '?')[:50]}")
        
        # Create minimal so_data structure from manual input
        # Build full addresses properly for document generators
        # CRITICAL: Build address line by line, ensuring we have SOMETHING
        shipper_addr_parts = []
        if shipper.get('address'):
            shipper_addr_parts.append(shipper.get('address'))
        city_state_postal = f"{shipper.get('city', '')}, {shipper.get('state', '')} {shipper.get('postal', '')}".strip(', ')
        if city_state_postal and city_state_postal != ',':
            shipper_addr_parts.append(city_state_postal)
        if shipper.get('country'):
            shipper_addr_parts.append(shipper.get('country'))
        elif not shipper_addr_parts:  # If nothing else, at least add country
            shipper_addr_parts.append('Canada')
        shipper_full_address = '\n'.join(shipper_addr_parts)
        
        consignee_addr_parts = []
        if consignee.get('address'):
            consignee_addr_parts.append(consignee.get('address'))
        city_state_postal = f"{consignee.get('city', '')}, {consignee.get('state', '')} {consignee.get('postal', '')}".strip(', ')
        if city_state_postal and city_state_postal != ',':
            consignee_addr_parts.append(city_state_postal)
        if consignee.get('country'):
            consignee_addr_parts.append(consignee.get('country'))
        elif not consignee_addr_parts:  # If nothing else, at least add country
            consignee_addr_parts.append('Canada')
        consignee_full_address = '\n'.join(consignee_addr_parts)
        
        print(f"📍 SHIPPER full address: {shipper_full_address}")
        print(f"📍 CONSIGNEE full address: {consignee_full_address}")
        print(f"📍 SHIPPER raw data: {shipper}")
        print(f"📍 CONSIGNEE raw data: {consignee}")
        
        so_data = {
            'so_number': so_number or 'MANUAL',  # Use parsed SO if available
            'po_number': po_number,
            'customer_name': consignee.get('company', ''),
            'order_date': datetime.now().strftime('%Y-%m-%d'),
            'ship_date': datetime.now().strftime('%Y-%m-%d'),
            'items': formatted_items,
            'billing_address': {
                'company_name': shipper.get('company', ''),
                'company': shipper.get('company', ''),
                'contact_person': shipper.get('contact_person', ''),
                'street': shipper.get('address', ''),
                'street_address': shipper.get('address', ''),
                'address': shipper.get('address', ''),
                'city': shipper.get('city', ''),
                'province': shipper.get('state', ''),
                'state': shipper.get('state', ''),
                'postal_code': shipper.get('postal', ''),
                'postal': shipper.get('postal', ''),
                'country': shipper.get('country', 'Canada'),
                'phone': shipper.get('phone', ''),
                'email': shipper.get('email', ''),
                'full_address': shipper_full_address
            },
            'shipping_address': {
                'company_name': consignee.get('company', ''),
                'company': consignee.get('company', ''),
                'contact_person': consignee.get('contact_person', ''),
                'street': consignee.get('address', ''),
                'street_address': consignee.get('address', ''),
                'address': consignee.get('address', ''),
                'city': consignee.get('city', ''),
                'province': consignee.get('state', ''),
                'state': consignee.get('state', ''),
                'postal_code': consignee.get('postal', ''),
                'postal': consignee.get('postal', ''),
                'country': consignee.get('country', 'Canada'),
                'phone': consignee.get('phone', ''),
                'email': consignee.get('email', ''),
                'full_address': consignee_full_address
            },
            'sold_to': {
                'company_name': shipper.get('company', ''),
                'company': shipper.get('company', ''),
                'contact_person': shipper.get('contact_person', ''),
                'address': shipper.get('address', ''),
                'street_address': shipper.get('address', ''),
                'full_address': shipper_full_address,
                'phone': shipper.get('phone', ''),
                'email': shipper.get('email', '')
            },
            'ship_to': {
                'company_name': consignee.get('company', ''),
                'company': consignee.get('company', ''),
                'contact_person': consignee.get('contact_person', ''),
                'address': consignee.get('address', ''),
                'street_address': consignee.get('address', ''),
                'full_address': consignee_full_address,
                'phone': consignee.get('phone', ''),
                'email': consignee.get('email', ''),
                'country': consignee.get('country', 'Canada')
            }
        }
        
        print(f"📋 so_data created with billing_address.company_name={so_data['billing_address']['company_name']}")
        print(f"📋 so_data created with shipping_address.company_name={so_data['shipping_address']['company_name']}")
        
        # Create email_analysis structure from manual input
        pallet_count = int(skids.get('count', 1) or 1)
        total_pieces = sum(int(item.get('quantity', 0) or 0) for item in items)
        
        email_analysis = {
            'total_weight': f"{weights.get('total_weight', '')} {weights.get('weight_unit', 'kg')}",
            'pallet_count': pallet_count,  # Ensure integer
            'pallet_dimensions': skids.get('dimensions', ''),
            'pieces_count': skids.get('pieces') or total_pieces,
            'carrier': carrier,
            'so_number': so_number or '',
            'po_number': po_number or '',
            'special_instructions': special_instructions,
            'skid_info': f"{pallet_count} skid(s)" + (f", {skids.get('dimensions', '')}" if skids.get('dimensions') else ''),
            'destination_country': consignee.get('country', 'Canada'),
            'release_numbers': release_numbers,
            'parsed_items': items,  # Store full item details
            'packaging_type': 'pallet'  # Default to pallet
        }
        
        print(f"📋 Email analysis created: {pallet_count} pallets, {weights.get('total_weight', '?')} {weights.get('weight_unit', 'kg')}, {total_pieces} pieces")
        
        # Create folder structure
        folder_structure = get_document_folder_structure(so_data)
        print(f"\n📁 Document folder structure created: {folder_structure['folder_name']}")
        
        # Now call the existing generate_all_documents logic with our manual data
        # We'll reuse the same generation code but with manual data
        results = {}
        errors = []
        dangerous_goods_info = {'has_dangerous_goods': False}
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Generate BOL
        try:
            from new_bol_generator import populate_new_bol_html
            
            bol_html = populate_new_bol_html(so_data, email_analysis)
            bol_filename = generate_document_filename("BOL", so_data, '.html')
            
            # Save HTML version
            bol_html_filepath = os.path.join(folder_structure['html_folder'], bol_filename)
            with open(bol_html_filepath, 'w', encoding='utf-8') as f:
                f.write(bol_html)
            
            # HTML only - no PDF conversion
            results['bol'] = {
                'success': True,
                'filename': bol_filename,
                'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["html_folder_name"]}/{bol_filename}',
                'file_type': 'html'
            }
            print(f"✅ BOL generated: {bol_filename} (HTML)")
        except Exception as e:
            print(f"❌ BOL generation error: {e}")
            traceback.print_exc()
            errors.append(f"BOL generation failed: {str(e)}")
            results['bol'] = {'success': False, 'error': str(e)}
        
        # Generate Packing Slip
        try:
            from packing_slip_html_generator import generate_packing_slip_html
            
            print(f"\n📋 PACKING SLIP GENERATION - INPUT DATA:")
            print(f"   so_data['billing_address']: {so_data.get('billing_address', {})}")
            print(f"   so_data['shipping_address']: {so_data.get('shipping_address', {})}")
            print(f"   so_data['customer_name']: {so_data.get('customer_name', '')}")
            print(f"   formatted_items count: {len(formatted_items)}")
            for idx, item in enumerate(formatted_items, 1):
                print(f"   Item {idx}: {item}")
            
            ps_html = generate_packing_slip_html(so_data, email_analysis, formatted_items)
            ps_filename = generate_document_filename("PackingSlip", so_data, '.html')
            
            # Save HTML version
            ps_html_filepath = os.path.join(folder_structure['html_folder'], ps_filename)
            with open(ps_html_filepath, 'w', encoding='utf-8') as f:
                f.write(ps_html)
            
            # HTML only - no PDF conversion
            results['packing_slip'] = {
                'success': True,
                'filename': ps_filename,
                'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["html_folder_name"]}/{ps_filename}',
                'file_type': 'html'
            }
            print(f"✅ Packing Slip generated: {ps_filename} (HTML)")
        except Exception as e:
            print(f"❌ Packing Slip generation error: {e}")
            traceback.print_exc()
            errors.append(f"Packing Slip generation failed: {str(e)}")
            results['packing_slip'] = {'success': False, 'error': str(e)}
        
        # Generate Commercial Invoice (always generate, not just cross-border)
        destination_country = consignee.get('country', 'Canada').upper()
        try:
            from commercial_invoice_html_generator import generate_commercial_invoice_html
            
            ci_html = generate_commercial_invoice_html(so_data, formatted_items, email_analysis)
            ci_html_filename = generate_document_filename("CommercialInvoice", so_data, '.html')
            ci_html_filepath = os.path.join(folder_structure['html_folder'], ci_html_filename)
            with open(ci_html_filepath, 'w', encoding='utf-8') as f:
                f.write(ci_html)
            
            # HTML only - no PDF conversion
            results['commercial_invoice'] = {
                'success': True,
                'filename': ci_html_filename,
                'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["html_folder_name"]}/{ci_html_filename}',
                'file_type': 'html'
            }
            print(f"✅ Commercial Invoice generated: {ci_html_filename} (HTML)")
        except Exception as e:
            print(f"❌ Commercial Invoice generation error: {e}")
            traceback.print_exc()
            errors.append(f"Commercial Invoice generation failed: {str(e)}")
            results['commercial_invoice'] = {'success': False, 'error': str(e)}
        
        # Generate TSCA if USA shipment
        if destination_country in ['USA', 'US', 'UNITED STATES']:
            try:
                from tsca_generator import generate_tsca_certification
                tsca_result = generate_tsca_certification(so_data, formatted_items, email_analysis, target_folder=folder_structure['pdf_folder'])
                if tsca_result:
                    tsca_filepath, tsca_filename = tsca_result
                    results['tsca_certification'] = {
                        'success': True,
                        'filename': tsca_filename,
                        'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{tsca_filename}',
                        'note': 'TSCA Certification for US shipments'
                    }
                    print(f"✅ TSCA Certification generated: {tsca_filename}")
            except Exception as e:
                print(f"❌ TSCA generation error: {e}")
                traceback.print_exc()
                errors.append(f"TSCA generation failed: {str(e)}")
                results['tsca_certification'] = {'success': False, 'error': str(e)}
        
        # Check for USMCA
        has_usmca = False
        try:
            from usmca_hts_codes import check_items_for_usmca
            usmca_check = check_items_for_usmca(formatted_items, destination_country, so_data)
            if usmca_check['requires_usmca']:
                import shutil
                current_dir = os.path.dirname(os.path.abspath(__file__))
                # Try 2026 version first, then fallback to generic name
                usmca_2026 = os.path.join(current_dir, 'templates', 'usmca', 'SIGNED USMCA FORM 2026.pdf')
                usmca_generic = os.path.join(current_dir, 'templates', 'usmca', 'SIGNED USMCA FORM.pdf')
                usmca_source = usmca_2026 if os.path.exists(usmca_2026) else usmca_generic
                print(f"   📄 Looking for USMCA form at: {usmca_source}")
                print(f"   📄 File exists: {os.path.exists(usmca_source)}")
                
                if os.path.exists(usmca_source):
                    so_number = 'MANUAL'
                    usmca_filename = f"USMCA_Certificate_{po_number or 'MANUAL'}.pdf"
                    usmca_path = os.path.join(folder_structure['pdf_folder'], usmca_filename)
                    shutil.copy2(usmca_source, usmca_path)
                    print(f"   ✅ Using USMCA form: {os.path.basename(usmca_source)}")
                    results['usmca_certificate'] = {
                        'success': True,
                        'filename': usmca_filename,
                        'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{usmca_filename}',
                        'note': 'Pre-signed USMCA form (ready for printing)'
                    }
                    has_usmca = True
                    print(f"✅ USMCA Certificate included: {usmca_filename}")
        except Exception as e:
            print(f"❌ USMCA generation error: {e}")
            traceback.print_exc()
            errors.append(f"USMCA generation failed: {str(e)}")
            results['usmca_certificate'] = {'success': False, 'error': str(e)}
        
        # Build documents array
        documents = []
        if results.get('bol', {}).get('success'):
            documents.append({
                'document_type': 'Bill of Lading (BOL)',
                'filename': results['bol']['filename'],
                'download_url': results['bol']['download_url']
            })
        if results.get('packing_slip', {}).get('success'):
            documents.append({
                'document_type': 'Packing Slip',
                'filename': results['packing_slip']['filename'],
                'download_url': results['packing_slip']['download_url']
            })
        if results.get('commercial_invoice', {}).get('success'):
            documents.append({
                'document_type': 'Commercial Invoice',
                'filename': results['commercial_invoice']['filename'],
                'download_url': results['commercial_invoice']['download_url']
            })
        if results.get('tsca_certification', {}).get('success'):
            documents.append({
                'document_type': 'TSCA Certification',
                'filename': results['tsca_certification']['filename'],
                'download_url': results['tsca_certification']['download_url']
            })
        if results.get('usmca_certificate', {}).get('success'):
            documents.append({
                'document_type': 'USMCA Certificate',
                'filename': results['usmca_certificate']['filename'],
                'download_url': results['usmca_certificate']['download_url']
            })
        
        # Prepare parsed information for display
        parsed_info = {
            'shipper': {
                'company': shipper.get('company', ''),
                'address': f"{shipper.get('address', '')}, {shipper.get('city', '')}, {shipper.get('state', '')} {shipper.get('postal', '')}".strip(),
                'country': shipper.get('country', 'Canada')
            },
            'consignee': {
                'company': consignee.get('company', ''),
                'address': f"{consignee.get('address', '')}, {consignee.get('city', '')}, {consignee.get('state', '')} {consignee.get('postal', '')}".strip(),
                'country': consignee.get('country', 'Canada')
            },
            'items': items,
            'weights': weights,
            'skids': skids,
            'carrier': carrier,
            'po_number': po_number,
            'release_numbers': release_numbers,
            'special_instructions': special_instructions
        }
        
        response = jsonify({
            'success': len(documents) > 0,
            'documents': documents,
            'documents_generated': len(documents),
            'results': results,
            'errors': errors,
            'folder_name': folder_structure['folder_name'],
            'parsed_info': parsed_info,  # Include parsed info for display
            'summary': f"Generated {len(documents)} documents successfully from manual input"
        })
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        return response
        
    except Exception as e:
        print(f"❌ ERROR: Error in generate_manual_documents: {e}")
        traceback.print_exc()
        error_details = {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'documents': [],
            'documents_generated': 0,
            'errors': [f"Main error: {str(e)}"],
            'summary': f"Manual document generation failed: {str(e)}"
        }
        response = jsonify(error_details)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        return response, 500

@logistics_bp.route('/api/logistics/generate-all-documents', methods=['POST', 'OPTIONS'])
def generate_all_documents():
    """Generate all logistics documents (BOL, Packing Slip, Commercial Invoice) in one call"""
    # Handle OPTIONS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response, 200
    
    print("\n🔥🔥🔥 NEW CODE LOADED - 2025-10-12-22:00 - BUGS FIXED 🔥🔥🔥")
    try:
        print("\n📋 === GENERATING ALL LOGISTICS DOCUMENTS ===")
        data = request.get_json()
        
        if data is None:
            print("❌ ERROR: No JSON data received in request")
            return jsonify({
                'success': False,
                'error': 'No data received. Make sure Content-Type is application/json'
            }), 400
        
        print(f"DEBUG: Received data keys: {data.keys()}")
        
        so_data = data.get('so_data', {})
        email_shipping = data.get('email_shipping', {})
        email_analysis = data.get('email_analysis', {})
        origin_details = data.get('origin_details', {})
        transaction_details = data.get('transaction_details', {})
        items = data.get('items', [])
        shipper_override = data.get('shipper_override') or {}
        try:
            if not shipper_override:
                # Default to Canoil as shipper unless explicitly overridden
                shipper_override = {
                    'company': 'Canoil Canada Ltd.',
                    'street': '62 Todd Road',
                    'city': 'Georgetown',
                    'province': 'ON',
                    'postal': 'L7G 4R7',
                    'country': 'Canada'
                }
                print("INFO: shipper_override not provided - defaulting to Canoil Canada Ltd.")

            if isinstance(shipper_override, dict) and shipper_override:
                so_data['shipper_override'] = shipper_override
                email_analysis['shipper_override'] = shipper_override
                email_shipping['shipper_override'] = shipper_override
        except Exception as override_err:
            print(f"WARNING: Failed to apply shipper_override in generate-all: {override_err}")
        
        # =========================================================================
        # REQUESTED DOCUMENTS - Only generate what the user asked for
        # =========================================================================
        # Get requested documents from email_analysis (set during email processing)
        # or from explicit request parameter
        requested_docs = data.get('requested_documents') or email_analysis.get('requested_documents', {})
        
        # Default to all documents if none specified
        if not requested_docs or not any(requested_docs.values()):
            requested_docs = {
                'bol': True,
                'packing_slip': True,
                'commercial_invoice': True,
                'usmca': True,
                'tsca': True,
                'dangerous_goods': True,
                'all_documents': True
            }
        
        print(f"\n{'='*60}")
        print(f"📄 REQUESTED DOCUMENTS:")
        for doc, requested in requested_docs.items():
            status = "✅ Yes" if requested else "⬜ No"
            print(f"   {doc}: {status}")
        print(f"{'='*60}\n")
        
        # DEBUG: Check if email_analysis has broker-related fields
        print(f"\n{'='*60}")
        print(f"🔍 GENERATE-ALL-DOCUMENTS: email_analysis CHECK")
        print(f"   email_analysis keys: {list(email_analysis.keys())}")
        print(f"   use_near_north: '{email_analysis.get('use_near_north', 'NOT SET')}'")
        print(f"   customs_broker: '{email_analysis.get('customs_broker', 'NOT SET')}'")
        print(f"   customs_broker_phone: '{email_analysis.get('customs_broker_phone', 'NOT SET')}'")
        print(f"   raw_text present: {'raw_text' in email_analysis}")
        print(f"   raw_text length: {len(email_analysis.get('raw_text', ''))}")
        if email_analysis.get('raw_text'):
            print(f"   raw_text preview: {str(email_analysis.get('raw_text', ''))[:200]}...")
        print(f"   is_multi_so: {email_analysis.get('is_multi_so', 'NOT SET')}")
        print(f"   so_data.is_multi_so: {so_data.get('is_multi_so', 'NOT SET')}")
        print(f"{'='*60}\n")
        
        # CRITICAL: Ensure is_multi_so flag is set in so_data if it's in email_analysis
        # This ensures multi-SO mode works in document generators (BOL, CI, etc.)
        if email_analysis.get('is_multi_so') or so_data.get('is_multi_so'):
            so_data['is_multi_so'] = True
            email_analysis['is_multi_so'] = True
            print(f"✅ MULTI-SO MODE DETECTED: Setting is_multi_so=True in both so_data and email_analysis")
            if email_analysis.get('so_numbers'):
                so_data['so_numbers'] = email_analysis['so_numbers']
                print(f"   SO Numbers: {email_analysis['so_numbers']}")
        
        # ENSURE BROKER INFO IS SET - Re-run detection if raw_text available but use_near_north not set
        # This catches cases where frontend didn't pass the flag properly
        email_raw = email_analysis.get('raw_text') or email_analysis.get('email_body') or ''
        if email_raw and not email_analysis.get('use_near_north'):
            print("⚠️ raw_text/email_body present but use_near_north not set - re-running broker detection...")
            try:
                detect_and_apply_broker_info(
                    email_content=email_raw,
                    email_data=email_analysis,
                    so_data=so_data,
                    gpt_email_data=email_analysis
                )
                print(f"   ✅ use_near_north after re-detection: {email_analysis.get('use_near_north')}")
                print(f"   ✅ customs_broker after re-detection: {email_analysis.get('customs_broker')}")
            except Exception as e:
                print(f"   ⚠️ Re-detection failed: {e}")
        
        # FILTER OUT SAMPLE ITEMS - they should NOT appear on BOL/Packing Slip
        # Sample pails only add to steel count on Commercial Invoice
        items = [item for item in items if not item.get('is_sample')]
        print(f"DEBUG: Filtered items (no samples): {len(items)} items")
        
        results = {}
        errors = []
        
        # Dangerous goods info (will be updated by smart generator)
        dangerous_goods_info = {'has_dangerous_goods': False}
        
        # Initialize destination_country and is_cross_border at function scope
        # These are determined during Commercial Invoice check but needed for TSCA and summary
        destination_country = None
        is_cross_border = False

        # Simplified mode: HTML stays HTML, PDF stays PDF (no conversion)
        # TSCA is already a PDF, so it will always be generated when needed
        
        # Create folder structure for this order
        folder_structure = get_document_folder_structure(so_data)
        print(f"\n📁 Document folder structure created: {folder_structure['folder_name']}")
        print(f"   HTML Format: {folder_structure['html_folder']}")
        print(f"   PDF Format: {folder_structure['pdf_folder']}")
        
        # Create timestamp ONCE for all documents
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Generate BOL (NEW professional format) - only if requested
        if requested_docs.get('bol', True):
            try:
                from new_bol_generator import populate_new_bol_html
                
                print(f"DEBUG: Generating BOL for SO {so_data.get('so_number', 'Unknown')}")
                # Use email_analysis instead of email_shipping to ensure skid_info is included
                # email_analysis has skid_info, pallet_count, pallet_dimensions from email parsing
                bol_email_data = email_analysis or email_shipping
                print(f"DEBUG BOL: Using email data with keys: {list(bol_email_data.keys())}")
                print(f"DEBUG BOL: skid_info = {bol_email_data.get('skid_info')}")
                print(f"DEBUG BOL: pallet_count = {bol_email_data.get('pallet_count')}")
                print(f"DEBUG BOL: pallet_dimensions = {bol_email_data.get('pallet_dimensions')}")
                bol_html = populate_new_bol_html(so_data, bol_email_data)
                bol_filename = generate_document_filename("BOL", so_data, '.html')
                
                # Save HTML version in HTML Format folder
                bol_html_filepath = os.path.join(folder_structure['html_folder'], bol_filename)
                with open(bol_html_filepath, 'w', encoding='utf-8') as f:
                    f.write(bol_html)
                print(f"DEBUG: BOL HTML file created: {bol_html_filepath}")
                
                # HTML only - no PDF conversion
                results['bol'] = {
                    'success': True,
                    'filename': bol_filename,
                    'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["html_folder_name"]}/{bol_filename}',
                    'file_type': 'html'
                }
                print(f"✅ BOL generated: {bol_filename} (HTML)")
                
            except Exception as e:
                print(f"❌ BOL generation error: {e}")
                traceback.print_exc()  # Use module-level traceback
                errors.append(f"BOL generation failed: {str(e)}")
                results['bol'] = {'success': False, 'error': str(e)}
        else:
            print("⬜ BOL skipped - not requested")
            results['bol'] = {'success': False, 'skipped': True, 'message': 'Not requested'}
        
        # Generate Packing Slip - only if requested
        if requested_docs.get('packing_slip', True):
            try:
                from packing_slip_html_generator import generate_packing_slip_html
                
                ps_html = generate_packing_slip_html(so_data, email_shipping, items)
                ps_filename = generate_document_filename("PackingSlip", so_data, '.html')
                
                # Save HTML version in HTML Format folder
                ps_html_filepath = os.path.join(folder_structure['html_folder'], ps_filename)
                with open(ps_html_filepath, 'w', encoding='utf-8') as f:
                    f.write(ps_html)
                
                # HTML only - no PDF conversion
                results['packing_slip'] = {
                    'success': True,
                    'filename': ps_filename,
                    'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["html_folder_name"]}/{ps_filename}',
                    'file_type': 'html'
                }
                print(f"✅ Packing Slip generated: {ps_filename} (HTML)")
                
            except Exception as e:
                print(f"❌ Packing Slip generation error: {e}")
                traceback.print_exc()  # Use module-level traceback
                errors.append(f"Packing Slip generation failed: {str(e)}")
                results['packing_slip'] = {'success': False, 'error': str(e)}
        else:
            print("⬜ Packing Slip skipped - not requested")
            results['packing_slip'] = {'success': False, 'skipped': True, 'message': 'Not requested'}
        
        # Determine destination country (needed for Commercial Invoice, TSCA, and summary)
        # This runs ALWAYS regardless of whether Commercial Invoice is requested
        shipping_address = so_data.get('shipping_address', {})
        if shipping_address.get('country'):
            destination_country = str(shipping_address.get('country', '')).upper().strip()
        
        # Check email_shipping for destination (if passed)
        email_shipping_check = data.get('email_shipping', {})
        if not destination_country and email_shipping_check:
            if email_shipping_check.get('destination_country'):
                destination_country = str(email_shipping_check.get('destination_country', '')).upper().strip()
            elif email_shipping_check.get('final_destination'):
                destination_country = str(email_shipping_check.get('final_destination', '')).upper().strip()
        
        # Check email analysis for destination
        if not destination_country and email_analysis:
            if email_analysis.get('destination_country'):
                destination_country = str(email_analysis.get('destination_country', '')).upper().strip()
            elif email_analysis.get('final_destination'):
                destination_country = str(email_analysis.get('final_destination', '')).upper().strip()
        
        # Determine if cross-border
        if destination_country:
            is_cross_border = destination_country not in ['CANADA', 'CA', 'CAN']
        else:
            # Default to cross-border if destination unknown (safer to include)
            is_cross_border = True
            destination_country = 'UNKNOWN'
        
        print(f"\n📋 Destination Check:")
        print(f"   Destination: {destination_country}")
        print(f"   Cross-border: {is_cross_border}")
        
        # Commercial Invoice Generation - only if requested
        if requested_docs.get('commercial_invoice', True):
            try:
                # Only generate Commercial Invoice for cross-border shipments
                if is_cross_border:
                    print(f"📋 Generating Commercial Invoice (cross-border shipment to {destination_country})")
                    from commercial_invoice_html_generator import generate_commercial_invoice_html
                    
                    ci_html = generate_commercial_invoice_html(
                        so_data, 
                        items, 
                        email_analysis
                    )
                    
                    # Save HTML file in HTML Format folder
                    ci_html_filename = generate_document_filename("CommercialInvoice", so_data, '.html')
                    ci_html_filepath = os.path.join(folder_structure['html_folder'], ci_html_filename)
                    with open(ci_html_filepath, 'w', encoding='utf-8') as f:
                        f.write(ci_html)
                    
                    # HTML only - no PDF conversion
                    results['commercial_invoice'] = {
                        'success': True,
                        'filename': ci_html_filename,
                        'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["html_folder_name"]}/{ci_html_filename}',
                        'file_type': 'html',
                        'reason': f'Generated for cross-border shipment to {destination_country}'
                    }
                    
                    print(f"✅ Commercial Invoice generated: {ci_html_filename} (HTML)")
                else:
                    print(f"⏭️  Commercial Invoice skipped (domestic shipment within Canada)")
                    results['commercial_invoice'] = {
                        'success': False,
                        'skipped': True,
                        'reason': 'Domestic shipment - Commercial Invoice not required'
                    }
                
            except Exception as e:
                print(f"❌ Commercial Invoice generation error: {e}")
                traceback.print_exc()  # Use module-level traceback
                errors.append(f"Commercial Invoice generation failed: {str(e)}")
                results['commercial_invoice'] = {'success': False, 'error': str(e)}
        else:
            print("⬜ Commercial Invoice skipped - not requested")
            results['commercial_invoice'] = {'success': False, 'skipped': True, 'message': 'Not requested'}
        
        # SMART Dangerous Goods Declaration Generation - Auto-detect and fill correct template
        try:
            from dangerous_goods_generator import generate_dangerous_goods_declarations
            
            print("\n🔴 Checking for dangerous goods...")
            print(f"DEBUG: Items being checked for DG: {len(items)} items")
            for idx, item in enumerate(items, 1):
                print(f"  Item {idx}: Code='{item.get('item_code')}', Desc='{item.get('description')}'")
            
            dg_result = generate_dangerous_goods_declarations(so_data, items, email_shipping)
            
            if dg_result and dg_result.get('dg_forms'):
                # Move generated files to uploads/logistics folder
                import shutil
                dg_results = []
                sds_results = []
                cofa_results = []
                
                # Process DG Forms - with individual error handling
                for dg_filepath, dg_original_filename in dg_result['dg_forms']:
                    try:
                        print(f"🔍 Processing DG form: {dg_original_filename}")
                        print(f"   Source path: {dg_filepath}")
                        print(f"   Source exists: {os.path.exists(dg_filepath)}")
                        
                        # Create new filename with new format
                        new_dg_filename = generate_document_filename("DangerousGoods", so_data, '.docx')
                        # Save in PDF Format folder (even though it's .docx, it's a document format)
                        new_dg_path = os.path.join(folder_structure['pdf_folder'], new_dg_filename)
                        
                        print(f"   Target path: {new_dg_path}")
                        
                        # Copy file to PDF Format folder
                        shutil.copy2(dg_filepath, new_dg_path)
                        
                        print(f"   Copy successful: {os.path.exists(new_dg_path)}")
                        
                        dg_results.append({
                            'success': True,
                            'filename': new_dg_filename,
                            'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{new_dg_filename}',
                            'product': dg_original_filename  # Contains product name
                        })
                        print(f"✅ Dangerous Goods Declaration generated: {new_dg_filename}")
                    except Exception as dg_err:
                        print(f"❌ Failed to process DG form {dg_original_filename}: {dg_err}")
                        traceback.print_exc()  # Use module-level traceback
                        errors.append(f"DG form {dg_original_filename}: {str(dg_err)}")
                        # Continue to next DG form
                
                # Process SDS files - with individual error handling
                for sds_path, sds_filename, product_name in dg_result.get('sds_files', []):
                    try:
                        # Get file extension from original
                        file_ext = os.path.splitext(sds_filename)[1]
                        
                        # Create consistent filename: SDS_ProductName_Date.ext
                        timestamp_sds = datetime.now().strftime('%Y%m%d')
                        clean_product = product_name.replace(' ', '_').replace('/', '_')
                        new_sds_filename = f"SDS_{clean_product}_{timestamp_sds}{file_ext}"
                        
                        # Copy SDS with new name to PDF Format folder
                        new_sds_path = os.path.join(folder_structure['pdf_folder'], new_sds_filename)
                        shutil.copy2(sds_path, new_sds_path)
                        
                        sds_results.append({
                            'success': True,
                            'filename': new_sds_filename,
                            'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{new_sds_filename}',
                            'product': product_name
                        })
                        print(f"✅ SDS renamed: {new_sds_filename}")
                    except Exception as sds_err:
                        print(f"❌ Failed to process SDS for {product_name}: {sds_err}")
                        errors.append(f"SDS {product_name}: {str(sds_err)}")
                        # Continue to next SDS file
                
                # Process COFA files - with individual error handling
                for cofa_path, cofa_filename, product_name, batch in dg_result.get('cofa_files', []):
                    try:
                        # Get file extension from original
                        file_ext = os.path.splitext(cofa_filename)[1]
                        
                        # Create consistent filename: COFA_ProductName_Batch_Date.ext
                        timestamp_cofa = datetime.now().strftime('%Y%m%d')
                        clean_product = product_name.replace(' ', '_').replace('/', '_')
                        new_cofa_filename = f"COFA_{clean_product}_Batch{batch}_{timestamp_cofa}{file_ext}"
                        
                        # Copy COFA with new name to PDF Format folder
                        new_cofa_path = os.path.join(folder_structure['pdf_folder'], new_cofa_filename)
                        shutil.copy2(cofa_path, new_cofa_path)
                        
                        cofa_results.append({
                            'success': True,
                            'filename': new_cofa_filename,
                            'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{new_cofa_filename}',
                            'product': product_name,
                            'batch': batch
                        })
                        print(f"✅ COFA renamed: {new_cofa_filename} (Batch: {batch})")
                    except Exception as cofa_err:
                        print(f"❌ Failed to process COFA for {product_name} batch {batch}: {cofa_err}")
                        errors.append(f"COFA {product_name} batch {batch}: {str(cofa_err)}")
                        # Continue to next COFA file
                
                results['dangerous_goods'] = dg_results
                results['sds_files'] = sds_results
                results['cofa_files'] = cofa_results
                dangerous_goods_info['has_dangerous_goods'] = True
                dangerous_goods_info['forms_generated'] = len(dg_results)
                dangerous_goods_info['sds_count'] = len(sds_results)
                dangerous_goods_info['cofa_count'] = len(cofa_results)
            else:
                print("✅ No dangerous goods detected in this shipment")
                dangerous_goods_info['has_dangerous_goods'] = False
        except Exception as e:
            print(f"❌ Dangerous Goods generation error: {e}")
            traceback.print_exc()  # Use module-level traceback
            errors.append(f"Dangerous Goods generation failed: {str(e)}")
            results['dangerous_goods'] = {'success': False, 'error': str(e)}
        
        # TSCA CERTIFICATION - Generate ONLY for USA shipments
        # TSCA is already a PDF (no conversion needed), so always generate when required
        try:
            from tsca_generator import generate_tsca_certification

            print("\n📋 Checking if TSCA Certification is needed...")

            # TSCA is ONLY needed for USA shipments (not other cross-border shipments)
            is_usa_shipment = destination_country and destination_country in ['USA', 'US', 'UNITED STATES']

            if is_usa_shipment:
                print(f"   USA shipment to {destination_country} - TSCA required")

                # Generate TSCA and save to PDF Format folder (TSCA is already a PDF)
                tsca_result = generate_tsca_certification(so_data, items, email_analysis, target_folder=folder_structure['pdf_folder'])

                if tsca_result:
                    tsca_filepath, tsca_filename = tsca_result
                    results['tsca_certification'] = {
                        'success': True,
                        'filename': tsca_filename,
                        'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{tsca_filename}',
                        'note': 'TSCA Certification for US shipments'
                    }
                    print(f"   ✅ TSCA Certification generated: {tsca_filename}")
                else:
                    print(f"   ⏭️  TSCA skipped (no products to certify)")
            else:
                print(f"   ⏭️  TSCA Certification skipped (not a USA shipment - destination: {destination_country or 'Unknown'})")
                results['tsca_certification'] = {
                    'success': False,
                    'skipped': True,
                    'reason': f'TSCA not required for non-USA shipments (destination: {destination_country or "Unknown"})'
                }
        except Exception as e:
            print(f"❌ TSCA generation error: {e}")
            traceback.print_exc()  # Use module-level traceback
            errors.append(f"TSCA generation failed: {str(e)}")
            results['tsca_certification'] = {'success': False, 'error': str(e)}
        
        # AEC MANUFACTURER'S AFFIDAVIT - For AEC shipments with steel cans/drums
        # NOTE: AEC Affidavit is just copying a template PDF, so it should always be checked regardless of pdf_generation_enabled
        try:
            print("\n📜 Checking if AEC Manufacturer's Affidavit is needed...")
            
            # Check if any items are AEC products with steel containers
            has_aec_steel = False
            for item in items:
                item_code = str(item.get('item_code', '')).upper()
                description = str(item.get('description', '')).upper()
                unit = str(item.get('unit', '')).upper()
                
                # Check if it's an AEC product
                is_aec_product = 'AEC' in item_code or 'AEC' in description
                
                # Check if it uses steel container (can or drum)
                is_steel_container = any([
                    'DRUM' in unit or 'DRUM' in description,
                    'CAN' in unit or 'CASE' in unit,  # Cases often contain cans
                    'PAIL' in unit or 'PAIL' in description
                ])
                
                if is_aec_product and is_steel_container:
                    has_aec_steel = True
                    print(f"   ✅ Found AEC product with steel container: {item.get('description', item_code)}")
                    break
            
            if has_aec_steel:
                # Source AEC affidavit template
                current_dir = os.path.dirname(os.path.abspath(__file__))
                aec_source = os.path.join(current_dir, 'templates', 'AEC Manufacturer\'s Affidavit', 'AEX_MANUFACTURING AFFIDAVIT.pdf')
                
                if os.path.exists(aec_source):
                    import shutil
                    so_number = so_data.get('so_number', 'Unknown')
                    aec_filename = f"AEC_Manufacturers_Affidavit_SO{so_number}.pdf"
                    aec_path = os.path.join(folder_structure['pdf_folder'], aec_filename)
                    
                    shutil.copy2(aec_source, aec_path)
                    
                    results['aec_affidavit'] = {
                        'success': True,
                        'filename': aec_filename,
                        'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{aec_filename}',
                        'note': 'AEC Manufacturer\'s Affidavit for steel containers'
                    }
                    print(f"   ✅ AEC Affidavit included: {aec_filename}")
                else:
                    print(f"   ⚠️ AEC Affidavit template not found at: {aec_source}")
                    results['aec_affidavit'] = {
                        'success': False,
                        'error': 'Template not found'
                    }
            else:
                print(f"   ⏭️ AEC Affidavit not needed (no AEC products with steel containers)")
                results['aec_affidavit'] = {
                    'success': False,
                    'skipped': True,
                    'reason': 'No AEC products with steel containers in this shipment'
                }
                
        except Exception as e:
                print(f"❌ AEC Affidavit error: {e}")
                traceback.print_exc()
                errors.append(f"AEC Affidavit generation failed: {str(e)}")
                results['aec_affidavit'] = {'success': False, 'error': str(e)}
        
        # SMART USMCA CERTIFICATE - Check Destination + HTS + COO
        # NOTE: USMCA is just copying a template PDF, so it should always be checked regardless of pdf_generation_enabled
        has_usmca = False
        try:
            from usmca_hts_codes import check_items_for_usmca

            print("\n📜 SMART USMCA Check - Validating Destination + HTS + COO...")

            # Get destination country
            destination = (so_data.get('ship_to', {}).get('country', '') or 
                         so_data.get('shipping_address', {}).get('country', '') or
                         'Unknown')

            print(f"   Destination: {destination}")

            # 3-part check: Destination (USA/MX) + HTS (approved) + COO (CA/US/MX)
            usmca_check = check_items_for_usmca(items, destination, so_data)

            print(f"   Items checked: {usmca_check['total_items_checked']}")
            print(f"   Items matching USMCA: {len(usmca_check['matching_items'])}")

            # Show matching items (all 3 checks pass)
            if usmca_check['matching_items']:
                print("\n   ✅ Items qualifying for USMCA:")
                for item in usmca_check['matching_items']:
                    print(f"      - {item['item_code']}: HTS {item['hts_code']} | COO: {item.get('country_of_origin', 'N/A')}")

            # Show blocked items (HTS approved but COO blocks it)
            if usmca_check.get('blocked_items'):
                print("\n   🚫 Items BLOCKED from USMCA:")
                for item in usmca_check['blocked_items']:
                    print(f"      - {item['item_code']}: HTS {item['hts_code']} | COO: {item.get('country_of_origin', 'N/A')} ({item.get('reason', 'blocked')})")

            # Show non-matching items (HTS not on approved list)
            if usmca_check['non_matching_items']:
                print("\n   ⚠️ Items with HTS codes NOT on USMCA certificate:")
                for item in usmca_check['non_matching_items']:
                    print(f"      - {item['item_code']}: HTS {item['hts_code']} (not approved)")

            # Include USMCA only if we have matching items
            if usmca_check['requires_usmca']:
                print(f"\n   ✅ USMCA Certificate REQUIRED: {usmca_check['reason']}")

                # Source USMCA form (2026 version - already signed)
                # Use relative path that works in Docker
                current_dir = os.path.dirname(os.path.abspath(__file__))
                # Try 2026 version first, then fallback to generic name
                usmca_2026 = os.path.join(current_dir, 'templates', 'usmca', 'SIGNED USMCA FORM 2026.pdf')
                usmca_generic = os.path.join(current_dir, 'templates', 'usmca', 'SIGNED USMCA FORM.pdf')
                usmca_source = usmca_2026 if os.path.exists(usmca_2026) else usmca_generic

                print(f"   📄 Looking for USMCA form at: {usmca_source}")
                print(f"   📄 File exists: {os.path.exists(usmca_source)}")
                
                if os.path.exists(usmca_source):
                    # Copy to PDF Format folder - USMCA is a blank template, use simple name
                    import shutil
                    so_number = so_data.get('so_number', 'Unknown')
                    usmca_filename = f"USMCA_Certificate_SO{so_number}.pdf"
                    usmca_path = os.path.join(folder_structure['pdf_folder'], usmca_filename)

                    shutil.copy2(usmca_source, usmca_path)
                    print(f"   ✅ Using USMCA form: {os.path.basename(usmca_source)}")

                    results['usmca_certificate'] = {
                        'success': True,
                        'filename': usmca_filename,
                        'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{usmca_filename}',
                        'note': 'Pre-signed USMCA form (ready for printing)',
                        'matching_items': len(usmca_check['matching_items']),
                        'items_list': [f"{item['item_code']} (HTS {item['hts_code']})" 
                                      for item in usmca_check['matching_items']]
                    }
                    has_usmca = True
                    print(f"   ✅ USMCA Certificate included: {usmca_filename}")
                else:
                    print(f"   ❌ USMCA form not found at {usmca_source}")
                    errors.append(f"USMCA form not found")
                    results['usmca_certificate'] = {'success': False, 'error': 'Source file not found'}
            else:
                print(f"\n   ⏭️  USMCA Certificate SKIPPED: {usmca_check['reason']}")
                has_usmca = False
                results['usmca_certificate'] = {
                    'success': False,
                    'skipped': True,
                    'reason': usmca_check['reason']
                }
        except Exception as e:
            print(f"❌ USMCA generation error: {e}")
            traceback.print_exc()  # Use module-level traceback
            errors.append(f"USMCA generation failed: {str(e)}")
            results['usmca_certificate'] = {'success': False, 'error': str(e)}
        
        # DELIVERY NOTE - Generate ONLY for Axel France orders
        try:
            from delivery_note_generator import generate_delivery_note, is_axel_france_order
            
            print("\n📦 Checking if Delivery Note is needed (Axel France)...")

            if is_axel_france_order(so_data):
                # Get booking number from request data (user enters via popup)
                booking_number = data.get('booking_number', '') or data.get('bookingNumber', '')
                
                # DELIVERY NOTE - Generate (already a PDF, no conversion needed)
                print(f"   Axel France order detected - generating delivery note")
                print(f"   Booking#: {booking_number or '(not provided)'}")
                
                dn_result = generate_delivery_note(so_data, items, booking_number)
                
                if dn_result.get('success'):
                    # Move to PDF Format folder with consistent naming
                    import shutil
                    dn_original_path = dn_result['filepath']
                    dn_filename = generate_document_filename("DeliveryNote", so_data, '.docx')
                    dn_new_path = os.path.join(folder_structure['pdf_folder'], dn_filename)
                    
                    shutil.copy2(dn_original_path, dn_new_path)
                    
                    results['delivery_note'] = {
                        'success': True,
                        'filename': dn_filename,
                        'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{dn_filename}',
                        'note': 'Delivery Note for Axel France' + (' - BOOKING# EMPTY - PLEASE FILL BY HAND' if not booking_number else '')
                    }
                    print(f"   ✅ Delivery Note generated: {dn_filename}")
                else:
                    print(f"   ❌ Delivery Note generation failed: {dn_result.get('error')}")
                    errors.append(f"Delivery Note: {dn_result.get('error')}")
                    results['delivery_note'] = {'success': False, 'error': dn_result.get('error')}
                
                # REACH CONFORMITY (DRC) - Include for Axel France MOV/Long Life products
                # NOTE: REACH is just copying a template, so it should always be checked regardless of pdf_generation_enabled
                try:
                    # Check if any items contain MOV or Long Life
                    has_mov_longlife = False
                    for item in items:
                        item_code = str(item.get('item_code', '')).upper()
                        description = str(item.get('description', '')).upper()
                        if 'MOV' in item_code or 'MOV' in description or 'LONG LIFE' in description or 'LONGLIFE' in description:
                            has_mov_longlife = True
                            print(f"   📋 MOV/Long Life product detected: {item.get('item_code')} - {item.get('description')}")
                            break
                    
                    if has_mov_longlife:
                        # Copy REACH Conformity document
                        current_dir = os.path.dirname(os.path.abspath(__file__))
                        drc_source = os.path.join(current_dir, 'templates', 'declaration_of_reach_conformity_drc_axel_france', '2025 DRC for MOV Long Life.docx')
                        
                        if os.path.exists(drc_source):
                            so_number = so_data.get('so_number', 'Unknown')
                            drc_filename = f"REACH_Conformity_SO{so_number}.docx"
                            drc_path = os.path.join(folder_structure['pdf_folder'], drc_filename)
                            
                            shutil.copy2(drc_source, drc_path)
                            
                            results['reach_conformity'] = {
                                'success': True,
                                'filename': drc_filename,
                                'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{drc_filename}',
                                'note': 'Declaration of REACH Conformity for MOV Long Life (for printing)'
                            }
                            print(f"   ✅ REACH Conformity included: {drc_filename}")
                        else:
                            print(f"   ⚠️  REACH Conformity file not found: {drc_source}")
                    else:
                        print(f"   ⏭️  REACH Conformity skipped (no MOV/Long Life products)")
                        
                except Exception as drc_err:
                    print(f"   ⚠️  REACH Conformity error: {drc_err}")
                    # Don't fail the whole process for this
                    
            else:
                print(f"   ⏭️  Delivery Note skipped (not an Axel France order)")
                results['delivery_note'] = {
                    'success': False,
                    'skipped': True,
                    'reason': 'Not an Axel France order'
                }
                
        except Exception as e:
            print(f"❌ Delivery Note generation error: {e}")
            traceback.print_exc()
            errors.append(f"Delivery Note generation failed: {str(e)}")
            results['delivery_note'] = {'success': False, 'error': str(e)}
        
        # SALES ORDER PDF - Always include the original SO PDF with the documents
        try:
            print("\n📄 Including Sales Order PDF...")
            import shutil
            
            # Get SO PDF path from so_data (set during email processing)
            so_pdf_path = so_data.get('file_path') or so_data.get('so_pdf_path') or data.get('so_pdf_file')
            so_number = so_data.get('so_number', 'Unknown')
            
            # Also check cache folder for downloaded SO PDFs
            if not so_pdf_path or not os.path.exists(so_pdf_path):
                cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'so_pdfs')
                possible_names = [
                    f"salesorder_{so_number}.pdf",
                    f"SalesOrder_{so_number}.pdf", 
                    f"Sales_Order_{so_number}.pdf",
                    f"SO_{so_number}.pdf"
                ]
                for name in possible_names:
                    test_path = os.path.join(cache_dir, name)
                    if os.path.exists(test_path):
                        so_pdf_path = test_path
                        print(f"   Found SO PDF in cache: {name}")
                        break
            
            if so_pdf_path and os.path.exists(so_pdf_path):
                # Copy SO PDF to the PDF Format folder
                so_pdf_filename = f"SalesOrder_{so_number}.pdf"
                so_pdf_dest = os.path.join(folder_structure['pdf_folder'], so_pdf_filename)
                
                shutil.copy2(so_pdf_path, so_pdf_dest)
                
                results['sales_order_pdf'] = {
                    'success': True,
                    'filename': so_pdf_filename,
                    'download_url': f'/download/logistics/{folder_structure["folder_name"]}/{folder_structure["pdf_folder_name"]}/{so_pdf_filename}',
                    'note': 'Original Sales Order document'
                }
                print(f"   ✅ Sales Order PDF included: {so_pdf_filename}")
            else:
                print(f"   ⚠️ Sales Order PDF not found (path: {so_pdf_path})")
                results['sales_order_pdf'] = {
                    'success': False,
                    'skipped': True,
                    'reason': 'SO PDF file not found'
                }
        except Exception as e:
            print(f"❌ Sales Order PDF copy error: {e}")
            results['sales_order_pdf'] = {'success': False, 'error': str(e)}
        
        # Summary - handle both dict results and list results (for dangerous_goods)
        successful_docs = []
        for doc, result in results.items():
            if isinstance(result, list):
                # Dangerous goods returns a list of results
                successful_docs.extend([doc for r in result if r.get('success')])
            elif isinstance(result, dict) and result.get('success'):
                successful_docs.append(doc)
        
        has_dg = dangerous_goods_info.get('has_dangerous_goods', False)
        
        # Calculate total possible documents
        base_docs = 2  # BOL, Packing Slip (always)
        total_possible_docs = base_docs
        if is_cross_border:
            total_possible_docs += 1  # Commercial Invoice (cross-border only)
        if has_dg:
            total_possible_docs += 1
        if has_usmca:
            total_possible_docs += 1
        if is_cross_border:
            total_possible_docs += 1  # TSCA (cross-border only)
        
        # Build summary message
        summary_parts = [f"Generated {len(successful_docs)}/{total_possible_docs} documents successfully"]
        if has_dg:
            summary_parts.append("includes dangerous goods declaration")
        if has_usmca:
            summary_parts.append("includes USMCA certificate")
        
        summary_message = summary_parts[0]
        if len(summary_parts) > 1:
            summary_message += f" ({', '.join(summary_parts[1:])})"
        
        # Build documents array for frontend
        documents = []
        
        # Add BOL
        if results.get('bol', {}).get('success'):
            documents.append({
                'document_type': 'Bill of Lading (BOL)',
                'filename': results['bol']['filename'],
                'download_url': results['bol']['download_url']
            })
        
        # Add Packing Slip
        if results.get('packing_slip', {}).get('success'):
            documents.append({
                'document_type': 'Packing Slip',
                'filename': results['packing_slip']['filename'],
                'download_url': results['packing_slip']['download_url']
            })
        
        # Add Commercial Invoice
        if results.get('commercial_invoice', {}).get('success'):
            documents.append({
                'document_type': 'Commercial Invoice',
                'filename': results['commercial_invoice']['filename'],
                'download_url': results['commercial_invoice']['download_url']
            })
            print(f"✅ Added Commercial Invoice to documents array: {results['commercial_invoice']['filename']}")
        else:
            ci_result = results.get('commercial_invoice', {})
            if ci_result.get('skipped'):
                print(f"⏭️  Commercial Invoice skipped: {ci_result.get('reason', 'Domestic shipment')}")
            elif ci_result.get('error'):
                print(f"❌ Commercial Invoice generation failed: {ci_result.get('error')}")
            else:
                print(f"⚠️  Commercial Invoice not generated (no result found)")
        
        # Add Dangerous Goods (list of docs)
        if isinstance(results.get('dangerous_goods'), list):
            for dg_doc in results['dangerous_goods']:
                if dg_doc.get('success'):
                    documents.append({
                        'document_type': f"Dangerous Goods - {dg_doc.get('product', 'Unknown')}",
                        'filename': dg_doc['filename'],
                        'download_url': dg_doc['download_url']
                    })
        
        # Add SDS files
        if isinstance(results.get('sds_files'), list):
            for sds_doc in results['sds_files']:
                if sds_doc.get('success'):
                    documents.append({
                        'document_type': f"SDS - {sds_doc.get('product', 'Unknown')}",
                        'filename': sds_doc['filename'],
                        'download_url': sds_doc['download_url']
                    })
        
        # Add COFA files
        if isinstance(results.get('cofa_files'), list):
            for cofa_doc in results['cofa_files']:
                if cofa_doc.get('success'):
                    documents.append({
                        'document_type': f"Certificate of Analysis - {cofa_doc.get('product', 'Unknown')} (Batch: {cofa_doc.get('batch', 'N/A')})",
                        'filename': cofa_doc['filename'],
                        'download_url': cofa_doc['download_url']
                    })
        
        # Add TSCA
        if results.get('tsca_certification', {}).get('success'):
            documents.append({
                'document_type': 'TSCA Certification',
                'filename': results['tsca_certification']['filename'],
                'download_url': results['tsca_certification']['download_url']
            })
        
        # Add USMCA
        if results.get('usmca_certificate', {}).get('success'):
            documents.append({
                'document_type': 'USMCA Certificate',
                'filename': results['usmca_certificate']['filename'],
                'download_url': results['usmca_certificate']['download_url']
            })
        
        # Add Sales Order PDF
        if results.get('sales_order_pdf', {}).get('success'):
            documents.append({
                'document_type': 'Sales Order',
                'filename': results['sales_order_pdf']['filename'],
                'download_url': results['sales_order_pdf']['download_url']
            })
        
        # Add Delivery Note (Axel France)
        if results.get('delivery_note', {}).get('success'):
            documents.append({
                'document_type': 'Delivery Note (Axel France)',
                'filename': results['delivery_note']['filename'],
                'download_url': results['delivery_note']['download_url'],
                'note': results['delivery_note'].get('note', '')
            })
        
        # Add REACH Conformity (Axel France MOV/Long Life)
        if results.get('reach_conformity', {}).get('success'):
            documents.append({
                'document_type': 'REACH Conformity (MOV Long Life)',
                'filename': results['reach_conformity']['filename'],
                'download_url': results['reach_conformity']['download_url'],
                'note': results['reach_conformity'].get('note', '')
            })
        
        # Add AEC Manufacturer's Affidavit (for steel containers)
        if results.get('aec_affidavit', {}).get('success'):
            documents.append({
                'document_type': "AEC Manufacturer's Affidavit",
                'filename': results['aec_affidavit']['filename'],
                'download_url': results['aec_affidavit']['download_url'],
                'note': results['aec_affidavit'].get('note', '')
            })
            print(f"✅ Added AEC Manufacturer's Affidavit to documents array")
        
        # Add CORS headers to response
        # ZIP download URL uses company name only - downloads entire company folder with Year/Month/Order hierarchy
        response = jsonify({
            'success': len(documents) > 0,
            'documents': documents,
            'documents_generated': len(documents),
            'total_documents': total_possible_docs,
            'results': results,
            'errors': errors,
            'dangerous_goods_detected': has_dg,
            'dangerous_goods_info': dangerous_goods_info,
            'usmca_required': has_usmca,
            'summary': summary_message,
            'folder_name': folder_structure['folder_name'],
            'company_name': folder_structure['company_name'],
            'order_folder': folder_structure['order_folder_name'],
            'year': folder_structure['year'],
            'month': folder_structure['month'],
            # ZIP URL is just company name - creates hierarchical ZIP with Year/Month/Order structure
            'zip_download_url': f'/download/logistics/{folder_structure["company_name"]}.zip',
            # Also provide order-specific ZIP URL if user wants just this order
            'order_zip_download_url': f'/download/logistics/{folder_structure["folder_name"]}.zip'
        })
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        return response
        
    except Exception as e:
        print(f"❌ ERROR: Error in generate_all_documents: {e}")
        print(f"ERROR TYPE: {type(e).__name__}")
        print(f"ERROR DETAILS: {str(e)}")
        traceback.print_exc()  # Use module-level traceback (imported at top of file)
        
        # Return more specific error information
        error_details = {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'documents': [],
            'documents_generated': 0,
            'total_documents': 0,
            'errors': [f"Main error: {str(e)}"],
            'dangerous_goods_detected': False,
            'dangerous_goods_info': {'has_dangerous_goods': False},
            'usmca_required': False,
            'summary': f"Document generation failed: {str(e)}"
        }
        
        # Add CORS headers to error response
        response = jsonify(error_details)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        return response, 500

# Removed complex dangerous goods API endpoints - keeping it simple
