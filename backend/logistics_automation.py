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
    
    # Get date - prefer order_date, then ship_date, then current date
    date_str = ''
    if so_data.get('order_date'):
        try:
            # Try to parse and format date
            order_date = so_data.get('order_date')
            if isinstance(order_date, str):
                # Try common date formats
                for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%B %d, %Y']:
                    try:
                        parsed = datetime.strptime(order_date, fmt)
                        date_str = parsed.strftime('%Y-%m-%d')
                        break
                    except:
                        continue
                if not date_str:
                    date_str = order_date[:10] if len(order_date) >= 10 else order_date
            else:
                date_str = str(order_date)[:10]
        except:
            date_str = datetime.now().strftime('%Y-%m-%d')
    elif so_data.get('ship_date'):
        try:
            ship_date = so_data.get('ship_date')
            if isinstance(ship_date, str):
                for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%B %d, %Y']:
                    try:
                        parsed = datetime.strptime(ship_date, fmt)
                        date_str = parsed.strftime('%Y-%m-%d')
                        break
                    except:
                        continue
                if not date_str:
                    date_str = ship_date[:10] if len(ship_date) >= 10 else ship_date
            else:
                date_str = str(ship_date)[:10]
        except:
            date_str = datetime.now().strftime('%Y-%m-%d')
    else:
        date_str = datetime.now().strftime('%Y-%m-%d')
    
    # Build filename: "DOC_TYPE SO# | PO# | Date.ext"
    if po_number:
        filename = f"{doc_type} SO{so_number} | PO{po_number} | {date_str}{file_ext}"
    else:
        filename = f"{doc_type} SO{so_number} | {date_str}{file_ext}"
    
    # Clean filename (remove invalid characters for file system)
    filename = filename.replace('/', '-').replace('\\', '-').replace(':', '-')
    
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

# Create blueprint
try:
    logistics_bp = Blueprint('logistics', __name__, url_prefix='')
    print("✅ Logistics blueprint created successfully")
except Exception as e:
    print(f"❌ ERROR: Failed to create logistics blueprint: {e}")
    import traceback
    traceback.print_exc()
    raise

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
            model="gpt-4o-mini",
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
    batch_pattern = r'batch\s*(?:number|#)?\s*:?\s*([A-Z0-9]+(?:\s*\([0-9]+\))?\s*(?:\+\s*[A-Z0-9]+(?:\s*\([0-9]+\))?)*)'
    for ln in lines:
        batch_match = re.search(batch_pattern, ln, re.IGNORECASE)
        if batch_match:
            # Keep FULL batch string with quantities: "NT5D14T016 (5) + NT5E19T018 (3)"
            batch_full_string = batch_match.group(1).strip()
            # Extract ONLY actual batch codes (letters + numbers, min 5 chars), NOT quantity numbers
            # Match pattern: letters/numbers together, at least 5 characters
            batch_codes = re.findall(r'\b([A-Z0-9]{5,})\b', batch_full_string)
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
        weight_patterns = [
            r'Total\s+(?:Net\s+)?Weight\s*:?\s*(\d+(?:\.\d+)?)\s*(kg|lbs?|pounds?)',
            r'Weight\s*:?\s*(\d+(?:\.\d+)?)\s*(kg|lbs?|pounds?)',
            r'(\d+(?:\.\d+)?)\s*(kg|lbs?|pounds?)\s+total'
        ]
        for pattern in weight_patterns:
            weight_match = re.search(pattern, text, re.IGNORECASE)
            if weight_match:
                data['total_weight'] = f"{weight_match.group(1)} {weight_match.group(2).lower()}"
                print(f"DEBUG: Found weight using old pattern: {data['total_weight']}")
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
            "total_weight": "[CRITICAL] TOTAL weight for ALL items combined. If email has 'Line 1: 1,200 kg, Line 2: 1,020 kg, Line 3: 1,760 kg', you MUST add them: 1200+1020+1760=3980 kg. Always sum all line weights.",
            "pallet_count": "[CRITICAL] TOTAL number of pallets/skids/cases as integer. Look for phrases like 'on X pallets', 'X skids', 'In X case', 'On 2 pallets... On 2 pallets... On 4 pallets' (add them: 2+2+4=8). Search entire email for skid/pallet/case counts. If multiple mentioned, ADD THEM ALL. Required field - must extract if ANY pallet/skid/case mention exists.",
            "pallet_dimensions": "[CRITICAL] Pallet/skid/case dimensions. Look for: '48x40', '45×45×40', '48 x 40 x 48', 'pallet dimensions: 48x40x48', 'skid size 48x40', 'In 1 case 27×22×20 inches', etc. Include units if mentioned (inches/cm). Search entire email. Required field - must extract if ANY dimension mention exists.",
            "packaging_type": "[CRITICAL] Type of packaging: 'case', 'pallet', or 'skid'. Look for phrases like 'In 1 case 27×22×20 inches' → 'case', 'on 2 pallets 48x40' → 'pallet', 'on 3 skids' → 'skid'. If email says 'case' use 'case', if 'pallet' or 'skid' use 'pallet'. Default to 'pallet' if not specified. Required field.",
            "special_instructions": "any special handling notes",
            "ship_date": "ship date if mentioned",
            "carrier": "carrier/shipping company",
            "truck_info": "truck details if any",
            "broker_carrier_ref": "broker or carrier reference number if mentioned",
            "terms_of_sale": "payment terms if mentioned (e.g. Net 30, Net 60)",
            "final_destination": "final destination country if different from shipping address"
        }}
        
        CRITICAL EXAMPLES FOR LINE NUMBERS (MUST EXTRACT CORRECTLY):
        
        PARTIAL SHIPMENT (line number RIGHT AFTER SO number):
        - "Canoil sales order 2707 line 2, attached" → so_number="2707", so_line_numbers=[2], is_partial_shipment=true
        - "SO 5000 line 3" → so_number="5000", so_line_numbers=[3], is_partial_shipment=true
        
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
        
        IGNORE these as products: weight numbers, dimensions, pallet sizes, gross weights
        
        Return ONLY the JSON, no explanations.
        """
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
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
        
        # CRITICAL: Ensure line number fields exist and are CORRECTLY extracted
        if 'so_line_numbers' not in parsed_data or parsed_data.get('so_line_numbers') is None:
            print(f"⚠️ WARNING: GPT did not extract so_line_numbers field!")
            # Manual extraction as fallback - ONLY match line numbers RIGHT AFTER SO number
            import re
            line_match = re.search(r'(?:Canoil\s+sales\s+order|sales\s+order|SO)\s*(?:[#No.:]*\s*)?(\d+)\s+line\s+(?:item\s+)?(\d+)', email_text, re.IGNORECASE)
            if line_match:
                parsed_data['so_line_numbers'] = [int(line_match.group(2))]
                parsed_data['is_partial_shipment'] = True
                print(f"✅ MANUAL EXTRACTION: SO {line_match.group(1)} line {line_match.group(2)}")
            else:
                parsed_data['so_line_numbers'] = None
                parsed_data['is_partial_shipment'] = False
                print(f"✅ MANUAL EXTRACTION: No line number after SO - FULL SHIPMENT")
        
        if 'is_partial_shipment' not in parsed_data:
            parsed_data['is_partial_shipment'] = bool(parsed_data.get('so_line_numbers'))
        
        print(f"\n🔍 LINE NUMBER CHECK:")
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
                batch_codes = re.findall(r'\b([A-Z0-9]{5,})\b', str(batch_str))
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
                    batch_match = re.search(r'batch\s*number\s*([A-Za-z0-9]+)', next_line, re.IGNORECASE)
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
        data['batch_numbers'] = ', '.join(all_batch_numbers)
        data['batch_number'] = all_batch_numbers[0]  # For backward compatibility  # For backward compatibility
    
    # Extract weight with enhanced patterns
    weight_patterns = [
        r'(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)',
        r'total\s*weight:?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)',
        r'weight:?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)',
        r'(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?)\s*total'
    ]
    
    for pattern in weight_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            data['total_weight'] = f"{match.group(1)} {match.group(2)}"
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
        r'carrier:?\s*([A-Za-z\s&,.-]+?)(?:\n|$)',
        r'shipping\s*company:?\s*([A-Za-z\s&,.-]+?)(?:\n|$)',
        r'transport:?\s*([A-Za-z\s&,.-]+?)(?:\n|$)'
    ]
    
    for pattern in carrier_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            data['carrier'] = match.group(1).strip()
            print(f"SUCCESS: Fallback found carrier: {data['carrier']}")
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
        google_drive_service = None
        try:
            from app import USE_GOOGLE_DRIVE_API, get_google_drive_service
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
                                for download_attempt in range(3):
                                    try:
                                        print(f"[INFO] LOGISTICS: Downloading SO file (attempt {download_attempt + 1}/3)...")
                                        so_file_content = google_drive_service.download_file_content(file_id)
                                        if so_file_content:
                                            print(f"[OK] LOGISTICS: Download successful ({len(so_file_content)} bytes)")
                                            break
                                    except Exception as download_err:
                                        print(f"[WARN] LOGISTICS: Download attempt {download_attempt + 1} failed: {download_err}")
                                        if download_attempt < 2:
                                            import time
                                            time.sleep(1 * (download_attempt + 1))  # Exponential backoff
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
        
        # Fallback to local filesystem search (only if G: drive is accessible)
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
        
        # Parse SO PDF directly using app parser (pdfplumber internally)
        try:
            print(f"LOGISTICS: Parsing SO PDF with application parser (pdfplumber)")
            # Import parse_sales_order_pdf with error handling
            try:
                from app import parse_sales_order_pdf
            except ImportError as import_err:
                print(f"ERROR: Could not import parse_sales_order_pdf: {import_err}")
                import sys
                if 'app' in sys.modules:
                    app_module = sys.modules['app']
                    parse_sales_order_pdf = getattr(app_module, 'parse_sales_order_pdf', None)
                    if not parse_sales_order_pdf:
                        return {"status": "Error", "error": f"parse_sales_order_pdf function not available: {import_err}"}
                else:
                    return {"status": "Error", "error": f"Could not import parse_sales_order_pdf: {import_err}"}
            
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

@logistics_bp.route('/api/logistics/process-email', methods=['POST'])
def process_email():
    """Process email content with GPT-4o and extract SO data - REAL DATA ONLY"""
    import traceback
    import sys
    
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
        
        if not email_content:
            print("ERROR: LOGISTICS: No email content provided")
            return jsonify({'error': 'No email content provided'}), 400
        
        print(f"EMAIL: LOGISTICS: Email content length: {len(email_content)} characters")
        
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
            primary_company = email_data.get('company_name', '').upper().strip()
        
        so_customer = so_data.get('customer_name', '').upper().strip()
        
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
                        
                        # Exact match check
                        exact_match_1 = item_desc in so_desc
                        exact_match_2 = so_desc in item_desc
                        print(f"      Check 1 (email in SO): {exact_match_1}")
                        print(f"      Check 2 (SO in email): {exact_match_2}")
                        
                        if exact_match_1 or exact_match_2:
                            # Check if this is a TOTE order - totes are treated as single units regardless of volume
                            is_tote_order = False
                            email_text_lower = str(email_data).lower()
                            so_unit = (so_item.get('unit') or '').upper()
                            
                            # Detect tote orders: email mentions "tote" OR SO unit is TOTE/LITER with qty 1
                            if 'tote' in email_text_lower or (so_unit in ['TOTE', 'LITER', 'IBC'] and so_item.get('quantity', 0) == 1):
                                is_tote_order = True
                                print(f"      📦 TOTE ORDER DETECTED - matching on description only")
                            
                            # For tote orders, match on description only (skip qty check)
                            if is_tote_order:
                                matched = True
                                matched_so_item = so_item
                                match_details = f"TOTE order matched by description: {so_desc}"
                                print(f"   ✅ TOTE MATCH: '{item_desc}' = '{so_desc}'")
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
                        
                        # MOV Extra matching - handle "MOV Extra 0" vs "MOVEXT0DRM" or "MOV Extra 0 - Drums"
                        # CRITICAL: Check this BEFORE smart matching to avoid matching "MOV Extra 1" with "MOV Extra 0"
                        if 'MOV' in item_desc and 'MOV' in so_desc:
                            # Extract numbers from both
                            import re
                            email_nums = re.findall(r'\d+', item_desc)
                            so_nums = re.findall(r'\d+', so_desc)
                            # If both have MOV and share a number, it's a match
                            if email_nums and so_nums and any(e_num in so_desc for e_num in email_nums):
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
                            if email_qty_num > so_qty_num + 0.01:
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
                quantity_mismatches = [iv for iv in items_validation if iv.get('matched') and not iv.get('quantity_match', True)]
                
                if unmatched_items or quantity_mismatches:
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
        
        # Match email items with SO items to add specific batch numbers
        if email_data.get('items') and so_data.get('items'):
            print(f"RETRY: Matching {len(email_data.get('items', []))} email items with {len(so_data.get('items', []))} SO items...")
            
            # Debug: Show what we're trying to match
            print("DEBUG: Email items:")
            for item in email_data.get('items', []):
                print(f"  - '{item.get('description', '')}' (batch: {item.get('batch_number', 'None')})")
            
            print("DEBUG: SO items:")
            for item in so_data.get('items', []):
                print(f"  - '{item.get('description', '')}' (code: {item.get('item_code', 'None')})")
            
            # Create a comprehensive mapping of email items
            email_items_by_desc = {}
            email_items_by_code = {}
            
            for email_item in email_data.get('items', []):
                desc = (email_item.get('description') or '').upper().strip()
                batch = (email_item.get('batch_number') or '').strip()
                
                if desc and batch:
                    # Store full item info for better matching
                    item_info = {
                        'batch_number': batch,
                        'quantity': email_item.get('quantity', ''),
                        'unit': email_item.get('unit', ''),
                        'original_desc': email_item.get('description', '')
                    }
                    
                    # Map by full description
                    email_items_by_desc[desc] = item_info
                    
                    # Also map by potential item codes within description
                    # e.g., "CASTROL ILOFORM PS 158" might match SO item code "PS158"
                    words = desc.split()
                    for word in words:
                        if len(word) > 2:  # Skip short words
                            email_items_by_code[word] = item_info
                    
                    # Also map by core product name for better matching
                    core_name = extract_core_product_name(desc)
                    if core_name and core_name != desc:
                        email_items_by_desc[core_name] = item_info
            
            # Update SO items with matching batch numbers
            unmatched_items = []
            
            for so_item in so_data['items']:
                matched = False
                so_desc = so_item.get('description', '').upper().strip()
                so_code = so_item.get('item_code', '').upper().strip()
                so_raw_line = so_item.get('raw_line', '').upper().strip()
                
                # Method 1: Exact description match
                if so_desc in email_items_by_desc:
                    match_info = email_items_by_desc[so_desc]
                    so_item['batch_number'] = match_info['batch_number']
                    print(f"SUCCESS: Exact match: '{so_desc}' → Batch: {match_info['batch_number']}")
                    matched = True
                
                # Method 2: Item code match (exact and partial)
                elif so_code and so_code in email_items_by_code:
                    match_info = email_items_by_code[so_code]
                    so_item['batch_number'] = match_info['batch_number']
                    print(f"SUCCESS: Code match: '{so_code}' → Batch: {match_info['batch_number']}")
                    matched = True
                # Method 2b: Smart code matching (general)
                elif so_code:
                    for email_word, match_info in email_items_by_code.items():
                        if email_word in so_code or so_code.startswith(email_word):
                            so_item['batch_number'] = match_info['batch_number']
                            print(f"SUCCESS: Smart code match: '{email_word}' matches '{so_code}' → Batch: {match_info['batch_number']}")
                            matched = True
                            break
                
                # Method 3: Smart product name matching for Canoil products
                elif not matched:
                    for email_desc, match_info in email_items_by_desc.items():
                        # Extract core product names for comparison
                        email_core = extract_core_product_name(email_desc)
                        so_core = extract_core_product_name(so_desc)
                        so_raw_core = extract_core_product_name(so_raw_line)
                        
                        # Check if core product names match
                        if email_core and so_core and email_core in so_core:
                            so_item['batch_number'] = match_info['batch_number']
                            print(f"SUCCESS: Core product match: '{email_core}' found in '{so_core}' → Batch: {match_info['batch_number']}")
                            matched = True
                            break
                        elif email_core and so_raw_core and email_core in so_raw_core:
                            so_item['batch_number'] = match_info['batch_number']
                            print(f"SUCCESS: Core product match (raw): '{email_core}' found in '{so_raw_core}' → Batch: {match_info['batch_number']}")
                            matched = True
                            break
                        
                        # Fallback: Check if email description is contained in SO description
                        elif email_desc in so_desc or so_desc in email_desc:
                            so_item['batch_number'] = match_info['batch_number']
                            print(f"SUCCESS: Fuzzy match: '{so_desc}' ≈ '{email_desc}' → Batch: {match_info['batch_number']}")
                            matched = True
                            break
                        
                        # Check if item code is in email description
                        elif so_code and so_code in email_desc:
                            so_item['batch_number'] = match_info['batch_number']
                            print(f"SUCCESS: Code in desc: '{so_code}' found in '{email_desc}' → Batch: {match_info['batch_number']}")
                            matched = True
                            break
                
                if not matched:
                    unmatched_items.append(so_item.get('description', 'Unknown'))
                    print(f"⚠️ No batch match for SO item: '{so_desc}' (Code: {so_code})")
            
            if unmatched_items:
                print(f"⚠️ {len(unmatched_items)} SO items without batch numbers: {', '.join(unmatched_items[:3])}...")
        
        # Add HTS codes to all items
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
            'validation_passed': True
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

@logistics_bp.route('/download/logistics/<filename>', methods=['GET', 'OPTIONS'])
def download_file(filename):
    """Download generated logistics files automatically - Forces download dialog"""
    try:
        uploads_dir = get_uploads_dir()
        filepath = os.path.join(uploads_dir, filename)
        print(f"📥 Download request for: {filename}")
        print(f"📁 File path: {filepath}")
        print(f"📁 File exists: {os.path.exists(filepath)}")
        
        if os.path.exists(filepath):
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
                filepath, 
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
            print(f"❌ File not found: {filepath}")
            return jsonify({'error': f'File not found: {filename}'}), 404
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
        
        filename = generate_document_filename("CommercialInvoice", so_data, '.html')
        uploads_dir = get_uploads_dir()
        filepath = os.path.join(uploads_dir, filename)
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"SUCCESS: Commercial invoice generated: {filename}")
        
        return jsonify({
            'success': True,
            'commercial_invoice_file': filename,
            'download_url': f'/download/logistics/{filename}'
        })
        
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
        
        results = {}
        errors = []
        
        # Dangerous goods info (will be updated by smart generator)
        dangerous_goods_info = {'has_dangerous_goods': False}
        
        # Create timestamp ONCE for all documents
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Generate BOL (NEW professional format)
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
            uploads_dir = get_uploads_dir()
            bol_filepath = os.path.join(uploads_dir, bol_filename)
            
            print(f"DEBUG: BOL filepath: {bol_filepath}")
            os.makedirs(os.path.dirname(bol_filepath), exist_ok=True)
            with open(bol_filepath, 'w', encoding='utf-8') as f:
                f.write(bol_html)
            print(f"DEBUG: BOL file created successfully")
            
            results['bol'] = {
                'success': True,
                'filename': bol_filename,
                'download_url': f'/download/logistics/{bol_filename}'
            }
            print(f"✅ BOL generated: {bol_filename}")
            
        except Exception as e:
            print(f"❌ BOL generation error: {e}")
            traceback.print_exc()  # Use module-level traceback
            errors.append(f"BOL generation failed: {str(e)}")
            results['bol'] = {'success': False, 'error': str(e)}
        
        # Generate Packing Slip
        try:
            from packing_slip_html_generator import generate_packing_slip_html
            ps_html = generate_packing_slip_html(so_data, email_shipping, items)
            ps_filename = generate_document_filename("PackingSlip", so_data, '.html')
            uploads_dir = get_uploads_dir()
            ps_filepath = os.path.join(uploads_dir, ps_filename)
            
            with open(ps_filepath, 'w', encoding='utf-8') as f:
                f.write(ps_html)
            
            results['packing_slip'] = {
                'success': True,
                'filename': ps_filename,
                'download_url': f'/download/logistics/{ps_filename}'
            }
            print(f"✅ Packing Slip generated: {ps_filename}")
            
        except Exception as e:
            print(f"❌ Packing Slip generation error: {e}")
            traceback.print_exc()  # Use module-level traceback
            errors.append(f"Packing Slip generation failed: {str(e)}")
            results['packing_slip'] = {'success': False, 'error': str(e)}
        
        # Commercial Invoice Generation - Always generate when "Generate All Documents" is called
        try:
            # Determine destination country for logging purposes
            destination_country = None
            is_cross_border = False
            
            # Check shipping address country
            shipping_address = so_data.get('shipping_address', {})
            if shipping_address.get('country'):
                destination_country = str(shipping_address.get('country', '')).upper().strip()
            
            # Check email_shipping for destination (if passed)
            email_shipping = data.get('email_shipping', {})
            if not destination_country and email_shipping:
                if email_shipping.get('destination_country'):
                    destination_country = str(email_shipping.get('destination_country', '')).upper().strip()
                elif email_shipping.get('final_destination'):
                    destination_country = str(email_shipping.get('final_destination', '')).upper().strip()
            
            # Check email analysis for destination
            if not destination_country and email_analysis:
                if email_analysis.get('destination_country'):
                    destination_country = str(email_analysis.get('destination_country', '')).upper().strip()
                elif email_analysis.get('final_destination'):
                    destination_country = str(email_analysis.get('final_destination', '')).upper().strip()
            
            # Determine if cross-border (for logging)
            if destination_country:
                # If destination is not Canada, it's cross-border
                is_cross_border = destination_country not in ['CANADA', 'CA', 'CAN']
                print(f"\n📋 Commercial Invoice Check:")
                print(f"   Destination: {destination_country}")
                print(f"   Cross-border: {is_cross_border}")
            else:
                # Default to cross-border if destination unknown (safer to include)
                is_cross_border = True
                destination_country = 'UNKNOWN'
                print(f"\n📋 Commercial Invoice Check:")
                print(f"   Destination: UNKNOWN (defaulting to cross-border)")
                print(f"   Cross-border: {is_cross_border}")
            
            # Only generate Commercial Invoice for cross-border shipments
            if is_cross_border:
                print(f"📋 Generating Commercial Invoice (cross-border shipment to {destination_country})")
                from commercial_invoice_html_generator import generate_commercial_invoice_html
                ci_html = generate_commercial_invoice_html(
                    so_data, 
                    items, 
                    email_analysis
                )
                ci_filename = generate_document_filename("CommercialInvoice", so_data, '.html')
                uploads_dir = get_uploads_dir()
                ci_filepath = os.path.join(uploads_dir, ci_filename)
                
                with open(ci_filepath, 'w', encoding='utf-8') as f:
                    f.write(ci_html)
                
                results['commercial_invoice'] = {
                    'success': True,
                    'filename': ci_filename,
                    'download_url': f'/download/logistics/{ci_filename}',
                    'reason': f'Generated for cross-border shipment to {destination_country}'
                }
                print(f"✅ Commercial Invoice generated: {ci_filename}")
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
                        # Use absolute path to avoid nested directory issues
                        uploads_dir = get_uploads_dir()
                        new_dg_path = os.path.join(uploads_dir, new_dg_filename)
                        
                        print(f"   Target path: {new_dg_path}")
                        
                        # Copy file to uploads folder
                        os.makedirs(os.path.dirname(new_dg_path), exist_ok=True)
                        shutil.copy2(dg_filepath, new_dg_path)
                        
                        print(f"   Copy successful: {os.path.exists(new_dg_path)}")
                        
                        dg_results.append({
                            'success': True,
                            'filename': new_dg_filename,
                            'download_url': f'/download/logistics/{new_dg_filename}',
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
                        
                        # Copy SDS with new name
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
                        
                        # Copy COFA with new name
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
        try:
            from tsca_generator import generate_tsca_certification
            
            print("\n📋 Checking if TSCA Certification is needed...")
            
            # TSCA is ONLY needed for USA shipments (not other cross-border shipments)
            is_usa_shipment = destination_country and destination_country in ['USA', 'US', 'UNITED STATES']
            
            if is_usa_shipment:
                print(f"   USA shipment to {destination_country} - TSCA required")
                
                tsca_result = generate_tsca_certification(so_data, items, email_analysis)
                
                if tsca_result:
                    tsca_filepath, tsca_filename = tsca_result
                    results['tsca_certification'] = {
                        'success': True,
                        'filename': tsca_filename,
                        'download_url': f'/download/logistics/{tsca_filename}',
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
        
        # SMART USMCA CERTIFICATE - Check Destination + HTS + COO
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
                
                # Source USMCA form (already signed)
                # Use relative path that works in Docker
                current_dir = os.path.dirname(os.path.abspath(__file__))
                usmca_source = os.path.join(current_dir, 'templates', 'usmca', 'SIGNED USMCA FORM.pdf')
                
                if os.path.exists(usmca_source):
                    # Copy to uploads folder - USMCA is a blank template, use simple name
                    import shutil
                    so_number = so_data.get('so_number', 'Unknown')
                    usmca_filename = f"USMCA_Certificate_SO{so_number}.pdf"
                    uploads_dir = get_uploads_dir()
                    usmca_path = os.path.join(uploads_dir, usmca_filename)
                    
                    os.makedirs(os.path.dirname(usmca_path), exist_ok=True)
                    shutil.copy2(usmca_source, usmca_path)
                    
                    results['usmca_certificate'] = {
                        'success': True,
                        'filename': usmca_filename,
                        'download_url': f'/download/logistics/{usmca_filename}',
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
        
        # Add CORS headers to response
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
            'summary': summary_message
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
