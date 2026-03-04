import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw, Factory, ChevronLeft, ChevronRight, Calendar, AlertTriangle,
  X, Info, HelpCircle, Download, ChevronDown, Filter, Search,
  LayoutList, BarChart3, Package, Wrench, ChevronUp, Clock, ExternalLink,
  Eye, FileText, Activity
} from 'lucide-react';
import { fetchMPSData, invalidateMPSCache, openSalesOrder, getSOUrl } from '../services/mpsDataService';
import { MPSOrder } from '../types/mps';
import { format, addDays, startOfWeek, differenceInDays, parseISO, isValid } from 'date-fns';
import { exportToCSV, exportToJSON, exportToExcel, exportFullDataToJSON, exportMaterialsToCSV } from '../services/exportService';

const CUSTOMER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'lanxess': { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-100' },
  'lubecore': { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-100' },
  'petro-canada': { bg: 'bg-red-500', border: 'border-red-400', text: 'text-red-100' },
  'robco': { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-100' },
  'shell': { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-900' },
  'mobil': { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-100' },
  'chevron': { bg: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-100' },
  'castrol': { bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-100' },
  'total': { bg: 'bg-rose-500', border: 'border-rose-400', text: 'text-rose-100' },
  'bp': { bg: 'bg-lime-500', border: 'border-lime-400', text: 'text-lime-900' },
  'esso': { bg: 'bg-indigo-500', border: 'border-indigo-400', text: 'text-indigo-100' },
  'valvoline': { bg: 'bg-fuchsia-500', border: 'border-fuchsia-400', text: 'text-fuchsia-100' },
  'pennzoil': { bg: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-900' },
  'quaker': { bg: 'bg-teal-500', border: 'border-teal-400', text: 'text-teal-100' },
  'fuchs': { bg: 'bg-sky-500', border: 'border-sky-400', text: 'text-sky-100' },
};

const FALLBACK_COLORS = [
  { bg: 'bg-violet-500', border: 'border-violet-400', text: 'text-violet-100' },
  { bg: 'bg-pink-500', border: 'border-pink-400', text: 'text-pink-100' },
  { bg: 'bg-slate-500', border: 'border-slate-400', text: 'text-slate-100' },
  { bg: 'bg-stone-500', border: 'border-stone-400', text: 'text-stone-100' },
  { bg: 'bg-zinc-500', border: 'border-zinc-400', text: 'text-zinc-100' },
];

function getCustomerColor(product: string): { bg: string; border: string; text: string } {
  const productLower = product.toLowerCase();
  for (const [customer, colors] of Object.entries(CUSTOMER_COLORS)) {
    if (productLower.includes(customer)) return colors;
  }
  let hash = 0;
  for (let i = 0; i < product.length; i++) {
    hash = ((hash << 5) - hash) + product.charCodeAt(i);
    hash = hash & hash;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\w+),?\s+(\w+)\s+(\d+)/);
  if (match) {
    const [, , month, day] = match;
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const monthNum = monthMap[month];
    if (monthNum !== undefined) {
      const year = new Date().getFullYear();
      return new Date(year, monthNum, parseInt(day));
    }
  }
  try {
    const parsed = parseISO(dateStr);
    if (isValid(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
}

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes('shortage')) return { classes: 'bg-red-50 text-red-700 border border-red-200', icon: true };
  if (s.includes('released') || s.includes('production') || s.includes('progress')) return { classes: 'bg-blue-50 text-blue-700 border border-blue-200', icon: false };
  if (s.includes('complete') || s.includes('done') || s.includes('shipped')) return { classes: 'bg-green-50 text-green-700 border border-green-200', icon: false };
  if (s.includes('hold') || s.includes('wait')) return { classes: 'bg-yellow-50 text-yellow-700 border border-yellow-200', icon: false };
  return { classes: 'bg-gray-50 text-gray-600 border border-gray-200', icon: false };
}

function getProgressColor(pct: number) {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 75) return 'bg-blue-500';
  if (pct >= 50) return 'bg-yellow-500';
  if (pct > 0) return 'bg-orange-500';
  return 'bg-slate-600';
}

function getDtcStyle(dtc: number) {
  if (dtc <= 1) return 'text-red-600 font-bold';
  if (dtc <= 3) return 'text-amber-600 font-semibold';
  return 'text-green-600';
}

const LANE_HEIGHT = 52;

export function ProductionScheduleMPS() {
  const [orders, setOrders] = useState<MPSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedOrder, setSelectedOrder] = useState<MPSOrder | null>(null);
  const [viewDays, setViewDays] = useState(14);
  const [showLegend, setShowLegend] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [filterShortageOnly, setFilterShortageOnly] = useState(false);
  const [filterAtRiskOnly, setFilterAtRiskOnly] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterWorkCenter, setFilterWorkCenter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [collapsedWCs, setCollapsedWCs] = useState<Set<string>>(new Set());

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) invalidateMPSCache();
      const data = await fetchMPSData(force);
      setOrders(data);
      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => setSecondsSinceUpdate((prev: number) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedOrder) setSelectedOrder(null);
      else if (showPdfViewer) setShowPdfViewer(false);
      else if (showLegend) setShowLegend(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedOrder, showPdfViewer, showLegend]);

  const days = useMemo(() => {
    return Array.from({ length: viewDays }, (_, i) => addDays(weekStart, i));
  }, [weekStart, viewDays]);

  const columnWidth = useMemo(() => {
    if (viewDays <= 7) return 112;
    if (viewDays <= 14) return 90;
    if (viewDays <= 21) return 70;
    return 56;
  }, [viewDays]);

  const isOrderAtRisk = useCallback((order: MPSOrder): boolean => {
    if (order.status.toLowerCase().includes('shortage')) return true;
    // Only flag if DTC is a real positive value ≤ 2 — a missing/zero DTC means
    // no schedule data, not that the order is almost due.
    if (order.dtc != null && order.dtc > 0 && order.dtc <= 2) return true;
    const promised = parseDate(order.promised_date || order.promised || '');
    if (promised) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const p = new Date(promised);
      p.setHours(0, 0, 0, 0);
      if (p < today) return true;
    }
    return false;
  }, []);

  const filteredOrders = useMemo(() => {
    let list = orders;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        (o.so_number && o.so_number.toLowerCase().includes(q)) ||
        (o.mo_number && o.mo_number.toLowerCase().includes(q)) ||
        (o.product && o.product.toLowerCase().includes(q)) ||
        (o.customer_code && o.customer_code.toLowerCase().includes(q)) ||
        (o.so_data?.customer && String(o.so_data.customer).toLowerCase().includes(q)) ||
        (o.product.includes(' - ') && o.product.split(' - ')[0].toLowerCase().includes(q))
      );
    }
    if (filterShortageOnly) list = list.filter(o => o.status.toLowerCase().includes('shortage'));
    if (filterAtRiskOnly) list = list.filter(o => isOrderAtRisk(o));
    if (filterCustomer) list = list.filter(o => {
      const m = o.product.match(/^(.+?)\s*-\s+/);
      const cust = (m ? m[1].trim() : '') || o.mo_data?.customer || o.so_data?.customer || o.customer_code || '';
      return cust.toLowerCase().includes(filterCustomer.toLowerCase());
    });
    if (filterWorkCenter) list = list.filter(o => o.work_center === filterWorkCenter);
    return list;
  }, [orders, searchQuery, filterShortageOnly, filterAtRiskOnly, filterCustomer, filterWorkCenter, isOrderAtRisk]);

  const kpi = useMemo(() => {
    const shortageCount = orders.filter(o => o.status.toLowerCase().includes('shortage')).length;
    const atRiskCount = orders.filter(o => isOrderAtRisk(o)).length;
    return { total: orders.length, shortageCount, atRiskCount };
  }, [orders, isOrderAtRisk]);

  const workCenters = useMemo(() => {
    const wcs = new Set(filteredOrders.map(o => o.work_center).filter(Boolean));
    return Array.from(wcs).sort();
  }, [filteredOrders]);

  const filterOptions = useMemo(() => {
    const wcs = new Set(orders.map(o => o.work_center).filter(Boolean));
    const customers = new Map<string, number>();
    orders.forEach(o => {
      const m = o.product.match(/^(.+?)\s*-\s+/);
      const name = (m ? m[1].trim() : '') || o.mo_data?.customer || o.so_data?.customer || o.customer_code || 'Other';
      if (name) customers.set(name, (customers.get(name) || 0) + 1);
    });
    return {
      workCenters: Array.from(wcs).sort(),
      customers: Array.from(customers.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name)
    };
  }, [orders]);

  const customerLegend = useMemo(() => {
    const customers = new Map<string, { bg: string; count: number }>();
    filteredOrders.forEach(order => {
      const m = order.product.match(/^(.+?)\s*-\s+/);
      let customerName = (m ? m[1].trim() : '') || order.mo_data?.customer || order.so_data?.customer || order.customer_code || 'Other';
      if (customerName.length > 20) customerName = customerName.substring(0, 20) + '...';
      const colors = getCustomerColor(order.product);
      const existing = customers.get(customerName);
      if (existing) existing.count++;
      else customers.set(customerName, { bg: colors.bg, count: 1 });
    });
    return Array.from(customers.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [filteredOrders]);

  const getCustomerName = useCallback((order: MPSOrder) => {
    // Product field format is "CompanyName - ProductDesc" or "CompanyName- ProductDesc"
    // Use a regex that handles both "Company - " and "Company- " (no space before hyphen)
    const match = order.product.match(/^(.+?)\s*-\s+/);
    const fromProduct = match ? match[1].trim() : '';
    return fromProduct ||
      order.mo_data?.customer ||
      order.so_data?.customer ||
      order.customer_code || '';
  }, []);

  const getTimelineOrders = useCallback((wc: string) => {
    const wcOrders = filteredOrders
      .filter(o => o.work_center === wc)
      .map(order => {
        const startDate = parseDate(order.start_date);
        const endDate = parseDate(order.end_date);
        const promisedDate = parseDate(order.promised_date);
        const effectiveStart = startDate || promisedDate || new Date();
        const effectiveEnd = endDate || promisedDate || effectiveStart;
        const startOffset = differenceInDays(effectiveStart, weekStart);
        const duration = Math.max(1, differenceInDays(effectiveEnd, effectiveStart) + 1);
        return {
          ...order,
          startOffset,
          duration,
          effectiveStart,
          effectiveEnd,
          isShortage: order.status.toLowerCase().includes('shortage'),
          isAtRisk: isOrderAtRisk(order),
          lane: 0
        };
      })
      .filter(o => o.startOffset + o.duration > 0 && o.startOffset < viewDays);

    const sorted = [...wcOrders].sort((a, b) => a.startOffset - b.startOffset);
    const laneEnds: number[] = [];
    sorted.forEach(order => {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > order.startOffset) lane++;
      order.lane = lane;
      laneEnds[lane] = order.startOffset + order.duration;
    });
    return { orders: sorted, laneCount: Math.max(laneEnds.length, 1) };
  }, [filteredOrders, weekStart, viewDays, isOrderAtRisk]);

  const navigateWeek = (direction: number) => setWeekStart((prev: Date) => addDays(prev, direction * 7));
  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const toggleWC = (wc: string) => {
    setCollapsedWCs(prev => {
      const next = new Set(prev);
      if (next.has(wc)) next.delete(wc);
      else next.add(wc);
      return next;
    });
  };

  const clearFilters = () => {
    setFilterShortageOnly(false);
    setFilterAtRiskOnly(false);
    setFilterWorkCenter('');
    setFilterCustomer('');
    setSearchQuery('');
  };

  const hasActiveFilters = filterShortageOnly || filterAtRiskOnly || filterWorkCenter || filterCustomer || searchQuery.trim();

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Factory className="w-16 h-16 text-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-slate-700 text-xl">Loading Production Schedule...</p>
          <p className="text-slate-400 text-sm mt-2">Fetching live MPS data</p>
        </div>
      </div>
    );
  }

  const todayOffset = differenceInDays(new Date(), weekStart);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Factory className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Production Schedule</h1>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500">
                  {filteredOrders.length === orders.length
                    ? `${orders.length} orders`
                    : `${filteredOrders.length} of ${orders.length} orders`}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-green-600 text-xs font-medium">LIVE</span>
                  <span className="text-slate-400 text-xs">
                    {loading ? 'Syncing...' :
                      secondsSinceUpdate < 3 ? 'Just updated' :
                      `${secondsSinceUpdate}s ago`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 rounded-lg border border-gray-200 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutList className="w-4 h-4" />
                Table
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'timeline' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Timeline
              </button>
            </div>

            {viewMode === 'timeline' && (
              <>
                <select
                  value={viewDays}
                  onChange={(e) => setViewDays(parseInt(e.target.value))}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-slate-700 text-sm"
                >
                  <option value={7}>1 Week</option>
                  <option value={14}>2 Weeks</option>
                  <option value={21}>3 Weeks</option>
                  <option value={28}>4 Weeks</option>
                </select>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 border border-gray-200">
                  <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-200 rounded">
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <button onClick={goToToday} className="px-3 py-1 hover:bg-gray-200 rounded text-slate-700 text-sm font-medium">
                    Today
                  </button>
                  <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-200 rounded">
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => setShowLegend(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              title="Production Capacity & Legend"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Export menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                title="Export Data"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="py-1">
                      {[
                        { label: 'Export to CSV', fn: () => exportToCSV(orders) },
                        { label: 'Export to Excel', fn: () => exportToExcel(orders) },
                        { label: 'Export to JSON', fn: () => exportToJSON(orders) },
                        { label: 'Export Full Data (JSON)', fn: () => exportFullDataToJSON(orders) },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={() => { item.fn(); setShowExportMenu(false); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              title="Force refresh from server"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI + Filters ──────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* KPI stat chips */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
              <span className="text-slate-800 font-bold text-sm tabular-nums">{kpi.total}</span>
              <span className="text-slate-500 text-xs">orders</span>
            </div>
            <button
              onClick={() => { setFilterShortageOnly(v => !v); setFilterAtRiskOnly(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                filterShortageOnly
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : kpi.shortageCount > 0
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-default'
              }`}
              disabled={kpi.shortageCount === 0}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-bold tabular-nums">{kpi.shortageCount}</span>
              <span className={`text-xs ${filterShortageOnly ? 'text-red-100' : 'text-red-500'}`}>
                shortage{kpi.shortageCount !== 1 ? 's' : ''}
              </span>
            </button>
            <button
              onClick={() => { setFilterAtRiskOnly(v => !v); setFilterShortageOnly(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                filterAtRiskOnly
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : kpi.atRiskCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-default'
              }`}
              disabled={kpi.atRiskCount === 0}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="font-bold tabular-nums">{kpi.atRiskCount}</span>
              <span className={`text-xs ${filterAtRiskOnly ? 'text-amber-100' : 'text-amber-600'}`}>at risk</span>
            </button>
          </div>
          <div className="h-5 w-px bg-gray-200" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search SO, MO, product, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 text-sm w-64 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={filterWorkCenter}
              onChange={(e) => setFilterWorkCenter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm"
            >
              <option value="">All work centers</option>
              {filterOptions.workCenters.map(wc => (
                <option key={wc} value={wc}>{wc}</option>
              ))}
            </select>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-slate-700 text-sm max-w-[180px]"
            >
              <option value="">All customers</option>
              {filterOptions.customers.map(c => (
                <option key={c} value={c}>{c.length > 22 ? c.slice(0, 22) + '\u2026' : c}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-2 py-1 text-slate-400 hover:text-slate-700 text-sm" title="Clear filters">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Customer legend — scrollable filter chips ──────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap flex-shrink-0">
            Customers
          </span>
          {customerLegend.map(([name, { bg, count }]) => (
            <button
              key={name}
              onClick={() => setFilterCustomer(filterCustomer === name ? '' : name)}
              title={`${name} — ${count} order${count !== 1 ? 's' : ''}`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs rounded-full px-3 py-1 border transition-all flex-shrink-0 ${
                filterCustomer === name
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-gray-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bg}`} />
              {name}
              <span className={`font-semibold ${filterCustomer === name ? 'text-blue-200' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          ))}
          {filterCustomer && (
            <button
              onClick={() => setFilterCustomer('')}
              className="text-slate-400 hover:text-slate-700 text-xs whitespace-nowrap flex-shrink-0 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Filter className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium text-slate-700">No orders match the current filters</p>
            <p className="text-sm mt-1">Try clearing filters or search to see all orders.</p>
            <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg text-sm">
              Clear filters
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* ────── TABLE VIEW ────── */
          <div className="space-y-6">
            {workCenters.map(wc => {
              const wcOrders = filteredOrders.filter(o => o.work_center === wc);
              const collapsed = collapsedWCs.has(wc);
              const wcShortages = wcOrders.filter(o => o.status.toLowerCase().includes('shortage')).length;
              const wcAtRisk = wcOrders.filter(o => isOrderAtRisk(o)).length;
              const wcComplete = wcOrders.filter(o => o.status.toLowerCase().includes('complete') || (parseFloat(o.actual_pct) || 0) >= 100).length;
              return (
                <div key={wc} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Work center header */}
                  <button
                    onClick={() => toggleWC(wc)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors border-b border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold tracking-widest min-w-[52px] text-center shadow-sm">
                        {wc}
                      </span>
                      <span className="text-slate-700 font-semibold text-sm">
                        {wcOrders.length} order{wcOrders.length !== 1 ? 's' : ''}
                      </span>
                      {wcComplete > 0 && (
                        <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          {wcComplete} done
                        </span>
                      )}
                      {wcShortages > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          {wcShortages} shortage{wcShortages !== 1 ? 's' : ''}
                        </span>
                      )}
                      {wcAtRisk > 0 && wcAtRisk !== wcShortages && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          <Clock className="w-3 h-3" />
                          {wcAtRisk} at risk
                        </span>
                      )}
                    </div>
                    {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                  </button>

                  {!collapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-gray-200 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                            <th className="pl-4 pr-2 py-3 text-left w-14"></th>
                            <th className="px-3 py-3 text-left w-24">SO</th>
                            <th className="px-3 py-3 text-left w-20">MO</th>
                            <th className="px-3 py-3 text-left w-40">Status</th>
                            <th className="px-3 py-3 text-left min-w-[260px]">Product</th>
                            <th className="px-3 py-3 text-left min-w-[180px]">Customer</th>
                            <th className="px-3 py-3 text-right w-24">Required</th>
                            <th className="px-3 py-3 text-right w-20">Ready</th>
                            <th className="px-3 py-3 text-center w-40">Progress</th>
                            <th className="px-3 py-3 text-left w-28">Start</th>
                            <th className="px-3 py-3 text-left w-24">End</th>
                            <th className="px-3 py-3 text-left w-28">Promised</th>
                            <th className="px-3 py-3 text-center w-16">DTC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/80">
                          {wcOrders.map((order, idx) => {
                            const actualPct = parseFloat(order.actual_pct) || 0;
                            const atRisk = isOrderAtRisk(order);
                            const isShortage = order.status.toLowerCase().includes('shortage');
                            const badge = getStatusBadge(order.status);
                            const custName = getCustomerName(order);

                            return (
                              <tr
                                key={`${order.so_number}-${idx}`}
                                onClick={() => setSelectedOrder(order)}
                                className={`cursor-pointer transition-all border-l-4 group ${
                                  isShortage
                                    ? 'border-l-red-500 bg-red-50/20 hover:bg-red-50/50'
                                    : atRisk
                                    ? 'border-l-amber-400 bg-amber-50/20 hover:bg-amber-50/50'
                                    : 'border-l-transparent hover:bg-blue-50/40 hover:border-l-blue-300'
                                }`}
                              >
                                {/* Line # + indicator */}
                                <td className="pl-4 pr-2 py-3 w-14">
                                  <span className="text-slate-400 text-xs font-mono">{order.line_number || '—'}</span>
                                </td>
                                {/* SO */}
                                <td className="px-3 py-3">
                                  <span className="text-blue-600 font-mono text-xs font-semibold tracking-tight">{order.so_number}</span>
                                </td>
                                {/* MO */}
                                <td className="px-3 py-3">
                                  <span className="text-violet-600 font-mono text-xs">{order.mo_number}</span>
                                </td>
                                {/* Status */}
                                <td className="px-3 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}>
                                    {badge.icon && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                                    {order.status}
                                  </span>
                                </td>
                                {/* Product — full text, wraps gracefully */}
                                <td className="px-3 py-3 min-w-[260px] max-w-[320px]">
                                  <span className="text-slate-800 text-sm leading-snug block" title={order.product}>
                                    {order.product}
                                  </span>
                                </td>
                                {/* Customer */}
                                <td className="px-3 py-3 min-w-[180px]">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getCustomerColor(order.product).bg}`} />
                                    <span className="text-slate-700 text-sm truncate max-w-[200px]" title={custName}>
                                      {custName || '—'}
                                    </span>
                                  </div>
                                </td>
                                {/* Required */}
                                <td className="px-3 py-3 text-right">
                                  <span className="text-slate-800 font-semibold tabular-nums text-sm">{order.required.toLocaleString()}</span>
                                </td>
                                {/* Ready */}
                                <td className="px-3 py-3 text-right">
                                  <span className={`font-semibold tabular-nums text-sm ${(order.ready || 0) > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                    {(order.ready || 0).toLocaleString()}
                                  </span>
                                </td>
                                {/* Progress */}
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[72px] overflow-hidden">
                                      <div
                                        className={`h-2 rounded-full transition-all ${getProgressColor(actualPct)}`}
                                        style={{ width: `${Math.min(actualPct, 100)}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-semibold w-9 text-right tabular-nums ${
                                      actualPct >= 100 ? 'text-emerald-600' : actualPct > 0 ? 'text-slate-600' : 'text-slate-300'
                                    }`}>
                                      {Math.round(actualPct)}%
                                    </span>
                                  </div>
                                </td>
                                {/* Dates */}
                                <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap tabular-nums">{order.start_date || '—'}</td>
                                <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap tabular-nums">{order.end_date || '—'}</td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <span className={`text-xs font-medium tabular-nums ${order.promised_date ? 'text-amber-600' : 'text-slate-300'}`}>
                                    {order.promised_date || '—'}
                                  </span>
                                </td>
                                {/* DTC */}
                                <td className="px-3 py-3 text-center">
                                  {order.dtc > 0 ? (
                                    <span className={`text-xs font-bold tabular-nums ${getDtcStyle(order.dtc)}`}>{order.dtc}d</span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ────── TIMELINE VIEW ────── */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-w-max shadow-sm">
            {/* Timeline header */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-28 flex-shrink-0 px-3 py-2 border-r border-gray-200 bg-white">
                <span className="text-slate-500 text-xs font-semibold uppercase">Work Center</span>
              </div>
              <div className="flex">
                {days.map((day, i) => {
                  const isToday = i === todayOffset;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div
                      key={i}
                      style={{ width: `${columnWidth}px` }}
                      className={`flex-shrink-0 px-1 py-2 text-center border-r border-gray-200 ${
                        isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                        {format(day, viewDays > 14 ? 'd' : 'MMM d')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Work center rows */}
            {workCenters.map(wc => {
              const { orders: wcOrders, laneCount } = getTimelineOrders(wc);
              const rowHeight = laneCount * LANE_HEIGHT + 8;
              return (
                <div key={wc} className="flex border-b border-gray-100 hover:bg-gray-50/50">
                  <div className="w-28 flex-shrink-0 px-3 py-3 border-r border-gray-200 flex items-start pt-3">
                    <span className="bg-blue-600 px-2.5 py-1 rounded-lg text-white text-xs font-bold">
                      {wc}
                    </span>
                  </div>
                  <div className="flex relative" style={{ height: `${rowHeight}px` }}>
                    {days.map((day, i) => {
                      const isToday = i === todayOffset;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <div
                          key={i}
                          style={{ width: `${columnWidth}px` }}
                          className={`flex-shrink-0 border-r border-gray-100 ${
                            isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : ''
                          }`}
                        />
                      );
                    })}
                    {todayOffset >= 0 && todayOffset < viewDays && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
                        style={{ left: `${todayOffset * columnWidth + columnWidth / 2}px` }}
                      />
                    )}
                    {wcOrders.map((order, idx) => {
                      const colors = getCustomerColor(order.product);
                      const left = Math.max(0, order.startOffset) * columnWidth;
                      const width = Math.min(order.duration, viewDays - Math.max(0, order.startOffset)) * columnWidth - 4;
                      const top = order.lane * LANE_HEIGHT + 4;
                      const actualPct = parseFloat(order.actual_pct) || 0;
                      const custName = getCustomerName(order);
                      if (width <= 0) return null;
                      return (
                        <div
                          key={`${order.so_number}-${idx}`}
                          className={`absolute rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02] hover:z-20 overflow-hidden shadow-sm ${colors.bg} ${colors.border} ${
                            order.isShortage ? 'opacity-80 border-dashed' : ''
                          } ${order.isAtRisk && !order.isShortage ? 'ring-2 ring-amber-400' : ''}`}
                          style={{ left: `${left}px`, width: `${width}px`, top: `${top}px`, height: `${LANE_HEIGHT - 8}px` }}
                          onClick={() => setSelectedOrder(order)}
                          title={`${custName}\n${order.product}\nSO: ${order.so_number} | MO: ${order.mo_number}`}
                        >
                          <div
                            className="absolute inset-0 bg-black/15"
                            style={{ width: `${100 - actualPct}%`, right: 0, left: 'auto' }}
                          />
                          <div className={`relative px-2 py-0.5 h-full flex flex-col justify-center text-white`}>
                            <div className="text-[11px] font-bold flex items-center gap-1">
                              <span className="bg-white/20 px-1 rounded">{order.so_number}</span>
                              <span className="opacity-80">MO:{order.mo_number}</span>
                              {order.isShortage && <AlertTriangle className="w-3 h-3 inline" />}
                            </div>
                            <div className="text-xs font-semibold truncate">{custName}</div>
                            {width > 120 && (
                              <div className="text-[10px] truncate opacity-90">
                                {order.product.length > 40 ? order.product.substring(0, 37) + '...' : order.product}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Order detail modal ─────────────────────────────────── */}
      {selectedOrder && (() => {
        const actualPct = parseFloat(selectedOrder.actual_pct) || 0;
        const remaining = Math.max(0, selectedOrder.required - (selectedOrder.ready || 0));
        const customerName = getCustomerName(selectedOrder);
        const colors = getCustomerColor(selectedOrder.product);
        const badge = getStatusBadge(selectedOrder.status);
        const hasMaterials = (selectedOrder.materials?.filter(m => m.required_qty > 0).length || 0) > 0;
        const hasShortage = selectedOrder.materials?.some(m => {
          const r = Math.max(0, m.required_qty - m.completed_qty);
          const a = m.stock_on_hand + (m.wip || 0);
          return a < r && r > 0 && (m.wip || 0) === 0;
        });

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

              {/* ── Colored header band ── */}
              <div className={`${colors.bg} px-6 py-5 flex-shrink-0`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Customer name + product */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className={`text-2xl font-black tracking-tight ${colors.text}`}>{customerName || 'Unknown Customer'}</h2>
                      {selectedOrder.action_items && (
                        <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> ACTION
                        </span>
                      )}
                    </div>
                    <p className={`${colors.text} opacity-90 text-sm font-medium truncate`}>{selectedOrder.product}</p>
                    {selectedOrder.packaging && (
                      <span className={`${colors.text} opacity-70 text-xs flex items-center gap-1 mt-0.5`}>
                        <Package className="w-3 h-3" /> {selectedOrder.packaging}
                      </span>
                    )}

                    {/* Order IDs row */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <div className="bg-black/20 rounded-lg px-3 py-1.5">
                        <div className={`${colors.text} opacity-60 text-[10px] uppercase font-semibold`}>Sales Order</div>
                        <div className={`${colors.text} text-base font-bold font-mono`}>{selectedOrder.so_number}</div>
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => { const url = getSOUrl(selectedOrder.so_number); if (url) { setPdfUrl(url); setShowPdfViewer(true); } }}
                            className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded flex items-center gap-0.5"
                          >
                            <Eye className="w-3 h-3" /> View SO
                          </button>
                          <button
                            onClick={() => openSalesOrder(selectedOrder.so_number)}
                            className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-3 h-3" /> Open
                          </button>
                        </div>
                      </div>
                      <div className="bg-black/20 rounded-lg px-3 py-1.5">
                        <div className={`${colors.text} opacity-60 text-[10px] uppercase font-semibold`}>Mfg Order</div>
                        <div className={`${colors.text} text-base font-bold font-mono`}>{selectedOrder.mo_number}</div>
                      </div>
                      <div className="bg-black/20 rounded-lg px-3 py-1.5">
                        <div className={`${colors.text} opacity-60 text-[10px] uppercase font-semibold`}>Work Center</div>
                        <div className={`${colors.text} text-base font-bold`}>{selectedOrder.work_center}</div>
                      </div>
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                        selectedOrder.status.toLowerCase().includes('shortage') ? 'bg-red-600 text-white' :
                        selectedOrder.status.toLowerCase().includes('released') ? 'bg-green-600 text-white' :
                        selectedOrder.status.toLowerCase().includes('complete') ? 'bg-emerald-600 text-white' :
                        'bg-black/25 text-white'
                      }`}>
                        {badge.icon && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                        {selectedOrder.status}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-2 flex-shrink-0 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto bg-gray-50">

                {/* Action required banner */}
                {selectedOrder.action_items && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-red-700 font-semibold text-sm">Action Required</div>
                      <div className="text-red-600 text-sm">{selectedOrder.action_items}</div>
                    </div>
                  </div>
                )}

                <div className="p-6 space-y-5">

                  {/* ── Progress + Quantities ── */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" /> Production Progress
                      </h3>
                      <span className="text-slate-500 text-sm">Work Center: <span className="text-slate-800 font-bold">{selectedOrder.work_center}</span></span>
                    </div>

                    {/* Big progress percentage */}
                    <div className="flex items-stretch gap-4">
                      <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-5 w-36 flex-shrink-0 border border-slate-200">
                        <div className={`text-5xl font-black ${
                          actualPct >= 100 ? 'text-green-600' :
                          actualPct >= 75 ? 'text-blue-600' :
                          actualPct >= 50 ? 'text-yellow-500' :
                          actualPct > 0 ? 'text-orange-500' : 'text-slate-400'
                        }`}>{Math.round(actualPct)}%</div>
                        <div className="text-slate-500 text-xs mt-1 text-center font-medium uppercase tracking-wide">Complete</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                          <div className={`h-2 rounded-full ${getProgressColor(actualPct)}`} style={{ width: `${Math.min(actualPct, 100)}%` }} />
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                          <div className="text-slate-400 text-xs font-semibold uppercase mb-1">Required</div>
                          <div className="text-2xl font-bold text-slate-800">{selectedOrder.required.toLocaleString()}</div>
                          <div className="text-slate-400 text-xs">{selectedOrder.packaging || 'units'}</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center border border-green-200">
                          <div className="text-green-600 text-xs font-semibold uppercase mb-1">Ready</div>
                          <div className="text-2xl font-bold text-green-700">{(selectedOrder.ready || 0).toLocaleString()}</div>
                          <div className="text-green-400 text-xs">completed</div>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-200">
                          <div className="text-amber-600 text-xs font-semibold uppercase mb-1">Remaining</div>
                          <div className="text-2xl font-bold text-amber-700">{remaining.toLocaleString()}</div>
                          <div className="text-amber-400 text-xs">to make</div>
                        </div>
                      </div>
                    </div>

                    {/* Schedule timeline */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-center">
                          <div className="text-slate-400 text-xs uppercase font-semibold">Start</div>
                          <div className="text-slate-700 font-semibold text-sm">{selectedOrder.start_date || '—'}</div>
                        </div>
                        <div className="flex-1 mx-4">
                          <div className="h-1.5 bg-gray-200 rounded-full">
                            <div className={`h-1.5 rounded-full ${colors.bg}`} style={{ width: `${Math.min(actualPct, 100)}%` }} />
                          </div>
                          {selectedOrder.duration > 0 && (
                            <div className="text-center text-xs text-slate-400 mt-1">{selectedOrder.duration} days total</div>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-slate-400 text-xs uppercase font-semibold">End</div>
                          <div className="text-slate-700 font-semibold text-sm">{selectedOrder.end_date || '—'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                          <div className="text-amber-500 text-xs font-semibold uppercase">Promised Date</div>
                          <div className="text-amber-700 font-bold">{selectedOrder.promised_date || '—'}</div>
                        </div>
                        <div className={`rounded-lg p-3 text-center border ${
                          selectedOrder.dtc <= 1 ? 'bg-red-50 border-red-100' :
                          selectedOrder.dtc <= 3 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
                        }`}>
                          <div className="text-slate-400 text-xs font-semibold uppercase">Days to Complete</div>
                          <div className={`font-bold ${
                            selectedOrder.dtc <= 1 ? 'text-red-600' :
                            selectedOrder.dtc <= 3 ? 'text-amber-600' : 'text-green-600'
                          }`}>{selectedOrder.dtc ? `${selectedOrder.dtc}d` : '—'}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                          <div className="text-blue-500 text-xs font-semibold uppercase">Planned %</div>
                          <div className="text-blue-700 font-bold">{selectedOrder.planned_pct || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Manufacturing Order ── */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-purple-500" /> Manufacturing Order
                    </h3>
                    {selectedOrder.mo_data ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          {[
                            { label: 'MO Number', value: selectedOrder.mo_data.mo_no, mono: true, accent: 'text-purple-600' },
                            { label: 'Build Item', value: selectedOrder.mo_data.item_no, mono: true, accent: '' },
                            { label: 'MO Status', value: selectedOrder.mo_data.status || '—', mono: false, accent: '' },
                            { label: 'Priority', value: selectedOrder.mo_data.priority || '—', mono: false, accent: '' },
                          ].map(({ label, value, mono, accent }) => (
                            <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                              <div className="text-slate-400 text-xs font-semibold uppercase mb-1">{label}</div>
                              <div className={`font-semibold text-sm ${accent || 'text-slate-800'} ${mono ? 'font-mono' : ''}`}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                            <div className="text-slate-400 text-xs font-semibold uppercase">Ordered</div>
                            <div className="text-xl font-bold text-slate-800">{selectedOrder.mo_data.qty_ordered?.toLocaleString()}</div>
                          </div>
                          <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
                            <div className="text-green-600 text-xs font-semibold uppercase">Completed</div>
                            <div className="text-xl font-bold text-green-700">{selectedOrder.mo_data.qty_completed?.toLocaleString()}</div>
                          </div>
                          <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
                            <div className="text-amber-600 text-xs font-semibold uppercase">Remaining</div>
                            <div className="text-xl font-bold text-amber-700">{selectedOrder.mo_data.qty_remaining?.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          {[
                            { label: 'Order Date', value: selectedOrder.mo_data.order_date },
                            { label: 'Start Date', value: selectedOrder.mo_data.start_date },
                            { label: 'Release Date', value: selectedOrder.mo_data.release_date },
                            { label: 'Due Date', value: selectedOrder.mo_data.due_date, accent: 'text-amber-600 font-semibold' },
                          ].map(({ label, value, accent }) => (
                            <div key={label} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                              <div className="text-slate-400 text-xs font-semibold uppercase mb-1">{label}</div>
                              <div className={`text-sm ${accent || 'text-slate-700'}`}>{value || '—'}</div>
                            </div>
                          ))}
                        </div>
                        {(selectedOrder.mo_data.total_material_cost > 0 || selectedOrder.mo_data.total_labor_cost > 0) && (
                          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 text-sm">
                            <div><span className="text-slate-400">Material Cost: </span><span className="text-slate-800 font-semibold">${selectedOrder.mo_data.total_material_cost.toFixed(2)}</span></div>
                            <div><span className="text-slate-400">Labor Cost: </span><span className="text-slate-800 font-semibold">${selectedOrder.mo_data.total_labor_cost.toFixed(2)}</span></div>
                          </div>
                        )}
                        {selectedOrder.mo_data.notes && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-slate-700">
                            <span className="font-semibold text-blue-600">Notes: </span>{selectedOrder.mo_data.notes}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 text-slate-400">
                        <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No MO data available from MISys</p>
                      </div>
                    )}
                  </div>

                  {/* ── Bill of Materials ── */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-500" /> Bill of Materials
                        <span className="text-slate-400 font-normal text-sm">({selectedOrder.materials?.filter(m => m.required_qty > 0).length || 0} components)</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {hasShortage && (
                          <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Material Shortage
                          </span>
                        )}
                        {!hasShortage && hasMaterials && (
                          <span className="bg-green-100 text-green-600 text-xs font-bold px-2 py-1 rounded-full">Materials OK</span>
                        )}
                        {selectedOrder.materials && selectedOrder.materials.length > 0 && (
                          <button
                            onClick={() => exportMaterialsToCSV(selectedOrder!)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Download className="w-3 h-3" /> Export
                          </button>
                        )}
                      </div>
                    </div>
                    {hasMaterials ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                              <th className="px-3 py-2.5 text-left w-8">#</th>
                              <th className="px-3 py-2.5 text-left">Component</th>
                              <th className="px-3 py-2.5 text-right">Need</th>
                              <th className="px-3 py-2.5 text-right">Issued</th>
                              <th className="px-3 py-2.5 text-right">Left</th>
                              <th className="px-3 py-2.5 text-right">Stock</th>
                              <th className="px-3 py-2.5 text-right">WIP</th>
                              <th className="px-3 py-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(selectedOrder.materials ?? []).filter(m => m.required_qty > 0).map((mat, idx) => {
                              const remainingNeeded = Math.max(0, mat.required_qty - mat.completed_qty);
                              const availableTotal = mat.stock_on_hand + (mat.wip || 0);
                              const isShort = availableTotal < remainingNeeded && remainingNeeded > 0 && (mat.wip || 0) === 0;
                              const isInProgress = (mat.wip || 0) > 0;
                              const isDone = mat.completed_qty >= mat.required_qty;
                              const pctComplete = mat.required_qty > 0 ? Math.round((mat.completed_qty / mat.required_qty) * 100) : 0;
                              return (
                                <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${isShort ? 'bg-red-50/60' : ''}`}>
                                  <td className="px-3 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="text-slate-800 font-mono text-sm font-semibold">{mat.component_item_no}</div>
                                    {mat.component_description && (
                                      <div className="text-slate-400 text-xs truncate max-w-[240px]">{mat.component_description}</div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className="text-slate-700 font-medium">{mat.required_qty.toLocaleString()}</span>
                                    <span className="text-slate-400 text-xs ml-1">{mat.unit}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`font-medium ${isDone ? 'text-green-600' : 'text-blue-600'}`}>
                                      {mat.completed_qty.toLocaleString()}
                                    </span>
                                    <span className="text-slate-400 text-xs ml-1">({pctComplete}%)</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`font-semibold ${remainingNeeded === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                      {remainingNeeded.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`font-medium ${mat.stock_on_hand >= remainingNeeded ? 'text-green-600' : 'text-red-500'}`}>
                                      {mat.stock_on_hand.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`font-medium ${mat.wip > 0 ? 'text-cyan-600' : 'text-slate-300'}`}>
                                      {mat.wip > 0 ? mat.wip.toLocaleString() : '–'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {isDone ? (
                                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">Done</span>
                                    ) : isInProgress ? (
                                      <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full text-xs font-semibold">In WIP</span>
                                    ) : isShort ? (
                                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                        Short {(remainingNeeded - availableTotal).toLocaleString()}
                                      </span>
                                    ) : remainingNeeded === 0 ? (
                                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">All Issued</span>
                                    ) : (
                                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">Ready</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="px-4 py-2.5 bg-slate-50 border-t border-gray-100 flex justify-between items-center text-xs text-slate-500">
                          <span>
                            {(selectedOrder.materials ?? []).filter(m => m.completed_qty >= m.required_qty).length} of {(selectedOrder.materials ?? []).filter(m => m.required_qty > 0).length} components complete
                            {(selectedOrder.materials ?? []).some(m => (m.wip || 0) > 0) && (
                              <span className="text-cyan-600 ml-2 font-medium">· {(selectedOrder.materials ?? []).filter(m => (m.wip || 0) > 0).length} in WIP</span>
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No material data available</p>
                      </div>
                    )}
                  </div>

                  {/* ── Finished Good Stock ── */}
                  {selectedOrder.item_data && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-green-500" /> Finished Good Inventory
                      </h3>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-slate-800 font-mono font-bold text-base">{selectedOrder.item_data.item_no}</div>
                          <div className="text-slate-500 text-sm">{selectedOrder.item_data.description}</div>
                        </div>
                        {(selectedOrder.item_data.recent_cost ?? 0) > 0 && (
                          <div className="text-right">
                            <div className="text-slate-400 text-xs font-semibold uppercase">Unit Cost</div>
                            <div className="text-slate-800 font-semibold">${selectedOrder.item_data.recent_cost?.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'On Hand', value: selectedOrder.item_data.qty_on_hand, cls: 'bg-slate-50 border-slate-200 text-slate-800' },
                          { label: 'Available', value: selectedOrder.item_data.qty_available ?? 0, cls: (selectedOrder.item_data.qty_available ?? 0) > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600' },
                          { label: 'Committed', value: selectedOrder.item_data.qty_committed, cls: 'bg-orange-50 border-orange-200 text-orange-700' },
                          { label: 'On Order', value: selectedOrder.item_data.qty_on_order, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
                        ].map(({ label, value, cls }) => (
                          <div key={label} className={`rounded-xl p-3 text-center border ${cls}`}>
                            <div className="text-xs font-semibold uppercase opacity-70 mb-1">{label}</div>
                            <div className="text-xl font-bold">{value?.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Sales Order Info ── */}
                  {selectedOrder.so_data && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" /> Sales Order Details
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Customer', value: selectedOrder.so_data.customer },
                          { label: 'Order Date', value: selectedOrder.so_data.order_date || '—' },
                          { label: 'Ship Date', value: selectedOrder.so_data.ship_date || '—' },
                          { label: 'SO Status', value: selectedOrder.so_data.status || '—' },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <div className="text-slate-400 text-xs font-semibold uppercase mb-1">{label}</div>
                            <div className="text-slate-800 font-medium text-sm">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PDF viewer modal ───────────────────────────────────── */}
      {showPdfViewer && pdfUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setShowPdfViewer(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" /> Sales Order
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSalesOrder(selectedOrder?.so_number || '')}
                  className="text-sm bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 px-3 py-1 rounded flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Tab
                </button>
                <button onClick={() => setShowPdfViewer(false)} className="text-white/70 hover:text-white bg-black/20 rounded-full p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={pdfUrl} className="w-full h-full border-0" title="Sales Order PDF" />
            </div>
          </div>
        </div>
      )}

      {/* ── Legend / Capacity modal ────────────────────────────── */}
      {showLegend && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowLegend(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Production Capacity & Legend
              </h2>
              <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">

              {/* General Info */}
              <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> General
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hours per day</span>
                    <span className="text-white font-bold">8 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Workers per line</span>
                    <span className="text-white font-bold">3 workers</span>
                  </div>
                </div>
              </div>

              {/* Grease Lines */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Grease Lines (GL1, GL2)</h3>
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-slate-300">Mode</th>
                        <th className="px-4 py-2 text-right text-slate-300">Capacity / Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-700">
                        <td className="px-4 py-3 text-white">Working with drums</td>
                        <td className="px-4 py-3 text-right text-green-400 font-bold">4,000 tubes</td>
                      </tr>
                      <tr className="border-t border-slate-700">
                        <td className="px-4 py-3 text-white">Working with bins</td>
                        <td className="px-4 py-3 text-right text-green-400 font-bold">4,500 tubes</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Oil Lines */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Oil Lines (OL1, OL2)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4">
                    <h4 className="text-slate-400 text-sm mb-2">OL1 - Large Bottles</h4>
                    <div className="flex justify-between">
                      <span className="text-white">4L & 5L</span>
                      <span className="text-green-400 font-bold">800/day</span>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <h4 className="text-slate-400 text-sm mb-3">OL2 - Small Bottles</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white">100 ml</span>
                        <span className="text-green-400 font-bold">7,200/day</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">200 ml</span>
                        <span className="text-green-400 font-bold">6,400/day</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">500 ml</span>
                        <span className="text-green-400 font-bold">3,600/day</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white">946ml & 1L</span>
                        <span className="text-green-400 font-bold">3,600/day</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Super Sonic */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Super Sonic Machine (SS)</h3>
                <div className="bg-slate-800 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-white">Tube capacity</span>
                  <span className="text-green-400 font-bold text-lg">2,500 tubes/day</span>
                </div>
              </div>

              {/* Other Work Centers */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Other Work Centers</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4">
                    <span className="bg-slate-600 px-2 py-1 rounded text-white text-sm font-bold">B</span>
                    <span className="text-slate-300 ml-3">Blending</span>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4">
                    <span className="bg-slate-600 px-2 py-1 rounded text-white text-sm font-bold">M</span>
                    <span className="text-slate-300 ml-3">Miscellaneous</span>
                  </div>
                </div>
              </div>

              {/* Status Legend */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Status Colors</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-red-500" />
                    <span className="text-white">Shortage</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-blue-500" />
                    <span className="text-white">Released to Production</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-green-500" />
                    <span className="text-white">Complete</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-yellow-500" />
                    <span className="text-white">On Hold</span>
                  </div>
                </div>
              </div>

              {/* Customer Colors */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Customer Colors</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {Object.entries(CUSTOMER_COLORS).slice(0, 6).map(([name, { bg }]) => (
                    <div key={name} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${bg}`} />
                      <span className="text-slate-300 capitalize">{name}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionScheduleMPS;
