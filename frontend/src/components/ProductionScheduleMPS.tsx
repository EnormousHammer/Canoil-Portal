import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Factory, ChevronLeft, ChevronRight, Calendar, AlertTriangle, X, Info, HelpCircle } from 'lucide-react';
import { fetchMPSData, openSalesOrder, getSOUrl, clearMPSCache } from '../services/mpsDataService';
import { MPSOrder } from '../types/mps';
import { format, addDays, startOfWeek, differenceInDays, parseISO, isValid } from 'date-fns';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30 animate-pulse">
              <Factory className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -inset-4 bg-blue-500/20 rounded-3xl blur-xl animate-pulse"></div>
          </div>
          <p className="text-white text-xl font-semibold mb-2">Loading Production Schedule</p>
          <p className="text-slate-400 text-sm">Fetching data from MiSys...</p>
          <div className="mt-6 flex justify-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  const todayOffset = differenceInDays(new Date(), weekStart);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header - Dark Theme */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-800 to-slate-900 border-b border-slate-700 px-6 py-4 flex-shrink-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Factory className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Production Schedule</h1>
              <p className="text-slate-300 text-sm">
                {orders.length} orders • Updated {lastUpdated ? format(lastUpdated, 'h:mm a') : '...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View selector */}
            <select
              value={viewDays}
              onChange={(e) => setViewDays(parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={7}>1 Week</option>
              <option value={14}>2 Weeks</option>
              <option value={21}>3 Weeks</option>
              <option value={28}>4 Weeks</option>
            </select>
            
            {/* Navigation */}
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1 border border-slate-600">
              <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-slate-600 rounded transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </button>
              <button onClick={goToToday} className="px-3 py-1.5 hover:bg-slate-600 rounded text-white text-sm font-medium transition-colors">
                Today
              </button>
              <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-slate-600 rounded transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            
            <button
              onClick={() => setShowLegend(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg shadow-sm border border-slate-600 transition-colors"
              title="Production Capacity & Legend"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-lg shadow-blue-500/25 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Legend - Refined */}
      <div className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 px-6 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-slate-300 text-sm font-semibold">Customers:</span>
          {customerLegend.slice(0, 10).map(([name, { bg, count }]) => (
            <div key={name} className="flex items-center gap-1.5 bg-slate-700/50 px-2 py-1 rounded-lg">
              <div className={`w-3 h-3 rounded-full ${bg} shadow-sm`}></div>
              <span className="text-white text-sm font-medium">{name}</span>
              <span className="text-slate-300 text-xs bg-slate-600 px-1.5 py-0.5 rounded">({count})</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300 flex items-center gap-3 backdrop-blur-sm">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Gantt Chart - Premium Dark Theme */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden min-w-max shadow-xl">
          {/* Timeline Header */}
          <div className="flex border-b border-slate-600/50 sticky top-0 bg-slate-800/95 backdrop-blur-sm z-10">
            <div className="w-24 flex-shrink-0 px-3 py-3 border-r border-slate-600/50 bg-slate-800/95">
              <span className="text-slate-300 text-xs font-bold uppercase tracking-wider">Work<br/>Center</span>
            </div>
            <div className="flex">
              {days.map((day, i) => {
                const isToday = i === todayOffset;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div 
                    key={i} 
                    style={{ width: `${columnWidth}px` }}
                    className={`flex-shrink-0 px-1 py-2.5 text-center border-r border-slate-700/30 transition-colors ${
                      isToday ? 'bg-blue-500/20 border-b-2 border-b-blue-400' : isWeekend ? 'bg-slate-700/20' : ''
                    }`}
                  >
                    <div className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>
                      {format(day, viewDays > 14 ? 'EEE' : 'EEE')}
                    </div>
                    <div className={`text-sm font-bold ${isToday ? 'text-blue-300' : 'text-slate-200'}`}>
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
              <div key={wc} className="flex border-b border-slate-700/30 hover:bg-slate-700/10 transition-colors">
                {/* Work Center Label */}
                <div className="w-24 flex-shrink-0 px-2 py-3 border-r border-slate-700/30 flex items-center justify-center">
                  <span className="bg-gradient-to-r from-slate-600 to-slate-700 px-2.5 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm border border-slate-500/30">
                    {wc}
                  </span>
                </div>
                
                {/* Timeline */}
                <div className="flex relative" style={{ height: '76px' }}>
                  {/* Day columns */}
                  {days.map((day, i) => {
                    const isToday = i === todayOffset;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div 
                        key={i} 
                        style={{ width: `${columnWidth}px` }}
                        className={`flex-shrink-0 border-r border-slate-700/20 ${
                          isToday ? 'bg-blue-500/10' : isWeekend ? 'bg-slate-800/30' : ''
                        }`}
                      />
                    );
                  })}
                  
                  {/* Order bars - Enhanced styling */}
                  {wcOrders.map((order, idx) => {
                    const colors = getCustomerColor(order.product);
                    const left = Math.max(0, order.startOffset) * columnWidth;
                    const width = Math.min(order.duration, viewDays - Math.max(0, order.startOffset)) * columnWidth - 6;
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
                        className={`absolute top-2 h-[60px] rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:z-20 hover:shadow-lg overflow-hidden ${colors.bg} ${colors.border} ${
                          order.isShortage ? 'opacity-70 border-dashed' : 'shadow-md'
                        }`}
                        style={{ left: `${left + 3}px`, width: `${width}px` }}
                        onClick={() => setSelectedOrder(order)}
                        title={`${customerName}\n${order.product}\nSO: ${order.so_number} | MO: ${order.mo_number}`}
                      >
                        {/* Progress fill overlay */}
                        <div 
                          className="absolute inset-0 bg-black/25"
                          style={{ width: `${100 - actualPct}%`, right: 0, left: 'auto' }}
                        />
                        
                        {/* Content */}
                        <div className={`relative px-2 py-1 h-full flex flex-col justify-center ${colors.text}`}>
                          <div className="text-[10px] font-bold flex items-center gap-1.5 mb-0.5">
                            <span className="bg-black/25 px-1.5 py-0.5 rounded font-mono">{order.so_number}</span>
                            <span className="opacity-80 text-[9px]">MO:{order.mo_number}</span>
                            {order.isShortage && <span className="text-yellow-300">⚠️</span>}
                          </div>
                          <div className="text-xs font-bold truncate leading-tight">
                            {customerName}
                          </div>
                          <div className="text-[9px] truncate opacity-90 leading-tight">
                            {order.product.length > 45 ? order.product.substring(0, 42) + '...' : order.product}
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

      {/* Order Detail Modal - Premium Dark Theme */}
      {selectedOrder && (() => {
        const actualPct = parseFloat(selectedOrder.actual_pct) || 0;
        const remaining = Math.max(0, selectedOrder.required - (selectedOrder.ready || 0));
        const customerName = selectedOrder.so_data?.customer || selectedOrder.product.split(' - ')[0] || 'Unknown';
        const colors = getCustomerColor(selectedOrder.product);
        
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-3xl border border-slate-700/50 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              
              {/* Header with Customer Color - Premium styling */}
              <div className={`${colors.bg} px-6 py-5 flex-shrink-0 relative overflow-hidden`}>
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10"></div>
                <div className="relative flex items-start justify-between">
                  <div className="flex-1">
                    {/* Order Numbers Row */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div className="bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                        <div className="text-white/70 text-[10px] uppercase tracking-wider font-semibold">Sales Order</div>
                        <div className="text-white text-xl font-bold tracking-tight">{selectedOrder.so_number}</div>
                        <div className="flex gap-1.5 mt-1.5">
                          <button
                            onClick={() => {
                              const url = getSOUrl(selectedOrder.so_number);
                              if (url) { setPdfUrl(url); setShowPdfViewer(true); }
                            }}
                            className="text-[10px] bg-blue-500/40 hover:bg-blue-500/60 text-white px-2.5 py-1 rounded-lg font-medium transition-colors"
                            title="View in app"
                          >
                            👁 View
                          </button>
                          <button
                            onClick={() => openSalesOrder(selectedOrder.so_number)}
                            className="text-[10px] bg-slate-500/40 hover:bg-slate-500/60 text-white px-2.5 py-1 rounded-lg font-medium transition-colors"
                            title="Open in new tab"
                          >
                            ↗ Tab
                          </button>
                        </div>
                      </div>
                      <div className="bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                        <div className="text-white/70 text-[10px] uppercase tracking-wider font-semibold">Mfg Order</div>
                        <div className="text-white text-xl font-bold tracking-tight">{selectedOrder.mo_number}</div>
                      </div>
                      <div className="bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                        <div className="text-white/70 text-[10px] uppercase tracking-wider font-semibold">Work Center</div>
                        <div className="text-white text-xl font-bold tracking-tight">{selectedOrder.work_center}</div>
                      </div>
                      <span className={`px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${
                        selectedOrder.status.toLowerCase().includes('shortage') ? 'bg-red-500 text-white' :
                        selectedOrder.status.toLowerCase().includes('released') ? 'bg-emerald-500 text-white' :
                        selectedOrder.status.toLowerCase().includes('completed') ? 'bg-green-500 text-white' :
                        'bg-black/40 text-white border border-white/20'
                      }`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    {/* Customer & Product */}
                    <h2 className={`text-2xl font-bold ${colors.text} mt-1`}>{customerName}</h2>
                    <p className={`${colors.text} opacity-90 text-sm mt-0.5`}>{selectedOrder.product}</p>
                    {selectedOrder.packaging && (
                      <span className={`${colors.text} opacity-80 text-xs inline-flex items-center gap-1 mt-1`}>📦 {selectedOrder.packaging}</span>
                    )}
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-xl p-2.5 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* Big Progress Section */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full"></span>
                      Production Progress
                    </h3>
                    <span className="text-slate-300 text-sm bg-slate-800/50 px-3 py-1.5 rounded-lg">
                      Work Center: <span className="text-white font-bold">{selectedOrder.work_center}</span>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-5 mb-4">
                    {/* Big Percentage */}
                    <div className="col-span-1 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-2xl p-6 text-center border border-slate-700/50 shadow-lg">
                      <div className={`text-6xl font-black tracking-tight ${
                        actualPct >= 100 ? 'text-green-400' :
                        actualPct >= 75 ? 'text-blue-400' :
                        actualPct >= 50 ? 'text-yellow-400' :
                        actualPct > 0 ? 'text-orange-400' : 'text-slate-300'
                      }`}>
                        {Math.round(actualPct)}%
                      </div>
                      <div className="text-slate-300 text-sm mt-2 font-medium uppercase tracking-wide">Actual Complete</div>
                      <div className="mt-4 w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-3 rounded-full transition-all duration-500 ${
                            actualPct >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                            actualPct >= 75 ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                            actualPct >= 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' : 'bg-gradient-to-r from-orange-500 to-red-400'
                          }`}
                          style={{ width: `${Math.min(actualPct, 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Quantities */}
                    <div className="col-span-2 grid grid-cols-3 gap-3">
                      <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                        <div className="text-slate-300 text-xs mb-1">REQUIRED</div>
                        <div className="text-3xl font-bold text-white">{selectedOrder.required}</div>
                        <div className="text-slate-300 text-xs">{selectedOrder.packaging || 'units'}</div>
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
                        <div className="text-slate-300 text-xs">START</div>
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
                        <div className="text-slate-300 text-xs">END</div>
                        <div className="text-white font-semibold">{selectedOrder.end_date || '—'}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
                      <div className="text-center">
                        <div className="text-slate-300 text-xs">PROMISED TO CUSTOMER</div>
                        <div className="text-yellow-400 font-bold text-lg">{selectedOrder.promised_date || '—'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-300 text-xs">DAYS TO COMPLETE</div>
                        <div className={`font-bold text-lg ${
                          selectedOrder.dtc <= 1 ? 'text-red-400' : 
                          selectedOrder.dtc <= 3 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {selectedOrder.dtc ? `${selectedOrder.dtc} days` : '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-300 text-xs">PLANNED</div>
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
                          <div className="text-slate-300 text-xs">MO Number</div>
                          <div className="text-purple-300 font-mono font-bold text-lg">{selectedOrder.mo_data.mo_no}</div>
                        </div>
                        <div>
                          <div className="text-slate-300 text-xs">Build Item</div>
                          <div className="text-white font-mono">{selectedOrder.mo_data.item_no}</div>
                        </div>
                        <div>
                          <div className="text-slate-300 text-xs">Status</div>
                          <div className="text-white font-semibold">{selectedOrder.mo_data.status || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-300 text-xs">Priority</div>
                          <div className="text-white">{selectedOrder.mo_data.priority || '—'}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                          <div className="text-slate-300 text-xs">ORDERED</div>
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
                          <div className="text-slate-300 text-xs">Order Date</div>
                          <div className="text-white">{selectedOrder.mo_data.order_date || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-300 text-xs">Start Date</div>
                          <div className="text-white">{selectedOrder.mo_data.start_date || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-300 text-xs">Release Date</div>
                          <div className="text-white">{selectedOrder.mo_data.release_date || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-300 text-xs">Due Date</div>
                          <div className="text-yellow-400 font-semibold">{selectedOrder.mo_data.due_date || '—'}</div>
                        </div>
                      </div>

                      {(selectedOrder.mo_data.customer || selectedOrder.mo_data.notes) && (
                        <div className="mt-4 pt-4 border-t border-purple-500/20">
                          {selectedOrder.mo_data.customer && (
                            <div className="mb-2">
                              <span className="text-slate-300 text-sm">Customer: </span>
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
                    <div className="bg-slate-800/30 rounded-xl p-6 text-center text-slate-300">
                      No MO data available from MISys
                    </div>
                  )}
                </div>

                {/* Materials / BOM - Premium Card Design */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-green-500 rounded-full"></span>
                      📦 Bill of Materials
                    </h3>
                    <span className="text-slate-300 text-sm bg-slate-700/50 px-4 py-2 rounded-xl font-semibold">
                      {selectedOrder.materials?.filter(m => m.required_qty > 0).length || 0} unique components
                    </span>
                  </div>
                  {selectedOrder.materials && selectedOrder.materials.length > 0 ? (
                    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                      {/* Table with fixed layout */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" style={{ minWidth: '800px' }}>
                          <thead>
                            <tr className="bg-slate-700/50 border-b border-slate-600/50">
                              <th className="w-12 px-3 py-4 text-center text-xs text-slate-200 font-bold uppercase tracking-wider">#</th>
                              <th className="px-4 py-4 text-left text-xs text-slate-200 font-bold uppercase tracking-wider" style={{ minWidth: '200px' }}>Component</th>
                              <th className="w-24 px-3 py-4 text-right text-xs text-slate-200 font-bold uppercase tracking-wider">Need</th>
                              <th className="w-24 px-3 py-4 text-right text-xs text-slate-200 font-bold uppercase tracking-wider">Issued</th>
                              <th className="w-20 px-3 py-4 text-right text-xs text-slate-200 font-bold uppercase tracking-wider">Left</th>
                              <th className="w-20 px-3 py-4 text-right text-xs text-slate-200 font-bold uppercase tracking-wider">Stock</th>
                              <th className="w-16 px-3 py-4 text-right text-xs text-slate-200 font-bold uppercase tracking-wider">WIP</th>
                              <th className="w-28 px-3 py-4 text-center text-xs text-slate-200 font-bold uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.materials.filter(m => m.required_qty > 0).map((mat, idx) => {
                              // SMART LOGIC: Account for WIP (Work In Progress)
                              const remainingNeeded = Math.max(0, mat.required_qty - mat.completed_qty);
                              const availableTotal = mat.stock_on_hand + (mat.wip || 0);
                              const isShort = availableTotal < remainingNeeded && remainingNeeded > 0 && (mat.wip || 0) === 0;
                              const isInProgress = (mat.wip || 0) > 0;
                              const isDone = mat.completed_qty >= mat.required_qty;
                              const pctComplete = mat.required_qty > 0 ? Math.round((mat.completed_qty / mat.required_qty) * 100) : 0;
                              
                              return (
                                <tr 
                                  key={idx} 
                                  className={`border-b border-slate-700/30 transition-all duration-200 ${
                                    isShort ? 'bg-red-500/10 hover:bg-red-500/15' : 
                                    isDone ? 'bg-green-500/5 hover:bg-green-500/10' :
                                    'hover:bg-slate-700/30'
                                  }`}
                                >
                                  <td className="px-3 py-4 text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-700/50 text-slate-400 text-xs font-bold">
                                      {idx + 1}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="text-white font-mono text-sm font-bold tracking-wide">{mat.component_item_no}</div>
                                    {mat.component_description && (
                                      <div className="text-slate-400 text-xs mt-1 leading-relaxed" style={{ maxWidth: '300px' }}>
                                        {mat.component_description}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-4 text-right">
                                    <div className="text-white font-bold text-base">{mat.required_qty.toLocaleString()}</div>
                                    <div className="text-slate-300 text-xs">{mat.unit}</div>
                                  </td>
                                  <td className="px-3 py-4 text-right">
                                    <div className={`font-bold text-base ${isDone ? 'text-green-400' : 'text-blue-400'}`}>
                                      {mat.completed_qty.toLocaleString()}
                                    </div>
                                    <div className="text-slate-300 text-xs">({pctComplete}%)</div>
                                  </td>
                                  <td className="px-3 py-4 text-right">
                                    <span className={`font-bold text-base ${remainingNeeded === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                      {remainingNeeded.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-3 py-4 text-right">
                                    <span className={`font-bold text-base ${mat.stock_on_hand >= remainingNeeded ? 'text-green-400' : 'text-red-400'}`}>
                                      {mat.stock_on_hand.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-3 py-4 text-right">
                                    <span className={`font-bold ${mat.wip > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>
                                      {mat.wip > 0 ? mat.wip.toLocaleString() : '-'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-4 text-center">
                                    {isDone ? (
                                      <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-xs font-bold">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                        READY
                                      </span>
                                    ) : isInProgress ? (
                                      <span className="inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded-full text-xs font-bold">
                                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                                        IN WIP
                                      </span>
                                    ) : isShort ? (
                                      <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-xs font-bold">
                                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                        SHORT
                                      </span>
                                    ) : remainingNeeded === 0 ? (
                                      <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-xs font-bold">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                        READY
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-xs font-bold">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                        READY
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Summary Footer */}
                      <div className="bg-slate-700/30 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">Progress:</span>
                            <span className="text-white font-bold">
                              {selectedOrder.materials.filter(m => m.completed_qty >= m.required_qty).length} of {selectedOrder.materials.filter(m => m.required_qty > 0).length}
                            </span>
                            <span className="text-slate-300 text-sm">complete</span>
                          </div>
                          {selectedOrder.materials.some(m => (m.wip || 0) > 0) && (
                            <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-500/15 px-3 py-1 rounded-full text-sm font-medium">
                              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                              {selectedOrder.materials.filter(m => (m.wip || 0) > 0).length} in WIP
                            </span>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-2 font-bold px-5 py-2 rounded-xl text-sm ${
                          selectedOrder.materials.some(m => {
                            const remaining = Math.max(0, m.required_qty - m.completed_qty);
                            const available = m.stock_on_hand + (m.wip || 0);
                            return available < remaining && remaining > 0 && (m.wip || 0) === 0;
                          }) ? 'text-red-400 bg-red-500/15 border border-red-500/30' : 'text-green-400 bg-green-500/15 border border-green-500/30'
                        }`}>
                          {selectedOrder.materials.some(m => {
                            const remaining = Math.max(0, m.required_qty - m.completed_qty);
                            const available = m.stock_on_hand + (m.wip || 0);
                            return available < remaining && remaining > 0 && (m.wip || 0) === 0;
                          }) ? (
                            <>
                              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                              Material Shortage
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                              Materials OK
                            </>
                          )}
                        </span>
                      </div>
                      
                      {/* Formula Summary - Cleaner Design */}
                      <div className="bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-cyan-500/10 px-5 py-5">
                        <h4 className="text-blue-400 font-bold text-sm mb-4 flex items-center gap-2">
                          📊 Formula Summary - Total Components Needed
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-800/70 rounded-xl p-5 border border-slate-700/30">
                            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Total Required</div>
                            <div className="text-white font-black text-3xl tracking-tight">
                              {selectedOrder.materials
                                .filter(m => m.required_qty > 0)
                                .reduce((sum, m) => sum + m.required_qty, 0)
                                .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-slate-300 text-xs mt-2">across all components</div>
                          </div>
                          <div className="bg-slate-800/70 rounded-xl p-5 border border-slate-700/30">
                            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Total Remaining</div>
                            <div className="text-yellow-400 font-black text-3xl tracking-tight">
                              {selectedOrder.materials
                                .filter(m => m.required_qty > 0)
                                .reduce((sum, m) => {
                                  const remaining = Math.max(0, m.required_qty - m.completed_qty);
                                  return sum + remaining;
                                }, 0)
                                .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-slate-300 text-xs mt-2">still needed to complete</div>
                          </div>
                        </div>
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
                          <div className="text-slate-300 text-xs">Unit Cost</div>
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
                        <div className="text-slate-300 text-xs">Customer</div>
                        <div className="text-white font-semibold">{selectedOrder.so_data.customer}</div>
                      </div>
                      <div>
                        <div className="text-slate-300 text-xs">Order Date</div>
                        <div className="text-white">{selectedOrder.so_data.order_date || '—'}</div>
                      </div>
                      <div>
                        <div className="text-slate-300 text-xs">Ship Date</div>
                        <div className="text-white">{selectedOrder.so_data.ship_date || '—'}</div>
                      </div>
                      <div>
                        <div className="text-slate-300 text-xs">SO Status</div>
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
