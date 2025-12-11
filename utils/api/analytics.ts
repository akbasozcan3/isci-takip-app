import apiClient from './client';

export interface AnalyticsSummary {
  total_locations: number;
  total_distance: number;
  active_days: number;
  average_daily_distance: number;
}

export interface AnalyticsTrends {
  locations_per_day: Array<{ date: string; count: number }>;
  distance_per_day: Array<{ date: string; distance: number }>;
}

export interface AnalyticsPrediction {
  estimated_daily_distance: number;
  next_location_probability?: number;
  route_optimization?: {
    potential_savings_km: number;
    optimization_score: number;
  };
}

export interface AnalyticsInsight {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  trends: AnalyticsTrends;
  predictions?: AnalyticsPrediction | undefined;
  insights?: AnalyticsInsight[];
  anomalies?: any[];
}

class AnalyticsApi {
  async getAnalytics(userId: string, dateRange: string = '7d'): Promise<AnalyticsData> {
    try {
      const data = await apiClient.get<{ data?: AnalyticsData; summary?: AnalyticsSummary; trends?: AnalyticsTrends; predictions?: AnalyticsPrediction; insights?: AnalyticsInsight[] }>(
        `/microservices/analytics/${userId}?date_range=${dateRange}`,
        {
          timeout: 60000, // 60 seconds for analytics
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
        predictions: result.predictions || undefined,
        insights: Array.isArray(result.insights) ? result.insights : [],
        anomalies: [],
      };
    } catch (error: any) {
      console.error('[AnalyticsApi] Error:', error);
      // Return empty data instead of throwing to prevent app crashes
      // Analytics is not critical for app functionality
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
        predictions: undefined,
        insights: [],
        anomalies: [],
      };
    }
  }

  async getAdvancedAnalytics(deviceId: string, dateRange: string = '7d', options?: {
    includeTimeSeries?: boolean;
    includePatterns?: boolean;
    includePredictions?: boolean;
  }): Promise<any> {
    try {
      const params = new URLSearchParams({
        dateRange,
        ...(options?.includeTimeSeries && { includeTimeSeries: 'true' }),
        ...(options?.includePatterns && { includePatterns: 'true' }),
        ...(options?.includePredictions && { includePredictions: 'true' }),
      });

      return await apiClient.get(
        `/location/analytics/advanced?deviceId=${encodeURIComponent(deviceId)}&${params.toString()}`,
        { timeout: 60000 } // 60 seconds timeout
      );
    } catch (error: any) {
      console.error('[AnalyticsApi] getAdvancedAnalytics error:', error);
      // Return empty object instead of throwing to prevent crashes
      if (error.message?.includes('timeout')) {
        console.warn('[AnalyticsApi] Request timeout, returning empty data');
        return {};
      }
      throw new Error(`Failed to fetch advanced analytics: ${error.message}`);
    }
  }

  async generateReport(userId: string, reportType: string): Promise<any> {
    try {
      return await apiClient.post(`/microservices/reports/${userId}`, { reportType }, { timeout: 90000 });
    } catch (error: any) {
      console.error('[AnalyticsApi] Report generation error:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }
}

export const analyticsApi = new AnalyticsApi();
export default analyticsApi;
