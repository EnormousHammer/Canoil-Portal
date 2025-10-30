import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Factory, 
  Calendar, 
  Package, 
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Settings,
  Filter,
  Search,
  Download,
  RefreshCw,
  BarChart3,
  GanttChart,
  Zap,
  Target,
  Activity,
  Eye,
  Edit3,
  MoreHorizontal
} from 'lucide-react';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  customer: string;
  product: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'delayed' | 'on-hold';
  workCenter: string;
  startDate: string;
  endDate: string;
  quantity: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  estimatedHours: number;
  actualHours: number;
  revenue: number;
  materials: string[];
}

interface WorkCenter {
  id: string;
  name: string;
  capacity: number;
  utilization: number;
  efficiency: number;
  operators: number;
  equipment: string[];
  color: string;
  icon: React.ReactNode;
}

interface EnterpriseProductionCalendarProps {
  onBack: () => void;
  data?: any;
}

export const EnterpriseProductionCalendar: React.FC<EnterpriseProductionCalendarProps> = ({ onBack, data }) => {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [workCenterFilter, setWorkCenterFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Enterprise work centers with rich metadata
  const workCenters: WorkCenter[] = [
    {
      id: 'grease-line-1',
      name: 'Grease Line 1',
      capacity: 100,
      utilization: 85,
      efficiency: 92,
      operators: 4,
      equipment: ['Mixer A', 'Filler B', 'Labeler C'],
      color: 'from-green-500 to-emerald-600',
      icon: <Factory className="w-5 h-5" />
    },
    {
      id: 'oil-line-1',
      name: 'Oil Line 1',
      capacity: 100,
      utilization: 78,
      efficiency: 88,
      operators: 3,
      equipment: ['Blender X', 'Pump Y', 'Filter Z'],
      color: 'from-blue-500 to-cyan-600',
      icon: <Package className="w-5 h-5" />
    },
    {
      id: 'grease-line-2',
      name: 'Grease Line 2',
      capacity: 100,
      utilization: 65,
      efficiency: 85,
      operators: 3,
      equipment: ['Mixer D', 'Filler E', 'Labeler F'],
      color: 'from-emerald-500 to-green-600',
      icon: <Factory className="w-5 h-5" />
    },
    {
      id: 'oil-line-2',
      name: 'Oil Line 2',
      capacity: 100,
      utilization: 72,
      efficiency: 90,
      operators: 3,
      equipment: ['Blender W', 'Pump V', 'Filter U'],
      color: 'from-cyan-500 to-blue-600',
      icon: <Package className="w-5 h-5" />
    },
    {
      id: 'packaging-line',
      name: 'Packaging Line',
      capacity: 100,
      utilization: 95,
      efficiency: 96,
      operators: 5,
      equipment: ['Sealer G', 'Wrapper H', 'Palletizer I'],
      color: 'from-purple-500 to-violet-600',
      icon: <Package className="w-5 h-5" />
    }
  ];

  // Process preloaded MPS data with enterprise-level processing
  useEffect(() => {
    const processMPSData = () => {
      try {
        console.log('🔄 Processing preloaded MPS data...');
        
        // Get MPS data from the main data object
        const mpsData = data?.['MPS.json'] || {};
        console.log('📊 Preloaded MPS Data:', mpsData);
        
        if (mpsData.mps_orders && Array.isArray(mpsData.mps_orders)) {
          const enterpriseOrders: ProductionOrder[] = mpsData.mps_orders.map((order: any, index: number) => {
            // Advanced date parsing
            let startDate = new Date();
            let endDate = new Date();
            
            try {
              if (order.start_date) {
                if (order.start_date.includes(',')) {
                  const parts = order.start_date.split(',');
                  if (parts.length === 2) {
                    const monthDay = parts[1].trim();
                    const currentYear = new Date().getFullYear();
                    startDate = new Date(`${monthDay} ${currentYear}`);
                  }
                } else {
                  startDate = new Date(order.start_date);
                }
              }
              
              if (order.end_date) {
                if (order.end_date.includes(',')) {
                  const parts = order.end_date.split(',');
                  if (parts.length === 2) {
                    const monthDay = parts[1].trim();
                    const currentYear = new Date().getFullYear();
                    endDate = new Date(`${monthDay} ${currentYear}`);
                  }
                } else {
                  endDate = new Date(order.end_date);
                }
              }
            } catch (e) {
              startDate = new Date();
              startDate.setDate(startDate.getDate() + index);
              endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 7) + 1);
            }
            
            // Smart work center assignment
            let workCenter = workCenters[index % workCenters.length];
            if (order.product) {
              const product = order.product.toLowerCase();
              if (product.includes('grease') || product.includes('lubricant')) {
                workCenter = workCenters.find(wc => wc.name.includes('Grease')) || workCenters[0];
              } else if (product.includes('oil') || product.includes('fluid')) {
                workCenter = workCenters.find(wc => wc.name.includes('Oil')) || workCenters[1];
              } else if (product.includes('packaging') || product.includes('container')) {
                workCenter = workCenters.find(wc => wc.name.includes('Packaging')) || workCenters[4];
              }
            }
            
            // Advanced status mapping
            let status: ProductionOrder['status'] = 'scheduled';
            const mpsStatus = (order.status || '').toString().toLowerCase();
            if (mpsStatus === 'b' || mpsStatus === 'in-progress') {
              status = 'in-progress';
            } else if (mpsStatus === 'c' || mpsStatus === 'completed') {
              status = 'completed';
            } else if (mpsStatus === 'h' || mpsStatus === 'hold') {
              status = 'on-hold';
            }
            
            // Calculate progress based on status and dates
            let progress = 0;
            if (status === 'completed') {
              progress = 100;
            } else if (status === 'in-progress') {
              const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const daysPassed = Math.max(0, (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              progress = Math.min(90, Math.max(10, (daysPassed / totalDays) * 100));
            }
            
            // Determine priority
            let priority: ProductionOrder['priority'] = 'medium';
            if (order.priority === 'urgent' || order.priority === '1') priority = 'urgent';
            else if (order.priority === 'high' || order.priority === '2') priority = 'high';
            else if (order.priority === 'low' || order.priority === '4') priority = 'low';
            
            // Calculate revenue (mock calculation)
            const quantity = parseInt(order.required || order.quantity || '1') || 1;
            const basePrice = Math.random() * 100 + 50; // Mock pricing
            const revenue = quantity * basePrice;
            
            return {
              id: `order-${index}`,
              orderNumber: order.so_number || order.order_number || `ORD-${String(index + 1).padStart(4, '0')}`,
              customer: order.customer || 'Unknown Customer',
              product: order.product || 'Production Item',
              status: status,
              workCenter: workCenter.name,
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              quantity: quantity,
              priority: priority,
              progress: Math.round(progress),
              estimatedHours: Math.floor(Math.random() * 40) + 8,
              actualHours: Math.floor(Math.random() * 30) + 4,
              revenue: Math.round(revenue),
              materials: ['Material A', 'Material B', 'Material C'] // Mock materials
            };
          });
          
          console.log('✅ Enterprise orders processed:', enterpriseOrders.length);
          setOrders(enterpriseOrders);
        } else {
          console.log('⚠️ No mps_orders found in preloaded data');
          setOrders([]);
        }
      } catch (err) {
        console.error('❌ Error processing MPS data:', err);
        setError(err instanceof Error ? err.message : 'Failed to process MPS data');
      }
    };

    if (data) {
      processMPSData();
    }
  }, [data]);

  // Get dates based on view mode
  const getDates = (date: Date) => {
    const dates = [];
    const start = new Date(date);
    
    if (viewMode === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
      }
    } else if (viewMode === 'month') {
      start.setDate(1);
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      
      for (let i = 0; i < daysInMonth; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
      }
    } else if (viewMode === 'quarter') {
      const quarter = Math.floor(start.getMonth() / 3);
      const quarterStart = new Date(start.getFullYear(), quarter * 3, 1);
      
      for (let i = 0; i < 90; i++) {
        const d = new Date(quarterStart);
        d.setDate(quarterStart.getDate() + i);
        dates.push(d);
      }
    }
    
    return dates;
  };

  const dates = getDates(currentWeek);
  
  // Advanced filtering
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesWorkCenter = workCenterFilter === 'all' || order.workCenter === workCenterFilter;
      const matchesSearch = searchTerm === '' || 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.product.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesStatus && matchesWorkCenter && matchesSearch;
    });
  }, [orders, statusFilter, workCenterFilter, searchTerm]);

  // Get orders for specific day and work center
  const getOrdersForDay = (date: Date, workCenter: string) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredOrders.filter(order => 
      order.workCenter === workCenter &&
      order.startDate <= dateStr &&
      order.endDate >= dateStr
    );
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const inProgressOrders = orders.filter(o => o.status === 'in-progress').length;
    const delayedOrders = orders.filter(o => o.status === 'delayed').length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.revenue, 0);
    const avgEfficiency = workCenters.reduce((sum, wc) => sum + wc.efficiency, 0) / workCenters.length;
    
    return {
      totalOrders,
      completedOrders,
      inProgressOrders,
      delayedOrders,
      totalRevenue,
      avgEfficiency: Math.round(avgEfficiency),
      completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0
    };
  }, [orders]);

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'delayed': return 'bg-red-100 text-red-800 border-red-200';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Factory className="w-8 h-8 text-blue-600 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Production Data</h2>
          <p className="text-blue-200">Initializing enterprise manufacturing systems...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">System Error</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors"
            >
              Retry Connection
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Enterprise Header */}
      <div className="bg-white shadow-xl border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={onBack}
                className="p-3 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-105"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg">
                  <Factory className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Production Command Center</h1>
                  <p className="text-gray-600 text-lg">
                    {viewMode === 'week' ? 'Weekly' : viewMode === 'month' ? 'Monthly' : 'Quarterly'} View • 
                    {dates[0]?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
                    {dates[dates.length - 1]?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{kpis.totalOrders}</div>
                <div className="text-sm text-gray-600 font-medium">Total Orders</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600">{kpis.completionRate}%</div>
                <div className="text-sm text-gray-600 font-medium">Completion Rate</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">${kpis.totalRevenue.toLocaleString()}</div>
                <div className="text-sm text-gray-600 font-medium">Total Revenue</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Controls */}
      <div className="bg-white border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[
                { key: 'week', label: 'Week', icon: Calendar },
                { key: 'month', label: 'Month', icon: BarChart3 },
                { key: 'quarter', label: 'Quarter', icon: GanttChart }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    viewMode === key
                      ? 'bg-white text-blue-600 shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Status Filters */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              {[
                { key: 'all', label: `All (${kpis.totalOrders})`, color: 'bg-gray-100 text-gray-700' },
                { key: 'in-progress', label: `In Progress (${kpis.inProgressOrders})`, color: 'bg-blue-100 text-blue-700' },
                { key: 'completed', label: `Completed (${kpis.completedOrders})`, color: 'bg-green-100 text-green-700' },
                { key: 'delayed', label: `Delayed (${kpis.delayedOrders})`, color: 'bg-red-100 text-red-700' }
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    statusFilter === key
                      ? `${color} shadow-md`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Work Center Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Lines:</span>
              <select
                value={workCenterFilter}
                onChange={(e) => setWorkCenterFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Lines</option>
                {workCenters.map(wc => (
                  <option key={wc.id} value={wc.name}>{wc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  const newDate = new Date(currentWeek);
                  if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
                  else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
                  else newDate.setMonth(newDate.getMonth() - 3);
                  setCurrentWeek(newDate);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  const newDate = new Date(currentWeek);
                  if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
                  else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
                  else newDate.setMonth(newDate.getMonth() + 3);
                  setCurrentWeek(newDate);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Orders', value: kpis.totalOrders, color: 'blue', icon: Package },
            { label: 'In Progress', value: kpis.inProgressOrders, color: 'orange', icon: Play },
            { label: 'Completed', value: kpis.completedOrders, color: 'green', icon: CheckCircle },
            { label: 'Avg Efficiency', value: `${kpis.avgEfficiency}%`, color: 'purple', icon: TrendingUp }
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{label}</p>
                  <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-${color}-100`}>
                  <Icon className={`w-6 h-6 text-${color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enterprise Calendar Grid */}
      <div className="px-8 pb-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          {/* Calendar Header */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-8 py-6 border-b border-gray-200">
            <div className="grid gap-4" style={{ gridTemplateColumns: `300px repeat(${dates.length}, 1fr)` }}>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Factory className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg">Production Lines</div>
                  <div className="text-sm text-gray-600">Manufacturing Centers</div>
                </div>
              </div>
              {dates.map((date, index) => (
                <div key={index} className="text-center">
                  <div className="font-bold text-gray-900 text-lg">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{date.getDate()}</div>
                  <div className="text-sm text-gray-600">
                    {date.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Production Lines */}
          {workCenters.map((workCenter) => (
            <div key={workCenter.id} className="border-b border-gray-100 last:border-b-0">
              <div className="grid gap-4 px-8 py-6 hover:bg-gray-50 transition-colors" style={{ gridTemplateColumns: `300px repeat(${dates.length}, 1fr)` }}>
                {/* Work Center Info */}
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${workCenter.color} shadow-lg`}>
                    {workCenter.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-lg">{workCenter.name}</div>
                    <div className="text-sm text-gray-600">
                      {workCenter.utilization}% Utilization • {workCenter.efficiency}% Efficiency
                    </div>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-600">{workCenter.operators} ops</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-600">{workCenter.equipment.length} machines</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Orders */}
                {dates.map((date, dayIndex) => {
                  const dayOrders = getOrdersForDay(date, workCenter.name);
                  return (
                    <div key={dayIndex} className="min-h-32 p-3 border-l border-gray-100">
                      <div className="space-y-2">
                        {dayOrders.slice(0, 3).map((order) => (
                          <div
                            key={order.id}
                            className={`p-3 rounded-xl border-2 cursor-pointer hover:shadow-md transition-all duration-200 ${getStatusColor(order.status)}`}
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderModal(true);
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-bold text-sm">#{order.orderNumber}</div>
                              <div className={`w-3 h-3 rounded-full ${getPriorityColor(order.priority)}`}></div>
                            </div>
                            <div className="text-xs font-medium truncate mb-1">{order.customer}</div>
                            <div className="text-xs opacity-75 mb-2">{order.quantity} units</div>
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-medium">{order.progress}%</div>
                              <div className="text-xs">${order.revenue.toLocaleString()}</div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${order.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                        {dayOrders.length > 3 && (
                          <div className="text-center">
                            <button className="text-xs text-blue-600 font-medium hover:text-blue-800 transition-colors">
                              +{dayOrders.length - 3} more orders
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Detail Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Order Number</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Customer</label>
                    <p className="text-lg text-gray-900">{selectedOrder.customer}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Product</label>
                    <p className="text-lg text-gray-900">{selectedOrder.product}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Quantity</label>
                    <p className="text-lg text-gray-900">{selectedOrder.quantity} units</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Revenue</label>
                    <p className="text-lg text-gray-900">${selectedOrder.revenue.toLocaleString()}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Progress</label>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>{selectedOrder.progress}% Complete</span>
                      <span>{selectedOrder.actualHours}h / {selectedOrder.estimatedHours}h</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${selectedOrder.progress}%` }}
                      ></div>
                    </div>
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
