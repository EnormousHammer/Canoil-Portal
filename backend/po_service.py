"""
Purchase Order Service API
Backend service to provide complete PO data for forms, requisitions, and lookups
"""

from flask import Blueprint, jsonify, request
import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional

# Create Blueprint for PO service
po_service = Blueprint('po_service', __name__)

# Configuration
GDRIVE_BASE = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"

# Field mapping with descriptions
FIELD_DESCRIPTIONS = {
    "PO_Number": {
        "type": "string",
        "description": "Unique Purchase Order number",
        "example": "2256",
        "required_for_forms": True,
        "editable": False
    },
    "Supplier": {
        "Supplier_No": {
            "type": "string",
            "description": "Supplier identification number",
            "example": "ANDICOR",
            "required_for_forms": True,
            "use_for": "Supplier dropdown/lookup"
        },
        "Name": {
            "type": "string",
            "description": "Full supplier company name",
            "example": "Andicor Specialty Chemicals Corp.",
            "required_for_forms": True,
            "use_for": "Display name on forms"
        },
        "Contact": {
            "type": "string",
            "description": "Primary contact person at supplier",
            "example": "JOANNE",
            "required_for_forms": False,
            "use_for": "Contact information"
        }
    },
    "Order_Info": {
        "Buyer": {
            "type": "string",
            "description": "Employee who placed the order",
            "example": "Shantanu_Gahlawat",
            "required_for_forms": True,
            "use_for": "Requisition approver/buyer field"
        },
        "Order_Date": {
            "type": "date",
            "description": "Date when PO was created",
            "example": "/Date(1588651200000)/",
            "required_for_forms": True,
            "use_for": "Order date on requisition"
        },
        "Terms": {
            "type": "string",
            "description": "Payment terms",
            "example": "NET 30",
            "required_for_forms": True,
            "use_for": "Payment terms field"
        },
        "Status": {
            "type": "integer",
            "description": "PO status code (0=Open, 1=Partial, 2=Closed, 3=Cancelled)",
            "example": 2,
            "required_for_forms": False,
            "use_for": "Status indicator"
        }
    },
    "Financial": {
        "Total_Amount": {
            "type": "number",
            "description": "Total PO amount in home currency",
            "example": 6209.28,
            "required_for_forms": True,
            "use_for": "Total cost display"
        },
        "Currency": {
            "Home_Currency": {
                "type": "string",
                "description": "Your company's currency",
                "example": "CAD",
                "required_for_forms": True,
                "use_for": "Currency display"
            },
            "Source_Currency": {
                "type": "string",
                "description": "Supplier's billing currency",
                "example": "USD",
                "required_for_forms": True,
                "use_for": "Original currency if different"
            },
            "Exchange_Rate": {
                "type": "number",
                "description": "Exchange rate if multi-currency",
                "example": 1.35,
                "required_for_forms": False,
                "use_for": "Currency conversion calculation"
            }
        }
    },
    "Shipping_Billing": {
        "Ship_To_Address": {
            "type": "object",
            "description": "Complete shipping address",
            "required_for_forms": True,
            "use_for": "Ship to address on requisition",
            "fields": ["Line_1", "Line_2", "City", "State", "Postal_Code", "Country"]
        },
        "Bill_To_Address": {
            "type": "object",
            "description": "Complete billing address",
            "required_for_forms": True,
            "use_for": "Bill to address on requisition",
            "fields": ["Line_1", "Line_2", "City", "State", "Postal_Code", "Country"]
        }
    },
    "Line_Items": {
        "type": "array",
        "description": "Array of products/services on this PO",
        "Item_No": {
            "type": "string",
            "description": "Product item number",
            "example": "ENGINEFLUSHCANS",
            "required_for_forms": True,
            "use_for": "Item lookup/selection"
        },
        "Description": {
            "type": "string",
            "description": "Product description",
            "example": "ENGINE FLUSH CANS (ADVANTAGE) ITEM# BM0583",
            "required_for_forms": True,
            "use_for": "Product description on requisition"
        },
        "Pricing": {
            "Unit_Cost": {
                "type": "number",
                "description": "Cost per unit on this PO",
                "example": 15.68,
                "required_for_forms": True,
                "use_for": "Unit price field"
            },
            "Quantity_Ordered": {
                "type": "number",
                "description": "Quantity ordered",
                "example": 396,
                "required_for_forms": True,
                "use_for": "Quantity field"
            },
            "Line_Total": {
                "type": "number",
                "description": "Total cost for this line (Unit_Cost * Quantity)",
                "example": 6209.28,
                "required_for_forms": True,
                "use_for": "Line total display"
            },
            "Purchase_Unit_of_Measure": {
                "type": "string",
                "description": "Unit of measure (EA, LB, GAL, etc)",
                "example": "EA",
                "required_for_forms": True,
                "use_for": "UOM field"
            }
        },
        "Item_Master": {
            "Cost_History": {
                "PO_Unit_Cost": {
                    "type": "number",
                    "description": "Historical cost on this PO",
                    "use_for": "Cost comparison"
                },
                "Recent_Cost": {
                    "type": "number",
                    "description": "Current/most recent cost",
                    "use_for": "Current pricing for new requisitions"
                },
                "Standard_Cost": {
                    "type": "number",
                    "description": "Budgeted/standard cost",
                    "use_for": "Budget comparison"
                },
                "Cost_Variance_Percent": {
                    "type": "number",
                    "description": "Percentage change from PO cost to current cost",
                    "use_for": "Price trend indicator"
                }
            },
            "Supplier_Preferences": {
                "Preferred_Supplier": {
                    "type": "string",
                    "description": "Default/preferred supplier for this item",
                    "use_for": "Auto-fill supplier on new requisitions"
                }
            }
        }
    }
}


class PurchaseOrderService:
    """Service class for PO data management"""
    
    def __init__(self):
        self.merged_pos_cache = None
        self.cache_timestamp = None
        self.index = None
    
    def get_latest_folder(self) -> Optional[str]:
        """Get the latest data folder"""
        if not os.path.exists(GDRIVE_BASE):
            return None
        
        folders = [f for f in os.listdir(GDRIVE_BASE) 
                  if os.path.isdir(os.path.join(GDRIVE_BASE, f))]
        return max(folders) if folders else None
    
    def get_merged_pos_folder(self) -> Optional[str]:
        """Get the merged POs folder path"""
        latest = self.get_latest_folder()
        if not latest:
            return None
        
        return os.path.join(GDRIVE_BASE, latest, 'MERGED_POS')
    
    def load_index(self) -> Dict[str, Any]:
        """Load the PO index"""
        folder = self.get_merged_pos_folder()
        if not folder or not os.path.exists(folder):
            return None
        
        index_file = os.path.join(folder, 'PO_INDEX.json')
        if not os.path.exists(index_file):
            return None
        
        with open(index_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def load_all_merged_pos(self) -> List[Dict[str, Any]]:
        """Load all merged POs from file"""
        folder = self.get_merged_pos_folder()
        if not folder or not os.path.exists(folder):
            return []
        
        all_pos_file = os.path.join(folder, 'ALL_PURCHASE_ORDERS_COMPLETE.json')
        if not os.path.exists(all_pos_file):
            return []
        
        with open(all_pos_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def load_single_po(self, po_number: str) -> Optional[Dict[str, Any]]:
        """Load a single PO by number"""
        folder = self.get_merged_pos_folder()
        if not folder or not os.path.exists(folder):
            return None
        
        po_file = os.path.join(folder, 'individual_pos', f'PO_{po_number}.json')
        if not os.path.exists(po_file):
            return None
        
        with open(po_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_po_for_requisition(self, po_number: str) -> Optional[Dict[str, Any]]:
        """Get PO data formatted for requisition forms"""
        po = self.load_single_po(po_number)
        if not po:
            return None
        
        # Extract only the fields needed for requisition
        requisition_data = {
            "PO_Number": po.get("PO_Number"),
            "Supplier": {
                "Supplier_No": po["Supplier"]["Supplier_No"],
                "Name": po["Supplier"]["Name"],
                "Contact": po["Supplier"]["Contact"]
            },
            "Buyer": po["Order_Info"]["Buyer"],
            "Order_Date": po["Order_Info"]["Order_Date"],
            "Terms": po["Order_Info"]["Terms"],
            "Currency": po["Financial"]["Currency"]["Home_Currency"],
            "Ship_To": po["Shipping_Billing"].get("Ship_To_Address", {}),
            "Bill_To": po["Shipping_Billing"].get("Bill_To_Address", {}),
            "Items": []
        }
        
        # Add line items with relevant info
        for item in po.get("Line_Items", []):
            req_item = {
                "Item_No": item.get("Item_No"),
                "Description": item.get("Description"),
                "Unit_Cost": item["Pricing"]["Unit_Cost"],
                "Quantity": item["Pricing"]["Quantity_Ordered"],
                "UOM": item["Pricing"]["Purchase_Unit_of_Measure"],
                "Line_Total": item["Pricing"]["Line_Total"]
            }
            
            # Add current cost if available
            if item.get("Item_Master") and item["Item_Master"].get("Cost_History"):
                req_item["Current_Cost"] = item["Item_Master"]["Cost_History"].get("Recent_Cost")
                req_item["Cost_Variance"] = item["Item_Master"]["Cost_History"].get("Cost_Variance_Percent")
            
            requisition_data["Items"].append(req_item)
        
        return requisition_data


# Initialize service
po_svc = PurchaseOrderService()


# API Routes

@po_service.route('/api/po/list', methods=['GET'])
def get_po_list():
    """Get list of all PO numbers"""
    try:
        index = po_svc.load_index()
        if not index:
            return jsonify({"error": "PO data not available. Run po_merger.py first."}), 404
        
        return jsonify({
            "total_pos": index["total_pos"],
            "po_numbers": index["po_numbers"],
            "generated_date": index["generated_date"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@po_service.route('/api/po/<po_number>', methods=['GET'])
def get_po(po_number):
    """Get complete data for a single PO"""
    try:
        po = po_svc.load_single_po(po_number)
        if not po:
            return jsonify({"error": f"PO {po_number} not found"}), 404
        
        return jsonify(po)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@po_service.route('/api/po/<po_number>/requisition', methods=['GET'])
def get_po_for_requisition(po_number):
    """Get PO data formatted for requisition forms"""
    try:
        req_data = po_svc.get_po_for_requisition(po_number)
        if not req_data:
            return jsonify({"error": f"PO {po_number} not found"}), 404
        
        return jsonify(req_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@po_service.route('/api/po/field-mapping', methods=['GET'])
def get_field_mapping():
    """Get field descriptions and mapping for forms"""
    return jsonify({
        "field_descriptions": FIELD_DESCRIPTIONS,
        "usage_guide": {
            "description": "Use this mapping to understand what each field contains and how to use it in forms",
            "required_for_requisition": [
                "PO_Number",
                "Supplier.Supplier_No",
                "Supplier.Name",
                "Order_Info.Buyer",
                "Order_Info.Terms",
                "Financial.Total_Amount",
                "Financial.Currency.Home_Currency",
                "Shipping_Billing.Ship_To_Address",
                "Line_Items[].Item_No",
                "Line_Items[].Description",
                "Line_Items[].Pricing.Unit_Cost",
                "Line_Items[].Pricing.Quantity_Ordered",
                "Line_Items[].Pricing.Purchase_Unit_of_Measure"
            ]
        }
    })


@po_service.route('/api/po/search', methods=['GET'])
def search_pos():
    """Search POs by supplier, date range, etc."""
    try:
        supplier = request.args.get('supplier')
        status = request.args.get('status')
        
        all_pos = po_svc.load_all_merged_pos()
        
        results = all_pos
        
        if supplier:
            results = [po for po in results 
                      if supplier.upper() in po['Supplier']['Supplier_No'].upper() 
                      or supplier.upper() in po['Supplier']['Name'].upper()]
        
        if status:
            results = [po for po in results 
                      if po['Order_Info']['Status'] == int(status)]
        
        # Return summary info
        summary = [{
            "PO_Number": po["PO_Number"],
            "Supplier": po["Supplier"]["Name"],
            "Total_Amount": po["Financial"]["Total_Amount"],
            "Status": po["Order_Info"]["Status_Description"],
            "Order_Date": po["Order_Info"]["Order_Date"],
            "Line_Items_Count": po["Summary"]["Number_of_Line_Items"]
        } for po in results]
        
        return jsonify({
            "count": len(summary),
            "results": summary
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@po_service.route('/api/po/suppliers', methods=['GET'])
def get_suppliers():
    """Get list of all suppliers from POs"""
    try:
        index = po_svc.load_index()
        if not index:
            return jsonify({"error": "PO data not available"}), 404
        
        all_pos = po_svc.load_all_merged_pos()
        
        suppliers = {}
        for po in all_pos:
            supp_no = po['Supplier']['Supplier_No']
            if supp_no and supp_no not in suppliers:
                suppliers[supp_no] = {
                    "Supplier_No": supp_no,
                    "Name": po['Supplier']['Name'],
                    "Contact": po['Supplier']['Contact'],
                    "PO_Count": 0,
                    "Total_Spend": 0
                }
            
            if supp_no:
                suppliers[supp_no]["PO_Count"] += 1
                suppliers[supp_no]["Total_Spend"] += po['Financial']['Total_Amount']
        
        return jsonify({
            "count": len(suppliers),
            "suppliers": list(suppliers.values())
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

