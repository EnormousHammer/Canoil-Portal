/**
 * API Configuration
 * Centralized API URL configuration for the application
 */

// Get API URL from environment variable or use intelligent defaults
const envApiUrl = import.meta.env.VITE_API_URL;

// Determine API base URL based on environment
let apiBaseUrl: string;

if (typeof window !== 'undefined') {
  // ===== BROWSER ENVIRONMENT =====
  
  // 1. EXPLICIT ENV VARIABLE (highest priority - set in Vercel)
  if (envApiUrl) {
    apiBaseUrl = envApiUrl;
  }
  // 2. LOCAL DEVELOPMENT (localhost frontend)
  else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Local development: backend runs on port 5002 (Docker)
    apiBaseUrl = 'http://localhost:5002';
  }
  // 3. NGROK (tunnel to local backend)
  else if (window.location.hostname.includes('ngrok')) {
    // Ngrok: use same origin (ngrok forwards to backend)
    apiBaseUrl = window.location.origin;
  }
  // 4. PRODUCTION/VERCEL - use SAME ORIGIN so Vercel proxy rewrites /api/* to Render
  // vercel.json: /api/(.*) -> https://canoil-portal-1.onrender.com/api/$1
  // Calling same-origin avoids CORS; Vercel forwards server-side to Render
  else {
    apiBaseUrl = window.location.origin;
  }
} else {
  // ===== SSR/BUILD TIME =====
  // Production: same-origin (Vercel proxies to Render). Dev: localhost
  apiBaseUrl = envApiUrl || (import.meta.env.PROD ? 'https://canoil-portal.vercel.app' : 'http://localhost:5002');
}

export const API_BASE_URL = apiBaseUrl;

// Log API configuration on module load (only in browser, not SSR)
if (typeof window !== 'undefined') {
  console.log('🔧 API Configuration:', {
    VITE_API_URL: envApiUrl || 'NOT SET (using default)',
    API_BASE_URL: API_BASE_URL,
    isProduction: import.meta.env.PROD,
    isDevelopment: import.meta.env.DEV,
    hostname: window.location.hostname
  });
  
  // Warn if using localhost in production
  if (import.meta.env.PROD && API_BASE_URL.includes('localhost')) {
    console.error('⚠️ WARNING: Using localhost API URL in production!', {
      API_BASE_URL,
      message: 'VITE_API_URL environment variable is not set. Set it in Vercel/Render environment variables.'
    });
  }
}

/**
 * Get the full API URL for an endpoint
 * @param endpoint - API endpoint (e.g., '/api/data')
 * @returns Full URL
 */
export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  // Remove trailing slash from base URL if present
  const cleanBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const fullUrl = `${cleanBase}/${cleanEndpoint}`;
  
  // Log in development to help debug
  if (import.meta.env.DEV) {
    console.log(`🌐 API Call: ${fullUrl}`);
  }
  
  return fullUrl;
}

/**
 * Check if backend is accessible
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    // Use /api/health endpoint - FAST and doesn't load data
    const response = await fetch(getApiUrl('/api/health'), {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'healthy' || data.status === 'ready';
  } catch (error) {
    console.log('Backend not ready yet, continuing with loading...');
    return false;
  }
}

