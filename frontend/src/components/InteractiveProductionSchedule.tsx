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
  Grid, List, Calendar as CalendarIcon, Clock3, Star, Flag
} from 'lucide-react';

interface InteractiveProductionScheduleProps {
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
  workCenter: string;
  estimatedHours: number;
  actualHours: number;
  cost: number;
  revenue: number;
  color: string;
}

export const InteractiveProductionSchedule: React.FC<InteractiveProductionScheduleProps> = ({ data, onBack }) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'kanban' | 'gantt' | 'calendar'>('timeline');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Generate interactive production data
  const productionOrders = useMemo(() => {
    const orders: ProductionOrder[] = [];
    const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
    
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500',
      'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-amber-500'
    ];

    moHeaders.forEach((mo: any, index: number) => {
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
      
      // Safely handle date conversion with fallbacks
      const startDateValue = mo["Start Date"];
      const dueDateValue = mo["Due Date"];
      
      let startDate = '';
      let dueDate = '';
      
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
      
      const quantity = parseFloat(mo["Ordered"] || mo["Release Order Quantity"] || 0);
      
      // Get real item data for cost and revenue
      const item = items.find((i: any) => i["Item No."] === mo["Build Item No."]);
      const unitCost = parseFloat(item?.["Unit Cost"] || item?.["Standard Cost"] || 0);
      const unitPrice = parseFloat(item?.["Unit Price"] || item?.["Selling Price"] || 0);
      const cost = unitCost * quantity;
      const revenue = unitPrice * quantity;

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
        customer: mo["Customer"] || 'Internal',
        workCenter: mo["Work Center"] || 'Default',
        estimatedHours: parseFloat(mo["Estimated Hours"] || 8),
        actualHours: parseFloat(mo["Actual Hours"] || 0),
        cost,
        revenue,
        color: colors[index % colors.length]
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

  // Filter orders
  const filteredOrders = useMemo(() => {
    return productionOrders.filter(order => {
      const matchesSearch = order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           order.itemNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           order.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           order.customer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesWorkCenter = selectedWorkCenter === 'all' || order.workCenter === selectedWorkCenter;
      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      
      return matchesSearch && matchesWorkCenter && matchesStatus;
    });
  }, [productionOrders, searchQuery, selectedWorkCenter, selectedStatus]);

  // Group orders by status for Kanban view
  const kanbanGroups = useMemo(() => {
    const groups = {
      pending: filteredOrders.filter(o => o.status === 'pending'),
      'in-progress': filteredOrders.filter(o => o.status === 'in-progress'),
      completed: filteredOrders.filter(o => o.status === 'completed'),
      shipped: filteredOrders.filter(o => o.status === 'shipped'),
      'on-hold': filteredOrders.filter(o => o.status === 'on-hold')
    };
    return groups;
  }, [filteredOrders]);

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

  const handleDragStart = (orderId: string) => {
    setDraggedOrder(orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: ProductionOrder['status']) => {
    e.preventDefault();
    if (draggedOrder) {
      // In a real app, you'd update the order status here
      console.log(`Moving order ${draggedOrder} to ${newStatus}`);
      setDraggedOrder(null);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
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
              <h1 className="text-3xl font-bold text-slate-900">Interactive Production Schedule</h1>
              <p className="text-slate-600">Drag, drop, and manage your production orders in real-time</p>
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

        {/* View Mode Toggle */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View Mode:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {[
                  { id: 'timeline', label: 'Timeline', icon: CalendarIcon },
                  { id: 'kanban', label: 'Kanban', icon: Grid },
                  { id: 'gantt', label: 'Gantt', icon: GanttChart },
                  { id: 'calendar', label: 'Calendar', icon: Calendar }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as any)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === mode.id
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <mode.icon className="w-4 h-4" />
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  {Array.from(new Set(productionOrders.map(o => o.workCenter))).map(wc => (
                    <option key={wc} value={wc}>{wc}</option>
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
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedWorkCenter('all');
                    setSelectedStatus('all');
                  }}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Views */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          
          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Timeline</h3>
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                      expandedOrders.has(order.id) ? 'shadow-md border-blue-300' : 'border-gray-200'
                    }`}
                    onClick={() => toggleOrderExpansion(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full ${getPriorityColor(order.priority)}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{order.orderNo}</h4>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                              {getStatusIcon(order.status)}
                              <span className="ml-1 capitalize">{order.status.replace('-', ' ')}</span>
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{order.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>Customer: {order.customer}</span>
                            <span>Work Center: {order.workCenter}</span>
                            <span>Due: {formatDate(order.dueDate)}</span>
                            {isOverdue(order.dueDate, order.status) && (
                              <span className="text-red-600 font-medium">OVERDUE</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(order.revenue)}</div>
                          <div className="text-xs text-gray-500">Profit: {formatCurrency(order.revenue - order.cost)}</div>
                        </div>
                        <div className="w-24">
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{order.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${order.color.replace('bg-', 'bg-')}`}
                              style={{ width: `${order.progress}%` }}
                            ></div>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedOrders.has(order.id) ? 'rotate-180' : ''
                        }`} />
                      </div>
                    </div>
                    
                    {expandedOrders.has(order.id) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Resource Details</h5>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div>Work Center: {order.workCenter}</div>
                              <div>Estimated Hours: {order.estimatedHours}</div>
                              <div>Actual Hours: {order.actualHours}</div>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Financials</h5>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div>Cost: {formatCurrency(order.cost)}</div>
                              <div>Revenue: {formatCurrency(order.revenue)}</div>
                              <div>Profit: {formatCurrency(order.revenue - order.cost)}</div>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Timeline</h5>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div>Start: {formatDate(order.startDate)}</div>
                              <div>Due: {formatDate(order.dueDate)}</div>
                              <div>Quantity: {order.quantity.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Kanban Board</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {Object.entries(kanbanGroups).map(([status, orders]) => (
                  <div key={status} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900 capitalize">{status.replace('-', ' ')}</h4>
                      <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                        {orders.length}
                      </span>
                    </div>
                    <div 
                      className="space-y-3 min-h-[400px]"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, status as ProductionOrder['status'])}
                    >
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={() => handleDragStart(order.id)}
                          className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-move ${
                            draggedOrder === order.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${getPriorityColor(order.priority)}`}></div>
                              <span className="text-sm font-medium text-gray-900">{order.orderNo}</span>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              {getStatusIcon(order.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{order.description}</p>
                          <div className="space-y-1 text-xs text-gray-500">
                            <div>Customer: {order.customer}</div>
                            <div>Due: {formatDate(order.dueDate)}</div>
                            <div>Value: {formatCurrency(order.revenue)}</div>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>Progress</span>
                              <span>{order.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${order.color.replace('bg-', 'bg-')}`}
                                style={{ width: `${order.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gantt View */}
          {viewMode === 'gantt' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Gantt Chart</h3>
              <div className="space-y-2">
                {filteredOrders.map((order) => {
                  const startDate = new Date(order.startDate);
                  const dueDate = new Date(order.dueDate);
                  const today = new Date();
                  const totalDays = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const progressDays = Math.ceil((totalDays * order.progress) / 100);
                  
                  return (
                    <div key={order.id} className="flex items-center gap-4 py-2">
                      <div className="w-32 text-sm font-medium text-gray-900 truncate">
                        {order.orderNo}
                      </div>
                      <div className="flex-1 relative">
                        <div className="h-8 bg-gray-200 rounded-lg relative overflow-hidden">
                          <div 
                            className={`h-full ${order.color} rounded-lg transition-all duration-300`}
                            style={{ width: `${Math.min(100, (progressDays / totalDays) * 100)}%` }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                            {order.progress}%
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{formatDate(order.startDate)}</span>
                          <span>{formatDate(order.dueDate)}</span>
                        </div>
                      </div>
                      <div className="w-24 text-sm text-gray-600 text-right">
                        {order.customer}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Calendar</h3>
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Calendar View</h4>
                <p className="text-gray-600">Interactive calendar view coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
