/**
 * Portal API client with JWT auth support.
 * All requests attach the JWT Bearer token from localStorage.
 */
import { getApiUrl } from './apiConfig';

const TOKEN_KEY = 'canoil_jwt_token';
const USER_KEY = 'canoil_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): any {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setStoredUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function apiRequest(url: string, options: RequestInit = {}): Promise<any> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers as Record<string, string> || {}) },
    });
    if (res.status === 401) {
      clearToken();
    }
    const contentType = res.headers.get('content-type');
    let data: any;
    if (contentType?.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { error: text || `Request failed (${res.status})` };
    }
    return { data, status: res.status, ok: res.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { error: msg || 'Network error' }, status: 0, ok: false };
  }
}

export async function apiGet(endpoint: string): Promise<any> {
  return apiRequest(getApiUrl(endpoint));
}

export async function apiPost(endpoint: string, body?: any): Promise<any> {
  return apiRequest(getApiUrl(endpoint), {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut(endpoint: string, body: any): Promise<any> {
  return apiRequest(getApiUrl(endpoint), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function apiPatch(endpoint: string, body?: any): Promise<any> {
  return apiRequest(getApiUrl(endpoint), {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete(endpoint: string): Promise<any> {
  return apiRequest(getApiUrl(endpoint), { method: 'DELETE' });
}

// Auth
export async function login(email: string, password: string) {
  const res = await apiPost('/api/auth/login', { email, password });
  if (res.ok && res.data.token) {
    setToken(res.data.token);
    setStoredUser(res.data.user);
  }
  return res;
}

export async function logout() {
  clearToken();
}

export async function getMe() {
  return apiGet('/api/auth/me');
}
