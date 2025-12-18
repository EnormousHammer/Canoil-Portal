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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Compact Hero Section */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-slate-900 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Enterprise Command Center
          </h1>
          <p className="text-sm text-slate-600 font-medium">
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

          {/* Production Schedule card intentionally removed from portal dashboard */}
      </div>

        {/* Advanced Enterprise Action Center */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">Command Center</h2>
              <p className="text-slate-600 font-medium">Intelligent workflow automation and real-time operations</p>
            </div>
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-emerald-700 font-bold">Real-time Intelligence Active</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Report Maker Action */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl"
              onClick={() => onNavigate('report-maker')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
              <div className="relative">
                <div className="w-14 h-14 mb-4 p-3 bg-white/20 backdrop-blur-sm rounded-2xl ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                  <FileText className="w-full h-full text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Report Maker</h3>
                <p className="text-blue-100 text-sm font-medium">Production & Analytics</p>
                <div className="mt-4 flex items-center text-white/80 text-xs">
                  <BarChart className="w-4 h-4 mr-2" />
                  <span>Custom Report Builder</span>
                </div>
              </div>
            </div>

            {/* Manufacturing Action */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-400 p-6 shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
              <div className="relative">
                <div className="w-14 h-14 mb-4 p-3 bg-white/20 backdrop-blur-sm rounded-2xl ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                  <Factory className="w-full h-full text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Manufacturing</h3>
                <p className="text-emerald-100 text-sm font-medium">Production Performance</p>
                <div className="mt-4 flex items-center text-white/80 text-xs">
                  <Activity className="w-4 h-4 mr-2" />
                  <span>Live Monitoring</span>
                </div>
              </div>
            </div>

            {/* Smart SO Entry Action OR Email Assistant for Haron */}
            {isHaron ? (
              // Email Assistant - Only for Haron
              <div 
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl"
                onClick={() => onNavigate('email-assistant')}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                <div className="relative">
                  <div className="w-14 h-14 mb-4 p-3 bg-white/20 backdrop-blur-sm rounded-2xl ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                    <Mail className="w-full h-full text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Email Assistant</h3>
                  <p className="text-purple-100 text-sm font-medium">AI-Powered Responses</p>
                  <div className="mt-4 flex items-center text-white/80 text-xs">
                    <Brain className="w-4 h-4 mr-2" />
                    <span>Smart Email AI</span>
                  </div>
                </div>
              </div>
            ) : (
              // Smart SO Entry - For other users
              <div 
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-violet-400 p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl"
                onClick={() => onNavigate('so-entry')}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                <div className="relative">
                  <div className="w-14 h-14 mb-4 p-3 bg-white/20 backdrop-blur-sm rounded-2xl ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                    <Zap className="w-full h-full text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Smart SO Entry</h3>
                  <p className="text-purple-100 text-sm font-medium">BOM Verification</p>
                  <div className="mt-4 flex items-center text-white/80 text-xs">
                    <Target className="w-4 h-4 mr-2" />
                    <span>Error Prevention</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Assistant Action */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-red-400 p-6 hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl"
              onClick={() => onNavigate('intelligence')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
              <div className="relative">
                <div className="w-14 h-14 mb-4 p-3 bg-white/20 backdrop-blur-sm rounded-2xl ring-1 ring-white/30 group-hover:scale-110 transition-transform">
                  <Brain className="w-full h-full text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">AI Assistant</h3>
                <p className="text-orange-100 text-sm font-medium">ChatGPT Powered</p>
                <div className="mt-4 flex items-center text-white/80 text-xs">
                  <Users className="w-4 h-4 mr-2" />
                  <span>Natural Language</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};