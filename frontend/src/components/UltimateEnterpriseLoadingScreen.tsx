import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Shield, 
  Zap, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  Globe,
  Lock,
  Activity,
  BarChart3,
  Cpu,
  Network,
  User,
  Eye,
  EyeOff
} from 'lucide-react';

interface UltimateEnterpriseLoadingScreenProps {
  loadingStatus: string;
  dataLoaded: boolean;
  progress?: number;
  onComplete?: () => void;
  onUserLogin?: (user: { name: string; email: string; isAdmin: boolean }) => void;
  showLogin?: boolean;
}

export const UltimateEnterpriseLoadingScreen: React.FC<UltimateEnterpriseLoadingScreenProps> = ({
  loadingStatus,
  dataLoaded,
  progress = 0,
  onComplete,
  onUserLogin,
  showLogin = false
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [particlePositions, setParticlePositions] = useState<Array<{x: number, y: number, delay: number}>>([]);
  
  // Login state
  const [selectedUser, setSelectedUser] = useState<{ name: string; email: string; isAdmin: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [passwordInputRef, setPasswordInputRef] = useState<HTMLInputElement | null>(null);

  // Canoil company images for slideshow - using the SAME images that were already working
  const images = [
    '/image_1.png',
    '/image_2.png', 
    '/image_3.png',
    '/image_4.png',
    '/image_5.png'
  ];

  // User list data
  const adminUsers = [
    { name: 'Haron Alhakimi', email: 'haron@canoilcanadaltd.com', isAdmin: true },
    { name: 'Gamil Alhakimi', email: 'gamil@canoilcanadaltd.com', isAdmin: true },
    { name: 'Henry Sapiano', email: 'henry@canoilcanadaltd.com', isAdmin: true }
  ];

  const allUsers = [
    { name: 'Haron Alhakimi', email: 'haron@canoilcanadaltd.com', isAdmin: true },
    { name: 'Gamil Alhakimi', email: 'gamil@canoilcanadaltd.com', isAdmin: true },
    { name: 'Samantha Leviston', email: 'samantha@canoilcanadaltd.com', isAdmin: false },
    { name: 'Carolina Mejia', email: 'carolina@canoilcanadaltd.com', isAdmin: false },
    { name: 'Murali', email: 'murali@canoilcanadaltd.com', isAdmin: false },
    { name: 'Henry Sapiano', email: 'henry@canoilcanadaltd.com', isAdmin: true },
    { name: 'Zuri Arthur', email: 'zuri@canoilcanadaltd.com', isAdmin: false },
    { name: 'Kathleen Bevan', email: 'kathleen@canoilcanadaltd.com', isAdmin: false },
    { name: 'Magd Saad', email: 'magd@canoilcanadaltd.com', isAdmin: false },
    { name: 'Jean Sterken', email: 'jean@canoilcanadaltd.com', isAdmin: false },
    { name: 'Solongo Lewis', email: 'solongo@canoilcanadaltd.com', isAdmin: false },
    { name: 'Canoil CSR', email: 'csr@canoilcanadaltd.com', isAdmin: false },
    { name: 'Vicente Pazmiño', email: 'vicente@canoilcanadaltd.com', isAdmin: false },
    { name: 'Marc Couturier', email: 'marc@canoilcanadaltd.com', isAdmin: false }
  ];

  // Pagination logic
  const usersPerPage = 5;
  const totalPages = Math.ceil(allUsers.length / usersPerPage);
  const startIndex = currentPage * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = allUsers.slice(startIndex, endIndex);

  // Handle user selection
  const handleUserSelect = (user: { name: string; email: string; isAdmin: boolean }) => {
    setSelectedUser(user);
    setPassword('');
    setLoginError('');
    // Auto-focus password field after user selection
    setTimeout(() => {
      if (passwordInputRef) {
        passwordInputRef.focus();
      }
    }, 100);
  };

  // Handle login
  const handleLogin = async () => {
    if (!selectedUser) return;
    
    setIsLoggingIn(true);
    setLoginError('');
    
    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if admin user
    if (selectedUser.isAdmin) {
      // Admin users need password 1967
      if (password !== '1967') {
        setLoginError('Invalid password for admin user. Admin password is required.');
        setIsLoggingIn(false);
        return;
      }
    } else {
      // Regular users can login without password (or with any password)
      // For now, allow any password for regular users
    }
    
    // Successful login
    if (onUserLogin) {
      onUserLogin(selectedUser);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedUser && !isLoggingIn) {
      handleLogin();
    }
  };

  // Initialize particle positions
  useEffect(() => {
    const particles = Array.from({ length: 30 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5
    }));
    setParticlePositions(particles);
  }, []);

  // Image slideshow rotation
  useEffect(() => {
    const imageInterval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(imageInterval);
  }, [images.length]);

  const steps = [
    "Core Systems",
    "Database Connection", 
    "Data Loading",
    "AI Engine",
    "Secure Connections",
    "System Integration"
  ];

  // Main loading progress - goes from 0 to 100%
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Calculate which step should be active based on progress
  const getCurrentStepFromProgress = (progress: number): number => {
    if (progress < 16.67) return 0; // Step 1: 0-16.67%
    if (progress < 33.33) return 1; // Step 2: 16.67-33.33%
    if (progress < 50) return 2;    // Step 3: 33.33-50%
    if (progress < 66.67) return 3; // Step 4: 50-66.67%
    if (progress < 83.33) return 4; // Step 5: 66.67-83.33%
    return 5; // Step 6: 83.33-100%
  };
  
  const currentStep = getCurrentStepFromProgress(loadingProgress);
  
  // Smooth progress animation - goes from 0 to 100% over time
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          // Complete loading after reaching 100%
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 1000);
          return 100;
        }
        return prev + 0.5; // Increment by 0.5% every 50ms for smooth 10-second total
      });
    }, 50); // Update every 50ms for very smooth animation

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  const features = [
    { icon: Database, label: "Real-time Data", color: "from-green-500 to-emerald-500" },
    { icon: Shield, label: "Enterprise Security", color: "from-emerald-500 to-teal-500" },
    { icon: Zap, label: "AI Analytics", color: "from-lime-500 to-green-500" },
    { icon: TrendingUp, label: "Performance", color: "from-green-600 to-emerald-600" },
    { icon: Globe, label: "Global Access", color: "from-teal-500 to-cyan-500" },
    { icon: Lock, label: "Data Integrity", color: "from-emerald-600 to-green-600" }
  ];

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 relative overflow-hidden">
      {/* Canoil Company Colorway Background */}
      <div className="absolute inset-0">
        {/* Industrial Pattern - Oil/Lubricant Theme */}
        <div className="absolute inset-0 opacity-20">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310b981' fill-opacity='0.1'%3E%3Cpath d='M40 0L80 40L40 80L0 40z'/%3E%3Cpath d='M20 20L60 20L60 60L20 60z'/%3E%3Cpath d='M30 30L50 30L50 50L30 50z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '80px 80px',
              animationName: 'geometricMove',
              animationDuration: '25s',
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite'
            }}
          />
        </div>

        {/* Oil Drop Pattern */}
        <div className="absolute inset-0 opacity-15">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23059669' fill-opacity='0.08'%3E%3Cpath d='M50 0C50 0 60 20 60 40C60 60 50 80 50 80C50 80 40 60 40 40C40 20 50 0 50 0Z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '100px 100px',
              animationName: 'oilDropMove',
              animationDuration: '30s',
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationDirection: 'reverse'
            }}
          />
        </div>

        {/* Floating Oil Particles */}
        <div className="absolute inset-0">
          {particlePositions.map((particle, i) => (
            <div
              key={i}
              className="absolute bg-green-400/30 rounded-full animate-pulse"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${1 + Math.random() * 2}px`,
                height: `${1 + Math.random() * 2}px`,
                animationName: 'particleFloat',
                animationDuration: `${3 + Math.random() * 4}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${particle.delay}s`
              }}
            />
          ))}
        </div>

        {/* Canoil Brand Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-green-500/15 to-emerald-500/15 rounded-full blur-3xl" style={{ animationName: 'pulse', animationDuration: '2s', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)', animationIterationCount: 'infinite' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 rounded-full blur-3xl" style={{ animationName: 'pulse', animationDuration: '2s', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)', animationIterationCount: 'infinite', animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-r from-lime-500/10 to-green-500/10 rounded-full blur-2xl" style={{ animationName: 'pulse', animationDuration: '2s', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)', animationIterationCount: 'infinite', animationDelay: '1s' }} />
        
        {/* Industrial Flow Lines */}
        <div className="absolute inset-0 opacity-25">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="industrialFlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="25%" stopColor="#059669" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#047857" stopOpacity="0.2" />
                <stop offset="75%" stopColor="#065f46" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#064e3b" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            <path
              d="M10,20 Q30,10 50,20 T90,20"
              stroke="url(#industrialFlow)"
              strokeWidth="0.8"
              fill="none"
              className="animate-pulse"
            />
            <path
              d="M10,80 Q30,90 50,80 T90,80"
              stroke="url(#industrialFlow)"
              strokeWidth="0.8"
              fill="none"
              className="animate-pulse"
              style={{ animationDelay: '1s' }}
            />
            <path
              d="M20,10 L20,90 M80,10 L80,90"
              stroke="url(#industrialFlow)"
              strokeWidth="0.5"
              fill="none"
              className="animate-pulse"
              style={{ animationDelay: '2s' }}
            />
          </svg>
        </div>

        {/* Subtle Radial Overlay for Depth */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-green-900/10 to-emerald-900/20" />
      </div>

      <div className="relative z-10 h-full w-full flex items-center justify-center p-1">
        <div className="w-full h-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-2 items-stretch px-2 scale-100 sm:scale-105 md:scale-110 lg:scale-115 xl:scale-120">
          
          {/* Left Side - Canoil Branding & Image Slideshow */}
          <div className="space-y-3 h-full flex flex-col justify-center">
            {/* Canoil Logo Section */}
            <div className="text-center lg:text-left">
              <div className="relative inline-block mb-2">
                {/* Subtle Glow Effect - Much More Refined */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full blur-lg scale-110" />
                
                <div className="relative bg-white/5 backdrop-blur-xl rounded-lg p-2 border border-white/10 shadow-lg">
                  <div className="relative">
                    <img 
                      src="/Canoil_logo.png" 
                      alt="Canoil Canada Ltd." 
                      className="h-8 w-auto mx-auto lg:mx-0 filter drop-shadow-lg"
                    />
                  </div>
                </div>
              </div>
              
              {/* Canoil Typography */}
              <h1 className="text-2xl lg:text-3xl font-black text-white mb-1 tracking-tight">
                <span className="bg-gradient-to-r from-white via-green-200 to-emerald-200 bg-clip-text text-transparent">
                  CANOIL
                </span>
              </h1>
              <p className="text-green-300 text-sm font-semibold tracking-widest mb-1">CANADA LTD.</p>
              <p className="text-white text-xs font-medium max-w-xs mx-auto lg:mx-0">
                Industrial Lubricants & Manufacturing Solutions
              </p>
            </div>

            {/* Premium Image Slideshow */}
            <div className="relative">
              <div className="bg-white/5 backdrop-blur-xl rounded-lg p-2 border border-white/10 shadow-2xl">
                <div className="relative h-48 overflow-hidden rounded-md">
                  {images.map((image, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                        index === currentImageIndex 
                          ? 'opacity-100 scale-100' 
                          : 'opacity-0 scale-105'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`Canoil Manufacturing ${index + 1}`}
                        className="w-full h-full object-cover rounded-md"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-md"></div>
                    </div>
                  ))}
                  
                  {/* Image Navigation Dots */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          index === currentImageIndex 
                            ? 'bg-white scale-125' 
                            : 'bg-white/50 hover:bg-white/75'
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Feature Grid */}
            <div className="grid grid-cols-2 gap-3 mt-8">
              {features.slice(0, 4).map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <div 
                    key={index}
                    className="group bg-white/5 backdrop-blur-xl rounded-md p-3 border border-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105 h-16 flex flex-col justify-center"
                  >
                    <div className={`w-6 h-6 mx-auto mb-1 bg-gradient-to-r ${feature.color} rounded-md flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                      <IconComponent className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-white text-xs font-semibold text-center group-hover:text-green-200 transition-colors duration-300">
                      {feature.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side - Canoil Loading Interface */}
          <div className="space-y-3 h-full flex flex-col justify-center">
            {/* Main Loading Card */}
            <div className="bg-white/10 backdrop-blur-2xl rounded-lg p-4 border border-white/20 shadow-2xl">
              
              {/* Status Header */}
              <div className="mb-3">
                {showLogin ? (
                  // Login Section
                  <div className="space-y-4">
                    <div className="flex items-center justify-center lg:justify-start mb-2">
                      <div className="relative mr-2">
                        <Shield className="w-8 h-8 text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white mb-1">User Authentication Required</h3>
                        <p className="text-white text-xs font-medium">Select your user account to continue...</p>
                      </div>
                    </div>
                    
                    {/* User List */}
                    <div className="bg-slate-900/80 rounded-lg p-3 space-y-2 border border-slate-500/50">
                      <div className="text-xs text-green-300 font-semibold mb-2 px-2">
                        Available Users ({allUsers.length}) - Page {currentPage + 1} of {totalPages}
                      </div>
                      <div className="space-y-2">
                        {currentUsers.map((user, index) => (
                          <button
                            key={user.email}
                            onClick={() => handleUserSelect(user)}
                            className={`w-full text-left p-3 rounded-lg transition-all border ${
                              selectedUser?.email === user.email
                                ? 'bg-green-600/40 border-green-400 text-white shadow-lg'
                                : 'bg-slate-800/70 hover:bg-slate-700/80 text-white hover:text-white border-slate-600/60 hover:border-slate-500/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4" />
                                <span className="text-sm font-medium">{user.name}</span>
                                {user.isAdmin && (
                                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">Admin</span>
                                )}
                              </div>
                              <span className="text-xs text-white/60">{user.email}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
                          <button
                            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                            className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/40 text-white rounded transition-all"
                          >
                            ← Previous
                          </button>
                          <div className="flex space-x-1">
                            {Array.from({ length: totalPages }, (_, i) => (
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                                className={`w-6 h-6 text-xs rounded ${
                                  currentPage === i
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                                }`}
                              >
                                {i + 1}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage === totalPages - 1}
                            className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/40 text-white rounded transition-all"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Password Input for Selected User */}
                    {selectedUser && (
                      <div className="space-y-2">
                        <div className="text-xs text-green-300 font-semibold">
                          {selectedUser.isAdmin ? 'Admin Password Required' : 'Password (Optional)'}
                        </div>
                        <div className="relative">
                          <input
                            ref={setPasswordInputRef}
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={selectedUser.isAdmin ? 'Enter admin password (1967)' : 'Enter password (any)'}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        
                        {/* Login Error */}
                        {loginError && (
                          <div className="text-xs text-red-300 bg-red-500/20 border border-red-500/50 rounded p-2">
                            {loginError}
                          </div>
                        )}
                        
                        {/* Login Button */}
                        <button
                          onClick={handleLogin}
                          disabled={isLoggingIn}
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                          {isLoggingIn ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Authenticating...
                            </div>
                          ) : (
                            'Sign In'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  // Original Loading Status
                  <div className="flex items-center justify-center lg:justify-start mb-2">
                    <div className="relative mr-2">
                      {/* Multi-layer Spinner - Green Theme */}
                      <div className="w-8 h-8 border-3 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                      <div className="absolute inset-0 w-8 h-8 border-3 border-transparent border-t-emerald-400/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                      <div className="absolute inset-1 w-5 h-5 border-2 border-transparent border-t-lime-400/70 rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white mb-1">{loadingStatus}</h3>
                      <p className="text-white text-xs font-medium">Enterprise system initialization in progress...</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Progress Section - Only show when not in login mode */}
              {!showLogin && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-white">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">Manufacturing Intelligence Portal</span>
                        <span className="text-xs text-green-300">Step {currentStep + 1} of {steps.length}</span>
                      </div>
                      <span className="font-mono text-base font-bold text-green-400">{Math.round(loadingProgress)}%</span>
                    </div>
                    
                    <div className="relative">
                      <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 via-emerald-400 to-lime-500 rounded-full transition-all duration-100 ease-out relative"
                          style={{ width: `${loadingProgress}%` }}
                        >
                          {/* Animated Shimmer */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
                          {/* Glow Effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-green-400/60 to-emerald-400/60 blur-sm" />
                        </div>
                      </div>
                      
                      {/* Progress Glow Trail */}
                      <div className="absolute top-0 left-0 h-2 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-full animate-pulse" style={{ width: `${loadingProgress}%` }} />
                    </div>
                  </div>
                  
                  {/* Loading Steps - Ultra Compact Design */}
                  <div className="mt-3 space-y-1.5">
                    {steps.map((step, index) => (
                      <div 
                        key={index}
                        className={`group relative overflow-hidden rounded-lg border transition-all duration-500 ${
                          index < currentStep 
                            ? 'bg-gradient-to-r from-green-500/15 to-emerald-500/15 border-green-400/30' 
                            : index === currentStep 
                            ? 'bg-gradient-to-r from-blue-500/15 to-cyan-500/15 border-blue-400/30' 
                            : 'bg-gradient-to-r from-slate-700/20 to-slate-600/20 border-slate-600/20'
                        }`}
                      >
                        <div className="relative flex items-center space-x-2 p-1.5">
                          {/* Status Icon */}
                          <div className={`relative w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${
                            index < currentStep 
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                              : index === currentStep 
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse' 
                              : 'bg-gradient-to-r from-slate-600 to-slate-700'
                          }`}>
                            {index < currentStep ? (
                              <CheckCircle className="w-2.5 h-2.5 text-white" />
                            ) : index === currentStep ? (
                              <Activity className="w-2.5 h-2.5 text-white animate-spin" />
                            ) : (
                              <Clock className="w-2.5 h-2.5 text-slate-400" />
                            )}
                          </div>
                          
                          {/* Step Text */}
                          <div className="flex-1">
                            <span className={`text-xs font-medium transition-colors duration-300 ${
                              index <= currentStep ? 'text-white' : 'text-slate-300'
                            }`}>
                              {step}
                            </span>
                          </div>
                          
                          {/* Status Badge */}
                          <div className={`px-1 py-0.5 rounded text-xs font-medium ${
                            index < currentStep 
                              ? 'bg-green-500/20 text-green-300' 
                              : index === currentStep 
                              ? 'bg-blue-500/20 text-blue-300' 
                              : 'bg-slate-600/20 text-slate-400'
                          }`}>
                            {index < currentStep ? '✓' : index === currentStep ? '●' : '○'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

              
              {/* System Status Dashboard - Integrated into main card */}
              <div className="grid grid-cols-3 gap-2">
                {/* G: Drive Status */}
                <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-800/40 to-slate-700/40 border border-slate-600/20 p-2 hover:border-green-400/50 transition-all duration-300 h-16 flex flex-col justify-center">
                  <div className="relative">
                    <div className="w-5 h-5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-md flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform duration-300">
                      <Database className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-white text-xs font-semibold text-center mb-1">G: Drive</p>
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mx-auto animate-pulse" />
                  </div>
                </div>
                
                {/* MISys ERP Status */}
                <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-800/40 to-slate-700/40 border border-slate-600/20 p-2 hover:border-blue-400/50 transition-all duration-300 h-16 flex flex-col justify-center">
                  <div className="relative">
                    <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-md flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform duration-300">
                      <BarChart3 className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-white text-xs font-semibold text-center mb-1">MISys ERP</p>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mx-auto animate-pulse" />
                  </div>
                </div>
                
                {/* AI Engine Status */}
                <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-800/40 to-slate-700/40 border border-slate-600/20 p-2 hover:border-purple-400/50 transition-all duration-300 h-16 flex flex-col justify-center">
                  <div className="relative">
                    <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-md flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform duration-300">
                      <Cpu className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-white text-xs font-semibold text-center mb-1">AI Engine</p>
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mx-auto animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Animated Border Accent - Canoil Green Theme */}
      <div className="absolute inset-0 border-2 border-gradient-to-r from-green-500/20 via-transparent to-emerald-500/20 rounded-lg pointer-events-none" />
      
            {/* Custom CSS for advanced animations */}
            <style>{`
              @keyframes geometricMove {
                0% { transform: translate(0, 0); }
                100% { transform: translate(80px, 80px); }
              }

              @keyframes oilDropMove {
                0% { transform: translate(0, 0) rotate(0deg); }
                100% { transform: translate(100px, 100px) rotate(360deg); }
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

              .animate-pulse {
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }

              /* Responsive border utilities */
              .border-3 {
                border-width: 3px;
              }

              /* Ensure proper scaling on all screen sizes */
              @media (max-width: 640px) {
                .text-3xl { font-size: 1.875rem; }
                .text-4xl { font-size: 2.25rem; }
              }
            `}</style>
    </div>
  );
};

export default UltimateEnterpriseLoadingScreen;