#!/usr/bin/env python3
"""
RAW SALES ORDER EXTRACTOR
Extract EVERYTHING from PDF AS-IS - no interpretation, no cleaning, no conversion
Send raw data to OpenAI for structuring
"""
import os
import re
import pdfplumber
import json
from openai import OpenAI

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not available, environment variables must be set manually
    pass

# Lazy OpenAI client initialization (initialize when needed, not at import time)
openai_client = None

def get_openai_client():
    """Get or create OpenAI client - lazy initialization to avoid import-time issues"""
    global openai_client
    if openai_client is None:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            error_msg = "OPENAI_API_KEY environment variable not set"
            print(f"ERROR: {error_msg}")
            raise ValueError(error_msg)
        if api_key == "your_openai_api_key_here":
            error_msg = "OPENAI_API_KEY is set to placeholder value 'your_openai_api_key_here'"
            print(f"ERROR: {error_msg}")
            raise ValueError(error_msg)
        try:
            # Fix for httpx version incompatibility - create httpx client first
            import httpx
            http_client = httpx.Client(timeout=60.0)
            openai_client = OpenAI(api_key=api_key, http_client=http_client)
            print(f"[OK] OpenAI client initialized (key length: {len(api_key)} chars)")
        except TypeError as e:
            # If httpx client approach fails, try without it (for older OpenAI versions)
            try:
                openai_client = OpenAI(api_key=api_key)
                print(f"[OK] OpenAI client initialized - fallback method (key length: {len(api_key)} chars)")
            except Exception as e2:
                # Handle version mismatch errors (e.g., proxies parameter issue)
                print(f"ERROR: OpenAI client initialization failed - likely version mismatch: {e2}")
                print(f"Original error: {e}")
                print(f"Attempting to import OpenAI version info...")
                try:
                    import openai
                    print(f"OpenAI library version: {openai.__version__}")
                except:
                    pass
                raise e2
        except Exception as e:
            print(f"ERROR: OpenAI client initialization failed: {e}")
            import traceback
            traceback.print_exc()
            raise
    return openai_client

DEBUG = os.getenv('DEBUG_SO_PARSER', 'False').lower() == 'true'


def extract_raw_from_pdf(pdf_path):
    """
    Step 1: Extract EVERYTHING from PDF AS-IS
    - No interpretation
    - No cleaning
    - No conversion
    Just raw text and raw table data exactly as pdfplumber sees it
    """
    try:
        if DEBUG:
            print(f"\n{'='*80}")
            print(f"RAW EXTRACTION: {os.path.basename(pdf_path)}")
            print(f"{'='*80}")
        
        raw_data = {
            'filename': os.path.basename(pdf_path),
            'filepath': pdf_path,
            'raw_text': '',
            'raw_tables': [],
            'page_count': 0
        }
        
        with pdfplumber.open(pdf_path) as pdf:
            raw_data['page_count'] = len(pdf.pages)
            
            # Extract raw text with layout preservation for two-column handling
            full_text = ""
            for page_num, page in enumerate(pdf.pages, 1):
                # Use layout=True to preserve column structure better
                page_text = page.extract_text(layout=True)
                if page_text:
                    full_text += page_text + "\n"
                    if DEBUG:
                        print(f"  Page {page_num}: Extracted {len(page_text)} characters (layout-preserved)")
            
            raw_data['raw_text'] = full_text
            
            # Extract raw tables - exactly as they appear
            for page_num, page in enumerate(pdf.pages, 1):
                tables = page.extract_tables()
                if tables:
                    for table_num, table ,in enumerate(tables, 1):
                        if table and len(table) > 0:
                            raw_data['raw_tables'].append({
                                'page': page_num,
                                'table_num': table_num,
                                'data': table
                            })
                            if DEBUG:
                                print(f"  Page {page_num}, Table {table_num}: {len(table)} rows x {len(table[0]) if table[0] else 0} cols")
        
        if DEBUG:
            print(f"\nRAW EXTRACTION COMPLETE:")
            print(f"  Text length: {len(raw_data['raw_text'])} characters")
            print(f"  Tables found: {len(raw_data['raw_tables'])}")
            print(f"{'='*80}\n")
        
        return raw_data
        
    except Exception as e:
        print(f"ERROR in raw extraction: {e}")
        import traceback
        traceback.print_exc()
        return None


def extract_addresses_from_layout_text(raw_text):
    """
    Extract Sold To and Ship To addresses from layout-preserved PDF text.
    The PDF has a two-column layout where addresses are INTERLEAVED:
    
    Column layout based on actual PDFs:
    - Position 0-43: Sold To column
    - Position 43-65: Ship To column  
    - Position 66+: MO references (EXCLUDE)
    
    Sold To:                          Ship To:
         AXEL FRANCE-USD                  AXEL FRANCE-USD
                                          ZI SAINT-LIGUAIRE
         30 Rue de Pied de Fond           
                                          F-79000 NIORT
    
    This function parses the interleaved format by detecting left vs right column content.
    """
    sold_to_lines = []
    ship_to_lines = []
    
    lines = raw_text.split('\n')
    in_address_section = False
    
    # Items to skip - headers, references, phone numbers, batch numbers
    SKIP_PATTERNS = [
        'SOLD TO:', 'SHIP TO:', 'ORDER NO', 'DATE:', 'PAGE:', 'SHIP DATE',
        'LINE ', 'MO ', 'CHILD MO', 'BUSINESS NO', 'MOS ',  # MOS for plural "MOs 3712"
        'BATCH NO', 'BATCH:', 'RECEIVING PH'  # Batch numbers and phone references
    ]
    
    # Phone number patterns - various formats
    import re
    phone_pattern = re.compile(r'(\(\d{3}\)\s*\d{3}[-.]?\d{4}|\d{3}[-.]?\d{3}[-.]?\d{4})')
    
    # Batch number pattern - extract if found
    batch_number = ''
    batch_pattern = re.compile(r'batch\s*(?:no)?:?\s*([A-Z0-9]+)', re.IGNORECASE)
    
    # Find the "Sold To:" / "Ship To:" header line
    for i, line in enumerate(lines):
        if 'Sold To:' in line and 'Ship To:' in line:
            in_address_section = True
            continue
        
        if not in_address_section:
            continue
        
        # Stop at Business No. or Item No.
        if 'Business No' in line or 'Item No' in line:
            break
        
        # Skip lines with "Line X: MO" pattern (manufacturing order refs)
        if re.search(r'Line\s+\d+:', line):
            continue
        
        # Skip empty lines
        stripped = line.strip()
        if not stripped:
            continue
        
        # Column positions based on actual PDF analysis:
        # Sold To: position 0-43 (left column)
        # Ship To: position 43-75 (right column) - extended to capture full addresses
        # MO refs: position 58+ (far right) - handled by column extraction, not line skipping
        
        # Extract the address columns FIRST, then check for MO patterns
        # This ensures we don't skip "USA" just because "MO 3795" appears on the same line
        left_content = line[0:43].strip()  # Sold To column
        middle_content = line[43:75].strip() if len(line) > 43 else ''  # Ship To column
        
        # Remove any MO references from the extracted column content (not the full line)
        if left_content:
            left_content = re.sub(r'\s*,?\s*(Child\s+)?MO\s+\d+.*$', '', left_content).strip()
        if middle_content:
            # Remove "MO XXXX" or "Child MO XXXX" patterns from end
            middle_content = re.sub(r'\s*,?\s*(Child\s+)?MO\s+\d+.*$', '', middle_content).strip()
        
        # Skip if content matches any skip pattern
        def should_skip(content):
            if not content:
                return True
            upper = content.upper()
            for pattern in SKIP_PATTERNS:
                if pattern in upper:
                    return True
            # Skip phone numbers
            if phone_pattern.search(content):
                return True
            return False
        
        # Check for batch number in the FULL line (not just extracted columns)
        # This is important because batch numbers can appear in the far right column
        batch_match = batch_pattern.search(line)
        if batch_match and not batch_number:
            batch_number = batch_match.group(1)
            print(f"   FOUND BATCH in line: {batch_number}")
        
        if left_content and not should_skip(left_content):
            sold_to_lines.append(left_content)
            
        if middle_content and not should_skip(middle_content):
            ship_to_lines.append(middle_content)
    
    # Clean up: remove duplicates, very short lines, MO refs, and consolidate
    def clean_lines(lines_list):
        import re
        cleaned = []
        seen = set()
        for line in lines_list:
            line = line.strip()
            # Skip very short or duplicate lines
            if len(line) < 2:
                continue
            # Skip lines that are mainly MO references
            if re.match(r'^(MOs?|Child MO)\s*\d+', line, re.IGNORECASE):
                continue
            # Remove trailing MO references from lines
            line = re.sub(r'\s*,?\s*(MOs?|Child MO)\s+\d+.*$', '', line, flags=re.IGNORECASE).strip()
            if len(line) < 2:
                continue
            # Normalize for duplicate check
            normalized = line.lower().replace(' ', '')
            if normalized in seen:
                continue
            seen.add(normalized)
            cleaned.append(line)
        return cleaned
    
    sold_to_lines = clean_lines(sold_to_lines)
    ship_to_lines = clean_lines(ship_to_lines)
    
    result = {
        'sold_to_raw': '\n'.join(sold_to_lines),
        'ship_to_raw': '\n'.join(ship_to_lines),
        'batch_number': batch_number
    }
    
    if result['sold_to_raw'] or result['ship_to_raw']:
        print(f"\n=== LAYOUT TEXT EXTRACTED ADDRESSES ===")
        print(f"SOLD TO:\n{result['sold_to_raw']}")
        print(f"\nSHIP TO:\n{result['ship_to_raw']}")
        if batch_number:
            print(f"\nBATCH NUMBER: {batch_number}")
        print(f"=======================================\n")
    
    return result


def extract_addresses_from_tables(raw_tables):
    """
    Pre-extract Sold To and Ship To addresses from table data.
    The PDF has these in a two-column table - LEFT is Sold To, RIGHT is Ship To.
    This is MORE RELIABLE than asking GPT to parse the mixed text.
    
    IMPROVED: Better detection of address sections and handling of various table formats.
    """
    sold_to_lines = []
    ship_to_lines = []
    in_sold_to_section = False
    in_ship_to_section = False
    found_address_header = False
    
    print(f"\n=== DEBUG: extract_addresses_from_tables ===")
    print(f"Number of tables: {len(raw_tables)}")
    
    for table_idx, table_info in enumerate(raw_tables):
        table = table_info.get('data', [])
        print(f"\nTable {table_idx}: {len(table)} rows")
        
        for row_idx, row in enumerate(table):
            if not row:
                continue
            
            # Debug print each row
            print(f"  Row {row_idx}: {row}")
            
            # Handle different row lengths
            left_cell = str(row[0] or '').strip() if len(row) > 0 else ''
            right_cell = str(row[1] or '').strip() if len(row) > 1 else ''
            
            # Detect "Sold To" / "Ship To" header row (various formats)
            left_upper = left_cell.upper()
            right_upper = right_cell.upper()
            
            if 'SOLD TO' in left_upper or 'BILL TO' in left_upper:
                found_address_header = True
                in_sold_to_section = True
                print(f"    -> Found SOLD TO header")
                # If Ship To is in same row header
                if 'SHIP TO' in right_upper:
                    in_ship_to_section = True
                    print(f"    -> Found SHIP TO header (same row)")
                continue
            
            if 'SHIP TO' in left_upper or 'SHIP TO' in right_upper:
                found_address_header = True
                in_ship_to_section = True
                print(f"    -> Found SHIP TO header")
                continue
            
            # Stop when we hit item table or other sections
            if found_address_header:
                stop_keywords = ['ITEM', 'ORDERED', 'BUSINESS NO', 'QTY', 'UNIT PRICE', 'AMOUNT', 'DESCRIPTION']
                if any(kw in left_upper for kw in stop_keywords):
                    print(f"    -> Hit stop keyword, ending address section")
                    break
            
            # Collect address lines - LEFT = Sold To, RIGHT = Ship To
            if found_address_header:
                skip_labels = ['SOLD TO:', 'SHIP TO:', 'BILL TO:', 'SOLD TO', 'SHIP TO', 'BILL TO']
                
                if left_cell and left_cell.upper() not in [s.upper() for s in skip_labels]:
                    sold_to_lines.append(left_cell)
                    print(f"    -> Added to SOLD TO: {left_cell}")
                
                if right_cell and right_cell.upper() not in [s.upper() for s in skip_labels]:
                    ship_to_lines.append(right_cell)
                    print(f"    -> Added to SHIP TO: {right_cell}")
    
    result = {
        'sold_to_raw': '\n'.join(sold_to_lines),
        'ship_to_raw': '\n'.join(ship_to_lines)
    }
    
    print(f"\n=== FINAL EXTRACTED ADDRESSES ===")
    print(f"SOLD TO:\n{result['sold_to_raw']}")
    print(f"\nSHIP TO:\n{result['ship_to_raw']}")
    print(f"=================================\n")
    
    return result


def extract_brokerage_focused(special_instructions):
    """
    Dedicated OpenAI call ONLY for extracting carrier/broker information
    This focused extraction is more reliable than extracting brokerage
    as part of the main SO parsing (which has 50+ fields to extract)
    
    Returns: dict with 'broker_name' and 'account_number' (or empty strings)
    """
    try:
        if not special_instructions or len(special_instructions.strip()) < 5:
            return {'broker_name': '', 'account_number': ''}
        
        prompt = f"""You are a shipping logistics expert. Extract ONLY the carrier/broker information from these special instructions.

SPECIAL INSTRUCTIONS:
{special_instructions}

TASK: Find the shipping carrier/broker company name and any account/reference numbers.

Common patterns:
- "Ship Via [carrier name] COLLECT [number]" → extract carrier name AND account number
- "Broker: [name], Account: [number]" → extract name AND account number
- "COLLECT [number]" → extract as account number
- "Account: [number]" or "Account #: [number]" → extract number

IMPORTANT RULES:
1. MUST have BOTH carrier name AND account number - if only one is present, return empty for BOTH
2. Email addresses are NOT account numbers
3. "Contact [email]" or "email [address]" = return empty strings for both fields
4. Only extract if you find BOTH a clear carrier name AND a numeric account/reference
5. Incomplete info = return empty strings for both fields (all or nothing)

Examples:
- "Ship Via Manitoulin COLLECT 4337" → {{"carrier_name": "Manitoulin", "account_number": "4337"}}
- "Broker: Livingston International, Account: 12345" → {{"carrier_name": "Livingston International", "account_number": "12345"}}
- "Ship Collect, email Transportation@company.com" → {{"carrier_name": "", "account_number": ""}}
- "Contact John@company.com to arrange" → {{"carrier_name": "", "account_number": ""}}

Return ONLY this JSON structure:
{{
    "carrier_name": "extracted carrier/broker company name (or empty string)",
    "account_number": "extracted account/reference number (or empty string)"
}}

If no proper carrier WITH account number found, return empty strings for both fields.
Return ONLY valid JSON, no explanations."""

        # Use gpt-4o-mini for faster, cheaper focused extraction
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You extract carrier/broker information from shipping instructions. Return only valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,  # Deterministic
            max_tokens=200  # Small response
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Clean markdown if present
        if result_text.startswith('```json'):
            result_text = result_text[7:]
        if result_text.startswith('```'):
            result_text = result_text[3:]
        if result_text.endswith('```'):
            result_text = result_text[:-3]
        result_text = result_text.strip()
        
        # Parse JSON
        brokerage_data = json.loads(result_text)
        
        # Ensure we have the expected structure
        return {
            'broker_name': brokerage_data.get('carrier_name', '') or brokerage_data.get('broker_name', ''),
            'account_number': brokerage_data.get('account_number', '')
        }
        
    except Exception as e:
        if DEBUG:
            print(f"  ⚠ Focused brokerage extraction failed: {e}")
        # Return empty on any failure - safe fallback
        return {'broker_name': '', 'account_number': ''}


def structure_with_openai(raw_data):
    """
    Step 2: Send raw data to OpenAI for complete organization and structuring
    OpenAI does ALL the work:
    - Identifies SO number
    - Parses customer name
    - Extracts items with codes, descriptions, quantities, prices
    - Structures addresses (Sold To, Ship To)
    - Converts prices from text to numbers
    - Organizes dates, PO numbers, terms, etc.
    """
    try:
        if DEBUG:
            print(f"\n{'='*80}")
            print(f"OPENAI STRUCTURING: {raw_data['filename']}")
            print(f"{'='*80}")
        
        # PRE-EXTRACT addresses from table data (more reliable than GPT parsing)
        pre_extracted = extract_addresses_from_tables(raw_data.get('raw_tables', []))
        sold_to_hint = pre_extracted.get('sold_to_raw', '')
        ship_to_hint = pre_extracted.get('ship_to_raw', '')
        batch_from_pdf = pre_extracted.get('batch_number', '')
        
        # FALLBACK: If table extraction failed, try layout-based text extraction
        # This handles PDFs where addresses are in interleaved two-column layout, not tables
        if not sold_to_hint and not ship_to_hint:
            print("Table extraction empty - trying layout text extraction...")
            layout_extracted = extract_addresses_from_layout_text(raw_data.get('raw_text', ''))
            sold_to_hint = layout_extracted.get('sold_to_raw', '')
            ship_to_hint = layout_extracted.get('ship_to_raw', '')
            if not batch_from_pdf:
                batch_from_pdf = layout_extracted.get('batch_number', '')
        
        if DEBUG:
            print(f"PRE-EXTRACTED Sold To: {sold_to_hint[:100]}...")
            print(f"PRE-EXTRACTED Ship To: {ship_to_hint[:100]}...")
        
        # Build address hints for GPT
        address_hints = ""
        if sold_to_hint or ship_to_hint:
            address_hints = f"""
=== CRITICAL: PRE-EXTRACTED ADDRESSES - YOU MUST USE THESE EXACTLY ===
SOLD TO ADDRESS (from LEFT column of PDF):
{sold_to_hint}

SHIP TO ADDRESS (from RIGHT column of PDF):
{ship_to_hint}

MANDATORY RULES:
1. Use the SOLD TO address above for the "sold_to" section
2. Use the SHIP TO address above for the "ship_to" section  
3. These are DIFFERENT addresses - do NOT combine them
4. Do NOT add any text from Ship To into Sold To or vice versa
=== END ADDRESS SECTION ===
"""
        
        # Always print pre-extracted addresses for debugging
        print(f"PRE-EXTRACTED SOLD TO: {sold_to_hint}")
        print(f"PRE-EXTRACTED SHIP TO: {ship_to_hint}")
        
        # Prepare the prompt with raw data
        prompt = f"""You are a Sales Order data expert. Extract and organize ALL information from this raw PDF data into clean structured JSON.

FILENAME: {raw_data['filename']}
{address_hints}
RAW TEXT FROM PDF:
{raw_data['raw_text']}

RAW TABLES FROM PDF:
{json.dumps(raw_data['raw_tables'], indent=2)}

Extract and organize into this exact JSON structure:
{{
  "so_number": "extracted SO number",
  "customer_name": "[CRITICAL] CUSTOMER company name - this is the 'Sold To' or 'Bill To' company who is BUYING from us. NEVER extract 'Canoil', 'Canoil Company', 'Canoil Inc', or any variation as customer_name - those are the SELLER (us). Look for the BUYER/CUSTOMER in the 'Sold To' or 'Bill To' section.",
  "order_date": "date in original format",
  "ship_date": "ship date if mentioned",
  "po_number": "PO number if mentioned",
  "business_number": "business number if mentioned",
  "terms": "payment terms",
  "sold_to": {{
    "company_name": "company name from Sold To section (same as customer_name above)",
    "contact_person": "contact person if mentioned",
    "full_address": "COPY THE ENTIRE ADDRESS EXACTLY AS IT APPEARS IN THE PDF - preserve line breaks with \\n - DO NOT abbreviate, reformat, or change anything",
    "street_address": "ONLY the physical street address (e.g. '2275 McCollum Parkway') - DO NOT include company name here",
    "city": "city name",
    "province": "province/state - KEEP AS WRITTEN (Quebec stays Quebec, not QC)",
    "postal_code": "postal/zip code",
    "country": "country (default Canada if not specified) - KEEP AS WRITTEN",
    "phone": "phone number",
    "email": "email address"
  }},
  "ship_to": {{
    "company_name": "company name from Ship To section",
    "contact_person": "contact person if mentioned",
    "full_address": "COPY THE ENTIRE ADDRESS EXACTLY AS IT APPEARS IN THE PDF - preserve line breaks with \\n - DO NOT abbreviate, reformat, or change anything",
    "street_address": "ONLY the physical street address (e.g. '123 Main Street') - DO NOT include company name here",
    "city": "city name",
    "province": "province/state - KEEP AS WRITTEN (Quebec stays Quebec, not QC)",
    "postal_code": "postal/zip code",
    "country": "country (default Canada if not specified) - KEEP AS WRITTEN",
    "phone": "phone number",
    "email": "email address"
  }},
  "items": [
    {{
      "item_code": "item/product code",
      "description": "item description",
      "quantity": quantity_as_number,
      "unit": "unit (DRUM, PAIL, GALLON, etc.)",
      "unit_price": price_as_number,
      "total_price": total_as_number
    }}
  ],
  "subtotal": subtotal_as_number,
  "tax": tax_as_number,
  "total_amount": total_amount_as_number,
  "brokerage": {{
    "broker_name": "customs broker company name if mentioned (e.g., Livingston International, Cole International)",
    "account_number": "broker account number if mentioned (e.g., 12345, ACCT-98765)"
  }},
  "special_instructions": "any special instructions or comments",
  "raw_text": "keep original raw text"
}}

IMPORTANT RULES:
1. CLEAN ITEM DESCRIPTIONS - CRITICAL:
   - Item description should ONLY be the product name (e.g., "REOLUBE 46XC DRUM")
   - DO NOT include shipping instructions in description (e.g., "Ship Via Manitoulin")
   - DO NOT include handling notes (e.g., "***CHEMRISK LABEL - RED***", "-SDS", "-COA")
   - DO NOT include special instructions (e.g., "IDENTIFICATION OF BATCH/LOT NUMBER")
   - DO NOT include TAX CODES at the end of descriptions - these are SEPARATE columns:
     * "G" = GST 5%, "H" = HST 13%, "E" = Exempt, "Z" = Zero-rated
     * CRITICAL PDF FORMAT: ITEM_CODE | QTY | UNIT | DESCRIPTION | TAX | UNIT_PRICE | AMOUNT
     * The single letter (G, H, E, Z) BEFORE the price is ALWAYS the TAX CODE - NEVER part of description!
     * Strip trailing G/H/E/Z from ALL descriptions when followed by a price number
     * Examples for ALL products:
       - "VSGDRM 1 DRUM VSG Drums G 5,260.76" → desc: "VSG Drums"
       - "ROBCO 83 CASE60 ROBCO EP/MP 1004 H 27.66" → desc: "ROBCO EP/MP 1004"
       - "BVA-46 10 DRUM BVA 46 G 150.00" → desc: "BVA 46"
       - "MOV5020 5 DRUM MOV 50/20 Long Life E 500.00" → desc: "MOV 50/20 Long Life"
       - "REOLUBE 1 DRUM Reolube Turbofluid 46XC H 200.00" → desc: "Reolube Turbofluid 46XC"
   - These notes should go in "special_instructions" field instead
   - Example: If you see "REOLUBE 46XC DRUM\nShip Via Manitoulin COLLECT 4337\n***CHEMRISK LABEL - RED***"
     → description: "REOLUBE 46XC DRUM"
     → special_instructions should contain: "Ship Via Manitoulin COLLECT 4337, ***CHEMRISK LABEL - RED***"

2. Extract items EXACTLY as they appear - if multiple items are in one table row (merged), extract each separately
3. Convert price strings like "US$30,327.05" or "2,050.00" to numbers (remove currency symbols and commas)
4. Keep item codes AS-IS (e.g., "BVA-46 BULK" stays "BVA-46 BULK" if that's what appears)
5. SOLD TO vs SHIP TO - KEEP THEM SEPARATE (CRITICAL):
   - "Sold To" and "Ship To" are TWO DIFFERENT addresses - NEVER merge them!
   - The PDF has them in two columns side by side - extract each column SEPARATELY
   - sold_to = LEFT column (billing address)
   - ship_to = RIGHT column (shipping/delivery address)
   - These addresses are OFTEN DIFFERENT - do NOT copy one to the other
   - Example from Axel France SO:
     * Sold To (LEFT): "30 Rue de Pied de Fond, ZI St. Liguaire CS 98821, Niort Cedex, France F79000"
     * Ship To (RIGHT): "ZI SAINT-LIGUAIRE, F-79000 NIORT, FRANCE"
     * These are DIFFERENT - keep them separate!
   - NEVER combine text from both columns into one address
6. Parse addresses into SEPARATE fields - DO NOT DUPLICATE DATA ACROSS FIELDS:
   - street_address: ONLY the street/building address lines (e.g., "1600 Drew Road", "ZI SAINT-LIGUAIRE, 30 Rue de Pied de Fond")
     * Include department, suite numbers, unit numbers, PO boxes
     * DO NOT include city, postal code, or country in street_address - those go in separate fields!
     * For French addresses like "ZI SAINT-LIGUAIRE, 30 Rue de Pied de Fond, F-79000 NIORT" - extract ONLY "ZI SAINT-LIGUAIRE, 30 Rue de Pied de Fond" as street
   - city: City name ONLY (e.g., "Niort", "West Hill", "Mississauga") - NO postal codes here!
   - province: Province/state/region code only (e.g., "ON", "FR", "Niort Cedex")
   - postal_code: Postal/zip code ONLY (e.g., "F-79000", "M1E 2K3", "79000") - extract from wherever it appears
   - country: Country name (e.g., "France", "Canada")
   - CRITICAL: Never duplicate postal codes - if "F-79000" appears, put it ONLY in postal_code, not also in street_address
7. If information is not found, use empty string "" for text fields or 0 for numbers
8. Preserve all items found in tables - don't skip any
9. Handle both merged items (multiple items in one row with newlines) and single items (one per row)
10. BROKERAGE/CARRIER INFORMATION - EXTRACT FROM SPECIAL INSTRUCTIONS:
   - **Look at special_instructions and extract ANY brokerage, carrier, or shipping company information**
   - Common patterns (extract ANY you see):
     * "Ship Via [carrier name]" → extract carrier name to broker_name
     * "Broker: [name]" or "Brokerage: [name]" → extract name to broker_name
     * "Customs Broker: [name]" → extract name to broker_name
     * "COLLECT [number]" → extract number to account_number
     * "Account: [number]" or "Account #: [number]" → extract to account_number
     * Any carrier/shipping company mentioned → extract to broker_name
   
   - **Examples**:
     * "Ship Via Manitoulin COLLECT 4337" 
       → broker_name: "Manitoulin", account_number: "4337"
     * "Ship via Fedex Ground, Account: 987654"
       → broker_name: "Fedex Ground", account_number: "987654"
     * "Broker: Livingston International, Account: 12345"
       → broker_name: "Livingston International", account_number: "12345"
     * "Customs clearance through Cole International"
       → broker_name: "Cole International", account_number: ""
   
   - **Extract the carrier/broker company name and any associated account/reference number**
   - If no carrier/broker info in special instructions, leave empty

Return ONLY valid JSON, no explanations or markdown.
"""
        
        if DEBUG:
            print(f"  Sending to OpenAI (model: gpt-4o)...")
            print(f"  Text length: {len(raw_data['raw_text'])} chars")
            print(f"  Tables: {len(raw_data['raw_tables'])}")
        
        # Call OpenAI (use lazy client getter)
        try:
            client = get_openai_client()
        except ValueError as e:
            print(f"ERROR: Cannot get OpenAI client: {e}")
            print(f"  Check that OPENAI_API_KEY environment variable is set correctly")
            return None
        except Exception as e:
            print(f"ERROR: Failed to initialize OpenAI client: {e}")
            import traceback
            traceback.print_exc()
            return None
        
        try:
            response = client.chat.completions.create(
            model="gpt-4o",  # Use GPT-4o for better table parsing
            messages=[
                {
                    "role": "system",
                    "content": "You are a sales order data extraction expert. You parse sales order documents and return perfectly structured JSON data."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,  # Deterministic output
            max_tokens=4000
            )
        except Exception as api_error:
            print(f"ERROR: OpenAI API call failed: {api_error}")
            print(f"  Error type: {type(api_error).__name__}")
            if hasattr(api_error, 'response'):
                print(f"  API Response: {api_error.response}")
            import traceback
            traceback.print_exc()
            return None
        
        # Extract and parse the response
        result_text = response.choices[0].message.content.strip()
        
        # Clean up markdown if present
        if result_text.startswith('```json'):
            result_text = result_text[7:]
        if result_text.startswith('```'):
            result_text = result_text[3:]
        if result_text.endswith('```'):
            result_text = result_text[:-3]
        result_text = result_text.strip()
        
        # Parse JSON
        structured_data = json.loads(result_text)
        
        # POST-PROCESSING: Strip tax codes from item descriptions
        # GPT sometimes includes the tax code letter (G, H, E, Z) at the end of descriptions
        if 'items' in structured_data:
            for item in structured_data['items']:
                desc = item.get('description', '')
                if desc:
                    # Strip trailing single letter tax codes: " G", " H", " E", " Z"
                    cleaned_desc = re.sub(r'\s+[GHEZ]$', '', desc.strip())
                    if cleaned_desc != desc:
                        print(f"  TAX CODE STRIPPED: '{desc}' → '{cleaned_desc}'")
                        item['description'] = cleaned_desc
        
        # SAFETY CHECK: Ensure customer_name is the Sold To company, NOT the seller
        if 'sold_to' in structured_data and structured_data['sold_to'].get('company_name'):
            sold_to_company = structured_data['sold_to']['company_name']
            current_customer = structured_data.get('customer_name', '')
            
            # If customer_name is "Canoil" (seller) or doesn't match Sold To, fix it
            # Check for any variation of "Canoil" as the customer name
            canoil_variations = ['canoil', 'canoil company', 'canoil inc', 'canoil corp']
            is_canoil = any(variation in current_customer.lower() for variation in canoil_variations)
            
            if not current_customer or is_canoil:
                print(f"[!] FIXED CUSTOMER: '{current_customer}' → '{sold_to_company}' (Canoil is the SELLER, not customer)")
                structured_data['customer_name'] = sold_to_company
            elif current_customer.lower() != sold_to_company.lower():
                # Customer name doesn't match Sold To - prefer Sold To as it's more reliable
                print(f"[!] CUSTOMER MISMATCH: customer_name='{current_customer}' vs sold_to='{sold_to_company}' - Using Sold To")
                structured_data['customer_name'] = sold_to_company
        
        # Add backward compatibility for logistics_automation.py and frontend
        # Map sold_to -> billing_address and ship_to -> shipping_address
        if 'sold_to' in structured_data:
            structured_data['billing_address'] = {
                'company': structured_data['sold_to'].get('company_name', ''),
                'company_name': structured_data['sold_to'].get('company_name', ''),
                'contact': structured_data['sold_to'].get('contact_person', ''),
                'contact_person': structured_data['sold_to'].get('contact_person', ''),
                'full_address': structured_data['sold_to'].get('full_address', ''),
                'street': structured_data['sold_to'].get('street_address', ''),
                'street_address': structured_data['sold_to'].get('street_address', ''),
                'address': structured_data['sold_to'].get('street_address', ''),
                'city': structured_data['sold_to'].get('city', ''),
                'province': structured_data['sold_to'].get('province', ''),
                'postal': structured_data['sold_to'].get('postal_code', ''),
                'postal_code': structured_data['sold_to'].get('postal_code', ''),
                'country': structured_data['sold_to'].get('country', ''),
                'phone': structured_data['sold_to'].get('phone', ''),
                'email': structured_data['sold_to'].get('email', '')
            }
        
        if 'ship_to' in structured_data:
            structured_data['shipping_address'] = {
                'company': structured_data['ship_to'].get('company_name', ''),
                'company_name': structured_data['ship_to'].get('company_name', ''),
                'contact': structured_data['ship_to'].get('contact_person', ''),
                'contact_person': structured_data['ship_to'].get('contact_person', ''),
                'full_address': structured_data['ship_to'].get('full_address', ''),
                'street': structured_data['ship_to'].get('street_address', ''),
                'street_address': structured_data['ship_to'].get('street_address', ''),
                'address': structured_data['ship_to'].get('street_address', ''),
                'city': structured_data['ship_to'].get('city', ''),
                'province': structured_data['ship_to'].get('province', ''),
                'postal': structured_data['ship_to'].get('postal_code', ''),
                'postal_code': structured_data['ship_to'].get('postal_code', ''),
                'country': structured_data['ship_to'].get('country', ''),
                'phone': structured_data['ship_to'].get('phone', ''),
                'email': structured_data['ship_to'].get('email', '')
            }
        
        # CRITICAL FIX: If pre-extracted addresses exist and are DIFFERENT, use them
        # This overrides GPT's potentially wrong parsing
        if sold_to_hint and ship_to_hint:
            # Check if GPT gave us the same address for both (common error)
            gpt_sold = structured_data.get('billing_address', {}).get('street_address', '')
            gpt_ship = structured_data.get('shipping_address', {}).get('street_address', '')
            
            # If GPT's addresses are the same but pre-extracted are different, override
            if gpt_sold and gpt_ship and gpt_sold.lower() == gpt_ship.lower():
                if sold_to_hint.lower() != ship_to_hint.lower():
                    print(f"\n[!!!] GPT GAVE SAME ADDRESS FOR BOTH - OVERRIDING WITH PRE-EXTRACTED")
                    print(f"      GPT Sold To: {gpt_sold}")
                    print(f"      GPT Ship To: {gpt_ship}")
                    print(f"      PRE-EXTRACTED Sold To: {sold_to_hint}")
                    print(f"      PRE-EXTRACTED Ship To: {ship_to_hint}")
                    
                    # Override with pre-extracted addresses
                    structured_data['billing_address']['full_address'] = sold_to_hint
                    structured_data['billing_address']['street_address'] = sold_to_hint
                    structured_data['billing_address']['address'] = sold_to_hint
                    structured_data['billing_address']['street'] = sold_to_hint
                    
                    structured_data['shipping_address']['full_address'] = ship_to_hint
                    structured_data['shipping_address']['street_address'] = ship_to_hint
                    structured_data['shipping_address']['address'] = ship_to_hint
                    structured_data['shipping_address']['street'] = ship_to_hint
                    
                    # Also update the sold_to and ship_to objects
                    if 'sold_to' in structured_data:
                        structured_data['sold_to']['full_address'] = sold_to_hint
                        structured_data['sold_to']['street_address'] = sold_to_hint
                    if 'ship_to' in structured_data:
                        structured_data['ship_to']['full_address'] = ship_to_hint
                        structured_data['ship_to']['street_address'] = ship_to_hint
        
        # Add more compatibility mappings for frontend
        if 'ship_date' in structured_data and 'due_date' not in structured_data:
            structured_data['due_date'] = structured_data['ship_date']
        
        # Add metadata
        structured_data['file_info'] = {
            'filename': raw_data['filename'],
            'filepath': raw_data['filepath'],
            'page_count': raw_data['page_count']
        }
        structured_data['data_source'] = 'OpenAI-structured from raw PDF'
        structured_data['status'] = 'Parsed'
        
        # FOCUSED BROKERAGE EXTRACTION (for higher reliability)
        # If special_instructions exist, do a dedicated OpenAI call just for brokerage
        # This is more reliable than extracting brokerage as part of the main 50+ field extraction
        if structured_data.get('special_instructions'):
            try:
                if DEBUG:
                    print(f"\n  Running focused brokerage extraction...")
                
                focused_brokerage = extract_brokerage_focused(structured_data['special_instructions'])
                
                # If focused extraction found carrier/broker info, use it
                # (overwrites main extraction for improved accuracy)
                if focused_brokerage.get('broker_name'):
                    main_broker = structured_data.get('brokerage', {}).get('broker_name', '')
                    
                    if DEBUG:
                        if main_broker and main_broker != focused_brokerage.get('broker_name'):
                            print(f"  ✓ Focused extraction improved brokerage:")
                            print(f"    Main: {main_broker} → Focused: {focused_brokerage.get('broker_name')}")
                        elif not main_broker:
                            print(f"  ✓ Focused extraction found brokerage: {focused_brokerage.get('broker_name')}")
                        else:
                            print(f"  ✓ Focused extraction confirmed: {focused_brokerage.get('broker_name')}")
                    
                    structured_data['brokerage'] = focused_brokerage
                elif DEBUG:
                    print(f"  ℹ Focused extraction: no carrier/broker info found")
                    
            except Exception as e:
                if DEBUG:
                    print(f"  ⚠ Focused brokerage extraction failed (using main extraction): {e}")
                # On any failure, keep whatever the main extraction got
                pass
        
        # Add batch number from pre-extraction if found
        if batch_from_pdf:
            structured_data['batch_number'] = batch_from_pdf
            print(f"📦 Batch number extracted from PDF: {batch_from_pdf}")
        
        if DEBUG:
            print(f"\nOPENAI STRUCTURING COMPLETE:")
            print(f"  SO Number: {structured_data.get('so_number', 'N/A')}")
            print(f"  Customer: {structured_data.get('customer_name', 'N/A')}")
            print(f"  Items: {len(structured_data.get('items', []))}")
            print(f"  Total: ${structured_data.get('total_amount', 0):.2f}")
            if batch_from_pdf:
                print(f"  Batch: {batch_from_pdf}")
            brokerage = structured_data.get('brokerage', {})
            if brokerage and brokerage.get('broker_name'):
                print(f"  Brokerage: {brokerage.get('broker_name')} | Acct: {brokerage.get('account_number', 'N/A')}")
            print(f"{'='*80}\n")
        
        return structured_data
        
    except json.JSONDecodeError as e:
        print(f"ERROR: OpenAI returned invalid JSON: {e}")
        print(f"Response was: {result_text[:500]}")
        return None
    except Exception as e:
        print(f"ERROR in OpenAI structuring: {e}")
        import traceback
        traceback.print_exc()
        return None


def extract_so_data_from_pdf(pdf_path):
    """
    MAIN FUNCTION: Extract Sales Order data using the new flow
    
    Flow:
    1. Extract raw data from PDF (text + tables AS-IS)
    2. Send raw data to OpenAI for structuring
    3. Return clean structured data
    
    This replaces the old 1800+ line parsing function with a 2-step process:
    - Raw extraction (minimal, ~50 lines)
    - OpenAI structuring (handles all complexity)
    """
    try:
        # Step 1: Extract raw
        raw_data = extract_raw_from_pdf(pdf_path)
        if not raw_data:
            print(f"ERROR: Failed to extract raw data from {pdf_path}")
            return None
        
        # Step 2: Structure with OpenAI
        structured_data = structure_with_openai(raw_data)
        if not structured_data:
            print(f"ERROR: Failed to structure data with OpenAI for {pdf_path}")
            print(f"FALLBACK: Returning raw extracted data (unstructured)")
            # Return raw data as fallback - at least we have something
            return {
                'raw_extraction': raw_data,
                'structured': False,
                'error': 'OpenAI structuring failed - returning raw data',
                'filename': raw_data.get('filename', os.path.basename(pdf_path))
            }
        
        return structured_data
        
    except Exception as e:
        print(f"ERROR in extract_so_data_from_pdf: {e}")
        import traceback
        traceback.print_exc()
        return None


def parse_sales_order_pdf(pdf_path):
    """Alias for extract_so_data_from_pdf - maintains compatibility"""
    print(f"\n{'='*80}")
    print(f"SO PARSER - RAW EXTRACTION + OPENAI STRUCTURING")
    print(f"Version: 2025-10-12 (Raw + AI)")
    print(f"{'='*80}\n")
    return extract_so_data_from_pdf(pdf_path)


if __name__ == "__main__":
    # Test with SO 3006
    test_so = r"G:\Shared drives\Sales_CSR\Customer Orders\Sales Orders\2024\July\SalesOrder_3006.pdf"
    if os.path.exists(test_so):
        print(f"Testing with: {test_so}")
        result = extract_so_data_from_pdf(test_so)
        if result:
            print(f"\n✅ SUCCESS!")
            print(f"SO Number: {result.get('so_number')}")
            print(f"Customer: {result.get('customer_name')}")
            print(f"Items: {len(result.get('items', []))}")
            for i, item in enumerate(result.get('items', [])[:5], 1):
                print(f"  {i}. {item.get('item_code')} - {item.get('description')} - Qty: {item.get('quantity')} {item.get('unit')}")
        else:
            print(f"\n❌ FAILED")
    else:
        print(f"Test file not found: {test_so}")

