/**
 * Network Connectivity Utility
 * Checks internet connectivity and provides network status
 */

import { getApiBase } from './api';

export interface NetworkStatus {
  isConnected: boolean;
  isBackendReachable: boolean;
  lastChecked: number;
}

let cachedStatus: NetworkStatus | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Checks if device has internet connectivity
 */
export async function checkInternetConnectivity(): Promise<boolean> {
  try {
    // Try to fetch a reliable endpoint (Google's DNS or a CDN)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-cache',
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.warn('[Network] Internet connectivity check failed:', error);
    return false;
  }
}

/**
 * Checks if backend is reachable
 */
export async function checkBackendReachability(): Promise<boolean> {
  try {
    const apiBase = getApiBase();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
    
    const response = await fetch(`${apiBase}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-cache',
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error: any) {
    // Silently handle AbortError (timeout) - don't log as warning
    if (error?.name === 'AbortError') {
      return false;
    }
    // Only log non-timeout errors
    if (error?.message && !error.message.includes('Aborted')) {
      console.warn('[Network] Backend reachability check failed:', error);
    }
    return false;
  }
}

/**
 * Comprehensive network status check
 */
export async function checkNetworkStatus(forceRefresh = false): Promise<NetworkStatus> {
  const now = Date.now();
  
  // Return cached status if still valid and not forcing refresh
  if (!forceRefresh && cachedStatus && (now - lastCheckTime) < CACHE_DURATION) {
    return cachedStatus;
  }
  
  try {
    const [isConnected, isBackendReachable] = await Promise.all([
      checkInternetConnectivity(),
      checkBackendReachability(),
    ]);
    
    const status: NetworkStatus = {
      isConnected,
      isBackendReachable,
      lastChecked: now,
    };
    
    cachedStatus = status;
    lastCheckTime = now;
    
    return status;
  } catch (error) {
    console.error('[Network] Network status check error:', error);
    // Return safe default
    return {
      isConnected: false,
      isBackendReachable: false,
      lastChecked: now,
    };
  }
}

/**
 * Waits for network connectivity with retries
 */
export async function waitForNetwork(
  maxRetries = 5,
  retryDelay = 2000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const status = await checkNetworkStatus(true);
    if (status.isConnected && status.isBackendReachable) {
      return true;
    }
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return false;
}

/**
 * Checks if error is a network error
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorName = error.name || '';
  
  return (
    errorName === 'TypeError' ||
    errorName === 'NetworkError' ||
    errorName === 'AbortError' ||
    errorMessage.includes('Network request failed') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT')
  );
}

/**
 * Gets user-friendly error message for network errors
 */
export function getNetworkErrorMessage(error: any): string {
  if (!isNetworkError(error)) {
    return error?.message || 'Bir hata oluştu';
  }
  
  const errorMessage = error?.message || error?.toString() || '';
  
  if (errorMessage.includes('timeout') || error?.name === 'AbortError') {
    return 'Bağlantı zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.';
  }
  
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ECONNREFUSED')) {
    return 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.';
  }
  
  return 'İnternet bağlantısı gereklidir. Lütfen bağlantınızı kontrol edin.';
}

