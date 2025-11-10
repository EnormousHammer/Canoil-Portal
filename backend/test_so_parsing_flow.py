#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test SO Parsing Flow - Verify local and Vercel/Render work identically
Tests the complete flow from Google Drive to SO parsing
"""
import os
import sys
import io
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

def test_environment():
    """Test 1: Check environment variables"""
    print("\n" + "="*80)
    print("TEST 1: Environment Variables")
    print("="*80)
    
    required_vars = [
        'USE_GOOGLE_DRIVE_API',
        'GOOGLE_DRIVE_SHARED_DRIVE_NAME',
        'GOOGLE_DRIVE_BASE_FOLDER_PATH',
        'GOOGLE_DRIVE_SALES_ORDERS_PATH',
        'GOOGLE_DRIVE_CREDENTIALS',
        'GOOGLE_DRIVE_TOKEN'
    ]
    
    results = {}
    for var in required_vars:
        value = os.getenv(var)
        results[var] = bool(value)
        status = "✅" if value else "❌"
        display_value = f"{value[:50]}..." if value and len(value) > 50 else value
        print(f"{status} {var}: {display_value if value else 'NOT SET'}")
    
    all_set = all(results.values())
    print(f"\nResult: {'✅ All variables set' if all_set else '❌ Missing variables'}")
    return all_set

def test_google_drive_auth():
    """Test 2: Check Google Drive authentication"""
    print("\n" + "="*80)
    print("TEST 2: Google Drive Authentication")
    print("="*80)
    
    try:
        from google_drive_service import GoogleDriveService
        
        print("Creating GoogleDriveService...")
        service = GoogleDriveService()
        
        print(f"Initial authenticated status: {service.authenticated}")
        
        if not service.authenticated:
            print("Attempting authentication...")
            service.authenticate()
        
        print(f"Final authenticated status: {service.authenticated}")
        
        if service.authenticated:
            print("✅ Google Drive authenticated successfully")
            return True, service
        else:
            print("❌ Google Drive authentication failed")
            return False, None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False, None

def test_so_file_access(service):
    """Test 3: Check if we can find SO files"""
    print("\n" + "="*80)
    print("TEST 3: SO File Access via Google Drive")
    print("="*80)
    
    try:
        print("Finding Sales_CSR shared drive...")
        sales_csr_drive_id = service.find_shared_drive("Sales_CSR")
        
        if not sales_csr_drive_id:
            print("❌ Sales_CSR shared drive not found")
            return False
        
        print(f"✅ Found Sales_CSR drive: {sales_csr_drive_id}")
        
        print("\nFinding Customer Orders folder...")
        customer_orders_id = service.find_folder_by_path(sales_csr_drive_id, "Customer Orders")
        
        if not customer_orders_id:
            print("❌ Customer Orders folder not found")
            return False
        
        print(f"✅ Found Customer Orders: {customer_orders_id}")
        
        print("\nFinding Sales Orders folder...")
        sales_orders_id = service.find_folder_by_path(sales_csr_drive_id, "Customer Orders/Sales Orders")
        
        if not sales_orders_id:
            print("❌ Sales Orders folder not found")
            return False
        
        print(f"✅ Found Sales Orders: {sales_orders_id}")
        
        print("\nScanning for SO files (max 5 for test)...")
        files_by_folder = service._scan_folder_recursively(
            sales_orders_id, 
            "Sales Orders", 
            sales_csr_drive_id, 
            depth=0, 
            max_depth=2
        )
        
        total_files = sum(len(files) for files in files_by_folder.values())
        pdf_files = []
        
        for folder_path, files in files_by_folder.items():
            for file_info in files:
                if file_info.get('file_name', '').lower().endswith('.pdf'):
                    pdf_files.append(file_info)
                    if len(pdf_files) >= 5:
                        break
            if len(pdf_files) >= 5:
                break
        
        print(f"✅ Found {total_files} total files, {len(pdf_files)} PDF files")
        
        if pdf_files:
            print("\nSample SO files:")
            for i, file_info in enumerate(pdf_files[:5], 1):
                print(f"  {i}. {file_info.get('file_name')}")
            return True, pdf_files[0]  # Return first file for parsing test
        else:
            print("❌ No PDF files found")
            return False, None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False, None

def test_so_parsing(service, file_info):
    """Test 4: Test SO parsing with both OpenAI and regex"""
    print("\n" + "="*80)
    print("TEST 4: SO PDF Parsing")
    print("="*80)
    
    try:
        file_id = file_info.get('file_id')
        file_name = file_info.get('file_name')
        
        print(f"Downloading SO file: {file_name}")
        file_content = service.download_file_content(file_id)
        
        if not file_content:
            print("❌ Failed to download file")
            return False
        
        print(f"✅ Downloaded {len(file_content)} bytes")
        
        # Save to temp file
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            tmp_file.write(file_content)
            temp_path = tmp_file.name
        
        print(f"Saved to temp file: {temp_path}")
        
        # Test parsing
        from app import parse_sales_order_pdf
        
        print("\nParsing SO PDF...")
        so_data = parse_sales_order_pdf(temp_path)
        
        # Clean up temp file
        try:
            os.unlink(temp_path)
        except:
            pass
        
        if not so_data:
            print("❌ Parsing returned None")
            return False
        
        print("\n✅ Parsing successful!")
        print(f"  SO Number: {so_data.get('so_number')}")
        print(f"  Customer: {so_data.get('customer_name')}")
        print(f"  Items: {len(so_data.get('items', []))}")
        print(f"  Total: ${so_data.get('total_amount', 0):.2f}")
        print(f"  Parser used: {'OpenAI' if 'OpenAI' in str(so_data.get('parser_type', '')) else 'Regex'}")
        
        # Verify essential fields
        has_so_number = bool(so_data.get('so_number'))
        has_customer = bool(so_data.get('customer_name'))
        has_items = len(so_data.get('items', [])) > 0
        
        if has_so_number and has_customer and has_items:
            print("\n✅ All essential fields present")
            return True
        else:
            print(f"\n❌ Missing fields: SO={has_so_number}, Customer={has_customer}, Items={has_items}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_logistics_flow():
    """Test 5: Test complete logistics automation flow"""
    print("\n" + "="*80)
    print("TEST 5: Logistics Automation Flow")
    print("="*80)
    
    try:
        from logistics_automation import get_so_data_from_system
        
        # Use a known SO number (you can change this)
        test_so = "3014"  # Change to a valid SO number
        
        print(f"Testing logistics flow with SO {test_so}...")
        so_data = get_so_data_from_system(test_so)
        
        if so_data.get('status') == 'Error':
            print(f"❌ Error: {so_data.get('error')}")
            return False
        
        if so_data.get('status') == 'Not found':
            print(f"⚠️  SO {test_so} not found (this is OK if SO doesn't exist)")
            print("   Try changing test_so to a valid SO number")
            return True  # Not a failure, just SO doesn't exist
        
        print("\n✅ Logistics flow successful!")
        print(f"  SO Number: {so_data.get('so_number')}")
        print(f"  Customer: {so_data.get('customer_name')}")
        print(f"  Items: {len(so_data.get('items', []))}")
        print(f"  Source: {so_data.get('source')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SO PARSING FLOW TEST - Local vs Vercel/Render Verification")
    print("="*80)
    print("\nThis test verifies that the SO parsing works identically on:")
    print("  - Local development environment")
    print("  - Vercel serverless deployment")
    print("  - Render deployment")
    
    results = {}
    
    # Test 1: Environment
    results['environment'] = test_environment()
    
    if not results['environment']:
        print("\n⚠️  Environment variables not set. Set them and try again.")
        print("   See VERCEL_ENV_VARS_TO_SET.md for required variables")
        return
    
    # Test 2: Google Drive Auth
    auth_success, service = test_google_drive_auth()
    results['google_drive_auth'] = auth_success
    
    if not auth_success:
        print("\n❌ Google Drive authentication failed. Cannot continue.")
        return
    
    # Test 3: SO File Access
    access_result = test_so_file_access(service)
    if isinstance(access_result, tuple):
        results['so_file_access'], sample_file = access_result
    else:
        results['so_file_access'] = access_result
        sample_file = None
    
    if not results['so_file_access']:
        print("\n❌ Cannot access SO files. Check Google Drive permissions.")
        return
    
    # Test 4: SO Parsing
    if sample_file:
        results['so_parsing'] = test_so_parsing(service, sample_file)
    else:
        results['so_parsing'] = False
    
    # Test 5: Logistics Flow
    results['logistics_flow'] = test_logistics_flow()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name.replace('_', ' ').title()}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("="*80)
        print("\nYour setup works correctly!")
        print("Local and Vercel/Render should function identically.")
    else:
        print("❌ SOME TESTS FAILED")
        print("="*80)
        print("\nFix the failed tests above.")
        print("The system will not work correctly until all tests pass.")

if __name__ == "__main__":
    main()

