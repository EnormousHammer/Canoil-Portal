import React from 'react';
import { 
  Database, 
  Shield, 
  Zap, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  Activity,
  BarChart3,
  Cpu,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Key,
  User
} from 'lucide-react';

// Reusable Enterprise Card Component
interface EnterpriseCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'premium' | 'glass';
  hover?: boolean;
}

export const EnterpriseCard: React.FC<EnterpriseCardProps> = ({
  children,
  className = '',
  variant = 'default',
  hover = true
}) => {
  const baseClasses = 'backdrop-blur-xl rounded-2xl border shadow-2xl transition-all duration-500';
  
  const variantClasses = {
    default: 'bg-white/10 border-white/20',
    premium: 'bg-white/15 border-white/30 shadow-3xl',
    glass: 'bg-white/5 border-white/10'
  };

  const hoverClasses = hover ? 'hover:bg-white/15 hover:border-white/30 hover:scale-105' : '';

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
};

// Reusable Enterprise Button Component
interface EnterpriseButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export const EnterpriseButton: React.FC<EnterpriseButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = ''
}) => {
  const baseClasses = 'font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl focus:ring-blue-400',
    secondary: 'bg-white/10 border border-white/20 hover:bg-white/20 text-white focus:ring-white/40',
    ghost: 'bg-transparent hover:bg-white/10 text-white focus:ring-white/40',
    danger: 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg hover:shadow-xl focus:ring-red-400'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

// Reusable Enterprise Input Component
interface EnterpriseInputProps {
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const EnterpriseInput: React.FC<EnterpriseInputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  label,
  error,
  disabled = false,
  icon,
  className = ''
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-white/90">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60">
            {icon}
          </div>
        )}
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-300 ${
            icon ? 'pl-12' : ''
          } ${type === 'password' ? 'pr-12' : ''} ${error ? 'border-red-400' : ''}`}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors duration-200"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
};

// Reusable Enterprise Logo Section
interface EnterpriseLogoSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  logoUrl?: string;
  className?: string;
}

export const EnterpriseLogoSection: React.FC<EnterpriseLogoSectionProps> = ({
  title,
  subtitle,
  description,
  logoUrl = "/Canoil_logo.png",
  className = ''
}) => {
  return (
    <div className={`text-center xl:text-left ${className}`}>
      <div className="relative inline-block mb-8">
        {/* Multi-layer Glow Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/40 to-cyan-400/40 rounded-full blur-3xl scale-150 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/30 to-purple-400/30 rounded-full blur-2xl scale-125 animate-pulse" style={{ animationDelay: '0.5s' }} />
        
        <div className="relative bg-white/10 backdrop-blur-2xl rounded-3xl p-10 border border-white/20 shadow-2xl">
          <div className="relative">
            <img 
              src={logoUrl} 
              alt={title} 
              className="h-24 w-auto mx-auto xl:mx-0 filter drop-shadow-2xl"
            />
            {/* Logo Halo Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-xl scale-110" />
          </div>
        </div>
      </div>
      
      {/* Premium Typography */}
      <h1 className="text-6xl xl:text-7xl font-black text-white mb-6 tracking-tight">
        <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
          {title}
        </span>
      </h1>
      {subtitle && (
        <p className="text-blue-200 text-3xl font-light tracking-widest mb-3">{subtitle}</p>
      )}
      {description && (
        <p className="text-slate-300 text-xl font-medium max-w-md mx-auto xl:mx-0">
          {description}
        </p>
      )}
    </div>
  );
};

// Reusable Enterprise Feature Grid
interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

interface EnterpriseFeatureGridProps {
  features: Feature[];
  className?: string;
}

export const EnterpriseFeatureGrid: React.FC<EnterpriseFeatureGridProps> = ({
  features,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {features.map((feature, index) => {
        const IconComponent = feature.icon;
        return (
          <div 
            key={index}
            className="group bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105"
          >
            <div className={`w-12 h-12 mx-auto mb-4 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300`}>
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <p className="text-white text-sm font-semibold text-center group-hover:text-blue-200 transition-colors duration-300">
              {feature.label}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// Reusable Enterprise Progress Bar
interface EnterpriseProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export const EnterpriseProgressBar: React.FC<EnterpriseProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  className = ''
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-lg text-slate-300">
          <span className="font-semibold">{label}</span>
          {showPercentage && (
            <span className="font-mono text-xl font-bold text-blue-400">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      
      <div className="relative">
        <div className="w-full h-4 bg-slate-700/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 rounded-full transition-all duration-500 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Animated Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/60 to-indigo-400/60 blur-sm" />
          </div>
        </div>
        
        {/* Progress Glow Trail */}
        <div className="absolute top-0 left-0 h-4 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 rounded-full animate-pulse" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

// Reusable Enterprise Spinner
interface EnterpriseSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const EnterpriseSpinner: React.FC<EnterpriseSpinnerProps> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div className="w-full h-full border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      <div className="absolute inset-0 w-full h-full border-4 border-transparent border-t-cyan-400/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      <div className="absolute inset-2 w-2/3 h-2/3 border-2 border-transparent border-t-indigo-400/70 rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
      <div className="absolute inset-4 w-1/2 h-1/2 border-2 border-transparent border-t-purple-400/90 rounded-full animate-spin" style={{ animationDuration: '0.5s' }} />
    </div>
  );
};

// Predefined feature sets for different contexts
export const loadingFeatures: Feature[] = [
  { icon: Database, label: "Real-time Data", color: "from-green-500 to-emerald-500" },
  { icon: Shield, label: "Enterprise Security", color: "from-emerald-500 to-teal-500" },
  { icon: Zap, label: "AI Analytics", color: "from-lime-500 to-green-500" },
  { icon: TrendingUp, label: "Performance", color: "from-green-600 to-emerald-600" },
  { icon: Globe, label: "Global Access", color: "from-teal-500 to-cyan-500" },
  { icon: Lock, label: "Data Integrity", color: "from-emerald-600 to-green-600" }
];

export const loginFeatures: Feature[] = [
  { icon: Shield, label: "Secure Access", color: "from-green-500 to-emerald-500" },
  { icon: Lock, label: "Data Protection", color: "from-emerald-500 to-teal-500" },
  { icon: User, label: "User Management", color: "from-lime-500 to-green-500" },
  { icon: Activity, label: "Activity Monitoring", color: "from-green-600 to-emerald-600" }
];

export default {
  EnterpriseCard,
  EnterpriseButton,
  EnterpriseInput,
  EnterpriseLogoSection,
  EnterpriseFeatureGrid,
  EnterpriseProgressBar,
  EnterpriseSpinner,
  loadingFeatures,
  loginFeatures
};
