import React, { useState, useMemo, useEffect } from 'react';
import { 
  Factory, Clock, CheckCircle, AlertTriangle, Play, Pause, Calendar, 
  Users, Package, TrendingUp, Filter, Search, RefreshCw, Brain, 
  BarChart3, PieChart, Activity, Target, Zap, Eye, Upload,
  ChevronDown, ChevronUp, Download, Share2, Settings, Truck,
  MapPin, Timer, DollarSign, BarChart, LineChart, GanttChart,
  Workflow, Layers, Zap as Lightning, AlertCircle, CheckSquare,
  ArrowRight, ArrowDown, ArrowUp, Minus, Plus, Maximize2,
  Minimize2, RotateCcw, Save, Edit3, Trash2, Copy, ExternalLink
} from 'lucide-react';

interface EnterpriseProductionVisualizationProps {
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
  startDate: string;
  dueDate: string;
  progress: number;
  customer: string;
  salesOrderNo?: string;
  workCenter?: string;
  estimatedHours: number;
  actualHours: number;
  completionDate?: string;
  shipmentDate?: string;
  trackingNumber?: string;
  cost: number;
  revenue: number;
  profit: number;
  materials: string[];
  dependencies: string[];
  resourceAllocation: {
    workCenter: string;
    operator: string;
    equipment: string;
    materials: string[];
  };
}

interface Shipment {
  id: string;
  orderNo: string;
  customer: string;
  itemNo: string;
  quantity: number;
  shipDate: string;
  trackingNumber: string;
  status: 'pending' | 'shipped' | 'delivered' | 'delayed';
  carrier: string;
  destination: string;
  cost: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface WorkCenter {
  id: string;
  name: string;
  capacity: number;
  utilization: number;
  efficiency: number;
  operators: number;
  equipment: string[];
  currentOrders: string[];
  queue: string[];
}

interface ProductionMetrics {
  totalOrders: number;
  inProgress: number;
  completed: number;
  shipped: number;
  overdue: number;
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  avgEfficiency: number;
  onTimeDelivery: number;
  capacityUtilization: number;
  materialShortages: number;
  equipmentDowntime: number;
}

export const EnterpriseProductionVisualization: React.FC<EnterpriseProductionVisualizationProps> = ({ data, onBack }) => {
  const [activeView, setActiveView] = useState<'overview' | 'gantt' | 'timeline' | 'resources' | 'shipments' | 'analytics'>('overview');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Process comprehensive production data
  const productionData = useMemo(() => {
    const orders: ProductionOrder[] = [];
    const shipments: Shipment[] = [];
    const workCenters: WorkCenter[] = [];

    // Process Manufacturing Orders
    const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
    const moDetails = data['ManufacturingOrderDetails.json'] || [];
    const salesOrders = data['SalesOrders.json'] || [];
    const items = data['Items.json'] || [];

    // Create work centers
    const workCenterMap = new Map<string, WorkCenter>();
    
    moHeaders.forEach((mo: any) => {
      const workCenter = mo["Work Center"] || 'Default';
      if (!workCenterMap.has(workCenter)) {
        workCenterMap.set(workCenter, {
          id: workCenter,
          name: workCenter,
          capacity: 100,
          utilization: 0,
          efficiency: 85,
          operators: 3,
          equipment: ['Machine A', 'Machine B'],
          currentOrders: [],
          queue: []
        });
      }
    });

    workCenters.push(...Array.from(workCenterMap.values()));

    // Process orders
    moHeaders.forEach((mo: any) => {
      const details = moDetails.filter((detail: any) => detail["Mfg. Order No."] === mo["Mfg. Order No."]);
      const relatedSO = salesOrders.find((so: any) => so["Order No."] === mo["Sales Order No."]);
      const item = items.find((i: any) => i["Item No."] === mo["Build Item No."]);
      
      let status: ProductionOrder['status'] = 'pending';
      if (mo["Status"] === 0) status = 'pending';
      else if (mo["Status"] === 1) status = 'in-progress';
      else if (mo["Status"] === 2) status = 'in-progress';
      else if (mo["Status"] === 3) status = 'completed';
      
      // Check if shipped
      if (status === 'completed' && relatedSO) {
        status = 'shipped';
      }
      
      let priority: ProductionOrder['priority'] = 'medium';
      if (mo["Priority"] === 1) priority = 'urgent';
      else if (mo["Priority"] === 2) priority = 'high';
      else if (mo["Priority"] === 3) priority = 'medium';
      else if (mo["Priority"] === 4) priority = 'low';
      
      const progress = status === 'completed' ? 100 : 
                     status === 'shipped' ? 100 :
                     status === 'in-progress' ? Math.min(90, Math.max(10, (actualHours / estimatedHours) * 100)) : 0;
      
      // Safely handle date conversion with fallbacks
      const startDateValue = mo["Start Date"];
      const dueDateValue = mo["Due Date"];
      const completionDateValue = mo["Completion Date"];
      
      let startDate = '';
      let dueDate = '';
      let completionDate = undefined;
      
      if (startDateValue) {
        const startDateObj = new Date(startDateValue);
        if (!isNaN(startDateObj.getTime())) {
          startDate = startDateObj.toISOString().split('T')[0];
        } else {
          startDate = new Date().toISOString().split('T')[0];
        }
      }
      
      if (dueDateValue) {
        const dueDateObj = new Date(dueDateValue);
        if (!isNaN(dueDateObj.getTime())) {
          dueDate = dueDateObj.toISOString().split('T')[0];
        } else {
          const fallbackDate = new Date();
          fallbackDate.setDate(fallbackDate.getDate() + 7);
          dueDate = fallbackDate.toISOString().split('T')[0];
        }
      }
      
      if (completionDateValue) {
        const completionDateObj = new Date(completionDateValue);
        if (!isNaN(completionDateObj.getTime())) {
          completionDate = completionDateObj.toISOString().split('T')[0];
        }
      }
      
      const quantity = parseFloat(mo["Ordered"] || mo["Release Order Quantity"] || 0);
      const cost = parseFloat(item?.["Unit Cost"] || 0) * quantity;
      const revenue = parseFloat(item?.["Unit Price"] || 0) * quantity;
      const profit = revenue - cost;

      const order: ProductionOrder = {
        id: mo["Mfg. Order No."],
        orderNo: mo["Mfg. Order No."],
        itemNo: mo["Build Item No."],
        description: mo["Description"] || 'No Description',
        quantity,
        status,
        priority,
        startDate,
        dueDate,
        progress: Math.round(progress),
        customer: mo["Customer"] || 'Internal',
        salesOrderNo: mo["Sales Order No."],
        workCenter: mo["Work Center"] || 'Default',
        estimatedHours: parseFloat(mo["Estimated Hours"] || 8),
        actualHours: parseFloat(mo["Actual Hours"] || 0),
        completionDate,
        shipmentDate: status === 'shipped' ? completionDate : undefined,
        trackingNumber: status === 'shipped' ? `TRK${mo["Mfg. Order No."].substr(-6).toUpperCase()}` : undefined,
        cost,
        revenue,
        profit,
        materials: details.map((d: any) => d["Item No."]).filter(Boolean),
        dependencies: [],
        resourceAllocation: {
          workCenter: mo["Work Center"] || 'Default',
          operator: mo["Work Center"] || 'Default Operator',
          equipment: 'Machine A',
          materials: details.map((d: any) => d["Item No."]).filter(Boolean)
        }
      };

      orders.push(order);

      // Create shipment if completed
      if (status === 'shipped') {
        shipments.push({
          id: `SHIP-${mo["Mfg. Order No."]}`,
          orderNo: mo["Mfg. Order No."],
          customer: mo["Customer"] || 'Internal',
          itemNo: mo["Build Item No."],
          quantity,
          shipDate: completionDate || '',
          trackingNumber: order.trackingNumber || '',
          status: 'shipped',
          carrier: 'FedEx',
          destination: 'Customer Location',
          cost: cost * 0.1, // 10% shipping cost
          priority
        });
      }
    });

    // Sort orders by newest MOs first (by order date or creation date)
    orders.sort((a, b) => {
      // Try to sort by order date first, then by MO number
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime(); // Newest first
      }
      
      // If dates are the same, sort by MO number (newest first)
      return b.orderNo.localeCompare(a.orderNo);
    });

    return { orders, shipments, workCenters };
  }, [data]);

  // Calculate comprehensive metrics
  const metrics: ProductionMetrics = useMemo(() => {
    const { orders, shipments } = productionData;
    
    const totalOrders = orders.length;
    const inProgress = orders.filter(o => o.status === 'in-progress').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const shipped = orders.filter(o => o.status === 'shipped').length;
    const overdue = orders.filter(o => {
      if (o.status === 'completed' || o.status === 'shipped') return false;
      return new Date(o.dueDate) < new Date();
    }).length;
    
    const totalValue = orders.reduce((sum, o) => sum + o.revenue, 0);
    const totalCost = orders.reduce((sum, o) => sum + o.cost, 0);
    const totalProfit = totalValue - totalCost;
    
    const avgEfficiency = orders.length > 0 
      ? Math.round(orders.reduce((sum, o) => sum + o.progress, 0) / orders.length)
      : 0;
    
    const onTimeDelivery = shipped > 0 
      ? Math.round((shipped - overdue) / shipped * 100)
      : 100;
    
    const capacityUtilization = productionData.workCenters.length > 0
      ? Math.round(productionData.workCenters.reduce((sum, wc) => sum + wc.utilization, 0) / productionData.workCenters.length)
      : 0;

    return {
      totalOrders,
      inProgress,
      completed,
      shipped,
      overdue,
      totalValue,
      totalCost,
      totalProfit,
      avgEfficiency,
      onTimeDelivery,
      capacityUtilization,
      materialShortages: 0, // Will be calculated from real data if available
      equipmentDowntime: 0 // Will be calculated from real data if available
    };
  }, [productionData]);

  // Filter orders based on current filters
  const filteredOrders = useMemo(() => {
    let filtered = productionData.orders.filter(order => {
      const matchesSearch = order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           order.itemNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           order.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           order.customer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesWorkCenter = selectedWorkCenter === 'all' || order.workCenter === selectedWorkCenter;
      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      
      return matchesSearch && matchesWorkCenter && matchesStatus;
    });

    return filtered;
  }, [productionData.orders, searchQuery, selectedWorkCenter, selectedStatus]);

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not Set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate: string, status: ProductionOrder['status']) => {
    if (status === 'completed' || status === 'shipped') return false;
    return new Date(dueDate) < new Date();
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
              <h1 className="text-3xl font-bold text-slate-900">Enterprise Production Schedule</h1>
              <p className="text-slate-600">Comprehensive manufacturing operations & shipment tracking</p>
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

        {/* Comprehensive Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-slate-900">{metrics.totalOrders}</p>
              </div>
              <Factory className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.inProgress}</p>
              </div>
              <Play className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Shipped</p>
                <p className="text-2xl font-bold text-purple-600">{metrics.shipped}</p>
              </div>
              <Truck className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{metrics.overdue}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalValue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Efficiency</p>
                <p className="text-2xl font-bold text-indigo-600">{metrics.avgEfficiency}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search orders, items, customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work Center</label>
                <select
                  value={selectedWorkCenter}
                  onChange={(e) => setSelectedWorkCenter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Work Centers</option>
                  {productionData.workCenters.map(wc => (
                    <option key={wc.id} value={wc.id}>{wc.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="shipped">Shipped</option>
                  <option value="on-hold">On Hold</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* View Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'gantt', label: 'Gantt Chart', icon: GanttChart },
                { id: 'timeline', label: 'Timeline', icon: Timeline },
                { id: 'resources', label: 'Resources', icon: Users },
                { id: 'shipments', label: 'Shipments', icon: Truck },
                { id: 'analytics', label: 'Analytics', icon: TrendingUp }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeView === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeView === 'overview' && (
              <div className="space-y-6">
                {/* Production Orders Table */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Production Orders</h3>
                    <p className="text-sm text-gray-600">All manufacturing orders with detailed status and metrics</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredOrders.map((order) => (
                          <React.Fragment key={order.id}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className={`w-3 h-3 rounded-full ${getPriorityColor(order.priority)} mr-3`}></div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{order.orderNo}</div>
                                    <div className="text-sm text-gray-500">{order.workCenter}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{order.itemNo}</div>
                                  <div className="text-sm text-gray-500 truncate max-w-xs">{order.description}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customer}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                  {getStatusIcon(order.status)}
                                  <span className="ml-1 capitalize">{order.status.replace('-', ' ')}</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${order.progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-900">{order.progress}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>{formatCurrency(order.revenue)}</div>
                                <div className="text-xs text-gray-500">Profit: {formatCurrency(order.profit)}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div>{formatDate(order.dueDate)}</div>
                                {isOverdue(order.dueDate, order.status) && (
                                  <div className="text-xs text-red-600 font-medium">OVERDUE</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => toggleOrderExpansion(order.id)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  {expandedOrders.has(order.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </td>
                            </tr>
                            
                            {/* Expanded Order Details */}
                            {expandedOrders.has(order.id) && (
                              <tr className="bg-gray-50">
                                <td colSpan={8} className="px-6 py-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                      <h4 className="font-medium text-gray-900 mb-2">Resource Allocation</h4>
                                      <div className="space-y-1 text-sm text-gray-600">
                                        <div>Work Center: {order.resourceAllocation.workCenter}</div>
                                        <div>Operator: {order.resourceAllocation.operator}</div>
                                        <div>Equipment: {order.resourceAllocation.equipment}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-medium text-gray-900 mb-2">Materials</h4>
                                      <div className="text-sm text-gray-600">
                                        {order.materials.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {order.materials.slice(0, 3).map((material, idx) => (
                                              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                {material}
                                              </span>
                                            ))}
                                            {order.materials.length > 3 && (
                                              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                                +{order.materials.length - 3} more
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400">No materials</span>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-medium text-gray-900 mb-2">Tracking</h4>
                                      <div className="space-y-1 text-sm text-gray-600">
                                        {order.trackingNumber && (
                                          <div>Tracking: {order.trackingNumber}</div>
                                        )}
                                        {order.shipmentDate && (
                                          <div>Shipped: {formatDate(order.shipmentDate)}</div>
                                        )}
                                        <div>Hours: {order.actualHours}/{order.estimatedHours}</div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'shipments' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Shipment Tracking</h3>
                    <p className="text-sm text-gray-600">All shipments with tracking information and delivery status</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ship Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productionData.shipments.map((shipment) => (
                          <tr key={shipment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shipment.orderNo}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shipment.customer}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shipment.itemNo}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shipment.quantity.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{shipment.trackingNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                shipment.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                shipment.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                shipment.status === 'delayed' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                <Truck className="w-3 h-3 mr-1" />
                                {shipment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(shipment.shipDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Add other view implementations here */}
            {activeView === 'gantt' && (
              <div className="text-center py-12">
                <GanttChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Gantt Chart View</h3>
                <p className="text-gray-600">Interactive Gantt chart visualization coming soon</p>
              </div>
            )}

            {activeView === 'timeline' && (
              <div className="text-center py-12">
                <Timeline className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Timeline View</h3>
                <p className="text-gray-600">Production timeline visualization coming soon</p>
              </div>
            )}

            {activeView === 'resources' && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Resource Management</h3>
                <p className="text-gray-600">Work center and resource allocation view coming soon</p>
              </div>
            )}

            {activeView === 'analytics' && (
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
                <p className="text-gray-600">Advanced analytics and reporting coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
