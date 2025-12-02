#!/usr/bin/env python3
"""
Generate comprehensive product list with packaging sizes and customers
Outputs to CSV and Excel formats
"""

import json
import os
import re
import csv
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Set, Any

# Try to import pandas for Excel export (optional)
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("⚠️  pandas not installed - will only generate CSV file")

# G: Drive base path
GDRIVE_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"

def load_data_from_gdrive():
    """Load data directly from G: Drive"""
    # Find latest folder
    if not os.path.exists(GDRIVE_BASE):
        print(f"❌ G: Drive not accessible at: {GDRIVE_BASE}")
        return None
    
    # Find latest date folder
    folders = [f for f in os.listdir(GDRIVE_BASE) if os.path.isdir(os.path.join(GDRIVE_BASE, f)) and re.match(r'\d{4}-\d{2}-\d{2}', f)]
    if not folders:
        print("❌ No date folders found in G: Drive")
        return None
    
    latest_folder = sorted(folders)[-1]
    folder_path = os.path.join(GDRIVE_BASE, latest_folder)
    print(f"📁 Using folder: {latest_folder}")
    
    data = {}
    
    # Load CustomAlert5.json (products)
    custom_alert5_path = os.path.join(folder_path, 'CustomAlert5.json')
    if os.path.exists(custom_alert5_path):
        with open(custom_alert5_path, 'r', encoding='utf-8') as f:
            data['CustomAlert5.json'] = json.load(f)
        print(f"✅ Loaded {len(data['CustomAlert5.json'])} products from CustomAlert5.json")
    else:
        print("⚠️  CustomAlert5.json not found")
        data['CustomAlert5.json'] = []
    
    # Load ManufacturingOrderHeaders.json (customers)
    moh_path = os.path.join(folder_path, 'ManufacturingOrderHeaders.json')
    if os.path.exists(moh_path):
        with open(moh_path, 'r', encoding='utf-8') as f:
            data['ManufacturingOrderHeaders.json'] = json.load(f)
        print(f"✅ Loaded {len(data['ManufacturingOrderHeaders.json'])} manufacturing orders")
    else:
        print("⚠️  ManufacturingOrderHeaders.json not found")
        data['ManufacturingOrderHeaders.json'] = []
    
    return data

def extract_packaging_size(item: Dict[str, Any]) -> str:
    """Extract packaging size from item description, item number, or stocking units"""
    packaging_info = []
    
    # Check Item No. for packaging (e.g., CASE10, CASE30)
    item_no = str(item.get('Item No.', '') or '').upper()
    if 'CASE' in item_no:
        case_match = re.search(r'CASE(\d+)', item_no)
        if case_match:
            packaging_info.append(f"Case{case_match.group(1)}")
    
    # Check Description for packaging info
    description = str(item.get('Description', '') or '').upper()
    
    # Look for weight-based packaging (17KG, 180KG, 230KG, etc.)
    weight_match = re.search(r'(\d+)\s*KG', description)
    if weight_match:
        packaging_info.append(f"{weight_match.group(1)}kg")
    
    # Look for packaging types
    packaging_types = ['DRUM', 'PAIL', 'CASE', 'GALLON', 'KEG', 'TUBE', 'BUCKET', 'CONTAINER']
    for pkg_type in packaging_types:
        if pkg_type in description:
            # Check if there's a number with it (e.g., CASE10, CASE30)
            pkg_match = re.search(rf'{pkg_type}(\d+)', description)
            if pkg_match:
                packaging_info.append(f"{pkg_type.lower().capitalize()}{pkg_match.group(1)}")
            else:
                packaging_info.append(pkg_type.lower().capitalize())
    
    # Check Stocking Units
    stocking_units = str(item.get('Stocking Units', '') or '').upper()
    if stocking_units and stocking_units not in ['EA', 'EACH', '']:
        if stocking_units not in [p.upper() for p in packaging_info]:
            packaging_info.append(stocking_units)
    
    # Check Purchasing Units
    purchasing_units = str(item.get('Purchasing Units', '') or '').upper()
    if purchasing_units and purchasing_units not in ['EA', 'EACH', ''] and purchasing_units != stocking_units:
        if purchasing_units not in [p.upper() for p in packaging_info]:
            packaging_info.append(purchasing_units)
    
    # Return unique packaging info, joined
    unique_packaging = []
    seen = set()
    for pkg in packaging_info:
        pkg_upper = pkg.upper()
        if pkg_upper not in seen:
            seen.add(pkg_upper)
            unique_packaging.append(pkg)
    
    return ', '.join(unique_packaging) if unique_packaging else 'N/A'

def extract_customers(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract unique customers from ManufacturingOrderHeaders"""
    customers = {}
    mo_headers = data.get('ManufacturingOrderHeaders.json', [])
    
    for mo in mo_headers:
        customer_name = mo.get('Customer') or ''
        if isinstance(customer_name, str):
            customer_name = customer_name.strip()
        else:
            customer_name = str(customer_name).strip() if customer_name else ''
        
        if not customer_name or customer_name == '' or customer_name == 'Internal':
            continue
        
        # Normalize customer name (remove extra spaces, standardize)
        normalized = ' '.join(customer_name.split())
        
        if normalized not in customers:
            customers[normalized] = {
                'Customer Name': normalized,
                'Original Name': customer_name,
                'Total Orders': 0,
                'Last Order Date': None
            }
        
        customers[normalized]['Total Orders'] += 1
        
        # Track latest order date
        order_date = mo.get('Order Date', '')
        if order_date:
            if not customers[normalized]['Last Order Date'] or order_date > customers[normalized]['Last Order Date']:
                customers[normalized]['Last Order Date'] = order_date
    
    return sorted(customers.values(), key=lambda x: x['Customer Name'])

def extract_products_with_packaging(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract all products with packaging information"""
    products = []
    items = data.get('CustomAlert5.json', [])
    
    for item in items:
        item_no = item.get('Item No.', '') or ''
        description = item.get('Description', '') or ''
        stocking_units = item.get('Stocking Units', '') or ''
        purchasing_units = item.get('Purchasing Units', '') or ''
        unit_weight = item.get('Unit Weight', '') or ''
        packaging_size = extract_packaging_size(item)
        
        products.append({
            'Item No.': item_no,
            'Description': description,
            'Stocking Units': stocking_units,
            'Purchasing Units': purchasing_units,
            'Unit Weight': unit_weight,
            'Packaging Size': packaging_size,
            'Status': item.get('Status', '') or '',
            'Item Type': item.get('Item Type', '') or '',
            'Stock': item.get('Stock', 0) or 0,
            'Recent Cost': item.get('Recent Cost', '') or '',
            'Standard Cost': item.get('Standard Cost', '') or ''
        })
    
    return sorted(products, key=lambda x: x['Item No.'])

def generate_csv_report(products: List[Dict], customers: List[Dict], output_file: str):
    """Generate CSV report with products and customers"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        
        # Header
        writer.writerow(['CANOIL PRODUCT AND CUSTOMER LIST'])
        writer.writerow([f'Generated: {timestamp}'])
        writer.writerow([])
        
        # Products Section
        writer.writerow(['=' * 80])
        writer.writerow(['PRODUCTS WITH PACKAGING SIZES'])
        writer.writerow(['=' * 80])
        writer.writerow([])
        
        if products:
            # Product headers
            product_headers = ['Item No.', 'Description', 'Packaging Size', 'Stocking Units', 
                            'Purchasing Units', 'Unit Weight', 'Status', 'Item Type', 
                            'Stock', 'Recent Cost', 'Standard Cost']
            writer.writerow(product_headers)
            
            # Product data
            for product in products:
                writer.writerow([
                    product.get('Item No.', ''),
                    product.get('Description', ''),
                    product.get('Packaging Size', ''),
                    product.get('Stocking Units', ''),
                    product.get('Purchasing Units', ''),
                    product.get('Unit Weight', ''),
                    product.get('Status', ''),
                    product.get('Item Type', ''),
                    product.get('Stock', 0),
                    product.get('Recent Cost', ''),
                    product.get('Standard Cost', '')
                ])
        else:
            writer.writerow(['No products found'])
        
        writer.writerow([])
        writer.writerow([])
        
        # Customers Section
        writer.writerow(['=' * 80])
        writer.writerow(['CUSTOMERS'])
        writer.writerow(['=' * 80])
        writer.writerow([])
        
        if customers:
            # Customer headers
            customer_headers = ['Customer Name', 'Total Orders', 'Last Order Date']
            writer.writerow(customer_headers)
            
            # Customer data
            for customer in customers:
                writer.writerow([
                    customer.get('Customer Name', ''),
                    customer.get('Total Orders', 0),
                    customer.get('Last Order Date', '') or 'N/A'
                ])
        else:
            writer.writerow(['No customers found'])
        
        writer.writerow([])
        writer.writerow(['=' * 80])
        writer.writerow([f'Total Products: {len(products)}'])
        writer.writerow([f'Total Customers: {len(customers)}'])
        writer.writerow([f'Report Generated: {timestamp}'])
    
    print(f"✅ CSV report generated: {output_file}")

def generate_excel_report(products: List[Dict], customers: List[Dict], output_file: str):
    """Generate Excel report with products and customers (if pandas available)"""
    if not HAS_PANDAS:
        print("⚠️  pandas not available - skipping Excel generation")
        return
    
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        # Products sheet
        if products:
            df_products = pd.DataFrame(products)
            df_products.to_excel(writer, sheet_name='Products', index=False)
        else:
            pd.DataFrame({'Message': ['No products found']}).to_excel(writer, sheet_name='Products', index=False)
        
        # Customers sheet
        if customers:
            df_customers = pd.DataFrame(customers)
            df_customers.to_excel(writer, sheet_name='Customers', index=False)
        else:
            pd.DataFrame({'Message': ['No customers found']}).to_excel(writer, sheet_name='Customers', index=False)
        
        # Summary sheet
        summary_data = {
            'Metric': ['Total Products', 'Total Customers', 'Generated'],
            'Value': [len(products), len(customers), timestamp]
        }
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Summary', index=False)
    
    print(f"✅ Excel report generated: {output_file}")

def generate_json_report(products: List[Dict], customers: List[Dict], output_file: str):
    """Generate well-organized JSON report with structured data"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Organize products by packaging type
    products_by_packaging = defaultdict(list)
    products_by_type = defaultdict(list)
    products_by_status = defaultdict(list)
    
    for product in products:
        packaging = product.get('Packaging Size', 'N/A')
        item_type = product.get('Item Type', 'N/A')
        status = product.get('Status', 'N/A')
        
        products_by_packaging[packaging].append(product)
        products_by_type[item_type].append(product)
        products_by_status[status].append(product)
    
    # Organize customers by order count ranges
    customers_by_orders = {
        'high_volume': [],  # 50+ orders
        'medium_volume': [],  # 10-49 orders
        'low_volume': [],  # 1-9 orders
    }
    
    for customer in customers:
        order_count = customer.get('Total Orders', 0)
        if order_count >= 50:
            customers_by_orders['high_volume'].append(customer)
        elif order_count >= 10:
            customers_by_orders['medium_volume'].append(customer)
        else:
            customers_by_orders['low_volume'].append(customer)
    
    # Build structured JSON
    json_data = {
        'metadata': {
            'generated': timestamp,
            'total_products': len(products),
            'total_customers': len(customers),
            'data_source': 'G: Drive - CustomAlert5.json & ManufacturingOrderHeaders.json'
        },
        'products': {
            'all': products,
            'by_packaging': {k: v for k, v in sorted(products_by_packaging.items())},
            'by_type': {k: v for k, v in sorted(products_by_type.items())},
            'by_status': {k: v for k, v in sorted(products_by_status.items())},
            'packaging_types': sorted(set(p.get('Packaging Size', 'N/A') for p in products)),
            'item_types': sorted(set(p.get('Item Type', 'N/A') for p in products)),
            'statuses': sorted(set(p.get('Status', 'N/A') for p in products))
        },
        'customers': {
            'all': customers,
            'by_volume': {
                'high_volume': {
                    'count': len(customers_by_orders['high_volume']),
                    'customers': sorted(customers_by_orders['high_volume'], 
                                      key=lambda x: x.get('Total Orders', 0), reverse=True)
                },
                'medium_volume': {
                    'count': len(customers_by_orders['medium_volume']),
                    'customers': sorted(customers_by_orders['medium_volume'], 
                                      key=lambda x: x.get('Total Orders', 0), reverse=True)
                },
                'low_volume': {
                    'count': len(customers_by_orders['low_volume']),
                    'customers': sorted(customers_by_orders['low_volume'], 
                                      key=lambda x: x.get('Total Orders', 0), reverse=True)
                }
            },
            'statistics': {
                'total_orders': sum(c.get('Total Orders', 0) for c in customers),
                'average_orders_per_customer': round(sum(c.get('Total Orders', 0) for c in customers) / len(customers), 2) if customers else 0,
                'customers_with_50_plus_orders': len(customers_by_orders['high_volume']),
                'customers_with_10_plus_orders': len(customers_by_orders['high_volume']) + len(customers_by_orders['medium_volume'])
            }
        },
        'summary': {
            'unique_packaging_types': len(set(p.get('Packaging Size', 'N/A') for p in products)),
            'unique_item_types': len(set(p.get('Item Type', 'N/A') for p in products)),
            'active_products': len([p for p in products if p.get('Status', '').upper() == 'ACTIVE']),
            'total_stock_value': sum(float(str(p.get('Stock', 0) or 0).replace(',', '')) * 
                                   float(str(p.get('Recent Cost', '0') or '0').replace('$', '').replace(',', '') or 0) 
                                   for p in products if p.get('Recent Cost') and p.get('Stock'))
        }
    }
    
    # Write JSON file with pretty formatting
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"✅ JSON report generated: {output_file}")

def main():
    """Main function"""
    print("=" * 80)
    print("CANOIL PRODUCT AND CUSTOMER LIST GENERATOR")
    print("=" * 80)
    print()
    
    # Load data
    print("📥 Loading data from G: Drive...")
    data = load_data_from_gdrive()
    
    if not data:
        print("❌ Failed to load data")
        return
    
    # Extract products with packaging
    print("\n📦 Extracting products with packaging information...")
    products = extract_products_with_packaging(data)
    print(f"✅ Found {len(products)} products")
    
    # Extract customers
    print("\n👥 Extracting customers...")
    customers = extract_customers(data)
    print(f"✅ Found {len(customers)} unique customers")
    
    # Generate reports
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    csv_file = f'CANOIL_PRODUCT_CUSTOMER_LIST_{timestamp}.csv'
    excel_file = f'CANOIL_PRODUCT_CUSTOMER_LIST_{timestamp}.xlsx'
    json_file = f'CANOIL_PRODUCT_CUSTOMER_LIST_{timestamp}.json'
    
    print(f"\n📄 Generating reports...")
    generate_csv_report(products, customers, csv_file)
    
    if HAS_PANDAS:
        generate_excel_report(products, customers, excel_file)
    
    generate_json_report(products, customers, json_file)
    
    print("\n" + "=" * 80)
    print("✅ REPORT GENERATION COMPLETE")
    print("=" * 80)
    print(f"📄 CSV File: {csv_file}")
    if HAS_PANDAS:
        print(f"📊 Excel File: {excel_file}")
    print(f"📋 JSON File: {json_file} (organized structure)")
    print()

if __name__ == '__main__':
    main()

