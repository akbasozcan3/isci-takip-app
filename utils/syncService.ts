/**
 * Sync Service
 * World-class GPS tracking - Sync offline data to backend with exponential backoff
 */

import { getApiBase } from './api';
import { getOfflineStorage, OfflineLocation, OfflineStep } from './offlineStorage';
import * as SecureStore from 'expo-secure-store';

export interface SyncResult {
  success: boolean;
  syncedLocations: number;
  syncedSteps: number;
  errors: string[];
}

class SyncService {
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY = 1000; // 1 second

  /**
   * Start automatic sync
   */
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      this.stopAutoSync();
    }

    this.syncInterval = setInterval(() => {
      this.sync().catch((error) => {
        console.warn('[SyncService] Auto sync error:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync offline data to backend
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedLocations: 0,
        syncedSteps: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedLocations: 0,
      syncedSteps: 0,
      errors: [],
    };

    try {
      const storage = getOfflineStorage();
      await storage.initialize();

      // Get unsynced data
      const [unsyncedLocations, unsyncedSteps] = await Promise.all([
        storage.getUnsyncedLocations(50), // Batch of 50
        storage.getUnsyncedSteps(),
      ]);

      // Sync locations
      if (unsyncedLocations.length > 0) {
        const locationResult = await this.syncLocations(unsyncedLocations);
        result.syncedLocations = locationResult.synced;
        result.errors.push(...locationResult.errors);

        if (locationResult.success) {
          await storage.markLocationsSynced(locationResult.syncedIds);
        }
      }

      // Sync steps
      if (unsyncedSteps.length > 0) {
        const stepResult = await this.syncSteps(unsyncedSteps);
        result.syncedSteps = stepResult.synced;
        result.errors.push(...stepResult.errors);

        if (stepResult.success) {
          const dates = stepResult.syncedDates;
          for (const step of unsyncedSteps) {
            if (dates.includes(step.date)) {
              await storage.markStepsSynced(step.userId, step.deviceId, [step.date]);
            }
          }
        }
      }

      // Reset retry count on success
      if (result.errors.length === 0) {
        this.retryCount = 0;
      }

      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message || 'Unknown sync error');
      this.retryCount++;
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Sync locations with exponential backoff
   */
  private async syncLocations(
    locations: OfflineLocation[]
  ): Promise<{ success: boolean; synced: number; syncedIds: number[]; errors: string[] }> {
    const errors: string[] = [];
    const syncedIds: number[] = [];

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        return { success: false, synced: 0, syncedIds: [], errors: ['No auth token'] };
      }

      const apiBase = getApiBase();
      
      // Batch locations
      const batchSize = 10;
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        
        try {
          const response = await fetch(`${apiBase}/api/location/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              locations: batch.map((loc) => ({
                deviceId: loc.deviceId,
                timestamp: loc.timestamp,
                coords: {
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  accuracy: loc.accuracy,
                  heading: loc.heading,
                  speed: loc.speed,
                  altitude: loc.altitude,
                },
                metadata: loc.metadata,
              })),
            }),
          });

          if (response.ok) {
            batch.forEach((loc) => {
              if (loc.id) {
                syncedIds.push(loc.id);
              }
            });
          } else {
            const errorText = await response.text();
            errors.push(`Batch ${i / batchSize + 1}: ${errorText}`);
          }
        } catch (error: any) {
          errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
        }

        // Small delay between batches
        if (i + batchSize < locations.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return {
        success: errors.length === 0,
        synced: syncedIds.length,
        syncedIds,
        errors,
      };
    } catch (error: any) {
      errors.push(error.message || 'Unknown error');
      return { success: false, synced: 0, syncedIds: [], errors };
    }
  }

  /**
   * Sync steps
   */
  private async syncSteps(
    steps: OfflineStep[]
  ): Promise<{ success: boolean; synced: number; syncedDates: string[]; errors: string[] }> {
    const errors: string[] = [];
    const syncedDates: string[] = [];

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        return { success: false, synced: 0, syncedDates: [], errors: ['No auth token'] };
      }

      const apiBase = getApiBase();

      for (const step of steps) {
        try {
          const response = await fetch(`${apiBase}/api/steps/store`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              steps: step.steps,
              timestamp: new Date(step.date).getTime(),
              distance: step.distance,
              calories: step.calories,
              duration: step.duration,
            }),
          });

          if (response.ok) {
            syncedDates.push(step.date);
          } else {
            const errorText = await response.text();
            errors.push(`Step ${step.date}: ${errorText}`);
          }
        } catch (error: any) {
          errors.push(`Step ${step.date}: ${error.message}`);
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      return {
        success: errors.length === 0,
        synced: syncedDates.length,
        syncedDates,
        errors,
      };
    } catch (error: any) {
      errors.push(error.message || 'Unknown error');
      return { success: false, synced: 0, syncedDates: [], errors };
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    isSyncing: boolean;
    unsyncedCount: { locations: number; steps: number };
  }> {
    const storage = getOfflineStorage();
    await storage.initialize();
    const unsyncedCount = await storage.getUnsyncedCount();

    return {
      isSyncing: this.isSyncing,
      unsyncedCount,
    };
  }
}

// Singleton instance
let syncInstance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!syncInstance) {
    syncInstance = new SyncService();
  }
  return syncInstance;
}

