import React from 'react';
import { Brain, Database, FileText, Users, Package, TrendingUp, Zap, RefreshCw, Clock, CheckCircle, X, Info, AlertTriangle } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'purple' | 'green' | 'orange';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'blue' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-700',
    orange: 'text-orange-600'
  };

  return (
    <RefreshCw className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin`} />
  );
};

interface EnterpriseLoadingProps {
  title: string;
  subtitle?: string;
  hints?: string[];
  progress?: number;
  icon?: React.ReactNode;
}

export const EnterpriseLoading: React.FC<EnterpriseLoadingProps> = ({
  title,
  subtitle,
  hints = [],
  progress,
  icon
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* Clean Enterprise Loading Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-10 text-center">
          
          {/* Company Logo/Icon */}
          <div className="relative mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              {icon || <Database className="w-10 h-10 text-white" />}
            </div>
          </div>

          {/* App Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {title}
          </h1>

          {/* App Description */}
          {subtitle && (
            <p className="text-gray-600 mb-8 leading-relaxed">
              {subtitle}
            </p>
          )}

          {/* Progress Bar */}
          {progress !== undefined && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 mb-3">
                <span>Initializing...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Simple Loading Animation */}
          <div className="flex justify-center space-x-1 mb-8">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>

          {/* App Info */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Canoil Manufacturing Intelligence Portal</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Real-time Manufacturing Data</span>
                <span className="text-green-600">✓</span>
              </div>
              <div className="flex justify-between">
                <span>AI-Powered Analytics</span>
                <span className="text-green-600">✓</span>
              </div>
              <div className="flex justify-between">
                <span>Enterprise Integration</span>
                <span className="text-green-600">✓</span>
              </div>
              <div className="flex justify-between">
                <span>Production Intelligence</span>
                <span className="text-green-600">✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CompactLoadingProps {
  message: string;
  submessage?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const CompactLoading: React.FC<CompactLoadingProps> = ({
  message,
  submessage,
  icon,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'py-3',
    md: 'py-6',
    lg: 'py-8'
  };

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`text-center ${sizeClasses[size]}`}>
      <div className="relative inline-block mb-3">
        <div className={`${iconSizes[size]} mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg`}>
          {icon || <RefreshCw className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'} text-white animate-spin`} />}
        </div>
        <div className="absolute inset-0 rounded-lg border-2 border-green-300 animate-ping opacity-20"></div>
      </div>
      
      <div className="space-y-1">
        <div className="text-base font-semibold text-slate-900">{message}</div>
        {submessage && (
          <div className="text-sm text-slate-600">{submessage}</div>
        )}
      </div>

      {/* Sleek animated dots */}
      <div className="flex justify-center space-x-1 mt-3">
        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"></div>
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
};

interface DataLoadingProps {
  dataType: string;
  recordCount?: number;
  stage?: string;
}

export const DataLoading: React.FC<DataLoadingProps> = ({
  dataType,
  recordCount,
  stage = "Loading"
}) => {
  const getIcon = () => {
    switch (dataType.toLowerCase()) {
      case 'sales orders':
      case 'orders':
        return <FileText className="w-5 h-5 text-white" />;
      case 'customers':
        return <Users className="w-5 h-5 text-white" />;
      case 'inventory':
      case 'items':
        return <Package className="w-5 h-5 text-white" />;
      case 'analytics':
        return <TrendingUp className="w-5 h-5 text-white" />;
      case 'ai':
        return <Brain className="w-5 h-5 text-white" />;
      default:
        return <Database className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="fixed bottom-2 right-2 z-50">
      <div className="bg-black/20 backdrop-blur-sm rounded-lg shadow-lg border border-white/10 p-2 min-w-[180px] max-w-[200px]">
        <div className="flex items-center space-x-2">
          {/* Minimal Icon */}
          <div className="relative flex-shrink-0">
            <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded flex items-center justify-center">
              {getIcon()}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-white truncate">
                {stage} {dataType}
              </h4>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              </div>
            </div>
            
            {recordCount && (
              <p className="text-xs text-gray-300">
                {recordCount.toLocaleString()}
              </p>
            )}

            {/* Minimal Progress Bar */}
            <div className="w-full bg-white/20 rounded-full h-0.5 overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SuccessLoadingProps {
  message: string;
  submessage?: string;
}

export const SuccessLoading: React.FC<SuccessLoadingProps> = ({
  message,
  submessage
}) => {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
        <CheckCircle className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-xl font-bold text-slate-900 mb-2">{message}</h3>
      {submessage && (
        <p className="text-sm text-slate-600">{submessage}</p>
      )}
    </div>
  );
};

interface ToastNotificationProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose
}) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: 'bg-green-500 border-green-400',
    error: 'bg-red-500 border-red-400',
    info: 'bg-blue-500 border-blue-400',
    warning: 'bg-yellow-500 border-yellow-400'
  };

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-white" />,
    error: <X className="w-4 h-4 text-white" />,
    info: <Info className="w-4 h-4 text-white" />,
    warning: <AlertTriangle className="w-4 h-4 text-white" />
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 transform transition-all duration-300 ease-out">
      <div className={`${typeStyles[type]} text-white px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-xl flex items-center space-x-3 min-w-[280px] max-w-[400px]`}>
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300);
          }}
          className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};