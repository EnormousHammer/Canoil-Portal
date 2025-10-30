// Production-grade field validation for CustomAlert5.json
// Ensures EXACT field name matching for business-critical data

/**
 * EXACT field names from CustomAlert5.json (2025-09-03)
 * ⚠️ CRITICAL: These are verified against production data - DO NOT MODIFY
 */
export const CUSTOMALERT5_EXACT_FIELDS = [
  "Average Cost",
  "Cumulative Variance", 
  "Current BOM Revision",
  "Description",
  "Human Resource",
  "Inventory Cycle",
  "Item No.",
  "Item Type",
  "Landed Cost",
  "Last Used Date",
  "Lot Dispensation Method",
  "Lot Size",
  "Maximum",
  "Minimum",
  "On Order",
  "Pick Sequence",
  "Purchasing Units",
  "Recent Cost",
  "Reference",
  "Reorder Level",
  "Reorder Quantity",
  "Reserve",
  "Sales Item No.",
  "Serial/Lot Track Type",
  "Standard Cost",
  "Status",
  "Stock",
  "Stocking Units",
  "Unit Cost",
  "Unit Weight",
  "Units Conversion Factor",
  "WIP"
] as const;

/**
 * Type-safe field names for TypeScript
 */
export type CustomAlert5FieldName = typeof CUSTOMALERT5_EXACT_FIELDS[number];

/**
 * Core item fields for business operations
 */
export const CORE_ITEM_FIELDS = {
  // Identification
  ITEM_NO: "Item No." as CustomAlert5FieldName,
  DESCRIPTION: "Description" as CustomAlert5FieldName,
  ITEM_TYPE: "Item Type" as CustomAlert5FieldName,
  STATUS: "Status" as CustomAlert5FieldName,
  
  // Stock Quantities
  STOCK: "Stock" as CustomAlert5FieldName,
  WIP: "WIP" as CustomAlert5FieldName,
  RESERVE: "Reserve" as CustomAlert5FieldName,
  ON_ORDER: "On Order" as CustomAlert5FieldName,
  
  // Pricing
  UNIT_COST: "Unit Cost" as CustomAlert5FieldName,
  RECENT_COST: "Recent Cost" as CustomAlert5FieldName,
  STANDARD_COST: "Standard Cost" as CustomAlert5FieldName,
  AVERAGE_COST: "Average Cost" as CustomAlert5FieldName,
  LANDED_COST: "Landed Cost" as CustomAlert5FieldName,
  
  // Location
  PICK_SEQUENCE: "Pick Sequence" as CustomAlert5FieldName,
  
  // Inventory Management
  MINIMUM: "Minimum" as CustomAlert5FieldName,
  MAXIMUM: "Maximum" as CustomAlert5FieldName,
  REORDER_LEVEL: "Reorder Level" as CustomAlert5FieldName,
  REORDER_QUANTITY: "Reorder Quantity" as CustomAlert5FieldName,
  
  // Units
  STOCKING_UNITS: "Stocking Units" as CustomAlert5FieldName,
  PURCHASING_UNITS: "Purchasing Units" as CustomAlert5FieldName,
  UNITS_CONVERSION_FACTOR: "Units Conversion Factor" as CustomAlert5FieldName
} as const;

/**
 * Validates that a CustomAlert5 item has all required fields
 * @param item The item object to validate
 * @returns ValidationResult with success status and any missing fields
 */
export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  extraFields: string[];
  errorMessage?: string;
}

export function validateCustomAlert5Item(item: any): ValidationResult {
  if (!item || typeof item !== 'object') {
    return {
      isValid: false,
      missingFields: [],
      extraFields: [],
      errorMessage: 'Item is null, undefined, or not an object'
    };
  }

  const itemFields = Object.keys(item);
  const expectedFields = CUSTOMALERT5_EXACT_FIELDS;
  
  const missingFields = expectedFields.filter(field => !itemFields.includes(field));
  const extraFields = itemFields.filter(field => !expectedFields.includes(field as any));
  
  const isValid = missingFields.length === 0;
  
  return {
    isValid,
    missingFields,
    extraFields,
    errorMessage: isValid ? undefined : `Missing required fields: ${missingFields.join(', ')}`
  };
}

/**
 * Type-safe getter for CustomAlert5 item fields
 * Ensures exact field name matching at compile time
 */
export function getItemField<T extends CustomAlert5FieldName>(
  item: any, 
  fieldName: T
): string | number | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  
  return item[fieldName] ?? null;
}

/**
 * Safe number getter for numeric fields
 */
export function getItemFieldAsNumber(
  item: any, 
  fieldName: CustomAlert5FieldName, 
  defaultValue: number = 0
): number {
  const value = getItemField(item, fieldName);
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return defaultValue;
}

/**
 * Safe string getter for text fields
 */
export function getItemFieldAsString(
  item: any, 
  fieldName: CustomAlert5FieldName, 
  defaultValue: string = ''
): string {
  const value = getItemField(item, fieldName);
  return value?.toString() ?? defaultValue;
}

/**
 * Validates CustomAlert5 data array
 */
export function validateCustomAlert5Data(data: any[]): {
  isValid: boolean;
  totalItems: number;
  validItems: number;
  invalidItems: number;
  validationErrors: Array<{index: number, errors: ValidationResult}>;
} {
  if (!Array.isArray(data)) {
    return {
      isValid: false,
      totalItems: 0,
      validItems: 0,
      invalidItems: 0,
      validationErrors: [{
        index: -1,
        errors: {
          isValid: false,
          missingFields: [],
          extraFields: [],
          errorMessage: 'Data is not an array'
        }
      }]
    };
  }

  const results = data.map((item, index) => ({
    index,
    validation: validateCustomAlert5Item(item)
  }));

  const validItems = results.filter(r => r.validation.isValid).length;
  const invalidItems = results.length - validItems;
  const validationErrors = results
    .filter(r => !r.validation.isValid)
    .map(r => ({ index: r.index, errors: r.validation }));

  return {
    isValid: invalidItems === 0,
    totalItems: data.length,
    validItems,
    invalidItems,
    validationErrors
  };
}

/**
 * Production helper: Get item by exact Item No.
 */
export function findItemByNumber(
  data: any[], 
  itemNo: string
): any | null {
  if (!Array.isArray(data) || !itemNo) {
    return null;
  }
  
  return data.find(item => 
    getItemFieldAsString(item, CORE_ITEM_FIELDS.ITEM_NO) === itemNo
  ) ?? null;
}

/**
 * Production helper: Get total stock for item
 */
export function getItemTotalStock(item: any): number {
  return getItemFieldAsNumber(item, CORE_ITEM_FIELDS.STOCK, 0);
}

/**
 * Production helper: Get item unit cost
 */
export function getItemUnitCost(item: any): string {
  return getItemFieldAsString(item, CORE_ITEM_FIELDS.UNIT_COST, '$0.00');
}

