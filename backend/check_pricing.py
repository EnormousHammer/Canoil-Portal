#!/usr/bin/env python3
"""
Check recent purchase prices and vendor information for PR system
"""

import json
import os
from dotenv import load_dotenv
load_dotenv()

GDRIVE_BASE = os.getenv('GDRIVE_BASE', 'G:/Shared drives/IT_Automation/MiSys/Misys Extracted Data/API Extractions')
latest_folder = '2025-10-13'
folder_path = os.path.join(GDRIVE_BASE, latest_folder)

print('=== CHECKING PURCHASE ORDER DETAILS FOR PRICING ===')

# Load PO details
po_details_file = os.path.join(folder_path, 'PurchaseOrderDetails.json')
if os.path.exists(po_details_file):
    with open(po_details_file, 'r', encoding='utf-8') as f:
        po_details = json.load(f)
    
    print(f'Purchase Order Details: {len(po_details)} records')
    
    # Look for a specific item to see pricing structure
    sample_items = []
    for detail in po_details[:10]:  # First 10 records
        item_no = detail.get('Item No.', '')
        unit_price = detail.get('Unit Price', 0)
        if item_no and unit_price:
            sample_items.append({
                'item_no': item_no,
                'unit_price': unit_price,
                'po_no': detail.get('PO No.', ''),
                'supplier': detail.get('Supplier No.', ''),
                'description': detail.get('Description', '')
            })
    
    print('\nSample PO Details with pricing:')
    for item in sample_items[:5]:
        print(f'Item: {item["item_no"]} - Price: ${item["unit_price"]} - PO: {item["po_no"]} - Supplier: {item["supplier"]}')
        
    # Check if we can find recent prices for specific items
    print('\n=== CHECKING FOR RECENT PRICES ===')
    test_items = ['REOL32BGTDRM', 'REOL46XCDRM']  # Common items
    for test_item in test_items:
        recent_prices = []
        for detail in po_details:
            if detail.get('Item No.') == test_item:
                recent_prices.append({
                    'po_no': detail.get('PO No.'),
                    'unit_price': detail.get('Unit Price', 0),
                    'order_date': detail.get('Order Date', ''),
                    'supplier': detail.get('Supplier No.', '')
                })
        
        if recent_prices:
            # Sort by order date (most recent first)
            recent_prices.sort(key=lambda x: x.get('order_date', ''), reverse=True)
            latest = recent_prices[0]
            print(f'{test_item}: Latest price ${latest["unit_price"]} from PO {latest["po_no"]} on {latest["order_date"]} (Supplier: {latest["supplier"]})')
        else:
            print(f'{test_item}: No recent prices found')
else:
    print('PurchaseOrderDetails.json: NOT FOUND')

print('\n=== CHECKING VENDOR INFORMATION ===')
# Load suppliers
po_file = os.path.join(folder_path, 'PurchaseOrders.json')
if os.path.exists(po_file):
    with open(po_file, 'r', encoding='utf-8') as f:
        pos = json.load(f)
    
    print(f'Purchase Orders: {len(pos)} records')
    
    # Check for specific suppliers
    target_suppliers = ['BERLIN', 'PREMIER', 'LANXESS', 'ANDICOR']
    found_suppliers = {}
    
    for po in pos:
        supplier_no = po.get('Supplier No.', '')
        supplier_name = po.get('Name', '')
        if any(target in supplier_name.upper() for target in target_suppliers):
            if supplier_no not in found_suppliers:
                found_suppliers[supplier_no] = {
                    'name': supplier_name,
                    'contact': po.get('Contact', ''),
                    'phone': po.get('Phone', ''),
                    'email': po.get('Email', ''),
                    'terms': po.get('Terms', ''),
                    'po_count': 0
                }
            found_suppliers[supplier_no]['po_count'] += 1
    
    print('\nFound target suppliers:')
    for supplier_no, info in found_suppliers.items():
        print(f'{supplier_no}: {info["name"]} (Contact: {info["contact"]}, Phone: {info["phone"]}, {info["po_count"]} POs)')
else:
    print('PurchaseOrders.json: NOT FOUND')
