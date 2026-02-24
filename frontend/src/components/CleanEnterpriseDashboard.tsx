import React, { useState, useEffect } from 'react';
import { Package, Factory, ShoppingCart, AlertTriangle, TrendingUp, Truck, Brain, Zap, Target, Users, ChevronRight, FileText, BarChart3, Mail, ArrowUpRight, ArrowDownRight, Activity, Clock, Sparkles, Layers, Database, Shield, Rocket, Crown, Gem, Play, Eye, RefreshCw } from 'lucide-react';

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

// Animated counter component for visual interest
const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    const startValue = displayValue;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(startValue + (value - startValue) * easeOutQuart));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);
  
  return <>{displayValue.toLocaleString()}</>;
};

// Sparkline mini chart component
const MiniSparkline: React.FC<{ trend: 'up' | 'down' | 'stable'; color: string }> = ({ trend, color }) => {
  const paths = {
    up: "M0,20 Q5,18 10,15 T20,12 T30,8 T40,10 T50,5",
    down: "M0,5 Q5,8 10,10 T20,12 T30,15 T40,14 T50,18",
    stable: "M0,12 Q5,10 10,12 T20,11 T30,13 T40,11 T50,12"
  };
  
  return (
    <svg className="w-14 h-6" viewBox="0 0 50 25">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        d={paths[trend]}
        fill="none"
        stroke={`url(#gradient-${color})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
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
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  
  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  
  return (
    <div className="min-h-screen relative">
      {/* Animated Background with Mesh Gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-0 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 -right-40 w-80 h-80 bg-gradient-to-br from-violet-400/15 to-purple-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}></div>
      </div>

      <div className="relative p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 1: ENTERPRISE HEADER - Premium Glassmorphism Design
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="relative">
            {/* Header Card with Glassmorphism */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl shadow-slate-900/20">
              {/* Animated background patterns */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-gradient-to-br from-violet-500/15 to-purple-600/15 rounded-full blur-3xl"></div>
                {/* Animated lines */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10">
                  <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse"></div>
                  <div className="absolute top-2/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>
              </div>
              
              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                {/* Left: Branding & Title */}
                <div className="flex items-center gap-5">
                  {/* Animated Logo Mark */}
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 transform hover:scale-105 transition-transform duration-300">
                      <Activity className="w-8 h-8 text-white" />
                    </div>
                    {/* Pulse ring */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 animate-ping opacity-20"></div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                        Enterprise Command Center
                      </h1>
                      <span className="px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold uppercase tracking-wider">
                        Pro
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                      <Database className="w-3.5 h-3.5" />
                      Real-time business intelligence • MiSys ERP Integration
                    </p>
                  </div>
                </div>
                
                {/* Right: Status & Time */}
                <div className="flex items-center gap-4">
                  {/* Date & Time Display */}
                  <div className="hidden md:block text-right">
                    <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                      {greeting}
                    </div>
                    <div className="text-white text-sm font-semibold flex items-center justify-end gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {currentTime}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">{currentDate}</div>
                  </div>
                  
                  {/* Divider */}
                  <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>
                  
                  {/* Live Status Badge */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl backdrop-blur-sm">
                    <div className="relative flex items-center justify-center">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50"></div>
                      <div className="absolute w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
                    </div>
                    <div>
                      <span className="text-emerald-400 text-sm font-bold">System Live</span>
                      <div className="text-emerald-500/70 text-xs">All services operational</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bottom Stats Bar */}
              <div className="relative mt-8 pt-6 border-t border-slate-700/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white"><AnimatedNumber value={inventoryMetrics.totalItems} /></div>
                      <div className="text-slate-500 text-xs font-medium">Total Items</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Factory className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white"><AnimatedNumber value={manufacturingMetrics.active + manufacturingMetrics.pending} /></div>
                      <div className="text-slate-500 text-xs font-medium">Active MOs</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white"><AnimatedNumber value={salesOrderAnalytics.total} /></div>
                      <div className="text-slate-500 text-xs font-medium">Sales Orders</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white"><AnimatedNumber value={totalAlerts} /></div>
                      <div className="text-slate-500 text-xs font-medium">Alerts</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 2: KPI CARDS - Modern Bento Grid Design
          ═══════════════════════════════════════════════════════════════════ */}
          <div>
            {/* Section Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Key Performance Indicators</h2>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-slate-200 via-slate-200 to-transparent"></div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Real-time Metrics</span>
            </div>

            {/* KPI Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              
              {/* ═══ INVENTORY HEALTH CARD ═══ */}
              <div 
                onClick={() => onNavigate('inventory')}
                className="group relative bg-white rounded-2xl p-6 cursor-pointer overflow-hidden border border-slate-200/60 hover:border-blue-300 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:via-blue-500/3 group-hover:to-indigo-500/5 transition-all duration-500"></div>
                
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                
                <div className="relative">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:from-blue-500 group-hover:to-indigo-600 transition-all duration-500 shadow-lg shadow-blue-500/0 group-hover:shadow-blue-500/30">
                        <Package className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors duration-500" />
                      </div>
                      {/* Floating badge */}
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <ArrowUpRight className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    
                    {/* Health Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                      stockHealthPercent >= 80 
                        ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white' 
                        : stockHealthPercent >= 60 
                        ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white' 
                        : 'bg-rose-100 text-rose-700 group-hover:bg-rose-500 group-hover:text-white'
                    }`}>
                      {stockHealthPercent >= 80 ? <TrendingUp className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {stockHealthPercent}%
                    </div>
                  </div>
                  
                  {/* Title & Value */}
                  <div className="mb-5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inventory Health</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-slate-900 tracking-tight">
                        <AnimatedNumber value={inventoryMetrics.totalItems} />
                      </span>
                      <span className="text-sm font-semibold text-slate-400">items</span>
                    </div>
                  </div>
                  
                  {/* Mini Sparkline */}
                  <div className="mb-5">
                    <MiniSparkline trend={stockHealthPercent >= 70 ? 'up' : 'down'} color="#3b82f6" />
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-amber-500 group-hover/stat:scale-110 transition-transform origin-left">{inventoryMetrics.lowStockCount}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        Low Stock
                      </div>
                    </div>
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-rose-500 group-hover/stat:scale-110 transition-transform origin-left">{inventoryMetrics.outOfStock}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                        Out of Stock
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Total Value</span>
                    <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">{formatCAD(inventoryMetrics.totalValue)}</span>
                  </div>
                </div>
              </div>

              {/* ═══ MANUFACTURING PIPELINE CARD ═══ */}
              <div 
                onClick={() => onNavigate('manufacturing-orders')}
                className="group relative bg-white rounded-2xl p-6 cursor-pointer overflow-hidden border border-slate-200/60 hover:border-emerald-300 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/5 group-hover:via-emerald-500/3 group-hover:to-teal-500/5 transition-all duration-500"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center group-hover:from-emerald-500 group-hover:to-teal-600 transition-all duration-500 shadow-lg shadow-emerald-500/0 group-hover:shadow-emerald-500/30">
                        <Factory className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors duration-500" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Play className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                      productionEfficiency >= 70 
                        ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white' 
                        : productionEfficiency >= 40 
                        ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white' 
                        : 'bg-rose-100 text-rose-700 group-hover:bg-rose-500 group-hover:text-white'
                    }`}>
                      {productionEfficiency >= 50 ? <TrendingUp className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {productionEfficiency}%
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Manufacturing Pipeline</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-slate-900 tracking-tight">
                        <AnimatedNumber value={manufacturingMetrics.active + manufacturingMetrics.pending} />
                      </span>
                      <span className="text-sm font-semibold text-slate-400">orders</span>
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <MiniSparkline trend={productionEfficiency >= 50 ? 'up' : 'stable'} color="#10b981" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-emerald-500 group-hover/stat:scale-110 transition-transform origin-left">{manufacturingMetrics.active}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        Active
                      </div>
                    </div>
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-amber-500 group-hover/stat:scale-110 transition-transform origin-left">{manufacturingMetrics.pending}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        Pending
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Pipeline Value</span>
                    <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">{formatCAD(manufacturingMetrics.totalValue)}</span>
                  </div>
                </div>
              </div>

              {/* ═══ SALES ORDERS CARD ═══ */}
              <div 
                onClick={() => onNavigate('orders')}
                className="group relative bg-white rounded-2xl p-6 cursor-pointer overflow-hidden border border-slate-200/60 hover:border-violet-300 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-purple-500/0 group-hover:from-violet-500/5 group-hover:via-violet-500/3 group-hover:to-purple-500/5 transition-all duration-500"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center group-hover:from-violet-500 group-hover:to-purple-600 transition-all duration-500 shadow-lg shadow-violet-500/0 group-hover:shadow-violet-500/30">
                        <ShoppingCart className="w-7 h-7 text-violet-600 group-hover:text-white transition-colors duration-500" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Eye className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                      orderCompletionRate >= 50 
                        ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-500 group-hover:text-white' 
                        : 'bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white'
                    }`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                      {orderCompletionRate}%
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sales Orders</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-slate-900 tracking-tight">
                        <AnimatedNumber value={salesOrderAnalytics.total} />
                      </span>
                      <span className="text-sm font-semibold text-slate-400">total</span>
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <MiniSparkline trend="up" color="#8b5cf6" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-blue-500 group-hover/stat:scale-110 transition-transform origin-left">{salesOrderAnalytics.newAndRevised.count}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                        New
                      </div>
                    </div>
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-violet-500 group-hover/stat:scale-110 transition-transform origin-left">{salesOrderAnalytics.inProduction.count}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400"></div>
                        In Production
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Completed</span>
                    <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg group-hover:bg-violet-100 group-hover:text-violet-700 transition-colors">{salesOrderAnalytics.completed.count} orders</span>
                  </div>
                </div>
              </div>

              {/* ═══ ATTENTION REQUIRED CARD ═══ */}
              <div 
                onClick={() => onNavigate('inventory')}
                className="group relative bg-white rounded-2xl p-6 cursor-pointer overflow-hidden border border-slate-200/60 hover:border-rose-300 transition-all duration-500 hover:shadow-2xl hover:shadow-rose-500/10 hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/0 via-rose-500/0 to-orange-500/0 group-hover:from-rose-500/5 group-hover:via-rose-500/3 group-hover:to-orange-500/5 transition-all duration-500"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                        totalAlerts > 100 
                          ? 'bg-gradient-to-br from-rose-100 to-red-100 group-hover:from-rose-500 group-hover:to-red-600 shadow-rose-500/0 group-hover:shadow-rose-500/30' 
                          : 'bg-gradient-to-br from-amber-100 to-orange-100 group-hover:from-amber-500 group-hover:to-orange-600 shadow-amber-500/0 group-hover:shadow-amber-500/30'
                      }`}>
                        <AlertTriangle className={`w-7 h-7 transition-colors duration-500 ${
                          totalAlerts > 100 
                            ? 'text-rose-600 group-hover:text-white' 
                            : 'text-amber-600 group-hover:text-white'
                        }`} />
                      </div>
                      {/* Animated warning pulse */}
                      {totalAlerts > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center animate-bounce">
                          <span className="text-white text-[10px] font-bold">!</span>
                        </div>
                      )}
                    </div>
                    
                    {totalAlerts > 0 && (
                      <span className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-500/30 animate-pulse">
                        Action Needed
                      </span>
                    )}
                  </div>
                  
                  <div className="mb-5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attention Required</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-slate-900 tracking-tight">
                        <AnimatedNumber value={totalAlerts} />
                      </span>
                      <span className="text-sm font-semibold text-slate-400">items</span>
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <MiniSparkline trend={totalAlerts > 500 ? 'up' : 'stable'} color="#f43f5e" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-rose-500 group-hover/stat:scale-110 transition-transform origin-left">{inventoryMetrics.outOfStock}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></div>
                        Out of Stock
                      </div>
                    </div>
                    <div className="group/stat">
                      <div className="text-2xl font-bold text-amber-500 group-hover/stat:scale-110 transition-transform origin-left">{inventoryMetrics.lowStockCount}</div>
                      <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        Low Stock
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">New SOs Pending</span>
                    <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors">{salesOrderAnalytics.newAndRevised.count}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              SECTION 3: QUICK ACTIONS - Modern Command Palette Design
          ═══════════════════════════════════════════════════════════════════ */}
          <div>
            {/* Section Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full"></div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Workflow Automation</h2>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-slate-200 via-slate-200 to-transparent"></div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl">
                <Zap className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shortcuts</span>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl">
              {/* Background decoration */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-500/10 to-purple-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 rounded-full blur-3xl"></div>
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                  backgroundSize: '40px 40px'
                }}></div>
              </div>
              
              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                      <Rocket className="w-6 h-6 text-violet-400" />
                      Enterprise Productivity Tools
                    </h3>
                    <p className="text-slate-400 text-sm font-medium mt-1">One-click access to powerful automation features</p>
                  </div>
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                    <span className="text-slate-400 text-xs font-medium">Press</span>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white text-xs font-mono">⌘</kbd>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white text-xs font-mono">K</kbd>
                  </div>
                </div>
                
                {/* Action Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Report Maker */}
                  <button 
                    onClick={() => onNavigate('report-maker')}
                    className="group relative flex flex-col items-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/20"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/10 group-hover:to-indigo-500/10 transition-all duration-300"></div>
                    <div className="relative w-16 h-16 mb-4 flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl group-hover:from-blue-500 group-hover:to-indigo-600 transition-all duration-300 shadow-lg shadow-blue-500/0 group-hover:shadow-blue-500/30">
                      <FileText className="w-8 h-8 text-blue-400 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <span className="font-bold text-white group-hover:text-blue-300 transition-colors">Reports</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 group-hover:text-slate-400">Replaces MISys reporting — and does more</span>
                    {/* Hover arrow */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ArrowUpRight className="w-4 h-4 text-blue-400" />
                    </div>
                  </button>

                  {/* Manufacturing */}
                  <button 
                    onClick={() => onNavigate('manufacturing-orders')}
                    className="group relative flex flex-col items-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-500/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/20"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/10 group-hover:to-teal-500/10 transition-all duration-300"></div>
                    <div className="relative w-16 h-16 mb-4 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl group-hover:from-emerald-500 group-hover:to-teal-600 transition-all duration-300 shadow-lg shadow-emerald-500/0 group-hover:shadow-emerald-500/30">
                      <Factory className="w-8 h-8 text-emerald-400 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <span className="font-bold text-white group-hover:text-emerald-300 transition-colors">Production</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 group-hover:text-slate-400">MO Tracking</span>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    </div>
                  </button>

                  {/* Smart SO Entry / Email Assistant */}
                  {isHaron ? (
                    <button 
                      onClick={() => onNavigate('email-assistant')}
                      className="group relative flex flex-col items-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/20"
                    >
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/0 to-purple-500/0 group-hover:from-violet-500/10 group-hover:to-purple-500/10 transition-all duration-300"></div>
                      <div className="relative w-16 h-16 mb-4 flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-2xl group-hover:from-violet-500 group-hover:to-purple-600 transition-all duration-300 shadow-lg shadow-violet-500/0 group-hover:shadow-violet-500/30">
                        <Mail className="w-8 h-8 text-violet-400 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <span className="font-bold text-white group-hover:text-violet-300 transition-colors">Email AI</span>
                      <span className="text-xs font-medium text-slate-500 mt-1 group-hover:text-slate-400">Smart Assistant</span>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <ArrowUpRight className="w-4 h-4 text-violet-400" />
                      </div>
                      {/* Special badge for AI */}
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full text-[10px] font-bold text-white shadow-lg">
                        AI
                      </div>
                    </button>
                  ) : (
                    <button 
                      onClick={() => onNavigate('so-entry')}
                      className="group relative flex flex-col items-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/20"
                    >
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/0 to-purple-500/0 group-hover:from-violet-500/10 group-hover:to-purple-500/10 transition-all duration-300"></div>
                      <div className="relative w-16 h-16 mb-4 flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-2xl group-hover:from-violet-500 group-hover:to-purple-600 transition-all duration-300 shadow-lg shadow-violet-500/0 group-hover:shadow-violet-500/30">
                        <Zap className="w-8 h-8 text-violet-400 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <span className="font-bold text-white group-hover:text-violet-300 transition-colors">SO Entry</span>
                      <span className="text-xs font-medium text-slate-500 mt-1 group-hover:text-slate-400">Smart BOM</span>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <ArrowUpRight className="w-4 h-4 text-violet-400" />
                      </div>
                    </button>
                  )}

                  {/* AI Command */}
                  <button 
                    onClick={() => onNavigate('ai-command')}
                    className="group relative flex flex-col items-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/20"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/0 to-orange-500/0 group-hover:from-amber-500/10 group-hover:to-orange-500/10 transition-all duration-300"></div>
                    <div className="relative w-16 h-16 mb-4 flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl group-hover:from-amber-500 group-hover:to-orange-600 transition-all duration-300 shadow-lg shadow-amber-500/0 group-hover:shadow-amber-500/30">
                      <Brain className="w-8 h-8 text-amber-400 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <span className="font-bold text-white group-hover:text-amber-300 transition-colors">AI Command</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 group-hover:text-slate-400">GPT-4 Powered</span>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ArrowUpRight className="w-4 h-4 text-amber-400" />
                    </div>
                    {/* Special badge */}
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-[10px] font-bold text-white shadow-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      NEW
                    </div>
                  </button>
                </div>
                
                {/* Bottom info bar */}
                <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Shield className="w-4 h-4" />
                      <span>Enterprise Security</span>
                    </div>
                    <div className="w-px h-4 bg-white/20"></div>
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <RefreshCw className="w-4 h-4" />
                      <span>Auto-sync enabled</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">Powered by</span>
                    <span className="text-white font-bold text-sm">MiSys ERP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
