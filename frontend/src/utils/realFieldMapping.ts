/**
 * REAL G: DRIVE FIELD MAPPING - BASED ON ACTUAL DATA STRUCTURE
 * This file contains the EXACT field names from the actual G: Drive JSON files
 * NO ASSUMPTIONS - ONLY REAL FIELD NAMES FROM USER-PROVIDED DATA
 */

export interface FieldMapping {
  [fileName: string]: string[];
}

// COMPLETE FIELD MAPPING FROM ALL 39 G: DRIVE FILES
export const REAL_FIELD_MAPPING: FieldMapping = {
  // FILES WITH DATA (20 FILES)
  
  // PRIMARY ITEM DATA SOURCE (32 fields) - MOST COMPLETE
  "CustomAlert5.json": [
    "Current BOM Revision",
    "Sales Item No.",
    "Item No.",
    "Description",
    "Item Type",
    "Status",
    "Serial/Lot Track Type",
    "Stocking Units",
    "Purchasing Units",
    "Units Conversion Factor",
    "Last Used Date",
    "Inventory Cycle",
    "Reference",
    "Unit Weight",
    "Pick Sequence",
    "Human Resource",
    "Lot Dispensation Method",
    "Lot Size",
    "Minimum",
    "Maximum",
    "Reorder Level",
    "Reorder Quantity",
    "Cumulative Variance",
    "Recent Cost",        // PRIMARY COST SOURCE
    "Standard Cost",      // SECONDARY COST SOURCE
    "Average Cost",       // TERTIARY COST SOURCE
    "Landed Cost",
    "Stock",             // PRIMARY STOCK SOURCE
    "WIP",
    "Reserve",
    "On Order",
    "Unit Cost"          // FALLBACK COST SOURCE
  ],

  // JOB DATA (12 fields)
  "Jobs.json": [
    "Job No.",
    "Description",
    "Account Set",
    "G/L Segment Code",
    "Status",
    "Document Path",
    "Accumulated Stock Cost",
    "Accumulated WIP Cost",
    "Accumulated Reserve Cost",
    "Accumulated On Order Cost",
    "Accumulated Used Cost",
    "Accumulated Received Cost"
  ],

  // JOB DETAILS (18 fields)
  "JobDetails.json": [
    "Job No.",
    "Item No.",
    "Part No.",
    "Location No.",
    "Type",
    "Stock Quantity",
    "WIP Qty",
    "Reserve Qty",
    "On Order Qty",
    "Used Qty",
    "Received Qty",
    "Accumulated Stock Cost",
    "Accumulated WIP Cost",
    "Accumulated Reserve Cost",
    "Accumulated On Order Cost",
    "Accumulated Used Cost",
    "Accumulated Received Cost"
  ],

  // BOM DETAILS (12 fields)
  "BillOfMaterialDetails.json": [
    "Parent Item No.",
    "Revision No.",
    "Uniquifier",
    "Line",
    "Detail Type",
    "Component Item No.",
    "Required Quantity",
    "Lead (Days)",
    "Comment",
    "Operation No.",
    "Source Location",
    "Alternative Items"
  ],

  // BOM HEADERS (25 fields)
  "BillsOfMaterial.json": [
    "Item No.",
    "Revision No.",
    "Cost Rollup Enabled",
    "Burden Rate",
    "Build Quantity",
    "Auto-build",
    "Last Maintained",
    "Comment",
    "Author",
    "ECO No.",
    "Allow Effective Date Override",
    "Document Path",
    "Assembly Lead",
    "Revision Comment",
    "ECO Document Path",
    "Units Per Lead",
    "Revision Date",
    "Effective From",
    "Effective To",
    "Allocated",
    "Reserved",
    "Maximum Lead",
    "Operation Count",
    "Instructions",
    "Label",
    "Formulation"
  ],

  // ITEMS WITH STOCK (1 field)
  "Items_with_stock.json": [
    "Description"
  ],

  // PURCHASE ORDER ADDITIONAL COSTS TAXES (37 fields)
  "PurchaseOrderAdditionalCostsTaxes.json": [
    "Address 1",
    "Address 2",
    "Address 3",
    "Address 4",
    "City",
    "Class Type - supplier",
    "Contact",
    "Country",
    "Currency",
    "Date Match",
    "E-mail",
    "Fax",
    "Name",
    "Purchase Order Id",
    "Purchase Order Revision",
    "Rate",
    "Rate Date",
    "Rate Operator",
    "Rate Type",
    "Spread",
    "State/Province",
    "Supplier No.",
    "Tax Authority 1",
    "Tax Authority 2",
    "Tax Authority 3",
    "Tax Authority 4",
    "Tax Authority 5",
    "Tax Class 1",
    "Tax Class 2",
    "Tax Class 3",
    "Tax Class 4",
    "Tax Class 5",
    "Tax Group",
    "Telephone",
    "Terms",
    "Trans Type - purchase",
    "Zip/Postal"
  ],

  // WORK ORDER DETAILS (23 fields)
  "WorkOrderDetails.json": [
    "Allocated",
    "BOM Revision No.",
    "Check Late Ship",
    "Comment",
    "Completed",
    "Current Completion Date",
    "Current Start Date",
    "Customer",
    "Entry No.",
    "Initial Completion Date",
    "Initial Start Date",
    "Item No.",
    "Job No.",
    "Line No.",
    "Location No.",
    "Manufacturing Order No.",
    "Ordered",
    "Reserved",
    "Sales Location",
    "Sales Order Detail No.",
    "Sales Order No.",
    "Sales Order Ship Date",
    "Sales Transfer Quantity",
    "Status",
    "Work Order No."
  ],

  // WORK ORDERS (13 fields)
  "WorkOrders.json": [
    "Created By",
    "Description",
    "Document Path",
    "Job No.",
    "Last Maintained",
    "Location No.",
    "On Hold",
    "Priority",
    "Release Date",
    "Released By",
    "Sales Order No.",
    "Status",
    "Work Order No."
  ],

  // PURCHASE ORDER DETAIL ADDITIONAL COSTS (19 fields)
  "PurchaseOrderDetailAdditionalCosts.json": [
    "Additional Cost",
    "Amount",
    "Amount (Home Currency)",
    "Date",
    "Description",
    "Extended Price",
    "Extended Weight",
    "Include",
    "PO Cost Line No.",
    "PO Line No.",
    "PO No.",
    "PO Revision",
    "Processed",
    "Prorated Quantity",
    "Source Currency",
    "Supplier",
    "Tax Amount (Home Currency)",
    "Tax Amount",
    "Unit Price"
  ],

  // PURCHASE ORDER ADDITIONAL COSTS (52 fields)
  "PurchaseOrderAdditionalCosts.json": [
    "A/P Invoice Account No.",
    "Additional Cost",
    "Amount",
    "Amount Invoiced",
    "Amount To Prorate",
    "Class Type - items",
    "Comment",
    "Currency",
    "Currency Rate",
    "Date",
    "Description",
    "Invoice No.",
    "Invoiced",
    "Line",
    "Operator",
    "Proration Method",
    "Purchase Order Id",
    "Purchase Order Revision",
    "Status",
    "Supplier",
    "Tax Amount",
    "Tax Amount 1",
    "Tax Amount 2",
    "Tax Amount 3",
    "Tax Amount 4",
    "Tax Amount 5",
    "Tax Authority 1",
    "Tax Authority 2",
    "Tax Authority 3",
    "Tax Authority 4",
    "Tax Authority 5",
    "Tax Base 1",
    "Tax Base 2",
    "Tax Base 3",
    "Tax Base 4",
    "Tax Base 5",
    "Tax Class 1",
    "Tax Class 2",
    "Tax Class 3",
    "Tax Class 4",
    "Tax Class 5",
    "Tax Included 1",
    "Tax Included 2",
    "Tax Included 3",
    "Tax Included 4",
    "Tax Included 5",
    "Tax Rate 1",
    "Tax Rate 2",
    "Tax Rate 3",
    "Tax Rate 4",
    "Tax Rate 5",
    "Trans Type - purchase",
    "Uniquifier"
  ],

  // MIBOMD - BOM DETAILS ABBREVIATED (12 fields)
  "MIBOMD.json": [
    "bomItem",           // Parent Item
    "bomRev",            // Revision
    "bomEntry",
    "lineNbr",
    "dType",
    "partId",            // Component Item
    "qty",               // Required Quantity
    "lead",
    "cmnt",
    "opCode",
    "srcLoc",
    "altItems"
  ],

  // MIBOMH - BOM HEADERS ABBREVIATED (26 fields)
  "MIBOMH.json": [
    "bomItem",           // Item No.
    "bomRev",            // Revision
    "rollup",
    "mult",
    "yield",
    "autoBuild",
    "lstMainDt",         // Last Maintained
    "descr",             // Description
    "author",
    "ecoNum",
    "ovride",
    "docPath",
    "assyLead",
    "revCmnt",
    "ecoDocPath",
    "qPerLead",
    "revDt",
    "effStartDt",
    "effEndDt",
    "totQWip",
    "totQRes",
    "maxLead",
    "opCnt",
    "custFld1",
    "custFld2",
    "custFld3"
  ],

  // MIJOBD - JOB DETAILS ABBREVIATED (17 fields)
  "MIJOBD.json": [
    "jobId",
    "jobItem",
    "part",
    "locId",
    "type",
    "qStk",
    "qWip",
    "qRes",
    "qOrd",
    "qUsed",
    "qRecd",
    "cStk",
    "cWip",
    "cRes",
    "cOrd",
    "cUsed",
    "cRecd"
  ],

  // MIJOBH - JOB HEADERS ABBREVIATED (12 fields)
  "MIJOBH.json": [
    "jobId",
    "jobName",
    "class",
    "segId",
    "status",
    "docPath",
    "totCStk",
    "totCWip",
    "totCRes",
    "totCOrd",
    "totCUsed",
    "totCRecd"
  ],

  // MIPODC - PURCHASE ORDER DETAIL COSTS ABBREVIATED (19 fields)
  "MIPODC.json": [
    "addCostId",
    "amt",
    "fAmt",
    "poDt",
    "descr",
    "extPrice",
    "extWgt",
    "include",
    "pocId",
    "podLn",
    "pohId",
    "pohRev",
    "processed",
    "qty",
    "srcCur",
    "suplId",
    "fTaxAmt",
    "taxAmt",
    "price"
  ],

  // MIPOCV - PURCHASE ORDER COSTS VENDOR ABBREVIATED (34 fields)
  "MIPOCV.json": [
    "adr1",
    "adr2",
    "adr3",
    "adr4",
    "city",
    "classAxis",
    "contact",
    "country",
    "curId",
    "dateMatch",
    "email",
    "fax",
    "name",
    "pohId",
    "pohRev",
    "rate",
    "rateDt",
    "rateOper",
    "rateType",
    "spread",
    "state",
    "poSuplId",
    "taxCode1",
    "taxCode2",
    "taxCode3",
    "taxCode4",
    "taxCode5",
    "taxClass1",
    "taxClass2",
    "taxClass3",
    "taxClass4",
    "taxClass5",
    "txGroup",
    "phone",
    "terms",
    "tType",
    "zip"
  ],

  // MIWOH - WORK ORDER HEADERS ABBREVIATED (13 fields)
  "MIWOH.json": [
    "creator",
    "descr",
    "docPath",
    "jobId",
    "lstMaintDt",
    "locId",
    "onHold",
    "priority",
    "releaseDt",
    "releaser",
    "oeOrdNo",
    "status",
    "wohId"
  ],

  // MIPOC - PURCHASE ORDER COSTS ABBREVIATED (46 fields)
  "MIPOC.json": [
    "glAcct",
    "addCostId",
    "amt",
    "amtInvoiced",
    "amtProRate",
    "classAxis",
    "cmnt",
    "curId",
    "rate",
    "poDt",
    "descr",
    "invoiceNo",
    "invoiced",
    "lineNbr",
    "rateOper",
    "prorMeth",
    "pohId",
    "pohRev",
    "dStatus",
    "suplId",
    "taxAmt",
    "taxAmt1",
    "taxAmt2",
    "taxAmt3",
    "taxAmt4",
    "taxAmt5",
    "taxCode1",
    "taxCode2",
    "taxCode3",
    "taxCode4",
    "taxCode5",
    "taxBase1",
    "taxBase2",
    "taxBase3",
    "taxBase4",
    "taxBase5",
    "taxClass1",
    "taxClass2",
    "taxClass3",
    "taxClass4",
    "taxClass5",
    "taxIncl1",
    "taxIncl2",
    "taxIncl3",
    "taxIncl4",
    "taxIncl5",
    "taxRate1",
    "taxRate2",
    "taxRate3",
    "taxRate4",
    "taxRate5",
    "tType",
    "pocId"
  ],

  // MIWOD - WORK ORDER DETAILS ABBREVIATED (25 fields)
  "MIWOD.json": [
    "wipQty",
    "bomRev",
    "chkValidEndDt",
    "cmnt",
    "endQty",
    "realEndDt",
    "realStartDt",
    "customer",
    "wodId",
    "initEndDt",
    "initStartDt",
    "partId",
    "jobId",
    "lineNbr",
    "locId",
    "mohId",
    "reqQty",
    "resQty",
    "icLoc",
    "oeOrdDtLn",
    "oeOrdNo",
    "soShipDt",
    "icTransQty",
    "status",
    "wohId"
  ],

  // INVENTORY LOCATION DATA (DYNAMIC - VARIES BY IMPLEMENTATION)
  "MIILOC.json": [], // Enhanced location data - fields vary

  // SALES ORDERS DATA (FROM PDF SCANNING)
  "SalesOrderHeaders.json": [],
  "SalesOrderDetails.json": [],
  "SalesOrders.json": [], // Generated from PDF scanning

  // EMPTY FILES (19 FILES) - NO FIELD DATA
  "BillOfMaterialRoutingDetails.json": [],
  "Items.json": [],
  "Items_qty_keys.json": [],
  "Items_union_keys.json": [],
  "Items_default_keys.json": [],
  "ManufacturingOrderDetails.json": [],
  "ManufacturingOrderRoutings.json": [],
  "ManufacturingOrderHeaders.json": [],
  "PurchaseOrders.json": [],
  "PurchaseOrderDetails.json": [],
  "MIMOH.json": [],
  "MIITEM.json": [],
  "MIBORD.json": [],
  "PurchaseOrderExtensions.json": [],
  "MIMORD.json": [],
  "MIPOH.json": [],
  "MIMOMD.json": [],
  "MIPOD.json": [],
  "MIPOHX.json": []
};

// PRIMARY DATA SOURCES - PREFER THESE OVER ALTERNATIVES
export const PRIMARY_DATA_SOURCES = {
  ITEMS: "CustomAlert5.json",           // 37 fields - MOST COMPLETE
  BOM_DETAILS: "MIBOMD.json",          // 12 fields - ABBREVIATED BUT COMPLETE
  BOM_HEADERS: "MIBOMH.json",          // 26 fields - ABBREVIATED BUT COMPLETE  
  JOBS: "Jobs.json",                   // 16 fields - FULL FIELD NAMES
  JOB_DETAILS: "JobDetails.json",      // 18 fields - FULL FIELD NAMES
  WORK_ORDERS: "WorkOrders.json",      // 14 fields - FULL FIELD NAMES
  WORK_ORDER_DETAILS: "WorkOrderDetails.json"  // 23 fields - FULL FIELD NAMES
} as const;

// FIELD MAPPING FOR COMMON OPERATIONS
export const ITEM_FIELDS = {
  NUMBER: "Item No.",
  DESCRIPTION: "Description", 
  STOCK: "Stock",
  RECENT_COST: "Recent Cost",
  STANDARD_COST: "Standard Cost",
  UNIT_COST: "Unit Cost",
  WIP: "WIP",
  RESERVE: "Reserve",
  ON_ORDER: "On Order",
  REORDER_LEVEL: "Reorder Level",
  REORDER_QUANTITY: "Reorder Quantity"
} as const;

export const BOM_FIELDS = {
  PARENT_ITEM: "bomItem",
  COMPONENT_ITEM: "partId", 
  REQUIRED_QTY: "qty",
  REVISION: "bomRev",
  LEAD_TIME: "lead",
  COMMENT: "cmnt"
} as const;

export const JOB_FIELDS = {
  JOB_NUMBER: "Job No.",
  DESCRIPTION: "Description",
  STATUS: "Status"
} as const;

// EMPTY FILES - DO NOT USE THESE
export const EMPTY_FILES = [
  "ManufacturingOrderHeaders.json",
  "ManufacturingOrderDetails.json", 
  "PurchaseOrders.json",
  "PurchaseOrderDetails.json",
  "Items.json",
  "Items_qty_keys.json",
  "Items_union_keys.json", 
  "Items_default_keys.json",
  "ManufacturingOrderRoutings.json",
  "PurchaseOrderExtensions.json",
  "MIMORD.json",
  "MIPOH.json",
  "MIMOMD.json", 
  "MIPOD.json",
  "MIPOHX.json",
  "MIMOH.json",
  "MIITEM.json",
  "MIBORD.json",
  "BillOfMaterialRoutingDetails.json",
  // Sales order files are populated dynamically
  "SalesOrderHeaders.json",
  "SalesOrderDetails.json"
] as const;

/**
 * Get the primary data source for a specific data type
 */
export function getPrimaryDataSource(dataType: keyof typeof PRIMARY_DATA_SOURCES): string {
  return PRIMARY_DATA_SOURCES[dataType];
}

/**
 * Check if a file has data fields
 */
export function hasDataFields(fileName: string): boolean {
  return REAL_FIELD_MAPPING[fileName] && REAL_FIELD_MAPPING[fileName].length > 0;
}

/**
 * Get all field names for a specific file
 */
export function getFieldNames(fileName: string): string[] {
  return REAL_FIELD_MAPPING[fileName] || [];
}

/**
 * Validate if a field exists in a specific file
 */
export function fieldExists(fileName: string, fieldName: string): boolean {
  const fields = getFieldNames(fileName);
  return fields.includes(fieldName);
}
