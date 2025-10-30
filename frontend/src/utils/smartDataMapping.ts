/**
 * SMART DATA MAPPING - AVOID DUPLICATE INFORMATION
 * Analysis of which files contain the SAME DATA with different field names
 * Based on REAL G: Drive field mapping provided by user
 */

export interface DataDuplication {
  primarySource: string;
  duplicateSources: string[];
  description: string;
  fieldMapping: {
    [primaryField: string]: {
      [fileName: string]: string;
    };
  };
}

// SMART DUPLICATE ANALYSIS - SAME DATA, DIFFERENT FIELD NAMES
export const DATA_DUPLICATIONS: DataDuplication[] = [
  {
    primarySource: "CustomAlert5.json",
    duplicateSources: [],
    description: "PRIMARY ITEM DATA - NO DUPLICATES (Most complete with 32 fields)",
    fieldMapping: {}
  },
  
  {
    primarySource: "Jobs.json", 
    duplicateSources: ["MIJOBH.json"],
    description: "JOB HEADERS - Full field names vs abbreviated",
    fieldMapping: {
      "Job No.": {
        "Jobs.json": "Job No.",
        "MIJOBH.json": "jobId"
      },
      "Description": {
        "Jobs.json": "Description", 
        "MIJOBH.json": "jobName"
      },
      "Status": {
        "Jobs.json": "Status",
        "MIJOBH.json": "status"
      },
      "Document Path": {
        "Jobs.json": "Document Path",
        "MIJOBH.json": "docPath"
      }
    }
  },

  {
    primarySource: "JobDetails.json",
    duplicateSources: ["MIJOBD.json"], 
    description: "JOB DETAILS - Full field names vs abbreviated",
    fieldMapping: {
      "Job No.": {
        "JobDetails.json": "Job No.",
        "MIJOBD.json": "jobId"
      },
      "Item No.": {
        "JobDetails.json": "Item No.",
        "MIJOBD.json": "jobItem"
      },
      "Part No.": {
        "JobDetails.json": "Part No.", 
        "MIJOBD.json": "part"
      },
      "Location No.": {
        "JobDetails.json": "Location No.",
        "MIJOBD.json": "locId"
      },
      "Type": {
        "JobDetails.json": "Type",
        "MIJOBD.json": "type"
      },
      "Stock Quantity": {
        "JobDetails.json": "Stock Quantity",
        "MIJOBD.json": "qStk"
      },
      "WIP Qty": {
        "JobDetails.json": "WIP Qty",
        "MIJOBD.json": "qWip"
      },
      "Reserve Qty": {
        "JobDetails.json": "Reserve Qty", 
        "MIJOBD.json": "qRes"
      },
      "On Order Qty": {
        "JobDetails.json": "On Order Qty",
        "MIJOBD.json": "qOrd"
      },
      "Used Qty": {
        "JobDetails.json": "Used Qty",
        "MIJOBD.json": "qUsed"
      },
      "Received Qty": {
        "JobDetails.json": "Received Qty",
        "MIJOBD.json": "qRecd"
      }
    }
  },

  {
    primarySource: "BillOfMaterialDetails.json",
    duplicateSources: ["MIBOMD.json"],
    description: "BOM DETAILS - Full field names vs abbreviated", 
    fieldMapping: {
      "Parent Item No.": {
        "BillOfMaterialDetails.json": "Parent Item No.",
        "MIBOMD.json": "bomItem"
      },
      "Component Item No.": {
        "BillOfMaterialDetails.json": "Component Item No.",
        "MIBOMD.json": "partId"
      },
      "Required Quantity": {
        "BillOfMaterialDetails.json": "Required Quantity",
        "MIBOMD.json": "qty"
      },
      "Revision No.": {
        "BillOfMaterialDetails.json": "Revision No.",
        "MIBOMD.json": "bomRev"
      },
      "Lead (Days)": {
        "BillOfMaterialDetails.json": "Lead (Days)",
        "MIBOMD.json": "lead"
      },
      "Comment": {
        "BillOfMaterialDetails.json": "Comment",
        "MIBOMD.json": "cmnt"
      }
    }
  },

  {
    primarySource: "BillsOfMaterial.json",
    duplicateSources: ["MIBOMH.json"],
    description: "BOM HEADERS - Full field names vs abbreviated",
    fieldMapping: {
      "Item No.": {
        "BillsOfMaterial.json": "Item No.",
        "MIBOMH.json": "bomItem"
      },
      "Revision No.": {
        "BillsOfMaterial.json": "Revision No.",
        "MIBOMH.json": "bomRev"
      },
      "Last Maintained": {
        "BillsOfMaterial.json": "Last Maintained",
        "MIBOMH.json": "lstMainDt"
      },
      "Comment": {
        "BillsOfMaterial.json": "Comment",
        "MIBOMH.json": "descr"
      },
      "Author": {
        "BillsOfMaterial.json": "Author", 
        "MIBOMH.json": "author"
      },
      "Document Path": {
        "BillsOfMaterial.json": "Document Path",
        "MIBOMH.json": "docPath"
      }
    }
  },

  {
    primarySource: "WorkOrders.json",
    duplicateSources: ["MIWOH.json"],
    description: "WORK ORDERS - Full field names vs abbreviated",
    fieldMapping: {
      "Work Order No.": {
        "WorkOrders.json": "Work Order No.",
        "MIWOH.json": "wohId"
      },
      "Description": {
        "WorkOrders.json": "Description",
        "MIWOH.json": "descr"
      },
      "Job No.": {
        "WorkOrders.json": "Job No.",
        "MIWOH.json": "jobId"
      },
      "Location No.": {
        "WorkOrders.json": "Location No.",
        "MIWOH.json": "locId"
      },
      "Status": {
        "WorkOrders.json": "Status",
        "MIWOH.json": "status"
      },
      "Priority": {
        "WorkOrders.json": "Priority",
        "MIWOH.json": "priority"
      },
      "Release Date": {
        "WorkOrders.json": "Release Date",
        "MIWOH.json": "releaseDt"
      },
      "Created By": {
        "WorkOrders.json": "Created By",
        "MIWOH.json": "creator"
      },
      "Released By": {
        "WorkOrders.json": "Released By", 
        "MIWOH.json": "releaser"
      },
      "Sales Order No.": {
        "WorkOrders.json": "Sales Order No.",
        "MIWOH.json": "oeOrdNo"
      }
    }
  },

  {
    primarySource: "WorkOrderDetails.json",
    duplicateSources: ["MIWOD.json"],
    description: "WORK ORDER DETAILS - Full field names vs abbreviated",
    fieldMapping: {
      "Work Order No.": {
        "WorkOrderDetails.json": "Work Order No.",
        "MIWOD.json": "wohId"
      },
      "Item No.": {
        "WorkOrderDetails.json": "Item No.",
        "MIWOD.json": "partId"
      },
      "Job No.": {
        "WorkOrderDetails.json": "Job No.",
        "MIWOD.json": "jobId"
      },
      "Location No.": {
        "WorkOrderDetails.json": "Location No.",
        "MIWOD.json": "locId"
      },
      "Sales Order No.": {
        "WorkOrderDetails.json": "Sales Order No.",
        "MIWOD.json": "oeOrdNo"
      },
      "Status": {
        "WorkOrderDetails.json": "Status",
        "MIWOD.json": "status"
      },
      "Ordered": {
        "WorkOrderDetails.json": "Ordered",
        "MIWOD.json": "reqQty"
      },
      "Completed": {
        "WorkOrderDetails.json": "Completed",
        "MIWOD.json": "endQty"
      }
    }
  },

  {
    primarySource: "PurchaseOrderAdditionalCosts.json",
    duplicateSources: ["MIPOC.json"],
    description: "PURCHASE ORDER COSTS - Full field names vs abbreviated",
    fieldMapping: {
      "Purchase Order Id": {
        "PurchaseOrderAdditionalCosts.json": "Purchase Order Id",
        "MIPOC.json": "pohId"
      },
      "Purchase Order Revision": {
        "PurchaseOrderAdditionalCosts.json": "Purchase Order Revision", 
        "MIPOC.json": "pohRev"
      },
      "Additional Cost": {
        "PurchaseOrderAdditionalCosts.json": "Additional Cost",
        "MIPOC.json": "addCostId"
      },
      "Amount": {
        "PurchaseOrderAdditionalCosts.json": "Amount",
        "MIPOC.json": "amt"
      },
      "Description": {
        "PurchaseOrderAdditionalCosts.json": "Description",
        "MIPOC.json": "descr"
      },
      "Comment": {
        "PurchaseOrderAdditionalCosts.json": "Comment",
        "MIPOC.json": "cmnt"
      }
    }
  },

  {
    primarySource: "PurchaseOrderDetailAdditionalCosts.json", 
    duplicateSources: ["MIPODC.json"],
    description: "PURCHASE ORDER DETAIL COSTS - Full field names vs abbreviated",
    fieldMapping: {
      "PO No.": {
        "PurchaseOrderDetailAdditionalCosts.json": "PO No.",
        "MIPODC.json": "pohId"
      },
      "PO Revision": {
        "PurchaseOrderDetailAdditionalCosts.json": "PO Revision",
        "MIPODC.json": "pohRev"
      },
      "Additional Cost": {
        "PurchaseOrderDetailAdditionalCosts.json": "Additional Cost",
        "MIPODC.json": "addCostId"
      },
      "Amount": {
        "PurchaseOrderDetailAdditionalCosts.json": "Amount",
        "MIPODC.json": "amt"
      },
      "Description": {
        "PurchaseOrderDetailAdditionalCosts.json": "Description",
        "MIPODC.json": "descr"
      }
    }
  },

  {
    primarySource: "PurchaseOrderAdditionalCostsTaxes.json",
    duplicateSources: ["MIPOCV.json"],
    description: "PURCHASE ORDER VENDOR INFO - Full field names vs abbreviated", 
    fieldMapping: {
      "Name": {
        "PurchaseOrderAdditionalCostsTaxes.json": "Name",
        "MIPOCV.json": "name"
      },
      "Purchase Order Id": {
        "PurchaseOrderAdditionalCostsTaxes.json": "Purchase Order Id",
        "MIPOCV.json": "pohId"
      },
      "Purchase Order Revision": {
        "PurchaseOrderAdditionalCostsTaxes.json": "Purchase Order Revision",
        "MIPOCV.json": "pohRev"
      },
      "Contact": {
        "PurchaseOrderAdditionalCostsTaxes.json": "Contact",
        "MIPOCV.json": "contact"
      },
      "Telephone": {
        "PurchaseOrderAdditionalCostsTaxes.json": "Telephone",
        "MIPOCV.json": "phone"
      },
      "E-mail": {
        "PurchaseOrderAdditionalCostsTaxes.json": "E-mail",
        "MIPOCV.json": "email"
      }
    }
  }
];

// SMART PRIMARY SOURCE SELECTION - AVOID DUPLICATES
export const SMART_PRIMARY_SOURCES = {
  // ITEMS - NO DUPLICATES
  ITEMS: "CustomAlert5.json",                           // 32 fields - UNIQUE, MOST COMPLETE
  
  // JOB DATA - PREFER FULL FIELD NAMES
  JOBS: "Jobs.json",                                   // 12 fields - vs MIJOBH.json (abbreviated)
  JOB_DETAILS: "JobDetails.json",                     // 18 fields - vs MIJOBD.json (abbreviated)
  
  // BOM DATA - PREFER FULL FIELD NAMES  
  BOM_DETAILS: "BillOfMaterialDetails.json",          // 12 fields - vs MIBOMD.json (abbreviated)
  BOM_HEADERS: "BillsOfMaterial.json",                // 25 fields - vs MIBOMH.json (abbreviated)
  
  // WORK ORDER DATA - PREFER FULL FIELD NAMES
  WORK_ORDERS: "WorkOrders.json",                     // 13 fields - vs MIWOH.json (abbreviated)
  WORK_ORDER_DETAILS: "WorkOrderDetails.json",       // 23 fields - vs MIWOD.json (abbreviated)
  
  // PURCHASE ORDER DATA - PREFER FULL FIELD NAMES
  PO_ADDITIONAL_COSTS: "PurchaseOrderAdditionalCosts.json",           // 52 fields - vs MIPOC.json
  PO_DETAIL_COSTS: "PurchaseOrderDetailAdditionalCosts.json",        // 19 fields - vs MIPODC.json  
  PO_VENDOR_INFO: "PurchaseOrderAdditionalCostsTaxes.json",          // 37 fields - vs MIPOCV.json
  
  // SINGLE SOURCE DATA (NO DUPLICATES)
  ITEMS_WITH_STOCK: "Items_with_stock.json"           // 1 field - UNIQUE
} as const;

// IGNORED SOURCES - THESE ARE DUPLICATES, DON'T USE THEM
export const IGNORED_DUPLICATE_SOURCES = [
  "MIJOBH.json",        // Duplicate of Jobs.json
  "MIJOBD.json",        // Duplicate of JobDetails.json  
  "MIBOMD.json",        // Duplicate of BillOfMaterialDetails.json
  "MIBOMH.json",        // Duplicate of BillsOfMaterial.json
  "MIWOH.json",         // Duplicate of WorkOrders.json
  "MIWOD.json",         // Duplicate of WorkOrderDetails.json
  "MIPOC.json",         // Duplicate of PurchaseOrderAdditionalCosts.json
  "MIPODC.json",        // Duplicate of PurchaseOrderDetailAdditionalCosts.json
  "MIPOCV.json"         // Duplicate of PurchaseOrderAdditionalCostsTaxes.json
] as const;

// EMPTY FILES - NO DATA
export const EMPTY_FILES = [
  "BillOfMaterialRoutingDetails.json",
  "Items.json", 
  "Items_qty_keys.json",
  "Items_union_keys.json",
  "Items_default_keys.json",
  "ManufacturingOrderDetails.json",
  "ManufacturingOrderRoutings.json", 
  "ManufacturingOrderHeaders.json",
  "PurchaseOrders.json",
  "PurchaseOrderDetails.json",
  "MIMOH.json",
  "MIITEM.json",
  "MIBORD.json",
  "PurchaseOrderExtensions.json",
  "MIMORD.json",
  "MIPOH.json", 
  "MIMOMD.json",
  "MIPOD.json",
  "MIPOHX.json"
] as const;

/**
 * Get field value from primary source, fallback to duplicate if needed
 */
export function getSmartFieldValue(data: any, dataType: keyof typeof SMART_PRIMARY_SOURCES, fieldName: string, record: any): any {
  const primarySource = SMART_PRIMARY_SOURCES[dataType];
  
  // First try primary source
  if (record[fieldName] !== undefined && record[fieldName] !== null) {
    return record[fieldName];
  }
  
  // Check if there's a field mapping for this data type
  const duplication = DATA_DUPLICATIONS.find(d => d.primarySource === primarySource);
  if (!duplication) return null;
  
  // Try to find the field in duplicate sources
  const fieldMapping = duplication.fieldMapping[fieldName];
  if (!fieldMapping) return null;
  
  // Try each duplicate source
  for (const duplicateSource of duplication.duplicateSources) {
    const duplicateFieldName = fieldMapping[duplicateSource];
    if (duplicateFieldName && record[duplicateFieldName] !== undefined) {
      return record[duplicateFieldName];
    }
  }
  
  return null;
}

/**
 * Check if a file should be ignored because it's a duplicate
 */
export function isDuplicateSource(fileName: string): boolean {
  return IGNORED_DUPLICATE_SOURCES.includes(fileName as any);
}

/**
 * Check if a file is empty (no data)
 */
export function isEmptyFile(fileName: string): boolean {
  return EMPTY_FILES.includes(fileName as any);
}

/**
 * Get smart data source recommendation
 */
export function getDataSourceRecommendation(fileName: string): {
  status: 'primary' | 'duplicate' | 'empty';
  recommendation: string;
  primaryAlternative?: string;
} {
  if (isEmptyFile(fileName)) {
    return {
      status: 'empty',
      recommendation: 'This file contains no data. Ignore it.'
    };
  }
  
  if (isDuplicateSource(fileName)) {
    const duplication = DATA_DUPLICATIONS.find(d => d.duplicateSources.includes(fileName));
    return {
      status: 'duplicate', 
      recommendation: `This file contains duplicate data. Use ${duplication?.primarySource} instead.`,
      primaryAlternative: duplication?.primarySource
    };
  }
  
  return {
    status: 'primary',
    recommendation: 'This is a primary data source. Use it for data access.'
  };
}
