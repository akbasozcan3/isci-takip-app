import { apiClient } from './apiClient';

export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface LocationHistory {
  locations: LocationData[];
  total: number;
  deviceId: string;
}

export interface AnalyticsData {
  summary: {
    total_distance: number;
    average_daily_distance: number;
    total_points: number;
  };
  trends: {
    distance_trend: {
      trend: 'increasing' | 'decreasing' | 'stable';
    };
  };
  predictions: any;
  insights: any[];
  anomalies: any[];
}

export interface GroupData {
  id: string;
  name: string;
  code: string;
  adminId: string;
  members: any[];
  createdAt: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  subscription?: {
    plan: 'free' | 'plus' | 'business';
    status: 'active' | 'cancelled' | 'expired';
  };
}

export interface NotificationData {
  id: string;
  type: string;
  message: string;
  read: boolean;
  timestamp: number;
}

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  maxGroups: number;
  maxDevices: number;
}

class ApiMethods {
  async getHealth(): Promise<any> {
    return apiClient.get('/api/health');
  }

  async getProfile(): Promise<UserProfile> {
    return apiClient.get('/api/users/me');
  }

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return apiClient.put('/api/users/me', data);
  }

  async storeLocation(deviceId: string, location: LocationData): Promise<any> {
    return apiClient.post('/api/location/store', {
      deviceId,
      coords: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        timestamp: location.timestamp || Date.now()
      }
    });
  }

  async getLocationHistory(deviceId: string, limit?: number): Promise<LocationHistory> {
    const params = limit ? `?limit=${limit}` : '';
    return apiClient.get(`/api/location/${deviceId}${params}`);
  }

  async getLatestLocation(deviceId: string): Promise<LocationData> {
    return apiClient.get(`/api/location/${deviceId}/latest`);
  }

  async getLocationStats(deviceId: string): Promise<any> {
    return apiClient.get(`/api/location/${deviceId}/stats`);
  }

  async getLocationAnalytics(deviceId: string, dateRange: string = '7d'): Promise<AnalyticsData> {
    return apiClient.get(`/api/location/${deviceId}/analytics?date_range=${dateRange}`);
  }

  async getAdvancedAnalytics(deviceId: string): Promise<any> {
    return apiClient.get(`/api/location/analytics/advanced?deviceId=${deviceId}`);
  }

  async createGroup(name: string, description?: string): Promise<GroupData> {
    return apiClient.post('/api/groups', { name, description });
  }

  async getGroups(): Promise<GroupData[]> {
    return apiClient.get('/api/groups');
  }

  async getGroupById(groupId: string): Promise<GroupData> {
    return apiClient.get(`/api/groups/${groupId}`);
  }

  async joinGroupByCode(code: string): Promise<any> {
    return apiClient.post(`/api/groups/${code}/join-request`);
  }

  async getGroupMembers(groupId: string): Promise<any[]> {
    return apiClient.get(`/api/groups/${groupId}/members`);
  }

  async getGroupLocations(groupId: string): Promise<LocationData[]> {
    return apiClient.get(`/api/groups/${groupId}/locations`);
  }

  async leaveGroup(groupId: string): Promise<any> {
    return apiClient.post(`/api/groups/${groupId}/leave`);
  }

  async deleteGroup(groupId: string): Promise<any> {
    return apiClient.delete(`/api/groups/${groupId}`);
  }

  async getNotifications(): Promise<NotificationData[]> {
    return apiClient.get('/api/notifications');
  }

  async markNotificationRead(notificationId: string): Promise<any> {
    return apiClient.post(`/api/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<any> {
    return apiClient.post('/api/notifications/read-all');
  }

  async getDashboard(userId?: string): Promise<any> {
    const endpoint = userId ? `/api/dashboard/${userId}` : '/api/dashboard';
    return apiClient.get(endpoint);
  }

  async getStats(): Promise<any> {
    return apiClient.get('/api/stats');
  }

  async getActivities(): Promise<any[]> {
    return apiClient.get('/api/activities');
  }

  async getPlans(): Promise<BillingPlan[]> {
    return apiClient.get('/api/plans');
  }

  async getMySubscription(): Promise<any> {
    return apiClient.get('/api/me/subscription');
  }

  async changePlan(planId: string): Promise<any> {
    return apiClient.put('/api/me/subscription/change-plan', { planId });
  }

  async cancelSubscription(): Promise<any> {
    return apiClient.post('/api/me/subscription/cancel');
  }

  async getBillingHistory(): Promise<any[]> {
    return apiClient.get('/api/billing/history');
  }

  async getReceipts(): Promise<any[]> {
    return apiClient.get('/api/billing/receipts');
  }

  async getDevices(): Promise<any[]> {
    return apiClient.get('/api/devices');
  }

  async getActiveDevices(): Promise<any[]> {
    return apiClient.get('/api/active');
  }

  async deleteLocationData(deviceId: string): Promise<any> {
    return apiClient.delete(`/api/location/${deviceId}`);
  }

  async createShareLink(lat: number, lng: number, name?: string): Promise<any> {
    return apiClient.post('/api/location/share', {
      lat,
      lng,
      name: name || 'Konumum'
    });
  }

  async getSharedLocation(shareToken: string): Promise<LocationData> {
    return apiClient.get(`/api/location/share/${shareToken}`);
  }

  async startLiveLocation(deviceId: string): Promise<any> {
    return apiClient.post('/api/location/live/start', { deviceId });
  }

  async addFamilyMember(email: string, name?: string): Promise<any> {
    return apiClient.post('/api/location/family/add', { email, name });
  }

  async getFamilyLocations(): Promise<any[]> {
    return apiClient.get('/api/location/family');
  }

  async createDelivery(data: {
    recipientName: string;
    recipientPhone: string;
    destination: { lat: number; lng: number };
    description?: string;
  }): Promise<any> {
    return apiClient.post('/api/location/delivery/create', data);
  }

  async getDeliveries(): Promise<any[]> {
    return apiClient.get('/api/location/deliveries');
  }

  async updateDeliveryStatus(deliveryId: string, status: string): Promise<any> {
    return apiClient.put(`/api/location/delivery/${deliveryId}/status`, { status });
  }

  async saveRoute(name: string, locations: LocationData[]): Promise<any> {
    return apiClient.post('/api/location/route/save', { name, locations });
  }

  async getRoutes(): Promise<any[]> {
    return apiClient.get('/api/location/routes');
  }

  async getArticles(): Promise<any[]> {
    return apiClient.get('/api/articles');
  }

  async getArticleById(id: string): Promise<any> {
    return apiClient.get(`/api/articles/${id}`);
  }

  async getAppConfig(): Promise<any> {
    return apiClient.get('/api/app/config');
  }

  async getSplashConfig(): Promise<any> {
    return apiClient.get('/api/app/splash');
  }

  async getSystemInfo(): Promise<any> {
    return apiClient.get('/api/system/info');
  }

  async createBackup(): Promise<any> {
    return apiClient.post('/api/system/backup');
  }

  async getBackups(): Promise<any[]> {
    return apiClient.get('/api/system/backups');
  }

  async getMicroservicesStatus(): Promise<any> {
    return apiClient.get('/api/microservices/status');
  }

  async getMicroservicesAnalytics(userId: string, dateRange: string = '7d'): Promise<AnalyticsData> {
    return apiClient.get(`/api/microservices/analytics/${userId}?date_range=${dateRange}`);
  }

  async generateReport(userId: string, reportType: string, dateRange?: string, format?: string): Promise<any> {
    return apiClient.post(`/api/microservices/reports/${userId}`, {
      reportType,
      dateRange,
      format
    });
  }

  async processLocationBatch(locations: LocationData[]): Promise<any> {
    return apiClient.post('/api/microservices/location/batch', { locations });
  }

  async processNotifications(userId: string, notifications: any[]): Promise<any> {
    return apiClient.post('/api/microservices/notifications/process', {
      user_id: userId,
      notifications
    });
  }

  async getNotificationStats(userId: string): Promise<any> {
    return apiClient.get(`/api/microservices/notifications/stats/${userId}`);
  }

  async processBilling(userId: string, plan: string, amount: number): Promise<any> {
    return apiClient.post('/api/microservices/billing/process', {
      user_id: userId,
      plan,
      amount
    });
  }

  async getBillingHistoryMicroservice(userId: string): Promise<any> {
    return apiClient.get(`/api/microservices/billing/history/${userId}`);
  }

  async geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
    return apiClient.post('/api/location/geocode', { address });
  }

  async getRouteOptimized(deviceId: string): Promise<any> {
    return apiClient.get(`/api/location/${deviceId}/route-optimized`);
  }

  async checkGeofence(deviceId: string, lat: number, lng: number, radius: number): Promise<any> {
    return apiClient.get(`/api/location/${deviceId}/geofence?lat=${lat}&lng=${lng}&radius=${radius}`);
  }

  async getTrackingRecommendations(deviceId: string): Promise<any> {
    return apiClient.get(`/api/location/${deviceId}/recommendations`);
  }

  async getRouteMetrics(deviceId: string): Promise<any> {
    return apiClient.get(`/api/location/${deviceId}/route-metrics`);
  }

  async getLocationQuality(deviceId: string): Promise<any> {
    return apiClient.get(`/api/location/${deviceId}/quality`);
  }

  async getLocationPrediction(deviceId: string): Promise<any> {
    return apiClient.get(`/api/location/${deviceId}/prediction`);
  }

  async getDailyStats(deviceId: string): Promise<any> {
    return apiClient.get(`/api/analytics/${deviceId}/daily`);
  }

  async getWeeklyStats(deviceId: string): Promise<any> {
    return apiClient.get(`/api/analytics/${deviceId}/weekly`);
  }

  async getMonthlyStats(deviceId: string): Promise<any> {
    return apiClient.get(`/api/analytics/${deviceId}/monthly`);
  }

  async getHeatmapData(deviceId: string): Promise<any> {
    return apiClient.get(`/api/analytics/${deviceId}/heatmap`);
  }

  async getSpeedAnalysis(deviceId: string): Promise<any> {
    return apiClient.get(`/api/analytics/${deviceId}/speed`);
  }

  async sendMessage(toUserId: string, message: string): Promise<any> {
    return apiClient.post('/api/location/message/send', {
      toUserId,
      message
    });
  }

  async getMessages(): Promise<any[]> {
    return apiClient.get('/api/location/messages');
  }

  async sendLocationMessage(toUserId: string, lat: number, lng: number): Promise<any> {
    return apiClient.post('/api/location/message/location', {
      toUserId,
      lat,
      lng
    });
  }

  async getLocationMetrics(): Promise<any> {
    return apiClient.get('/api/location/metrics');
  }

  async getLocationHealth(): Promise<any> {
    return apiClient.get('/api/location/health');
  }

  async getLocationPerformance(): Promise<any> {
    return apiClient.get('/api/location/performance');
  }

  async trackVehicle(vehicleId: string): Promise<any> {
    return apiClient.get(`/api/location/vehicle/track?vehicleId=${vehicleId}`);
  }

  async getVehicleStatus(vehicleId: string): Promise<any> {
    return apiClient.get(`/api/location/vehicle/status?vehicleId=${vehicleId}`);
  }

  async getVehicleHistory(vehicleId: string): Promise<any> {
    return apiClient.get(`/api/location/vehicle/history?vehicleId=${vehicleId}`);
  }

  async getGroupVehicles(groupId: string): Promise<any[]> {
    return apiClient.get(`/api/location/vehicle/group?groupId=${groupId}`);
  }

  async getActivityStatus(): Promise<any> {
    return apiClient.get('/api/location/activity/status');
  }

  async findLocationByPhone(phone: string): Promise<LocationData> {
    return apiClient.get(`/api/location/find-by-phone?phone=${phone}`);
  }

  async getRecentLocations(deviceId: string, limit: number = 10): Promise<LocationData[]> {
    return apiClient.get(`/api/locations/${deviceId}/recent?limit=${limit}`);
  }

  async getLatestLocations(): Promise<LocationData[]> {
    return apiClient.get('/api/locations/latest');
  }

  async validateInput(data: any): Promise<any> {
    return apiClient.post('/api/location/validate-input', data);
  }

  async getNavigationData(): Promise<any> {
    return apiClient.get('/api/navigation/data');
  }

  async getPageContext(): Promise<any> {
    return apiClient.get('/api/page/context');
  }

  async shareDataBetweenPages(data: any): Promise<any> {
    return apiClient.post('/api/pages/share', data);
  }

  async getSharedData(): Promise<any> {
    return apiClient.get('/api/pages/shared');
  }

  async updateUIPreference(preferences: any): Promise<any> {
    return apiClient.post('/api/ui/preference', preferences);
  }

  async triggerManualCheck(): Promise<any> {
    return apiClient.post('/api/scheduled/trigger-check');
  }

  async getUserActivity(userId: string): Promise<any> {
    return apiClient.get(`/api/scheduled/activity/${userId}`);
  }

  async getAllActivities(): Promise<any[]> {
    return apiClient.get('/api/scheduled/activities');
  }

  async sendTestNotification(): Promise<any> {
    return apiClient.post('/api/scheduled/test-notification');
  }

  async processPayment(cardData: any, amount: number, planId: string): Promise<any> {
    return apiClient.post('/api/payment/process', {
      ...cardData,
      amount,
      planId
    });
  }

  async getPaymentStatus(paymentId: string): Promise<any> {
    return apiClient.get(`/api/payment/${paymentId}/status`);
  }

  async checkout(planId: string, paymentMethod?: any): Promise<any> {
    return apiClient.post('/api/checkout', {
      planId,
      paymentMethod
    });
  }

  async subscribe(planId: string, paymentData: any): Promise<any> {
    return apiClient.post('/api/billing/subscribe', {
      planId,
      ...paymentData
    });
  }

  async getReceipt(receiptNumber: string): Promise<any> {
    return apiClient.get(`/api/billing/receipt/${receiptNumber}`);
  }
}

export const apiMethods = new ApiMethods();
export default apiMethods;
