// REAL ITEM AND STOCK UTILITIES - USES EXACT G: DRIVE FIELD NAMES
// Based on REAL field mapping from G: Drive data
// Uses unifiedDataAccess for consistent field access
import { getRealItemStock, getRealItemData, getRealItemCost } from './unifiedDataAccess';

// ============================================
// LOCATION OWNERSHIP CONSTANTS
// ============================================
// Canoil's own stock locations
export const CANOIL_LOCATIONS = ['62TODD', 'HOME'];

// Check if a location belongs to Canoil
export function isCanoilLocation(location: string): boolean {
  if (!location) return true; // Default to Canoil if no location specified
  const upperLocation = location.toUpperCase().trim();
  return CANOIL_LOCATIONS.some(loc => upperLocation === loc || upperLocation.startsWith(loc));
}

// Check if a location is customer-owned stock
export function isCustomerLocation(location: string): boolean {
  return !isCanoilLocation(location);
}

// Get the owner name for a location
export function getLocationOwner(location: string): string {
  if (!location) return 'Canoil';
  if (isCanoilLocation(location)) return 'Canoil';
  // Return the location as the owner name (BRO, LANXESS, etc.)
  return location.toUpperCase().trim();
}

export interface ItemWithLocation {
  // Core item data from CustomAlert5 - EXACT PRODUCTION FIELD NAMES
  "Item No.": string;
  "Description": string;
  "Item Type": string;
  "Status": string;
  "Stock": number;
  "WIP": number;
  "Reserve": number;
  "On Order": number;
  "Recent Cost": string;
  "Standard Cost": string;
  "Average Cost": string;
  "Landed Cost": string;
  "Unit Cost": string;
  "Pick Sequence": string;
  
  // Enhanced location data (when MIILOC available)
  locations?: Array<{
    locationId: string;
    stock: number;
    wip: number;
    reserved: number;
    onOrder: number;
    pickSequence: string;
  }>;
}

/**
 * Get complete item data with location information
 * Combines CustomAlert5 (primary) with MIILOC (enhanced locations)
 */
export function getItemWithLocations(itemNo: string, data: any): ItemWithLocation | null {
  const customAlert5Items = data['CustomAlert5.json'] || [];
  const milocData = data['MIILOC.json'] || [];
  
  // Find the primary item data from CustomAlert5
  const primaryItem = customAlert5Items.find((item: any) => item["Item No."] === itemNo);
  if (!primaryItem) return null;
  
  // Get location-specific data from MIILOC (if available)
  const locationData = milocData
    .filter((loc: any) => loc.itemId === itemNo)
    .map((loc: any) => ({
      locationId: loc.locId || 'Unknown',
      stock: parseFloat(loc.qStk || 0),
      wip: parseFloat(loc.qWIP || 0),
      reserved: parseFloat(loc.qRes || 0),
      onOrder: parseFloat(loc.qOrd || 0),
      pickSequence: loc.pick || primaryItem["Pick Sequence"] || ''
    }));
  
  // Build complete item data - EXACT FIELD NAMES FROM PRODUCTION DATA
  const result: ItemWithLocation = {
    "Item No.": primaryItem["Item No."],
    "Description": primaryItem["Description"] || '',
    "Item Type": primaryItem["Item Type"] || '',
    "Status": primaryItem["Status"] || '',
    "Stock": parseFloat(primaryItem["Stock"] || 0),
    "WIP": parseFloat(primaryItem["WIP"] || 0),
    "Reserve": parseFloat(primaryItem["Reserve"] || 0),
    "On Order": parseFloat(primaryItem["On Order"] || 0),
    "Recent Cost": primaryItem["Recent Cost"] || '$0.00',
    "Standard Cost": primaryItem["Standard Cost"] || '$0.00',
    "Average Cost": primaryItem["Average Cost"] || '$0.00',
    "Landed Cost": primaryItem["Landed Cost"] || '$0.00',
    "Unit Cost": primaryItem["Unit Cost"] || '$0.00',
    "Pick Sequence": primaryItem["Pick Sequence"] || ''
  };
  
  // Add enhanced location data if available
  if (locationData.length > 0) {
    result.locations = locationData;
  }
  
  return result;
}

/**
 * Get all items with their location data
 * Returns array of items with location information
 */
export function getAllItemsWithLocations(data: any): ItemWithLocation[] {
  const customAlert5Items = data['CustomAlert5.json'] || [];
  
  return customAlert5Items.map((item: any) => 
    getItemWithLocations(item["Item No."], data)
  ).filter(Boolean) as ItemWithLocation[];
}

/**
 * Get total stock for an item - USES REAL G: DRIVE FIELD MAPPING
 * Delegates to unifiedDataAccess for consistent field access
 */
export function getTotalItemStock(itemNo: string, data: any): number {
  return getRealItemStock(data, itemNo);
}

/**
 * Get item cost - USES REAL G: DRIVE FIELD MAPPING
 * Prioritizes Recent Cost > Standard Cost > Unit Cost
 */
export function getItemCost(itemNo: string, data: any): number {
  return getRealItemCost(data, itemNo);
}

/**
 * Get stock by location for an item
 * SMART: Match CustomAlert5 item with MIILOC locations by Item No.
 */
export function getItemStockByLocation(itemNo: string, data: any): Array<{location: string, stock: number, pickSequence?: string}> {
  const milocData = data['MIILOC.json'] || [];
  const customAlert5Items = data['CustomAlert5.json'] || [];
  
  // Get the main item from CustomAlert5
  const mainItem = customAlert5Items.find((item: any) => item["Item No."] === itemNo);
  
  if (milocData.length > 0) {
    // Get location-specific stock from MIILOC - match by itemId = Item No.
    const locationStocks = milocData
      .filter((loc: any) => loc.itemId === itemNo && parseFloat(loc.qStk || 0) > 0)
      .map((loc: any) => ({
        location: loc.locId || 'Unknown',
        stock: parseFloat(loc.qStk || 0),
        pickSequence: loc.pick || mainItem?.["Pick Sequence"] || ''
      }));
    
    if (locationStocks.length > 0) {
      return locationStocks;
    }
  }
  
  // Fallback: Use CustomAlert5 data with Pick Sequence as location
  if (mainItem && parseFloat(mainItem["Stock"] || 0) > 0) {
    return [{
      location: mainItem["Pick Sequence"] || 'Main Location',
      stock: parseFloat(mainItem["Stock"] || 0),
      pickSequence: mainItem["Pick Sequence"] || ''
    }];
  }
  
  return [];
}

/**
 * Legacy function support - NOW USES CustomAlert5 as primary source
 * This function is called with MIILOC data but MIILOC might not exist
 * Better to get stock from CustomAlert5 directly
 * @deprecated Use getTotalItemStock instead
 */
export function getItemStock(itemNo: string, milocData: any[]): {total: number} {
  // IMPORTANT: milocData might be empty or not exist
  // This function is called from BOM component but we should use CustomAlert5 stock instead
  
  if (Array.isArray(milocData) && milocData.length > 0) {
    // Try MIILOC first if data exists
    const total = milocData
      .filter((loc: any) => loc.itemId === itemNo)
      .reduce((sum: number, loc: any) => sum + parseFloat(loc.qStk || 0), 0);
    
    if (total > 0) {
      return { total };
    }
  }
  
  // FALLBACK: Return 0 and let calling code use CustomAlert5 instead
  // The BOM component should use getTotalItemStock for real stock
  console.warn(`⚠️ getItemStock: No MIILOC data for ${itemNo}, use getTotalItemStock instead`);
  return { total: 0 };
}

// ============================================
// LOCATION-AWARE STOCK FUNCTIONS
// ============================================

/**
 * Get stock breakdown by ownership (Canoil vs Customer)
 * Returns separate totals for Canoil stock and customer stock
 * 
 * Uses Pick Sequence from CustomAlert5.json as the location identifier
 * - 62TODD, HOME = Canoil stock
 * - BRO, LANXESS, etc. = Customer stock (stored at Canoil but owned by customer)
 */
export function getStockByOwnership(itemNo: string, data: any): {
  canoilStock: number;
  customerStock: number;
  totalStock: number;
  location: string;
  customerBreakdown: Array<{location: string, stock: number}>;
} {
  const milocData = data['MIILOC.json'] || [];
  const customAlert5Items = data['CustomAlert5.json'] || [];
  
  let canoilStock = 0;
  let customerStock = 0;
  let itemLocation = '';
  const customerBreakdown: Array<{location: string, stock: number}> = [];
  
  // FIRST: Try to get from CustomAlert5 using Pick Sequence as location
  const mainItem = customAlert5Items.find((item: any) => item["Item No."] === itemNo);
  if (mainItem) {
    const stock = parseFloat(mainItem["Stock"] || 0);
    // Pick Sequence contains the location (62TODD, BRO, LANXESS, etc.)
    const location = (mainItem["Pick Sequence"] || '').toString().trim();
    itemLocation = location;
    
    if (stock > 0) {
      if (isCanoilLocation(location)) {
        canoilStock = stock;
      } else {
        customerStock = stock;
        if (location) {
          customerBreakdown.push({ location, stock });
        }
      }
    }
  }
  
  // SECOND: If MIILOC data exists, use it for more detailed breakdown
  if (milocData.length > 0) {
    const itemLocations = milocData.filter((loc: any) => loc.itemId === itemNo);
    
    if (itemLocations.length > 0) {
      // Reset and recalculate from MIILOC
      canoilStock = 0;
      customerStock = 0;
      customerBreakdown.length = 0;
      
      for (const loc of itemLocations) {
        const stock = parseFloat(loc.qStk || 0);
        const location = (loc.locId || '').toString().trim();
        
        if (stock > 0) {
          if (isCanoilLocation(location)) {
            canoilStock += stock;
          } else {
            customerStock += stock;
            if (location) {
              customerBreakdown.push({ location, stock });
            }
          }
        }
      }
    }
  }
  
  return {
    canoilStock,
    customerStock,
    totalStock: canoilStock + customerStock,
    location: itemLocation,
    customerBreakdown
  };
}

/**
 * Get ONLY Canoil's stock for an item (for PR generation)
 * Excludes customer-owned stock at customer locations
 */
export function getCanoilStock(itemNo: string, data: any): number {
  return getStockByOwnership(itemNo, data).canoilStock;
}

/**
 * Check if item has any customer-owned stock
 */
export function hasCustomerStock(itemNo: string, data: any): boolean {
  return getStockByOwnership(itemNo, data).customerStock > 0;
}