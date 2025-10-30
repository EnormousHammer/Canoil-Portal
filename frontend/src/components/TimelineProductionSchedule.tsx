import React, { useState, useMemo, useEffect } from 'react';
import { 
  Factory, Clock, CheckCircle, AlertTriangle, Play, Pause, Calendar, 
  Users, Package, TrendingUp, Filter, Search, RefreshCw, Brain, 
  BarChart3, PieChart, Activity, Target, Zap, Eye, Upload,
  ChevronDown, ChevronUp, Download, Share2, Settings, Truck,
  MapPin, Timer, DollarSign, BarChart, LineChart, GanttChart,
  Workflow, Layers, Zap as Lightning, AlertCircle, CheckSquare,
  ArrowRight, ArrowDown, ArrowUp, Minus, Plus, Maximize2,
  Minimize2, RotateCcw, Save, Edit3, Trash2, Copy, ExternalLink,
  Grid, List, Calendar as CalendarIcon, Clock3, Star, Flag,
  Building2, User, Phone, Mail, Globe, MapPin as Location,
  TrendingDown, AlertCircle as Warning, CheckCircle2, XCircle,
  Info, ArrowUpRight, ArrowDownRight, MinusCircle, PlusCircle,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Move
} from 'lucide-react';

interface TimelineProductionScheduleProps {
  data: any;
  onBack: () => void;
}

interface ProductionOrder {
  id: string;
  orderNo: string;
  itemNo: string;
  description: string;
  quantity: number;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'shipped';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: Date;
  dueDate: Date;
  progress: number;
  customer: string;
  workCenter: string;
  estimatedHours: number;
  actualHours: number;
  cost: number;
  revenue: number;
  profit: number;
  color: string;
  companyInfo: {
    name: string;
    contact: string;
    phone: string;
    email: string;
    location: string;
    industry: string;
  };
  materials: string[];
}

export const TimelineProductionSchedule: React.FC<TimelineProductionScheduleProps> = ({ data, onBack }) => {
  const [hoveredOrder, setHoveredOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'30days' | '3months' | '6months' | '12months'>('30days');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Generate production data from MPS (Master Production Schedule) as primary source
  const productionOrders = useMemo(() => {
    const orders: ProductionOrder[] = [];
    
    // MPS is the master - this is our production schedule
    const mpsData = data['MPS.json'];
    if (!mpsData || !mpsData.mps_orders || !Array.isArray(mpsData.mps_orders)) {
      console.log('⚠️ No MPS data available, falling back to Manufacturing Orders');
      return [];
    }

    console.log('📊 Using MPS data as primary source:', mpsData.mps_orders.length, 'orders');
    
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500',
      'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-amber-500'
    ];

    // Get MISys data for additional details
    const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
    const moDetails = data['ManufacturingOrderDetails.json'] || [];
    const salesOrders = data['SalesOrders.json'] || [];
    const items = data['Items.json'] || [];

    // Process each MPS order
    mpsData.mps_orders.forEach((mpsOrder: any, index: number) => {
      // Pad MO number with zeros to match MISys format
      const paddedMoNumber = mpsOrder.order_id ? mpsOrder.order_id.padStart(10, '0') : '';
      
      // Find corresponding MO in MISys data
      const correspondingMO = moHeaders.find((mo: any) => {
        const misysMoNumber = mo["Mfg. Order No."] ? mo["Mfg. Order No."].padStart(10, '0') : '';
        return misysMoNumber === paddedMoNumber || mo["Mfg. Order No."] === mpsOrder.order_id;
      });

      // Use MPS data as primary, MISys data for additional details
      const mo = correspondingMO || {};
      let status: ProductionOrder['status'] = 'pending';
      if (mo["Status"] === 0) status = 'pending';
      else if (mo["Status"] === 1) status = 'in-progress';
      else if (mo["Status"] === 2) status = 'in-progress';
      else if (mo["Status"] === 3) status = 'completed';
      
      let priority: ProductionOrder['priority'] = 'medium';
      if (mo["Priority"] === 1) priority = 'urgent';
      else if (mo["Priority"] === 2) priority = 'high';
      else if (mo["Priority"] === 3) priority = 'medium';
      else if (mo["Priority"] === 4) priority = 'low';
      
      const progress = status === 'completed' ? 100 : 
                     status === 'shipped' ? 100 :
                     status === 'in-progress' ? Math.min(90, Math.max(10, (actualHours / estimatedHours) * 100)) : 0;
      
      // Create proper dates with fallbacks
      let startDate = new Date();
      let dueDate = new Date();
      
      if (mo["Start Date"]) {
        const startDateObj = new Date(mo["Start Date"]);
        if (!isNaN(startDateObj.getTime())) {
          startDate = startDateObj;
        }
      }
      
      if (mo["Due Date"]) {
        const dueDateObj = new Date(mo["Due Date"]);
        if (!isNaN(dueDateObj.getTime())) {
          dueDate = dueDateObj;
        } else {
          // Fallback to 7 days from start date
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + 7);
        }
      } else {
        // Fallback to 7 days from start date
        dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + 7);
      }
      
      const quantity = parseFloat(mo["Ordered"] || mo["Release Order Quantity"] || 0);
      
      // Get real item data
      const item = items.find((i: any) => i["Item No."] === mo["Build Item No."]);
      const cost = parseFloat(item?.["Unit Cost"] || 0) * quantity;
      const revenue = parseFloat(item?.["Unit Price"] || 0) * quantity;
      const profit = revenue - cost;

      // Get real customer data from sales orders
      const relatedSO = salesOrders.find((so: any) => so["Order No."] === mo["Sales Order No."]);
      const customerName = mo["Customer"] || relatedSO?.["Customer"] || 'Internal';
      
      const companyInfo = {
        name: customerName,
        contact: relatedSO?.["Contact"] || 'N/A',
        phone: relatedSO?.["Phone"] || 'N/A',
        email: relatedSO?.["Email"] || 'N/A',
        location: relatedSO?.["City"] || 'N/A',
        industry: 'Manufacturing'
      };

      orders.push({
        id: mo["Mfg. Order No."],
        orderNo: mo["Mfg. Order No."],
        itemNo: mo["Build Item No."],
        description: mo["Description"] || 'Production Order',
        quantity,
        status,
        priority,
        startDate,
        dueDate,
        progress: Math.round(progress),
        customer: customerName,
        workCenter: mo["Work Center"] || 'Default',
        estimatedHours: parseFloat(mo["Estimated Hours"] || 8),
        actualHours: parseFloat(mo["Actual Hours"] || 0),
        cost,
        revenue,
        profit,
        color: colors[index % colors.length],
        companyInfo,
        materials: [] // Will be populated from BOM data if available
      });
    });

    // Sort by newest MOs first (by order date or creation date)
    return orders.sort((a, b) => {
      // Try to sort by order date first, then by MO number
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime(); // Newest first
      }
      
      // If dates are the same, sort by MO number (newest first)
      return b.orderNo.localeCompare(a.orderNo);
    });
  }, [data]);

  // Calculate timeline dimensions based on time range
  const timelineData = useMemo(() => {
    const now = new Date();
    let timelineStart: Date;
    let timelineEnd: Date;
    let totalDays: number;
    let dayWidth: number;
    
    switch (timeRange) {
      case '30days':
        timelineStart = new Date(now);
        timelineStart.setDate(now.getDate() - 15); // 15 days before today
        timelineEnd = new Date(now);
        timelineEnd.setDate(now.getDate() + 15); // 15 days after today
        totalDays = 30;
        dayWidth = 80 * zoomLevel;
        break;
      case '3months':
        timelineStart = new Date(now);
        timelineStart.setMonth(now.getMonth() - 1.5); // 1.5 months before
        timelineEnd = new Date(now);
        timelineEnd.setMonth(now.getMonth() + 1.5); // 1.5 months after
        totalDays = 90;
        dayWidth = 30 * zoomLevel;
        break;
      case '6months':
        timelineStart = new Date(now);
        timelineStart.setMonth(now.getMonth() - 3); // 3 months before
        timelineEnd = new Date(now);
        timelineEnd.setMonth(now.getMonth() + 3); // 3 months after
        totalDays = 180;
        dayWidth = 20 * zoomLevel;
        break;
      case '12months':
        timelineStart = new Date(now);
        timelineStart.setMonth(now.getMonth() - 6); // 6 months before
        timelineEnd = new Date(now);
        timelineEnd.setMonth(now.getMonth() + 6); // 6 months after
        totalDays = 365;
        dayWidth = 10 * zoomLevel;
        break;
      default:
        timelineStart = new Date(now);
        timelineStart.setDate(now.getDate() - 15);
        timelineEnd = new Date(now);
        timelineEnd.setDate(now.getDate() + 15);
        totalDays = 30;
        dayWidth = 80 * zoomLevel;
    }
    
    return {
      start: timelineStart,
      end: timelineEnd,
      totalDays,
      dayWidth,
      totalWidth: totalDays * dayWidth
    };
  }, [timeRange, zoomLevel]);

  // Calculate order positions
  const positionedOrders = useMemo(() => {
    return productionOrders.map(order => {
      const startOffset = Math.max(0, (order.startDate.getTime() - timelineData.start.getTime()) / (1000 * 60 * 60 * 24));
      const endOffset = Math.max(0, (order.dueDate.getTime() - timelineData.start.getTime()) / (1000 * 60 * 60 * 24));
      
      const left = startOffset * timelineData.dayWidth;
      const width = Math.max(60, (endOffset - startOffset) * timelineData.dayWidth);
      
      return {
        ...order,
        left,
        width,
        isVisible: order.startDate <= timelineData.end && order.dueDate >= timelineData.start
      };
    }).filter(order => order.isVisible);
  }, [productionOrders, timelineData]);

  // Generate timeline days
  const timelineDays = useMemo(() => {
    const days = [];
    const current = new Date(timelineData.start);
    
    while (current <= timelineData.end) {
      days.push({
        date: new Date(current),
        isToday: current.toDateString() === new Date().toDateString(),
        isWeekend: current.getDay() === 0 || current.getDay() === 6
      });
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [timelineData]);

  const getStatusColor = (status: ProductionOrder['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'on-hold': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: ProductionOrder['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: ProductionOrder['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'in-progress': return <Play className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'on-hold': return <Pause className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate: Date, status: ProductionOrder['status']) => {
    if (status === 'completed' || status === 'shipped') return false;
    return dueDate < new Date();
  };

  const navigateTimeline = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const daysToMove = timeRange === '30days' ? 30 : 
                      timeRange === '3months' ? 90 : 
                      timeRange === '6months' ? 180 : 365;
    
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - daysToMove);
    } else {
      newDate.setDate(newDate.getDate() + daysToMove);
    }
    setCurrentDate(newDate);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Timeline Production Schedule</h1>
              <p className="text-slate-600">Production orders positioned by date on timeline</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Timeline Controls */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateTimeline('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateTimeline('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600 ml-2">
                  Scroll 30 days
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {[
                    { id: '30days', label: '30 Days' },
                    { id: '3months', label: '3 Months' },
                    { id: '6months', label: '6 Months' },
                    { id: '12months', label: '12 Months' }
                  ].map((range) => (
                    <button
                      key={range.id}
                      onClick={() => setTimeRange(range.id as any)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        timeRange === range.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                <div className="text-sm text-gray-600">
                  {formatDate(timelineData.start)} - {formatDate(timelineData.end)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ZoomOut 
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.2))}
                  className="w-5 h-5 text-gray-600 hover:text-gray-900 cursor-pointer"
                />
                <span className="text-sm text-gray-600 min-w-[60px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <ZoomIn 
                  onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.2))}
                  className="w-5 h-5 text-gray-600 hover:text-gray-900 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-4">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Production Timeline</h3>
            <p className="text-sm text-gray-600">
              {formatDate(timelineData.start)} - {formatDate(timelineData.end)}
            </p>
          </div>
          
          {/* Timeline Days */}
          <div className="overflow-x-auto">
            <div className="flex min-w-max">
              {timelineDays.map((day, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 p-2 text-center border-r border-gray-200 ${
                    day.isToday ? 'bg-blue-50 border-blue-200' : 
                    day.isWeekend ? 'bg-gray-50' : 'bg-white'
                  }`}
                  style={{ width: `${timelineData.dayWidth}px` }}
                >
                  <div className="text-xs font-medium text-gray-900">
                    {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-sm font-bold ${
                    day.isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {day.date.getDate()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {day.date.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Real MO Data Summary */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-4">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Real Manufacturing Orders</h3>
            <p className="text-sm text-gray-600">Showing {productionOrders.length} orders from your MPS data</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productionOrders.slice(0, 6).map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-900">MO: {order.orderNo}</div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1 capitalize">{order.status.replace('-', ' ')}</span>
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div><span className="font-medium">Item:</span> {order.itemNo}</div>
                    <div><span className="font-medium">Customer:</span> {order.customer}</div>
                    <div><span className="font-medium">Quantity:</span> {order.quantity.toLocaleString()}</div>
                    <div><span className="font-medium">Due:</span> {formatDate(order.dueDate)}</div>
                    <div><span className="font-medium">Value:</span> {formatCurrency(order.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
            {productionOrders.length > 6 && (
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-500">... and {productionOrders.length - 6} more orders</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Content */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Production Timeline</h3>
            <p className="text-sm text-gray-600">Timeline view of your real MO data - hover for details</p>
          </div>
          
          <div className="relative overflow-x-auto">
            <div className="relative" style={{ minWidth: `${timelineData.totalWidth}px`, height: '600px' }}>
              
              {/* Today Line */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" 
                   style={{ left: `${((new Date().getTime() - timelineData.start.getTime()) / (1000 * 60 * 60 * 24)) * timelineData.dayWidth}px` }}>
                <div className="absolute -top-2 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="absolute -top-6 left-1 text-xs font-medium text-red-600 bg-white px-1 rounded">
                  Today
                </div>
              </div>
              
              {/* Production Orders */}
              {positionedOrders.map((order, index) => (
                <div
                  key={order.id}
                  className={`absolute h-12 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg hover:z-20 ${
                    hoveredOrder === order.id ? 'shadow-lg z-20' : ''
                  } ${selectedOrder === order.id ? 'ring-2 ring-blue-500' : ''}`}
                  style={{
                    left: `${order.left}px`,
                    width: `${order.width}px`,
                    top: `${index * 60 + 20}px`
                  }}
                  onMouseEnter={() => setHoveredOrder(order.id)}
                  onMouseLeave={() => setHoveredOrder(null)}
                  onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                >
                  <div className={`h-full rounded-lg p-2 ${order.color} text-white relative overflow-hidden`}>
                    <div className="flex items-center justify-between h-full">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">MO: {order.orderNo}</div>
                        <div className="text-xs opacity-90 truncate">{order.itemNo} - {order.description}</div>
                        <div className="text-xs opacity-75 truncate">{order.customer}</div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(order.priority)}`}></div>
                        {getStatusIcon(order.status)}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-20">
                      <div 
                        className="h-full bg-white bg-opacity-60 transition-all duration-300"
                        style={{ width: `${order.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Hover Details */}
                  {hoveredOrder === order.id && (
                    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 p-4 min-w-[300px]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">{order.orderNo}</h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span className="ml-1 capitalize">{order.status.replace('-', ' ')}</span>
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{order.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium">MO Number:</span> {order.orderNo}
                          </div>
                          <div>
                            <span className="font-medium">Item No:</span> {order.itemNo}
                          </div>
                          <div>
                            <span className="font-medium">Customer:</span> {order.companyInfo.name}
                          </div>
                          <div>
                            <span className="font-medium">Work Center:</span> {order.workCenter}
                          </div>
                          <div>
                            <span className="font-medium">Quantity:</span> {order.quantity.toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Priority:</span> {order.priority.toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium">Start:</span> {formatDate(order.startDate)}
                          </div>
                          <div>
                            <span className="font-medium">Due:</span> {formatDate(order.dueDate)}
                          </div>
                          <div>
                            <span className="font-medium">Hours:</span> {order.actualHours}/{order.estimatedHours}
                          </div>
                          <div>
                            <span className="font-medium">Value:</span> {formatCurrency(order.revenue)}
                          </div>
                          <div>
                            <span className="font-medium">Cost:</span> {formatCurrency(order.cost)}
                          </div>
                          <div>
                            <span className="font-medium">Progress:</span> {order.progress}%
                          </div>
                        </div>
                        {isOverdue(order.dueDate, order.status) && (
                          <div className="text-red-600 text-sm font-medium flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            OVERDUE
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-xl p-4 shadow-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-600">Urgent Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm text-gray-600">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-gray-600">Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-600">Low Priority</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
