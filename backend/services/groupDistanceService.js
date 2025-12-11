// Group Distance Monitoring Service
// 30 km eşiğini aşan grup üyeleri için bildirim gönderir
const db = require('../config/database');
const notificationService = require('./notificationService');
const activityLogService = require('./activityLogService');

// Haversine formülü ile mesafe hesaplama (km cinsinden)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Grup merkezini hesapla (tüm üyelerin konumlarının ortalaması)
function calculateGroupCenter(groupId) {
  const members = db.getMembers(groupId);
  if (!members || members.length === 0) {
    return null;
  }

  let totalLat = 0;
  let totalLng = 0;
  let count = 0;

  for (const member of members) {
    const locations = db.getStore(member.userId);
    if (locations && locations.length > 0) {
      const latest = locations[locations.length - 1];
      if (latest && latest.coords) {
        totalLat += latest.coords.latitude;
        totalLng += latest.coords.longitude;
        count++;
      }
    }
  }

  if (count === 0) {
    return null;
  }

  return {
    latitude: totalLat / count,
    longitude: totalLng / count
  };
}

class GroupDistanceService {
  constructor() {
    // Son bildirim zamanlarını sakla (spam önleme için)
    // Format: { groupId_userId: timestamp }
    this.lastNotificationTime = new Map();
    // Cooldown süresi: 30 dakika (aynı kullanıcı için tekrar bildirim göndermeden önce)
    this.NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000;
    // Mesafe eşiği: 30 km
    this.DISTANCE_THRESHOLD_KM = 30;
    // Socket.IO instance (server.js'ten inject edilecek)
    this.socketIO = null;
  }

  // Socket.IO instance'ını set et
  setSocketIO(io) {
    this.socketIO = io;
  }

  // Grup üyesinin konumunu kontrol et ve gerekirse bildirim gönder
  async checkMemberDistance(groupId, userId, lat, lng) {
    try {
      const group = db.getGroupById(groupId);
      if (!group) {
        return { checked: false, reason: 'Group not found' };
      }

      const members = db.getMembers(groupId);
      if (!members || members.length < 2) {
        // Tek üye varsa kontrol etmeye gerek yok
        return { checked: false, reason: 'Not enough members' };
      }

      // Grup merkezini hesapla
      const center = calculateGroupCenter(groupId);
      if (!center) {
        return { checked: false, reason: 'Cannot calculate group center' };
      }

      // Güncel kullanıcının grup merkezine olan mesafesini hesapla
      const distance = calculateDistance(center.latitude, center.longitude, lat, lng);

      // 30 km'den fazla uzaklaştıysa bildirim gönder
      if (distance > this.DISTANCE_THRESHOLD_KM) {
        const notificationKey = `${groupId}_${userId}`;
        const lastNotification = this.lastNotificationTime.get(notificationKey);
        const now = Date.now();

        // Cooldown kontrolü
        if (!lastNotification || (now - lastNotification) > this.NOTIFICATION_COOLDOWN_MS) {
          // Bildirim gönder
          const user = db.findUserById(userId);
          const userName = user?.name || user?.email || 'Bir üye';
          const groupName = group.name || 'Grup';

          // Diğer grup üyelerine bildirim gönder
          const otherMembers = members.filter(m => m.userId !== userId);
          const distanceKm = Math.round(distance);
          const notificationMessage = `${userName} 30 km'yi geçti.`;
          
          for (const member of otherMembers) {
            try {
              await notificationService.send(member.userId, {
                title: '⚠️ Grup Üyesi Uzaklaştı',
                message: notificationMessage,
                type: 'warning',
                deepLink: `bavaxe://groups?groupId=${groupId}`,
                data: {
                  groupId,
                  userId,
                  distance: distanceKm,
                  type: 'member_distance_alert',
                  groupName: groupName,
                  userName: userName
                }
              }, ['database', 'onesignal']);
              
              activityLogService.logActivity(member.userId, 'group', 'distance_alert', {
                groupId,
                userId,
                distance: distanceKm,
                threshold: this.DISTANCE_THRESHOLD_KM
              });
              
              console.log(`[GroupDistanceService] ✅ Bildirim gönderildi: ${member.userId} - "${userName} 30 km'yi geçti (${distanceKm} km)"`);
            } catch (error) {
              console.error(`[GroupDistanceService] Failed to send notification to ${member.userId}:`, error);
            }
          }

          // Son bildirim zamanını kaydet
          this.lastNotificationTime.set(notificationKey, now);

          // Socket.IO event'i için callback çağır (eğer varsa)
          if (this.socketIO) {
            try {
              // Tüm grup üyelerine real-time bildirim gönder
              this.socketIO.to(`group-${groupId}`).emit('member_distance_alert', {
                groupId,
                userId,
                userName,
                distance: distanceKm,
                threshold: this.DISTANCE_THRESHOLD_KM,
                message: notificationMessage,
                timestamp: now
              });
              console.log(`[GroupDistanceService] ✅ Socket.IO event emitted to group ${groupId}`);
            } catch (error) {
              console.error('[GroupDistanceService] Socket.IO emit error:', error);
            }
          }

          return {
            checked: true,
            notified: true,
            distance: Math.round(distance),
            threshold: this.DISTANCE_THRESHOLD_KM
          };
        } else {
          // Cooldown aktif, bildirim gönderme
          const remainingCooldown = Math.ceil((this.NOTIFICATION_COOLDOWN_MS - (now - lastNotification)) / 1000 / 60);
          return {
            checked: true,
            notified: false,
            reason: 'cooldown',
            remainingMinutes: remainingCooldown,
            distance: Math.round(distance)
          };
        }
      }

      return {
        checked: true,
        notified: false,
        distance: Math.round(distance),
        withinThreshold: true
      };
    } catch (error) {
      console.error('[GroupDistanceService] Error checking member distance:', error);
      return { checked: false, error: error.message };
    }
  }

  // Eski bildirim kayıtlarını temizle (memory leak önleme)
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    const keysToDelete = [];
    let processed = 0;
    const maxProcessPerIteration = 5000;

    for (const [key, timestamp] of this.lastNotificationTime.entries()) {
      if (processed >= maxProcessPerIteration) break;
      if (now - timestamp > maxAge) {
        keysToDelete.push(key);
        processed++;
      }
    }

    for (const key of keysToDelete) {
      this.lastNotificationTime.delete(key);
    }

    if (this.lastNotificationTime.size > 10000 && global.gc) {
      global.gc();
    }
  }
}

// Singleton instance
const groupDistanceService = new GroupDistanceService();

// Her 1 saatte bir temizlik yap
setInterval(() => {
  groupDistanceService.cleanup();
}, 60 * 60 * 1000);

module.exports = groupDistanceService;

