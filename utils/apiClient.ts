import * as SecureStore from 'expo-secure-store';
import { getApiBase } from './api';

const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
  skipCache?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private requestCache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000;

  constructor() {
    this.baseUrl = getApiBase();
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('auth_token');
    } catch {
      return null;
    }
  }

  private async buildHeaders(customHeaders?: HeadersInit): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const token = await this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestOptions
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = options.timeout || REQUEST_TIMEOUT;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async retryRequest(
    url: string,
    options: RequestOptions,
    retries: number
  ): Promise<Response> {
    try {
      return await this.fetchWithTimeout(url, options);
    } catch (error) {
      if (retries > 0 && !(error instanceof Error && error.name === 'AbortError')) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.retryRequest(url, options, retries - 1);
      }
      throw error;
    }
  }

  private getCacheKey(url: string, method: string): string {
    return `${method}:${url}`;
  }

  private getCachedResponse<T>(cacheKey: string): T | null {
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    if (cached) {
      this.requestCache.delete(cacheKey);
    }
    return null;
  }

  private setCachedResponse<T>(cacheKey: string, data: T): void {
    if (this.requestCache.size > 100) {
      const firstKey = this.requestCache.keys().next().value;
      this.requestCache.delete(firstKey);
    }
    this.requestCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const method = options.method || 'GET';
    const cacheKey = this.getCacheKey(url, method);

    if (method === 'GET' && !options.skipCache) {
      const cached = this.getCachedResponse<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const headers = await this.buildHeaders(options.headers);
    const retries = options.retries ?? MAX_RETRIES;

    try {
      const response = await this.retryRequest(url, {
        ...options,
        headers,
        method,
      }, retries);

      // Handle different response types
      const contentType = response.headers.get('content-type') || '';
      let data: unknown;

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      } else if (contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.blob();
      }

      // Handle error responses
      if (!response.ok) {
        const errorMessage = typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${response.status}: ${response.statusText}`;
        
        const errorCode = typeof data === 'object' && data !== null && 'code' in data
          ? String((data as { code: unknown }).code)
          : undefined;

        const error = new Error(errorMessage);
        (error as Error & { statusCode?: number; code?: string }).statusCode = response.status;
        (error as Error & { statusCode?: number; code?: string }).code = errorCode;
        throw error;
      }

      // Cache successful GET requests
      if (method === 'GET' && !options.skipCache && typeof data === 'object') {
        this.setCachedResponse(cacheKey, data);
      }

      return data as T;
    } catch (error) {
      // Enhanced error handling
      if (error instanceof Error) {
        // Network errors
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new Error('Request timeout. Please check your internet connection.');
        }
        
        // Already formatted errors
        if ('statusCode' in error) {
          throw error;
        }

        throw new Error(`API request failed: ${error.message}`);
      }
      throw new Error('Unknown error occurred');
    }
  }

  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  clearCache(): void {
    this.requestCache.clear();
  }
}

export const apiClient = new ApiClient();
export default apiClient;
