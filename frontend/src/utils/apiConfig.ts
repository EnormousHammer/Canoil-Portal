/**
 * API Configuration
 * Centralized API URL configuration for the application
 */

// Get API URL from environment variable or use same domain as frontend
const envApiUrl = import.meta.env.VITE_API_URL;

// For Vercel: frontend and backend are on the same domain via vercel.json rewrites
// So we should use the same domain as the frontend, not a hardcoded URL
// This fixes CORS issues on preview deployments
let apiBaseUrl = envApiUrl;

// In browser: use env variable if set, otherwise use same origin for production
// This works because vercel.json routes /api/* to the serverless function
if (typeof window !== 'undefined') {
  // If VITE_API_URL is set, use it (for local development)
  // Otherwise use same domain as frontend (for production deployments)
  if (!apiBaseUrl) {
    apiBaseUrl = window.location.origin;
  }
} else if (!apiBaseUrl) {
  // Fallback for SSR or build time
  apiBaseUrl = 'http://localhost:5002';
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

