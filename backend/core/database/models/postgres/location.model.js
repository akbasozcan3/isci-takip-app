/**
 * PostgreSQL Location Model
 * World-class GPS tracking system - Location points management
 */

const { getPostgresDB } = require('../../../config/postgres');

class LocationModel {
  /**
   * Add location point
   */
  static async add(deviceId, userId, locationData, sessionId = null) {
    const db = getPostgresDB();
    if (!db) return null;

    // First, get device UUID from device_id
    const deviceQuery = 'SELECT id FROM devices WHERE device_id = $1';
    const deviceResult = await db.query(deviceQuery, [deviceId]);
    
    if (deviceResult.rows.length === 0) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const deviceUuid = deviceResult.rows[0].id;

    const query = `
      INSERT INTO location_points (
        device_id, user_id, session_id, latitude, longitude,
        accuracy, heading, speed, altitude, timestamp, metadata, geocode
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const timestamp = locationData.timestamp 
      ? new Date(locationData.timestamp)
      : new Date();

    const values = [
      deviceUuid,
      userId,
      sessionId,
      locationData.coords.latitude,
      locationData.coords.longitude,
      locationData.coords.accuracy || null,
      locationData.coords.heading || null,
      locationData.coords.speed || null,
      locationData.coords.altitude || null,
      timestamp,
      locationData.metadata ? JSON.stringify(locationData.metadata) : null,
      locationData.geocode ? JSON.stringify(locationData.geocode) : null,
    ];

    const result = await db.query(query, values);
    return this.mapRowToLocation(result.rows[0]);
  }

  /**
   * Batch add location points
   */
  static async batchAdd(deviceId, userId, locations, sessionId = null) {
    const db = getPostgresDB();
    if (!db) return [];

    // Get device UUID
    const deviceQuery = 'SELECT id FROM devices WHERE device_id = $1';
    const deviceResult = await db.query(deviceQuery, [deviceId]);
    
    if (deviceResult.rows.length === 0) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const deviceUuid = deviceResult.rows[0].id;

    // Prepare batch insert
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const locationData of locations) {
      const timestamp = locationData.timestamp 
        ? new Date(locationData.timestamp)
        : new Date();

      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );

      values.push(
        deviceUuid,
        userId,
        sessionId,
        locationData.coords.latitude,
        locationData.coords.longitude,
        locationData.coords.accuracy || null,
        locationData.coords.heading || null,
        locationData.coords.speed || null,
        locationData.coords.altitude || null,
        timestamp,
        locationData.metadata ? JSON.stringify(locationData.metadata) : null,
        locationData.geocode ? JSON.stringify(locationData.geocode) : null,
      );
    }

    const query = `
      INSERT INTO location_points (
        device_id, user_id, session_id, latitude, longitude,
        accuracy, heading, speed, altitude, timestamp, metadata, geocode
      ) VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows.map(row => this.mapRowToLocation(row));
  }

  /**
   * Get location points for device
   */
  static async getByDeviceId(deviceId, limit = 1000, offset = 0, startDate = null, endDate = null) {
    const db = getPostgresDB();
    if (!db) return [];

    let query = `
      SELECT lp.* FROM location_points lp
      INNER JOIN devices d ON lp.device_id = d.id
      WHERE d.device_id = $1
    `;

    const values = [deviceId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND lp.timestamp >= $${paramIndex++}`;
      values.push(new Date(startDate));
    }

    if (endDate) {
      query += ` AND lp.timestamp <= $${paramIndex++}`;
      values.push(new Date(endDate));
    }

    query += ` ORDER BY lp.timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const result = await db.query(query, values);
    return result.rows.map(row => this.mapRowToLocation(row));
  }

  /**
   * Get location points for user
   */
  static async getByUserId(userId, limit = 1000, offset = 0, startDate = null, endDate = null) {
    const db = getPostgresDB();
    if (!db) return [];

    let query = 'SELECT * FROM location_points WHERE user_id = $1';
    const values = [userId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      values.push(new Date(startDate));
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      values.push(new Date(endDate));
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const result = await db.query(query, values);
    return result.rows.map(row => this.mapRowToLocation(row));
  }

  /**
   * Delete location points (for data retention)
   */
  static async deleteOldPoints(beforeDate) {
    const db = getPostgresDB();
    if (!db) return 0;

    const query = 'DELETE FROM location_points WHERE timestamp < $1';
    const result = await db.query(query, [new Date(beforeDate)]);
    return result.rowCount;
  }

  /**
   * Map database row to location object
   */
  static mapRowToLocation(row) {
    if (!row) return null;

    return {
      id: row.id,
      device_id: row.device_id,
      user_id: row.user_id,
      session_id: row.session_id,
      timestamp: row.timestamp,
      coords: {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy,
        heading: row.heading,
        speed: row.speed,
        altitude: row.altitude,
      },
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
      geocode: row.geocode ? (typeof row.geocode === 'string' ? JSON.parse(row.geocode) : row.geocode) : null,
      created_at: row.created_at,
    };
  }
}

module.exports = LocationModel;

