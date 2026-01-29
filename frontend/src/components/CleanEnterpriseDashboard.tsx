import React, { useState, useEffect } from 'react';
import { Package, Factory, ShoppingCart, AlertTriangle, Activity, Truck, Brain, Zap, Target, Users, ChevronRight, ArrowUpRight, ArrowDownRight, Minus, TrendingUp, Mail, FileText, BarChart } from 'lucide-react';

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

// Advanced Enterprise Metric Card Component
const MetricCard: React.FC<{
  title: string;
  subtitle: string;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  secondaryLabel: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  children?: React.ReactNode;
  onClick?: () => void;
}> = ({ title, subtitle, primaryValue, primaryLabel, secondaryValue, secondaryLabel, trend, trendValue, icon, gradientFrom, gradientTo, children, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  
  return (
    <div 
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
      
      {/* Content */}
      <div className="relative p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30 group-hover:scale-110 transition-transform duration-300 ${isHovered ? 'animate-pulse' : ''}`}>
              <div className="w-6 h-6 text-white">
                {icon}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white mb-1 truncate">{title}</h3>
              <p className="text-white/80 text-xs font-medium truncate">{subtitle}</p>
            </div>
          </div>
          
          {/* Trend Indicator */}
          {trendValue && (
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg bg-white/20 backdrop-blur-sm ${trendColor} flex-shrink-0`}>
              <TrendIcon className="w-3 h-3" />
              <span className="text-xs font-bold text-white">{trendValue}</span>
            </div>
          )}
        </div>
        
        {/* Primary Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-4 flex-1 min-h-0">
          <div className="space-y-1 min-w-0">
            <div className="text-xl font-black text-white tracking-tight truncate leading-tight">{primaryValue}</div>
            <div className="text-white/70 text-xs font-semibold uppercase tracking-wider truncate leading-tight">{primaryLabel}</div>
          </div>
          <div className="space-y-1 min-w-0">
            <div className="text-xl font-black text-white tracking-tight truncate leading-tight">{secondaryValue}</div>
            <div className="text-white/70 text-xs font-semibold uppercase tracking-wider truncate leading-tight">{secondaryLabel}</div>
          </div>
        </div>
        
        {/* Additional Content */}
        <div className="mt-auto">
          {children}
        </div>
        
        {/* Hover Effect Arrow */}
        <div className={`absolute top-8 right-8 transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}>
          <ChevronRight className="w-6 h-6 text-white/60" />
        </div>
      </div>
    </div>
  );
};

// Advanced Progress Ring Component
const ProgressRing: React.FC<{ progress: number; size?: number; strokeWidth?: number; className?: string }> = ({ 
  progress, 
  size = 70, 
  strokeWidth = 4, 
  className = "" 
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 300);
    return () => clearTimeout(timer);
  }, [progress]);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;
  
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.9)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <span className="text-sm font-bold text-white drop-shadow-sm">{Math.round(animatedProgress)}%</span>
      </div>
    </div>
  );
};

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
  
  // Calculate REAL business performance metrics
  
  // Stock Health: Percentage of items that are properly stocked (not low stock or out of stock)
  const stockHealthScore = inventoryMetrics.totalItems > 0 ? 
    Math.round(((inventoryMetrics.totalItems - inventoryMetrics.lowStockCount - inventoryMetrics.outOfStock) / inventoryMetrics.totalItems) * 100) : 0;
  
  // Manufacturing Efficiency: Percentage of active MOs vs total pending pipeline
  const efficiencyRate = (manufacturingMetrics.active + manufacturingMetrics.pending) > 0 ? 
    Math.round((manufacturingMetrics.active / (manufacturingMetrics.active + manufacturingMetrics.pending)) * 100) : 0;
  
  // Purchase Performance: Average order value (shows procurement efficiency)
  const avgPurchaseValue = purchaseMetrics.open > 0 ? Math.round(purchaseMetrics.totalValue / purchaseMetrics.open) : 0;
  
  // Inventory Turnover Health: Lower percentage of low stock = better turnover management
  const inventoryTurnoverHealth = inventoryMetrics.totalItems > 0 ? 
    Math.max(0, Math.round((1 - (inventoryMetrics.lowStockCount / inventoryMetrics.totalItems)) * 100)) : 0;
  
  // Manufacturing Pipeline Health: Active orders vs total capacity (pending + active + recently closed)
  const totalRecentActivity = manufacturingMetrics.active + manufacturingMetrics.pending + Math.min(manufacturingMetrics.closed, 100);
  const pipelineHealth = totalRecentActivity > 0 ? 
    Math.round(((manufacturingMetrics.active + manufacturingMetrics.pending) / totalRecentActivity) * 100) : 0;
  
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Compact Hero Section */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Enterprise Command Center
          </h1>
          <p className="text-sm text-slate-500">
            Real-time business intelligence powered by AI-driven analytics
          </p>
        </div>


        {/* Executive KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 auto-rows-fr">
          



          {/* Inventory Health Card - Real MiSys Data */}
          <MetricCard
            title="Inventory Health"
            subtitle="Stock Performance"
            primaryValue={inventoryMetrics.lowStockCount.toString()}
            primaryLabel="Low Stock Items"
            secondaryValue={inventoryMetrics.outOfStock.toString()}
            secondaryLabel="Out of Stock"
            trend={inventoryMetrics.lowStockCount > 50 ? 'down' : inventoryMetrics.lowStockCount > 20 ? 'neutral' : 'up'}
            trendValue={`${Math.round((inventoryMetrics.totalItems - inventoryMetrics.lowStockCount - inventoryMetrics.outOfStock) / inventoryMetrics.totalItems * 100)}%`}
            icon={<Package className="w-full h-full" />}
            gradientFrom="from-blue-600"
            gradientTo="to-cyan-500"
            onClick={() => onNavigate('inventory')}
          >
            <div className="flex justify-between items-center">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                  <span className="text-white/80 text-xs truncate">Total Items: {inventoryMetrics.totalItems.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                  <span className="text-white/80 text-xs truncate">Value: {formatCAD(inventoryMetrics.totalValue)}</span>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-white/80" />
              </div>
            </div>
          </MetricCard>

          {/* Manufacturing Pipeline Card - Real MiSys Data */}
          <MetricCard
            title="Manufacturing Pipeline"
            subtitle="Production Status"
            primaryValue={manufacturingMetrics.active.toString()}
            primaryLabel="Active Orders"
            secondaryValue={manufacturingMetrics.pending.toString()}
            secondaryLabel="Pending Orders"
            trend={manufacturingMetrics.active > manufacturingMetrics.pending ? 'up' : 'neutral'}
            trendValue={`${Math.round(manufacturingMetrics.active / (manufacturingMetrics.active + manufacturingMetrics.pending) * 100)}%`}
            icon={<Factory className="w-full h-full" />}
            gradientFrom="from-emerald-600"
            gradientTo="to-green-500"
            onClick={() => onNavigate('manufacturing-orders')}
          >
            <div className="flex justify-between items-center">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                  <span className="text-white/80 text-xs truncate">Pipeline Value: {formatCAD(manufacturingMetrics.totalValue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0"></div>
                  <span className="text-white/80 text-xs truncate">Completed: {manufacturingMetrics.closed}</span>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 flex-shrink-0">
                <Activity className="w-5 h-5 text-white/80" />
              </div>
            </div>
          </MetricCard>

          {/* Sales Orders Statistics Card - Real MiSys Data */}
          <MetricCard
            title="Sales Orders"
            subtitle="Order Status"
            primaryValue={salesOrderAnalytics.newAndRevised.count.toString()}
            primaryLabel="New Orders"
            secondaryValue={salesOrderAnalytics.inProduction.count.toString()}
            secondaryLabel="Scheduled Orders"
            trend={salesOrderAnalytics.newAndRevised.count > salesOrderAnalytics.inProduction.count ? 'up' : 'neutral'}
            trendValue={`${Math.round(salesOrderAnalytics.completed.count / salesOrderAnalytics.total * 100)}%`}
            icon={<TrendingUp className="w-full h-full" />}
            gradientFrom="from-cyan-600"
            gradientTo="to-blue-500"
            onClick={() => onNavigate('orders')}
          >
            <div className="flex justify-between items-center">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0"></div>
                  <span className="text-white/80 text-xs truncate">Total: {salesOrderAnalytics.total.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                  <span className="text-white/80 text-xs truncate">Completed: {salesOrderAnalytics.completed.count}</span>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 flex-shrink-0">
                <Activity className="w-5 h-5 text-white/80" />
              </div>
            </div>
          </MetricCard>

          {/* Attention Required Card - Alerts & Action Items */}
          <MetricCard
            title="Attention Required"
            subtitle="Action Items"
            primaryValue={inventoryMetrics.outOfStock.toString()}
            primaryLabel="Out of Stock"
            secondaryValue={manufacturingMetrics.pending.toString()}
            secondaryLabel="Pending MOs"
            trend={inventoryMetrics.outOfStock > 100 ? 'down' : inventoryMetrics.outOfStock > 50 ? 'neutral' : 'up'}
            trendValue={inventoryMetrics.outOfStock > 0 ? 'Action' : 'OK'}
            icon={<AlertTriangle className="w-full h-full" />}
            gradientFrom="from-rose-600"
            gradientTo="to-orange-500"
            onClick={() => onNavigate('inventory')}
          >
            <div className="flex justify-between items-center">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-rose-400 rounded-full flex-shrink-0 animate-pulse"></div>
                  <span className="text-white/80 text-xs truncate">Low Stock: {inventoryMetrics.lowStockCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0"></div>
                  <span className="text-white/80 text-xs truncate">New SOs: {salesOrderAnalytics.newAndRevised.count}</span>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 flex-shrink-0">
                <Target className="w-5 h-5 text-white/80" />
              </div>
            </div>
          </MetricCard>
      </div>

        {/* Advanced Enterprise Action Center */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/80 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Command Center</h2>
              <p className="text-slate-500 text-sm">Intelligent workflow automation and real-time operations</p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-emerald-700 font-semibold text-sm">Real-time Intelligence Active</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {/* Report Maker Action - Primary Style with Enhanced Hover */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-white border-2 border-blue-100 p-6 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-2 transition-all duration-300 cursor-pointer"
              onClick={() => onNavigate('report-maker')}
            >
              {/* Animated gradient background on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-all duration-500" />
              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 mb-4 p-2.5 bg-blue-50 rounded-xl group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                  <FileText className="w-full h-full text-blue-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-white transition-colors duration-300">Report Maker</h3>
                <p className="text-slate-500 text-sm group-hover:text-blue-100 transition-colors duration-300">Production & Analytics</p>
                <div className="mt-4 flex items-center text-blue-600 group-hover:text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <BarChart className="w-4 h-4 mr-1.5" />
                  <span>Custom Report Builder</span>
                  <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Manufacturing Action - Secondary Style with Subtle Hover */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-slate-50 border-2 border-transparent p-6 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full opacity-30 group-hover:opacity-70 transition-opacity"></div>
              <div className="relative">
                <div className="w-12 h-12 mb-4 p-2.5 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 group-hover:scale-105 transition-all duration-300">
                  <Factory className="w-full h-full text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">Manufacturing</h3>
                <p className="text-slate-500 text-sm">Production Performance</p>
                <div className="mt-4 flex items-center text-emerald-600 text-xs font-medium">
                  <Activity className="w-4 h-4 mr-1.5" />
                  <span>Live Monitoring</span>
                </div>
              </div>
            </div>

            {/* Smart SO Entry Action OR Email Assistant for Haron - Accent Style with Enhanced Hover */}
            {isHaron ? (
              // Email Assistant - Only for Haron
              <div 
                className="group relative overflow-hidden rounded-2xl bg-white border-2 border-violet-100 p-6 hover:border-violet-500 hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-2 transition-all duration-300 cursor-pointer"
                onClick={() => onNavigate('email-assistant')}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
                <div className="relative">
                  <div className="w-12 h-12 mb-4 p-2.5 bg-violet-50 rounded-xl group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                    <Mail className="w-full h-full text-violet-600 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-white transition-colors duration-300">Email Assistant</h3>
                  <p className="text-slate-500 text-sm group-hover:text-violet-100 transition-colors duration-300">AI-Powered Responses</p>
                  <div className="mt-4 flex items-center text-violet-600 group-hover:text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <Brain className="w-4 h-4 mr-1.5" />
                    <span>Smart Email AI</span>
                    <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ) : (
              // Smart SO Entry - For other users
              <div 
                className="group relative overflow-hidden rounded-2xl bg-white border-2 border-violet-100 p-6 hover:border-violet-500 hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-2 transition-all duration-300 cursor-pointer"
                onClick={() => onNavigate('so-entry')}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
                <div className="relative">
                  <div className="w-12 h-12 mb-4 p-2.5 bg-violet-50 rounded-xl group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                    <Zap className="w-full h-full text-violet-600 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-white transition-colors duration-300">Smart SO Entry</h3>
                  <p className="text-slate-500 text-sm group-hover:text-violet-100 transition-colors duration-300">BOM Verification</p>
                  <div className="mt-4 flex items-center text-violet-600 group-hover:text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <Target className="w-4 h-4 mr-1.5" />
                    <span>Error Prevention</span>
                    <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            )}

            {/* AI Assistant Action - Featured/Premium Style with Enhanced Hover */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 hover:-translate-y-2 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-orange-500/40"
              onClick={() => onNavigate('intelligence')}
            >
              {/* Animated pattern */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50 group-hover:opacity-80 transition-opacity"></div>
              {/* Glow effect */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:bg-white/30 transition-all duration-500"></div>
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-yellow-300/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 mb-4 p-2.5 bg-white/20 backdrop-blur-sm rounded-xl ring-1 ring-white/30 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
                  <Brain className="w-full h-full text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">AI Assistant</h3>
                <p className="text-orange-100 text-sm">ChatGPT Powered</p>
                <div className="mt-4 flex items-center text-white/90 text-xs font-medium">
                  <Users className="w-4 h-4 mr-1.5" />
                  <span>Natural Language</span>
                  <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};