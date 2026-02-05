import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Factory, ChevronLeft, ChevronRight, Calendar, AlertTriangle, X, Info, HelpCircle, Download, ChevronDown } from 'lucide-react';
import { fetchMPSData, openSalesOrder, getSOUrl } from '../services/mpsDataService';
import { MPSOrder } from '../types/mps';
import { format, addDays, startOfWeek, differenceInDays, parseISO, isValid } from 'date-fns';
import { exportToCSV, exportToJSON, exportToExcel, exportFullDataToJSON, exportMaterialsToCSV } from '../services/exportService';

// Customer color palette - each customer gets a unique consistent color
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

// Fallback colors for unknown customers - cycle through these
const FALLBACK_COLORS = [
  { bg: 'bg-violet-500', border: 'border-violet-400', text: 'text-violet-100' },
  { bg: 'bg-pink-500', border: 'border-pink-400', text: 'text-pink-100' },
  { bg: 'bg-slate-500', border: 'border-slate-400', text: 'text-slate-100' },
  { bg: 'bg-stone-500', border: 'border-stone-400', text: 'text-stone-100' },
  { bg: 'bg-zinc-500', border: 'border-zinc-400', text: 'text-zinc-100' },
];

function getCustomerColor(product: string): { bg: string; border: string; text: string } {
  const productLower = product.toLowerCase();
  
  // Check known customers
  for (const [customer, colors] of Object.entries(CUSTOMER_COLORS)) {
    if (productLower.includes(customer)) {
      return colors;
    }
  }
  
  // Hash the product name to get consistent fallback color
  let hash = 0;
  for (let i = 0; i < product.length; i++) {
    hash = ((hash << 5) - hash) + product.charCodeAt(i);
    hash = hash & hash;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try parsing various formats
  // Format: "Mon, Dec 15" or "Fri, Dec 19"
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
  
  // Try ISO format
  try {
    const parsed = parseISO(dateStr);
    if (isValid(parsed)) return parsed;
  } catch {}
  
  return null;
}

export function ProductionScheduleMPS() {
  const [orders, setOrders] = useState<MPSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedOrder, setSelectedOrder] = useState<MPSOrder | null>(null);
  const [viewDays, setViewDays] = useState(14); // 2 weeks default
  const [showLegend, setShowLegend] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMPSData();
      setOrders(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Generate days for the timeline
  const days = useMemo(() => {
    return Array.from({ length: viewDays }, (_, i) => addDays(weekStart, i));
  }, [weekStart, viewDays]);

  // Calculate column width based on view - smaller for more days
  const columnWidth = useMemo(() => {
    if (viewDays <= 7) return 112;      // 1 week: 112px (w-28)
    if (viewDays <= 14) return 90;      // 2 weeks: 90px
    if (viewDays <= 21) return 70;      // 3 weeks: 70px
    return 56;                           // 4 weeks: 56px (w-14)
  }, [viewDays]);

  // Get unique work centers
  const workCenters = useMemo(() => {
    const wcs = new Set(orders.map(o => o.work_center).filter(Boolean));
    return Array.from(wcs).sort();
  }, [orders]);

  // Build customer legend - use actual customer names from SO data or product
  const customerLegend = useMemo(() => {
    const customers = new Map<string, { bg: string; count: number }>();
    
    orders.forEach(order => {
      // Try to get customer name from SO data first, then from product
      let customerName = order.so_data?.customer || '';
      
      // If no SO data, extract from product (usually "Customer - Product")
      if (!customerName && order.product.includes(' - ')) {
        customerName = order.product.split(' - ')[0].trim();
      }
      
      // Fallback to customer code or 'Other'
      if (!customerName) {
        customerName = order.customer_code || 'Other';
      }
      
      // Shorten long names
      if (customerName.length > 20) {
        customerName = customerName.substring(0, 20) + '...';
      }
      
      const colors = getCustomerColor(order.product);
      const existing = customers.get(customerName);
      if (existing) {
        existing.count++;
      } else {
        customers.set(customerName, { bg: colors.bg, count: 1 });
      }
    });
    
    return Array.from(customers.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [orders]);

  // Get orders for a specific work center and calculate their positions
  const getOrdersForWorkCenter = (wc: string) => {
    return orders
      .filter(o => o.work_center === wc)
      .map(order => {
        const startDate = parseDate(order.start_date);
        const endDate = parseDate(order.end_date);
        const promisedDate = parseDate(order.promised_date);
        
        // Use start/end if available, otherwise use promised date
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
          isShortage: order.status.toLowerCase().includes('shortage')
        };
      })
      .filter(o => o.startOffset + o.duration > 0 && o.startOffset < viewDays); // Only visible orders
  };

  const navigateWeek = (direction: number) => {
    setWeekStart(prev => addDays(prev, direction * 7));
  };

  const goToToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
        <div className="text-center">
          <Factory className="w-16 h-16 text-blue-400 animate-pulse mx-auto mb-4" />
          <p className="text-slate-300 text-xl">Loading Production Schedule...</p>
        </div>
      </div>
    );
  }

  const todayOffset = differenceInDays(new Date(), weekStart);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Factory className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Production Schedule</h1>
              <p className="text-slate-400 text-sm">
                {orders.length} orders • Updated {lastUpdated ? format(lastUpdated, 'h:mm a') : '...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View selector */}
            <select
              value={viewDays}
              onChange={(e) => setViewDays(parseInt(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value={7}>1 Week</option>
              <option value={14}>2 Weeks</option>
              <option value={21}>3 Weeks</option>
              <option value={28}>4 Weeks</option>
            </select>
            
            {/* Navigation */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-slate-700 rounded">
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </button>
              <button onClick={goToToday} className="px-3 py-1 hover:bg-slate-700 rounded text-white text-sm font-medium">
                Today
              </button>
              <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-slate-700 rounded">
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            
            <button
              onClick={() => setShowLegend(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              title="Production Capacity & Legend"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            
            {/* Export Menu */}
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
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50 overflow-hidden">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          exportToCSV(orders);
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export to CSV
                      </button>
                      <button
                        onClick={() => {
                          exportToExcel(orders);
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export to Excel
                      </button>
                      <button
                        onClick={() => {
                          exportToJSON(orders);
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export to JSON
                      </button>
                      <button
                        onClick={() => {
                          exportFullDataToJSON(orders);
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export Full Data (JSON)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Legend */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-2 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-slate-500 text-sm font-medium">Customers:</span>
          {customerLegend.slice(0, 10).map(([name, { bg, count }]) => (
            <div key={name} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${bg}`}></div>
              <span className="text-slate-300 text-sm">{name}</span>
              <span className="text-slate-500 text-xs">({count})</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 flex items-center gap-2 backdrop-blur">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Gantt Chart */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden min-w-max">
          {/* Timeline Header */}
          <div className="flex border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
            <div className="w-24 flex-shrink-0 px-3 py-2 border-r border-slate-700 bg-slate-800">
              <span className="text-slate-400 text-xs font-semibold">WORK CENTER</span>
            </div>
            <div className="flex">
              {days.map((day, i) => {
                const isToday = i === todayOffset;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div 
                    key={i} 
                    style={{ width: `${columnWidth}px` }}
                    className={`flex-shrink-0 px-1 py-2 text-center border-r border-slate-700/50 ${
                      isToday ? 'bg-blue-500/20' : isWeekend ? 'bg-slate-700/30' : ''
                    }`}
                  >
                    <div className={`text-xs font-semibold ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                      {format(day, viewDays > 14 ? 'EEE' : 'EEE')}
                    </div>
                    <div className={`text-sm font-bold ${isToday ? 'text-blue-300' : 'text-white'}`}>
                      {format(day, viewDays > 14 ? 'd' : 'MMM d')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Work Center Rows */}
          {workCenters.map(wc => {
            const wcOrders = getOrdersForWorkCenter(wc);
            
            return (
              <div key={wc} className="flex border-b border-slate-700/50 hover:bg-slate-700/20">
                {/* Work Center Label */}
                <div className="w-24 flex-shrink-0 px-3 py-3 border-r border-slate-700 flex items-center">
                  <span className="bg-slate-600 px-2 py-1 rounded text-white text-xs font-bold">
                    {wc}
                  </span>
                </div>
                
                {/* Timeline */}
                <div className="flex relative" style={{ height: '70px' }}>
                  {/* Day columns */}
                  {days.map((day, i) => {
                    const isToday = i === todayOffset;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div 
                        key={i} 
                        style={{ width: `${columnWidth}px` }}
                        className={`flex-shrink-0 border-r border-slate-700/30 ${
                          isToday ? 'bg-blue-500/10' : isWeekend ? 'bg-slate-700/20' : ''
                        }`}
                      />
                    );
                  })}
                  
                  {/* Order bars */}
                  {wcOrders.map((order, idx) => {
                    const colors = getCustomerColor(order.product);
                    const left = Math.max(0, order.startOffset) * columnWidth;
                    const width = Math.min(order.duration, viewDays - Math.max(0, order.startOffset)) * columnWidth - 4;
                    const actualPct = parseFloat(order.actual_pct) || 0;
                    
                    // Extract customer name from product or SO data
                    const customerName = order.so_data?.customer || 
                      (order.product.split(' - ')[0]) || 
                      order.customer_code || 
                      'Unknown';
                    
                    if (width <= 0) return null;
                    
                    return (
                      <div
                        key={`${order.so_number}-${idx}`}
                        className={`absolute top-1 h-14 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02] hover:z-20 overflow-hidden ${colors.bg} ${colors.border} ${
                          order.isShortage ? 'opacity-60 border-dashed' : ''
                        }`}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        onClick={() => setSelectedOrder(order)}
                        title={`${customerName}\n${order.product}\nSO: ${order.so_number} | MO: ${order.mo_number}`}
                      >
                        {/* Progress fill */}
                        <div 
                          className="absolute inset-0 bg-black/30"
                          style={{ width: `${100 - actualPct}%`, right: 0, left: 'auto' }}
                        />
                        
                        {/* Content */}
                        <div className={`relative px-2 py-0.5 ${colors.text}`}>
                          <div className="text-[10px] font-bold flex items-center gap-1">
                            <span className="bg-black/20 px-1 rounded">{order.so_number}</span>
                            <span className="opacity-70">MO:{order.mo_number}</span>
                            {order.isShortage && <span>⚠️</span>}
                          </div>
                          <div className="text-xs font-semibold truncate">
                            {customerName}
                          </div>
                          <div className="text-[9px] truncate opacity-80">
                            {order.product.length > 50 ? order.product.substring(0, 47) + '...' : order.product}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (() => {
        const actualPct = parseFloat(selectedOrder.actual_pct) || 0;
        const remaining = Math.max(0, selectedOrder.required - (selectedOrder.ready || 0));
        const customerName = selectedOrder.so_data?.customer || selectedOrder.product.split(' - ')[0] || 'Unknown';
        const colors = getCustomerColor(selectedOrder.product);
        
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              
              {/* Header with Customer Color - fixed, never shrinks */}
              <div className={`${colors.bg} px-6 py-4 flex-shrink-0`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Order Numbers Row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className="bg-black/30 px-3 py-1.5 rounded-lg">
                        <div className="text-white/60 text-[10px] uppercase">Sales Order</div>
                        <div className="text-white text-lg font-bold">{selectedOrder.so_number}</div>
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => {
                              const url = getSOUrl(selectedOrder.so_number);
                              if (url) { setPdfUrl(url); setShowPdfViewer(true); }
                            }}
                            className="text-[10px] bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 px-2 py-0.5 rounded"
                            title="View in app"
                          >
                            👁 View
                          </button>
                          <button
                            onClick={() => openSalesOrder(selectedOrder.so_number)}
                            className="text-[10px] bg-slate-500/30 hover:bg-slate-500/50 text-slate-300 px-2 py-0.5 rounded"
                            title="Open in new tab"
                          >
                            ↗ Tab
                          </button>
                        </div>
                      </div>
                      <div className="bg-black/30 px-3 py-1.5 rounded-lg">
                        <div className="text-white/60 text-[10px] uppercase">Mfg Order</div>
                        <div className="text-white text-lg font-bold">{selectedOrder.mo_number}</div>
                      </div>
                      <div className="bg-black/30 px-3 py-1.5 rounded-lg">
                        <div className="text-white/60 text-[10px] uppercase">Work Center</div>
                        <div className="text-white text-lg font-bold">{selectedOrder.work_center}</div>
                      </div>
                      <span className={`px-4 py-2 rounded-lg text-sm font-bold ${
                        selectedOrder.status.toLowerCase().includes('shortage') ? 'bg-red-600 text-white' :
                        selectedOrder.status.toLowerCase().includes('released') ? 'bg-green-600 text-white' :
                        'bg-black/30 text-white'
                      }`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    {/* Customer & Product */}
                    <h2 className={`text-xl font-bold ${colors.text}`}>{customerName}</h2>
                    <p className={`${colors.text} opacity-90 text-sm`}>{selectedOrder.product}</p>
                    {selectedOrder.packaging && (
                      <span className={`${colors.text} opacity-70 text-xs`}> 📦 {selectedOrder.packaging}</span>
                    )}
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-white/70 hover:text-white bg-black/20 rounded-full p-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                
                {/* Big Progress Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">Production Progress</h3>
                    <span className="text-slate-400 text-sm">Work Center: <span className="text-white font-bold">{selectedOrder.work_center}</span></span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {/* Big Percentage */}
                    <div className="col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-center border border-slate-700">
                      <div className={`text-6xl font-black ${
                        actualPct >= 100 ? 'text-green-400' :
                        actualPct >= 75 ? 'text-blue-400' :
                        actualPct >= 50 ? 'text-yellow-400' :
                        actualPct > 0 ? 'text-orange-400' : 'text-slate-500'
                      }`}>
                        {Math.round(actualPct)}%
                      </div>
                      <div className="text-slate-400 text-sm mt-1">ACTUAL COMPLETE</div>
                      <div className="mt-3 w-full bg-slate-700 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all ${
                            actualPct >= 100 ? 'bg-green-500' :
                            actualPct >= 75 ? 'bg-blue-500' :
                            actualPct >= 50 ? 'bg-yellow-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(actualPct, 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Quantities */}
                    <div className="col-span-2 grid grid-cols-3 gap-3">
                      <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                        <div className="text-slate-500 text-xs mb-1">REQUIRED</div>
                        <div className="text-3xl font-bold text-white">{selectedOrder.required}</div>
                        <div className="text-slate-500 text-xs">{selectedOrder.packaging || 'units'}</div>
                      </div>
                      <div className="bg-green-500/10 rounded-xl p-4 text-center border border-green-500/30">
                        <div className="text-green-400 text-xs mb-1">READY</div>
                        <div className="text-3xl font-bold text-green-400">{selectedOrder.ready || 0}</div>
                        <div className="text-green-400/50 text-xs">completed</div>
                      </div>
                      <div className="bg-yellow-500/10 rounded-xl p-4 text-center border border-yellow-500/30">
                        <div className="text-yellow-400 text-xs mb-1">REMAINING</div>
                        <div className="text-3xl font-bold text-yellow-400">{remaining}</div>
                        <div className="text-yellow-400/50 text-xs">to make</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Schedule Timeline */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Schedule
                  </h3>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <div className="text-slate-500 text-xs">START</div>
                        <div className="text-white font-semibold">{selectedOrder.start_date || '—'}</div>
                      </div>
                      <div className="flex-1 px-4">
                        <div className="h-2 bg-slate-700 rounded-full relative">
                          <div className={`h-2 rounded-full ${colors.bg}`} style={{ width: `${actualPct}%` }} />
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2 py-0.5 rounded text-xs text-white">
                            {selectedOrder.duration ? `${selectedOrder.duration} days` : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="text-center flex-1">
                        <div className="text-slate-500 text-xs">END</div>
                        <div className="text-white font-semibold">{selectedOrder.end_date || '—'}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
                      <div className="text-center">
                        <div className="text-slate-500 text-xs">PROMISED TO CUSTOMER</div>
                        <div className="text-yellow-400 font-bold text-lg">{selectedOrder.promised_date || '—'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-500 text-xs">DAYS TO COMPLETE</div>
                        <div className={`font-bold text-lg ${
                          selectedOrder.dtc <= 1 ? 'text-red-400' : 
                          selectedOrder.dtc <= 3 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {selectedOrder.dtc ? `${selectedOrder.dtc} days` : '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-500 text-xs">PLANNED</div>
                        <div className="text-blue-400 font-bold text-lg">{selectedOrder.planned_pct}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MO Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
                    🔧 Manufacturing Order
                  </h3>
                  {selectedOrder.mo_data ? (
                    <div className="bg-purple-500/5 rounded-xl p-4 border border-purple-500/20">
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-slate-500 text-xs">MO Number</div>
                          <div className="text-purple-300 font-mono font-bold text-lg">{selectedOrder.mo_data.mo_no}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Build Item</div>
                          <div className="text-white font-mono">{selectedOrder.mo_data.item_no}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Status</div>
                          <div className="text-white font-semibold">{selectedOrder.mo_data.status || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Priority</div>
                          <div className="text-white">{selectedOrder.mo_data.priority || '—'}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                          <div className="text-slate-500 text-xs">ORDERED</div>
                          <div className="text-2xl font-bold text-white">{selectedOrder.mo_data.qty_ordered}</div>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-3 text-center border border-green-500/20">
                          <div className="text-green-400 text-xs">COMPLETED</div>
                          <div className="text-2xl font-bold text-green-400">{selectedOrder.mo_data.qty_completed}</div>
                        </div>
                        <div className="bg-yellow-500/10 rounded-lg p-3 text-center border border-yellow-500/20">
                          <div className="text-yellow-400 text-xs">REMAINING</div>
                          <div className="text-2xl font-bold text-yellow-400">{selectedOrder.mo_data.qty_remaining}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-slate-500 text-xs">Order Date</div>
                          <div className="text-white">{selectedOrder.mo_data.order_date || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Start Date</div>
                          <div className="text-white">{selectedOrder.mo_data.start_date || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Release Date</div>
                          <div className="text-white">{selectedOrder.mo_data.release_date || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Due Date</div>
                          <div className="text-yellow-400 font-semibold">{selectedOrder.mo_data.due_date || '—'}</div>
                        </div>
                      </div>

                      {(selectedOrder.mo_data.customer || selectedOrder.mo_data.notes) && (
                        <div className="mt-4 pt-4 border-t border-purple-500/20">
                          {selectedOrder.mo_data.customer && (
                            <div className="mb-2">
                              <span className="text-slate-500 text-sm">Customer: </span>
                              <span className="text-white">{selectedOrder.mo_data.customer}</span>
                            </div>
                          )}
                          {selectedOrder.mo_data.notes && (
                            <div className="bg-slate-800/50 rounded-lg p-2 text-sm text-slate-300">
                              {selectedOrder.mo_data.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Costs */}
                      {(selectedOrder.mo_data.total_material_cost > 0 || selectedOrder.mo_data.total_labor_cost > 0) && (
                        <div className="mt-4 pt-4 border-t border-purple-500/20 flex gap-6 text-sm">
                          <div>
                            <span className="text-slate-500">Material Cost: </span>
                            <span className="text-white font-semibold">${selectedOrder.mo_data.total_material_cost.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Labor Cost: </span>
                            <span className="text-white font-semibold">${selectedOrder.mo_data.total_labor_cost.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-800/30 rounded-xl p-6 text-center text-slate-500">
                      No MO data available from MISys
                    </div>
                  )}
                </div>

                {/* Materials / BOM */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                      📦 Bill of Materials
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-sm">{selectedOrder.materials?.length || 0} unique components</span>
                      {selectedOrder.materials && selectedOrder.materials.length > 0 && (
                        <button
                          onClick={() => exportMaterialsToCSV(selectedOrder!)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                          title="Export materials to CSV"
                        >
                          <Download className="w-3 h-3" />
                          Export Materials
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedOrder.materials && selectedOrder.materials.length > 0 ? (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-700/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-slate-300 font-semibold">#</th>
                            <th className="px-3 py-2 text-left text-xs text-slate-300 font-semibold">COMPONENT</th>
                            <th className="px-3 py-2 text-right text-xs text-slate-300 font-semibold">NEED</th>
                            <th className="px-3 py-2 text-right text-xs text-slate-300 font-semibold">ISSUED</th>
                            <th className="px-3 py-2 text-right text-xs text-slate-300 font-semibold">LEFT</th>
                            <th className="px-3 py-2 text-right text-xs text-slate-300 font-semibold">STOCK</th>
                            <th className="px-3 py-2 text-right text-xs text-slate-300 font-semibold">WIP</th>
                            <th className="px-3 py-2 text-center text-xs text-slate-300 font-semibold">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {selectedOrder.materials.filter(m => m.required_qty > 0).map((mat, idx) => {
                            // SMART LOGIC: Account for WIP (Work In Progress)
                            // WIP = material already on the floor for THIS order
                            const remainingNeeded = Math.max(0, mat.required_qty - mat.completed_qty);
                            const availableTotal = mat.stock_on_hand + (mat.wip || 0); // Stock + WIP
                            // Only SHORT if: stock+WIP can't cover remaining AND nothing in WIP yet
                            const isShort = availableTotal < remainingNeeded && remainingNeeded > 0 && (mat.wip || 0) === 0;
                            const isInProgress = (mat.wip || 0) > 0; // Has WIP = in progress, not short
                            const isDone = mat.completed_qty >= mat.required_qty;
                            const pctComplete = mat.required_qty > 0 ? Math.round((mat.completed_qty / mat.required_qty) * 100) : 0;
                            
                            return (
                              <tr key={idx} className={`${isShort ? 'bg-red-500/10' : ''} hover:bg-slate-700/30`}>
                                <td className="px-3 py-2 text-slate-500 text-xs">{idx + 1}</td>
                                <td className="px-3 py-2">
                                  <div className="text-white font-mono text-sm font-medium">{mat.component_item_no}</div>
                                  {mat.component_description && (
                                    <div className="text-slate-500 text-xs truncate max-w-[250px]">{mat.component_description}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className="text-white">{mat.required_qty.toLocaleString()}</span>
                                  <span className="text-slate-500 text-xs ml-1">{mat.unit}</span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={`font-medium ${isDone ? 'text-green-400' : 'text-blue-400'}`}>
                                    {mat.completed_qty.toLocaleString()}
                                  </span>
                                  <span className="text-slate-500 text-xs ml-1">({pctComplete}%)</span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={`font-bold ${remainingNeeded === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {remainingNeeded.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={`font-medium ${mat.stock_on_hand >= remainingNeeded ? 'text-green-400' : 'text-red-400'}`}>
                                    {mat.stock_on_hand.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={`font-medium ${mat.wip > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                                    {mat.wip > 0 ? mat.wip.toLocaleString() : '-'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {isDone ? (
                                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">✓ DONE</span>
                                  ) : isInProgress ? (
                                    <span className="bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded text-xs font-medium">🔄 IN WIP</span>
                                  ) : isShort ? (
                                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-medium">⚠ {(remainingNeeded - availableTotal).toLocaleString()}</span>
                                  ) : remainingNeeded === 0 ? (
                                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">✓ ALL ISSUED</span>
                                  ) : (
                                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">✓ READY</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      
                      {/* Summary row - accounts for WIP */}
                      <div className="bg-slate-700/30 px-3 py-2 flex justify-between items-center text-sm border-t border-slate-700">
                        <span className="text-slate-400">
                          {selectedOrder.materials.filter(m => m.completed_qty >= m.required_qty).length} of {selectedOrder.materials.filter(m => m.required_qty > 0).length} complete
                          {selectedOrder.materials.some(m => (m.wip || 0) > 0) && 
                            <span className="text-cyan-400 ml-2">• {selectedOrder.materials.filter(m => (m.wip || 0) > 0).length} in WIP</span>
                          }
                        </span>
                        <span className={`font-bold ${
                          selectedOrder.materials.some(m => {
                            const remaining = Math.max(0, m.required_qty - m.completed_qty);
                            const available = m.stock_on_hand + (m.wip || 0);
                            return available < remaining && remaining > 0 && (m.wip || 0) === 0;
                          }) ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {selectedOrder.materials.some(m => {
                            const remaining = Math.max(0, m.required_qty - m.completed_qty);
                            const available = m.stock_on_hand + (m.wip || 0);
                            return available < remaining && remaining > 0 && (m.wip || 0) === 0;
                          }) ? '⚠ Material Shortage' : '✓ Materials OK'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-800/30 rounded-xl p-6 text-center text-slate-500">
                      No material data available
                    </div>
                  )}
                </div>

                {/* Finished Good Inventory */}
                {selectedOrder.item_data && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-green-400 mb-2">📊 Finished Good Stock</h3>
                    <div className="bg-green-500/5 rounded-xl p-4 border border-green-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-white font-mono font-bold">{selectedOrder.item_data.item_no}</div>
                          <div className="text-slate-400 text-sm">{selectedOrder.item_data.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-500 text-xs">Unit Cost</div>
                          <div className="text-white font-semibold">${selectedOrder.item_data.recent_cost?.toFixed(2) || '0.00'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-xs text-slate-500">ON HAND</div>
                          <div className="text-lg font-bold text-white">{selectedOrder.item_data.qty_on_hand}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-xs text-slate-500">AVAILABLE</div>
                          <div className={`text-lg font-bold ${(selectedOrder.item_data.qty_available ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {selectedOrder.item_data.qty_available ?? 0}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-xs text-slate-500">COMMITTED</div>
                          <div className="text-lg font-bold text-orange-400">{selectedOrder.item_data.qty_committed}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-xs text-slate-500">ON ORDER</div>
                          <div className="text-lg font-bold text-blue-400">{selectedOrder.item_data.qty_on_order}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SO Info */}
                {selectedOrder.so_data && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 mb-2">📋 Sales Order</h3>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex justify-between">
                      <div>
                        <div className="text-slate-500 text-xs">Customer</div>
                        <div className="text-white font-semibold">{selectedOrder.so_data.customer}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Order Date</div>
                        <div className="text-white">{selectedOrder.so_data.order_date || '—'}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Ship Date</div>
                        <div className="text-white">{selectedOrder.so_data.ship_date || '—'}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">SO Status</div>
                        <div className="text-white">{selectedOrder.so_data.status || '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Action Items Warning */}
                {selectedOrder.action_items && (
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
                    <div className="text-red-400 font-bold mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Action Required
                    </div>
                    <div className="text-white">{selectedOrder.action_items}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* PDF Viewer Modal */}
      {showPdfViewer && pdfUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setShowPdfViewer(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white">📄 Sales Order</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSalesOrder(selectedOrder?.so_number || '')}
                  className="text-sm bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 px-3 py-1 rounded"
                >
                  ↗ Open in Tab
                </button>
                <button onClick={() => setShowPdfViewer(false)} className="text-white/70 hover:text-white bg-black/20 rounded-full p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe 
                src={pdfUrl} 
                className="w-full h-full border-0"
                title="Sales Order PDF"
              />
            </div>
          </div>
        </div>
      )}

      {/* Legend / Capacity Modal */}
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
                <h3 className="text-blue-400 font-bold mb-2">⏰ General</h3>
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
                <h3 className="text-lg font-bold text-white mb-3">🧴 Grease Lines (GL1, GL2)</h3>
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
                <h3 className="text-lg font-bold text-white mb-3">🛢️ Oil Lines (OL1, OL2)</h3>
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
                <h3 className="text-lg font-bold text-white mb-3">⚡ Super Sonic Machine (SS)</h3>
                <div className="bg-slate-800 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-white">Tube capacity</span>
                  <span className="text-green-400 font-bold text-lg">2,500 tubes/day</span>
                </div>
              </div>

              {/* Other Work Centers */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">🔧 Other Work Centers</h3>
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
                <h3 className="text-lg font-bold text-white mb-3">🎨 Status Colors</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span className="text-white">Shortage</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-blue-500"></div>
                    <span className="text-white">Released to Production</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span className="text-white">Complete</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-yellow-500"></div>
                    <span className="text-white">On Hold</span>
                  </div>
                </div>
              </div>

              {/* Customer Colors */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">🏢 Customer Colors</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                    <span className="text-slate-300">Lanxess</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-slate-300">Lubecore</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span className="text-slate-300">Petro-Canada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-purple-500"></div>
                    <span className="text-slate-300">ROBCO</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-yellow-500"></div>
                    <span className="text-slate-300">Shell</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-orange-500"></div>
                    <span className="text-slate-300">Mobil</span>
                  </div>
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
