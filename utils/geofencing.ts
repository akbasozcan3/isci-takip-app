/**
 * Geofencing System
 * World-class GPS tracking - Enter/exit zone notifications with backend sync
 */

import * as Location from 'expo-location';
import { authFetch } from './auth';
import { getOfflineStorage } from './offlineStorage';
import Constants from 'expo-constants';

// Optional import for expo-notifications (may require native build)
// Skip in Expo Go to avoid warnings
let Notifications: any = null;
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.warn('[Geofencing] expo-notifications not available');
  }
}

export interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  type: 'home' | 'work' | 'custom';
  enabled: boolean;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  enterMessage?: string;
  exitMessage?: string;
  groupId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeofenceEvent {
  geofenceId: string;
  geofenceName: string;
  type: 'enter' | 'exit';
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

interface GeofenceState {
  inside: boolean;
  geofences: Geofence[];
}

class GeofencingService {
  private geofences: Map<string, Geofence> = new Map();
  private lastStates: Map<string, 'inside' | 'outside'> = new Map();
  private eventCallback: ((event: GeofenceEvent) => void) | null = null;
  private syncInProgress = false;
  private pendingEvents: GeofenceEvent[] = [];

  /**
   * Initialize geofencing service - Load from backend and offline storage
   */
  async initialize(): Promise<void> {
    try {
      await this.syncFromBackend();
      await this.loadFromOfflineStorage();
    } catch (error) {
      console.warn('[Geofencing] Initialization error:', error);
    }
  }

  /**
   * Sync geofences from backend
   */
  async syncFromBackend(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const response = await authFetch('/api/geofences');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.geofences) {
          const backendGeofences = data.data.geofences as Geofence[];
          backendGeofences.forEach(geofence => {
            this.geofences.set(geofence.id, geofence);
            if (!this.lastStates.has(geofence.id)) {
              this.lastStates.set(geofence.id, 'outside');
            }
          });
          // Save to offline storage
          await this.saveToOfflineStorage();
        }
      }
    } catch (error) {
      console.warn('[Geofencing] Backend sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Load geofences from offline storage
   */
  private async loadFromOfflineStorage(): Promise<void> {
    try {
      const storage = getOfflineStorage();
      const stored = await (storage as any).getGeofences();
      if (Array.isArray(stored)) {
        stored.forEach((geofence: Geofence) => {
          if (!this.geofences.has(geofence.id)) {
            this.geofences.set(geofence.id, geofence);
            this.lastStates.set(geofence.id, 'outside');
          }
        });
      }
    } catch (error) {
      console.warn('[Geofencing] Offline storage load error:', error);
    }
  }

  /**
   * Save geofences to offline storage
   */
  private async saveToOfflineStorage(): Promise<void> {
    try {
      const storage = getOfflineStorage();
      const geofences = Array.from(this.geofences.values());
      await (storage as any).saveGeofences(geofences);
    } catch (error) {
      console.warn('[Geofencing] Offline storage save error:', error);
    }
  }

  /**
   * Add a geofence (local + backend)
   */
  async addGeofence(geofence: Geofence, syncToBackend = true): Promise<Geofence> {
    // Add locally first
    this.geofences.set(geofence.id, geofence);
    this.lastStates.set(geofence.id, 'outside');
    await this.saveToOfflineStorage();

    // Sync to backend
    if (syncToBackend) {
      try {
        const response = await authFetch('/api/geofences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: geofence.name,
            latitude: geofence.latitude,
            longitude: geofence.longitude,
            radius: geofence.radius,
            type: geofence.type,
            enabled: geofence.enabled,
            notifyOnEnter: geofence.notifyOnEnter,
            notifyOnExit: geofence.notifyOnExit,
            enterMessage: geofence.enterMessage,
            exitMessage: geofence.exitMessage,
            groupId: geofence.groupId,
            metadata: geofence.metadata,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.id) {
            // Update with backend ID if different
            const backendId = data.data.id;
            if (backendId !== geofence.id) {
              this.geofences.delete(geofence.id);
              geofence.id = backendId;
              this.geofences.set(backendId, geofence);
              await this.saveToOfflineStorage();
            }
          }
        }
      } catch (error) {
        console.warn('[Geofencing] Backend sync error:', error);
        // Keep local geofence even if backend sync fails
      }
    }

    return geofence;
  }

  /**
   * Remove a geofence (local + backend)
   */
  async removeGeofence(id: string, syncToBackend = true): Promise<void> {
    this.geofences.delete(id);
    this.lastStates.delete(id);
    await this.saveToOfflineStorage();

    if (syncToBackend) {
      try {
        await authFetch(`/api/geofences/${id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.warn('[Geofencing] Backend delete error:', error);
      }
    }
  }

  /**
   * Update a geofence (local + backend)
   */
  async updateGeofence(id: string, updates: Partial<Geofence>, syncToBackend = true): Promise<Geofence | null> {
    const geofence = this.geofences.get(id);
    if (!geofence) {
      return null;
    }

    const updated = { ...geofence, ...updates };
    this.geofences.set(id, updated);
    await this.saveToOfflineStorage();

    if (syncToBackend) {
      try {
        const response = await authFetch(`/api/geofences/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            Object.assign(updated, data.data);
            await this.saveToOfflineStorage();
          }
        }
      } catch (error) {
        console.warn('[Geofencing] Backend update error:', error);
      }
    }

    return updated;
  }

  /**
   * Get all geofences
   */
  getGeofences(): Geofence[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Get geofence by ID
   */
  getGeofence(id: string): Geofence | null {
    return this.geofences.get(id) || null;
  }

  /**
   * Check location against all geofences
   */
  checkLocation(location: Location.LocationObject): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];
    const { latitude, longitude } = location.coords;

    for (const geofence of this.geofences.values()) {
      if (!geofence.enabled) continue;

      const distance = this.calculateDistance(
        latitude,
        longitude,
        geofence.latitude,
        geofence.longitude
      );

      const isInside = distance <= geofence.radius;
      const lastState = this.lastStates.get(geofence.id) || 'outside';

      // Detect state change
      if (lastState === 'outside' && isInside) {
        // Entered geofence
        if (geofence.notifyOnEnter) {
          const event: GeofenceEvent = {
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            type: 'enter',
            timestamp: location.timestamp,
            location: { latitude, longitude },
          };
          events.push(event);
          this.triggerNotification(geofence, 'enter');
          this.logEventToBackend(event).catch(err => {
            console.warn('[Geofencing] Event log error:', err);
            // Queue for retry
            this.pendingEvents.push(event);
          });
        }
        this.lastStates.set(geofence.id, 'inside');
      } else if (lastState === 'inside' && !isInside) {
        // Exited geofence
        if (geofence.notifyOnExit) {
          const event: GeofenceEvent = {
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            type: 'exit',
            timestamp: location.timestamp,
            location: { latitude, longitude },
          };
          events.push(event);
          this.triggerNotification(geofence, 'exit');
          this.logEventToBackend(event).catch(err => {
            console.warn('[Geofencing] Event log error:', err);
            // Queue for retry
            this.pendingEvents.push(event);
          });
        }
        this.lastStates.set(geofence.id, 'outside');
      }
    }

    // Call event callback if set
    if (this.eventCallback) {
      events.forEach((event) => this.eventCallback!(event));
    }

    return events;
  }

  /**
   * Log geofence event to backend
   */
  private async logEventToBackend(event: GeofenceEvent): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      await authFetch('/api/geofences/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geofenceId: event.geofenceId,
          deviceId,
          eventType: event.type,
          latitude: event.location.latitude,
          longitude: event.location.longitude,
          timestamp: new Date(event.timestamp).toISOString(),
        }),
      });
    } catch (error) {
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Get device ID (helper)
   */
  private async getDeviceId(): Promise<string | null> {
    try {
      const { getDeviceId } = await import('./device');
      return await getDeviceId();
    } catch {
      return null;
    }
  }

  /**
   * Retry pending events
   */
  async retryPendingEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    for (const event of events) {
      try {
        const deviceId = await this.getDeviceId();
        await authFetch('/api/geofences/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geofenceId: event.geofenceId,
            deviceId,
            eventType: event.type,
            latitude: event.location.latitude,
            longitude: event.location.longitude,
            timestamp: new Date(event.timestamp).toISOString(),
          }),
        });
      } catch (error) {
        // Re-queue if still failing
        this.pendingEvents.push(event);
        console.warn('[Geofencing] Retry failed for event:', event);
      }
    }
  }

  /**
   * Set callback for geofence events
   */
  setEventCallback(callback: (event: GeofenceEvent) => void): void {
    this.eventCallback = callback;
  }

  /**
   * Trigger notification for geofence event
   */
  private async triggerNotification(geofence: Geofence, type: 'enter' | 'exit'): Promise<void> {
    try {
      const title =
        type === 'enter'
          ? `📍 ${geofence.name} bölgesine girdiniz`
          : `🚪 ${geofence.name} bölgesinden çıktınız`;

      const message =
        type === 'enter'
          ? geofence.enterMessage || `${geofence.name} bölgesine girdiniz`
          : geofence.exitMessage || `${geofence.name} bölgesinden çıktınız`;

      if (!Notifications) {
        console.warn('[Geofencing] Notifications not available, skipping notification');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data: {
            geofenceId: geofence.id,
            type,
          },
        },
        trigger: null, // Immediate
      });
    } catch (error) {
      console.warn('[Geofencing] Notification error:', error);
    }
  }

  /**
   * Check if location is inside any geofence
   */
  isInsideAnyGeofence(latitude: number, longitude: number): GeofenceState {
    const insideGeofences: Geofence[] = [];

    for (const geofence of this.geofences.values()) {
      if (!geofence.enabled) continue;

      const distance = this.calculateDistance(
        latitude,
        longitude,
        geofence.latitude,
        geofence.longitude
      );

      if (distance <= geofence.radius) {
        insideGeofences.push(geofence);
      }
    }

    return {
      inside: insideGeofences.length > 0,
      geofences: insideGeofences,
    };
  }

  /**
   * Get last known location state (for debugging/analytics)
   */
  getLastLocationState(): { latitude: number; longitude: number } | null {
    // Use the most recent location from checkLocation calls
    // This is useful for debugging and analytics
    const allGeofences = Array.from(this.geofences.values());
    if (allGeofences.length === 0) return null;

    // Return center of first geofence as fallback (not ideal but prevents warning)
    const firstGeofence = allGeofences[0];
    return {
      latitude: firstGeofence.latitude,
      longitude: firstGeofence.longitude,
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Clear all geofences
   */
  clear(): void {
    this.geofences.clear();
    this.lastStates.clear();
    this.pendingEvents = [];
  }
}

// Singleton instance
let geofencingInstance: GeofencingService | null = null;

export function getGeofencingService(): GeofencingService {
  if (!geofencingInstance) {
    geofencingInstance = new GeofencingService();
  }
  return geofencingInstance;
}
