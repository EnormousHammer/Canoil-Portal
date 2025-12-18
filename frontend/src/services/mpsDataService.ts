import { MPSOrder, MODetail } from '../types/mps';

// MPS Data Service - integrated with the Canoil Portal backend (port 5002)
// Data sources:
// - MPS schedule: Portal backend /api/mps (which fetches from Google Sheets server-side)
// - MISys data (items, MOs, SOs): Portal backend /api/data

// Backend API - Use the PORTAL backend (same as main app)
// Local: Portal backend on port 5002
// Production: Portal Cloud Run backend
const IS_PRODUCTION =
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  !window.location.hostname.includes('127.0.0.1');

const PORTAL_BACKEND_URL = IS_PRODUCTION
  ? 'https://canoil-portal-backend-711358371169.us-central1.run.app'
  : 'http://localhost:5002';

const CANOIL_API = `${PORTAL_BACKEND_URL}/api/data`;

export interface MISysData {
  items: any[];
  moHeaders: any[];
  moDetails: any[];
  salesOrders: any[];
}

let cachedMISysData: MISysData | null = null;
let cachedMPSOrders: MPSOrder[] | null = null;
let mpsLoadPromise: Promise<MPSOrder[]> | null = null;

// Sales Order URL builder - finds and opens SO PDF via portal backend
export function getSOUrl(soNumber: string): string | null {
  if (!soNumber) return null;
  // Extract base SO number (before hyphen) - "3005-2" → "3005"
  const soBase = soNumber.split('-')[0];
  const soNum = soBase.replace(/[^0-9]/g, '');
  if (!soNum) return null;
  // Return the find endpoint - caller will need to fetch this to get PDF path
  return `${PORTAL_BACKEND_URL}/api/sales-orders/find/${soNum}`;
}

// Open SO PDF in new tab - first finds the PDF, then opens it
export async function openSalesOrder(soNumber: string): Promise<void> {
  const findUrl = getSOUrl(soNumber);
  if (!findUrl) return;
  
  try {
    const response = await fetch(findUrl);
    if (!response.ok) {
      console.warn(`SO ${soNumber} not found`);
      return;
    }
    const data = await response.json();
    if (data.found && data.filePath) {
      // Open the PDF using the portal's PDF endpoint
      const pdfUrl = `${PORTAL_BACKEND_URL}/api/sales-order-pdf/${encodeURIComponent(data.filePath)}`;
      window.open(pdfUrl, '_blank');
    } else {
      console.warn(`SO ${soNumber} file not found`);
    }
  } catch (error) {
    console.error(`Error opening SO ${soNumber}:`, error);
  }
}

export async function fetchMISysData(filters?: {
  moNumbers?: string[];
  soNumbers?: string[];
}): Promise<MISysData> {
  // Use cached data if available (portal backend returns all data, filtering is client-side)
  if (cachedMISysData) return cachedMISysData;

  try {
    console.log('📦 Fetching MISys data from portal backend...');

    // Portal backend only supports GET - fetch all data (it's cached server-side)
    const response = await fetch(CANOIL_API, {
      cache: 'no-store', // Prevent browser caching
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const responseData = await response.json();

    // Portal API returns data nested under 'data' key
    const data = responseData.data || responseData;

    const result: MISysData = {
      // CustomAlert5.json has the REAL stock data (Stock, WIP, Reserve, On Order)
      items: data['CustomAlert5.json'] || data['Items.json'] || [],
      moHeaders: data['ManufacturingOrderHeaders.json'] || [],
      moDetails: data['ManufacturingOrderDetails.json'] || [],
      salesOrders: data['SalesOrders.json'] || [],
    };

    console.log(`✅ Loaded MISys data:`, {
      items: result.items.length,
      moHeaders: result.moHeaders.length,
      moDetails: result.moDetails.length,
      salesOrders: result.salesOrders.length,
    });

    // Cache the data
    cachedMISysData = result;

    return result;
  } catch (error) {
    console.warn('⚠️ Could not fetch MISys data:', error);
    return { items: [], moHeaders: [], moDetails: [], salesOrders: [] };
  }
}

export function clearMISysCache() {
  cachedMISysData = null;
}

// Parse MISys date format /Date(timestamp)/
function parseMISysDate(dateStr: any): string {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.includes('/Date(')) {
    const match = dateStr.match(/\/Date\((\d+)\)\//);
    if (match) {
      const date = new Date(parseInt(match[1]));
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return String(dateStr);
}

export async function fetchMPSData(forceRefresh = false): Promise<MPSOrder[]> {
  // Return cached data instantly if available (for instant tab switching)
  if (!forceRefresh && cachedMPSOrders && cachedMPSOrders.length > 0) {
    console.log('⚡ Returning cached MPS data instantly');
    return cachedMPSOrders;
  }
  
  // If a fetch is already in progress, return that promise (avoid duplicate fetches)
  if (mpsLoadPromise) {
    console.log('⏳ MPS fetch already in progress, waiting...');
    return mpsLoadPromise;
  }
  
  // Start new fetch
  mpsLoadPromise = (async () => {
    try {
      // Fetch MPS from backend (which fetches from Google Sheets server-side)
      console.log('📋 Fetching MPS schedule from backend...');
      const response = await fetch(`${PORTAL_BACKEND_URL}/api/mps`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch MPS: ${response.status}`);
      }

      const mpsResponse = await response.json();
      const mpsOrders = mpsResponse.mps_orders || [];
    
    if (mpsOrders.length === 0) {
      console.warn('No MPS orders returned from backend');
      return [];
    }

    console.log(`📋 Received ${mpsOrders.length} orders from backend`);

    // Collect unique MO and SO numbers for MISys enrichment
    const moNumbers = new Set<string>();
    const soNumbers = new Set<string>();

    mpsOrders.forEach((order: any) => {
      const moNumber = order.mo_number || '';
      const soNumber = order.so_number || '';

      if (moNumber) {
        moNumbers.add(moNumber);
        moNumbers.add(moNumber.replace(/^0+/, ''));
      }
      if (soNumber) {
        soNumbers.add(soNumber);
        const soBase = soNumber.split('-')[0];
        if (soBase) soNumbers.add(soBase);
      }
    });

    console.log(
      `📋 Schedule has ${moNumbers.size} unique MOs, ${soNumbers.size} unique SOs`
    );

    // Fetch only the MISys data we need (filtered by MO/SO numbers)
    const misysData = await fetchMISysData({
      moNumbers: Array.from(moNumbers),
      soNumbers: Array.from(soNumbers),
    });

    // Build lookup maps
    const moMap = new Map<string, any>();
    misysData.moHeaders.forEach((mo) => {
      const moNo = mo['Mfg. Order No.'] || mo['MO No.'] || mo['MO_No'];
      if (moNo) {
        // Normalize MO number (remove leading zeros for matching)
        const normalizedMO = String(moNo).replace(/^0+/, '');
        moMap.set(normalizedMO, mo);
        moMap.set(String(moNo), mo); // Also store original
      }
    });

    // Build MO Details map (materials by MO)
    const moDetailsMap = new Map<string, any[]>();
    misysData.moDetails.forEach((detail) => {
      const moNo = detail['Mfg. Order No.'] || detail['MO No.'];
      if (moNo) {
        const normalizedMO = String(moNo).replace(/^0+/, '');
        if (!moDetailsMap.has(normalizedMO)) {
          moDetailsMap.set(normalizedMO, []);
        }
        moDetailsMap.get(normalizedMO)!.push(detail);

        // Also store with original key
        if (!moDetailsMap.has(String(moNo))) {
          moDetailsMap.set(String(moNo), []);
        }
        moDetailsMap.get(String(moNo))!.push(detail);
      }
    });

    const itemMap = new Map<string, any>();
    misysData.items.forEach((item) => {
      const itemNo = item['Item No.'] || item['Item_No'] || item['ItemNumber'];
      if (itemNo) itemMap.set(String(itemNo), item);
    });

    const soMap = new Map<string, any>();
    misysData.salesOrders.forEach((so) => {
      const soNo = so['SO No.'] || so['SO_No'] || so['SONumber'];
      if (soNo) soMap.set(String(soNo), so);
    });

    const orders: MPSOrder[] = [];

    // Helper to parse numbers from strings
    const parseNum = (val: any) =>
      parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;

    // Process each order from backend
    for (const backendOrder of mpsOrders) {
      const moNumber = backendOrder.mo_number || '';
      const soNumber = backendOrder.so_number || '';
      const normalizedMO = moNumber.replace(/^0+/, '');

      // Get MO header from MISys
      const moData = moMap.get(normalizedMO) || moMap.get(moNumber);
      const soData = soMap.get(soNumber.split('-')[0]);

      // Get MO details (materials/components)
      const moDetailsList =
        moDetailsMap.get(normalizedMO) ||
        moDetailsMap.get(moNumber) ||
        [];

      // Build materials list with stock info - aggregate duplicates
      const materialsMap = new Map<string, MODetail>();

      moDetailsList.forEach((detail: any) => {
        const componentNo = detail['Component Item No.'] || '';
        if (!componentNo) return;

        const itemInfo = itemMap.get(componentNo);

        if (materialsMap.has(componentNo)) {
          // Aggregate quantities for duplicate components
          const existing = materialsMap.get(componentNo)!;
          existing.required_qty += detail['Required Qty.'] || 0;
          existing.released_qty += detail['Released Qty.'] || 0;
          existing.completed_qty += detail['Completed'] || 0;
          existing.material_cost += detail['Material Cost'] || 0;
        } else {
          // New component - use CustomAlert5 fields for stock
          const stockOnHand = parseNum(
            itemInfo?.['Stock'] ?? itemInfo?.['Quantity On Hand'] ?? 0
          );
          const wip = parseNum(itemInfo?.['WIP'] ?? 0);
          const reserve = parseNum(itemInfo?.['Reserve'] ?? 0);
          const onOrder = parseNum(
            itemInfo?.['On Order'] ?? itemInfo?.['Quantity On Order'] ?? 0
          );
          const stockAvailable = stockOnHand - reserve;

          materialsMap.set(componentNo, {
            line: materialsMap.size + 1,
            component_item_no: componentNo,
            component_description:
              itemInfo?.['Description'] ||
              detail['Non-stocked Item Description'] ||
              '',
            required_qty: detail['Required Qty.'] || 0,
            released_qty: detail['Released Qty.'] || 0,
            completed_qty: detail['Completed'] || 0,
            material_cost: detail['Material Cost'] || 0,
            wip: wip,
            source_location: detail['Source Location'] || '',
            stock_on_hand: stockOnHand,
            stock_available: stockAvailable,
            stock_committed: reserve,
            stock_on_order: onOrder,
            unit: itemInfo?.['Stocking Units'] || 'EA',
          });
        }
      });

      const materials: MODetail[] = Array.from(materialsMap.values()).sort(
        (a, b) => b.required_qty - a.required_qty
      );

      // Get build item info
      let buildItemData = null;
      if (moData) {
        const buildItemNo =
          moData['Build Item No.'] || moData['Assembly No.'];
        if (buildItemNo) {
          buildItemData = itemMap.get(String(buildItemNo));
        }
      }

      // Map backend order to MPSOrder format
      // Backend now returns correctly mapped fields matching Google Sheets columns
      const order: MPSOrder = {
        line_number: backendOrder.order_number || '',
        so_number: soNumber,
        mo_number: moNumber,
        wip: backendOrder.wip || '',
        work_center: backendOrder.work_center || 'Unassigned',
        status: backendOrder.status || '',
        product: backendOrder.product || '',
        customer: backendOrder.customer_code || '',  // customer_code has customer name
        customer_code: backendOrder.customer_code || '',
        packaging: backendOrder.packaging || '',
        required: parseNum(backendOrder.required),
        ready: parseNum(backendOrder.ready),
        planned_pct: backendOrder.planned || '0%',
        actual_pct: backendOrder.actual || '0%',
        promised_date: backendOrder.promised || '',
        start_date: backendOrder.start_date || '',
        end_date: backendOrder.end_date || '',
        duration: parseNum(backendOrder.duration) || 1,
        dtc: parseNum(backendOrder.dtc) || 0,
        action_items: backendOrder.action_items || '',

        // Enriched MO data from MISys
        mo_data: moData
          ? {
              mo_no: moData['Mfg. Order No.'] || '',
              item_no: moData['Build Item No.'] || moData['Assembly No.'] || '',
              description: moData['Description'] || moData['Customer'] || '',
              status: moData['Status'] || '',
              qty_ordered: moData['Ordered'] || 0,
              qty_completed: moData['Completed'] || 0,
              qty_remaining:
                (moData['Ordered'] || 0) - (moData['Completed'] || 0),
              start_date: parseMISysDate(moData['Start Date']),
              order_date: parseMISysDate(moData['Order Date']),
              release_date: parseMISysDate(moData['Release Date']),
              close_date: parseMISysDate(moData['Close Date']),
              due_date: parseMISysDate(moData['Sales Order Ship Date']),
              work_center: moData['Location No.'] || '',
              customer: moData['Customer'] || '',
              sales_order_no: moData['Sales Order No.'] || '',
              job_no: moData['Job No.'] || '',
              priority: moData['Priority'] || '',
              notes: moData['Notes'] || '',
              formulation: moData['Formulation'] || '',
              instructions: moData['Instructions'] || '',
              label: moData['Label'] || '',
              created_by: moData['Created By'] || '',
              released_by: moData['Released By'] || '',
              total_material_cost: moData['Total Material Cost'] || 0,
              total_labor_cost: moData['Actual Labor Cost'] || 0,
              total_overhead_cost: moData['Actual Overhead Cost'] || 0,
            }
          : undefined,

        // Materials/components used in this MO
        materials: materials,

        // Build item stock info - use CustomAlert5 fields (values are strings)
        item_data: buildItemData
          ? (() => {
              const parseNum = (val: any) =>
                parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
              const stock = parseNum(
                buildItemData['Stock'] ??
                  buildItemData['Quantity On Hand'] ??
                  0
              );
              const reserve = parseNum(
                buildItemData['Reserve'] ??
                  buildItemData['Quantity Committed'] ??
                  0
              );
              return {
                item_no: buildItemData['Item No.'] || '',
                description: buildItemData['Description'] || '',
                qty_on_hand: stock,
                qty_available: stock - reserve,
                qty_on_order: parseNum(
                  buildItemData['On Order'] ??
                    buildItemData['Quantity On Order'] ??
                    0
                ),
                qty_committed: reserve,
                reorder_level: parseNum(
                  buildItemData['Reorder Level'] ?? 0
                ),
                unit: buildItemData['Stocking Units'] || 'EA',
                recent_cost: parseNum(
                  buildItemData['Recent Cost'] ?? 0
                ),
              };
            })()
          : undefined,

        // SO data
        so_data: soData
          ? {
              so_no: soData['SO No.'] || '',
              customer:
                soData['Customer'] || soData['Bill To Name'] || '',
              order_date: parseMISysDate(soData['Order Date']),
              ship_date: parseMISysDate(soData['Ship Date']),
              status: soData['Status'] || '',
            }
          : undefined,
      };

      if (order.so_number) {
        orders.push(order);
      }
    }

      console.log(
        `✅ Loaded ${orders.length} MPS orders with full MISys enrichment`
      );
      
      // Cache the result for instant tab switching
      cachedMPSOrders = orders;
      
      return orders;
    } catch (error) {
      console.error('Error fetching MPS data:', error);
      throw error;
    } finally {
      mpsLoadPromise = null;
    }
  })();
  
  return mpsLoadPromise;
}

// Clear MPS cache (call this when user clicks refresh)
export function clearMPSCache() {
  cachedMPSOrders = null;
  mpsLoadPromise = null;
}

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('shipped'))
    return 'bg-green-500';
  if (
    s.includes('released') ||
    s.includes('production') ||
    s.includes('progress')
  )
    return 'bg-blue-500';
  if (s.includes('shortage')) return 'bg-red-500';
  if (s.includes('hold') || s.includes('wait')) return 'bg-yellow-500';
  if (s.includes('schedule')) return 'bg-purple-500';
  return 'bg-slate-500';
}

export function getStatusBgColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('shipped'))
    return 'bg-green-500/20 text-green-400 border-green-500/50';
  if (
    s.includes('released') ||
    s.includes('production') ||
    s.includes('progress')
  )
    return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
  if (s.includes('shortage'))
    return 'bg-red-500/20 text-red-400 border-red-500/50';
  if (s.includes('hold') || s.includes('wait'))
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
  if (s.includes('schedule'))
    return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
}

