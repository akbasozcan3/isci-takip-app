/**
 * Offline Storage System
 * World-class GPS tracking - SQLite for offline data storage and sync
 */

// Optional import for expo-sqlite (may require native build)
// Using lazy loading to avoid Metro bundler errors if package is not available
let SQLiteModule: any = null;
let SQLiteModuleChecked = false;

function getSQLiteModule() {
  if (SQLiteModuleChecked) {
    return SQLiteModule;
  }
  
  SQLiteModuleChecked = true;
  
  // Try to load expo-sqlite module
  // Metro bundler may fail if package is not installed, so we catch and use fallback
  try {
    // @ts-ignore - Optional dependency, may not be installed
    const sqliteLib = require('expo-sqlite');
    if (sqliteLib && typeof sqliteLib.openDatabaseAsync === 'function') {
      SQLiteModule = sqliteLib;
      return SQLiteModule;
    }
  } catch (e) {
    // Module not found or not available - use fallback
    // This is expected if expo-sqlite is not installed
  }
  
  // Fallback implementation when expo-sqlite is not available
  // This will use in-memory storage as fallback
  SQLiteModule = null;
  
  return SQLiteModule;
}

export interface OfflineLocation {
  id?: number;
  deviceId: string;
  userId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  altitude?: number;
  synced: boolean;
  metadata?: string; // JSON string
}

export interface OfflineStep {
  id?: number;
  userId: string;
  deviceId: string;
  date: string; // YYYY-MM-DD
  steps: number;
  distance?: number;
  calories?: number;
  duration?: number;
  synced: boolean;
}

class OfflineStorage {
  private db: any = null;
  private initialized = false;

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.db) {
      return;
    }

    const SQLite = getSQLiteModule();
    
    if (!SQLite) {
      // Use in-memory fallback storage
      console.warn('[OfflineStorage] expo-sqlite not available, using in-memory fallback');
      this.initialized = true;
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync('bavaxe_offline.db');
      
      // Create tables
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          heading REAL,
          speed REAL,
          altitude REAL,
          synced INTEGER DEFAULT 0,
          metadata TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS offline_steps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          date TEXT NOT NULL,
          steps INTEGER NOT NULL,
          distance REAL,
          calories REAL,
          duration INTEGER,
          synced INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          UNIQUE(user_id, device_id, date)
        );

        CREATE TABLE IF NOT EXISTS offline_geofences (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          radius REAL NOT NULL,
          type TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          notify_on_enter INTEGER NOT NULL DEFAULT 1,
          notify_on_exit INTEGER NOT NULL DEFAULT 1,
          enter_message TEXT,
          exit_message TEXT,
          group_id TEXT,
          metadata TEXT,
          created_at TEXT,
          updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_locations_synced ON offline_locations(synced, timestamp);
        CREATE INDEX IF NOT EXISTS idx_locations_user ON offline_locations(user_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_steps_synced ON offline_steps(synced, date);
        CREATE INDEX IF NOT EXISTS idx_steps_user ON offline_steps(user_id, date);
      `);

      this.initialized = true;
      console.log('[OfflineStorage] ✅ Database initialized');
    } catch (error) {
      console.error('[OfflineStorage] ❌ Initialization error:', error);
      throw error;
    }
  }

  /**
   * Store location offline
   */
  async storeLocation(location: Omit<OfflineLocation, 'id' | 'synced'>): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.runAsync(
        `INSERT INTO offline_locations 
         (device_id, user_id, timestamp, latitude, longitude, accuracy, heading, speed, altitude, metadata, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          location.deviceId,
          location.userId,
          location.timestamp,
          location.latitude,
          location.longitude,
          location.accuracy ?? null,
          location.heading ?? null,
          location.speed ?? null,
          location.altitude ?? null,
          location.metadata ? JSON.stringify(location.metadata) : null,
        ]
      );

      return result.lastInsertRowId;
    } catch (error) {
      console.error('[OfflineStorage] Store location error:', error);
      throw error;
    }
  }

  /**
   * Store step data offline
   */
  async storeSteps(step: Omit<OfflineStep, 'id' | 'synced'>): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO offline_steps 
         (user_id, device_id, date, steps, distance, calories, duration, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          step.userId,
          step.deviceId,
          step.date,
          step.steps,
          step.distance ?? null,
          step.calories ?? null,
          step.duration ?? null,
        ]
      );
    } catch (error) {
      console.error('[OfflineStorage] Store steps error:', error);
      throw error;
    }
  }

  /**
   * Get unsynced locations
   */
  async getUnsyncedLocations(limit: number = 100): Promise<OfflineLocation[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return [];
    }

    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM offline_locations 
         WHERE synced = 0 
         ORDER BY timestamp ASC 
         LIMIT ?`,
        [limit]
      );

      return result.map((row: any) => ({
        ...row,
        synced: row.synced === 1,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      console.error('[OfflineStorage] Get unsynced locations error:', error);
      return [];
    }
  }

  /**
   * Get unsynced steps
   */
  async getUnsyncedSteps(): Promise<OfflineStep[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return [];
    }

    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM offline_steps 
         WHERE synced = 0 
         ORDER BY date ASC`
      );

      return result.map((row: any) => ({
        ...row,
        synced: row.synced === 1,
      }));
    } catch (error) {
      console.error('[OfflineStorage] Get unsynced steps error:', error);
      return [];
    }
  }

  /**
   * Mark locations as synced
   */
  async markLocationsSynced(ids: number[]): Promise<void> {
    if (!this.db || ids.length === 0) {
      return;
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      await this.db.runAsync(
        `UPDATE offline_locations 
         SET synced = 1 
         WHERE id IN (${placeholders})`,
        ids
      );
    } catch (error) {
      console.error('[OfflineStorage] Mark locations synced error:', error);
    }
  }

  /**
   * Mark steps as synced
   */
  async markStepsSynced(userId: string, deviceId: string, dates: string[]): Promise<void> {
    if (!this.db || dates.length === 0) {
      return;
    }

    try {
      const placeholders = dates.map(() => '?').join(',');
      await this.db.runAsync(
        `UPDATE offline_steps 
         SET synced = 1 
         WHERE user_id = ? AND device_id = ? AND date IN (${placeholders})`,
        [userId, deviceId, ...dates]
      );
    } catch (error) {
      console.error('[OfflineStorage] Mark steps synced error:', error);
    }
  }

  /**
   * Get count of unsynced items
   */
  async getUnsyncedCount(): Promise<{ locations: number; steps: number }> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return { locations: 0, steps: 0 };
    }

    try {
      const [locationResult, stepResult] = await Promise.all([
        this.db.getFirstAsync(
          `SELECT COUNT(*) as count FROM offline_locations WHERE synced = 0`
        ),
        this.db.getFirstAsync(
          `SELECT COUNT(*) as count FROM offline_steps WHERE synced = 0`
        ),
      ]);

      return {
        locations: locationResult?.count || 0,
        steps: stepResult?.count || 0,
      };
    } catch (error) {
      console.error('[OfflineStorage] Get unsynced count error:', error);
      return { locations: 0, steps: 0 };
    }
  }

  /**
   * Clear old synced data (older than days)
   */
  async clearOldData(days: number = 30): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
      
      await Promise.all([
        this.db.runAsync(
          `DELETE FROM offline_locations 
           WHERE synced = 1 AND timestamp < ?`,
          [cutoffTime]
        ),
        this.db.runAsync(
          `DELETE FROM offline_steps 
           WHERE synced = 1 AND created_at < ?`,
          [Math.floor(cutoffTime / 1000)]
        ),
      ]);
    } catch (error) {
      console.error('[OfflineStorage] Clear old data error:', error);
    }
  }

  /**
   * Save geofences to offline storage
   */
  async saveGeofences(geofences: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    type: string;
    enabled: boolean;
    notifyOnEnter: boolean;
    notifyOnExit: boolean;
    enterMessage?: string;
    exitMessage?: string;
    groupId?: string;
    metadata?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
  }>): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return;
    }

    try {
      // Clear existing
      await this.db.runAsync('DELETE FROM offline_geofences');

      // Insert all
      for (const geofence of geofences) {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO offline_geofences 
           (id, name, latitude, longitude, radius, type, enabled, notify_on_enter, notify_on_exit, 
            enter_message, exit_message, group_id, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            geofence.id,
            geofence.name,
            geofence.latitude,
            geofence.longitude,
            geofence.radius,
            geofence.type,
            geofence.enabled ? 1 : 0,
            geofence.notifyOnEnter ? 1 : 0,
            geofence.notifyOnExit ? 1 : 0,
            geofence.enterMessage || null,
            geofence.exitMessage || null,
            geofence.groupId || null,
            geofence.metadata ? JSON.stringify(geofence.metadata) : null,
            geofence.createdAt || new Date().toISOString(),
            geofence.updatedAt || new Date().toISOString(),
          ]
        );
      }
    } catch (error) {
      console.error('[OfflineStorage] Save geofences error:', error);
    }
  }

  /**
   * Get geofences from offline storage
   */
  async getGeofences(): Promise<Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    type: string;
    enabled: boolean;
    notifyOnEnter: boolean;
    notifyOnExit: boolean;
    enterMessage?: string;
    exitMessage?: string;
    groupId?: string;
    metadata?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
  }>> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      return [];
    }

    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM offline_geofences ORDER BY name`
      );

      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        radius: row.radius,
        type: row.type,
        enabled: row.enabled === 1,
        notifyOnEnter: row.notify_on_enter === 1,
        notifyOnExit: row.notify_on_exit === 1,
        enterMessage: row.enter_message || undefined,
        exitMessage: row.exit_message || undefined,
        groupId: row.group_id || undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('[OfflineStorage] Get geofences error:', error);
      return [];
    }
  }
}

// Singleton instance
let storageInstance: OfflineStorage | null = null;

export function getOfflineStorage(): OfflineStorage {
  if (!storageInstance) {
    storageInstance = new OfflineStorage();
  }
  return storageInstance;
}

