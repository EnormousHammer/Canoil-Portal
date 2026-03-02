import Papa from 'papaparse';

const SHEET_ID = '1J0PRpr9IKqgPaxUudZZ8Wfkrgz92jtQWla-Zm7L3cNI';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const IS_PRODUCTION = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
const BACKEND_URL = import.meta.env.VITE_MPS_BACKEND_URL || import.meta.env.VITE_API_URL || (IS_PRODUCTION
  ? window.location.origin
  : 'http://localhost:5002');

export interface Shipment {
  so_number: string;
  sales_location: string;
  customer: string;
  status: string;
  shipping_terms: string;
  destination: string;
  invoice_qty: string;
  freight_rate: string;
  customs_duty: string;
  order_completion: string;
  scheduled_pickup: string;
  days_left: number | null;
  actual_pickup: string;
  invoice_date: string;
  invoice_number: string;
  notes: string;
}

/*
  CSV column layout (row 8 = headers, data starts row 9):
  [0]  SO
  [1]  Sales Location
  [2]  Customer
  [3]  Status
  [4]  Shipping Terms
  [5]  Destination
  [6]  Invoice Qty.
  [7]  Freight Rate
  [8]  Customs Duty
  [9]  Order Completion
  [10] Scheduled Pickup
  [11] Days Left          <-- calculated column in sheet
  [12] Actual Pickup
  [13] Invoice Date
  [14] Invoice No.
  [15] Notes
*/

export async function fetchShipmentsData(gid?: string): Promise<Shipment[]> {
  try {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const cacheBusterParams = `t=${timestamp}&r=${random}`;

    let csvText: string;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const gidParam = gid ? `&gid=${gid}` : '';
      const backendResponse = await fetch(`${BACKEND_URL}/api/shipments?format=csv${gidParam}&${cacheBusterParams}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (backendResponse.ok) {
        csvText = await backendResponse.text();
      } else {
        throw new Error('Backend not available');
      }
    } catch {
      const gidParam = gid ? `&gid=${gid}` : '';
      const response = await fetch(`${CSV_URL}${gidParam}&${cacheBusterParams}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Shipments data: ${response.status} ${response.statusText}`);
      }

      csvText = await response.text();
    }

    const cleanCsv = csvText
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã®/g, 'î')
      .replace(/â/g, '№');

    const result = Papa.parse(cleanCsv, { header: false, skipEmptyLines: true });
    const rows = result.data as string[][];

    if (rows.length < 10) {
      return [];
    }

    const shipments: Shipment[] = [];

    for (let i = 9; i < rows.length; i++) {
      const row = rows[i];
      const soNum = String(row[0] ?? '').trim();
      if (!soNum) continue;

      const daysLeftRaw = String(row[11] ?? '').trim();
      const daysLeft = daysLeftRaw ? parseInt(daysLeftRaw, 10) : null;

      shipments.push({
        so_number: soNum,
        sales_location: String(row[1] ?? '').trim(),
        customer: String(row[2] ?? '').trim(),
        status: String(row[3] ?? '').trim(),
        shipping_terms: String(row[4] ?? '').trim(),
        destination: String(row[5] ?? '').trim(),
        invoice_qty: String(row[6] ?? '').trim(),
        freight_rate: String(row[7] ?? '').trim(),
        customs_duty: String(row[8] ?? '').trim(),
        order_completion: String(row[9] ?? '').trim(),
        scheduled_pickup: String(row[10] ?? '').trim(),
        days_left: isNaN(daysLeft as number) ? null : daysLeft,
        actual_pickup: String(row[12] ?? '').trim(),
        invoice_date: String(row[13] ?? '').trim(),
        invoice_number: String(row[14] ?? '').trim(),
        notes: String(row[15] ?? '').trim(),
      });
    }

    return shipments;

  } catch (error) {
    console.error('Error fetching Shipments data:', error);
    throw error;
  }
}

export function getStatusCategory(status: string): 'shipped' | 'ready' | 'on-schedule' | 'late' | 'very-late' | 'unscheduled' | 'other' {
  const s = status.toLowerCase();
  if (s.includes('shipped')) return 'shipped';
  if (s.includes('ready')) return 'ready';
  if (s.includes('very late')) return 'very-late';
  if (s.includes('late')) return 'late';
  if (s.includes('on schedule')) return 'on-schedule';
  if (s.includes('unscheduled')) return 'unscheduled';
  return 'other';
}

export function getDestinationType(destination: string): 'domestic' | 'transborder' | 'international' | 'other' {
  const d = destination.toLowerCase();
  if (d.includes('domestic')) return 'domestic';
  if (d.includes('transborder')) return 'transborder';
  if (d.includes('international')) return 'international';
  return 'other';
}
