/**
 * PostgreSQL Device Model
 * World-class GPS tracking system - Device management
 */

const { getPostgresDB } = require('../../../config/postgres');

class DeviceModel {
  /**
   * Create or update device
   */
  static async upsert(deviceData) {
    const db = getPostgresDB();
    if (!db) return null;

    const query = `
      INSERT INTO devices (
        user_id, device_id, platform, model, os_version, app_version, last_seen, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      ON CONFLICT (device_id) 
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        model = EXCLUDED.model,
        os_version = EXCLUDED.os_version,
        app_version = EXCLUDED.app_version,
        last_seen = NOW(),
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      deviceData.user_id,
      deviceData.device_id,
      deviceData.platform || null,
      deviceData.model || null,
      deviceData.os_version || null,
      deviceData.app_version || null,
      deviceData.is_active !== undefined ? deviceData.is_active : true,
    ];

    const result = await db.query(query, values);
    return this.mapRowToDevice(result.rows[0]);
  }

  /**
   * Find device by ID
   */
  static async findById(id) {
    const db = getPostgresDB();
    if (!db) return null;

    const query = 'SELECT * FROM devices WHERE id = $1';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) return null;
    return this.mapRowToDevice(result.rows[0]);
  }

  /**
   * Find device by device_id
   */
  static async findByDeviceId(deviceId) {
    const db = getPostgresDB();
    if (!db) return null;

    const query = 'SELECT * FROM devices WHERE device_id = $1';
    const result = await db.query(query, [deviceId]);

    if (result.rows.length === 0) return null;
    return this.mapRowToDevice(result.rows[0]);
  }

  /**
   * Find devices by user ID
   */
  static async findByUserId(userId) {
    const db = getPostgresDB();
    if (!db) return [];

    const query = 'SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen DESC';
    const result = await db.query(query, [userId]);

    return result.rows.map(row => this.mapRowToDevice(row));
  }

  /**
   * Update device last seen
   */
  static async updateLastSeen(deviceId) {
    const db = getPostgresDB();
    if (!db) return false;

    const query = 'UPDATE devices SET last_seen = NOW() WHERE device_id = $1';
    await db.query(query, [deviceId]);
    return true;
  }

  /**
   * Map database row to device object
   */
  static mapRowToDevice(row) {
    if (!row) return null;

    return {
      id: row.id,
      user_id: row.user_id,
      device_id: row.device_id,
      platform: row.platform,
      model: row.model,
      os_version: row.os_version,
      app_version: row.app_version,
      last_seen: row.last_seen,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = DeviceModel;

