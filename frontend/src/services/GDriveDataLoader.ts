// Google Drive Data Loader for MISys Data
// Updated to handle ONLY the exact .json file names from G: Drive
import { getApiUrl, checkBackendHealth } from '../utils/apiConfig';

export interface LoadedData {
  // PRIMARY: Items.json (Full Company Data from MIITEM.CSV) - single source for item data
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
    'Items.json': [],  // Full Company Data: item master from MIITEM.CSV
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

  /** Fetch data source status (Full Company Data available/ready). */
  public async getDataSourceStatus(): Promise<{
    currentSource: string;
    fullCompanyDataPath?: string;
    fullCompanyDataAvailable?: boolean;
    fullCompanyDataReady?: boolean;
    message?: string;
  }> {
    try {
      const url = getApiUrl('/api/data-source');
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) return { currentSource: 'default', fullCompanyDataReady: false };
      return await res.json();
    } catch {
      return { currentSource: 'default', fullCompanyDataReady: false };
    }
  }

  public async loadAllData(options?: { source?: 'default' | 'full_company_data' | 'live_sql' }): Promise<{ data: any; folderInfo: any; source?: string; fullCompanyDataReady?: boolean }> {
    const source = options?.source ?? 'default';
    try {
      // For live_sql: call the bridge directly to avoid loading 250MB through Render's memory.
      // Render just tells us the bridge URL via /api/live-sql-url, then we fetch directly.
      if (source === 'live_sql') {
        console.log('⚡ Live SQL: fetching bridge URL from Render...');
        const urlRes = await fetch(getApiUrl('/api/live-sql-url'), { method: 'GET' });
        if (!urlRes.ok) throw new Error('Could not get Live SQL bridge URL from backend');
        const { url: bridgeUrl, available } = await urlRes.json();
        if (!available || !bridgeUrl) throw new Error('Live SQL bridge is not available. Make sure the bridge is running on your PC.');
        console.log(`⚡ Live SQL: calling bridge directly at ${bridgeUrl}`);
        const bridgeRes = await fetch(`${bridgeUrl}/api/data`, {
          method: 'GET',
          headers: { 'Accept-Encoding': 'gzip, deflate', 'Accept': 'application/json' },
          signal: AbortSignal.timeout(300000)
        });
        if (!bridgeRes.ok) throw new Error(`Bridge returned ${bridgeRes.status}`);
        const result = await bridgeRes.json();
        if (result.data) {
          Object.keys(result.data).forEach(fileName => {
            if (fileName === 'MPS.json') this.loadedData[fileName] = result.data[fileName] ?? { mps_orders: [], summary: { total_orders: 0 } };
            else if (fileName.endsWith('.json')) this.loadedData[fileName] = result.data[fileName] || [];
          });
          this.loadedData.loaded = true;
        }
        return {
          data: result.data || {},
          folderInfo: result.folderInfo || { folderName: 'MISys Live SQL', syncDate: new Date().toISOString() },
          source: result.source || 'live_sql',
          fullCompanyDataReady: result.fullCompanyDataReady ?? true
        };
      }

      // Always pass refresh=true so the backend clears its 1-hour cache and reads the latest folder
      const apiUrl = source === 'full_company_data'
        ? getApiUrl('/api/data?source=full_company_data&refresh=true')
        : getApiUrl('/api/data?refresh=true');
      console.log('📡 Loading data from backend:', {
        url: apiUrl,
        source,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        isProduction: (import.meta as any).env?.PROD || false
      });
      
      // Add 300 second timeout to match Cloud Run configuration (data is 86MB, takes time to load and compress)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      
      let response: Response;
      try {
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Flask API error response:', {
            status: response.status,
            statusText: response.statusText,
            url: apiUrl,
            error: errorText,
            hint: apiUrl.includes('localhost') ? '⚠️ Using localhost - check VITE_API_URL environment variable' : ''
          });
          throw new Error(`Flask API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('❌ Backend request timeout after 300 seconds:', {
            url: apiUrl,
            hint: '⚠️ Backend is loading 86MB of data from Google Drive API. First load can take 2-4 minutes.'
          });
          throw new Error('Backend connection timeout - loading data from Google Drive. Please try again in a moment.');
        }
        throw fetchError;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('❌ Non-JSON response received:', {
          contentType,
          url: apiUrl,
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`Expected JSON, got ${contentType}. Response: ${responseText.substring(0, 100)}`);
      }
      
      const result = await response.json();
      const isFullCompanyDataRequest = source === 'full_company_data';
      const isLiveSqlRequest = source === 'live_sql';
      const fullCompanyDataReady = result.fullCompanyDataReady === true;

      // When Full Company Data is requested and backend returns framework "not ready" empty shape, accept it (app shows "not ready" state)
      if (isFullCompanyDataRequest && result.fullCompanyDataReady === false && result.data) {
        const setVal = (fileName: string, val: any) => {
          if (fileName === 'MPS.json') this.loadedData[fileName] = val ?? { mps_orders: [], summary: { total_orders: 0 } };
          else if (fileName.endsWith('.json')) this.loadedData[fileName] = val || [];
        };
        Object.keys(result.data).forEach(fileName => setVal(fileName, result.data[fileName]));
        this.loadedData.loaded = true;
        return {
          data: result.data,
          folderInfo: result.folderInfo || {},
          source: result.source,
          fullCompanyDataReady: false
        };
      }

      // Check if data actually has content (not just empty structure)
      const hasActualData = result.data && Object.keys(result.data).some(fileName => {
        const fileData = result.data[fileName];
        if (fileName === 'MPS.json') return fileData && typeof fileData === 'object' && (fileData.mps_orders?.length > 0);
        return Array.isArray(fileData) && fileData.length > 0;
      });

      const fileCount = Object.keys(result.data || {}).length;
      const totalRecords = result.data ? Object.values(result.data).reduce((sum: number, fileData: any) => {
        return sum + (Array.isArray(fileData) ? fileData.length : (fileData?.mps_orders?.length ?? 0));
      }, 0) : 0;

      if (!hasActualData) {
        console.error('❌ Backend returned empty data structure:', {
          url: apiUrl,
          fileCount,
          totalRecords,
          hasData: !!result.data,
          hint: 'Google Drive (or data source) may not be accessible'
        });
        if (result.data) {
          Object.keys(result.data).forEach(fileName => {
            if (fileName === 'MPS.json') this.loadedData[fileName] = result.data[fileName] ?? { mps_orders: [], summary: { total_orders: 0 } };
            else if (fileName.endsWith('.json')) this.loadedData[fileName] = result.data[fileName] || [];
          });
        }
        this.loadedData.loaded = false;
        throw new Error('Backend returned empty data. Google Drive may not be accessible.');
      }
      
      console.log('✅ Data loaded from backend:', {
        url: apiUrl,
        fileCount,
        totalRecords,
        hasData: true
      });
      
      // Update loaded data with ALL files from backend
      if (result.data) {
        Object.keys(this.loadedData).forEach(key => {
          if (key !== 'loaded') this.loadedData[key] = key === 'MPS.json' ? { mps_orders: [], summary: { total_orders: 0 } } : [];
        });
        Object.keys(result.data).forEach(fileName => {
          if (fileName === 'MPS.json') this.loadedData[fileName] = result.data[fileName] ?? { mps_orders: [], summary: { total_orders: 0 } };
          else if (fileName.endsWith('.json')) this.loadedData[fileName] = result.data[fileName] || [];
        });
        this.loadedData.loaded = true;
      }
      
      // Load ACTIVE Sales Orders only when using default source (Full Company Data would include SO when ready)
      if (source !== 'full_company_data') {
      console.log('📦 Loading ACTIVE Sales Orders (In Production, New and Revised)...');
      try {
        const soUrl = getApiUrl('/api/sales-orders');  // Default loads only active folders
        const soController = new AbortController();
        const soTimeoutId = setTimeout(() => soController.abort(), 300000);
        
        const soResponse = await fetch(soUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          signal: soController.signal
        });
        clearTimeout(soTimeoutId);
        
        if (soResponse.ok) {
          const soData = await soResponse.json();
          // Merge Sales Orders data into main data
          result.data['SalesOrders.json'] = soData['SalesOrders.json'] || [];
          result.data['SalesOrdersByStatus'] = soData['SalesOrdersByStatus'] || {};
          result.data['TotalOrders'] = soData['TotalOrders'] || 0;
          this.loadedData['SalesOrders.json'] = soData['SalesOrders.json'] || [];
          this.loadedData['SalesOrdersByStatus'] = soData['SalesOrdersByStatus'] || {};
          this.loadedData['TotalOrders'] = soData['TotalOrders'] || 0;
          console.log(`✅ Loaded ${soData['TotalOrders'] || 0} ACTIVE Sales Orders (In Production, New and Revised)`);
          console.log('   Historical orders (Cancelled, Completed) available via /api/sales-orders/historical');
        } else {
          console.warn('⚠️ Could not load Sales Orders, continuing without them');
          result.data['SalesOrders.json'] = [];
          result.data['SalesOrdersByStatus'] = {};
          result.data['TotalOrders'] = 0;
        }
      } catch (soError: any) {
        console.warn('⚠️ Sales Orders loading failed:', soError.message);
        console.warn('   Continuing with MiSys data only');
        result.data['SalesOrders.json'] = [];
        result.data['SalesOrdersByStatus'] = {};
        result.data['TotalOrders'] = 0;
      }
      }

      return {
        data: result.data,
        folderInfo: result.folderInfo,
        source: result.source,
        fullCompanyDataReady: result.fullCompanyDataReady
      };
    } catch (error) {
      console.error('❌ Error loading data via backend:', error);
      
      // If connection refused, return empty data structure instead of throwing
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const apiUrl = getApiUrl('/api/data');
        console.warn('⚠️ Backend not accessible - returning empty data structure', {
          url: apiUrl,
          error: error instanceof Error ? error.message : String(error),
          hint: apiUrl.includes('localhost') && (import.meta as any).env?.PROD 
            ? '⚠️ CRITICAL: Using localhost in production! Set VITE_API_URL in Vercel environment variables.' 
            : 'Check if backend server is running and accessible.'
        });
        return {
          data: {
            // Return empty structure matching expected format
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
    throw new Error('Local test data disabled - use backend data only');
  }
}
