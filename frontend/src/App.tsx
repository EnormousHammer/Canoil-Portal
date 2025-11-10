import React, { useState, useEffect } from 'react';
import { RevolutionaryCanoilHub } from './components/RevolutionaryCanoilHub';
import { GDriveDataLoader } from './services/GDriveDataLoader';
import { getApiUrl } from './utils/apiConfig';
import './App.css';
import { UltimateEnterpriseLoadingScreen } from './components/UltimateEnterpriseLoadingScreen';

function App() {
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; isAdmin: boolean } | null>(null);
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing Canoil Portal...');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Premium image carousel with the 5 provided images
  const images = [
    '/image_1.png',
    '/image_2.png', 
    '/image_3.png',
    '/image_4.png',
    '/image_5.png'
  ];

  // Program hints and features
  const programHints = [
    {
      title: "Real-Time Manufacturing Intelligence",
      description: "Monitor your production pipeline with live data from MISys ERP system"
    },
    {
      title: "Customer & Vendor Analytics", 
      description: "Track top customers by revenue and manage vendor relationships with detailed insights"
    },
    {
      title: "Advanced Inventory Management",
      description: "Enhanced inventory tracking with BOMs, stock levels, and automated reorder points"
    },
    {
      title: "Interactive Data Explorer",
      description: "Drill down into any record - click items, orders, or customers for detailed information"
    },
    {
      title: "Manufacturing Order Tracking",
      description: "Complete visibility into your production workflow from pending to closed orders"
    },
    {
      title: "Bill of Materials Integration",
      description: "Full BOM hierarchy visualization with component tracking and cost analysis"
    },
    {
      title: "Purchase Order Management",
      description: "Streamlined PO processing with vendor performance tracking and cost optimization"
    },
    {
      title: "Enterprise Security & Compliance",
      description: "Secure data access with role-based permissions and audit trail capabilities"
    }
  ];
  
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
  
  const [isLoading, setIsLoading] = useState(false); // Start with false - only show loading after login
  const [showLoadingScreen, setShowLoadingScreen] = useState(false); // Start with false - only show after login
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

  // Handle login
  const handleLogin = (user: { name: string; email: string; isAdmin: boolean }) => {
    console.log("🔐 User logged in:", user);
    setCurrentUser(user);
    setIsLoggedIn(true);
    
    // Start loading data after successful login
    setIsLoading(true);
    setShowLoadingScreen(true);
    
    // Start loading data after a brief delay to ensure UI is ready
    setTimeout(() => {
      const gdriveLoader = GDriveDataLoader.getInstance();
      loadAllData(gdriveLoader);
    }, 100);
  };

  // Only start loading when user is logged in
  useEffect(() => {
    if (isLoggedIn) {
      console.log("🚀 User logged in - starting data loading");
      
      // Minimum 10 second loading time - but wait for data to actually load
      const minLoadingTimeout = setTimeout(() => {
        console.log("✅ Minimum 10 seconds complete - checking if data loaded");
        if (dataLoaded) {
          console.log("✅ Data loaded - launching app");
          setIsLoading(false);
          setShowLoadingScreen(false);
        } else {
          console.log("⏳ Data still loading - waiting...");
        }
      }, 10000); // Minimum 10 seconds
      
      return () => {
        clearTimeout(minLoadingTimeout);
      };
    }
  }, [isLoggedIn, dataLoaded]);

  // Hide loading screen when data is actually loaded
  useEffect(() => {
    if (dataLoaded) {
      console.log("✅ Data loaded - hiding loading screen");
      setIsLoading(false);
      setShowLoadingScreen(false);
    }
  }, [dataLoaded]);

  // Image carousel effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [images.length]);

  // Progress simulation - exactly 10 seconds to 100%
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 10; // 10% per second for exactly 10 seconds
      });
    }, 1000); // Update every 1 second for 10-second progress
    return () => clearInterval(progressInterval);
  }, []); // No dependencies - runs independently

  // Simple effect to hide loading when data is ready
  useEffect(() => {
    if (dataLoaded) {
      // Show completion for exactly 10 seconds total loading time
      setTimeout(() => {
        setIsLoading(false);
        setShowLoadingScreen(false);
      }, 7000); // 7 seconds to show completion (total 10 seconds)
    }
  }, [dataLoaded]);

  // Auto-sync: Check for new sales orders every 2 minutes
  useEffect(() => {
    if (!dataLoaded || !isLoggedIn) return;
    
    console.log('🔄 Starting auto-sync for Sales Orders (every 2 minutes)');
    
    // Check every 2 minutes (120000ms)
    const syncInterval = setInterval(() => {
      console.log('🔍 Checking for new sales orders...');
      checkForNewSalesOrders();
    }, 120000); // 2 minutes
    
    return () => {
      console.log('🛑 Stopping auto-sync');
      clearInterval(syncInterval);
    };
  }, [dataLoaded, isLoggedIn, lastSalesOrderCount]);
  
  // Health monitoring: Check system health every 30 seconds
  useEffect(() => {
    if (!dataLoaded || !isLoggedIn) return;
    
    const checkHealth = async () => {
      try {
        const response = await fetch(getApiUrl('/api/health'));
        const health = await response.json();
        setSystemHealth(health);
        
        // Show warning if system has issues
        if (health.issues && health.issues.length > 0) {
          setShowHealthWarning(true);
          console.warn('🚨 System health issues detected:', health.issues);
        } else {
          setShowHealthWarning(false);
        }
      } catch (error) {
        console.error('❌ Error checking system health:', error);
        setShowHealthWarning(true);
      }
    };
    
    // Check immediately
    checkHealth();
    
    // Check every 30 seconds
    const healthInterval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(healthInterval);
  }, [dataLoaded, isLoggedIn]);

  // Function to check for new sales orders without full reload
  const checkForNewSalesOrders = async () => {
    try {
      const gdriveLoader = GDriveDataLoader.getInstance();
      const result = await gdriveLoader.loadAllData();
      const newSOCount = (result.data['SalesOrderHeaders.json'] || []).length;
      
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
      const mpsData = await fetch(mpsUrl)
        .then(response => {
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
          console.error('⚠️ Error loading MPS data on refresh:', {
            error: error.message,
            url: mpsUrl,
            hint: mpsUrl.includes('localhost') && import.meta.env.PROD 
              ? '⚠️ CRITICAL: Using localhost in production! Set VITE_API_URL in Vercel environment variables.' 
              : 'Check if backend server is running and accessible.'
          });
          return { mps_orders: [], summary: { total_orders: 0 } };
        });
      
      setData({
        ...result.data,
        'MPS.json': mpsData,
        loaded: true
      });
      
      const newSOCount = (result.data['SalesOrderHeaders.json'] || []).length;
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
    // Show loading screen immediately - don't wait for backend
    setIsLoading(true);
    setShowLoadingScreen(true);
    setDataSource('checking');
    setError(null);
    
    // Start with immediate status updates - exactly 10 seconds total
    setLoadingStatus('Initializing Canoil Portal...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setLoadingStatus('Connecting to G: Drive...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Non-blocking G: Drive check
      const gdriveReady = await gdriveLoader.checkGDriveAccessAsync();
      setDataSource(gdriveReady ? 'gdrive' : 'checking');
      
      setLoadingStatus('Initializing manufacturing systems...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setLoadingStatus('Loading manufacturing data...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced time since we're loading in parallel
      
      setLoadingStatus('Loading production schedule data...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setLoadingStatus('Processing data...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setLoadingStatus('Configuring systems...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setLoadingStatus('Finalizing setup...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setLoadingStatus('Almost ready...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setLoadingStatus('Launching application...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Load actual data from G: Drive
      let result;
      try {
        result = await gdriveLoader.loadAllData();
        console.log('✅ Data loaded successfully from G: Drive');
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
      
      // Load MPS data from backend API in parallel with G: Drive data
      const mpsUrl = getApiUrl('/api/mps');
      console.log('📊 Loading MPS data from:', {
        url: mpsUrl,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        isProduction: import.meta.env.PROD
      });
      const mpsPromise = fetch(mpsUrl)
        .then(response => {
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
          console.error('⚠️ Error loading MPS data:', {
            error: error.message,
            url: mpsUrl,
            stack: error.stack,
            hint: mpsUrl.includes('localhost') && import.meta.env.PROD 
              ? '⚠️ CRITICAL: Using localhost in production! Set VITE_API_URL in Vercel environment variables.' 
              : 'Check if backend server is running and accessible.'
          });
          return { mps_orders: [], summary: { total_orders: 0 } };
        });

      // Wait for both G: Drive and MPS data to load
      const [gdriveResult, mpsData] = await Promise.all([
        Promise.resolve(gdriveData),
        mpsPromise
      ]);

      console.log('✅ MPS data loaded successfully:', mpsData);
      console.log('📊 MPS Orders Count:', mpsData.mps_orders?.length || 0);

      // Use G: Drive data AS-IS - no conversion needed!
      setData({
        ...gdriveResult,
        'MPS.json': mpsData, // Add MPS data to the main data object
        loaded: true
      });
      
      // Track initial SO count for auto-sync
      const initialSOCount = (gdriveResult['SalesOrderHeaders.json'] || []).length;
      setLastSalesOrderCount(initialSOCount);
      console.log(`📊 Initial Sales Orders loaded: ${initialSOCount}`);
      
      setSyncInfo({
        folderName: result.folderInfo.folderName,
        syncDate: result.folderInfo.syncDate,
        lastModified: result.folderInfo.lastModified,
        folder: result.folderInfo.folder,
        created: result.folderInfo.created,
        size: result.folderInfo.size,
        fileCount: result.folderInfo.fileCount
      });
      
      // Mark data as loaded - transition will happen when countdown also finishes
      setLoadingStatus('Initialization complete!');
      setDataLoaded(true);
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setError({
        title: 'Data Loading Error',
        message: 'Failed to load data from G: Drive',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      setDataSource('error');
      setIsLoading(false);
    }
  };

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

  console.log(`🔍 Render check: isLoggedIn=${isLoggedIn}, isLoading=${isLoading}, showLoadingScreen=${showLoadingScreen}`);
  
  // Show loading screen with login if not logged in, or normal loading if logged in
  if (!isLoggedIn || isLoading || showLoadingScreen) {
    console.log("✅ Rendering ultra-premium loading screen");
    return (
      <UltimateEnterpriseLoadingScreen
        loadingStatus={loadingStatus}
        dataLoaded={dataLoaded}
        progress={loadingProgress}
        showLogin={!isLoggedIn}
        onUserLogin={handleLogin}
        onComplete={() => {
          console.log("🎉 Loading screen completed");
          setShowLoadingScreen(false);
        }}
      />
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
