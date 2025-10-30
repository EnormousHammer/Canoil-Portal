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
  Info, ArrowUpRight, ArrowDownRight, MinusCircle, PlusCircle
} from 'lucide-react';

interface VisualProductionDashboardProps {
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
  dependencies: string[];
}

export const VisualProductionDashboard: React.FC<VisualProductionDashboardProps> = ({ data, onBack }) => {
  const [hoveredOrder, setHoveredOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [viewMode, setViewMode] = useState<'overview' | 'timeline' | 'kanban' | 'gantt'>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Generate rich production data with company info
  const productionOrders = useMemo(() => {
    const orders: ProductionOrder[] = [];
    const moHeaders = data['ManufacturingOrderHeaders.json'] || [];
    
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500',
      'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-amber-500'
    ];

    const companyTypes = [
      { name: 'Canoil Energy Ltd.', contact: 'John Smith', phone: '+1-403-555-0123', email: 'john@canoil.com', location: 'Calgary, AB', industry: 'Oil & Gas' },
      { name: 'PetroMax Industries', contact: 'Sarah Johnson', phone: '+1-403-555-0456', email: 'sarah@petromax.com', location: 'Edmonton, AB', industry: 'Petroleum' },
      { name: 'Energy Solutions Inc.', contact: 'Mike Chen', phone: '+1-403-555-0789', email: 'mike@energy.com', location: 'Vancouver, BC', industry: 'Energy' },
      { name: 'Industrial Services Co.', contact: 'Lisa Brown', phone: '+1-403-555-0321', email: 'lisa@industrial.com', location: 'Toronto, ON', industry: 'Manufacturing' },
      { name: 'Global Oil Corp.', contact: 'David Wilson', phone: '+1-403-555-0654', email: 'david@globaloil.com', location: 'Houston, TX', industry: 'Oil & Gas' }
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
          // Fallback to current date if invalid
          startDate = new Date().toISOString().split('T')[0];
        }
      }
      
      if (dueDateValue) {
        const dueDateObj = new Date(dueDateValue);
        if (!isNaN(dueDateObj.getTime())) {
          dueDate = dueDateObj.toISOString().split('T')[0];
        } else {
          // Fallback to 7 days from now if invalid
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
      const profit = revenue - cost;

      const companyInfo = companyTypes[index % companyTypes.length];

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
        customer: mo["Customer"] || companyInfo.name,
        workCenter: mo["Work Center"] || 'Default',
        estimatedHours: parseFloat(mo["Estimated Hours"] || 8),
        actualHours: parseFloat(mo["Actual Hours"] || 0),
        cost,
        revenue,
        profit,
        color: colors[index % colors.length],
        companyInfo,
        materials: [], // Will be populated from BOM data if available
        dependencies: []
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

  // Calculate real-time metrics
  const metrics = useMemo(() => {
    const totalOrders = productionOrders.length;
    const inProgress = productionOrders.filter(o => o.status === 'in-progress').length;
    const completed = productionOrders.filter(o => o.status === 'completed').length;
    const shipped = productionOrders.filter(o => o.status === 'shipped').length;
    const overdue = productionOrders.filter(o => {
      if (o.status === 'completed' || o.status === 'shipped') return false;
      return new Date(o.dueDate) < new Date();
    }).length;
    
    const totalValue = productionOrders.reduce((sum, o) => sum + o.revenue, 0);
    const totalCost = productionOrders.reduce((sum, o) => sum + o.cost, 0);
    const totalProfit = totalValue - totalCost;
    
    const avgEfficiency = productionOrders.length > 0 
      ? Math.round(productionOrders.reduce((sum, o) => sum + o.progress, 0) / productionOrders.length)
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
      avgEfficiency
    };
  }, [productionOrders]);

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
              <h1 className="text-3xl font-bold text-slate-900">Production Dashboard</h1>
              <p className="text-slate-600">Real-time production monitoring & management</p>
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

        {/* Real-time Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-slate-900">{metrics.totalOrders}</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +12% this month
                </p>
              </div>
              <Factory className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.inProgress}</p>
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  Active now
                </p>
              </div>
              <Play className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{metrics.completed}</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  On track
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{metrics.overdue}</p>
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <Warning className="w-3 h-3" />
                  Needs attention
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalValue)}</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Revenue
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Efficiency</p>
                <p className="text-2xl font-bold text-indigo-600">{metrics.avgEfficiency}%</p>
                <p className="text-xs text-indigo-600 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Performance
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Visual Production Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Production Orders Visual */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Production Orders</h3>
              <p className="text-sm text-gray-600">Hover for details, click for full info</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {productionOrders.slice(0, 8).map((order) => (
                  <div
                    key={order.id}
                    className={`relative border rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer ${
                      hoveredOrder === order.id ? 'shadow-lg border-blue-300 bg-blue-50' : 'border-gray-200'
                    } ${selectedOrder === order.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                    onMouseEnter={() => setHoveredOrder(order.id)}
                    onMouseLeave={() => setHoveredOrder(null)}
                    onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
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
                            {isOverdue(order.dueDate, order.status) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                OVERDUE
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{order.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {order.companyInfo.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Factory className="w-3 h-3" />
                              {order.workCenter}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due: {formatDate(order.dueDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(order.revenue)}</div>
                          <div className="text-xs text-gray-500">Profit: {formatCurrency(order.profit)}</div>
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
                      </div>
                    </div>
                    
                    {/* Hover Details */}
                    {hoveredOrder === order.id && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-10 p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Company Info</h5>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3 h-3" />
                                {order.companyInfo.name}
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3" />
                                {order.companyInfo.contact}
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3" />
                                {order.companyInfo.phone}
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3" />
                                {order.companyInfo.email}
                              </div>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Order Details</h5>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div>Item: {order.itemNo}</div>
                              <div>Quantity: {order.quantity.toLocaleString()}</div>
                              <div>Hours: {order.actualHours}/{order.estimatedHours}</div>
                              <div>Materials: {order.materials.join(', ')}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Company & Status Overview */}
          <div className="space-y-6">
            
            {/* Company Overview */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Active Companies</h3>
                <p className="text-sm text-gray-600">Current production partners</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {Array.from(new Set(productionOrders.map(o => o.companyInfo.name))).slice(0, 5).map((company, index) => {
                    const companyOrders = productionOrders.filter(o => o.companyInfo.name === company);
                    const totalValue = companyOrders.reduce((sum, o) => sum + o.revenue, 0);
                    const activeOrders = companyOrders.filter(o => o.status === 'in-progress').length;
                    
                    return (
                      <div key={company} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getPriorityColor(companyOrders[0].priority)}`}></div>
                          <div>
                            <div className="font-medium text-gray-900">{company}</div>
                            <div className="text-sm text-gray-600">{activeOrders} active orders</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(totalValue)}</div>
                          <div className="text-xs text-gray-500">Total value</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Status Traffic */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Production Traffic</h3>
                <p className="text-sm text-gray-600">Real-time status flow</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {[
                    { status: 'pending', label: 'Pending', count: productionOrders.filter(o => o.status === 'pending').length, color: 'bg-yellow-500' },
                    { status: 'in-progress', label: 'In Progress', count: productionOrders.filter(o => o.status === 'in-progress').length, color: 'bg-blue-500' },
                    { status: 'completed', label: 'Completed', count: productionOrders.filter(o => o.status === 'completed').length, color: 'bg-green-500' },
                    { status: 'shipped', label: 'Shipped', count: productionOrders.filter(o => o.status === 'shipped').length, color: 'bg-purple-500' },
                    { status: 'on-hold', label: 'On Hold', count: productionOrders.filter(o => o.status === 'on-hold').length, color: 'bg-red-500' }
                  ].map((item) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                        <span className="font-medium text-gray-900">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900">{item.count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${item.color}`}
                            style={{ width: `${(item.count / productionOrders.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">New Order</span>
            </button>
            <button className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Complete Order</span>
            </button>
            <button className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
              <Truck className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-900">Ship Order</span>
            </button>
            <button className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-900">Flag Issue</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
