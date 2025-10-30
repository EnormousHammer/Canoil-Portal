// MISys Data Types - EXACTLY matching the LATEST folder (2025-08-26)
// NO FIELDS that don't exist in the actual data

// Work Orders (MIWOH.json) - EXACT fields from 2025-08-26
export interface MISysWorkOrder {
  "Created By": string;
  "Description": string;
  "Document Path": string;
  "Job No.": string | null;
  "Last Maintained": string; // MISys date format
  "Location No.": string;
  "On Hold": boolean;
  "Priority": number;
  "Release Date": string; // MISys date format
  "Released By": string;
  "Sales Order No.": string;
  "Status": number;
  "Work Order No.": string;
}

// Work Order Details (MIWOD.json) - EXACT fields from 2025-08-26
export interface MISysWorkOrderDetail {
  "Allocated": number;
  "BOM Revision No.": string | null;
  "Check Late Ship": boolean;
  "Comment": string;
  "Completed": number;
  "Current Completion Date": string | null; // MISys date format
  "Current Start Date": string | null; // MISys date format
  "Customer": string;
  "Entry No.": number;
  "Initial Completion Date": string | null; // MISys date format
  "Initial Start Date": string | null; // MISys date format
  "Item No.": string;
  "Job No.": string | null;
  "Line No.": number;
  "Location No.": string;
  "Manufacturing Order No.": string | null;
  "Ordered": number;
  "Reserved": number;
  "Sales Location": string;
  "Sales Order Detail No.": string | null;
  "Sales Order No.": string | null;
  "Sales Order Ship Date": string | null; // MISys date format
  "Sales Transfer Quantity": number;
  "Status": number;
  "Work Order No.": string;
}

// Purchase Orders (MIPOH.json) - EXACT fields from 2025-08-26
export interface MISysPurchaseOrder {
  "A/P Batch No.": number;
  "A/P Entry No.": number;
  "Bill to Location": string;
  "Buyer": string;
  "Class Type - supplier": number;
  "Close Date": string; // MISys date format
  "Contact": string;
  "Date Match": number;
  "Expedited Date": string | null; // MISys date format
  "FOB": string;
  "Freight": string;
  "Home Currency": string;
  "Invoice Distribution Account": string | null;
  "Invoice Distribution Code": string;
  "Invoiced": boolean;
  "Rate": number;
  "Rate Date": string; // MISys date format
  "Rate Operator": number;
  "Rate Type": number;
  "Total Received": number;
  "Location No.": string;
  "Ship Via": string;
  "Source Currency": string;
  "Spread": number;
  "PO Status": number;
  "Invoice No.": string | null;
  "Supplier No.": string;
  "Tax Amount": number;
  "Tax Amount 1": number;
  "Tax Amount 2": number;
  "Tax Amount 3": number;
  "Tax Amount 4": number;
  "Tax Amount 5": number;
  "Tax Authority 1": string | null;
  "Tax Authority 2": string | null;
  "Tax Authority 3": string | null;
  "Tax Authority 4": string | null;
  "Tax Authority 5": string | null;
  "Tax Base 1": number;
  "Tax Base 2": number;
  "Tax Base 3": number;
  "Tax Base 4": number;
  "Tax Base 5": number;
  "Tax Class 1": number;
  "Tax Class 2": number;
  "Tax Class 3": number;
  "Tax Class 4": number;
  "Tax Class 5": number;
  "Tax Group": string;
  "Tax Included 1": boolean;
  "Tax Included 2": boolean;
  "Tax Included 3": boolean;
  "Tax Included 4": boolean;
  "Tax Included 5": boolean;
  "Terms": string;
  "Total Additional Tax": number;
  "Total Additional Cost": number;
  "Total Ordered": number;
  "Total Tax Amount": number;
  "Trans Type - purchase": number;
}

// Purchase Order Details (MIPOD.json) - EXACT fields from 2025-08-26
export interface MISysPurchaseOrderDetail {
  "Distribution No.": number;
  "Account No.": string;
  "Additional Cost": number;
  "Class Type - items": number;
  "Comment": string;
  "Real Due Date": string | null; // MISys date format
  "Rate": number;
  "Description": string;
  "PO Detail No.": number;
  "Detail Type": number;
  "Initial Due Date": string | null; // MISys date format
  "Invoiced": boolean;
  "Cost Invoiced": number;
  "Quantity Invoiced": number;
  "Item No.": string;
  "Job No.": string | null;
  "Last Received Date": string | null; // MISys date format
  "Line No.": number;
  "Location No.": string;
  "Manufacturer No.": string | null;
  "Manufacturing Order No.": string | null;
  "Manufacturing Order Detail No.": string | null;
  "Rate Operator": number;
  "Ordered": number;
  "PO No.": string;
  "PO Revision": number;
  "Promised Date": string | null; // MISys date format
  "PO Unit of Measure": string;
  "Received": number;
  "Detail Status": number;
  "VI Code": string;
  "Tax Amount 1": number;
  "Tax Amount 2": number;
  "Tax Amount 3": number;
  "Tax Amount 4": number;
  "Tax Amount 5": number;
  "Tax Authority 1": string | null;
  "Tax Authority 2": string | null;
  "Tax Authority 3": string | null;
  "Tax Authority 4": string | null;
  "Tax Authority 5": string | null;
  "Tax Base 1": number;
  "Tax Base 2": number;
  "Tax Base 3": number;
  "Tax Base 4": number;
  "Tax Base 5": number;
  "Tax Class 1": number;
  "Tax Class 2": number;
  "Tax Class 3": number;
  "Tax Class 4": number;
  "Tax Class 5": number;
  "Tax Included 1": boolean;
  "Tax Included 2": boolean;
  "Tax Included 3": boolean;
  "Tax Included 4": boolean;
  "Tax Included 5": boolean;
  "Tax Rate 1": number;
  "Tax Rate 2": number;
  "Tax Rate 3": number;
  "Tax Rate 4": number;
  "Tax Rate 5": number;
  "Trans Type - purchase": number;
  "Cost": number;
  "Price": number;
  "Unit Weight": number;
  "PO Extra Stock": number;
}

// Bill of Material Details (MIBOMD.json) - EXACT fields from 2025-08-26
export interface MISysBillOfMaterialDetail {
  "Parent Item No.": string;
  "Revision No.": string;
  "Uniquifier": number;
  "Line": number;
  "Detail Type": number;
  "Component Item No.": string;
  "Required Quantity": number;
  "Lead (Days)": number;
  "Comment": string;
  "Operation No.": string | null;
  "Source Location": string;
  "Alternative Items": number;
}

// Purchase Order Extensions (MIPOC.json) - EXACT fields from 2025-08-26
export interface MISysPurchaseOrderExtension {
  "PO No.": string;
  "PO Revision": number;
  "Line No.": number;
  "Extension Type": number;
  "Extension Value": string;
  "Extension Description": string;
}

// Purchase Order Additional Costs (MIPOCV.json) - EXACT fields from 2025-08-26
export interface MISysPurchaseOrderAdditionalCost {
  "A/P Invoice Account No.": string;
  "Additional Cost": string;
  "Amount": number;
  "Amount Invoiced": number;
  "Amount To Prorate": number;
  "Class Type - items": number;
  "Comment": string;
  "Currency": string;
  "Currency Rate": number;
  "Date": string; // MISys date format
  "Description": string;
  "Invoice No.": string;
  "Invoiced": boolean;
  "Line": number;
  "Operator": string;
  "Proration Method": number;
  "Purchase Order Id": string;
  "Purchase Order Revision": number;
  "Status": number;
  "Supplier": string;
  "Tax Amount": number;
  "Tax Amount 1": number;
  "Tax Amount 2": number;
  "Tax Amount 3": number;
  "Tax Amount 4": number;
  "Tax Amount 5": number;
  "Tax Authority 1": string | null;
  "Tax Authority 2": string | null;
  "Tax Authority 3": string | null;
  "Tax Authority 4": string | null;
  "Tax Authority 5": string | null;
  "Tax Base 1": number;
  "Tax Base 2": number;
  "Tax Base 3": number;
  "Tax Base 4": number;
  "Tax Base 5": number;
  "Tax Class 1": number;
  "Tax Class 2": number;
  "Tax Class 3": number;
  "Tax Class 4": number;
  "Tax Class 5": number;
  "Tax Included 1": boolean;
  "Tax Included 2": boolean;
  "Tax Included 3": boolean;
  "Tax Included 4": boolean;
  "Tax Included 5": boolean;
  "Tax Rate 1": number;
  "Tax Rate 2": number;
  "Tax Rate 3": number;
  "Tax Rate 4": number;
  "Tax Rate 5": number;
  "Trans Type - purchase": number;
  "Uniquifier": number;
}

// Purchase Order Detail Additional Costs (MIPODC.json) - EXACT fields from 2025-08-26
export interface MISysPurchaseOrderDetailAdditionalCost {
  "Additional Cost": string;
  "Amount": number;
  "Amount (Home Currency)": number;
  "Date": string; // MISys date format
  "Description": string;
  "Extended Price": number;
  "Extended Weight": number;
  "Include": boolean;
  "PO Cost Line No.": number;
  "PO Line No.": number;
  "PO No.": string;
  "PO Revision": number;
  "Processed": boolean;
  "Prorated Quantity": number;
  "Source Currency": string;
  "Supplier": string;
  "Tax Amount (Home Currency)": number;
  "Tax Amount": number;
  "Unit Price": number;
}

// Main data structure - ONLY the exact files that exist in 2025-08-26
export interface MISysData {
  // Work Orders
  workOrders: MISysWorkOrder[];
  workOrderDetails: MISysWorkOrderDetail[];
  
  // Purchase Orders
  purchaseOrders: MISysPurchaseOrder[];
  purchaseOrderDetails: MISysPurchaseOrderDetail[];
  purchaseOrderExtensions: MISysPurchaseOrderExtension[];
  purchaseOrderAdditionalCosts: MISysPurchaseOrderAdditionalCost[];
  purchaseOrderDetailAdditionalCosts: MISysPurchaseOrderDetailAdditionalCost[];
  
  // Bill of Materials
  billOfMaterialDetails: MISysBillOfMaterialDetail[];
  
  // Status
  loaded: boolean;
}
