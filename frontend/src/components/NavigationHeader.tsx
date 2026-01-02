import React from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Home, 
  ChevronRight,
  RefreshCw,
  Settings,
  HelpCircle,
  Search,
  Globe,
  Package,
  Factory,
  Users,
  Truck,
  FileText,
  Activity,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { NavigationItem } from '../hooks/useNavigation';

interface NavigationHeaderProps {
  canGoBack: boolean;
  canGoForward: boolean;
  breadcrumbs: NavigationItem[];
  onGoBack: () => void;
  onGoForward: () => void;
  onNavigateToItem: (item: NavigationItem) => void;
  onHome: () => void;
  onShowHelp?: () => void;
  dataSource?: string;
  currentUser?: { name: string; email: string; isAdmin: boolean } | null;
  activeApp?: 'operations' | 'production-schedule' | 'shipping';
  onSelectApp?: (app: 'operations' | 'production-schedule' | 'shipping') => void;
  syncInfo?: {
    folderName: string;
    syncDate: string;
    lastModified: string;
    folder: string;
  } | null;
}

export function NavigationHeader({
  canGoBack,
  canGoForward,
  breadcrumbs,
  onGoBack,
  onGoForward,
  onNavigateToItem,
  onHome,
  onShowHelp,
  dataSource,
  currentUser,
  activeApp = 'operations',
  onSelectApp,
  syncInfo
}: NavigationHeaderProps) {

  // Format sync date for display
  const formatSyncDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Unknown';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'tab': return '📊';
      case 'modal': return '🔍';
      case 'search': return '🔎';
      default: return '📄';
    }
  };

  // Top-level app tab handlers
  const handleOperationsClick = () => {
    if (onSelectApp) {
      onSelectApp('operations');
    } else {
      onHome();
    }
  };

  const handleProductionScheduleClick = () => {
    if (onSelectApp) {
      onSelectApp('production-schedule');
    } else if (typeof window !== 'undefined') {
      // Fallback to legacy standalone app behavior
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    const url = isLocal
      ? 'http://localhost:3000'
      : 'https://cannoli-production-schedule.vercel.app';

    window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <header className="bg-gradient-to-br from-slate-100 via-slate-50 to-white shadow-sm border-b border-slate-200">
      <div className="max-w-full mx-auto">
        {/* Main Header Bar - Compact single line */}
        <div className="px-4 py-1.5">
          <div className="flex items-center justify-between">
            {/* Left Side - Logo and Main Title inline */}
            <div className="flex items-center space-x-3">
              {/* Logo */}
                <img 
                  src="/Canoil_logo.png" 
                  alt="Canoil Canada Ltd." 
                className="h-7 w-auto"
                />
              
              {/* Main Title - single line */}
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-slate-800 tracking-tight whitespace-nowrap">
                  CANOIL CANADA LTD.
                </h1>
                <span className="text-slate-400">|</span>
                <p className="text-slate-500 font-medium text-xs tracking-wide uppercase whitespace-nowrap">
                  MISys Intelligence Center
                </p>
              </div>
            </div>

            {/* Right Side - All controls inline */}
            <div className="flex items-center space-x-2">
              {/* App Switch Tabs */}
              <div className="flex items-center bg-slate-200/60 rounded-lg p-0.5 border border-slate-300/50">
                <button
                  onClick={handleOperationsClick}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors ${
                    activeApp === 'operations'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                  }`}
                  title="Canoil Operations"
                >
                  Canoil Operations
                </button>
                <button
                  onClick={handleProductionScheduleClick}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors ${
                    activeApp === 'production-schedule'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                  }`}
                  title="Production Schedule"
                >
                  Production Schedule
                </button>
                <button
                  disabled
                  className="px-2.5 py-1 rounded-md text-[10px] font-semibold text-slate-400 cursor-not-allowed whitespace-nowrap"
                  title="Shipping (coming soon)"
                >
                  Shipping
                </button>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center bg-slate-200/60 rounded-lg p-0.5 border border-slate-300/50">
                <button
                  onClick={onHome}
                  className="p-1.5 text-slate-600 hover:bg-white hover:text-slate-800 rounded-md transition-colors"
                  title="Home"
                >
                  <Home className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onGoBack}
                  disabled={!canGoBack}
                  className={`p-1.5 rounded-md transition-colors ${
                    canGoBack ? 'text-slate-600 hover:bg-white hover:text-slate-800' : 'text-slate-400 cursor-not-allowed'
                  }`}
                  title="Go Back"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onGoForward}
                  disabled={!canGoForward}
                  className={`p-1.5 rounded-md transition-colors ${
                    canGoForward ? 'text-slate-600 hover:bg-white hover:text-slate-800' : 'text-slate-400 cursor-not-allowed'
                  }`}
                  title="Go Forward"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Logged-in User - compact */}
              {currentUser && (
                <div className="flex items-center space-x-1.5 bg-slate-100/80 rounded-lg px-2 py-1 border border-slate-300/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
                    {currentUser.name} {currentUser.isAdmin && '(Admin)'}
                  </span>
                </div>
              )}

              {/* G: Drive Status - compact single line */}
              {dataSource && (
                <div className="flex items-center space-x-1.5 bg-emerald-600 text-white rounded-lg px-2 py-1 border border-emerald-500/60">
                  <img 
                    src="/Google_Drive_icon_(2020).svg.png" 
                    alt="Google Drive" 
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-[10px] font-semibold whitespace-nowrap">G: Drive</span>
                  <span className="text-[10px] text-emerald-100 whitespace-nowrap">
                    {syncInfo ? formatSyncDate(syncInfo.syncDate) : 'Connected'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
