import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalyticsData, GroupData, LocationData, NotificationData, UserProfile } from './apiMethods';
import { apiMethods } from './apiMethods';

export function useApiHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getHealth();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Health check failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return { health, loading, error, refetch: fetchHealth };
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    try {
      setLoading(true);
      setError(null);
      const updated = await apiMethods.updateProfile(data);
      setProfile(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile, updateProfile };
}

export function useLocationHistory(deviceId: string, limit?: number) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getLocationHistory(deviceId, limit);
      setLocations(data.locations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, [deviceId, limit]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return { locations, loading, error, refetch: fetchLocations };
}

export function useLatestLocation(deviceId: string) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getLatestLocation(deviceId);
      setLocation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load location');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchLocation();
    const interval = setInterval(fetchLocation, 5000);
    return () => clearInterval(interval);
  }, [fetchLocation]);

  return { location, loading, error, refetch: fetchLocation };
}

export function useGroups() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getGroups();
      setGroups(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  const createGroup = useCallback(async (name: string, description?: string) => {
    try {
      setLoading(true);
      setError(null);
      const newGroup = await apiMethods.createGroup(name, description);
      setGroups(prev => [...prev, newGroup]);
      return newGroup;
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiMethods.leaveGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (err: any) {
      setError(err.message || 'Failed to leave group');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return { groups, loading, error, refetch: fetchGroups, createGroup, leaveGroup };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getNotifications();
      setNotifications(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      await apiMethods.markNotificationRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    } catch (err: any) {
      setError(err.message || 'Failed to mark notification as read');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiMethods.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err: any) {
      setError(err.message || 'Failed to mark all as read');
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return { notifications, loading, error, refetch: fetchNotifications, markRead, markAllRead };
}

export function useAnalytics(deviceId: string, dateRange: string = '7d') {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getLocationAnalytics(deviceId, dateRange);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [deviceId, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, error, refetch: fetchAnalytics };
}

export function useDashboard(userId?: string) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getDashboard(userId);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return { dashboard, loading, error, refetch: fetchDashboard };
}

export function useDevices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getDevices();
      setDevices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return { devices, loading, error, refetch: fetchDevices };
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getMySubscription();
      setSubscription(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  const changePlan = useCallback(async (planId: string) => {
    try {
      setLoading(true);
      setError(null);
      const updated = await apiMethods.changePlan(planId);
      setSubscription(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to change plan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await apiMethods.cancelSubscription();
      await fetchSubscription();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSubscription]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return { subscription, loading, error, refetch: fetchSubscription, changePlan, cancel };
}

export function usePlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getPlans();
      setPlans(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return { plans, loading, error, refetch: fetchPlans };
}

export function useLocationStats(deviceId: string) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getLocationStats(deviceId);
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useGroupLocations(groupId: string) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getGroupLocations(groupId);
      setLocations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load group locations');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 5000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  return { locations, loading, error, refetch: fetchLocations };
}

export function useGroupMembers(groupId: string) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getGroupMembers(groupId);
      setMembers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMembers();
    const interval = setInterval(fetchMembers, 10000);
    return () => clearInterval(interval);
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers };
}

export function useBillingHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getBillingHistory();
      setHistory(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getReceipts();
      setReceipts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  return { receipts, loading, error, refetch: fetchReceipts };
}

export function useActiveDevices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getActiveDevices();
      setDevices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load active devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  return { devices, loading, error, refetch: fetchDevices };
}

export function useMicroservicesStatus() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getMicroservicesStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load service status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}

export function useMicroservicesAnalytics(userId: string, dateRange: string = '7d') {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiMethods.getMicroservicesAnalytics(userId, dateRange);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [userId, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, error, refetch: fetchAnalytics };
}

export function useLocationTracking(deviceId: string, interval: number = 5000) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTracking = useCallback(() => {
    if (intervalRef.current) return;
    setIsTracking(true);
    const fetchLocation = async () => {
      try {
        const data = await apiMethods.getLatestLocation(deviceId);
        setLocation(data);
      } catch (err) {
        console.error('Tracking error:', err);
      }
    };
    fetchLocation();
    intervalRef.current = setInterval(fetchLocation, interval);
  }, [deviceId, interval]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { location, isTracking, startTracking, stopTracking };
}

export function useLocationStore(deviceId: string, location: LocationData) {
  const [stored, setStored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeLocation = useCallback(async () => {
    try {
      setError(null);
      await apiMethods.storeLocation(deviceId, location);
      setStored(true);
    } catch (err: any) {
      setError(err.message || 'Failed to store location');
      setStored(false);
    }
  }, [deviceId, location]);

  useEffect(() => {
    if (deviceId && location) {
      storeLocation();
    }
  }, [deviceId, location, storeLocation]);

  return { stored, error, retry: storeLocation };
}
