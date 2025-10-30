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

  return (
    <header className="bg-gradient-to-br from-slate-100 via-slate-50 to-white shadow-xl border-b border-slate-300/40">
      <div className="max-w-7xl mx-auto">
        {/* Main Header Bar */}
        <div className="px-8 py-5">
          <div className="flex items-center justify-between">
            {/* Left Side - Logo and Main Title */}
            <div className="flex items-center space-x-6">
              {/* Logo with subtle glow */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/30 to-blue-500/30 blur-xl rounded-full scale-150"></div>
                <img 
                  src="/Canoil_logo.png" 
                  alt="Canoil Canada Ltd." 
                  className="relative h-14 w-auto drop-shadow-sm"
                />
              </div>
              
              {/* Main Title with premium typography */}
              <div className="flex flex-col space-y-1">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                  CANOIL CANADA LTD.
                </h1>
                <p className="text-slate-600 font-semibold text-sm tracking-wide uppercase">
                  MISys Intelligence Center
                </p>
              </div>
            </div>

            {/* Right Side - Navigation Controls and Status */}
            <div className="flex items-center space-x-8">
              {/* Premium Navigation Controls */}
              <div className="flex items-center space-x-1 bg-slate-200/60 backdrop-blur-sm rounded-2xl p-1.5 border border-slate-300/50 shadow-md">
                <button
                  onClick={onHome}
                  className="p-3 text-slate-700 hover:bg-gradient-to-r hover:from-emerald-100 hover:to-blue-100 hover:text-slate-800 rounded-xl transition-all duration-300 hover:scale-105 group"
                  title="Home"
                >
                  <Home className="w-5 h-5 group-hover:scale-110" />
                </button>
                <button
                  onClick={onGoBack}
                  disabled={!canGoBack}
                  className={`p-3 rounded-xl transition-all duration-300 ${
                    canGoBack 
                      ? 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 hover:text-slate-800 hover:scale-105' 
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                  title="Go Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={onGoForward}
                  disabled={!canGoForward}
                  className={`p-3 rounded-xl transition-all duration-300 ${
                    canGoForward 
                      ? 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 hover:text-slate-800 hover:scale-105' 
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                  title="Go Forward"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Premium G: Drive Status with Google Logo */}
              {dataSource && (
                <div className="flex items-center space-x-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl px-4 py-3 border border-emerald-400/30 shadow-lg backdrop-blur-sm">
                  {/* Real Google Drive Icon */}
                  <img 
                    src="/Google_Drive_icon_(2020).svg.png" 
                    alt="Google Drive" 
                    className="w-5 h-5 drop-shadow-sm"
                  />
                  
                  <div className="text-white">
                    <div className="font-semibold text-sm tracking-wide">G: Drive</div>
                    <div className="text-emerald-100 text-xs font-medium">
                      {syncInfo ? `Data: ${formatSyncDate(syncInfo.syncDate)}` : 'Connected'}
                    </div>
                    {syncInfo && syncInfo.lastModified && (
                      <div className="text-emerald-200 text-xs opacity-80">
                        Modified: {formatSyncDate(syncInfo.lastModified)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Premium Help Button */}
              {onShowHelp && (
                <button
                  onClick={onShowHelp}
                  className="p-3 text-slate-700 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 hover:text-slate-800 rounded-xl transition-all duration-300 hover:scale-105 group"
                  title="Keyboard Shortcuts & Help"
                >
                  <HelpCircle className="w-5 h-5 group-hover:scale-110" />
                </button>
              )}
            </div>
          </div>
        </div>


      </div>
    </header>
  );
}
