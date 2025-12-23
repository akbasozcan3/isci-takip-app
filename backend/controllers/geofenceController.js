/**
 * Geofence Controller
 * World-class GPS tracking - Geofence management and event tracking
 */

const db = require('../config/database');
const { logger } = require('../core/utils/logger');
const ResponseFormatter = require('../core/utils/responseFormatter');
const postgres = require('../config/postgres');

function getUserIdFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const jwt = require('jsonwebtoken');
    const tokenData = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return tokenData.userId || tokenData.id;
  } catch (error) {
    return null;
  }
}

class GeofenceController {
  /**
   * Create geofence
   */
  async createGeofence(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const {
        name,
        latitude,
        longitude,
        radius,
        type = 'custom',
        enabled = true,
        notifyOnEnter = true,
        notifyOnExit = true,
        enterMessage,
        exitMessage,
        groupId,
        metadata,
      } = req.body || {};

      if (!name || latitude === undefined || longitude === undefined || !radius) {
        return res.status(400).json(ResponseFormatter.error('İsim, enlem, boylam ve yarıçap gereklidir', 'MISSING_DATA'));
      }

      const geofenceData = {
        userId,
        groupId: groupId || null,
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius),
        type: type || 'custom',
        enabled: enabled !== false,
        notifyOnEnter: notifyOnEnter !== false,
        notifyOnExit: notifyOnExit !== false,
        enterMessage: enterMessage || null,
        exitMessage: exitMessage || null,
        metadata: metadata || {},
      };

      let geofenceId;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `INSERT INTO geofences (user_id, group_id, name, latitude, longitude, radius, type, enabled, 
             notify_on_enter, notify_on_exit, enter_message, exit_message, metadata)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
             RETURNING id`,
            [
              userId,
              geofenceData.groupId,
              geofenceData.name,
              geofenceData.latitude,
              geofenceData.longitude,
              geofenceData.radius,
              geofenceData.type,
              geofenceData.enabled,
              geofenceData.notifyOnEnter,
              geofenceData.notifyOnExit,
              geofenceData.enterMessage,
              geofenceData.exitMessage,
              JSON.stringify(geofenceData.metadata),
            ]
          );
          geofenceId = result.rows[0].id;
        } catch (pgError) {
          console.warn('[Geofence] PostgreSQL insert failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          if (!db.data.geofences) db.data.geofences = [];
          geofenceId = `gf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          db.data.geofences.push({
            id: geofenceId,
            ...geofenceData,
            createdAt: new Date().toISOString(),
          });
          db.scheduleSave();
        }
      } else {
        if (!db.data.geofences) db.data.geofences = [];
        geofenceId = `gf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        db.data.geofences.push({
          id: geofenceId,
          ...geofenceData,
          createdAt: new Date().toISOString(),
        });
        db.scheduleSave();
      }

      logger.info(`[Geofence] Geofence created: ${geofenceId} by user ${userId}`);

      return res.status(200).json(ResponseFormatter.success({
        id: geofenceId,
        ...geofenceData,
        message: 'Geofence oluşturuldu',
      }));
    } catch (error) {
      logger.error('[Geofence] Create geofence error:', error);
      return res.status(500).json(ResponseFormatter.error('Geofence oluşturulamadı', 'CREATE_GEOFENCE_ERROR'));
    }
  }

  /**
   * Get user's geofences
   */
  async getGeofences(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { groupId } = req.query || {};

      let geofences = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const query = groupId
            ? `SELECT * FROM geofences WHERE (user_id = $1::uuid OR group_id = $2::uuid) AND enabled = true ORDER BY name`
            : `SELECT * FROM geofences WHERE user_id = $1::uuid ORDER BY name`;
          const result = await postgres.query(query, [userId, groupId].filter(Boolean));
          geofences = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            latitude: row.latitude,
            longitude: row.longitude,
            radius: row.radius,
            type: row.type,
            enabled: row.enabled,
            notifyOnEnter: row.notify_on_enter,
            notifyOnExit: row.notify_on_exit,
            enterMessage: row.enter_message,
            exitMessage: row.exit_message,
            groupId: row.group_id,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        } catch (pgError) {
          console.warn('[Geofence] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      }

      // JSON fallback
      if (geofences.length === 0) {
        const allGeofences = db.data.geofences || [];
        geofences = allGeofences
          .filter(g => {
            if (groupId) {
              return (g.userId === userId || g.groupId === groupId) && g.enabled;
            }
            return g.userId === userId;
          })
          .map(g => ({
            id: g.id,
            name: g.name,
            latitude: g.latitude,
            longitude: g.longitude,
            radius: g.radius,
            type: g.type,
            enabled: g.enabled,
            notifyOnEnter: g.notifyOnEnter,
            notifyOnExit: g.notifyOnExit,
            enterMessage: g.enterMessage,
            exitMessage: g.exitMessage,
            groupId: g.groupId,
            metadata: g.metadata,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
          }));
      }

      return res.status(200).json(ResponseFormatter.success({
        geofences,
        count: geofences.length,
      }));
    } catch (error) {
      logger.error('[Geofence] Get geofences error:', error);
      return res.status(500).json(ResponseFormatter.error('Geofence\'ler alınamadı', 'GET_GEOFENCES_ERROR'));
    }
  }

  /**
   * Update geofence
   */
  async updateGeofence(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { id } = req.params;
      const updateData = req.body || {};

      // Verify ownership
      let geofence = null;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `SELECT * FROM geofences WHERE id = $1::uuid AND user_id = $2::uuid`,
            [id, userId]
          );
          geofence = result.rows[0] || null;
        } catch (pgError) {
          console.warn('[Geofence] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      }

      if (!geofence) {
        const allGeofences = db.data.geofences || [];
        geofence = allGeofences.find(g => g.id === id && g.userId === userId);
      }

      if (!geofence) {
        return res.status(404).json(ResponseFormatter.error('Geofence bulunamadı', 'GEOFENCE_NOT_FOUND'));
      }

      // Update fields
      const updatedData = {
        name: updateData.name !== undefined ? updateData.name : geofence.name,
        latitude: updateData.latitude !== undefined ? parseFloat(updateData.latitude) : geofence.latitude,
        longitude: updateData.longitude !== undefined ? parseFloat(updateData.longitude) : geofence.longitude,
        radius: updateData.radius !== undefined ? parseFloat(updateData.radius) : geofence.radius,
        type: updateData.type !== undefined ? updateData.type : geofence.type,
        enabled: updateData.enabled !== undefined ? updateData.enabled : geofence.enabled,
        notifyOnEnter: updateData.notifyOnEnter !== undefined ? updateData.notifyOnEnter : geofence.notify_on_enter || geofence.notifyOnEnter,
        notifyOnExit: updateData.notifyOnExit !== undefined ? updateData.notifyOnExit : geofence.notify_on_exit || geofence.notifyOnExit,
        enterMessage: updateData.enterMessage !== undefined ? updateData.enterMessage : geofence.enter_message || geofence.enterMessage,
        exitMessage: updateData.exitMessage !== undefined ? updateData.exitMessage : geofence.exit_message || geofence.exitMessage,
        metadata: updateData.metadata !== undefined ? updateData.metadata : geofence.metadata,
      };

      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          await postgres.query(
            `UPDATE geofences 
             SET name = $1, latitude = $2, longitude = $3, radius = $4, type = $5, enabled = $6,
                 notify_on_enter = $7, notify_on_exit = $8, enter_message = $9, exit_message = $10,
                 metadata = $11::jsonb, updated_at = NOW()
             WHERE id = $12::uuid AND user_id = $13::uuid`,
            [
              updatedData.name,
              updatedData.latitude,
              updatedData.longitude,
              updatedData.radius,
              updatedData.type,
              updatedData.enabled,
              updatedData.notifyOnEnter,
              updatedData.notifyOnExit,
              updatedData.enterMessage,
              updatedData.exitMessage,
              JSON.stringify(updatedData.metadata),
              id,
              userId,
            ]
          );
        } catch (pgError) {
          console.warn('[Geofence] PostgreSQL update failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          const index = db.data.geofences.findIndex(g => g.id === id);
          if (index >= 0) {
            db.data.geofences[index] = {
              ...db.data.geofences[index],
              ...updatedData,
              updatedAt: new Date().toISOString(),
            };
            db.scheduleSave();
          }
        }
      } else {
        const index = db.data.geofences.findIndex(g => g.id === id);
        if (index >= 0) {
          db.data.geofences[index] = {
            ...db.data.geofences[index],
            ...updatedData,
            updatedAt: new Date().toISOString(),
          };
          db.scheduleSave();
        }
      }

      logger.info(`[Geofence] Geofence updated: ${id} by user ${userId}`);

      return res.status(200).json(ResponseFormatter.success({
        id,
        ...updatedData,
        message: 'Geofence güncellendi',
      }));
    } catch (error) {
      logger.error('[Geofence] Update geofence error:', error);
      return res.status(500).json(ResponseFormatter.error('Geofence güncellenemedi', 'UPDATE_GEOFENCE_ERROR'));
    }
  }

  /**
   * Delete geofence
   */
  async deleteGeofence(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { id } = req.params;

      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `DELETE FROM geofences WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
            [id, userId]
          );
          if (result.rows.length === 0) {
            return res.status(404).json(ResponseFormatter.error('Geofence bulunamadı', 'GEOFENCE_NOT_FOUND'));
          }
        } catch (pgError) {
          console.warn('[Geofence] PostgreSQL delete failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          const index = db.data.geofences.findIndex(g => g.id === id && g.userId === userId);
          if (index >= 0) {
            db.data.geofences.splice(index, 1);
            db.scheduleSave();
          } else {
            return res.status(404).json(ResponseFormatter.error('Geofence bulunamadı', 'GEOFENCE_NOT_FOUND'));
          }
        }
      } else {
        const index = db.data.geofences.findIndex(g => g.id === id && g.userId === userId);
        if (index >= 0) {
          db.data.geofences.splice(index, 1);
          db.scheduleSave();
        } else {
          return res.status(404).json(ResponseFormatter.error('Geofence bulunamadı', 'GEOFENCE_NOT_FOUND'));
        }
      }

      logger.info(`[Geofence] Geofence deleted: ${id} by user ${userId}`);

      return res.status(200).json(ResponseFormatter.success({
        id,
        message: 'Geofence silindi',
      }));
    } catch (error) {
      logger.error('[Geofence] Delete geofence error:', error);
      return res.status(500).json(ResponseFormatter.error('Geofence silinemedi', 'DELETE_GEOFENCE_ERROR'));
    }
  }

  /**
   * Log geofence event
   */
  async logEvent(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const {
        geofenceId,
        deviceId,
        eventType,
        latitude,
        longitude,
        timestamp,
        metadata,
      } = req.body || {};

      if (!geofenceId || !eventType || latitude === undefined || longitude === undefined) {
        return res.status(400).json(ResponseFormatter.error('Geofence ID, event type ve konum gereklidir', 'MISSING_DATA'));
      }

      const eventData = {
        geofenceId,
        userId,
        deviceId: deviceId || null,
        eventType: eventType === 'enter' ? 'enter' : 'exit',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        metadata: metadata || {},
      };

      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          await postgres.query(
            `INSERT INTO geofence_events (geofence_id, user_id, device_id, event_type, latitude, longitude, timestamp, metadata)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::jsonb)`,
            [
              eventData.geofenceId,
              userId,
              eventData.deviceId,
              eventData.eventType,
              eventData.latitude,
              eventData.longitude,
              eventData.timestamp,
              JSON.stringify(eventData.metadata),
            ]
          );
        } catch (pgError) {
          console.warn('[Geofence] PostgreSQL insert failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          if (!db.data.geofenceEvents) db.data.geofenceEvents = [];
          db.data.geofenceEvents.push({
            id: `gfe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            ...eventData,
            createdAt: new Date().toISOString(),
          });
          db.scheduleSave();
        }
      } else {
        if (!db.data.geofenceEvents) db.data.geofenceEvents = [];
        db.data.geofenceEvents.push({
          id: `gfe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          ...eventData,
          createdAt: new Date().toISOString(),
        });
        db.scheduleSave();
      }

      logger.info(`[Geofence] Event logged: ${eventData.eventType} for geofence ${geofenceId}`);

      return res.status(200).json(ResponseFormatter.success({
        message: 'Geofence olayı kaydedildi',
      }));
    } catch (error) {
      logger.error('[Geofence] Log event error:', error);
      return res.status(500).json(ResponseFormatter.error('Olay kaydedilemedi', 'LOG_EVENT_ERROR'));
    }
  }

  /**
   * Get geofence events
   */
  async getEvents(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { geofenceId, startDate, endDate, limit = 50 } = req.query || {};
      const start = startDate ? new Date(startDate) : new Date();
      start.setDate(start.getDate() - 7);
      const end = endDate ? new Date(endDate) : new Date();

      let events = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          let query = `SELECT * FROM geofence_events 
                       WHERE user_id = $1::uuid AND timestamp >= $2 AND timestamp <= $3`;
          const params = [userId, start, end];

          if (geofenceId) {
            query += ` AND geofence_id = $4::uuid`;
            params.push(geofenceId);
          }

          query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
          params.push(parseInt(limit));

          const result = await postgres.query(query, params);
          events = result.rows.map(row => ({
            id: row.id,
            geofenceId: row.geofence_id,
            eventType: row.event_type,
            latitude: row.latitude,
            longitude: row.longitude,
            timestamp: row.timestamp,
            deviceId: row.device_id,
            metadata: row.metadata,
          }));
        } catch (pgError) {
          console.warn('[Geofence] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      }

      // JSON fallback
      if (events.length === 0) {
        const allEvents = db.data.geofenceEvents || [];
        events = allEvents
          .filter(e => {
            const eventTime = new Date(e.timestamp);
            return e.userId === userId &&
                   eventTime >= start &&
                   eventTime <= end &&
                   (!geofenceId || e.geofenceId === geofenceId);
          })
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, parseInt(limit))
          .map(e => ({
            id: e.id,
            geofenceId: e.geofenceId,
            eventType: e.eventType,
            latitude: e.latitude,
            longitude: e.longitude,
            timestamp: e.timestamp,
            deviceId: e.deviceId,
            metadata: e.metadata,
          }));
      }

      return res.status(200).json(ResponseFormatter.success({
        events,
        count: events.length,
      }));
    } catch (error) {
      logger.error('[Geofence] Get events error:', error);
      return res.status(500).json(ResponseFormatter.error('Olaylar alınamadı', 'GET_EVENTS_ERROR'));
    }
  }
}

module.exports = new GeofenceController();

