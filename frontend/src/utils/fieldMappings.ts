// Field mappings for MISys data - EXACTLY matching the LATEST folder (2025-08-26)
// NO FIELDS that don't exist in the actual data

import { formatDisplayDate } from './dateUtils';

// 🔥 SMART ITEM DATA STRATEGY:
// PRIMARY: CustomAlert5.json = Item info, Stock totals, Pricing, Basic location (Pick Sequence)
// SECONDARY: MIILOC.json = Enhanced location-specific stock details (when available)
// This replaces: Items.json, MIITEM.json (redundant now)

export const fieldMappings: Record<string, Record<string, string>> = {
  // 🎯 PRIMARY: CustomAlert5 (CustomAlert5.json) - EXACT PRODUCTION FIELD NAMES
  // ⚠️ CRITICAL: These are the EXACT field names from CustomAlert5.json - DO NOT MODIFY
  customAlert5: {
    "Average Cost": "Average Cost",
    "Cumulative Variance": "Cumulative Variance", 
    "Current BOM Revision": "Current BOM Revision",
    "Description": "Description",
    "Human Resource": "Human Resource",
    "Inventory Cycle": "Inventory Cycle",
    "Item No.": "Item No.",
    "Item Type": "Item Type",
    "Landed Cost": "Landed Cost",
    "Last Used Date": "Last Used Date",
    "Lot Dispensation Method": "Lot Dispensation Method",
    "Lot Size": "Lot Size",
    "Maximum": "Maximum",
    "Minimum": "Minimum",
    "On Order": "On Order",
    "Pick Sequence": "Pick Sequence",
    "Purchasing Units": "Purchasing Units",
    "Recent Cost": "Recent Cost",
    "Reference": "Reference",
    "Reorder Level": "Reorder Level",
    "Reorder Quantity": "Reorder Quantity",
    "Reserve": "Reserve",
    "Sales Item No.": "Sales Item No.",
    "Serial/Lot Track Type": "Serial/Lot Track Type",
    "Standard Cost": "Standard Cost",
    "Status": "Status",
    "Stock": "Stock",
    "Stocking Units": "Stocking Units",
    "Unit Cost": "Unit Cost",
    "Unit Weight": "Unit Weight",
    "Units Conversion Factor": "Units Conversion Factor",
    "WIP": "WIP"
  },

  // Work Orders (WorkOrders.json) - EXACT fields from 2025-08-26
  workOrders: {
    "Created By": 'Created By',
    "Description": 'Description',
    "Document Path": 'Document Path',
    "Job No.": 'Job No.',
    "Last Maintained": 'Last Maintained',
    "Location No.": 'Location No.',
    "On Hold": 'On Hold',
    "Priority": 'Priority',
    "Release Date": 'Release Date',
    "Released By": 'Released By',
    "Sales Order No.": 'Sales Order No.',
    "Status": 'Status',
    "Work Order No.": 'Work Order No.'
  },

  // Work Order Details (WorkOrderDetails.json) - EXACT fields from 2025-08-26
  workOrderDetails: {
    "Allocated": 'Allocated',
    "BOM Revision No.": 'BOM Revision No.',
    "Check Late Ship": 'Check Late Ship',
    "Comment": 'Comment',
    "Completed": 'Completed',
    "Current Completion Date": 'Current Completion Date',
    "Current Start Date": 'Current Start Date',
    "Customer": 'Customer',
    "Entry No.": 'Entry No.',
    "Initial Completion Date": 'Initial Completion Date',
    "Initial Start Date": 'Initial Start Date',
    "Item No.": 'Item No.',
    "Job No.": 'Job No.',
    "Line No.": 'Line No.',
    "Location No.": 'Location No.',
    "Manufacturing Order No.": 'Manufacturing Order No.',
    "Ordered": 'Ordered',
    "Reserved": 'Reserved',
    "Sales Location": 'Sales Location',
    "Sales Order Detail No.": 'Sales Order Detail No.',
    "Sales Order No.": 'Sales Order No.',
    "Sales Order Ship Date": 'Sales Order Ship Date',
    "Sales Transfer Quantity": 'Sales Transfer Quantity',
    "Status": 'Status',
    "Work Order No.": 'Work Order No.'
  },

  // Purchase Orders (PurchaseOrders.json) - EXACT fields from 2025-08-26
  purchaseOrders: {
    "A/P Batch No.": 'A/P Batch No.',
    "A/P Entry No.": 'A/P Entry No.',
    "Bill to Location": 'Bill to Location',
    "Buyer": 'Buyer',
    "Class Type - supplier": 'Class Type - supplier',
    "Close Date": 'Close Date',
    "Contact": 'Contact',
    "Date Match": 'Date Match',
    "Expedited Date": 'Expedited Date',
    "FOB": 'FOB',
    "Freight": 'Freight',
    "Home Currency": 'Home Currency',
    "Invoice Distribution Account": 'Invoice Distribution Account',
    "Invoice Distribution Code": 'Invoice Distribution Code',
    "Invoiced": 'Invoiced',
    "Rate": 'Rate',
    "Rate Date": 'Rate Date',
    "Rate Operator": 'Rate Operator',
    "Rate Type": 'Rate Type',
    "Total Received": 'Total Received',
    "Location No.": 'Location No.',
    "Ship Via": 'Ship Via',
    "Source Currency": 'Source Currency',
    "Spread": 'Spread',
    "PO Status": 'PO Status',
    "Invoice No.": 'Invoice No.',
    "Supplier No.": 'Supplier No.',
    "Tax Amount": 'Tax Amount',
    "Tax Amount 1": 'Tax Amount 1',
    "Tax Amount 2": 'Tax Amount 2',
    "Tax Amount 3": 'Tax Amount 3',
    "Tax Amount 4": 'Tax Amount 4',
    "Tax Amount 5": 'Tax Amount 5',
    "Tax Authority 1": 'Tax Authority 1',
    "Tax Authority 2": 'Tax Authority 2',
    "Tax Authority 3": 'Tax Authority 3',
    "Tax Authority 4": 'Tax Authority 4',
    "Tax Authority 5": 'Tax Authority 5',
    "Tax Base 1": 'Tax Base 1',
    "Tax Base 2": 'Tax Base 2',
    "Tax Base 3": 'Tax Base 3',
    "Tax Base 4": 'Tax Base 4',
    "Tax Base 5": 'Tax Base 5',
    "Tax Class 1": 'Tax Class 1',
    "Tax Class 2": 'Tax Class 2',
    "Tax Class 3": 'Tax Class 3',
    "Tax Class 4": 'Tax Class 4',
    "Tax Class 5": 'Tax Class 5',
    "Tax Group": 'Tax Group',
    "Tax Included 1": 'Tax Included 1',
    "Tax Included 2": 'Tax Included 2',
    "Tax Included 3": 'Tax Included 3',
    "Tax Included 4": 'Tax Included 4',
    "Tax Included 5": 'Tax Included 5',
    "Terms": 'Terms',
    "Total Additional Tax": 'Total Additional Tax',
    "Total Additional Cost": 'Total Additional Cost',
    "Total Ordered": 'Total Ordered',
    "Total Tax Amount": 'Total Tax Amount',
    "Trans Type - purchase": 'Trans Type - purchase'
  },

  // Purchase Order Details (PurchaseOrderDetails.json) - EXACT fields from 2025-08-26
  purchaseOrderDetails: {
    "Distribution No.": 'Distribution No.',
    "Account No.": 'Account No.',
    "Additional Cost": 'Additional Cost',
    "Class Type - items": 'Class Type - items',
    "Comment": 'Comment',
    "Real Due Date": 'Real Due Date',
    "Rate": 'Rate',
    "Description": 'Description',
    "PO Detail No.": 'PO Detail No.',
    "Detail Type": 'Detail Type',
    "Initial Due Date": 'Initial Due Date',
    "Invoiced": 'Invoiced',
    "Cost Invoiced": 'Cost Invoiced',
    "Quantity Invoiced": 'Quantity Invoiced',
    "Item No.": 'Item No.',
    "Job No.": 'Job No.',
    "Last Received Date": 'Last Received Date',
    "Line No.": 'Line No.',
    "Location No.": 'Location No.',
    "Manufacturer No.": 'Manufacturer No.',
    "Manufacturing Order No.": 'Manufacturing Order No.',
    "Manufacturing Order Detail No.": 'Manufacturing Order Detail No.',
    "Rate Operator": 'Rate Operator',
    "Ordered": 'Ordered',
    "PO No.": 'PO No.',
    "PO Revision": 'PO Revision',
    "Promised Date": 'Promised Date',
    "PO Unit of Measure": 'PO Unit of Measure',
    "Received": 'Received',
    "Detail Status": 'Detail Status',
    "VI Code": 'VI Code',
    "Tax Amount 1": 'Tax Amount 1',
    "Tax Amount 2": 'Tax Amount 2',
    "Tax Amount 3": 'Tax Amount 3',
    "Tax Amount 4": 'Tax Amount 4',
    "Tax Amount 5": 'Tax Amount 5',
    "Tax Authority 1": 'Tax Authority 1',
    "Tax Authority 2": 'Tax Authority 2',
    "Tax Authority 3": 'Tax Authority 3',
    "Tax Authority 4": 'Tax Authority 4',
    "Tax Authority 5": 'Tax Authority 5',
    "Tax Base 1": 'Tax Base 1',
    "Tax Base 2": 'Tax Base 2',
    "Tax Base 3": 'Tax Base 3',
    "Tax Base 4": 'Tax Base 4',
    "Tax Base 5": 'Tax Base 5',
    "Tax Class 1": 'Tax Class 1',
    "Tax Class 2": 'Tax Class 2',
    "Tax Class 3": 'Tax Class 3',
    "Tax Class 4": 'Tax Class 4',
    "Tax Class 5": 'Tax Class 5',
    "Tax Included 1": 'Tax Included 1',
    "Tax Included 2": 'Tax Included 2',
    "Tax Included 3": 'Tax Included 3',
    "Tax Included 4": 'Tax Included 4',
    "Tax Included 5": 'Tax Included 5',
    "Tax Rate 1": 'Tax Rate 1',
    "Tax Rate 2": 'Tax Rate 2',
    "Tax Rate 3": 'Tax Rate 3',
    "Tax Rate 4": 'Tax Rate 4',
    "Tax Rate 5": 'Tax Rate 5',
    "Trans Type - purchase": 'Trans Type - purchase',
    "Cost": 'Cost',
    "Price": 'Price',
    "Unit Weight": 'Unit Weight',
    "PO Extra Stock": 'PO Extra Stock'
  },

  // Manufacturing Order Headers (ManufacturingOrderHeaders.json) - EXACT fields from 2025-08-26
  manufacturingOrderHeaders: {
    "Actual Labor Cost": 'Actual Labor Cost',
    "Actual Material Cost": 'Actual Material Cost',
    "Actual Overhead Cost": 'Actual Overhead Cost',
    "Allocated": 'Allocated',
    "Assembly No.": 'Assembly No.',
    "Assembly Revision": 'Assembly Revision',
    "Non-Stocked Build Item Description": 'Non-Stocked Build Item Description',
    "Build Item No.": 'Build Item No.',
    "Close Date": 'Close Date',
    "Completed": 'Completed',
    "Completion Date": 'Completion Date',
    "Cost Markup Factor": 'Cost Markup Factor',
    "Created By": 'Created By',
    "Cumulative Cost": 'Cumulative Cost',
    "Customer": 'Customer',
    "Description": 'Description',
    "Document Path": 'Document Path',
    "Header/Footer Text 1": 'Header/Footer Text 1',
    "Header/Footer Text 2": 'Header/Footer Text 2',
    "Header/Footer Text 3": 'Header/Footer Text 3',
    "Header/Footer Text 4": 'Header/Footer Text 4',
    "Job No.": 'Job No.',
    "Last Maintained": 'Last Maintained',
    "Location No.": 'Location No.',
    "Mfg. Order No.": 'Mfg. Order No.',
    "Not Stocked": 'Not Stocked',
    "Notes": 'Notes',
    "On Hold": 'On Hold',
    "Operation Count": 'Operation Count',
    "Order Date": 'Order Date',
    "Ordered": 'Ordered',
    "Print Status": 'Print Status',
    "Priority": 'Priority',
    "Projected Labor Cost": 'Projected Labor Cost',
    "Projected Material Cost": 'Projected Material Cost',
    "Projected Overhead Cost": 'Projected Overhead Cost',
    "Release Date": 'Release Date',
    "Release Order Quantity": 'Release Order Quantity',
    "Released By": 'Released By',
    "Reserved": 'Reserved',
    "Sales Item No.": 'Sales Item No.',
    "Sales Location": 'Sales Location',
    "Sales Order Detail No.": 'Sales Order Detail No.',
    "Sales Order No.": 'Sales Order No.',
    "Sales Order Ship Date": 'Sales Order Ship Date',
    "Sales Transfer Quantity": 'Sales Transfer Quantity',
    "Start Date": 'Start Date',
    "Status": 'Status',
    "Total Material Cost": 'Total Material Cost',
    "Total Scrap Cost": 'Total Scrap Cost',
    "Used Labor Cost": 'Used Labor Cost',
    "Used Material Cost": 'Used Material Cost',
    "Used Overhead Cost": 'Used Overhead Cost',
    "Validate Ship Date": 'Validate Ship Date',
    "Work Order Reference Count": 'Work Order Reference Count',
    "Formulation": 'Formulation',
    "Instructions": 'Instructions',
    "Label": 'Label'
  },

  // Bill of Material Details (BillOfMaterialDetails.json) - EXACT fields from 2025-08-26
  billOfMaterialDetails: {
    "Parent Item No.": 'Parent Item No.',
    "Revision No.": 'Revision No.',
    "Uniquifier": 'Uniquifier',
    "Line": 'Line',
    "Detail Type": 'Detail Type',
    "Component Item No.": 'Component Item No.',
    "Required Quantity": 'Required Quantity',
    "Lead (Days)": 'Lead (Days)',
    "Comment": 'Comment',
    "Operation No.": 'Operation No.',
    "Source Location": 'Source Location',
    "Alternative Items": 'Alternative Items'
  },

  // Purchase Order Extensions (PurchaseOrderExtensions.json) - EXACT fields from 2025-08-26
  purchaseOrderExtensions: {
    "PO No.": 'PO No.',
    "PO Revision": 'PO Revision',
    "Line No.": 'Line No.',
    "Extension Type": 'Extension Type',
    "Extension Value": 'Extension Value',
    "Extension Description": 'Extension Description'
  },

  // Purchase Order Additional Costs (PurchaseOrderAdditionalCosts.json) - EXACT fields from 2025-08-26
  purchaseOrderAdditionalCosts: {
    "A/P Invoice Account No.": 'A/P Invoice Account No.',
    "Additional Cost": 'Additional Cost',
    "Amount": 'Amount',
    "Amount Invoiced": 'Amount Invoiced',
    "Amount To Prorate": 'Amount To Prorate',
    "Class Type - items": 'Class Type - items',
    "Comment": 'Comment',
    "Currency": 'Currency',
    "Currency Rate": 'Currency Rate',
    "Date": 'Date',
    "Description": 'Description',
    "Invoice No.": 'Invoice No.',
    "Invoiced": 'Invoiced',
    "Line": 'Line',
    "Operator": 'Operator',
    "Proration Method": 'Proration Method',
    "Purchase Order Id": 'Purchase Order Id',
    "Purchase Order Revision": 'Purchase Order Revision',
    "Status": 'Status',
    "Supplier": 'Supplier',
    "Tax Amount": 'Tax Amount',
    "Tax Amount 1": 'Tax Amount 1',
    "Tax Amount 2": 'Tax Amount 2',
    "Tax Amount 3": 'Tax Amount 3',
    "Tax Amount 4": 'Tax Amount 4',
    "Tax Amount 5": 'Tax Amount 5',
    "Tax Authority 1": 'Tax Authority 1',
    "Tax Authority 2": 'Tax Authority 2',
    "Tax Authority 3": 'Tax Authority 3',
    "Tax Authority 4": 'Tax Authority 4',
    "Tax Authority 5": 'Tax Authority 5',
    "Tax Base 1": 'Tax Base 1',
    "Tax Base 2": 'Tax Base 2',
    "Tax Base 3": 'Tax Base 3',
    "Tax Base 4": 'Tax Base 4',
    "Tax Base 5": 'Tax Base 5',
    "Tax Class 1": 'Tax Class 1',
    "Tax Class 2": 'Tax Class 2',
    "Tax Class 3": 'Tax Class 3',
    "Tax Class 4": 'Tax Class 4',
    "Tax Class 5": 'Tax Class 5',
    "Tax Included 1": 'Tax Included 1',
    "Tax Included 2": 'Tax Included 2',
    "Tax Included 3": 'Tax Included 3',
    "Tax Included 4": 'Tax Included 4',
    "Tax Included 5": 'Tax Included 5',
    "Tax Rate 1": 'Tax Rate 1',
    "Tax Rate 2": 'Tax Rate 2',
    "Tax Rate 3": 'Tax Rate 3',
    "Tax Rate 4": 'Tax Rate 4',
    "Tax Rate 5": 'Tax Rate 5',
    "Trans Type - purchase": 'Trans Type - purchase',
    "Uniquifier": 'Uniquifier'
  },

  // Purchase Order Additional Costs Taxes (PurchaseOrderAdditionalCostsTaxes.json) - EXACT fields from 2025-08-26
  purchaseOrderAdditionalCostsTaxes: {
    "Address 1": 'Address 1',
    "Address 2": 'Address 2',
    "Address 3": 'Address 3',
    "Address 4": 'Address 4',
    "City": 'City',
    "Class Type - supplier": 'Class Type - supplier',
    "Contact": 'Contact',
    "Country": 'Country',
    "Currency": 'Currency',
    "Date Match": 'Date Match',
    "E-mail": 'E-mail',
    "Fax": 'Fax',
    "Name": 'Name',
    "Purchase Order Id": 'Purchase Order Id',
    "Purchase Order Revision": 'Purchase Order Revision',
    "Rate": 'Rate',
    "Rate Date": 'Rate Date',
    "Rate Operator": 'Rate Operator',
    "Rate Type": 'Rate Type',
    "Spread": 'Spread',
    "State/Province": 'State/Province',
    "Supplier No.": 'Supplier No.',
    "Tax Authority 1": 'Tax Authority 1',
    "Tax Authority 2": 'Tax Authority 2',
    "Tax Authority 3": 'Tax Authority 3',
    "Tax Authority 4": 'Tax Authority 4',
    "Tax Authority 5": 'Tax Authority 5',
    "Tax Class 1": 'Tax Class 1',
    "Tax Class 2": 'Tax Class 2',
    "Tax Class 3": 'Tax Class 3',
    "Tax Class 4": 'Tax Class 4',
    "Tax Class 5": 'Tax Class 5',
    "Tax Group": 'Tax Group',
    "Telephone": 'Telephone',
    "Terms": 'Terms',
    "Trans Type - purchase": 'Trans Type - purchase',
    "Zip/Postal": 'Zip/Postal'
  },

  // Purchase Order Detail Additional Costs (PurchaseOrderDetailAdditionalCosts.json) - EXACT fields from 2025-08-26
  purchaseOrderDetailAdditionalCosts: {
    "Additional Cost": 'Additional Cost',
    "Amount": 'Amount',
    "Amount (Home Currency)": 'Amount (Home Currency)',
    "Date": 'Date',
    "Description": 'Description',
    "Extended Price": 'Extended Price',
    "Extended Weight": 'Extended Weight',
    "Include": 'Include',
    "PO Cost Line No.": 'PO Cost Line No.',
    "PO Line No.": 'PO Line No.',
    "PO No.": 'PO No.',
    "PO Revision": 'PO Revision',
    "Processed": 'Processed',
    "Prorated Quantity": 'Prorated Quantity',
    "Source Currency": 'Source Currency',
    "Supplier": 'Supplier',
    "Tax Amount (Home Currency)": 'Tax Amount (Home Currency)',
    "Tax Amount": 'Tax Amount',
    "Unit Price": 'Unit Price'
  },

  // 🔧 SECONDARY: MIILOC (Inventory Location) - Enhanced location-specific data
  // Used WITH CustomAlert5 for detailed location breakdowns
  miiloc: {
    "itemId": 'itemId',           // Item identifier
    "locId": 'locId',             // Location identifier  
    "pick": 'pick',               // Pick sequence
    "minLvl": 'minLvl',           // Minimum Level
    "maxLvl": 'maxLvl',           // Maximum Level
    "ordLvl": 'ordLvl',           // Reorder Level
    "ordQty": 'ordQty',           // Reorder Quantity
    "lstPIDate": 'lstPIDate',     // Last Physical Inventory Date (YYYYMMDD)
    "variance": 'variance',       // Variance amount
    "qStk": 'qStk',               // Stock Quantity
    "qWIP": 'qWIP',               // Work In Process Quantity
    "qRes": 'qRes',               // Reserved Quantity
    "qOrd": 'qOrd',               // On Order Quantity
    "iqStk": 'iqStk',             // Inspection Stock Quantity
    "iqWIP": 'iqWIP',             // Inspection WIP Quantity
    "iqRes": 'iqRes',             // Inspection Reserved Quantity
    "iqOrd": 'iqOrd',             // Inspection On Order Quantity
    "lstUseDate": 'lstUseDate',   // Last Use Date (YYYYMMDD)
    "fldXml": 'fldXml',           // Field XML data
    "lstPIDt": 'lstPIDt',         // Last Physical Inventory Date (MISys format)
    "lstUseDt": 'lstUseDt',       // Last Use Date (MISys format)
    "rowVer": 'rowVer',           // Row version array
    "custFld1": 'custFld1'        // Custom Field 1
  }
};

// Helper function to get user-friendly field name
export function getFieldLabel(tableName: string, fieldName: string): string {
  const tableMap = fieldMappings[tableName];
  if (!tableMap) return fieldName;
  
  return tableMap[fieldName] || fieldName;
}

// Helper function to format a value with its label
export function formatFieldWithLabel(tableName: string, fieldName: string, value: any): string {
  const label = getFieldLabel(tableName, fieldName);
  return `${label}: ${formatValue(value)}`;
}

// Helper function to format values
export function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Format currency fields - always use proper formatting with commas
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof value === 'string') {
    const formatted = formatDisplayDate(value);
    if (formatted !== '—') return formatted;
    return value;
  }
  return String(value);
}

// Status mappings - ONLY for fields that actually exist in 2025-08-26
export const statusMappings = {
  workOrderStatus: {
    0: 'Pending',
    1: 'Released',
    2: 'In Progress',
    3: 'Complete',
    4: 'Cancelled'
  },
  purchaseOrderStatus: {
    0: 'Open',
    1: 'Partial',
    2: 'Closed',
    3: 'Cancelled'
  },
  detailType: {
    0: 'Item',
    1: 'Non-Item',
    2: 'Comment',
    3: 'Cost'
  }
};

// Get formatted status
export function getFormattedStatus(fieldName: string, value: any): string {
  const mapping = statusMappings[fieldName as keyof typeof statusMappings];
  if (mapping && mapping[value as keyof typeof mapping]) {
    return mapping[value as keyof typeof mapping];
  }
  return formatValue(value);
}
