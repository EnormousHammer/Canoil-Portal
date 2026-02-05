// @ts-ignore - papaparse types issue, but works at runtime
import Papa from 'papaparse';
import { MPSOrder, MODetail } from '../types/mps';
import { getApiUrl } from '../utils/apiConfig';

const SHEET_ID = '1zAOY7ngP2mLVi-W_FL9tsPiKDPqbU6WEUmrrTDeKygw';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Backend API - Use centralized API config (same as rest of app)
const MPS_BACKEND_URL = getApiUrl('');
const CANOIL_API = getApiUrl('/api/data');

export interface MISysData {
  items: any[];
  moHeaders: any[];
  moDetails: any[];
  salesOrders: any[];
}

// Sales Order URL builder - finds and opens SO PDF via portal backend
export function getSOUrl(soNumber: string): string | null {
  if (!soNumber) return null;
  // Extract base SO number (before hyphen) - "3005-2" → "3005"
  const soBase = soNumber.split('-')[0];
  const soNum = soBase.replace(/[^0-9]/g, '');
  if (!soNum) return null;
  // Return the find endpoint - caller will need to fetch this to get PDF path
  return getApiUrl(`/api/sales-orders/find/${soNum}`);
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
      const pdfUrl = getApiUrl(`/api/sales-order-pdf/${encodeURIComponent(data.filePath)}`);
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
  try {
    const hasFilters = filters && (filters.moNumbers?.length || filters.soNumbers?.length);
    
    if (hasFilters) {
      console.log(`📦 Fetching filtered MISys data: ${filters.moNumbers?.length || 0} MOs, ${filters.soNumbers?.length || 0} SOs`);
    } else {
      console.log('📦 Fetching all MISys data...');
    }
    
    // Use POST with filters, or GET for all data
    const apiUrl = hasFilters ? `${CANOIL_API}?force_refresh=true&t=${Date.now()}` : `${CANOIL_API}?t=${Date.now()}`;
    const response = hasFilters 
      ? await fetch(apiUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mo_numbers: filters.moNumbers || [],
            so_numbers: filters.soNumbers || [],
            force_refresh: true
          }),
          cache: 'no-store'
        })
      : await fetch(apiUrl, {
          cache: 'no-store'
        });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const responseData = await response.json();
    const data = responseData.data || responseData;
    
    const result: MISysData = {
      // CustomAlert5.json has the REAL stock data (Stock, WIP, Reserve, On Order)
      items: data['CustomAlert5.json'] || data['Items.json'] || [],
      moHeaders: data['ManufacturingOrderHeaders.json'] || [],
      moDetails: data['ManufacturingOrderDetails.json'] || [],
      salesOrders: data['SalesOrders.json'] || []
    };
    
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

export function clearMISysCache() {
  // No-op: cache is handled by backend, frontend always fetches fresh
}

// Also export as clearMPSCache for backwards compatibility
export function clearMPSCache() {
  // No-op: cache is handled by backend
}

// Parse MISys date format /Date(timestamp)/
function parseMISysDate(dateStr: any): string {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.includes('/Date(')) {
    const match = dateStr.match(/\/Date\((\d+)\)\//);
    if (match) {
      const date = new Date(parseInt(match[1]));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return String(dateStr);
}

export async function fetchMPSData(): Promise<MPSOrder[]> {
  try {
    // Fetch MPS from Google Sheets
    // Aggressive cache-busting to ensure fresh data
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const cacheBusterParams = `t=${timestamp}&r=${random}`;
    
    let csvText: string;
    try {
      // Try backend endpoint first
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const backendResponse = await fetch(`${MPS_BACKEND_URL}/api/mps?${cacheBusterParams}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (backendResponse.ok) {
        // Check content type - backend might return CSV or JSON
        const contentType = backendResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          // Backend returned pre-parsed JSON
          const jsonData = await backendResponse.json();
          if (jsonData.mps_orders && Array.isArray(jsonData.mps_orders)) {
            console.log('✅ Fetched MPS data from backend (JSON format)');
            return await processBackendJsonOrders(jsonData.mps_orders);
          }
        }
        // Otherwise it's CSV
        csvText = await backendResponse.text();
        console.log('✅ Fetched MPS data from backend (CSV format)');
      } else {
        throw new Error('Backend not available');
      }
    } catch (backendError) {
      // Backend not available - fetch directly from Google Sheets
      console.log('⚠️ Backend not available, fetching directly from Google Sheets');
      const response = await fetch(`${CSV_URL}&${cacheBusterParams}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
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
      if (!row[0] || !row[0].trim()) continue;
      
      const moNumber = row[2]?.trim() || '';
      const soNumber = row[1]?.trim() || '';
      
      if (moNumber) {
        moNumbers.add(moNumber);
        moNumbers.add(moNumber.replace(/^0+/, ''));
      }
      if (soNumber) {
        soNumbers.add(soNumber);
        const soBase = soNumber.split('-')[0];
        if (soBase) soNumbers.add(soBase);
      }
    }
    
    console.log(`📋 Schedule has ${moNumbers.size} unique MOs, ${soNumbers.size} unique SOs`);
    
    // Fetch MISys data for enrichment
    let misysData: MISysData;
    try {
      misysData = await fetchMISysData({
        moNumbers: Array.from(moNumbers),
        soNumbers: Array.from(soNumbers)
      });
    } catch (misysError) {
      console.warn('⚠️ Could not fetch MISys enrichment data:', misysError);
      misysData = { items: [], moHeaders: [], moDetails: [], salesOrders: [] };
    }
    
    // Build lookup maps
    const moMap = new Map<string, any>();
    misysData.moHeaders.forEach(mo => {
      const moNo = mo['Mfg. Order No.'] || mo['MO No.'] || mo['MO_No'];
      if (moNo) {
        const normalizedMO = String(moNo).replace(/^0+/, '');
        moMap.set(normalizedMO, mo);
        moMap.set(String(moNo), mo);
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
      if (!row[0] || !row[0].trim()) continue;
      
      const moNumber = row[2]?.trim() || '';
      const soNumber = row[1]?.trim() || '';
      const normalizedMO = moNumber.replace(/^0+/, '');
      
      // Get MO header from MISys
      const moData = moMap.get(normalizedMO) || moMap.get(moNumber);
      const soData = soMap.get(soNumber.split('-')[0]);
      
      // Get MO details (materials/components)
      const moDetailsList = moDetailsMap.get(normalizedMO) || moDetailsMap.get(moNumber) || [];
      
      // Build materials list with stock info - aggregate duplicates
      const materialsMap = new Map<string, MODetail>();
      
      moDetailsList.forEach((detail: any) => {
        const componentNo = detail['Component Item No.'] || '';
        if (!componentNo) return;
        
        const itemInfo = itemMap.get(componentNo);
        
        if (materialsMap.has(componentNo)) {
          const existing = materialsMap.get(componentNo)!;
          existing.required_qty += detail['Required Qty.'] || 0;
          existing.released_qty += detail['Released Qty.'] || 0;
          existing.completed_qty += detail['Completed'] || 0;
          existing.material_cost += detail['Material Cost'] || 0;
        } else {
          const parseNum = (val: any) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
          
          const stockOnHand = parseNum(itemInfo?.['Stock'] ?? itemInfo?.['Quantity On Hand'] ?? 0);
          const wip = parseNum(itemInfo?.['WIP'] ?? 0);
          const reserve = parseNum(itemInfo?.['Reserve'] ?? 0);
          const onOrder = parseNum(itemInfo?.['On Order'] ?? itemInfo?.['Quantity On Order'] ?? 0);
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
            stock_on_hand: stockOnHand,
            stock_available: stockAvailable,
            stock_committed: reserve,
            stock_on_order: onOrder,
            unit: itemInfo?.['Stocking Units'] || 'EA'
          });
        }
      });
      
      const materials: MODetail[] = Array.from(materialsMap.values())
        .sort((a, b) => b.required_qty - a.required_qty);
      
      // Get build item info
      let buildItemData = null;
      if (moData) {
        const buildItemNo = moData['Build Item No.'] || moData['Assembly No.'];
        if (buildItemNo) {
          buildItemData = itemMap.get(String(buildItemNo));
        }
      }

      const order: MPSOrder = {
        line_number: row[0]?.trim() || '',
        so_number: soNumber,
        mo_number: moNumber,
        wip: row[3]?.trim() || '',
        work_center: row[4]?.trim() || 'Unassigned',
        status: row[5]?.trim() || '',
        product: row[6]?.trim() || '',
        customer_code: row[7]?.trim() || '',
        packaging: row[8]?.trim() || '',
        required: parseFloat(row[9]?.replace(/[^0-9.]/g, '')) || 0,
        ready: parseFloat(row[10]?.replace(/[^0-9.]/g, '')) || 0,
        planned_pct: row[11]?.trim() || '0%',
        actual_pct: row[12]?.trim() || '0%',
        promised_date: row[13]?.trim() || '',
        start_date: row[14]?.trim() || '',
        end_date: row[15]?.trim() || '',
        duration: parseFloat(row[16]) || 0,
        dtc: parseFloat(row[17]) || 0,
        action_items: row[18]?.trim() || '',
        
        // Enriched MO data from MISys
        mo_data: moData ? {
          mo_no: moData['Mfg. Order No.'] || '',
          item_no: moData['Build Item No.'] || moData['Assembly No.'] || '',
          description: moData['Description'] || moData['Customer'] || '',
          status: moData['Status'] || '',
          qty_ordered: moData['Ordered'] || 0,
          qty_completed: moData['Completed'] || 0,
          qty_remaining: (moData['Ordered'] || 0) - (moData['Completed'] || 0),
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
          total_overhead_cost: moData['Actual Overhead Cost'] || 0
        } : undefined,
        
        materials: materials,
        
        // Build item stock info
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
          order_date: parseMISysDate(soData['Order Date']),
          ship_date: parseMISysDate(soData['Ship Date']),
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

// Process backend JSON format (when backend returns pre-parsed JSON)
async function processBackendJsonOrders(backendOrders: any[]): Promise<MPSOrder[]> {
  // Collect unique MO and SO numbers
  const moNumbers = new Set<string>();
  const soNumbers = new Set<string>();
  
  backendOrders.forEach((order: any) => {
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
  
  // Fetch MISys data for enrichment
  let misysData: MISysData;
  try {
    misysData = await fetchMISysData({
      moNumbers: Array.from(moNumbers),
      soNumbers: Array.from(soNumbers)
    });
  } catch (misysError) {
    console.warn('⚠️ Could not fetch MISys enrichment data:', misysError);
    misysData = { items: [], moHeaders: [], moDetails: [], salesOrders: [] };
  }
  
  // Build lookup maps
  const moMap = new Map<string, any>();
  misysData.moHeaders.forEach(mo => {
    const moNo = mo['Mfg. Order No.'] || mo['MO No.'] || mo['MO_No'];
    if (moNo) {
      const normalizedMO = String(moNo).replace(/^0+/, '');
      moMap.set(normalizedMO, mo);
      moMap.set(String(moNo), mo);
    }
  });
  
  const moDetailsMap = new Map<string, any[]>();
  misysData.moDetails.forEach(detail => {
    const moNo = detail['Mfg. Order No.'] || detail['MO No.'];
    if (moNo) {
      const normalizedMO = String(moNo).replace(/^0+/, '');
      if (!moDetailsMap.has(normalizedMO)) moDetailsMap.set(normalizedMO, []);
      moDetailsMap.get(normalizedMO)!.push(detail);
      if (!moDetailsMap.has(String(moNo))) moDetailsMap.set(String(moNo), []);
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
  
  const parseNum = (val: any) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  
  const orders: MPSOrder[] = [];
  
  for (const backendOrder of backendOrders) {
    const moNumber = backendOrder.mo_number || '';
    const soNumber = backendOrder.so_number || '';
    const normalizedMO = moNumber.replace(/^0+/, '');
    
    const moData = moMap.get(normalizedMO) || moMap.get(moNumber);
    const soData = soMap.get(soNumber.split('-')[0]);
    const moDetailsList = moDetailsMap.get(normalizedMO) || moDetailsMap.get(moNumber) || [];
    
    // Build materials list
    const materialsMap = new Map<string, MODetail>();
    
    moDetailsList.forEach((detail: any) => {
      const componentNo = detail['Component Item No.'] || '';
      if (!componentNo) return;
      
      const itemInfo = itemMap.get(componentNo);
      
      if (materialsMap.has(componentNo)) {
        const existing = materialsMap.get(componentNo)!;
        existing.required_qty += detail['Required Qty.'] || 0;
        existing.released_qty += detail['Released Qty.'] || 0;
        existing.completed_qty += detail['Completed'] || 0;
        existing.material_cost += detail['Material Cost'] || 0;
      } else {
        const stockOnHand = parseNum(itemInfo?.['Stock'] ?? itemInfo?.['Quantity On Hand'] ?? 0);
        const wip = parseNum(itemInfo?.['WIP'] ?? 0);
        const reserve = parseNum(itemInfo?.['Reserve'] ?? 0);
        const onOrder = parseNum(itemInfo?.['On Order'] ?? itemInfo?.['Quantity On Order'] ?? 0);
        
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
          stock_on_hand: stockOnHand,
          stock_available: stockOnHand - reserve,
          stock_committed: reserve,
          stock_on_order: onOrder,
          unit: itemInfo?.['Stocking Units'] || 'EA'
        });
      }
    });
    
    const materials: MODetail[] = Array.from(materialsMap.values())
      .sort((a, b) => b.required_qty - a.required_qty);
    
    // Get build item info
    let buildItemData = null;
    if (moData) {
      const buildItemNo = moData['Build Item No.'] || moData['Assembly No.'];
      if (buildItemNo) {
        buildItemData = itemMap.get(String(buildItemNo));
      }
    }
    
    const order: MPSOrder = {
      line_number: backendOrder.order_number || '',
      so_number: soNumber,
      mo_number: moNumber,
      wip: backendOrder.wip || '',
      work_center: backendOrder.work_center || 'Unassigned',
      status: backendOrder.status || '',
      product: backendOrder.product || '',
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
      
      mo_data: moData ? {
        mo_no: moData['Mfg. Order No.'] || '',
        item_no: moData['Build Item No.'] || moData['Assembly No.'] || '',
        description: moData['Description'] || moData['Customer'] || '',
        status: moData['Status'] || '',
        qty_ordered: moData['Ordered'] || 0,
        qty_completed: moData['Completed'] || 0,
        qty_remaining: (moData['Ordered'] || 0) - (moData['Completed'] || 0),
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
        total_overhead_cost: moData['Actual Overhead Cost'] || 0
      } : undefined,
      
      materials: materials,
      
      item_data: buildItemData ? (() => {
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
      
      so_data: soData ? {
        so_no: soData['SO No.'] || '',
        customer: soData['Customer'] || soData['Bill To Name'] || '',
        order_date: parseMISysDate(soData['Order Date']),
        ship_date: parseMISysDate(soData['Ship Date']),
        status: soData['Status'] || ''
      } : undefined
    };
    
    if (order.so_number) {
      orders.push(order);
    }
  }
  
  console.log(`✅ Processed ${orders.length} MPS orders from backend JSON`);
  return orders;
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
