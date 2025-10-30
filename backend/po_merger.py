"""
Purchase Order Merger System
Combines all PO data from separate JSON files into complete merged records
Used for Purchase Requisitions and PO lookups
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Any

class PurchaseOrderMerger:
    """Merges Purchase Order data from multiple sources into complete records"""
    
    def __init__(self, data_folder_path: str):
        self.data_folder = data_folder_path
        self.po_headers = []
        self.po_details = []
        self.po_extensions = []
        self.po_additional_costs = []
        self.items = []
        
    def load_all_data(self):
        """Load all PO-related JSON files"""
        print(f"Loading data from: {self.data_folder}")
        
        # Load Purchase Order Headers
        po_file = os.path.join(self.data_folder, 'PurchaseOrders.json')
        if os.path.exists(po_file):
            with open(po_file, 'r', encoding='utf-8') as f:
                self.po_headers = json.load(f)
            print(f"[OK] Loaded {len(self.po_headers)} Purchase Orders")
        
        # Load Purchase Order Details
        pod_file = os.path.join(self.data_folder, 'PurchaseOrderDetails.json')
        if os.path.exists(pod_file):
            with open(pod_file, 'r', encoding='utf-8') as f:
                self.po_details = json.load(f)
            print(f"[OK] Loaded {len(self.po_details)} Purchase Order Details")
        
        # Load Purchase Order Extensions
        pox_file = os.path.join(self.data_folder, 'PurchaseOrderExtensions.json')
        if os.path.exists(pox_file):
            with open(pox_file, 'r', encoding='utf-8') as f:
                self.po_extensions = json.load(f)
            print(f"[OK] Loaded {len(self.po_extensions)} Purchase Order Extensions")
        
        # Load Purchase Order Additional Costs
        poac_file = os.path.join(self.data_folder, 'PurchaseOrderAdditionalCosts.json')
        if os.path.exists(poac_file):
            with open(poac_file, 'r', encoding='utf-8') as f:
                self.po_additional_costs = json.load(f)
            print(f"[OK] Loaded {len(self.po_additional_costs)} Additional Costs")
        
        # Load Items (for cost history)
        items_file = os.path.join(self.data_folder, 'Items.json')
        if os.path.exists(items_file):
            with open(items_file, 'r', encoding='utf-8') as f:
                self.items = json.load(f)
            print(f"[OK] Loaded {len(self.items)} Items")
        
        print(f"[OK] All data loaded successfully\n")
    
    def merge_single_po(self, po_number: str) -> Dict[str, Any]:
        """Merge all data for a single PO into one complete record"""
        
        # Get PO header
        po_header = next((po for po in self.po_headers if po['PO No.'] == po_number), None)
        if not po_header:
            return None
        
        # Get all line items for this PO
        line_items = [pod for pod in self.po_details if pod['PO No.'] == po_number]
        
        # Get extensions
        extension = next((ext for ext in self.po_extensions 
                         if ext.get('Purchase Order Header Id') == po_number), None)
        
        # Get additional costs
        add_costs = [ac for ac in self.po_additional_costs 
                    if ac.get('Purchase Order Id') == po_number]
        
        # Build complete merged record with field mapping at top
        merged_po = {
            "_FIELD_MAPPING": {
                "_README": "This section explains what each field contains and how to use it for automation/forms",
                "_USAGE": "Remove this _FIELD_MAPPING section before processing if your parser doesn't handle underscore keys",
                "PO_Number": "Unique Purchase Order identification number (string)",
                "Created_Date": "When this merged JSON was generated (ISO datetime)",
                "Data_Source": "Origin of this data - MISys API Extraction",
                "Supplier": {
                    "Supplier_No": "Supplier identifier code (use for lookups/matching)",
                    "Name": "Full legal supplier company name",
                    "Contact": "Primary contact person at supplier",
                    "Supplier_Invoice_No": "Supplier's invoice number (if invoiced)"
                },
                "Order_Info": {
                    "Buyer": "Employee name who created/placed this PO",
                    "Opened_By": "User who opened the PO in system",
                    "Order_Date": "Date PO was created (MISys date format: /Date(milliseconds)/)",
                    "Close_Date": "Date PO was closed/completed",
                    "Last_Maintained": "Last modification date",
                    "Status": "Status code: 0=Open, 1=Partial, 2=Closed, 3=Cancelled, 4=On Hold",
                    "Status_Description": "Human-readable status",
                    "Terms": "Payment terms (e.g., NET 30, NET 60)",
                    "PO_Revision": "Revision number of this PO",
                    "Print_Status": "Printing status code",
                    "Printed_Date": "Date PO was printed"
                },
                "Financial": {
                    "Total_Amount": "Total PO value in home currency (number)",
                    "Received_Amount": "Amount of goods/services received so far",
                    "Invoiced_Amount": "Amount that has been invoiced",
                    "Outstanding_Amount": "Remaining amount to be received (Total - Received)",
                    "Invoiced": "Boolean: Has this PO been invoiced?",
                    "Currency": {
                        "Home_Currency": "Your company's currency (e.g., CAD)",
                        "Source_Currency": "Supplier's billing currency (e.g., USD)",
                        "Exchange_Rate": "Conversion rate from Source to Home currency",
                        "Rate_Operator": "How rate is applied (1=multiply, 2=divide)",
                        "Rate_Type": "Type of exchange rate used",
                        "Rate_Date": "Date exchange rate was set",
                        "Spread": "Currency spread/margin"
                    },
                    "Tax": {
                        "Total_Tax": "Total tax amount",
                        "Tax_Group": "Tax group classification",
                        "Tax_Amount_1-5": "Individual tax amounts (up to 5 tax authorities)",
                        "Tax_Authority_1-5": "Tax authority identifiers"
                    },
                    "Additional_Costs": {
                        "Total": "Total additional costs (freight, duties, etc.)",
                        "Tax": "Tax on additional costs"
                    }
                },
                "Shipping_Billing": {
                    "Ship_Location": "Ship-to location code",
                    "Bill_to_Location": "Bill-to location code",
                    "Ship_Via": "Shipping method/carrier",
                    "FOB": "Free On Board terms",
                    "Freight": "Freight terms",
                    "Expedited_Date": "Expedited delivery date if rushed",
                    "Ship_To_Address": {
                        "Line_1-4": "Address lines for shipping destination",
                        "City": "Shipping city",
                        "State": "Shipping state/province",
                        "Postal_Code": "Shipping postal/zip code",
                        "Country": "Shipping country"
                    },
                    "Bill_To_Address": "Same structure as Ship_To_Address for billing"
                },
                "Line_Items": {
                    "_DESCRIPTION": "Array of products/services on this PO",
                    "Line_Number": "Sequential line number (1, 2, 3...)",
                    "Line_No": "System line number",
                    "Detail_No": "Detail record number",
                    "Item_No": "Product/item identifier - use for inventory lookups",
                    "Description": "Full product/service description",
                    "Comment": "Additional comments for this line",
                    "Pricing": {
                        "Unit_Cost": "Cost per unit on THIS PO (historical price)",
                        "Unit_Price": "List price per unit",
                        "Quantity_Ordered": "Quantity ordered",
                        "Quantity_Received": "Quantity received so far",
                        "Quantity_Invoiced": "Quantity that has been invoiced",
                        "Line_Total": "Total cost for this line (Unit_Cost × Quantity_Ordered)",
                        "Cost_Invoiced": "Amount invoiced for this line",
                        "Purchase_Unit_of_Measure": "Unit of measure: EA=Each, LB=Pound, GAL=Gallon, etc.",
                        "Additional_Cost": "Additional cost per unit",
                        "Additional_Cost_Total": "Total additional cost for line"
                    },
                    "Dates": {
                        "Initial_Due": "Original due/delivery date",
                        "Current_Due": "Current due date (may be updated)",
                        "Promised_Due": "Supplier promised delivery date",
                        "Last_Received": "Date goods were last received"
                    },
                    "Status": {
                        "Status_Code": "Line status: 0=Open, 1=Partial, 2=Closed, 3=Cancelled",
                        "Status_Description": "Human-readable line status",
                        "Invoiced": "Has this line been invoiced?"
                    },
                    "References": {
                        "Supplier_Item_No": "Supplier's product/item number",
                        "Manufacturer_No": "Manufacturer identifier",
                        "Job_No": "Associated job number (if job-related)",
                        "Mfg_Order_No": "Manufacturing order number (if applicable)"
                    },
                    "Location": {
                        "Location_No": "Inventory location receiving these goods"
                    },
                    "Item_Master": {
                        "_DESCRIPTION": "Additional product data from inventory master (if Item_No exists)",
                        "Description": "Master description from inventory system",
                        "Extended_Description": "Detailed product description",
                        "Cost_History": {
                            "PO_Unit_Cost": "Historical cost on THIS PO",
                            "Recent_Cost": "CURRENT/latest cost for this product - USE THIS FOR NEW REQUISITIONS",
                            "Standard_Cost": "Budgeted/standard cost",
                            "Average_Cost": "Moving average cost",
                            "Landed_Cost": "True cost including freight/duties",
                            "Cost_Variance_Amount": "Dollar change from PO cost to current (Recent - PO)",
                            "Cost_Variance_Percent": "Percentage change - IMPORTANT: Shows price inflation/deflation"
                        },
                        "Inventory": {
                            "Stocking_Units": "How item is stocked in inventory",
                            "Purchasing_Units": "How item is purchased from supplier",
                            "Units_Conversion_Factor": "Conversion between stocking and purchasing units",
                            "Minimum": "Minimum inventory level",
                            "Maximum": "Maximum inventory level",
                            "Reorder_Level": "When to reorder",
                            "Reorder_Quantity": "How much to order when reordering",
                            "Unit_Weight": "Weight per unit"
                        },
                        "Supplier_Preferences": {
                            "Preferred_Supplier": "Default supplier for this product - USE FOR AUTO-FILL",
                            "Preferred_Location": "Default inventory location",
                            "Preferred_Manufacturer": "Preferred manufacturer"
                        },
                        "Classification": {
                            "Item_Type": "Product type code",
                            "Status": "Item status in inventory system",
                            "Account_Set": "Accounting classification",
                            "Serial_Lot_Track_Type": "Tracking method (serial, lot, none)"
                        }
                    }
                },
                "Additional_Costs_Detail": {
                    "_DESCRIPTION": "Array of freight, duties, and other charges beyond product costs"
                },
                "Notes": "Free-form notes about this PO",
                "Document_Path": "Path to related documents",
                "Summary": {
                    "Number_of_Line_Items": "Total count of line items on this PO",
                    "Total_Items_Ordered": "Total quantity of all items ordered",
                    "Total_Items_Received": "Total quantity of all items received",
                    "Total_Items_Outstanding": "Quantity still to be received",
                    "Total_Line_Value": "Sum of all line totals",
                    "Fully_Received": "Boolean: Have all items been received?",
                    "Receipt_Percentage": "Percentage of items received (0-100)"
                }
            },
            "PO_Number": po_number,
            "Created_Date": datetime.now().isoformat(),
            "Data_Source": "MISys API Extraction",
            
            # Supplier Information
            "Supplier": {
                "Supplier_No": po_header.get('Supplier No.'),
                "Name": po_header.get('Name'),
                "Contact": po_header.get('Contact'),
                "Supplier_Invoice_No": po_header.get('Supplier Invoice No.')
            },
            
            # Order Information
            "Order_Info": {
                "Buyer": po_header.get('Buyer'),
                "Opened_By": po_header.get('Opened By'),
                "Order_Date": po_header.get('Order Date'),
                "Close_Date": po_header.get('Close Date'),
                "Last_Maintained": po_header.get('Last Maintained'),
                "Status": po_header.get('Status'),
                "Status_Description": self._get_status_description(po_header.get('Status')),
                "Terms": po_header.get('Terms'),
                "PO_Revision": po_header.get('PO Revision', 0),
                "Print_Status": po_header.get('Print Status'),
                "Printed_Date": po_header.get('Printed Date')
            },
            
            # Financial Information
            "Financial": {
                "Total_Amount": po_header.get('Total Amount', 0),
                "Received_Amount": po_header.get('Received Amount', 0),
                "Invoiced_Amount": po_header.get('Invoiced Amount', 0),
                "Outstanding_Amount": po_header.get('Total Amount', 0) - po_header.get('Received Amount', 0),
                "Invoiced": po_header.get('Invoiced', False),
                "Currency": {
                    "Home_Currency": po_header.get('Home Currency'),
                    "Source_Currency": po_header.get('Source Currency'),
                    "Exchange_Rate": po_header.get('Rate', 1),
                    "Rate_Operator": po_header.get('Rate Operator'),
                    "Rate_Type": po_header.get('Rate Type'),
                    "Rate_Date": po_header.get('Rate Date'),
                    "Spread": po_header.get('Spread', 0)
                },
                "Tax": {
                    "Total_Tax": po_header.get('Total Tax', 0),
                    "Tax_Group": po_header.get('Tax Group'),
                    "Tax_Amount_1": po_header.get('Tax Amount 1', 0),
                    "Tax_Amount_2": po_header.get('Tax Amount 2', 0),
                    "Tax_Amount_3": po_header.get('Tax Amount 3', 0),
                    "Tax_Amount_4": po_header.get('Tax Amount 4', 0),
                    "Tax_Amount_5": po_header.get('Tax Amount 5', 0),
                    "Tax_Authority_1": po_header.get('Tax Authority 1'),
                    "Tax_Authority_2": po_header.get('Tax Authority 2'),
                    "Tax_Authority_3": po_header.get('Tax Authority 3'),
                    "Tax_Authority_4": po_header.get('Tax Authority 4'),
                    "Tax_Authority_5": po_header.get('Tax Authority 5')
                },
                "Additional_Costs": {
                    "Total": po_header.get('Total Additional Cost(Hom)', 0),
                    "Tax": po_header.get('Total Additional Cost Tax(Hom)', 0)
                }
            },
            
            # Shipping and Billing
            "Shipping_Billing": {
                "Ship_Location": po_header.get('Ship Location'),
                "Bill_to_Location": po_header.get('Bill to Location'),
                "Ship_Via": po_header.get('Ship Via'),
                "FOB": po_header.get('FOB'),
                "Freight": po_header.get('Freight'),
                "Expedited_Date": po_header.get('Expedited Date')
            },
            
            # Line Items with full details
            "Line_Items": [],
            
            # Additional costs detail
            "Additional_Costs_Detail": add_costs,
            
            # Summary statistics
            "Summary": {}
        }
        
        # Add shipping/billing addresses if available
        if extension:
            merged_po["Shipping_Billing"]["Ship_To_Address"] = {
                "Line_1": extension.get('Ship to Line 1', ''),
                "Line_2": extension.get('Ship to Line 2', ''),
                "Line_3": extension.get('Ship to Line 3', ''),
                "Line_4": extension.get('Ship to Line 4', ''),
                "City": extension.get('Ship to City', ''),
                "State": extension.get('Ship to State', ''),
                "Postal_Code": extension.get('Ship to Postal Code', ''),
                "Country": extension.get('Ship to Country', '')
            }
            merged_po["Shipping_Billing"]["Bill_To_Address"] = {
                "Line_1": extension.get('Bill to Line 1', ''),
                "Line_2": extension.get('Bill to Line 2', ''),
                "Line_3": extension.get('Bill to Line 3', ''),
                "Line_4": extension.get('Bill to Line 4', ''),
                "City": extension.get('Bill to City', ''),
                "State": extension.get('Bill to State', ''),
                "Postal_Code": extension.get('Bill to Postal Code', ''),
                "Country": extension.get('Bill to Country', '')
            }
            merged_po["Notes"] = extension.get('Notes', '')
            merged_po["Document_Path"] = extension.get('Document Path', '')
        
        # Process each line item
        total_ordered = 0
        total_received = 0
        total_line_value = 0
        
        for idx, line in enumerate(line_items, 1):
            item_no = line.get('Item No.')
            
            # Get item master data
            item_data = None
            if item_no:
                item_data = next((item for item in self.items 
                                if item.get('Item No.') == item_no), None)
            
            line_item = {
                "Line_Number": idx,
                "Line_No": line.get('Line No.'),
                "Detail_No": line.get('Detail No.'),
                "Item_No": item_no,
                "Description": line.get('Description'),
                "Comment": line.get('Comment', ''),
                
                "Pricing": {
                    "Unit_Cost": line.get('Unit Cost', 0),
                    "Unit_Price": line.get('Unit Price', 0),
                    "Quantity_Ordered": line.get('Ordered', 0),
                    "Quantity_Received": line.get('Received', 0),
                    "Quantity_Invoiced": line.get('Invoiced Qty', 0),
                    "Line_Total": line.get('Unit Cost', 0) * line.get('Ordered', 0),
                    "Cost_Invoiced": line.get('Invoiced Cost', 0),
                    "Purchase_Unit_of_Measure": line.get('Purchase U/M'),
                    "Additional_Cost": line.get('Additional Cost', 0),
                    "Additional_Cost_Total": line.get('Additional Cost Total', 0)
                },
                
                "Dates": {
                    "Initial_Due": line.get('Initial Due'),
                    "Current_Due": line.get('Current Due'),
                    "Promised_Due": line.get('Promised Due'),
                    "Last_Received": line.get('Last Received')
                },
                
                "Status": {
                    "Status_Code": line.get('Status'),
                    "Status_Description": self._get_detail_status_description(line.get('Status')),
                    "Invoiced": line.get('Invoiced', 0)
                },
                
                "References": {
                    "Supplier_Item_No": line.get('Supplier Item No.', ''),
                    "Manufacturer_No": line.get('Manufacturer No.'),
                    "Job_No": line.get('Job No.'),
                    "Mfg_Order_No": line.get('Mfg. Order No.')
                },
                
                "Location": {
                    "Location_No": line.get('Location No.')
                }
            }
            
            # Add item master data if available
            if item_data:
                unit_cost = line.get('Unit Cost', 0)
                recent_cost = item_data.get('Recent Cost', 0)
                
                line_item["Item_Master"] = {
                    "Description": item_data.get('Description', ''),
                    "Extended_Description": item_data.get('Extended Description', ''),
                    
                    "Cost_History": {
                        "PO_Unit_Cost": unit_cost,
                        "Recent_Cost": recent_cost,
                        "Standard_Cost": item_data.get('Standard Cost', 0),
                        "Average_Cost": item_data.get('Average Cost', 0),
                        "Landed_Cost": item_data.get('Landed Cost', 0),
                        "Cost_Variance_Amount": recent_cost - unit_cost,
                        "Cost_Variance_Percent": round(((recent_cost - unit_cost) / unit_cost * 100) if unit_cost > 0 else 0, 2)
                    },
                    
                    "Inventory": {
                        "Stocking_Units": item_data.get('Stocking Units', ''),
                        "Purchasing_Units": item_data.get('Purchasing Units', ''),
                        "Units_Conversion_Factor": item_data.get('Units Conversion Factor', 1),
                        "Minimum": item_data.get('Minimum', 0),
                        "Maximum": item_data.get('Maximum', 0),
                        "Reorder_Level": item_data.get('Reorder Level', 0),
                        "Reorder_Quantity": item_data.get('Reorder Quantity', 0),
                        "Unit_Weight": item_data.get('Unit Weight', 0)
                    },
                    
                    "Supplier_Preferences": {
                        "Preferred_Supplier": item_data.get('Preferred Supplier Number', ''),
                        "Preferred_Location": item_data.get('Preferred Location Number', ''),
                        "Preferred_Manufacturer": item_data.get('Preferred Manufacturer No.', '')
                    },
                    
                    "Classification": {
                        "Item_Type": item_data.get('Item Type', 0),
                        "Status": item_data.get('Status', 0),
                        "Account_Set": item_data.get('Account Set', ''),
                        "Serial_Lot_Track_Type": item_data.get('Serial/Lot Track Type', 0)
                    }
                }
            
            merged_po["Line_Items"].append(line_item)
            
            # Update totals
            total_ordered += line.get('Ordered', 0)
            total_received += line.get('Received', 0)
            total_line_value += line.get('Unit Cost', 0) * line.get('Ordered', 0)
        
        # Add summary
        merged_po["Summary"] = {
            "Number_of_Line_Items": len(line_items),
            "Total_Items_Ordered": total_ordered,
            "Total_Items_Received": total_received,
            "Total_Items_Outstanding": total_ordered - total_received,
            "Total_Line_Value": round(total_line_value, 2),
            "Fully_Received": total_ordered == total_received and total_ordered > 0,
            "Receipt_Percentage": round((total_received / total_ordered * 100) if total_ordered > 0 else 0, 2)
        }
        
        return merged_po
    
    def merge_all_pos(self) -> List[Dict[str, Any]]:
        """Merge all POs into complete records"""
        print(f"Merging {len(self.po_headers)} purchase orders...")
        
        merged_pos = []
        for idx, po_header in enumerate(self.po_headers, 1):
            po_number = po_header['PO No.']
            
            if idx % 100 == 0:
                print(f"  Processing PO {idx}/{len(self.po_headers)}...")
            
            merged_po = self.merge_single_po(po_number)
            if merged_po:
                merged_pos.append(merged_po)
        
        print(f"[OK] Successfully merged {len(merged_pos)} purchase orders\n")
        return merged_pos
    
    def save_merged_pos(self, merged_pos: List[Dict[str, Any]], output_folder: str):
        """Save merged POs to JSON files"""
        
        # Create output folder if it doesn't exist
        os.makedirs(output_folder, exist_ok=True)
        
        # Save all POs to one large file
        all_pos_file = os.path.join(output_folder, 'ALL_PURCHASE_ORDERS_COMPLETE.json')
        with open(all_pos_file, 'w', encoding='utf-8') as f:
            json.dump(merged_pos, f, indent=2)
        print(f"[OK] Saved all POs to: {all_pos_file}")
        
        # Also save individual PO files for quick lookup
        individual_folder = os.path.join(output_folder, 'individual_pos')
        os.makedirs(individual_folder, exist_ok=True)
        
        for po in merged_pos:
            po_file = os.path.join(individual_folder, f"PO_{po['PO_Number']}.json")
            with open(po_file, 'w', encoding='utf-8') as f:
                json.dump(po, f, indent=2)
        
        print(f"[OK] Saved {len(merged_pos)} individual PO files to: {individual_folder}")
        
        # Create index file for quick lookups
        index = {
            "generated_date": datetime.now().isoformat(),
            "total_pos": len(merged_pos),
            "po_numbers": [po['PO_Number'] for po in merged_pos],
            "suppliers": list(set(po['Supplier']['Supplier_No'] for po in merged_pos if po['Supplier']['Supplier_No'])),
            "file_locations": {
                "all_pos": all_pos_file,
                "individual_folder": individual_folder
            }
        }
        
        index_file = os.path.join(output_folder, 'PO_INDEX.json')
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2)
        print(f"[OK] Created index file: {index_file}")
        print()
    
    def _get_status_description(self, status_code: int) -> str:
        """Get human-readable status description"""
        status_map = {
            0: "Open",
            1: "Partial",
            2: "Closed",
            3: "Cancelled",
            4: "On Hold"
        }
        return status_map.get(status_code, f"Unknown ({status_code})")
    
    def _get_detail_status_description(self, status_code: int) -> str:
        """Get human-readable detail status description"""
        status_map = {
            0: "Open",
            1: "Partial",
            2: "Closed",
            3: "Cancelled"
        }
        return status_map.get(status_code, f"Unknown ({status_code})")


def main():
    """Main execution"""
    print("=" * 80)
    print("PURCHASE ORDER MERGER SYSTEM")
    print("Creating complete merged PO records for Purchase Requisitions")
    print("=" * 80)
    print()
    
    # Configuration
    base_path = r"G:\Shared drives\IT_Automation\MiSys\Misys Extracted Data\API Extractions"
    latest_folder = "2025-10-13"  # This should be automatically detected
    
    # Get latest folder
    if os.path.exists(base_path):
        folders = [f for f in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, f))]
        if folders:
            latest_folder = max(folders)
    
    data_folder = os.path.join(base_path, latest_folder)
    output_folder = os.path.join(base_path, latest_folder, 'MERGED_POS')
    
    print(f"Source Data: {data_folder}")
    print(f"Output Folder: {output_folder}")
    print()
    
    # Create merger and process
    merger = PurchaseOrderMerger(data_folder)
    merger.load_all_data()
    
    merged_pos = merger.merge_all_pos()
    merger.save_merged_pos(merged_pos, output_folder)
    
    print("=" * 80)
    print("MERGE COMPLETE!")
    print("=" * 80)
    print()
    print("Files created:")
    print(f"  1. ALL_PURCHASE_ORDERS_COMPLETE.json - All POs in one file")
    print(f"  2. individual_pos/PO_XXXX.json - Individual files for each PO")
    print(f"  3. PO_INDEX.json - Quick lookup index")
    print()
    print("These files can now be used for:")
    print("  - Purchase Requisitions")
    print("  - PO Lookup systems")
    print("  - Cost analysis")
    print("  - Supplier performance tracking")
    print("=" * 80)


if __name__ == "__main__":
    main()

