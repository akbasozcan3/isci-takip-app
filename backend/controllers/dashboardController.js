// Professional Dashboard Controller - Gerçek verilerle çalışır
const db = require('../config/database');

const ACTIVE_WINDOW_MS = 15 * 60 * 1000; // 15 dakika

class DashboardController {
  // Token'dan kullanıcı çöz
  resolveUser(req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const tokenData = db.getToken(token);
    if (!tokenData) return null;
    return db.findUserById(tokenData.userId) || null;
  }

  // Ana dashboard verileri
  async getDashboard(req, res) {
    try {
      const { userId } = req.params;
      const user = this.resolveUser(req) || db.findUserById(userId);
      
      if (!user) {
        return res.json({
          activeWorkers: 0,
          totalGroups: 0,
          todayDistance: 0,
          activeAlerts: 0,
          onlineMembers: 0,
          totalMembers: 0
        });
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

      // Aktif uyarılar (örnek - gerçek implementasyonda alert sistemi olmalı)
      const activeAlerts = 0;

      return res.json({
        activeWorkers,
        totalGroups: groups.length,
        todayDistance: Math.round(todayDistance * 10) / 10,
        activeAlerts,
        onlineMembers: activeWorkers,
        totalMembers,
        subscription: db.getUserSubscription(user.id),
        lastUpdated: new Date().toISOString()
      });
    } catch (e) {
      console.error('getDashboard error:', e);
      return res.status(200).json({
        activeWorkers: 0,
        totalGroups: 0,
        todayDistance: 0,
        activeAlerts: 0
      });
    }
  }

  // Son aktiviteler
  async getActivities(req, res) {
    try {
      const user = this.resolveUser(req);
      const limit = Math.min(50, Number(req.query.limit || 10));
      
      if (!user) {
        return res.json([]);
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

      // Zamana göre sırala ve limitle
      activities.sort((a, b) => b.timestamp - a.timestamp);
      
      return res.json(activities.slice(0, limit));
    } catch (e) {
      console.error('getActivities error:', e);
      return res.json([]);
    }
  }

  // Detaylı istatistikler
  async getStats(req, res) {
    try {
      const user = this.resolveUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Kimlik doğrulaması gerekli' });
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

      return res.json(stats);
    } catch (e) {
      console.error('getStats error:', e);
      return res.status(500).json({ error: 'İstatistikler alınamadı' });
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
