import { getApiBase } from './api';
import { getToken } from './auth';

const API_BASE = getApiBase();

export interface ServiceStatus {
  healthy: boolean;
  circuitBreaker: string;
  failures: number;
  baseUrl: string;
}

export interface AnalyticsData {
  summary: {
    total_locations: number;
    total_distance: number;
    active_days: number;
    average_daily_distance: number;
  };
  trends: {
    locations_per_day: any[];
    distance_per_day: any[];
  };
  predictions?: any;
  insights?: any[];
  anomalies?: any[];
}

export interface ReportData {
  type: string;
  data: any;
  generated_at: string;
}

class MicroservicesClient {
  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`Service request failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error: any) {
      if (error?.message?.includes('Network request failed') || 
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('Rate limit exceeded')) {
        throw error;
      }
      throw new Error(`Service request failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async getServiceStatus(): Promise<Record<string, ServiceStatus>> {
    try {
      const data = await this.request('/api/microservices/status');
      return data.services || {};
    } catch (error: any) {
      const errorMessage = error?.message || '';
      const isNetworkError = errorMessage.includes('Network request failed') || 
                           errorMessage.includes('Failed to fetch') ||
                           errorMessage.includes('Service request failed');
      if (!isNetworkError) {
        return {};
      }
      return {};
    }
  }

  async getAnalytics(userId: string, dateRange: string = '7d'): Promise<AnalyticsData> {
    try {
      const data = await this.request(
        `/api/microservices/analytics/${userId}?date_range=${dateRange}`,
        {
          headers: {
            'X-Date-Range': dateRange,
          },
        }
      );
      const result = data.data || data;
      return {
        summary: {
          total_locations: result.summary?.total_locations ?? 0,
          total_distance: result.summary?.total_distance ?? 0,
          active_days: result.summary?.active_days ?? 0,
          average_daily_distance: result.summary?.average_daily_distance ?? 0,
        },
        trends: result.trends || { locations_per_day: [], distance_per_day: [] },
        predictions: result.predictions || {},
        insights: Array.isArray(result.insights) ? result.insights : [],
        anomalies: Array.isArray(result.anomalies) ? result.anomalies : [],
      };
    } catch (error: any) {
      return {
        summary: {
          total_locations: 0,
          total_distance: 0,
          active_days: 0,
          average_daily_distance: 0,
        },
        trends: {
          locations_per_day: [],
          distance_per_day: [],
        },
        predictions: {},
        insights: [],
        anomalies: [],
      };
    }
  }

  async generateReport(userId: string, reportType: string): Promise<ReportData> {
    try {
      const data = await this.request(`/api/microservices/reports/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ reportType }),
      });
      return data.data || data;
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }

  async processLocationBatch(locations: any[]): Promise<any> {
    try {
      const data = await this.request('/api/microservices/location/batch', {
        method: 'POST',
        body: JSON.stringify({ locations }),
      });
      return data.data || data;
    } catch (error) {
      console.error('Failed to process location batch:', error);
      throw error;
    }
  }
}

export const microservicesClient = new MicroservicesClient();
