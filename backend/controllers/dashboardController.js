// Professional Dashboard Controller - Gerçek verilerle çalışır
const db = require('../config/database');
const cacheService = require('../services/cacheService');
const SubscriptionModel = require('../core/database/models/subscription.model');
const activityLogService = require('../services/activityLogService');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');
const { getUserIdFromToken } = require('../core/middleware/auth.middleware');
const { logger } = require('../core/utils/logger');

const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

class DashboardController {
  // Token'dan kullanıcı çöz
  resolveUser(req) {
    try {
      const userId = getUserIdFromToken(req);
      if (!userId) return null;
      return db.findUserById(userId) || null;
    } catch (error) {
      logger.warn('resolveUser error', { error: error.message });
      return null;
    }
  }

  getPlanBasedConfig(planId) {
    const limits = SubscriptionModel.getPlanLimits(planId);
    return {
      cacheEnabled: planId !== 'free',
      cacheTTL: limits.cacheTTL || 60000,
      batchSize: limits.batchSize || 10,
      includeAdvanced: limits.advancedAnalytics || false,
      maxDataPoints: planId === 'business' ? -1 : (planId === 'plus' ? 1000 : 100)
    };
  }

  // Ana dashboard verileri
  async getDashboard(req, res) {
    try {
      const { userId: paramUserId } = req.params;
      const user = this.resolveUser(req) || (paramUserId ? db.findUserById(paramUserId) : null);
      
      if (!user) {
        return res.status(200).json(ResponseFormatter.success({
          activeWorkers: 0,
          totalGroups: 0,
          todayDistance: 0,
          activeAlerts: 0,
          onlineMembers: 0,
          totalMembers: 0,
          subscription: null,
          planId: 'free'
        }, 'Dashboard verileri alındı'));
      }

      const subscription = db.getUserSubscription(user.id);
      const planId = subscription?.planId || 'free';
      const config = this.getPlanBasedConfig(planId);
      
      const cacheKey = `dashboard:${user.id}`;
      
      if (config.cacheEnabled) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
          try {
            activityLogService.logActivity(user.id, 'dashboard', 'view_dashboard', {
              planId,
              cached: true,
              path: req.path
            });
          } catch (logError) {
            logger.warn('Activity log error (non-critical)', { error: logError.message });
          }
          return res.json(ResponseFormatter.success({
            ...cached,
            cached: true,
            planId
          }, 'Dashboard verileri alındı (cache)'));
        }
      }

      // Kullanıcının gruplarını al
      const groups = db.getUserGroups(user.id) || [];
      
      // Aktif işçi sayısı (son 15 dk içinde konum gönderen)
      const cutoff = Date.now() - ACTIVE_WINDOW_MS;
      let activeWorkers = 0;
      let totalMembers = 0;
      let todayDistance = 0;
      
      const store = db.data.store || {};
      const today = new Date().toDateString();
      
      // Her grup için üyeleri kontrol et
      for (const group of groups) {
        const members = db.getMembers(group.id) || [];
        totalMembers += members.length;
        
        for (const member of members) {
          const locations = store[member.userId] || [];
          if (locations.length > 0) {
            const lastLoc = locations[locations.length - 1];
            if (lastLoc.timestamp > cutoff) {
              activeWorkers++;
            }
            
            // Bugünkü mesafeyi hesapla
            const todayLocs = locations.filter(l => 
              new Date(l.timestamp).toDateString() === today
            );
            if (todayLocs.length > 1) {
              for (let i = 1; i < todayLocs.length; i++) {
                todayDistance += this.haversineKm(
                  todayLocs[i - 1].coords,
                  todayLocs[i].coords
                );
              }
            }
          }
        }
      }

      // Aktif uyarılar
      const activeAlerts = 0;

      // Get attendance stats
      const postgres = require('../config/postgres');
      let todayAttendance = 0;
      let totalWorkHours = 0;
      let activeVehicles = 0;
      let speedViolations = 0;

      try {
        if (postgres.isConnected || postgres.isInitialized) {
          await postgres.connect();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Attendance stats
          const attResult = await postgres.query(
            `SELECT COUNT(*) as count, SUM(work_duration) as total_duration
             FROM attendance 
             WHERE user_id = $1::uuid AND check_in_time >= $2 AND check_in_time < $3`,
            [user.id, today, tomorrow]
          );
          todayAttendance = parseInt(attResult.rows[0]?.count || 0);
          totalWorkHours = Math.round((parseInt(attResult.rows[0]?.total_duration || 0) / 3600) * 100) / 100;

          // Vehicle stats
          const vehResult = await postgres.query(
            `SELECT COUNT(*) as active_count
             FROM vehicle_sessions 
             WHERE user_id = $1::uuid AND is_active = true AND ended_at IS NULL`,
            [user.id]
          );
          activeVehicles = parseInt(vehResult.rows[0]?.active_count || 0);

          // Speed violations today
          const violResult = await postgres.query(
            `SELECT COUNT(*) as count
             FROM speed_violations 
             WHERE user_id = $1::uuid AND timestamp >= $2 AND timestamp < $3`,
            [user.id, today, tomorrow]
          );
          speedViolations = parseInt(violResult.rows[0]?.count || 0);
        }
      } catch (e) {
        logger.warn('[Dashboard] Stats query error (non-critical):', e);
      }

      const response = {
        activeWorkers,
        totalGroups: groups.length,
        todayDistance: Math.round(todayDistance * 10) / 10,
        activeAlerts,
        onlineMembers: activeWorkers,
        totalMembers,
        todayAttendance,
        totalWorkHours,
        activeVehicles,
        speedViolations,
        subscription: subscription ? {
          planId: subscription.planId,
          status: subscription.status,
          expiresAt: subscription.expiresAt
        } : null,
        lastUpdated: new Date().toISOString(),
        planId,
        performance: {
          cacheEnabled: config.cacheEnabled,
          batchSize: config.batchSize
        }
      };

      if (config.cacheEnabled) {
        try {
          cacheService.set(cacheKey, response, config.cacheTTL, user.id);
        } catch (cacheError) {
          logger.warn('Cache set error (non-critical)', { error: cacheError.message });
        }
      }

      return res.json(ResponseFormatter.success(response, 'Dashboard verileri başarıyla alındı'));
    } catch (e) {
      logger.error('getDashboard error', e);
      
      // Operational error ise direkt döndür
      if (e.isOperational) {
        return res.status(e.statusCode).json(ResponseFormatter.error(e.message, e.code, e.details));
      }
      
      // Fallback response
      return res.status(200).json(ResponseFormatter.success({
        activeWorkers: 0,
        totalGroups: 0,
        todayDistance: 0,
        activeAlerts: 0,
        onlineMembers: 0,
        totalMembers: 0,
        subscription: null,
        planId: 'free'
      }, 'Dashboard verileri alındı (fallback)'));
    }
  }

  // Son aktiviteler
  async getActivities(req, res) {
    try {
      const user = this.resolveUser(req);
      
      if (!user) {
        return res.json(ResponseFormatter.success([
          {
            id: 'sample_1',
            type: 'system',
            message: 'Sisteme hoş geldiniz! İlk aktiviteleriniz burada görünecek.',
            timestamp: Date.now() - 3600000,
            read: false
          },
          {
            id: 'sample_2',
            type: 'info',
            message: 'Grup oluşturarak takımınızı organize edebilirsiniz.',
            timestamp: Date.now() - 7200000,
            read: false
          }
        ], 'Aktiviteler alındı'));
      }

      const subscription = db.getUserSubscription(user.id);
      const planId = subscription?.planId || 'free';
      const config = this.getPlanBasedConfig(planId);
      
      const planLimits = {
        free: 10,
        plus: 50,
        business: 200
      };
      
      const maxLimit = planLimits[planId] || 10;
      const limit = Math.min(maxLimit, Number(req.query.limit || maxLimit));
      
      const cacheKey = `activities:${user.id}:${limit}`;
      
      if (config.cacheEnabled) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
          return res.json(ResponseFormatter.success(cached, 'Aktiviteler alındı (cache)'));
        }
      }

      const activities = [];
      const groups = db.getUserGroups(user.id) || [];
      const now = Date.now();
      const cutoff = now - 24 * 60 * 60 * 1000; // Son 24 saat

      // Grup üyelerinin konum aktivitelerini topla
      for (const group of groups) {
        const members = db.getMembers(group.id) || [];
        
        for (const member of members) {
          const memberUser = db.findUserById(member.userId);
          const locations = (db.data.store || {})[member.userId] || [];
          
          // Son konum güncellemesi
          if (locations.length > 0) {
            const lastLoc = locations[locations.length - 1];
            if (lastLoc.timestamp > cutoff) {
              activities.push({
                id: `loc_${member.userId}_${lastLoc.timestamp}`,
                type: 'location',
                message: `${memberUser?.displayName || 'Üye'} konum güncelledi`,
                timestamp: lastLoc.timestamp,
                userId: member.userId,
                groupId: group.id,
                groupName: group.name
              });
            }
          }
        }
      }

      // Bildirimlerden aktivite ekle
      try {
        const notifications = db.getNotifications(user.id) || [];
        for (const notif of notifications.slice(0, 10)) {
        activities.push({
          id: `notif_${notif.id}`,
          type: notif.type || 'system',
          message: notif.message || notif.title,
          timestamp: notif.timestamp,
          read: notif.read
        });
        }
      } catch (notifError) {
        logger.warn('getActivities: notifications error (non-critical)', { error: notifError.message });
      }

      // Zamana göre sırala ve limitle
      activities.sort((a, b) => b.timestamp - a.timestamp);
      
      const result = activities.slice(0, limit);
      
      if (config.cacheEnabled) {
        try {
          cacheService.set(cacheKey, result, config.cacheTTL, user.id);
        } catch (cacheError) {
          logger.warn('Cache set error (non-critical)', { error: cacheError.message });
        }
      }
      
      return res.json(ResponseFormatter.success(result, 'Aktiviteler başarıyla alındı'));
    } catch (e) {
      logger.error('getActivities error', e);
      
      if (e.isOperational) {
        return res.status(e.statusCode).json(ResponseFormatter.error(e.message, e.code, e.details));
      }
      
      return res.json(ResponseFormatter.success([], 'Aktiviteler alındı (fallback)'));
    }
  }

  // Detaylı istatistikler
  async getStats(req, res) {
    try {
      const user = this.resolveUser(req);
      if (!user) {
        return res.json(ResponseFormatter.success({
          daily: { distance: 0, activeTime: 0, locations: 0 },
          weekly: { distance: 0, avgSpeed: 0, maxSpeed: 0 },
          groups: [],
          topWorkers: []
        }, 'İstatistikler alındı'));
      }

      const groups = db.getUserGroups(user.id) || [];
      const store = db.data.store || {};
      const now = Date.now();
      const today = new Date().toDateString();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

      let stats = {
        daily: { distance: 0, activeTime: 0, locations: 0 },
        weekly: { distance: 0, avgSpeed: 0, maxSpeed: 0 },
        groups: [],
        topWorkers: []
      };

      const workerStats = {};

      for (const group of groups) {
        const members = db.getMembers(group.id) || [];
        let groupDistance = 0;
        let groupActiveCount = 0;

        for (const member of members) {
          const locations = store[member.userId] || [];
          const memberUser = db.findUserById(member.userId);
          
          if (!workerStats[member.userId]) {
            workerStats[member.userId] = {
              userId: member.userId,
              name: memberUser?.displayName || 'Bilinmiyor',
              distance: 0,
              locationCount: 0
            };
          }

          // Bugünkü veriler
          const todayLocs = locations.filter(l => 
            new Date(l.timestamp).toDateString() === today
          );
          stats.daily.locations += todayLocs.length;

          // Haftalık veriler
          const weekLocs = locations.filter(l => l.timestamp > weekAgo);
          
          let memberDistance = 0;
          let speeds = [];
          
          for (let i = 1; i < weekLocs.length; i++) {
            memberDistance += this.haversineKm(
              weekLocs[i - 1].coords,
              weekLocs[i].coords
            );
            if (weekLocs[i].coords.speed) {
              speeds.push(weekLocs[i].coords.speed * 3.6); // km/h
            }
          }

          workerStats[member.userId].distance += memberDistance;
          workerStats[member.userId].locationCount += weekLocs.length;
          groupDistance += memberDistance;
          
          if (weekLocs.length > 0) groupActiveCount++;
          
          stats.weekly.distance += memberDistance;
          if (speeds.length > 0) {
            stats.weekly.maxSpeed = Math.max(stats.weekly.maxSpeed, ...speeds);
          }
        }

        stats.groups.push({
          id: group.id,
          name: group.name,
          memberCount: members.length,
          activeCount: groupActiveCount,
          totalDistance: Math.round(groupDistance * 10) / 10
        });
      }

      // En aktif çalışanlar
      stats.topWorkers = Object.values(workerStats)
        .sort((a, b) => b.distance - a.distance)
        .slice(0, 5)
        .map(w => ({
          ...w,
          distance: Math.round(w.distance * 10) / 10
        }));

      stats.daily.distance = Math.round(stats.daily.distance * 10) / 10;
      stats.weekly.distance = Math.round(stats.weekly.distance * 10) / 10;
      stats.weekly.maxSpeed = Math.round(stats.weekly.maxSpeed);

      return res.json(ResponseFormatter.success(stats, 'İstatistikler başarıyla alındı'));
    } catch (e) {
      logger.error('getStats error', e);
      
      if (e.isOperational) {
        return res.status(e.statusCode).json(ResponseFormatter.error(e.message, e.code, e.details));
      }
      
      return res.status(500).json(ResponseFormatter.error('İstatistikler alınamadı', 'STATS_ERROR'));
    }
  }

  // Haversine formülü ile mesafe hesaplama (km)
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

module.exports = new DashboardController();
