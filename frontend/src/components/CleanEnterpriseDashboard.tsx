import React from 'react';
import { Package, Factory, ShoppingCart, AlertTriangle, TrendingUp, Truck, Brain, Zap, Target, Users, ChevronRight, FileText, BarChart3, Mail, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface CleanEnterpriseDashboardProps {
  data: any;
  inventoryMetrics: any;
  manufacturingMetrics: any;
  purchaseMetrics: any;
  salesOrderAnalytics: any;
  jobsAnalytics: any;
  formatCAD: (amount: number) => string;
  onNavigate: (tab: string) => void;
  currentUser?: { name: string; email: string; isAdmin: boolean } | null;
}

export const CleanEnterpriseDashboard: React.FC<CleanEnterpriseDashboardProps> = ({ 
  data, 
  inventoryMetrics, 
  manufacturingMetrics, 
  purchaseMetrics, 
  salesOrderAnalytics,
  jobsAnalytics,
  formatCAD, 
  onNavigate,
  currentUser 
}) => {
  
  // Check if current user is Haron
  const isHaron = currentUser?.email === 'haron@canoilcanadaltd.com';
  
  // Calculate health percentages
  const stockHealthPercent = inventoryMetrics.totalItems > 0 
    ? Math.round(((inventoryMetrics.totalItems - inventoryMetrics.lowStockCount - inventoryMetrics.outOfStock) / inventoryMetrics.totalItems) * 100) 
    : 0;
  
  const productionEfficiency = (manufacturingMetrics.active + manufacturingMetrics.pending) > 0 
    ? Math.round((manufacturingMetrics.active / (manufacturingMetrics.active + manufacturingMetrics.pending)) * 100) 
    : 0;

  const orderCompletionRate = salesOrderAnalytics.total > 0 
    ? Math.round((salesOrderAnalytics.completed.count / salesOrderAnalytics.total) * 100) 
    : 0;

  // Total alerts count
  const totalAlerts = inventoryMetrics.outOfStock + inventoryMetrics.lowStockCount;
  
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Enterprise Command Center</h1>
            <p className="text-slate-500 text-sm mt-1">Real-time business intelligence • Live data from MiSys</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-emerald-700 text-sm font-medium">Live</span>
          </div>
        </div>

        {/* KPI Cards - Clean White Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          
          {/* Inventory Card */}
          <div 
            onClick={() => onNavigate('inventory')}
            className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${stockHealthPercent >= 80 ? 'text-emerald-600' : stockHealthPercent >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                {stockHealthPercent >= 80 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {stockHealthPercent}%
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Inventory Health</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800">{inventoryMetrics.totalItems.toLocaleString()}</span>
              <span className="text-sm text-slate-500">items</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-bold text-amber-600">{inventoryMetrics.lowStockCount}</div>
                <div className="text-xs text-slate-500">Low Stock</div>
              </div>
              <div>
                <div className="text-lg font-bold text-rose-600">{inventoryMetrics.outOfStock}</div>
                <div className="text-xs text-slate-500">Out of Stock</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              Value: {formatCAD(inventoryMetrics.totalValue)}
            </div>
          </div>

          {/* Manufacturing Card */}
          <div 
            onClick={() => onNavigate('manufacturing-orders')}
            className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-emerald-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <Factory className="w-6 h-6 text-emerald-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${productionEfficiency >= 70 ? 'text-emerald-600' : productionEfficiency >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                {productionEfficiency >= 50 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {productionEfficiency}%
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Manufacturing Pipeline</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800">{manufacturingMetrics.active + manufacturingMetrics.pending}</span>
              <span className="text-sm text-slate-500">orders</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-bold text-emerald-600">{manufacturingMetrics.active}</div>
                <div className="text-xs text-slate-500">Active</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-600">{manufacturingMetrics.pending}</div>
                <div className="text-xs text-slate-500">Pending</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              Pipeline: {formatCAD(manufacturingMetrics.totalValue)}
            </div>
          </div>

          {/* Sales Orders Card */}
          <div 
            onClick={() => onNavigate('orders')}
            className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-violet-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-violet-50 rounded-xl group-hover:bg-violet-100 transition-colors">
                <ShoppingCart className="w-6 h-6 text-violet-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${orderCompletionRate >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                <ArrowUpRight className="w-4 h-4" />
                {orderCompletionRate}%
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Sales Orders</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800">{salesOrderAnalytics.total.toLocaleString()}</span>
              <span className="text-sm text-slate-500">total</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-bold text-blue-600">{salesOrderAnalytics.newAndRevised.count}</div>
                <div className="text-xs text-slate-500">New</div>
              </div>
              <div>
                <div className="text-lg font-bold text-violet-600">{salesOrderAnalytics.inProduction.count}</div>
                <div className="text-xs text-slate-500">In Production</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              Completed: {salesOrderAnalytics.completed.count}
            </div>
          </div>

          {/* Alerts Card */}
          <div 
            onClick={() => onNavigate('inventory')}
            className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-rose-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors ${totalAlerts > 100 ? 'bg-rose-50 group-hover:bg-rose-100' : 'bg-amber-50 group-hover:bg-amber-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${totalAlerts > 100 ? 'text-rose-600' : 'text-amber-600'}`} />
              </div>
              {totalAlerts > 0 && (
                <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
                  Action Needed
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Attention Required</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800">{totalAlerts.toLocaleString()}</span>
              <span className="text-sm text-slate-500">items</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-bold text-rose-600">{inventoryMetrics.outOfStock}</div>
                <div className="text-xs text-slate-500">Out of Stock</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-600">{inventoryMetrics.lowStockCount}</div>
                <div className="text-xs text-slate-500">Low Stock</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-400">
              New SOs: {salesOrderAnalytics.newAndRevised.count}
            </div>
          </div>
        </div>

        {/* Command Center - Clean Card Design */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Quick Actions</h2>
              <p className="text-slate-500 text-sm">Workflow automation tools</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Report Maker */}
            <button 
              onClick={() => onNavigate('report-maker')}
              className="group flex flex-col items-center p-5 rounded-xl border-2 border-slate-100 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
            >
              <div className="w-14 h-14 mb-3 flex items-center justify-center bg-blue-100 rounded-2xl group-hover:bg-blue-200 group-hover:scale-110 transition-all">
                <FileText className="w-7 h-7 text-blue-600" />
              </div>
              <span className="font-semibold text-slate-700 group-hover:text-blue-700">Reports</span>
              <span className="text-xs text-slate-400 mt-1">Analytics</span>
            </button>

            {/* Manufacturing */}
            <button 
              onClick={() => onNavigate('manufacturing-orders')}
              className="group flex flex-col items-center p-5 rounded-xl border-2 border-slate-100 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-200"
            >
              <div className="w-14 h-14 mb-3 flex items-center justify-center bg-emerald-100 rounded-2xl group-hover:bg-emerald-200 group-hover:scale-110 transition-all">
                <Factory className="w-7 h-7 text-emerald-600" />
              </div>
              <span className="font-semibold text-slate-700 group-hover:text-emerald-700">Production</span>
              <span className="text-xs text-slate-400 mt-1">MO Tracking</span>
            </button>

            {/* Smart SO Entry / Email Assistant */}
            {isHaron ? (
              <button 
                onClick={() => onNavigate('email-assistant')}
                className="group flex flex-col items-center p-5 rounded-xl border-2 border-slate-100 hover:border-violet-400 hover:bg-violet-50 transition-all duration-200"
              >
                <div className="w-14 h-14 mb-3 flex items-center justify-center bg-violet-100 rounded-2xl group-hover:bg-violet-200 group-hover:scale-110 transition-all">
                  <Mail className="w-7 h-7 text-violet-600" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-violet-700">Email AI</span>
                <span className="text-xs text-slate-400 mt-1">Assistant</span>
              </button>
            ) : (
              <button 
                onClick={() => onNavigate('so-entry')}
                className="group flex flex-col items-center p-5 rounded-xl border-2 border-slate-100 hover:border-violet-400 hover:bg-violet-50 transition-all duration-200"
              >
                <div className="w-14 h-14 mb-3 flex items-center justify-center bg-violet-100 rounded-2xl group-hover:bg-violet-200 group-hover:scale-110 transition-all">
                  <Zap className="w-7 h-7 text-violet-600" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-violet-700">SO Entry</span>
                <span className="text-xs text-slate-400 mt-1">Smart BOM</span>
              </button>
            )}

            {/* AI Assistant */}
            <button 
              onClick={() => onNavigate('intelligence')}
              className="group flex flex-col items-center p-5 rounded-xl border-2 border-slate-100 hover:border-amber-400 hover:bg-amber-50 transition-all duration-200"
            >
              <div className="w-14 h-14 mb-3 flex items-center justify-center bg-amber-100 rounded-2xl group-hover:bg-amber-200 group-hover:scale-110 transition-all">
                <Brain className="w-7 h-7 text-amber-600" />
              </div>
              <span className="font-semibold text-slate-700 group-hover:text-amber-700">AI Chat</span>
              <span className="text-xs text-slate-400 mt-1">GPT-4</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
