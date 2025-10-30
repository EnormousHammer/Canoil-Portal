import React, { useState } from 'react';
import { 
  Mail, 
  Key, 
  User, 
  Eye, 
  EyeOff,
  Shield,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { 
  EnterpriseCard, 
  EnterpriseButton, 
  EnterpriseInput, 
  EnterpriseLogoSection, 
  EnterpriseFeatureGrid,
  loginFeatures 
} from './EnterpriseUIComponents';

interface EnterpriseLoginScreenProps {
  onLogin?: (credentials: { email: string; password: string }) => void;
  onForgotPassword?: () => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

export const EnterpriseLoginScreen: React.FC<EnterpriseLoginScreenProps> = ({
  onLogin,
  onForgotPassword,
  loading = false,
  error,
  className = ''
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm() && onLogin) {
      onLogin({ email, password });
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden ${className}`}>
      {/* Premium Background Effects */}
      <div className="absolute inset-0">
        {/* Animated Grid Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '60px 60px',
              animation: 'gridMove 20s linear infinite'
            }}
          />
        </div>

        {/* Floating Particles */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `particleFloat ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`
              }}
            />
          ))}
        </div>

        {/* Dynamic Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
        <div className="max-w-7xl w-full grid grid-cols-1 xl:grid-cols-2 gap-16 items-center">
          
          {/* Left Side - Branding & Features */}
          <div className="space-y-12">
            <EnterpriseLogoSection
              title="CANOIL"
              subtitle="CANADA LTD."
              description="Advanced Manufacturing Intelligence & Industrial Solutions"
            />

            <EnterpriseFeatureGrid features={loginFeatures} />
          </div>

          {/* Right Side - Login Form */}
          <div className="space-y-8">
            <EnterpriseCard variant="premium" className="p-10">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
                <p className="text-slate-300 text-lg">Sign in to your enterprise account</p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-400/30 rounded-xl flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <EnterpriseInput
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onChange={setEmail}
                  error={validationErrors.email}
                  icon={<Mail className="w-5 h-5" />}
                />

                <EnterpriseInput
                  type="password"
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={setPassword}
                  error={validationErrors.password}
                  icon={<Key className="w-5 h-5" />}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-white/90 text-sm">Remember me</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors duration-200"
                  >
                    Forgot password?
                  </button>
                </div>

                <EnterpriseButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  className="w-full"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </EnterpriseButton>
              </form>

              {/* Security Notice */}
              <div className="mt-8 p-4 bg-blue-500/10 border border-blue-400/30 rounded-xl">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-300 text-sm font-semibold mb-1">Secure Enterprise Access</p>
                    <p className="text-blue-200/80 text-xs">
                      Your connection is encrypted and monitored for security compliance.
                    </p>
                  </div>
                </div>
              </div>
            </EnterpriseCard>

            {/* System Status */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 text-center group hover:bg-white/10 transition-all duration-300">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <p className="text-white text-sm font-semibold">SSL Secure</p>
                <div className="w-2 h-2 bg-green-400 rounded-full mx-auto mt-2 animate-pulse" />
              </div>
              
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 text-center group hover:bg-white/10 transition-all duration-300">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <p className="text-white text-sm font-semibold">System Online</p>
                <div className="w-2 h-2 bg-blue-400 rounded-full mx-auto mt-2 animate-pulse" />
              </div>
              
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 text-center group hover:bg-white/10 transition-all duration-300">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <User className="w-4 h-4 text-white" />
                </div>
                <p className="text-white text-sm font-semibold">User Active</p>
                <div className="w-2 h-2 bg-purple-400 rounded-full mx-auto mt-2 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Border Accent */}
      <div className="absolute inset-0 border-2 border-gradient-to-r from-blue-500/20 via-transparent to-indigo-500/20 rounded-lg pointer-events-none" />
      
      {/* Custom CSS for animations */}
      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        
        @keyframes particleFloat {
          0%, 100% { 
            transform: translateY(0px) translateX(0px) scale(1); 
            opacity: 0.3;
          }
          25% { 
            transform: translateY(-20px) translateX(10px) scale(1.2); 
            opacity: 0.8;
          }
          50% { 
            transform: translateY(-10px) translateX(-5px) scale(0.8); 
            opacity: 0.5;
          }
          75% { 
            transform: translateY(-30px) translateX(15px) scale(1.1); 
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
};

export default EnterpriseLoginScreen;
