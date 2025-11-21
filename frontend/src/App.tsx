import React, { useState, useEffect } from 'react';
import { RevolutionaryCanoilHub } from './components/RevolutionaryCanoilHub';
import { GDriveDataLoader } from './services/GDriveDataLoader';
import { getApiUrl } from './utils/apiConfig';
import './App.css';

function App() {
  // Auto-login (no login required) - ALWAYS ADMIN
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; isAdmin: boolean }>({
    name: 'Admin User',
    email: 'admin@canoilcanadaltd.com',
    isAdmin: true // ALWAYS ADMIN
  });
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Initializing Canoil Portal...');
  
  // Start with empty data structure - EXACT G: Drive .json file names
  const [data, setData] = useState<any>({
    // EXACT file names from G: Drive - ALL 34+ files
    'CustomAlert5.json': [],  // PRIMARY: Complete item data
    'Items.json': [],
    'MIITEM.json': [],
    'BillsOfMaterial.json': [],
    'BillOfMaterialDetails.json': [],
    'MIBOMH.json': [],
    'MIBOMD.json': [],
    'ManufacturingOrderHeaders.json': [],
    'ManufacturingOrderDetails.json': [],
    'ManufacturingOrderRoutings.json': [],
    'MIMOH.json': [],
    'MIMOMD.json': [],
    'MIMORD.json': [],
    'Jobs.json': [],
    'JobDetails.json': [],
    'MIJOBH.json': [],
    'MIJOBD.json': [],
    'MIPOH.json': [],
    'MIPOD.json': [],
    'MIPOHX.json': [],
    'MIPOC.json': [],
    'MIPOCV.json': [],
    'MIPODC.json': [],
    'MIWOH.json': [],
    'MIWOD.json': [],
    'MIBORD.json': [],
    'PurchaseOrderDetails.json': [],
    'PurchaseOrderExtensions.json': [],
    'PurchaseOrders.json': [],
    'WorkOrders.json': [],
    'WorkOrderDetails.json': [],
    'SalesOrderHeaders.json': [],
    'SalesOrderDetails.json': [],
    'PurchaseOrderAdditionalCosts.json': [],
    'PurchaseOrderAdditionalCostsTaxes.json': [],
    'PurchaseOrderDetailAdditionalCosts.json': [],
    loaded: false
  });
  
  const [dataSource, setDataSource] = useState('checking');
  const [syncInfo, setSyncInfo] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  
  // Auto-sync state
  const [lastSalesOrderCount, setLastSalesOrderCount] = useState(0);
  const [showSyncNotification, setShowSyncNotification] = useState(false);
  const [newSOsAvailable, setNewSOsAvailable] = useState(0);
  
  // System health monitoring
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [showHealthWarning, setShowHealthWarning] = useState(false);

  // Start loading data IMMEDIATELY when app opens (don't wait for anything)
  useEffect(() => {
    console.log("🚀 App opened - starting data load IMMEDIATELY");
    const gdriveLoader = GDriveDataLoader.getInstance();
    loadAllData(gdriveLoader).catch((error) => {
      console.error('❌ Error loading data:', error);
    });
    // Only run once on mount - don't depend on dataLoaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array = run immediately on mount

  // Premium 20-second loading screen with progress
  useEffect(() => {
    if (showLoadingScreen) {
      const startTime = Date.now();
      const duration = 20000; // 20 seconds
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setLoadingProgress(progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          // Hide loading screen after 20 seconds (or when data is loaded, whichever comes first)
          setTimeout(() => {
            setShowLoadingScreen(false);
          }, 500);
        }
      }, 50); // Update every 50ms for smooth animation
      
      return () => clearInterval(interval);
    }
  }, [showLoadingScreen]);

  // Hide loading screen when data is loaded (if before 20 seconds)
  useEffect(() => {
    if (dataLoaded && showLoadingScreen) {
      // Wait a moment to ensure smooth transition
      setTimeout(() => {
        setShowLoadingScreen(false);
      }, 500);
    }
  }, [dataLoaded, showLoadingScreen]);

  // Auto-sync: DISABLED - Data is a snapshot from MiSys exports, not live
  // User can manually click "Sync Now" if needed
  useEffect(() => {
    // Auto-sync disabled for snapshot-based data
    // Only syncs on user request via "Sync Now" button
    return () => {};
  }, [dataLoaded, isLoggedIn, lastSalesOrderCount]);
  
  // Health monitoring: DISABLED - Not needed for static snapshot data
  // Check health only on initial load
  useEffect(() => {
    if (!dataLoaded || !isLoggedIn) return;
    
    const checkHealth = async () => {
      try {
        const response = await fetch(getApiUrl('/api/health'));
        const health = await response.json();
        setSystemHealth(health);
        
        if (health.issues && health.issues.length > 0) {
          setShowHealthWarning(true);
        }
      } catch (error) {
        console.error('❌ Error checking system health:', error);
      }
    };
    
    // Check once on load only
    checkHealth();
  }, [dataLoaded, isLoggedIn]);

  // Function to check for new sales orders without full reload
  const checkForNewSalesOrders = async () => {
    try {
      const gdriveLoader = GDriveDataLoader.getInstance();
      const result = await gdriveLoader.loadAllData();
      // Sales Orders ONLY from PDF scanning (SalesOrders.json), NOT from MiSys
      const newSOCount = (result.data['SalesOrders.json'] || []).length;
      
      if (newSOCount > lastSalesOrderCount && lastSalesOrderCount > 0) {
        // New SOs detected!
        const newCount = newSOCount - lastSalesOrderCount;
        setNewSOsAvailable(newCount);
        setShowSyncNotification(true);
        console.log(`📬 ${newCount} new sales order(s) detected!`);
      }
      
      return newSOCount;
    } catch (error) {
      console.error('❌ Error checking for new SOs:', error);
      return lastSalesOrderCount;
    }
  };

  // Function to refresh/sync data
  const handleRefreshData = async () => {
    console.log('🔄 Refreshing data...');
    setShowSyncNotification(false);
    const gdriveLoader = GDriveDataLoader.getInstance();
    
    try {
      const result = await gdriveLoader.loadAllData();
      const mpsUrl = getApiUrl('/api/mps');
      
      // Add 300 second timeout to match Cloud Run configuration
      const refreshMpsController = new AbortController();
      const refreshMpsTimeoutId = setTimeout(() => refreshMpsController.abort(), 300000);
      
      const mpsData = await fetch(mpsUrl, { signal: refreshMpsController.signal })
        .then(response => {
          clearTimeout(refreshMpsTimeoutId);
          if (response.ok) {
            return response.json();
          } else {
            console.error('⚠️ Failed to load MPS data on refresh:', {
              status: response.status,
              url: mpsUrl,
              hint: mpsUrl.includes('localhost') && import.meta.env.PROD 
                ? '⚠️ Using localhost - check VITE_API_URL environment variable' 
                : ''
            });
            return { mps_orders: [], summary: { total_orders: 0 } };
          }
        })
        .catch(error => {
          clearTimeout(refreshMpsTimeoutId);
          if (error.name === 'AbortError') {
            console.error('⚠️ MPS data refresh timeout after 300 seconds:', {
              url: mpsUrl,
              hint: '⚠️ Backend may be sleeping or down.'
            });
          } else {
            console.error('⚠️ Error loading MPS data on refresh:', {
              error: error.message,
              url: mpsUrl,
              hint: mpsUrl.includes('localhost') && import.meta.env.PROD 
                ? '⚠️ CRITICAL: Using localhost in production! Set VITE_API_URL in Vercel environment variables.' 
                : 'Check if backend server is running and accessible.'
            });
          }
          return { mps_orders: [], summary: { total_orders: 0 } };
        });
      
      setData({
        ...result.data,
        'MPS.json': mpsData,
        loaded: true
      });
      
      // Sales Orders ONLY from PDF scanning (SalesOrders.json), NOT from MiSys
      const newSOCount = (result.data['SalesOrders.json'] || []).length;
      setLastSalesOrderCount(newSOCount);
      setNewSOsAvailable(0);
      
      setSyncInfo({
        folderName: result.folderInfo.folderName,
        syncDate: result.folderInfo.syncDate,
        lastModified: result.folderInfo.lastModified,
        folder: result.folderInfo.folder,
        created: result.folderInfo.created,
        size: result.folderInfo.size,
        fileCount: result.folderInfo.fileCount
      });
      
      console.log('✅ Data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    }
  };

  const loadAllData = async (gdriveLoader: GDriveDataLoader) => {
    setDataSource('checking');
    setError(null);
    
    try {
      setLoadingStatus('Connecting to backend...');
      
      // OPTIMIZATION: Start backend connection and MPS load immediately in parallel
      // Don't wait for G: Drive check - start backend requests right away
      const mpsUrl = getApiUrl('/api/mps');
      console.log('📊 Starting MPS data load in parallel:', {
        url: mpsUrl,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        isProduction: import.meta.env.PROD
      });
      
      // Start MPS load immediately (non-blocking)
      const mpsController = new AbortController();
      const mpsTimeoutId = setTimeout(() => mpsController.abort(), 300000);
      const mpsPromise = fetch(mpsUrl, { signal: mpsController.signal })
        .then(response => {
          clearTimeout(mpsTimeoutId);
          if (response.ok) {
            return response.json();
          } else {
            console.error('⚠️ Failed to load MPS data:', {
              status: response.status,
              statusText: response.statusText,
              url: mpsUrl,
              hint: mpsUrl.includes('localhost') && import.meta.env.PROD 
                ? '⚠️ Using localhost - check VITE_API_URL environment variable' 
                : ''
            });
            return { mps_orders: [], summary: { total_orders: 0 } };
          }
        })
        .catch(error => {
          clearTimeout(mpsTimeoutId);
          if (error.name === 'AbortError') {
            console.error('⚠️ MPS data request timeout after 300 seconds:', {
              url: mpsUrl,
              hint: '⚠️ Backend may be sleeping (Render.com free tier) or down.'
            });
          } else {
            console.error('⚠️ Error loading MPS data:', {
              error: error.message,
              url: mpsUrl,
              stack: error.stack,
              hint: mpsUrl.includes('localhost') && import.meta.env.PROD 
                ? '⚠️ CRITICAL: Using localhost in production! Set VITE_API_URL in Vercel environment variables.' 
                : 'Check if backend server is running and accessible.'
            });
          }
          return { mps_orders: [], summary: { total_orders: 0 } };
        });
      
      // Non-blocking G: Drive check (runs in parallel with backend connection)
      const gdriveCheckPromise = gdriveLoader.checkGDriveAccessAsync();
      
      setLoadingStatus('Loading data from backend...');
      // Load actual data from G: Drive (this now loads Sales Orders in parallel internally)
      let result;
      try {
        result = await gdriveLoader.loadAllData();
        console.log('✅ Data loaded successfully from G: Drive');
        setLoadingStatus('Data loaded! Finalizing...');
      } catch (error) {
        // GDriveDataLoader now returns empty structure instead of throwing for connection errors
        console.warn('⚠️ Error loading data, retrying...', error);
        // Retry once more
        try {
          result = await gdriveLoader.loadAllData();
          console.log('✅ Data loaded successfully on retry');
        } catch (retryError) {
          console.warn('⚠️ Failed to load data after retry, using empty data structure');
          result = { 
            data: {
              'CustomAlert5.json': [],
              'SalesOrderHeaders.json': [],
              'ManufacturingOrderHeaders.json': [],
              'PurchaseOrders.json': []
            }, 
            folderInfo: { folderName: 'Backend Not Connected', syncDate: new Date().toISOString() } 
          };
        }
      }
      const gdriveData = result.data;
      
      // Update data source based on G: Drive check (non-blocking)
      gdriveCheckPromise.then(gdriveReady => {
        setDataSource(gdriveReady ? 'gdrive' : 'checking');
      });
      
      // Wait for MPS data (already started in parallel)
      const mpsData = await mpsPromise;
      const gdriveResult = gdriveData;

      console.log('✅ MPS data loaded successfully:', mpsData);
      console.log('📊 MPS Orders Count:', mpsData.mps_orders?.length || 0);

      setLoadingStatus('Finalizing data...');
      // Use G: Drive data AS-IS - no conversion needed!
      setData({
        ...gdriveResult,
        'MPS.json': mpsData, // Add MPS data to the main data object
        loaded: true
      });
      
      setLoadingStatus('✅ All data loaded successfully!');
      
      // Track initial SO count for auto-sync - ONLY from PDF scanning (SalesOrders.json)
      // Sales Orders come from PDF files in Sales_CSR drive, NOT from MiSys data
      const initialSOCount = (gdriveResult['SalesOrders.json'] || []).length;
      setLastSalesOrderCount(initialSOCount);
      console.log(`📊 Initial Sales Orders loaded: ${initialSOCount} (from PDF scanning)`);
      
      setSyncInfo({
        folderName: result.folderInfo.folderName,
        syncDate: result.folderInfo.syncDate,
        lastModified: result.folderInfo.lastModified,
        folder: result.folderInfo.folder,
        created: result.folderInfo.created,
        size: result.folderInfo.size,
        fileCount: result.folderInfo.fileCount
      });
      
      // Mark data as loaded
      setDataLoaded(true);
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setError({
        title: 'Data Loading Error',
        message: 'Failed to load data from G: Drive',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      setDataSource('error');
    }
  };

  // Premium 20-second loading screen with real-time status
  if (showLoadingScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 relative overflow-hidden">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center max-w-2xl mx-auto px-8">
            {/* Logo */}
            <div className="mb-8 animate-fade-in">
              <img 
                src="/Canoil_logo.png" 
                alt="Canoil Canada Ltd." 
                className="h-24 w-auto mx-auto drop-shadow-2xl animate-pulse"
              />
            </div>
            
            {/* Title */}
            <h1 className="text-5xl font-black text-white mb-4 animate-fade-in">
              Canoil Portal
            </h1>
            <p className="text-xl text-green-200 mb-12 animate-fade-in">
              Enterprise Manufacturing Intelligence
            </p>
            
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden shadow-lg">
                <div 
                  className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 h-full rounded-full transition-all duration-300 ease-out shadow-lg"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-white/80 text-sm mt-3 font-medium">
                {Math.round(loadingProgress)}% • {loadingStatus}
              </p>
            </div>
            
            {/* Loading Steps */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              {[
                { label: 'Systems', icon: '⚙️', active: loadingProgress > 15 },
                { label: 'Data', icon: '📊', active: loadingProgress > 50 },
                { label: 'Ready', icon: '✅', active: loadingProgress > 90 }
              ].map((step, i) => (
                <div 
                  key={i}
                  className={`p-4 rounded-xl transition-all duration-300 ${
                    step.active 
                      ? 'bg-white/20 backdrop-blur-sm border-2 border-green-400' 
                      : 'bg-white/10 border-2 border-transparent'
                  }`}
                >
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <div className="text-white font-semibold">{step.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.8s ease-out;
          }
        `}</style>
      </div>
    );
  }

  // Show error state when G: drive is not accessible
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center max-w-3xl mx-auto px-8">
            <div className="mb-8">
              <img 
                src="/Canoil_logo.png" 
                alt="Canoil Canada Ltd." 
                className="h-24 w-auto mx-auto drop-shadow-2xl"
              />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">G: Drive Access Required</h1>
            <p className="text-xl text-red-200 mb-6">{error.message}</p>
            <div className="bg-red-800/50 rounded-lg p-4 text-left">
              <p className="text-red-100 text-sm">{error.details}</p>
            </div>
            <button 
              onClick={() => {
                const gdriveLoader = GDriveDataLoader.getInstance();
                loadAllData(gdriveLoader);
              }}
              className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show main application after loading
  return (
    <div className="transition-opacity duration-1000 ease-in">
      {/* System Health Warning Banner */}
      {showHealthWarning && systemHealth && systemHealth.issues && systemHealth.issues.length > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999]">
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-red-400 flex items-center gap-4 max-w-2xl">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">⚠️ System Issues Detected</h3>
              <ul className="text-sm text-red-100 mt-1">
                {systemHealth.issues.map((issue: string, idx: number) => (
                  <li key={idx}>• {issue}</li>
                ))}
              </ul>
              {!systemHealth.gdrive_accessible && (
                <p className="text-xs text-red-200 mt-2">
                  💡 Tip: Check if G: Drive is mounted
                </p>
              )}
              {!systemHealth.openai_available && (
                <p className="text-xs text-red-200 mt-2">
                  💡 Tip: Check OPENAI_API_KEY environment variable
                </p>
              )}
            </div>
            <button 
              onClick={() => setShowHealthWarning(false)}
              className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Empty Data Warning Banner */}
      {dataLoaded && data && Object.keys(data).length > 0 && (() => {
        const hasData = Object.values(data).some((v: any) => 
          Array.isArray(v) && v.length > 0
        );
        return !hasData ? (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9998]">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-yellow-400 flex items-center gap-4 max-w-2xl">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">📭 No Data Loaded</h3>
                <p className="text-sm text-yellow-100">
                  Backend returned empty data. Check console logs and system health.
                </p>
              </div>
              <button 
                onClick={handleRefreshData}
                className="flex-shrink-0 bg-white text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-yellow-50 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null;
      })()}
      
      {/* Sync Notification Banner */}
      {showSyncNotification && newSOsAvailable > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] animate-bounce">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-blue-400 flex items-center gap-4 max-w-md">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">📬 New Sales Orders Available!</h3>
              <p className="text-sm text-blue-100">
                {newSOsAvailable} new order{newSOsAvailable > 1 ? 's' : ''} detected. Click to refresh.
              </p>
            </div>
            <button 
              onClick={handleRefreshData}
              className="flex-shrink-0 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors"
            >
              Refresh Now
            </button>
            <button 
              onClick={() => setShowSyncNotification(false)}
              className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <RevolutionaryCanoilHub 
        data={data} 
        dataSource={dataSource} 
        syncInfo={syncInfo}
        currentUser={currentUser}
        onRefreshData={handleRefreshData}
        />
      </div>
    );
}

export default App;
