#!/usr/bin/env python3
"""
Enhanced Purchase Requisition Service
Gets recent purchase prices and vendor information for PR generation
"""

import json
import os
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

GDRIVE_BASE = os.getenv('GDRIVE_BASE', 'G:/Shared drives/IT_Automation/MiSys/Misys Extracted Data/API Extractions')

def get_latest_folder():
    """Get latest data folder"""
    if not os.path.exists(GDRIVE_BASE):
        return None
    folders = [f for f in os.listdir(GDRIVE_BASE) if os.path.isdir(os.path.join(GDRIVE_BASE, f))]
    return max(folders) if folders else None

def get_recent_purchase_price(item_no, limit=5):
    """
    Get recent purchase prices for an item from PO details
    Returns list of recent purchases sorted by date (most recent first)
    """
    try:
        latest = get_latest_folder()
        if not latest:
            return []
        
        folder_path = os.path.join(GDRIVE_BASE, latest)
        po_details_file = os.path.join(folder_path, 'PurchaseOrderDetails.json')
        
        if not os.path.exists(po_details_file):
            return []
        
        with open(po_details_file, 'r', encoding='utf-8') as f:
            po_details = json.load(f)
        
        # Find all purchases for this item
        item_purchases = []
        for detail in po_details:
            if detail.get('Item No.') == item_no:
                purchase = {
                    'po_no': detail.get('PO No.', ''),
                    'unit_price': detail.get('Unit Price', 0),
                    'order_date': detail.get('Order Date', ''),
                    'supplier_no': detail.get('Supplier No.', ''),
                    'quantity': detail.get('Quantity', 0),
                    'total_amount': detail.get('Total Amount', 0),
                    'description': detail.get('Description', '')
                }
                item_purchases.append(purchase)
        
        # Sort by order date (most recent first)
        item_purchases.sort(key=lambda x: x.get('order_date', ''), reverse=True)
        
        return item_purchases[:limit]
        
    except Exception as e:
        print(f"Error getting recent prices for {item_no}: {e}")
        return []

def get_supplier_info(supplier_no):
    """
    Get supplier information from most recent PO
    """
    try:
        latest = get_latest_folder()
        if not latest:
            return None
        
        folder_path = os.path.join(GDRIVE_BASE, latest)
        po_file = os.path.join(folder_path, 'PurchaseOrders.json')
        
        if not os.path.exists(po_file):
            return None
        
        with open(po_file, 'r', encoding='utf-8') as f:
            pos = json.load(f)
        
        # Find most recent PO for this supplier
        supplier_pos = [po for po in pos if po.get('Supplier No.') == supplier_no]
        
        if not supplier_pos:
            return None
        
        # Sort by Order Date (most recent first)
        supplier_pos.sort(key=lambda x: x.get('Order Date', ''), reverse=True)
        most_recent_po = supplier_pos[0]
        
        return {
            'supplier_no': supplier_no,
            'name': most_recent_po.get('Name', ''),
            'contact': most_recent_po.get('Contact', ''),
            'phone': most_recent_po.get('Phone', ''),
            'email': most_recent_po.get('Email', ''),
            'terms': most_recent_po.get('Terms', ''),
            'po_count': len(supplier_pos),
            'last_order_date': most_recent_po.get('Order Date', ''),
            'last_po_no': most_recent_po.get('PO No.', '')
        }
        
    except Exception as e:
        print(f"Error getting supplier info for {supplier_no}: {e}")
        return None

def get_item_with_pricing(item_no):
    """
    Get item details with recent pricing information
    """
    try:
        latest = get_latest_folder()
        if not latest:
            return None
        
        folder_path = os.path.join(GDRIVE_BASE, latest)
        items_file = os.path.join(folder_path, 'Items.json')
        
        if not os.path.exists(items_file):
            return None
        
        with open(items_file, 'r', encoding='utf-8') as f:
            items = json.load(f)
        
        # Find the item
        item = next((i for i in items if i.get('Item No.') == item_no), None)
        if not item:
            return None
        
        # Get recent purchase prices
        recent_prices = get_recent_purchase_price(item_no, 3)
        
        # Get supplier info if preferred supplier exists
        supplier_info = None
        preferred_supplier = item.get('Preferred Supplier Number', '')
        if preferred_supplier:
            supplier_info = get_supplier_info(preferred_supplier)
        
        return {
            'item_no': item.get('Item No.'),
            'description': item.get('Description'),
            'recent_cost': item.get('Recent Cost', 0),
            'standard_cost': item.get('Standard Cost', 0),
            'preferred_supplier': preferred_supplier,
            'recent_prices': recent_prices,
            'supplier_info': supplier_info,
            'reorder_quantity': item.get('Reorder Quantity', 0),
            'minimum': item.get('Minimum', 0),
            'reorder_level': item.get('Reorder Level', 0)
        }
        
    except Exception as e:
        print(f"Error getting item with pricing for {item_no}: {e}")
        return None

# Test the functions
if __name__ == "__main__":
    print("=== TESTING ENHANCED PR SERVICE ===")
    
    # Test with a common item
    test_item = "REOL32BGTDRM"
    print(f"\nTesting item: {test_item}")
    
    item_data = get_item_with_pricing(test_item)
    if item_data:
        print(f"Item: {item_data['item_no']}")
        print(f"Description: {item_data['description']}")
        print(f"Recent Cost: ${item_data['recent_cost']}")
        print(f"Preferred Supplier: {item_data['preferred_supplier']}")
        
        if item_data['recent_prices']:
            print(f"\nRecent Purchase Prices:")
            for price in item_data['recent_prices']:
                print(f"  PO {price['po_no']}: ${price['unit_price']} on {price['order_date']} (Supplier: {price['supplier_no']})")
        
        if item_data['supplier_info']:
            supplier = item_data['supplier_info']
            print(f"\nSupplier Info:")
            print(f"  Name: {supplier['name']}")
            print(f"  Contact: {supplier['contact']}")
            print(f"  Phone: {supplier['phone']}")
            print(f"  Email: {supplier['email']}")
            print(f"  Terms: {supplier['terms']}")
            print(f"  PO Count: {supplier['po_count']}")
    else:
        print(f"Item {test_item} not found")
