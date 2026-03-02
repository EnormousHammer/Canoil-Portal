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
  actual_pickup: string;
  invoice_date: string;
  invoice_number: string;
  notes: string;
}

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
        console.log('Fetched Shipments data from backend');
      } else {
        throw new Error('Backend not available');
      }
    } catch {
      console.log('Backend not available, fetching directly from Google Sheets');
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
      console.log('Fetched Shipments data directly from Google Sheets');
    }

    const cleanCsv = csvText
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã®/g, 'î');

    const result = Papa.parse(cleanCsv, { header: false, skipEmptyLines: true });
    const rows = result.data as string[][];

    if (rows.length < 10) {
      console.warn('Not enough rows in Shipments data');
      return [];
    }

    // Row 9 (index 8) has headers: SO, Sales Location, Customer, Status, Shipping Terms, Destination, Invoice Qty., Freight Rate, Customs Duty, Order Completion, Scheduled Pickup, Actual Pickup, Invoice Date, Invoice No, Notes
    // Data starts from row 10 (index 9)
    const shipments: Shipment[] = [];

    for (let i = 9; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !String(row[0]).trim()) continue;

      const shipment: Shipment = {
        so_number: String(row[0] ?? '').trim(),
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
        actual_pickup: String(row[11] ?? '').trim(),
        invoice_date: String(row[12] ?? '').trim(),
        invoice_number: String(row[13] ?? '').trim(),
        notes: String(row[14] ?? '').trim(),
      };

      if (shipment.so_number) {
        shipments.push(shipment);
      }
    }

    console.log(`Loaded ${shipments.length} shipments`);
    return shipments;

  } catch (error) {
    console.error('Error fetching Shipments data:', error);
    throw error;
  }
}

export function getShipmentStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('shipped') && s.includes('invoiced')) return 'bg-green-500';
  if (s.includes('shipped')) return 'bg-blue-500';
  if (s.includes('ready')) return 'bg-cyan-500';
  if (s.includes('schedule') || s.includes('on schedule')) return 'bg-purple-500';
  if (s.includes('late')) return 'bg-red-500';
  if (s.includes('very late')) return 'bg-red-700';
  if (s.includes('unscheduled')) return 'bg-yellow-500';
  return 'bg-slate-500';
}

export function getShipmentStatusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('shipped') && s.includes('invoiced')) return 'bg-green-500/20 text-green-400 border-green-500/50';
  if (s.includes('shipped')) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
  if (s.includes('ready')) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
  if (s.includes('on schedule')) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
  if (s.includes('very late')) return 'bg-red-700/20 text-red-400 border-red-700/50';
  if (s.includes('late')) return 'bg-red-500/20 text-red-400 border-red-500/50';
  if (s.includes('unscheduled')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
}

export function getDestinationBadge(destination: string): string {
  const d = destination.toLowerCase();
  if (d.includes('domestic')) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
  if (d.includes('transborder')) return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
  if (d.includes('international')) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
}
