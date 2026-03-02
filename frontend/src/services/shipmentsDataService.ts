import Papa from 'papaparse';

const SHEET_ID = '1J0PRpr9IKqgPaxUudZZ8Wfkrgz92jtQWla-Zm7L3cNI';

const IS_PRODUCTION = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
const BACKEND_URL = import.meta.env.VITE_MPS_BACKEND_URL || import.meta.env.VITE_API_URL || (IS_PRODUCTION
  ? window.location.origin
  : 'http://localhost:5002');

export const YEAR_TABS: { year: number; gid: string }[] = [
  { year: 2026, gid: '1884841172' },
  { year: 2025, gid: '1275719913' },
  { year: 2024, gid: '1950607072' },
  { year: 2023, gid: '0' },
];

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
  [0]  SO               [8]  Customs Duty
  [1]  Sales Location   [9]  Order Completion
  [2]  Customer         [10] Scheduled Pickup
  [3]  Status           [11] Days Left
  [4]  Shipping Terms   [12] Actual Pickup
  [5]  Destination      [13] Invoice Date
  [6]  Invoice Qty.     [14] Invoice No.
  [7]  Freight Rate     [15] Notes
*/

export async function fetchShipmentsData(gid: string): Promise<Shipment[]> {
  const timestamp = Date.now();
  const cacheBuster = `t=${timestamp}&r=${Math.random().toString(36).substring(7)}`;

  let csvText: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`${BACKEND_URL}/api/shipments?gid=${gid}&${cacheBuster}`, {
      method: 'GET', cache: 'no-store', signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error('Backend error');
    csvText = await resp.text();
  } catch {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&${cacheBuster}`;
    const resp = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'follow' });
    if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
    csvText = await resp.text();
  }

  const cleanCsv = csvText.replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ã´/g, 'ô').replace(/Ã®/g, 'î').replace(/â/g, '№');
  const result = Papa.parse(cleanCsv, { header: false, skipEmptyLines: true });
  const rows = result.data as string[][];
  if (rows.length < 10) return [];

  const shipments: Shipment[] = [];
  for (let i = 9; i < rows.length; i++) {
    const row = rows[i];
    const soNum = String(row[0] ?? '').trim();
    if (!soNum || soNum === 'SO') continue;

    const daysRaw = String(row[11] ?? '').trim();
    const daysLeft = daysRaw ? parseInt(daysRaw, 10) : null;

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
}

export function categorizeStatus(status: string): 'shipped' | 'ready' | 'scheduled' | 'late' | 'unscheduled' | 'other' {
  const s = status.toLowerCase();
  if (s.includes('shipped')) return 'shipped';
  if (s.includes('ready')) return 'ready';
  if (s.includes('very late') || s.includes('late')) return 'late';
  if (s.includes('on schedule')) return 'scheduled';
  if (s.includes('unscheduled')) return 'unscheduled';
  return 'other';
}
