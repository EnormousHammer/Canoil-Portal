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

// Unified KPI Card Component - Clean white style with colored accents
const KPICard: React.FC<{
  title: string;
  subtitle: string;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  secondaryLabel: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  accentColor: string;
  onClick?: () => void;
  stats?: { label: string; value: string }[];
}> = ({ title, subtitle, primaryValue, primaryLabel, secondaryValue, secondaryLabel, trend, trendValue, icon, accentColor, onClick, stats }) => {
  
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendBgColor = trend === 'up' ? 'bg-emerald-100 text-emerald-700' : trend === 'down' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600';
  
  const colorMap: { [key: string]: { bg: string; text: string; border: string; light: string } } = {
    blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', light: 'bg-blue-50' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-50' },
    cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-200', light: 'bg-cyan-50' },
    rose: { bg: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-200', light: 'bg-rose-50' },
    violet: { bg: 'bg-violet-500', text: 'text-violet-600', border: 'border-violet-200', light: 'bg-violet-50' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50' },
  };
  
  const colors = colorMap[accentColor] || colorMap.blue;
  
  return (
    <div 
      className={`group relative bg-white rounded-2xl p-6 border-2 ${colors.border} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden`}
      onClick={onClick}
    >
      {/* Accent bar at top */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${colors.bg}`} />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${colors.light}`}>
            <div className={`w-6 h-6 ${colors.text}`}>
              {icon}
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        
        {/* Trend Badge */}
        {trendValue && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${trendBgColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className={`text-2xl font-black ${colors.text}`}>{primaryValue}</div>
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{primaryLabel}</div>
        </div>
        <div>
          <div className="text-2xl font-black text-slate-700">{secondaryValue}</div>
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{secondaryLabel}</div>
        </div>
      </div>
      
      {/* Stats Footer */}
      {stats && stats.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-2">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{stat.label}</span>
              <span className="font-semibold text-slate-700">{stat.value}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Hover arrow */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className={`w-5 h-5 ${colors.text}`} />
      </div>
    </div>
  );
};

// Unified Action Card Component
const ActionCard: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  onClick?: () => void;
  badge?: string;
}> = ({ title, subtitle, icon, accentColor, onClick, badge }) => {
  
  const colorMap: { [key: string]: { bg: string; text: string; border: string; light: string; hover: string } } = {
    blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', light: 'bg-blue-50', hover: 'hover:border-blue-400' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-50', hover: 'hover:border-emerald-400' },
    violet: { bg: 'bg-violet-500', text: 'text-violet-600', border: 'border-violet-200', light: 'bg-violet-50', hover: 'hover:border-violet-400' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50', hover: 'hover:border-amber-400' },
  };
  
  const colors = colorMap[accentColor] || colorMap.blue;
  
  return (
    <div 
      className={`group relative bg-white rounded-2xl p-6 border-2 ${colors.border} ${colors.hover} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={`w-12 h-12 mb-4 p-3 rounded-xl ${colors.light} group-hover:scale-110 transition-transform duration-300`}>
        <div className={`w-full h-full ${colors.text}`}>
          {icon}
        </div>
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-slate-900 transition-colors">{title}</h3>
      <p className="text-sm text-slate-500">{subtitle}</p>
      
      {/* Badge */}
      {badge && (
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Activity className="w-4 h-4" />
          <span>{badge}</span>
        </div>
      )}
      
      {/* Hover arrow */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1">
        <ChevronRight className={`w-5 h-5 ${colors.text}`} />
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
  
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Enterprise Command Center
          </h1>
          <p className="text-sm text-slate-500">
            Real-time business intelligence powered by AI-driven analytics
          </p>
        </div>

        {/* KPI Cards Grid - Unified Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          
          {/* Inventory Health */}
          <KPICard
            title="Inventory Health"
            subtitle="Stock Performance"
            primaryValue={inventoryMetrics.lowStockCount.toString()}
            primaryLabel="Low Stock"
            secondaryValue={inventoryMetrics.outOfStock.toString()}
            secondaryLabel="Out of Stock"
            trend={inventoryMetrics.lowStockCount > 50 ? 'down' : inventoryMetrics.lowStockCount > 20 ? 'neutral' : 'up'}
            trendValue={`${Math.round((inventoryMetrics.totalItems - inventoryMetrics.lowStockCount - inventoryMetrics.outOfStock) / inventoryMetrics.totalItems * 100)}%`}
            icon={<Package className="w-full h-full" />}
            accentColor="blue"
            onClick={() => onNavigate('inventory')}
            stats={[
              { label: 'Total Items', value: inventoryMetrics.totalItems.toLocaleString() },
              { label: 'Total Value', value: formatCAD(inventoryMetrics.totalValue) }
            ]}
          />

          {/* Manufacturing Pipeline */}
          <KPICard
            title="Manufacturing"
            subtitle="Production Status"
            primaryValue={manufacturingMetrics.active.toString()}
            primaryLabel="Active Orders"
            secondaryValue={manufacturingMetrics.pending.toString()}
            secondaryLabel="Pending"
            trend={manufacturingMetrics.active > manufacturingMetrics.pending ? 'up' : 'neutral'}
            trendValue={`${Math.round(manufacturingMetrics.active / (manufacturingMetrics.active + manufacturingMetrics.pending) * 100)}%`}
            icon={<Factory className="w-full h-full" />}
            accentColor="emerald"
            onClick={() => onNavigate('manufacturing-orders')}
            stats={[
              { label: 'Pipeline Value', value: formatCAD(manufacturingMetrics.totalValue) },
              { label: 'Completed', value: manufacturingMetrics.closed.toString() }
            ]}
          />

          {/* Sales Orders */}
          <KPICard
            title="Sales Orders"
            subtitle="Order Status"
            primaryValue={salesOrderAnalytics.newAndRevised.count.toString()}
            primaryLabel="New Orders"
            secondaryValue={salesOrderAnalytics.inProduction.count.toString()}
            secondaryLabel="Scheduled"
            trend={salesOrderAnalytics.newAndRevised.count > 0 ? 'up' : 'neutral'}
            trendValue={`${Math.round(salesOrderAnalytics.completed.count / salesOrderAnalytics.total * 100)}%`}
            icon={<TrendingUp className="w-full h-full" />}
            accentColor="cyan"
            onClick={() => onNavigate('orders')}
            stats={[
              { label: 'Total Orders', value: salesOrderAnalytics.total.toLocaleString() },
              { label: 'Completed', value: salesOrderAnalytics.completed.count.toString() }
            ]}
          />

          {/* Attention Required */}
          <KPICard
            title="Attention Required"
            subtitle="Action Items"
            primaryValue={inventoryMetrics.outOfStock.toString()}
            primaryLabel="Out of Stock"
            secondaryValue={manufacturingMetrics.pending.toString()}
            secondaryLabel="Pending MOs"
            trend={inventoryMetrics.outOfStock > 100 ? 'down' : 'neutral'}
            trendValue={inventoryMetrics.outOfStock > 0 ? 'Action' : 'OK'}
            icon={<AlertTriangle className="w-full h-full" />}
            accentColor="rose"
            onClick={() => onNavigate('inventory')}
            stats={[
              { label: 'Low Stock Items', value: inventoryMetrics.lowStockCount.toString() },
              { label: 'New Sales Orders', value: salesOrderAnalytics.newAndRevised.count.toString() }
            ]}
          />
        </div>

        {/* Command Center Section */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Command Center</h2>
              <p className="text-sm text-slate-500">Intelligent workflow automation and real-time operations</p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-emerald-700 font-semibold text-sm">System Active</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {/* Report Maker */}
            <ActionCard
              title="Report Maker"
              subtitle="Production & Analytics"
              icon={<FileText className="w-full h-full" />}
              accentColor="blue"
              onClick={() => onNavigate('report-maker')}
              badge="Custom Reports"
            />

            {/* Manufacturing */}
            <ActionCard
              title="Manufacturing"
              subtitle="Production Performance"
              icon={<Factory className="w-full h-full" />}
              accentColor="emerald"
              badge="Live Monitoring"
            />

            {/* Smart SO Entry or Email Assistant */}
            {isHaron ? (
              <ActionCard
                title="Email Assistant"
                subtitle="AI-Powered Responses"
                icon={<Mail className="w-full h-full" />}
                accentColor="violet"
                onClick={() => onNavigate('email-assistant')}
                badge="Smart Email AI"
              />
            ) : (
              <ActionCard
                title="Smart SO Entry"
                subtitle="BOM Verification"
                icon={<Zap className="w-full h-full" />}
                accentColor="violet"
                onClick={() => onNavigate('so-entry')}
                badge="Error Prevention"
              />
            )}

            {/* AI Assistant */}
            <ActionCard
              title="AI Assistant"
              subtitle="ChatGPT Powered"
              icon={<Brain className="w-full h-full" />}
              accentColor="amber"
              onClick={() => onNavigate('intelligence')}
              badge="Natural Language"
            />
          </div>
        </div>

      </div>
    </div>
  );
};
