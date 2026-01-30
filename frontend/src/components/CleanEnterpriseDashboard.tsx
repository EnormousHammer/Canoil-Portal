import React from 'react';
import { Package, Factory, ShoppingCart, AlertTriangle, TrendingUp, Truck, Brain, Zap, Target, Users, ChevronRight, FileText, BarChart3, Mail, ArrowUpRight, ArrowDownRight, Activity, Clock } from 'lucide-react';

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

  // Current time for header
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Enterprise Header - Professional Grade */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-200">
          <div className="flex items-center gap-4">
            {/* Branding Mark */}
            <div className="w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise Command Center</h1>
              <p className="text-slate-500 text-sm mt-0.5 font-medium">Real-time business intelligence from MiSys ERP</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Timestamp */}
            <div className="text-right mr-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Last Sync</div>
              <div className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {currentTime}
              </div>
            </div>
            {/* Live Status */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></div>
              </div>
              <span className="text-emerald-700 text-sm font-semibold">Live</span>
            </div>
          </div>
        </div>

        {/* Section Label */}
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Key Performance Indicators</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
        </div>

        {/* KPI Cards - Enterprise Grade Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          
          {/* Inventory Card */}
          <div 
            onClick={() => onNavigate('inventory')}
            className="group relative bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-400/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-100/0 group-hover:from-blue-50/50 group-hover:to-blue-100/30 transition-all duration-500 pointer-events-none"></div>
            
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 group-hover:shadow-lg group-hover:shadow-blue-500/30 transition-all duration-300">
                  <Package className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${stockHealthPercent >= 80 ? 'bg-emerald-100 text-emerald-700' : stockHealthPercent >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                  {stockHealthPercent >= 80 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {stockHealthPercent}%
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Inventory Health</div>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{inventoryMetrics.totalItems.toLocaleString()}</span>
                <span className="text-sm font-medium text-slate-400">items</span>
              </div>
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xl font-bold text-amber-600">{inventoryMetrics.lowStockCount}</div>
                  <div className="text-xs font-medium text-slate-400">Low Stock</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-rose-600">{inventoryMetrics.outOfStock}</div>
                  <div className="text-xs font-medium text-slate-400">Out of Stock</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Total Value</span>
                <span className="text-sm font-bold text-slate-700">{formatCAD(inventoryMetrics.totalValue)}</span>
              </div>
            </div>
          </div>

          {/* Manufacturing Card */}
          <div 
            onClick={() => onNavigate('manufacturing-orders')}
            className="group relative bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-400/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-100/0 group-hover:from-emerald-50/50 group-hover:to-emerald-100/30 transition-all duration-500 pointer-events-none"></div>
            
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-500/30 transition-all duration-300">
                  <Factory className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${productionEfficiency >= 70 ? 'bg-emerald-100 text-emerald-700' : productionEfficiency >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                  {productionEfficiency >= 50 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {productionEfficiency}%
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Manufacturing Pipeline</div>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{manufacturingMetrics.active + manufacturingMetrics.pending}</span>
                <span className="text-sm font-medium text-slate-400">orders</span>
              </div>
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xl font-bold text-emerald-600">{manufacturingMetrics.active}</div>
                  <div className="text-xs font-medium text-slate-400">Active</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-600">{manufacturingMetrics.pending}</div>
                  <div className="text-xs font-medium text-slate-400">Pending</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Pipeline Value</span>
                <span className="text-sm font-bold text-slate-700">{formatCAD(manufacturingMetrics.totalValue)}</span>
              </div>
            </div>
          </div>

          {/* Sales Orders Card */}
          <div 
            onClick={() => onNavigate('orders')}
            className="group relative bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-2xl hover:shadow-violet-500/10 hover:border-violet-400/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 to-violet-100/0 group-hover:from-violet-50/50 group-hover:to-violet-100/30 transition-all duration-500 pointer-events-none"></div>
            
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className="p-3 bg-violet-100 rounded-xl group-hover:bg-violet-500 group-hover:shadow-lg group-hover:shadow-violet-500/30 transition-all duration-300">
                  <ShoppingCart className="w-5 h-5 text-violet-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${orderCompletionRate >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {orderCompletionRate}%
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Sales Orders</div>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{salesOrderAnalytics.total.toLocaleString()}</span>
                <span className="text-sm font-medium text-slate-400">total</span>
              </div>
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xl font-bold text-blue-600">{salesOrderAnalytics.newAndRevised.count}</div>
                  <div className="text-xs font-medium text-slate-400">New</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-violet-600">{salesOrderAnalytics.inProduction.count}</div>
                  <div className="text-xs font-medium text-slate-400">In Production</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Completed</span>
                <span className="text-sm font-bold text-slate-700">{salesOrderAnalytics.completed.count} orders</span>
              </div>
            </div>
          </div>

          {/* Alerts Card */}
          <div 
            onClick={() => onNavigate('inventory')}
            className="group relative bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-2xl hover:shadow-rose-500/10 hover:border-rose-400/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-50/0 to-rose-100/0 group-hover:from-rose-50/50 group-hover:to-rose-100/30 transition-all duration-500 pointer-events-none"></div>
            
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className={`p-3 rounded-xl transition-all duration-300 ${totalAlerts > 100 ? 'bg-rose-100 group-hover:bg-rose-500 group-hover:shadow-lg group-hover:shadow-rose-500/30' : 'bg-amber-100 group-hover:bg-amber-500 group-hover:shadow-lg group-hover:shadow-amber-500/30'}`}>
                  <AlertTriangle className={`w-5 h-5 transition-colors duration-300 ${totalAlerts > 100 ? 'text-rose-600 group-hover:text-white' : 'text-amber-600 group-hover:text-white'}`} />
                </div>
                {totalAlerts > 0 && (
                  <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg animate-pulse">
                    Action Needed
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Attention Required</div>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalAlerts.toLocaleString()}</span>
                <span className="text-sm font-medium text-slate-400">items</span>
              </div>
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xl font-bold text-rose-600">{inventoryMetrics.outOfStock}</div>
                  <div className="text-xs font-medium text-slate-400">Out of Stock</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-600">{inventoryMetrics.lowStockCount}</div>
                  <div className="text-xs font-medium text-slate-400">Low Stock</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">New SOs Pending</span>
                <span className="text-sm font-bold text-slate-700">{salesOrderAnalytics.newAndRevised.count}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Label */}
        <div className="flex items-center gap-3 mt-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Quick Actions</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
        </div>

        {/* Command Center - Enterprise Grade Design */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Workflow Automation</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Enterprise productivity tools • One-click access</p>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <Zap className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Shortcuts</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {/* Report Maker */}
            <button 
              onClick={() => onNavigate('report-maker')}
              className="group relative flex flex-col items-center p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-blue-100 rounded-2xl group-hover:bg-blue-500 group-hover:shadow-lg group-hover:shadow-blue-500/30 transition-all duration-300">
                <FileText className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <span className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Reports</span>
              <span className="text-xs font-medium text-slate-400 mt-1">Analytics & Exports</span>
            </button>

            {/* Manufacturing */}
            <button 
              onClick={() => onNavigate('manufacturing-orders')}
              className="group relative flex flex-col items-center p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-emerald-400/50 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-emerald-100 rounded-2xl group-hover:bg-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-500/30 transition-all duration-300">
                <Factory className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <span className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Production</span>
              <span className="text-xs font-medium text-slate-400 mt-1">MO Tracking</span>
            </button>

            {/* Smart SO Entry / Email Assistant */}
            {isHaron ? (
              <button 
                onClick={() => onNavigate('email-assistant')}
                className="group relative flex flex-col items-center p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-violet-400/50 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-16 h-16 mb-4 flex items-center justify-center bg-violet-100 rounded-2xl group-hover:bg-violet-500 group-hover:shadow-lg group-hover:shadow-violet-500/30 transition-all duration-300">
                  <Mail className="w-8 h-8 text-violet-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <span className="font-bold text-slate-800 group-hover:text-violet-700 transition-colors">Email AI</span>
                <span className="text-xs font-medium text-slate-400 mt-1">Smart Assistant</span>
              </button>
            ) : (
              <button 
                onClick={() => onNavigate('so-entry')}
                className="group relative flex flex-col items-center p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-violet-400/50 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-16 h-16 mb-4 flex items-center justify-center bg-violet-100 rounded-2xl group-hover:bg-violet-500 group-hover:shadow-lg group-hover:shadow-violet-500/30 transition-all duration-300">
                  <Zap className="w-8 h-8 text-violet-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <span className="font-bold text-slate-800 group-hover:text-violet-700 transition-colors">SO Entry</span>
                <span className="text-xs font-medium text-slate-400 mt-1">Smart BOM</span>
              </button>
            )}

            {/* AI Assistant */}
            <button 
              onClick={() => onNavigate('ai-command')}
              className="group relative flex flex-col items-center p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl group-hover:from-amber-500 group-hover:to-orange-500 group-hover:shadow-lg group-hover:shadow-amber-500/30 transition-all duration-300">
                <Brain className="w-8 h-8 text-amber-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <span className="font-bold text-slate-800 group-hover:text-amber-700 transition-colors">AI Command</span>
              <span className="text-xs font-medium text-slate-400 mt-1">GPT-4 Powered</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
