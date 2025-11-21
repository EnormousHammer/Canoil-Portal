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
            # Initialize with only api_key - no other parameters to avoid version conflicts
            openai_client = OpenAI(api_key=api_key)
            print(f"[OK] OpenAI client initialized (key length: {len(api_key)} chars)")
        except TypeError as e:
            # Handle version mismatch errors (e.g., proxies parameter issue)
            print(f"ERROR: OpenAI client initialization failed - likely version mismatch: {e}")
            print(f"Attempting to import OpenAI version info...")
            try:
                import openai
                print(f"OpenAI library version: {openai.__version__}")
            except:
                pass
            raise
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
        
        # Prepare the prompt with raw data
        prompt = f"""You are a Sales Order data expert. Extract and organize ALL information from this raw PDF data into clean structured JSON.

FILENAME: {raw_data['filename']}

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
    "street_address": "street address only (e.g., 565 Coronation Drive)",
    "city": "city name",
    "province": "province/state code (e.g., ON)",
    "postal_code": "postal/zip code",
    "country": "country (default Canada if not specified)",
    "phone": "phone number",
    "email": "email address"
  }},
  "ship_to": {{
    "company_name": "company name from Ship To section",
    "contact_person": "contact person if mentioned",
    "street_address": "street address only (e.g., 565 Coronation Drive)",
    "city": "city name",
    "province": "province/state code (e.g., ON)",
    "postal_code": "postal/zip code",
    "country": "country (default Canada if not specified)",
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
   - These notes should go in "special_instructions" field instead
   - Example: If you see "REOLUBE 46XC DRUM\nShip Via Manitoulin COLLECT 4337\n***CHEMRISK LABEL - RED***"
     → description: "REOLUBE 46XC DRUM"
     → special_instructions should contain: "Ship Via Manitoulin COLLECT 4337, ***CHEMRISK LABEL - RED***"

2. Extract items EXACTLY as they appear - if multiple items are in one table row (merged), extract each separately
3. Convert price strings like "US$30,327.05" or "2,050.00" to numbers (remove currency symbols and commas)
4. Keep item codes AS-IS (e.g., "BVA-46 BULK" stays "BVA-46 BULK" if that's what appears)
5. TWO-COLUMN ADDRESS HANDLING - BE VERY CAREFUL:
   - "Sold To" and "Ship To" are often in TWO COLUMNS side by side
   - Text extraction reads LEFT TO RIGHT, mixing both columns
   - Match contact names with their correct addresses using context clues (phone numbers, postal codes)
   - Example: If you see "K. Noda" followed by "5-4-5 Nishigotanda, Shinagawa, Tokyo", that address goes with K. Noda
   - If you see "Tel: (076)287-5445" followed by "4-4.Shinbohon, Kanazawa, Ishikawa", that address goes with the phone number
6. Parse addresses into SEPARATE fields - CAPTURE COMPLETE ADDRESS:
   - street_address: FULL street address including ALL lines (e.g., "1600 Drew Road\nDept CW", "565 Coronation Drive\nSuite 100")
     * Include department (Dept CW), suite numbers (Suite 100), unit numbers (Unit 5B), PO boxes, etc.
     * If address has multiple lines before the city, combine them with newlines (\n)
   - city: City name only (e.g., "West Hill", "Mississauga", "Kanazawa-city")
   - province: Province/state (e.g., "ON", "Tokyo", "Ishikawa") - ALWAYS extract province even if on different line
   - postal_code: Postal/zip code only (e.g., "M1E 2K3", "L5S 1S5", "921-8062")
   - country: Country name (default "Canada" if not specified)
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
                'contact': structured_data['sold_to'].get('contact_person', ''),
                'contact_person': structured_data['sold_to'].get('contact_person', ''),
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
                'contact': structured_data['ship_to'].get('contact_person', ''),
                'contact_person': structured_data['ship_to'].get('contact_person', ''),
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
        
        if DEBUG:
            print(f"\nOPENAI STRUCTURING COMPLETE:")
            print(f"  SO Number: {structured_data.get('so_number', 'N/A')}")
            print(f"  Customer: {structured_data.get('customer_name', 'N/A')}")
            print(f"  Items: {len(structured_data.get('items', []))}")
            print(f"  Total: ${structured_data.get('total_amount', 0):.2f}")
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

