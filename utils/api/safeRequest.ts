/**
 * Safe API Request Utility
 * Professional network-aware API requests with automatic retry
 * Similar to Trendyol's request handling
 */

import NetInfo from '@react-native-community/netinfo';
import { getNetworkErrorMessage, isNetworkError } from '../network';

export interface SafeRequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  skipNetworkCheck?: boolean;
}

export interface SafeRequestResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  isNetworkError: boolean;
}

/**
 * Professional safe request function
 * Checks internet connectivity before making requests
 * Handles network errors gracefully
 * Includes automatic retry mechanism
 */
export async function safeRequest<T = any>(
  url: string,
  options: SafeRequestOptions = {}
): Promise<SafeRequestResult<T>> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 2000,
    skipNetworkCheck = false,
    ...fetchOptions
  } = options;

  // Step 1: Check internet connectivity
  if (!skipNetworkCheck) {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      return {
        success: false,
        error: 'İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.',
        isNetworkError: true,
      };
    }
  }

  // Step 2: Check backend reachability (optional, can be skipped for faster requests)
  // Only check on first attempt
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < retries) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Make request
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if response is OK
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            error: errorMessage,
            statusCode: response.status,
            isNetworkError: false,
          };
        }

        // Retry on server errors (5xx)
        if (response.status >= 500 && attempt < retries - 1) {
          lastError = new Error(errorMessage);
          attempt++;
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
          isNetworkError: false,
        };
      }

      // Parse response
      const data = await response.json().catch(() => null);

      return {
        success: true,
        data: data as T,
        statusCode: response.status,
        isNetworkError: false,
      };
    } catch (error: any) {
      lastError = error;

      // Check if it's a network error
      if (isNetworkError(error)) {
        // If it's the last attempt, return error
        if (attempt >= retries - 1) {
          return {
            success: false,
            error: getNetworkErrorMessage(error),
            isNetworkError: true,
          };
        }

        // Wait before retry
        attempt++;
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));

        // Re-check network before retry
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected || !netInfo.isInternetReachable) {
          return {
            success: false,
            error: 'İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.',
            isNetworkError: true,
          };
        }

        continue;
      }

      // Non-network error, return immediately
      return {
        success: false,
        error: error?.message || 'Bir hata oluştu',
        isNetworkError: false,
      };
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || 'İstek başarısız oldu. Lütfen tekrar deneyin.',
    isNetworkError: isNetworkError(lastError),
  };
}

/**
 * Convenience function for GET requests
 */
export async function safeGet<T = any>(
  url: string,
  options?: SafeRequestOptions
): Promise<SafeRequestResult<T>> {
  return safeRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * Convenience function for POST requests
 */
export async function safePost<T = any>(
  url: string,
  data?: any,
  options?: SafeRequestOptions
): Promise<SafeRequestResult<T>> {
  return safeRequest<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Convenience function for PUT requests
 */
export async function safePut<T = any>(
  url: string,
  data?: any,
  options?: SafeRequestOptions
): Promise<SafeRequestResult<T>> {
  return safeRequest<T>(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Convenience function for DELETE requests
 */
export async function safeDelete<T = any>(
  url: string,
  options?: SafeRequestOptions
): Promise<SafeRequestResult<T>> {
  return safeRequest<T>(url, { ...options, method: 'DELETE' });
}

