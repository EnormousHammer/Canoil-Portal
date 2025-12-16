import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Factory, ChevronLeft, ChevronRight, AlertTriangle, X, Info, HelpCircle, Calendar, Bell, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { format, addDays, startOfWeek, differenceInDays, parseISO, isValid } from 'date-fns';

// Customer color palette
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
  } catch {}
  return null;
}

interface MPSOrder {
  so_number: string;
  mo_number: string;
  work_center: string;
  status: string;
  product: string;
  customer_code?: string;
  packaging?: string;
  required: number;
  ready: number;
  planned_pct: string;
  actual_pct: string;
  promised_date: string;
  start_date: string;
  end_date: string;
  duration: number;
  dtc: number;
  action_items?: string;
  [key: string]: any;
}

interface MPSGanttScheduleProps {
  data: any;
  onRefresh?: () => void;
  loading?: boolean;
}

interface ChangeNotification {
  id: string;
  type: 'progress' | 'status' | 'new' | 'completed';
  customer: string;
  soNumber: string;
  moNumber: string;
  message: string;
  details: string;
  timestamp: Date;
  isPositive: boolean;
}

export const MPSGanttSchedule: React.FC<MPSGanttScheduleProps> = ({ data, onRefresh, loading }) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedOrder, setSelectedOrder] = useState<MPSOrder | null>(null);
  const [viewDays, setViewDays] = useState(14);
  const [showLegend, setShowLegend] = useState(false);
  const [notifications, setNotifications] = useState<ChangeNotification[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const previousOrdersRef = useRef<Map<string, MPSOrder>>(new Map());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add notification
  const addNotification = useCallback((notification: Omit<ChangeNotification, 'id' | 'timestamp'>) => {
    const newNotif: ChangeNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 10)); // Keep last 10
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
    }, 8000);
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Get MPS orders from preloaded data
  const orders: MPSOrder[] = useMemo(() => {
    const mpsData = data?.['MPS.json'] || {};
    const mpsOrders = mpsData.mps_orders || [];
    
    // Map the portal MPS format to our expected format
    return mpsOrders.map((order: any) => ({
      so_number: order.so_number || order.SO || order['SO Number'] || '',
      mo_number: order.mo_number || order.MO || order['MO Number'] || '',
      work_center: order.work_center || order['Work Center'] || order.WC || 'Unassigned',
      status: order.status || order.Status || '',
      product: order.product || order.Product || order.Description || '',
      customer_code: order.customer_code || order.Customer || '',
      packaging: order.packaging || order.Packaging || '',
      required: parseFloat(order.required || order.Required || order.Qty || 0),
      ready: parseFloat(order.ready || order.Ready || order.Completed || 0),
      planned_pct: order.planned_pct || order['Planned %'] || '0%',
      actual_pct: order.actual_pct || order['Actual %'] || '0%',
      promised_date: order.promised_date || order['Promised Date'] || order.promised || '',
      start_date: order.start_date || order['Start Date'] || order.start || '',
      end_date: order.end_date || order['End Date'] || order.end || '',
      duration: parseFloat(order.duration || order.Duration || 1),
      dtc: parseFloat(order.dtc || order.DTC || 0),
      action_items: order.action_items || order['Action Items'] || '',
    }));
  }, [data]);

  // Detect changes and generate notifications
  useEffect(() => {
    if (!orders.length) return;
    
    const currentOrdersMap = new Map<string, MPSOrder>();
    orders.forEach(o => currentOrdersMap.set(`${o.so_number}-${o.mo_number}`, o));
    
    const prevMap = previousOrdersRef.current;
    
    // Only check for changes if we have previous data
    if (prevMap.size > 0) {
      orders.forEach(order => {
        const key = `${order.so_number}-${order.mo_number}`;
        const prev = prevMap.get(key);
        const customer = order.product.includes(' - ') ? order.product.split(' - ')[0].trim() : order.customer_code || 'Customer';
        
        if (!prev) {
          // New order added
          addNotification({
            type: 'new',
            customer,
            soNumber: order.so_number,
            moNumber: order.mo_number,
            message: `New order added`,
            details: `${order.product} - ${order.required} units scheduled`,
            isPositive: true
          });
        } else {
          // Check for progress changes
          const prevPct = parseFloat(prev.actual_pct) || 0;
          const currPct = parseFloat(order.actual_pct) || 0;
          const prevReady = prev.ready || 0;
          const currReady = order.ready || 0;
          
          if (currPct !== prevPct || currReady !== prevReady) {
            const remaining = Math.max(0, order.required - currReady);
            const pctChange = currPct - prevPct;
            const isOnTarget = order.dtc > 1 || currPct >= 90;
            
            if (currPct >= 100 && prevPct < 100) {
              addNotification({
                type: 'completed',
                customer,
                soNumber: order.so_number,
                moNumber: order.mo_number,
                message: `Order COMPLETED! 🎉`,
                details: `${currReady} ${order.packaging || 'units'} finished. Ready for shipping!`,
                isPositive: true
              });
            } else if (Math.abs(pctChange) >= 5) {
              addNotification({
                type: 'progress',
                customer,
                soNumber: order.so_number,
                moNumber: order.mo_number,
                message: `Progress updated to ${Math.round(currPct)}%`,
                details: `${currReady} done, ${remaining} to go. ${isOnTarget ? 'On target! ✓' : 'Behind schedule ⚠️'}`,
                isPositive: pctChange > 0
              });
            }
          }
          
          // Check for status changes
          if (prev.status !== order.status) {
            const isShortage = order.status.toLowerCase().includes('shortage');
            addNotification({
              type: 'status',
              customer,
              soNumber: order.so_number,
              moNumber: order.mo_number,
              message: `Status changed to "${order.status}"`,
              details: isShortage ? 'Material shortage detected - action required' : `Previous: ${prev.status}`,
              isPositive: !isShortage
            });
          }
        }
      });
    }
    
    // Update previous orders ref
    previousOrdersRef.current = currentOrdersMap;
    setLastUpdate(new Date());
  }, [orders, addNotification]);

  // Real-time polling - refresh every 30 seconds
  useEffect(() => {
    if (onRefresh) {
      pollIntervalRef.current = setInterval(() => {
        onRefresh();
      }, 30000); // 30 seconds
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [onRefresh]);

  const days = useMemo(() => {
    return Array.from({ length: viewDays }, (_, i) => addDays(weekStart, i));
  }, [weekStart, viewDays]);

  const columnWidth = useMemo(() => {
    if (viewDays <= 7) return 112;
    if (viewDays <= 14) return 90;
    if (viewDays <= 21) return 70;
    return 56;
  }, [viewDays]);

  const workCenters = useMemo(() => {
    const wcs = new Set(orders.map(o => o.work_center).filter(Boolean));
    return Array.from(wcs).sort();
  }, [orders]);

  const customerLegend = useMemo(() => {
    const customers = new Map<string, { bg: string; count: number }>();
    orders.forEach(order => {
      let customerName = order.product.includes(' - ') ? order.product.split(' - ')[0].trim() : order.customer_code || 'Other';
      if (customerName.length > 20) customerName = customerName.substring(0, 20) + '...';
      const colors = getCustomerColor(order.product);
      const existing = customers.get(customerName);
      if (existing) existing.count++;
      else customers.set(customerName, { bg: colors.bg, count: 1 });
    });
    return Array.from(customers.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [orders]);

  const getOrdersForWorkCenter = (wc: string) => {
    return orders
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
          isShortage: order.status.toLowerCase().includes('shortage')
        };
      })
      .filter(o => o.startOffset + o.duration > 0 && o.startOffset < viewDays);
  };

  const navigateWeek = (direction: number) => {
    setWeekStart(prev => addDays(prev, direction * 7));
  };

  const goToToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const todayOffset = differenceInDays(new Date(), weekStart);

  if (!orders.length) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-slate-900 rounded-xl">
        <div className="text-center">
          <Factory className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-xl">No production orders found</p>
          <p className="text-slate-500 text-sm mt-2">MPS data may not be loaded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex-shrink-0 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Factory className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Production Schedule</h1>
              <p className="text-slate-500 text-sm">
                {orders.length} orders • 
                <span className="text-green-400 ml-1">● Live</span>
                <span className="text-slate-600 ml-2">Updated {format(lastUpdate, 'h:mm:ss a')}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={viewDays}
              onChange={(e) => setViewDays(parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value={7}>1 Week</option>
              <option value={14}>2 Weeks</option>
              <option value={21}>3 Weeks</option>
              <option value={28}>4 Weeks</option>
            </select>
            
            <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
              <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-slate-600 rounded">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button onClick={goToToday} className="px-3 py-1 hover:bg-slate-600 rounded text-white text-sm">
                Today
              </button>
              <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-slate-600 rounded">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
            
            <button
              onClick={() => setShowLegend(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
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

      {/* Gantt Chart */}
      <div className="flex-1 overflow-auto p-4">
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
                      {format(day, 'EEE')}
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
                <div className="w-24 flex-shrink-0 px-3 py-3 border-r border-slate-700 flex items-center">
                  <span className="bg-slate-600 px-2 py-1 rounded text-white text-xs font-bold">
                    {wc}
                  </span>
                </div>
                
                <div className="flex relative" style={{ height: '70px' }}>
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
                  
                  {wcOrders.map((order, idx) => {
                    const colors = getCustomerColor(order.product);
                    const left = Math.max(0, order.startOffset) * columnWidth;
                    const width = Math.min(order.duration, viewDays - Math.max(0, order.startOffset)) * columnWidth - 4;
                    const actualPct = parseFloat(order.actual_pct) || 0;
                    const customerName = order.product.split(' - ')[0] || order.customer_code || 'Unknown';
                    
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
                        <div 
                          className="absolute inset-0 bg-black/30"
                          style={{ width: `${100 - actualPct}%`, right: 0, left: 'auto' }}
                        />
                        <div className={`relative px-2 py-0.5 ${colors.text}`}>
                          <div className="text-[10px] font-bold flex items-center gap-1">
                            <span className="bg-black/20 px-1 rounded">{order.so_number}</span>
                            <span className="opacity-70">MO:{order.mo_number}</span>
                            {order.isShortage && <span>⚠️</span>}
                          </div>
                          <div className="text-xs font-semibold truncate">{customerName}</div>
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
        const customerName = selectedOrder.product.split(' - ')[0] || 'Unknown';
        const colors = getCustomerColor(selectedOrder.product);
        
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              
              <div className={`${colors.bg} px-6 py-4 flex-shrink-0 rounded-t-2xl`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className="bg-black/30 px-3 py-1.5 rounded-lg">
                        <div className="text-white/60 text-[10px] uppercase">Sales Order</div>
                        <div className="text-white text-lg font-bold">{selectedOrder.so_number}</div>
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
                    <h2 className={`text-xl font-bold ${colors.text}`}>{customerName}</h2>
                    <p className={`${colors.text} opacity-90 text-sm`}>{selectedOrder.product}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-white/70 hover:text-white bg-black/20 rounded-full p-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {/* Progress */}
                <div className="mb-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-center border border-slate-700">
                      <div className={`text-4xl font-black ${
                        actualPct >= 100 ? 'text-green-400' :
                        actualPct >= 75 ? 'text-blue-400' :
                        actualPct >= 50 ? 'text-yellow-400' : 'text-orange-400'
                      }`}>
                        {Math.round(actualPct)}%
                      </div>
                      <div className="text-slate-400 text-xs mt-1">COMPLETE</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                      <div className="text-2xl font-bold text-white">{selectedOrder.required}</div>
                      <div className="text-slate-500 text-xs">REQUIRED</div>
                    </div>
                    <div className="bg-green-500/10 rounded-xl p-4 text-center border border-green-500/30">
                      <div className="text-2xl font-bold text-green-400">{selectedOrder.ready || 0}</div>
                      <div className="text-green-400/50 text-xs">READY</div>
                    </div>
                    <div className="bg-yellow-500/10 rounded-xl p-4 text-center border border-yellow-500/30">
                      <div className="text-2xl font-bold text-yellow-400">{remaining}</div>
                      <div className="text-yellow-400/50 text-xs">REMAINING</div>
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Schedule
                  </h3>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-slate-500 text-xs">START</div>
                      <div className="text-white font-semibold">{selectedOrder.start_date || '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">END</div>
                      <div className="text-white font-semibold">{selectedOrder.end_date || '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">PROMISED</div>
                      <div className="text-yellow-400 font-bold">{selectedOrder.promised_date || '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">DAYS TO COMPLETE</div>
                      <div className={`font-bold ${
                        selectedOrder.dtc <= 1 ? 'text-red-400' : 
                        selectedOrder.dtc <= 3 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {selectedOrder.dtc ? `${selectedOrder.dtc} days` : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedOrder.action_items && (
                  <div className="mt-4 p-4 bg-red-500/10 rounded-xl border border-red-500/30">
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

      {/* Toast Notifications - Top Right */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-md">
        {notifications.map((notif, idx) => {
          const colors = getCustomerColor(notif.customer);
          return (
            <div
              key={notif.id}
              className={`bg-slate-900 border-l-4 ${notif.isPositive ? 'border-l-green-500' : 'border-l-red-500'} rounded-lg shadow-2xl p-4 animate-slide-in-right`}
              style={{ 
                animation: 'slideInRight 0.3s ease-out',
                animationDelay: `${idx * 50}ms`
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${notif.isPositive ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {notif.type === 'completed' ? (
                    <CheckCircle className={`w-5 h-5 ${notif.isPositive ? 'text-green-400' : 'text-red-400'}`} />
                  ) : notif.type === 'progress' ? (
                    notif.isPositive ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )
                  ) : notif.type === 'new' ? (
                    <Bell className="w-5 h-5 text-blue-400" />
                  ) : (
                    <AlertTriangle className={`w-5 h-5 ${notif.isPositive ? 'text-yellow-400' : 'text-red-400'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors.bg} ${colors.text}`}>
                      {notif.customer}
                    </span>
                    <span className="text-slate-500 text-xs">
                      SO:{notif.soNumber} • MO:{notif.moNumber}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-sm">{notif.message}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{notif.details}</p>
                  <p className="text-slate-600 text-[10px] mt-1">
                    {format(notif.timestamp, 'h:mm:ss a')}
                  </p>
                </div>
                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="text-slate-500 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CSS for slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Legend Modal */}
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
              <div>
                <h3 className="text-lg font-bold text-white mb-3">🧴 Grease Lines (GL1, GL2)</h3>
                <div className="bg-slate-800 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-white">Working with drums</span>
                    <span className="text-green-400 font-bold">4,000 tubes/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white">Working with bins</span>
                    <span className="text-green-400 font-bold">4,500 tubes/day</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-3">🎨 Status Colors</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span className="text-white">Shortage</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                    <div className="w-4 h-4 rounded bg-blue-500"></div>
                    <span className="text-white">Released</span>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

