/**
 * Attendance Controller
 * World-class GPS tracking - Work hours, check-in/out with location
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

class AttendanceController {
  /**
   * Check in - Start work day
   */
  async checkIn(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { deviceId, groupId, location, notes } = req.body || {};
      
      if (!location || !location.latitude || !location.longitude) {
        return res.status(400).json(ResponseFormatter.error('Konum bilgisi gereklidir', 'MISSING_LOCATION'));
      }

      const checkInTime = new Date();
      
      // Check if already checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let existingAttendance = null;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect(); // Ensure connection
          const result = await postgres.query(
            `SELECT * FROM attendance 
             WHERE user_id = $1::uuid AND check_in_time >= $2 AND check_in_time < $3 AND is_active = true
             ORDER BY check_in_time DESC LIMIT 1`,
            [userId, today, tomorrow]
          );
          existingAttendance = result.rows[0] || null;
        } catch (pgError) {
          console.warn('[Attendance] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        // JSON fallback
        const attendances = db.data.attendance || [];
        existingAttendance = attendances.find(a => 
          a.userId === userId && 
          new Date(a.checkInTime) >= today && 
          new Date(a.checkInTime) < tomorrow &&
          a.isActive
        );
      }

      if (existingAttendance && !existingAttendance.check_out_time) {
        return res.status(400).json(ResponseFormatter.error('Zaten mesai başlatılmış', 'ALREADY_CHECKED_IN'));
      }

      const attendanceData = {
        userId,
        deviceId: deviceId || null,
        groupId: groupId || null,
        checkInTime: checkInTime.toISOString(),
        checkInLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
          address: location.address || null,
        },
        status: 'checked_in',
        isActive: true,
        notes: notes || null,
        metadata: {
          platform: req.headers['user-agent'] || null,
        },
      };

      let attendanceId;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect(); // Ensure connection
          const result = await postgres.query(
            `INSERT INTO attendance (user_id, device_id, group_id, check_in_time, check_in_location, status, is_active, notes, metadata)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6, $7, $8, $9::jsonb)
             RETURNING id`,
            [
              userId,
              deviceId || null,
              groupId || null,
              checkInTime,
              JSON.stringify(attendanceData.checkInLocation),
              'checked_in',
              true,
              notes || null,
              JSON.stringify(attendanceData.metadata),
            ]
          );
          attendanceId = result.rows[0].id;
        } catch (pgError) {
          console.warn('[Attendance] PostgreSQL insert failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          if (!db.data.attendance) db.data.attendance = [];
          attendanceId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          db.data.attendance.push({
            id: attendanceId,
            ...attendanceData,
            createdAt: new Date().toISOString(),
          });
          db.scheduleSave();
        }
      } else {
        // JSON fallback
        if (!db.data.attendance) db.data.attendance = [];
        attendanceId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        db.data.attendance.push({
          id: attendanceId,
          ...attendanceData,
          createdAt: new Date().toISOString(),
        });
        db.scheduleSave();
      }

      logger.info(`[Attendance] User ${userId} checked in at ${checkInTime.toISOString()}`);

      return res.status(200).json(ResponseFormatter.success({
        attendanceId,
        checkInTime: checkInTime.toISOString(),
        location: attendanceData.checkInLocation,
        message: 'Mesai başlatıldı',
      }));
    } catch (error) {
      logger.error('[Attendance] Check in error:', error);
      return res.status(500).json(ResponseFormatter.error('Mesai başlatılamadı', 'CHECK_IN_ERROR'));
    }
  }

  /**
   * Check out - End work day
   */
  async checkOut(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { location, notes } = req.body || {};
      const checkOutTime = new Date();

      // Find active attendance
      let attendance = null;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `SELECT * FROM attendance 
             WHERE user_id = $1::uuid AND is_active = true AND check_out_time IS NULL
             ORDER BY check_in_time DESC LIMIT 1`,
            [userId]
          );
          attendance = result.rows[0] || null;
        } catch (pgError) {
          console.warn('[Attendance] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        const attendances = db.data.attendance || [];
        attendance = attendances.find(a => 
          a.userId === userId && a.isActive && !a.checkOutTime
        );
      }

      if (!attendance) {
        return res.status(400).json(ResponseFormatter.error('Aktif mesai bulunamadı', 'NO_ACTIVE_ATTENDANCE'));
      }

      const checkInTime = new Date(attendance.check_in_time || attendance.checkInTime);
      const workDuration = Math.floor((checkOutTime - checkInTime) / 1000); // seconds

      // Calculate total distance from location points
      let totalDistance = 0;
      try {
        if (postgres.isConnected || postgres.isInitialized) {
          await postgres.connect();
          // Simplified distance calculation using haversine
          const locResult = await postgres.query(
            `WITH ordered_points AS (
              SELECT latitude, longitude, timestamp,
                     LAG(latitude) OVER (ORDER BY timestamp) as prev_lat,
                     LAG(longitude) OVER (ORDER BY timestamp) as prev_lng
              FROM location_points
              WHERE user_id = $1::uuid AND timestamp >= $2 AND timestamp <= $3
            )
            SELECT SUM(
              CASE 
                WHEN prev_lat IS NOT NULL AND prev_lng IS NOT NULL
                THEN (
                  6371000 * acos(
                    LEAST(1.0, 
                      cos(radians(latitude)) * 
                      cos(radians(prev_lat)) * 
                      cos(radians(prev_lng) - radians(longitude)) + 
                      sin(radians(latitude)) * 
                      sin(radians(prev_lat))
                    )
                  )
                ) / 1000
                ELSE 0
              END
            ) as total_distance
            FROM ordered_points`,
            [userId, checkInTime, checkOutTime]
          );
          totalDistance = parseFloat(locResult.rows[0]?.total_distance || 0);
        }
      } catch (e) {
        logger.warn('[Attendance] Distance calculation error:', e);
      }

      const updateData = {
        checkOutTime: checkOutTime.toISOString(),
        checkOutLocation: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
          address: location.address || null,
        } : null,
        workDuration,
        totalDistance,
        status: 'checked_out',
        isActive: false,
        notes: notes || attendance.notes || null,
      };

      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          await postgres.query(
            `UPDATE attendance 
             SET check_out_time = $1, check_out_location = $2::jsonb, work_duration = $3, 
                 total_distance = $4, status = $5, is_active = $6, notes = $7, updated_at = NOW()
             WHERE id = $8::uuid`,
            [
              checkOutTime,
              updateData.checkOutLocation ? JSON.stringify(updateData.checkOutLocation) : null,
              workDuration,
              totalDistance,
              'checked_out',
              false,
              updateData.notes,
              attendance.id,
            ]
          );
        } catch (pgError) {
          console.warn('[Attendance] PostgreSQL update failed, using JSON fallback:', pgError.message);
          // Fall through to JSON fallback
          const index = db.data.attendance.findIndex(a => a.id === attendance.id);
          if (index >= 0) {
            db.data.attendance[index] = {
              ...db.data.attendance[index],
              ...updateData,
              updatedAt: new Date().toISOString(),
            };
            db.scheduleSave();
          }
        }
      } else {
        const index = db.data.attendance.findIndex(a => a.id === attendance.id);
        if (index >= 0) {
          db.data.attendance[index] = {
            ...db.data.attendance[index],
            ...updateData,
            updatedAt: new Date().toISOString(),
          };
          db.scheduleSave();
        }
      }

      logger.info(`[Attendance] User ${userId} checked out. Duration: ${workDuration}s, Distance: ${totalDistance.toFixed(2)}km`);

      return res.status(200).json(ResponseFormatter.success({
        attendanceId: attendance.id,
        checkOutTime: checkOutTime.toISOString(),
        workDuration,
        workHours: (workDuration / 3600).toFixed(2),
        totalDistance: totalDistance.toFixed(2),
        message: 'Mesai sonlandırıldı',
      }));
    } catch (error) {
      logger.error('[Attendance] Check out error:', error);
      return res.status(500).json(ResponseFormatter.error('Mesai sonlandırılamadı', 'CHECK_OUT_ERROR'));
    }
  }

  /**
   * Get attendance history
   */
  async getHistory(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { startDate, endDate, limit = 30 } = req.query || {};
      const start = startDate ? new Date(startDate) : new Date();
      start.setDate(start.getDate() - 30);
      const end = endDate ? new Date(endDate) : new Date();

      let attendances = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `SELECT * FROM attendance 
             WHERE user_id = $1::uuid AND check_in_time >= $2 AND check_in_time <= $3
             ORDER BY check_in_time DESC LIMIT $4`,
            [userId, start, end, parseInt(limit)]
          );
          attendances = result.rows.map(row => ({
            id: row.id,
            checkInTime: row.check_in_time,
            checkOutTime: row.check_out_time,
            checkInLocation: row.check_in_location,
            checkOutLocation: row.check_out_location,
            workDuration: row.work_duration,
            totalDistance: row.total_distance,
            status: row.status,
            notes: row.notes,
          }));
        } catch (pgError) {
          console.warn('[Attendance] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        const allAttendances = db.data.attendance || [];
        attendances = allAttendances
          .filter(a => {
            const checkIn = new Date(a.checkInTime);
            return a.userId === userId && checkIn >= start && checkIn <= end;
          })
          .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
          .slice(0, parseInt(limit))
          .map(a => ({
            id: a.id,
            checkInTime: a.checkInTime,
            checkOutTime: a.checkOutTime,
            checkInLocation: a.checkInLocation,
            checkOutLocation: a.checkOutLocation,
            workDuration: a.workDuration,
            totalDistance: a.totalDistance,
            status: a.status,
            notes: a.notes,
          }));
      }

      return res.status(200).json(ResponseFormatter.success({
        attendances,
        count: attendances.length,
      }));
    } catch (error) {
      logger.error('[Attendance] Get history error:', error);
      return res.status(500).json(ResponseFormatter.error('Mesai geçmişi alınamadı', 'GET_HISTORY_ERROR'));
    }
  }

  /**
   * Get current attendance status
   */
  async getCurrentStatus(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      let attendance = null;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `SELECT * FROM attendance 
             WHERE user_id = $1::uuid AND is_active = true AND check_out_time IS NULL
             ORDER BY check_in_time DESC LIMIT 1`,
            [userId]
          );
          attendance = result.rows[0] || null;
        } catch (pgError) {
          console.warn('[Attendance] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        const attendances = db.data.attendance || [];
        attendance = attendances.find(a => 
          a.userId === userId && a.isActive && !a.checkOutTime
        );
      }

      if (!attendance) {
        return res.status(200).json(ResponseFormatter.success({
          isCheckedIn: false,
          message: 'Mesai başlatılmamış',
        }));
      }

      const checkInTime = new Date(attendance.check_in_time || attendance.checkInTime);
      const currentDuration = Math.floor((Date.now() - checkInTime.getTime()) / 1000);

      return res.status(200).json(ResponseFormatter.success({
        isCheckedIn: true,
        attendanceId: attendance.id,
        checkInTime: checkInTime.toISOString(),
        currentDuration,
        currentHours: (currentDuration / 3600).toFixed(2),
        location: attendance.check_in_location || attendance.checkInLocation,
      }));
    } catch (error) {
      logger.error('[Attendance] Get current status error:', error);
      return res.status(500).json(ResponseFormatter.error('Durum alınamadı', 'GET_STATUS_ERROR'));
    }
  }
}

module.exports = new AttendanceController();

