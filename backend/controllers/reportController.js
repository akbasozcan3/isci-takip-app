/**
 * Report Controller
 * World-class GPS tracking - Attendance, location, and vehicle reports
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

class ReportController {
  /**
   * Generate daily report
   */
  async generateDailyReport(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { date, groupId } = req.query || {};
      const reportDate = date ? new Date(date) : new Date();
      reportDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(reportDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get attendance data
      let attendanceData = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const attResult = await postgres.query(
            `SELECT * FROM attendance 
             WHERE user_id = $1::uuid AND check_in_time >= $2 AND check_in_time < $3
             ORDER BY check_in_time`,
            [userId, reportDate, nextDay]
          );
          attendanceData = attResult.rows;
        } catch (pgError) {
          console.warn('[Report] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        attendanceData = (db.data.attendance || []).filter(a => {
          const checkIn = new Date(a.checkInTime);
          return a.userId === userId && checkIn >= reportDate && checkIn < nextDay;
        });
      }

      // Get location data
      let locationCount = 0;
      let totalDistance = 0;
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          // Simplified query - count and approximate distance
          const locResult = await postgres.query(
            `SELECT COUNT(*) as count
             FROM location_points
             WHERE user_id = $1::uuid AND timestamp >= $2 AND timestamp < $3`,
            [userId, reportDate, nextDay]
          );
          locationCount = parseInt(locResult.rows[0]?.count || 0);
          // Distance calculation simplified - can be enhanced later
          totalDistance = locationCount * 0.01; // Approximate 10m per point
        } catch (pgError) {
          console.warn('[Report] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      }

      // Get vehicle sessions
      let vehicleSessions = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const vehResult = await postgres.query(
            `SELECT * FROM vehicle_sessions 
             WHERE user_id = $1::uuid AND started_at >= $2 AND started_at < $3
             ORDER BY started_at`,
            [userId, reportDate, nextDay]
          );
          vehicleSessions = vehResult.rows;
        } catch (pgError) {
          console.warn('[Report] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        vehicleSessions = (db.data.vehicleSessions || []).filter(v => {
          const started = new Date(v.startedAt);
          return v.userId === userId && started >= reportDate && started < nextDay;
        });
      }

      // Get speed violations
      let speedViolations = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const violResult = await postgres.query(
            `SELECT * FROM speed_violations 
             WHERE user_id = $1::uuid AND timestamp >= $2 AND timestamp < $3
             ORDER BY timestamp`,
            [userId, reportDate, nextDay]
          );
          speedViolations = violResult.rows;
        } catch (pgError) {
          console.warn('[Report] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        speedViolations = (db.data.speedViolations || []).filter(v => {
          const ts = new Date(v.timestamp);
          return v.userId === userId && ts >= reportDate && ts < nextDay;
        });
      }

      // Calculate total work hours
      let totalWorkHours = 0;
      attendanceData.forEach(att => {
        if (att.check_out_time || att.checkOutTime) {
          const checkIn = new Date(att.check_in_time || att.checkInTime);
          const checkOut = new Date(att.check_out_time || att.checkOutTime);
          totalWorkHours += (checkOut - checkIn) / 1000 / 3600; // hours
        }
      });

      const report = {
        date: reportDate.toISOString().split('T')[0],
        userId,
        attendance: {
          checkInCount: attendanceData.length,
          totalWorkHours: Math.round(totalWorkHours * 100) / 100,
          attendances: attendanceData.map(a => ({
            checkInTime: a.check_in_time || a.checkInTime,
            checkOutTime: a.check_out_time || a.checkOutTime,
            workDuration: a.work_duration || a.workDuration,
            totalDistance: a.total_distance || a.totalDistance,
          })),
        },
        location: {
          pointCount: locationCount,
          totalDistance: Math.round(totalDistance * 100) / 100,
        },
        vehicle: {
          sessionCount: vehicleSessions.length,
          totalDistance: vehicleSessions.reduce((sum, v) => sum + (v.total_distance || 0), 0),
          speedViolations: speedViolations.length,
        },
        summary: {
          totalDistance: Math.round((totalDistance + (attendanceData.reduce((sum, a) => sum + (a.total_distance || 0), 0))) * 100) / 100,
          totalWorkHours: Math.round(totalWorkHours * 100) / 100,
          activeHours: Math.round((locationCount * 5 / 60) * 100) / 100, // Approximate
        },
      };

      // Save report
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          await postgres.query(
            `INSERT INTO daily_reports (user_id, group_id, report_date, report_type, total_work_hours, total_distance, 
             check_in_count, check_out_count, location_points_count, vehicle_sessions_count, speed_violations_count, report_data)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
             ON CONFLICT (user_id, report_date, report_type) 
             DO UPDATE SET report_data = $12::jsonb, total_work_hours = $5, total_distance = $6, updated_at = NOW()`,
            [
              userId,
              groupId || null,
              reportDate,
              'combined',
              Math.floor(totalWorkHours * 3600),
              report.summary.totalDistance,
              report.attendance.checkInCount,
              attendanceData.filter(a => a.check_out_time || a.checkOutTime).length,
              locationCount,
              vehicleSessions.length,
              speedViolations.length,
              JSON.stringify(report),
            ]
          );
        } catch (pgError) {
          console.warn('[Report] PostgreSQL insert failed:', pgError.message);
        }
      }

      return res.status(200).json(ResponseFormatter.success(report, 'Günlük rapor oluşturuldu'));
    } catch (error) {
      logger.error('[Report] Generate daily report error:', error);
      return res.status(500).json(ResponseFormatter.error('Rapor oluşturulamadı', 'REPORT_ERROR'));
    }
  }

  /**
   * Get attendance report
   */
  async getAttendanceReport(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { startDate, endDate, groupId } = req.query || {};
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
             ORDER BY check_in_time DESC`,
            [userId, start, end]
          );
          attendances = result.rows;
        } catch (pgError) {
          console.warn('[Report] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        attendances = (db.data.attendance || []).filter(a => {
          const checkIn = new Date(a.checkInTime);
          return a.userId === userId && checkIn >= start && checkIn <= end;
        });
      }

      const summary = {
        totalDays: new Set(attendances.map(a => 
          (a.check_in_time || a.checkInTime).toISOString().split('T')[0]
        )).size,
        totalWorkHours: attendances.reduce((sum, a) => {
          const duration = a.work_duration || a.workDuration || 0;
          return sum + (duration / 3600);
        }, 0),
        totalDistance: attendances.reduce((sum, a) => sum + (a.total_distance || a.totalDistance || 0), 0),
        averageWorkHours: 0,
      };

      if (summary.totalDays > 0) {
        summary.averageWorkHours = Math.round((summary.totalWorkHours / summary.totalDays) * 100) / 100;
      }

      return res.status(200).json(ResponseFormatter.success({
        summary,
        attendances: attendances.map(a => ({
          id: a.id,
          date: (a.check_in_time || a.checkInTime).toISOString().split('T')[0],
          checkInTime: a.check_in_time || a.checkInTime,
          checkOutTime: a.check_out_time || a.checkOutTime,
          workDuration: a.work_duration || a.workDuration,
          workHours: ((a.work_duration || a.workDuration || 0) / 3600).toFixed(2),
          totalDistance: a.total_distance || a.totalDistance,
          status: a.status,
        })),
      }));
    } catch (error) {
      logger.error('[Report] Get attendance report error:', error);
      return res.status(500).json(ResponseFormatter.error('Rapor alınamadı', 'GET_REPORT_ERROR'));
    }
  }

  /**
   * Get location report
   */
  async getLocationReport(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulama gerekli', 'AUTH_REQUIRED'));
      }

      const { startDate, endDate } = req.query || {};
      const start = startDate ? new Date(startDate) : new Date();
      start.setDate(start.getDate() - 7);
      const end = endDate ? new Date(endDate) : new Date();

      let locations = [];
      if (postgres.isConnected || postgres.isInitialized) {
        try {
          await postgres.connect();
          const result = await postgres.query(
            `SELECT * FROM location_points 
             WHERE user_id = $1::uuid AND timestamp >= $2 AND timestamp <= $3
             ORDER BY timestamp DESC
             LIMIT 1000`,
            [userId, start, end]
          );
          locations = result.rows;
        } catch (pgError) {
          console.warn('[Report] PostgreSQL query failed, using JSON fallback:', pgError.message);
        }
      } else {
        const userLocations = db.getStore(userId) || [];
        locations = userLocations.filter(l => {
          const ts = new Date(l.timestamp);
          return ts >= start && ts <= end;
        }).slice(0, 1000);
      }

      // Calculate statistics
      let totalDistance = 0;
      let speeds = [];
      const dailyStats = {};

      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];
        
        const distance = this.haversineKm(
          { latitude: prev.latitude || prev.coords?.latitude, longitude: prev.longitude || prev.coords?.longitude },
          { latitude: curr.latitude || curr.coords?.latitude, longitude: curr.longitude || curr.coords?.longitude }
        );
        totalDistance += distance;

        const speed = curr.speed || curr.coords?.speed;
        if (speed) {
          speeds.push(speed * 3.6); // km/h
        }

        const date = new Date(curr.timestamp || curr.created_at).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { distance: 0, points: 0 };
        }
        dailyStats[date].distance += distance;
        dailyStats[date].points += 1;
      }

      return res.status(200).json(ResponseFormatter.success({
        summary: {
          totalPoints: locations.length,
          totalDistance: Math.round(totalDistance * 100) / 100,
          averageSpeed: speeds.length > 0 ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 100) / 100 : 0,
          maxSpeed: speeds.length > 0 ? Math.round(Math.max(...speeds) * 100) / 100 : 0,
        },
        dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          distance: Math.round(stats.distance * 100) / 100,
          points: stats.points,
        })),
      }));
    } catch (error) {
      logger.error('[Report] Get location report error:', error);
      return res.status(500).json(ResponseFormatter.error('Rapor alınamadı', 'GET_REPORT_ERROR'));
    }
  }

  haversineKm(coords1, coords2) {
    if (!coords1 || !coords2) return 0;
    const R = 6371;
    const dLat = this.toRad(coords2.latitude - coords1.latitude);
    const dLon = this.toRad(coords2.longitude - coords1.longitude);
    const lat1 = this.toRad(coords1.latitude);
    const lat2 = this.toRad(coords2.latitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * 
              Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * Math.PI / 180;
  }
}

module.exports = new ReportController();

