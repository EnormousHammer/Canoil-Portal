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
  
  // 1. EXPLICIT ENV VARIABLE (highest priority)
  if (envApiUrl) {
    apiBaseUrl = envApiUrl;
  }
  // 2. LOCAL DEVELOPMENT (localhost frontend)
  else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Local development: backend runs on port 5002
    apiBaseUrl = 'http://localhost:5002';
  }
  // 3. NGROK (tunnel to local backend)
  else if (window.location.hostname.includes('ngrok')) {
    // Ngrok: use same origin (ngrok forwards to backend)
    apiBaseUrl = window.location.origin;
  }
  // 4. PRODUCTION/VERCEL/RENDER (same origin - uses vercel.json rewrite)
  else {
    // Production: Use same origin (Vercel rewrites /api/* to Cloud Run via vercel.json)
    // This works because vercel.json has: { "src": "/api/(.*)", "dest": "https://canoil-backend-4n1pxclyta-uc.a.run.app/api/$1" }
    apiBaseUrl = window.location.origin;
  }
} else {
  // ===== SSR/BUILD TIME =====
  apiBaseUrl = envApiUrl || 'http://localhost:5002';
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
    const response = await fetch(getApiUrl('/api/data'), {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    return response.ok;
  } catch (error) {
    console.log('Backend not ready yet, continuing with loading...');
    return false;
  }
}

