const notificationService = require('./notificationService');
const db = require('../config/database');
const activityLogService = require('./activityLogService');
let logger;
try {
  const { getLogger } = require('../core/utils/loggerHelper');
  logger = getLogger('AutoNotificationService');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[AutoNotificationService]', ...args),
    error: (...args) => console.error('[AutoNotificationService]', ...args),
    info: (...args) => console.log('[AutoNotificationService]', ...args),
    debug: (...args) => console.debug('[AutoNotificationService]', ...args)
  };
}

class AutoNotificationService {
  async notifyGroupInvitation(inviterId, inviteeId, groupId, groupName) {
    try {
      const inviter = db.findUserById(inviterId);
      const invitee = db.findUserById(inviteeId);
      
      if (!inviter || !invitee) {
        logger.warn(`Group invitation notification skipped: user not found`);
        return { success: false, error: 'User not found' };
      }

      const result = await notificationService.send(inviteeId, {
        title: '👥 Yeni Grup Daveti',
        message: `${inviter.displayName || inviter.email} sizi "${groupName}" grubuna davet etti`,
        type: 'group_invitation',
        deepLink: `bavaxe://groups/${groupId}`,
        data: {
          type: 'group_invitation',
          groupId,
          groupName,
          inviterId,
          inviterName: inviter.displayName || inviter.email
        }
      }, ['database', 'onesignal']);

      logger.info(`✅ Group invitation notification sent to ${inviteeId}`);
      
      activityLogService.logActivity(inviterId, 'notification', 'send_group_invitation', {
        inviteeId,
        groupId,
        groupName
      });
      
      return { success: true, result };
    } catch (error) {
      logger.error(`❌ Error sending group invitation notification:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifyGroupMemberAdded(groupId, groupName, addedUserId, addedByUserId) {
    try {
      const addedUser = db.findUserById(addedUserId);
      const addedBy = db.findUserById(addedByUserId);
      
      if (!addedUser || !addedBy) {
        return { success: false, error: 'User not found' };
      }

      const result = await notificationService.send(addedUserId, {
        title: '✅ Gruba Eklendiniz',
        message: `${addedBy.displayName || addedBy.email} sizi "${groupName}" grubuna ekledi`,
        type: 'group_member_added',
        deepLink: `bavaxe://groups/${groupId}`,
        data: {
          type: 'group_member_added',
          groupId,
          groupName,
          addedByUserId,
          addedByName: addedBy.displayName || addedBy.email
        }
      }, ['database', 'onesignal']);

      logger.info(`✅ Group member added notification sent to ${addedUserId}`);
      return { success: true, result };
    } catch (error) {
      logger.error(`❌ Error sending group member added notification:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifyLocationShareStarted(shareId, sharerId, recipientId, duration) {
    try {
      const sharer = db.findUserById(sharerId);
      const recipient = db.findUserById(recipientId);
      
      if (!sharer || !recipient) {
        return { success: false, error: 'User not found' };
      }

      const durationText = duration ? `${duration} dakika` : 'süresiz';
      const result = await notificationService.send(recipientId, {
        title: '📍 Konum Paylaşımı Başladı',
        message: `${sharer.displayName || sharer.email} konumunu ${durationText} süreyle paylaşıyor`,
        type: 'location_share_started',
        deepLink: `bavaxe://track?userId=${sharerId}`,
        data: {
          type: 'location_share_started',
          shareId,
          sharerId,
          sharerName: sharer.displayName || sharer.email,
          duration
        }
      }, ['database', 'onesignal']);

      logger.info(`✅ Location share started notification sent to ${recipientId}`);
      return { success: true, result };
    } catch (error) {
      logger.error(`❌ Error sending location share started notification:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifyLocationShareEnded(shareId, sharerId, recipientId) {
    try {
      const sharer = db.findUserById(sharerId);
      const recipient = db.findUserById(recipientId);
      
      if (!sharer || !recipient) {
        return { success: false, error: 'User not found' };
      }

      const result = await notificationService.send(recipientId, {
        title: '📍 Konum Paylaşımı Sonlandı',
        message: `${sharer.displayName || sharer.email} konum paylaşımını durdurdu`,
        type: 'location_share_ended',
        deepLink: `bavaxe://track`,
        data: {
          type: 'location_share_ended',
          shareId,
          sharerId,
          sharerName: sharer.displayName || sharer.email
        }
      }, ['database', 'onesignal']);

      logger.info(`✅ Location share ended notification sent to ${recipientId}`);
      return { success: true, result };
    } catch (error) {
      logger.error(`❌ Error sending location share ended notification:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifyLocationUpdate(userId, locationData) {
    try {
      const user = db.findUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const userGroups = db.getUserGroups(userId);
      if (!userGroups || userGroups.length === 0) {
        return { success: true, skipped: true, reason: 'No groups' };
      }

      const allMembers = new Set();
      for (const group of userGroups) {
        const members = db.getMembers(group.id) || [];
        for (const member of members) {
          if (member.userId !== userId) {
            allMembers.add(member.userId);
          }
        }
      }

      if (allMembers.size === 0) {
        return { success: true, skipped: true, reason: 'No group members' };
      }

      const notifications = [];
      for (const memberId of allMembers) {
        notifications.push({
          userId: memberId,
          notification: {
            title: '📍 Konum Güncellendi',
            message: `${user.displayName || user.email || user.name || 'Bir kullanıcı'} yeni bir konum paylaştı`,
            type: 'location_update',
            deepLink: `bavaxe://track?userId=${userId}`,
            data: {
              type: 'location_update',
              userId,
              userName: user.displayName || user.email || user.name,
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              timestamp: locationData.timestamp || Date.now()
            }
          }
        });
      }

      if (notifications.length === 0) {
        return { success: true, skipped: true };
      }

      const results = [];
      for (const notif of notifications.slice(0, 50)) {
        try {
          const result = await notificationService.send(notif.userId, notif.notification, ['database', 'onesignal']);
          results.push({ userId: notif.userId, success: true, result });
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          results.push({ userId: notif.userId, success: false, error: error.message });
        }
      }

      logger.info(`✅ Location update notifications sent to ${results.filter(r => r.success).length}/${notifications.length} users`);
      return { success: true, results };
    } catch (error) {
      logger.error(`❌ Error sending location update notifications:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifyDailySummary(userId, summaryData) {
    try {
      const user = db.findUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const { distance = 0, steps = 0, activeTime = 0 } = summaryData;
      
      let title = '📊 Günlük Özet';
      let message = `Bugün ${distance.toFixed(1)} km yürüdünüz`;
      
      if (steps > 0) {
        message += `, ${steps.toLocaleString('tr-TR')} adım attınız`;
      }
      
      if (activeTime > 0) {
        const hours = Math.floor(activeTime / 60);
        const minutes = activeTime % 60;
        message += `, ${hours}s ${minutes}dk aktif oldunuz`;
      }

      const result = await notificationService.send(userId, {
        title,
        message,
        type: 'daily_summary',
        deepLink: 'bavaxe://analytics',
        data: {
          type: 'daily_summary',
          distance,
          steps,
          activeTime,
          date: new Date().toISOString().split('T')[0]
        }
      }, ['database', 'onesignal']);

      logger.info(`✅ Daily summary notification sent to ${userId}`);
      return { success: true, result };
    } catch (error) {
      logger.error(`❌ Error sending daily summary notification:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifySystemUpdate(userIds, title, message, deepLink = null) {
    try {
      const userIdsArray = Array.isArray(userIds) ? userIds : [userIds];
      const results = [];

      for (const userId of userIdsArray) {
        try {
          const result = await notificationService.send(userId, {
            title: `🔔 ${title}`,
            message,
            type: 'system_update',
            deepLink: deepLink || 'bavaxe://settings',
            data: {
              type: 'system_update',
              timestamp: Date.now()
            }
          }, ['database', 'onesignal']);

          results.push({ userId, success: true, result });
        } catch (error) {
          results.push({ userId, success: false, error: error.message });
        }
      }

      logger.info(`✅ System update notifications sent to ${results.filter(r => r.success).length}/${userIdsArray.length} users`);
      return { success: true, results };
    } catch (error) {
      logger.error(`❌ Error sending system update notifications:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifyGroupActivity(groupId, activityType, userId, details = {}) {
    try {
      const group = db.getGroupById(groupId);
      if (!group) {
        return { success: false, error: 'Group not found' };
      }

      const user = db.findUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const members = db.getGroupMembers(groupId);
      if (!members || members.length === 0) {
        return { success: true, skipped: true };
      }

      let title = '👥 Grup Aktivitesi';
      let message = '';

      switch (activityType) {
        case 'location_shared':
          message = `${user.displayName || user.email} konumunu paylaştı`;
          break;
        case 'member_joined':
          message = `${user.displayName || user.email} gruba katıldı`;
          break;
        case 'member_left':
          message = `${user.displayName || user.email} gruptan ayrıldı`;
          break;
        default:
          message = `${user.displayName || user.email} grup aktivitesi gerçekleştirdi`;
      }

      const notifications = [];
      for (const member of members) {
        if (member.userId === userId) continue;
        
        notifications.push({
          userId: member.userId,
          notification: {
            title,
            message,
            type: 'group_activity',
            deepLink: `bavaxe://groups/${groupId}`,
            data: {
              type: 'group_activity',
              activityType,
              groupId,
              groupName: group.name,
              userId,
              userName: user.displayName || user.email,
              ...details
            }
          }
        });
      }

      if (notifications.length === 0) {
        return { success: true, skipped: true };
      }

      const results = [];
      for (const notif of notifications) {
        try {
          const result = await notificationService.send(notif.userId, notif.notification, ['database', 'onesignal']);
          results.push({ userId: notif.userId, success: true, result });
        } catch (error) {
          results.push({ userId: notif.userId, success: false, error: error.message });
        }
      }

      logger.info(`✅ Group activity notifications sent to ${results.filter(r => r.success).length}/${notifications.length} users`);
      return { success: true, results };
    } catch (error) {
      logger.error(`❌ Error sending group activity notifications:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AutoNotificationService();
