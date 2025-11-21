// Google Drive Data Loader for MISys Data
// Updated to handle ONLY the exact .json file names from G: Drive
import { getApiUrl, checkBackendHealth } from '../utils/apiConfig';

export interface LoadedData {
  // PRIMARY: CustomAlert5.json contains ALL item data (stock, price, location)
  // ⚠️ PRODUCTION: Uses EXACT field names validated against live data
  'CustomAlert5.json': any[];
  
  // LEGACY: Other item files (now redundant since CustomAlert5 has everything)
  'Items.json': any[];
  'MIITEM.json': any[];
  'MIILOC.json': any[];  // NEW: Inventory location data with stock quantities
  'BillsOfMaterial.json': any[];
  'BillOfMaterialDetails.json': any[];
  'MIBOMH.json': any[];
  'MIBOMD.json': any[];
  'ManufacturingOrderHeaders.json': any[];
  'ManufacturingOrderDetails.json': any[];
  'ManufacturingOrderRoutings.json': any[];
  'MIMOH.json': any[];
  'MIMOMD.json': any[];
  'MIMORD.json': any[];
  'Jobs.json': any[];
  'JobDetails.json': any[];
  'MIJOBH.json': any[];
  'MIJOBD.json': any[];
  'MIPOH.json': any[];
  'MIPOD.json': any[];
  'MIPOHX.json': any[];
  'MIPOC.json': any[];
  'MIPOCV.json': any[];
  'MIPODC.json': any[];
  'MIWOH.json': any[];
  'MIWOD.json': any[];
  'MIBORD.json': any[];
  'PurchaseOrderDetails.json': any[];
  'PurchaseOrderExtensions.json': any[];
  'PurchaseOrders.json': any[];
  'WorkOrders.json': any[];
  'WorkOrderDetails.json': any[];
  'SalesOrderHeaders.json': any[];
  'SalesOrderDetails.json': any[];
  'PurchaseOrderAdditionalCosts.json': any[];
  'PurchaseOrderAdditionalCostsTaxes.json': any[];
  'PurchaseOrderDetailAdditionalCosts.json': any[];
  loaded: boolean;
  
  // Allow dynamic access for any other .json files
  [key: string]: any[] | boolean;
}

export class GDriveDataLoader {
  private static instance: GDriveDataLoader;
  private loadedData: LoadedData = {
    // Initialize all 35+ G: Drive files as empty arrays
    'CustomAlert5.json': [],  // PRIMARY: Complete item data with stock, price, location
    'Items.json': [],
    'MIITEM.json': [],
    'MIILOC.json': [],  // NEW: Inventory location data with stock quantities
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
  };

  private constructor() {
  }

  public static getInstance(): GDriveDataLoader {
    if (!GDriveDataLoader.instance) {
      GDriveDataLoader.instance = new GDriveDataLoader();
    }
    return GDriveDataLoader.instance;
  }

  public checkGDriveAccess(): boolean {
    return true; // Always return true since backend handles G: Drive access
  }
  
  public async checkGDriveAccessAsync(): Promise<boolean> {
    // Non-blocking G: Drive check
    try {
      return await checkBackendHealth();
    } catch (error) {
      console.log('Backend not ready yet, continuing with loading...');
      return true; // Continue loading even if backend isn't ready
    }
  }

  public getLoadedData(): LoadedData {
    return this.loadedData;
  }

  public async loadAllData(): Promise<{ data: any; folderInfo: any }> {
    try {
      // OPTIMIZATION: Start ALL backend requests in parallel immediately
      const apiUrl = getApiUrl('/api/data');
      const soUrl = getApiUrl('/api/sales-orders');
      
      console.log('📡 Starting parallel data loads from backend:', {
        apiUrl,
        soUrl,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        isProduction: import.meta.env.PROD
      });
      
      // Start all requests in parallel with 300 second timeout
      const controller = new AbortController();
      const soController = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      const soTimeoutId = setTimeout(() => soController.abort(), 300000);
      
      // Parallel fetch for main data and Sales Orders
      const [mainDataPromise, salesOrdersPromise] = await Promise.allSettled([
        fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }),
        fetch(soUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          signal: soController.signal
        })
      ]);
      
      clearTimeout(timeoutId);
      clearTimeout(soTimeoutId);
      
      // Process main data response
      let result: any;
      if (mainDataPromise.status === 'fulfilled' && mainDataPromise.value.ok) {
        const contentType = mainDataPromise.value.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await mainDataPromise.value.text();
          console.error('❌ Non-JSON response received:', {
            contentType,
            url: apiUrl,
            responsePreview: responseText.substring(0, 200)
          });
          throw new Error(`Expected JSON, got ${contentType}. Response: ${responseText.substring(0, 100)}`);
        }
        
        result = await mainDataPromise.value.json();
        console.log('✅ Main data loaded from backend:', {
          url: apiUrl,
          fileCount: Object.keys(result.data || {}).length,
          hasData: !!result.data
        });
        
        // Update loaded data with ALL files from backend
        if (result.data) {
          // Clear existing data
          Object.keys(this.loadedData).forEach(key => {
            if (key !== 'loaded') {
              this.loadedData[key] = [];
            }
          });
          
          // Load ALL files from backend response
          Object.keys(result.data).forEach(fileName => {
            if (fileName.endsWith('.json')) {
              this.loadedData[fileName] = result.data[fileName] || [];
            }
          });
          
          this.loadedData.loaded = true;
        }
      } else {
        const errorText = mainDataPromise.status === 'fulfilled' 
          ? await mainDataPromise.value.text() 
          : mainDataPromise.reason?.message || 'Unknown error';
        console.error('❌ Flask API error response:', {
          status: mainDataPromise.status === 'fulfilled' ? mainDataPromise.value.status : 'failed',
          url: apiUrl,
          error: errorText,
          hint: apiUrl.includes('localhost') ? '⚠️ Using localhost - check VITE_API_URL environment variable' : ''
        });
        throw new Error(`Flask API error: ${errorText}`);
      }
      
      // Process Sales Orders response (loads in parallel)
      console.log('📦 Processing ACTIVE Sales Orders (loaded in parallel)...');
      if (salesOrdersPromise.status === 'fulfilled' && salesOrdersPromise.value.ok) {
        try {
          const soData = await salesOrdersPromise.value.json();
          // Merge Sales Orders data into main data
          result.data['SalesOrders.json'] = soData['SalesOrders.json'] || [];
          result.data['SalesOrdersByStatus'] = soData['SalesOrdersByStatus'] || {};
          result.data['TotalOrders'] = soData['TotalOrders'] || 0;
          this.loadedData['SalesOrders.json'] = soData['SalesOrders.json'] || [];
          this.loadedData['SalesOrdersByStatus'] = soData['SalesOrdersByStatus'] || {};
          this.loadedData['TotalOrders'] = soData['TotalOrders'] || 0;
          console.log(`✅ Loaded ${soData['TotalOrders'] || 0} ACTIVE Sales Orders (In Production, New and Revised)`);
          console.log('   Historical orders (Cancelled, Completed) available via /api/sales-orders/historical');
        } catch (soError: any) {
          console.warn('⚠️ Sales Orders parsing failed:', soError.message);
          result.data['SalesOrders.json'] = [];
          result.data['SalesOrdersByStatus'] = {};
          result.data['TotalOrders'] = 0;
        }
      } else {
        console.warn('⚠️ Could not load Sales Orders, continuing without them');
        result.data['SalesOrders.json'] = [];
        result.data['SalesOrdersByStatus'] = {};
        result.data['TotalOrders'] = 0;
      }
      
      // Flask returns the exact structure we need
      return {
        data: result.data,
        folderInfo: result.folderInfo
      };
    } catch (error) {
      console.error('❌ Error loading G: Drive data via Flask:', error);
      
      // If connection refused, return empty data structure instead of throwing
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const apiUrl = getApiUrl('/api/data');
        console.warn('⚠️ Backend not accessible - returning empty data structure', {
          url: apiUrl,
          error: error instanceof Error ? error.message : String(error),
          hint: apiUrl.includes('localhost') && import.meta.env.PROD 
            ? '⚠️ CRITICAL: Using localhost in production! Set VITE_API_URL in Vercel environment variables.' 
            : 'Check if backend server is running and accessible.'
        });
        return {
          data: {
            // Return empty structure matching expected format
            'CustomAlert5.json': [],
            'Items.json': [],
            'MIITEM.json': [],
            'MIILOC.json': [],
            'SalesOrderHeaders.json': [],
            'SalesOrderDetails.json': [],
            'ManufacturingOrderHeaders.json': [],
            'ManufacturingOrderDetails.json': [],
            'PurchaseOrders.json': [],
            'PurchaseOrderDetails.json': [],
            'BillsOfMaterial.json': [],
            'BillOfMaterialDetails.json': []
          },
          folderInfo: {
            folderName: 'Backend Not Accessible',
            syncDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            folder: 'Not Connected',
            created: new Date().toISOString(),
            size: '0',
            fileCount: 0
          }
        };
      }
      
      // For other errors, still throw
      throw error;
    }
  }

  public async loadFromLocalTestData(): Promise<{ data: LoadedData; folderInfo: any }> {
    throw new Error('Local test data disabled - use G: Drive data only');
  }
}
