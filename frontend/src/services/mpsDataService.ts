// @ts-ignore - papaparse types issue, but works at runtime
import Papa from 'papaparse';
import { MPSOrder, MODetail } from '../types/mps';
import { formatDisplayDate } from '../utils/dateUtils';

const SHEET_ID = '1zAOY7ngP2mLVi-W_FL9tsPiKDPqbU6WEUmrrTDeKygw';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Backend API - same as main app; use same-origin on Vercel (proxy to Render)
const IS_PRODUCTION = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
const MPS_BACKEND_URL = import.meta.env.VITE_MPS_BACKEND_URL || (IS_PRODUCTION 
  ? window.location.origin   // Vercel proxies /api/* to Render - no CORS
  : 'http://localhost:5003');
const CANOIL_API = `${MPS_BACKEND_URL}/api/data`;

// Pre-warm the backend on page load to reduce cold start latency
// Fire and forget - don't block the app, just wake up the container
if (IS_PRODUCTION) {
  // Use requestIdleCallback if available, otherwise setTimeout
  const scheduleWarmup = () => {
    fetch(`${MPS_BACKEND_URL}/api/warmup`, { 
      method: 'GET',
      // Don't wait for response, just trigger the request
      mode: 'cors',
      // Low priority fetch
      priority: 'low'
    } as any).catch(() => {
      // Silently ignore warmup failures - it's just an optimization
    });
  };
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(scheduleWarmup, { timeout: 2000 });
  } else {
    setTimeout(scheduleWarmup, 100);
  }
}

export interface MISysData {
  items: any[];
  moHeaders: any[];
  moDetails: any[];
  salesOrders: any[];
}

// Sales Order URL builder
export function getSOUrl(soNumber: string): string | null {
  if (!soNumber) return null;
  // Extract base SO number (before hyphen) - "3005-2" → "3005"
  const soBase = soNumber.split('-')[0];
  const soNum = soBase.replace(/[^0-9]/g, '');
  if (!soNum) return null;
  // Use same backend for SO access
  return `${MPS_BACKEND_URL}/api/sales-order-search/${soNum}`;
}

// Open SO in new tab
export function openSalesOrder(soNumber: string): void {
  const url = getSOUrl(soNumber);
  if (url) window.open(url, '_blank');
}

export async function fetchMISysData(filters?: { moNumbers?: string[], soNumbers?: string[] }): Promise<MISysData> {
  // Don't use frontend cache - always fetch fresh data from backend
  // Backend has its own cache mechanism with shorter duration
  // This ensures we get the latest MISys data when MPS updates
  
  try {
    const hasFilters = filters && (filters.moNumbers?.length || filters.soNumbers?.length);
    
    if (hasFilters) {
      console.log(`📦 Fetching filtered MISys data: ${filters.moNumbers?.length || 0} MOs, ${filters.soNumbers?.length || 0} SOs`);
    } else {
      console.log('📦 Fetching all MISys data...');
    }
    
    // Backend /api/data only supports GET. Use query params for cache-busting; filter client-side if needed.
    const apiUrl = `${CANOIL_API}?force_refresh=true&t=${Date.now()}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const responseData = await response.json();
    
    // API might return data directly or nested under 'data' key
    const data = responseData.data || responseData;
    
    let result: MISysData = {
      // CustomAlert5.json has the REAL stock data (Stock, WIP, Reserve, On Order)
      items: data['CustomAlert5.json'] || data['Items.json'] || [],
      moHeaders: data['ManufacturingOrderHeaders.json'] || [],
      moDetails: data['ManufacturingOrderDetails.json'] || [],
      salesOrders: data['SalesOrders.json'] || []
    };
    if (hasFilters && filters) {
      const moSet = new Set((filters.moNumbers || []).map((n) => String(n).trim().toUpperCase()));
      const soSet = new Set((filters.soNumbers || []).map((n) => String(n).trim().toUpperCase()));
      if (moSet.size) {
        result = {
          ...result,
          moHeaders: result.moHeaders.filter((mo: any) => moSet.has(String(mo['Mfg. Order No.'] ?? mo['Mfg Order No.'] ?? '').trim().toUpperCase())),
          moDetails: result.moDetails.filter((d: any) => moSet.has(String(d['Mfg. Order No.'] ?? d['Mfg Order No.'] ?? '').trim().toUpperCase())),
        };
      }
      if (soSet.size) {
        result = {
          ...result,
          salesOrders: result.salesOrders.filter((so: any) => soSet.has(String(so['Sales Order No.'] ?? so['SO No.'] ?? so['Order No.'] ?? '').trim().toUpperCase())),
        };
      }
    }
    console.log(`✅ Loaded MISys data:`, {
      items: result.items.length,
      moHeaders: result.moHeaders.length,
      moDetails: result.moDetails.length,
      salesOrders: result.salesOrders.length
    });
    
    return result;
  } catch (error) {
    console.warn('⚠️ Could not fetch MISys data:', error);
    return { items: [], moHeaders: [], moDetails: [], salesOrders: [] };
  }
}

// Cache clearing function removed - we always fetch fresh data from backend
export function clearMISysCache() {
  // No-op: cache is handled by backend, frontend always fetches fresh
}

export async function fetchMPSData(): Promise<MPSOrder[]> {
  try {
    // Fetch MPS from Google Sheets
    // Aggressive cache-busting: timestamp + random + counter to ensure fresh data
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const counter = Math.floor(Math.random() * 1000000);
    const cacheBusterParams = `t=${timestamp}&r=${random}&c=${counter}&_=${performance.now()}`;
    
    // Try backend first if available, otherwise direct Google Sheets
    let csvText: string;
    try {
      // Try backend endpoint first (it might have better cache handling)
      // Use AbortController for timeout compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const backendResponse = await fetch(`${MPS_BACKEND_URL}/api/mps?format=csv&${cacheBusterParams}`, {
        method: 'GET',
        // Don't send custom headers - let cache: 'no-store' handle caching
        // This avoids preflight requests and CORS header issues
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (backendResponse.ok) {
        csvText = await backendResponse.text();
        console.log('✅ Fetched MPS data from backend');
      } else {
        throw new Error('Backend not available');
      }
    } catch (backendError) {
      // Backend not available - fetch directly from Google Sheets
      // CSV_URL already has ?format=csv, so use & to append cache buster params
      console.log('⚠️ Backend not available, fetching directly from Google Sheets');
      const response = await fetch(`${CSV_URL}&${cacheBusterParams}`, {
        method: 'GET',
        // Don't send custom headers - Google Sheets doesn't allow them in CORS preflight
        // The cache: 'no-store' option is sufficient to prevent caching
        cache: 'no-store', // Prevent browser caching
        credentials: 'omit', // Don't send cookies
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch MPS data: ${response.status} ${response.statusText}`);
      }
      
      csvText = await response.text();
      console.log('✅ Fetched MPS data directly from Google Sheets');
    }
    
    // Parse CSV data
    const result = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = result.data as string[][];
    
    if (rows.length < 5) {
      console.warn('Not enough rows in MPS data');
      return [];
    }
    
    // First pass: collect unique MO and SO numbers from the schedule
    const moNumbers = new Set<string>();
    const soNumbers = new Set<string>();
    
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !String(row[0]).trim()) continue;
      
      const moNumber = String(row[2] ?? '').trim() || '';
      const soNumber = String(row[1] ?? '').trim() || '';
      
      if (moNumber) {
        // Add both original and normalized (no leading zeros) for matching
        moNumbers.add(moNumber);
        moNumbers.add(moNumber.replace(/^0+/, ''));
      }
      if (soNumber) {
        // Add full SO and base (before hyphen) for matching
        soNumbers.add(soNumber);
        const soBase = soNumber.split('-')[0];
        if (soBase) soNumbers.add(soBase);
      }
    }
    
    console.log(`📋 Schedule has ${moNumbers.size} unique MOs, ${soNumbers.size} unique SOs`);
    
    // Fetch only the MISys data we need (filtered by MO/SO numbers)
    // If backend is down, this will return empty data but MPS schedule will still work
    let misysData: MISysData;
    try {
      misysData = await fetchMISysData({
        moNumbers: Array.from(moNumbers),
        soNumbers: Array.from(soNumbers)
      });
    } catch (misysError) {
      console.warn('⚠️ Could not fetch MISys enrichment data (backend may be down), continuing with MPS schedule only:', misysError);
      misysData = { items: [], moHeaders: [], moDetails: [], salesOrders: [] };
    }
    
    // Build lookup maps
    const moMap = new Map<string, any>();
    misysData.moHeaders.forEach(mo => {
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
    misysData.moDetails.forEach(detail => {
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
    misysData.items.forEach(item => {
      const itemNo = item['Item No.'] || item['Item_No'] || item['ItemNumber'];
      if (itemNo) itemMap.set(String(itemNo), item);
    });
    
    const soMap = new Map<string, any>();
    misysData.salesOrders.forEach(so => {
      const soNo = so['SO No.'] || so['SO_No'] || so['SONumber'];
      if (soNo) soMap.set(String(soNo), so);
    });
    
    const orders: MPSOrder[] = [];
    
    // Process data rows (starting from index 4)
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !String(row[0]).trim()) continue;
      
      const moNumber = String(row[2] ?? '').trim() || '';
      const soNumber = String(row[1] ?? '').trim() || '';
      const normalizedMO = moNumber.replace(/^0+/, '');
      
      // Get MO header from MISys
      const moData = moMap.get(normalizedMO) || moMap.get(moNumber);
      const soData = soMap.get(soNumber.split('-')[0]);
      
      // Get MO details (materials/components)
      const moDetailsList = moDetailsMap.get(normalizedMO) || moDetailsMap.get(moNumber) || [];
      
      // Build materials list with stock info - aggregate duplicates
      const materialsMap = new Map<string, MODetail>();
      
      moDetailsList.forEach(detail => {
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
          // CustomAlert5 uses: Stock, WIP, Reserve, On Order (as strings like '0.000000')
          const parseNum = (val: any) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
          
          const stockOnHand = parseNum(itemInfo?.['Stock'] ?? itemInfo?.['Quantity On Hand'] ?? 0);
          const wip = parseNum(itemInfo?.['WIP'] ?? 0);
          const reserve = parseNum(itemInfo?.['Reserve'] ?? 0);
          const onOrder = parseNum(itemInfo?.['On Order'] ?? itemInfo?.['Quantity On Order'] ?? 0);
          // Available = Stock - Reserve (items not reserved for other orders)
          const stockAvailable = stockOnHand - reserve;
          
          materialsMap.set(componentNo, {
            line: materialsMap.size + 1,
            component_item_no: componentNo,
            component_description: itemInfo?.['Description'] || detail['Non-stocked Item Description'] || '',
            required_qty: detail['Required Qty.'] || 0,
            released_qty: detail['Released Qty.'] || 0,
            completed_qty: detail['Completed'] || 0,
            material_cost: detail['Material Cost'] || 0,
            wip: wip,
            source_location: detail['Source Location'] || '',
            // Stock info from CustomAlert5
            stock_on_hand: stockOnHand,
            stock_available: stockAvailable,
            stock_committed: reserve,
            stock_on_order: onOrder,
            unit: itemInfo?.['Stocking Units'] || 'EA'
          });
        }
      });
      
      const materials: MODetail[] = Array.from(materialsMap.values())
        .sort((a, b) => b.required_qty - a.required_qty); // Sort by quantity desc
      
      // Get build item info
      let buildItemData = null;
      if (moData) {
        const buildItemNo = moData['Build Item No.'] || moData['Assembly No.'];
        if (buildItemNo) {
          buildItemData = itemMap.get(String(buildItemNo));
        }
      }

      const order: MPSOrder = {
        line_number: String(row[0] ?? '').trim() || '',
        so_number: soNumber,
        mo_number: moNumber,
        wip: String(row[3] ?? '').trim() || '',
        work_center: String(row[4] ?? '').trim() || 'Unassigned',
        status: String(row[5] ?? '').trim() || '',
        product: String(row[6] ?? '').trim() || '',
        customer_code: String(row[7] ?? '').trim() || '',
        packaging: String(row[8] ?? '').trim() || '',
        required: parseFloat(String(row[9] ?? '').replace(/[^0-9.]/g, '')) || 0,
        ready: parseFloat(String(row[10] ?? '').replace(/[^0-9.]/g, '')) || 0,
        planned_pct: String(row[11] ?? '').trim() || '0%',
        actual_pct: String(row[12] ?? '').trim() || '0%',
        promised_date: String(row[13] ?? '').trim() || '',
        start_date: String(row[14] ?? '').trim() || '',
        end_date: String(row[15] ?? '').trim() || '',
        duration: parseFloat(row[16]) || 0,
        dtc: parseFloat(row[17]) || 0,
        action_items: String(row[18] ?? '').trim() || '',
        
        // Enriched MO data from MISys
        mo_data: moData ? {
          mo_no: moData['Mfg. Order No.'] || '',
          item_no: moData['Build Item No.'] || moData['Assembly No.'] || '',
          description: moData['Description'] || moData['Customer'] || '',
          status: moData['Status'] || '',
          qty_ordered: moData['Ordered'] || 0,
          qty_completed: moData['Completed'] || 0,
          qty_remaining: (moData['Ordered'] || 0) - (moData['Completed'] || 0),
          start_date: formatDisplayDate(moData['Start Date']),
          order_date: formatDisplayDate(moData['Order Date']),
          release_date: formatDisplayDate(moData['Release Date']),
          close_date: formatDisplayDate(moData['Close Date']),
          due_date: formatDisplayDate(moData['Sales Order Ship Date']),
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
          total_overhead_cost: moData['Actual Overhead Cost'] || 0
        } : undefined,
        
        // Materials/components used in this MO
        materials: materials,
        
        // Build item stock info - use CustomAlert5 fields (values are strings)
        item_data: buildItemData ? (() => {
          const parseNum = (val: any) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
          const stock = parseNum(buildItemData['Stock'] ?? buildItemData['Quantity On Hand'] ?? 0);
          const reserve = parseNum(buildItemData['Reserve'] ?? buildItemData['Quantity Committed'] ?? 0);
          return {
            item_no: buildItemData['Item No.'] || '',
            description: buildItemData['Description'] || '',
            qty_on_hand: stock,
            qty_available: stock - reserve,
            qty_on_order: parseNum(buildItemData['On Order'] ?? buildItemData['Quantity On Order'] ?? 0),
            qty_committed: reserve,
            reorder_level: parseNum(buildItemData['Reorder Level'] ?? 0),
            unit: buildItemData['Stocking Units'] || 'EA',
            recent_cost: parseNum(buildItemData['Recent Cost'] ?? 0)
          };
        })() : undefined,
        
        // SO data
        so_data: soData ? {
          so_no: soData['SO No.'] || '',
          customer: soData['Customer'] || soData['Bill To Name'] || '',
          order_date: formatDisplayDate(soData['Order Date']),
          ship_date: formatDisplayDate(soData['Ship Date']),
          status: soData['Status'] || ''
        } : undefined
      };
      
      if (order.so_number) {
        orders.push(order);
      }
    }
    
    console.log(`✅ Loaded ${orders.length} MPS orders with full MISys enrichment`);
    return orders;
    
  } catch (error) {
    console.error('Error fetching MPS data:', error);
    throw error;
  }
}

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('shipped')) return 'bg-green-500';
  if (s.includes('released') || s.includes('production') || s.includes('progress')) return 'bg-blue-500';
  if (s.includes('shortage')) return 'bg-red-500';
  if (s.includes('hold') || s.includes('wait')) return 'bg-yellow-500';
  if (s.includes('schedule')) return 'bg-purple-500';
  return 'bg-slate-500';
}

export function getStatusBgColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('shipped')) return 'bg-green-500/20 text-green-400 border-green-500/50';
  if (s.includes('released') || s.includes('production') || s.includes('progress')) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
  if (s.includes('shortage')) return 'bg-red-500/20 text-red-400 border-red-500/50';
  if (s.includes('hold') || s.includes('wait')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
  if (s.includes('schedule')) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
}
