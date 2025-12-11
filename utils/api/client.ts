import * as SecureStore from 'expo-secure-store';
import { getApiBase } from '../api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBase();
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, timeout = 60000, ...fetchOptions } = options;

    // Ensure endpoint starts with /api if it doesn't already
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (!normalizedEndpoint.startsWith('/api')) {
      normalizedEndpoint = `/api${normalizedEndpoint}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (!skipAuth) {
      const authHeaders = await this.getAuthHeaders();
      Object.assign(headers, authHeaders);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${normalizedEndpoint}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        throw new Error('Request timeout. Please check your connection and try again.');
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
