/**
 * UNIFIED DATA ACCESS LAYER - BASED ON REAL G: DRIVE FIELD MAPPING
 * This provides a single interface for accessing data using EXACT field names
 * NO MOCK DATA - ONLY REAL FIELD REFERENCES
 */

import { PRIMARY_DATA_SOURCES, ITEM_FIELDS, BOM_FIELDS, JOB_FIELDS, hasDataFields } from './realFieldMapping';
import { SMART_PRIMARY_SOURCES, getSmartFieldValue, isDuplicateSource, isEmptyFile } from './smartDataMapping';

/**
 * SMART ITEM DATA ACCESS - Uses CustomAlert5.json (NO DUPLICATES)
 */
export function getRealItemData(data: any, itemNo: string) {
  const itemsData = data[SMART_PRIMARY_SOURCES.ITEMS] || [];
  const item = itemsData.find((item: any) => item[ITEM_FIELDS.NUMBER] === itemNo);
  
  if (!item) {
    console.warn(`Item ${itemNo} not found in ${SMART_PRIMARY_SOURCES.ITEMS}`);
    return null;
  }
  
  return {
    itemNo: item[ITEM_FIELDS.NUMBER],
    description: item[ITEM_FIELDS.DESCRIPTION] || 'N/A',
    stock: parseFloat(String(item[ITEM_FIELDS.STOCK] || '0').replace(/,/g, '')) || 0,
    recentCost: parseFloat(String(item[ITEM_FIELDS.RECENT_COST] || '0').replace(/,/g, '')) || 0,
    standardCost: parseFloat(String(item[ITEM_FIELDS.STANDARD_COST] || '0').replace(/,/g, '')) || 0,
    unitCost: parseFloat(String(item[ITEM_FIELDS.UNIT_COST] || '0').replace(/,/g, '')) || 0,
    wip: parseFloat(String(item[ITEM_FIELDS.WIP] || '0').replace(/,/g, '')) || 0,
    reserve: parseFloat(String(item[ITEM_FIELDS.RESERVE] || '0').replace(/,/g, '')) || 0,
    onOrder: parseFloat(String(item[ITEM_FIELDS.ON_ORDER] || '0').replace(/,/g, '')) || 0,
    reorderLevel: parseFloat(String(item[ITEM_FIELDS.REORDER_LEVEL] || '0').replace(/,/g, '')) || 0,
    reorderQuantity: parseFloat(String(item[ITEM_FIELDS.REORDER_QUANTITY] || '0').replace(/,/g, '')) || 0,
    rawData: item  // Full raw data for advanced use
  };
}

/**
 * GET ITEM COST - PRIORITIZES Recent Cost > Standard Cost > Unit Cost
 */
export function getRealItemCost(data: any, itemNo: string): number {
  const itemData = getRealItemData(data, itemNo);
  if (!itemData) return 0;
  
  // PRIORITY ORDER: Recent Cost > Standard Cost > Unit Cost
  if (itemData.recentCost > 0) return itemData.recentCost;
  if (itemData.standardCost > 0) return itemData.standardCost;
  if (itemData.unitCost > 0) return itemData.unitCost;
  
  return 0;
}

/**
 * GET ITEM STOCK - Uses CustomAlert5.json "Stock" field
 */
export function getRealItemStock(data: any, itemNo: string): number {
  const itemData = getRealItemData(data, itemNo);
  return itemData ? itemData.stock : 0;
}

/**
 * SMART BOM DATA ACCESS - Uses BillOfMaterialDetails.json (AVOID MIBOMD.json DUPLICATE)
 */
export function getRealBOMDetails(data: any, parentItem?: string) {
  const bomData = data[SMART_PRIMARY_SOURCES.BOM_DETAILS] || [];
  
  if (parentItem) {
    return bomData.filter((bom: any) => bom["Parent Item No."] === parentItem);
  }
  
  return bomData.map((bom: any) => ({
    parentItem: bom["Parent Item No."],
    componentItem: bom["Component Item No."],
    requiredQty: parseFloat(String(bom["Required Quantity"] || '0').replace(/,/g, '')) || 0,
    revision: bom["Revision No."],
    leadTime: parseInt(String(bom["Lead (Days)"] || '0')) || 0,
    comment: bom["Comment"] || '',
    rawData: bom
  }));
}

/**
 * SMART JOB DATA ACCESS - Uses Jobs.json (AVOID MIJOBH.json DUPLICATE)
 */
export function getRealJobData(data: any, jobNo?: string) {
  const jobsData = data[SMART_PRIMARY_SOURCES.JOBS] || [];
  
  if (jobNo) {
    const job = jobsData.find((job: any) => job[JOB_FIELDS.JOB_NUMBER] === jobNo);
    return job ? {
      jobNo: job[JOB_FIELDS.JOB_NUMBER],
      description: job[JOB_FIELDS.DESCRIPTION] || 'N/A',
      status: job[JOB_FIELDS.STATUS],
      rawData: job
    } : null;
  }
  
  return jobsData.map((job: any) => ({
    jobNo: job[JOB_FIELDS.JOB_NUMBER],
    description: job[JOB_FIELDS.DESCRIPTION] || 'N/A', 
    status: job[JOB_FIELDS.STATUS],
    rawData: job
  }));
}

/**
 * SMART WORK ORDER DATA ACCESS - Uses WorkOrders.json (AVOID MIWOH.json DUPLICATE)
 */
export function getRealWorkOrderData(data: any, workOrderNo?: string) {
  const workOrdersData = data[SMART_PRIMARY_SOURCES.WORK_ORDERS] || [];
  
  if (workOrderNo) {
    const wo = workOrdersData.find((wo: any) => wo["Work Order No."] === workOrderNo);
    return wo ? {
      workOrderNo: wo["Work Order No."],
      description: wo["Description"] || 'N/A',
      status: wo["Status"],
      jobNo: wo["Job No."],
      salesOrderNo: wo["Sales Order No."],
      releaseDate: wo["Release Date"],
      rawData: wo
    } : null;
  }
  
  return workOrdersData.map((wo: any) => ({
    workOrderNo: wo["Work Order No."],
    description: wo["Description"] || 'N/A',
    status: wo["Status"],
    jobNo: wo["Job No."],
    salesOrderNo: wo["Sales Order No."],
    releaseDate: wo["Release Date"],
    rawData: wo
  }));
}

/**
 * SMART LOW STOCK ANALYSIS - Uses CustomAlert5.json (NO DUPLICATES)
 */
export function getRealLowStockItems(data: any) {
  const itemsData = data[SMART_PRIMARY_SOURCES.ITEMS] || [];
  
  return itemsData
    .map((item: any) => {
      const stock = parseFloat(String(item[ITEM_FIELDS.STOCK] || '0').replace(/,/g, '')) || 0;
      const reorderLevel = parseFloat(String(item[ITEM_FIELDS.REORDER_LEVEL] || '0').replace(/,/g, '')) || 0;
      
      return {
        itemNo: item[ITEM_FIELDS.NUMBER],
        description: item[ITEM_FIELDS.DESCRIPTION] || 'N/A',
        stock,
        reorderLevel,
        reorderQuantity: parseFloat(String(item[ITEM_FIELDS.REORDER_QUANTITY] || '0').replace(/,/g, '')) || 0,
        cost: getRealItemCost(data, item[ITEM_FIELDS.NUMBER]),
        isLowStock: stock <= reorderLevel && reorderLevel > 0,
        isOutOfStock: stock <= 0,
        rawData: item
      };
    })
    .filter(item => item.isLowStock || item.isOutOfStock);
}

/**
 * SMART INVENTORY ANALYSIS - Uses CustomAlert5.json (NO DUPLICATES)
 */
export function getRealInventoryItems(data: any) {
  const itemsData = data[SMART_PRIMARY_SOURCES.ITEMS] || [];
  
  return itemsData.map((item: any) => {
    const stock = parseFloat(String(item[ITEM_FIELDS.STOCK] || '0').replace(/,/g, '')) || 0;
    const reorderLevel = parseFloat(String(item[ITEM_FIELDS.REORDER_LEVEL] || '0').replace(/,/g, '')) || 0;
    
    return {
      itemNo: item[ITEM_FIELDS.NUMBER],
      description: item[ITEM_FIELDS.DESCRIPTION] || 'N/A',
      stock,
      reorderLevel,
      reorderQuantity: parseFloat(String(item[ITEM_FIELDS.REORDER_QUANTITY] || '0').replace(/,/g, '')) || 0,
      cost: getRealItemCost(data, item[ITEM_FIELDS.NUMBER]),
      value: stock * getRealItemCost(data, item[ITEM_FIELDS.NUMBER]),
      isLowStock: stock <= reorderLevel && reorderLevel > 0,
      isOutOfStock: stock <= 0,
      rawData: item
    };
  });
}

/**
 * SMART DATA VALIDATION - Check ONLY primary sources, ignore duplicates
 */
export function validateDataSources(data: any): {
  isValid: boolean;
  availableSources: string[];
  missingSources: string[];
  duplicateSourcesIgnored: string[];
  warnings: string[];
} {
  const requiredSources = Object.values(SMART_PRIMARY_SOURCES);
  const availableSources: string[] = [];
  const missingSources: string[] = [];
  const duplicateSourcesIgnored: string[] = [];
  const warnings: string[] = [];
  
  // Check primary sources
  for (const source of requiredSources) {
    if (data[source] && Array.isArray(data[source]) && data[source].length > 0) {
      availableSources.push(source);
    } else {
      missingSources.push(source);
      warnings.push(`${source} is missing or empty`);
    }
  }
  
  // Identify duplicate sources that are being ignored
  for (const fileName of Object.keys(data)) {
    if (isDuplicateSource(fileName)) {
      duplicateSourcesIgnored.push(fileName);
      warnings.push(`${fileName} ignored - duplicate of primary source`);
    }
    if (isEmptyFile(fileName)) {
      warnings.push(`${fileName} ignored - contains no data`);
    }
  }
  
  return {
    isValid: availableSources.length > 0,
    availableSources,
    missingSources,
    duplicateSourcesIgnored,
    warnings
  };
}

/**
 * PARSE STOCK VALUE - Handle comma-separated numbers
 */
export function parseStockValue(value: any): number {
  if (value === null || value === undefined) return 0;
  const cleanValue = String(value).replace(/,/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * PARSE COST VALUE - Handle comma-separated numbers and currency symbols
 */
export function parseCostValue(value: any): number {
  if (value === null || value === undefined) return 0;
  const cleanValue = String(value).replace(/[$,]/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * FORMAT CANADIAN DOLLAR - With error handling
 */
export function formatCAD(amount: number): string {
  try {
    if (!amount || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    console.warn('CAD formatting failed, using fallback:', error);
    return `$${amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}