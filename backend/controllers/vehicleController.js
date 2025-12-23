/**
 * Vehicle Controller
 * World-class GPS tracking - Vehicle management and tracking
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

class VehicleController {
  /**
   * Create or update vehicle
   */
  async createVehicle(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { name, plateNumber, vehicleType, maxSpeed, fuelType, fuelCapacity, groupId } = req.body || {};

      if (!name) {
        return res.status(400).json(ResponseFormatter.error('Araç adı gereklidir', 'MISSING_NAME'));
      }

      const vehicleData = {
        userId,
        groupId: groupId || null,
        name,
        plateNumber: plateNumber || null,
        vehicleType: vehicleType || 'car',
        maxSpeed: maxSpeed ? parseFloat(maxSpeed) : null,
        fuelType: fuelType || null,
        fuelCapacity: fuelCapacity ? parseFloat(fuelCapacity) : null,
        isActive: true,
      };

      let vehicleId;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `INSERT INTO vehicles (user_id, group_id, name, plate_number, vehicle_type, max_speed, fuel_type, fuel_capacity, is_active)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              userId,
              vehicleData.groupId,
              vehicleData.name,
              vehicleData.plateNumber,
              vehicleData.vehicleType,
              vehicleData.maxSpeed,
              vehicleData.fuelType,
              vehicleData.fuelCapacity,
              true,
            ]
          );
          vehicleId = result.rows[0].id;
        } catch (pgError) {
          console.warn('[Vehicle] PostgreSQL insert failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          if (!db.data.vehicles) db.data.vehicles = [];
          vehicleId = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          db.data.vehicles.push({
            id: vehicleId,
            ...vehicleData,
            createdAt: new Date().toISOString(),
          });
          db.scheduleSave();
        }
      } else {
        if (!db.data.vehicles) db.data.vehicles = [];
        vehicleId = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        db.data.vehicles.push({
          id: vehicleId,
          ...vehicleData,
          createdAt: new Date().toISOString(),
        });
        db.scheduleSave();
      }

      logger.info(`[Vehicle] Vehicle created: ${vehicleId} by user ${userId}`);

      return res.status(200).json(ResponseFormatter.success({
        vehicleId,
        ...vehicleData,
        message: 'Araç oluşturuldu',
      }));
    } catch (error) {
      logger.error('[Vehicle] Create vehicle error:', error);
      return res.status(500).json(ResponseFormatter.error('Araç oluşturulamadı', 'CREATE_VEHICLE_ERROR'));
    }
  }

  /**
   * Start vehicle session
   */
  async startSession(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { vehicleId, deviceId, location } = req.body || {};

      if (!vehicleId) {
        return res.status(400).json(ResponseFormatter.error('Araç ID gereklidir', 'MISSING_VEHICLE_ID'));
      }

      if (!location || !location.latitude || !location.longitude) {
        return res.status(400).json(ResponseFormatter.error('Konum bilgisi gereklidir', 'MISSING_LOCATION'));
      }

      // Check if vehicle exists and user has access
      let vehicle = null;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `SELECT * FROM vehicles WHERE id = $1::uuid AND (user_id = $2::uuid OR group_id IN (SELECT group_id FROM groups WHERE user_id = $2::uuid))`,
            [vehicleId, userId]
          );
          vehicle = result.rows[0] || null;
        } catch (pgError) {
          console.warn('[Vehicle] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        vehicle = (db.data.vehicles || []).find(v => v.id === vehicleId && (v.userId === userId || v.groupId));
      }

      if (!vehicle) {
        return res.status(404).json(ResponseFormatter.error('Araç bulunamadı', 'VEHICLE_NOT_FOUND'));
      }

      // Check for active session
      let activeSession = null;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const sessionResult = await postgres.query(
            `SELECT * FROM vehicle_sessions 
             WHERE vehicle_id = $1::uuid AND is_active = true AND ended_at IS NULL
             ORDER BY started_at DESC LIMIT 1`,
            [vehicleId]
          );
          activeSession = sessionResult.rows[0] || null;
        } catch (pgError) {
          console.warn('[Vehicle] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        activeSession = (db.data.vehicleSessions || []).find(s => 
          s.vehicleId === vehicleId && s.isActive && !s.endedAt
        );
      }

      if (activeSession) {
        return res.status(400).json(ResponseFormatter.error('Aktif araç seansı zaten var', 'ACTIVE_SESSION_EXISTS'));
      }

      const sessionData = {
        vehicleId,
        userId,
        deviceId: deviceId || null,
        startedAt: new Date(),
        startLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
          address: location.address || null,
        },
        isActive: true,
      };

      let sessionId;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `INSERT INTO vehicle_sessions (vehicle_id, user_id, device_id, started_at, start_location, is_active)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6)
             RETURNING id`,
            [
              vehicleId,
              userId,
              deviceId || null,
              sessionData.startedAt,
              JSON.stringify(sessionData.startLocation),
              true,
            ]
          );
          sessionId = result.rows[0].id;
        } catch (pgError) {
          console.warn('[Vehicle] PostgreSQL insert failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          if (!db.data.vehicleSessions) db.data.vehicleSessions = [];
          sessionId = `vsess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          db.data.vehicleSessions.push({
            id: sessionId,
            ...sessionData,
            createdAt: new Date().toISOString(),
          });
          db.scheduleSave();
        }
      } else {
        if (!db.data.vehicleSessions) db.data.vehicleSessions = [];
        sessionId = `vsess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        db.data.vehicleSessions.push({
          id: sessionId,
          ...sessionData,
          createdAt: new Date().toISOString(),
        });
        db.scheduleSave();
      }

      logger.info(`[Vehicle] Session started: ${sessionId} for vehicle ${vehicleId}`);

      return res.status(200).json(ResponseFormatter.success({
        sessionId,
        vehicleId,
        startedAt: sessionData.startedAt.toISOString(),
        message: 'Araç seansı başlatıldı',
      }));
    } catch (error) {
      logger.error('[Vehicle] Start session error:', error);
      return res.status(500).json(ResponseFormatter.error('Araç seansı başlatılamadı', 'START_SESSION_ERROR'));
    }
  }

  /**
   * Log speed violation
   */
  async logSpeedViolation(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { vehicleId, vehicleSessionId, speed, speedLimit, location, duration } = req.body || {};

      if (!vehicleId || !speed || !speedLimit) {
        return res.status(400).json(ResponseFormatter.error('Araç ID, hız ve hız limiti gereklidir', 'MISSING_DATA'));
      }

      const severity = speed > speedLimit * 1.5 ? 'severe' : speed > speedLimit * 1.2 ? 'moderate' : 'minor';

      const violationData = {
        vehicleId,
        vehicleSessionId: vehicleSessionId || null,
        userId,
        speed: parseFloat(speed),
        speedLimit: parseFloat(speedLimit),
        location: location || null,
        timestamp: new Date(),
        duration: duration ? parseInt(duration) : null,
        severity,
      };

      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          await postgres.query(
            `INSERT INTO speed_violations (vehicle_id, vehicle_session_id, user_id, speed, speed_limit, location, timestamp, duration, severity)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8, $9)`,
            [
              vehicleId,
              violationData.vehicleSessionId,
              userId,
              violationData.speed,
              violationData.speedLimit,
              violationData.location ? JSON.stringify(violationData.location) : null,
              violationData.timestamp,
              violationData.duration,
              severity,
            ]
          );
        } catch (pgError) {
          console.warn('[Vehicle] PostgreSQL insert failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          if (!db.data.speedViolations) db.data.speedViolations = [];
          db.data.speedViolations.push({
            id: `sv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            ...violationData,
            createdAt: new Date().toISOString(),
          });
          db.scheduleSave();
        }
      } else {
        if (!db.data.speedViolations) db.data.speedViolations = [];
        db.data.speedViolations.push({
          id: `sv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          ...violationData,
          createdAt: new Date().toISOString(),
        });
        db.scheduleSave();
      }

      logger.warn(`[Vehicle] Speed violation logged: ${speed} km/h (limit: ${speedLimit} km/h) for vehicle ${vehicleId}`);

      return res.status(200).json(ResponseFormatter.success({
        severity,
        message: 'Hız ihlali kaydedildi',
      }));
    } catch (error) {
      logger.error('[Vehicle] Log speed violation error:', error);
      return res.status(500).json(ResponseFormatter.error('Hız ihlali kaydedilemedi', 'LOG_VIOLATION_ERROR'));
    }
  }

  /**
   * Get vehicle list
   */
  async getVehicles(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { groupId } = req.query || {};

      let vehicles = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const query = groupId
            ? `SELECT * FROM vehicles WHERE group_id = $1::uuid AND is_active = true ORDER BY name`
            : `SELECT * FROM vehicles WHERE user_id = $1::uuid AND is_active = true ORDER BY name`;
          const result = await postgres.query(query, [groupId || userId]);
          vehicles = result.rows;
        } catch (pgError) {
          console.warn('[Vehicle] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        vehicles = (db.data.vehicles || []).filter(v => 
          v.isActive && (groupId ? v.groupId === groupId : v.userId === userId)
        );
      }

      return res.status(200).json(ResponseFormatter.success({
        vehicles,
        count: vehicles.length,
      }));
    } catch (error) {
      logger.error('[Vehicle] Get vehicles error:', error);
      return res.status(500).json(ResponseFormatter.error('Araçlar alınamadı', 'GET_VEHICLES_ERROR'));
    }
  }
}

module.exports = new VehicleController();

