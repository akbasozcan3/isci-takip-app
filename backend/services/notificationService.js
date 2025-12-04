const onesignalService = require('./onesignalService');
const db = require('../config/database');
const retryService = require('../core/services/retry.service');

class NotificationService {
  constructor() {
    this.channels = new Map();
    this.setupDefaultChannels();
  }

  setupDefaultChannels() {
    this.registerChannel('database', async (userId, notification) => {
      try {
        db.addNotification(userId, {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: notification.type || 'info',
          title: notification.title,
          message: notification.message || notification.body,
          data: notification.data || {},
          read: false,
          createdAt: Date.now()
        });
        return { saved: true };
      } catch (error) {
        console.error('[NotificationService] Database channel error:', error);
        throw error;
      }
    });

    this.registerChannel('onesignal', async (userId, notification) => {
      const user = db.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await retryService.execute(
        async () => {
          const result = await onesignalService.sendToUser(
            userId,
            notification.title || notification.subject || 'Bildirim',
            notification.message || notification.body || '',
            {
              data: notification.data || {},
              deepLink: notification.deepLink || notification.url,
              imageUrl: notification.imageUrl,
              priority: notification.priority || 10
            }
          );

          if (!result.success) {
            throw new Error(result.error || 'OneSignal send failed');
          }

          return result;
        },
        {
          maxRetries: 3,
          delay: 1000,
          backoff: 'exponential',
          shouldRetry: (error) => {
            return error.message.includes('timeout') || 
                   error.message.includes('network') ||
                   error.message.includes('ECONNRESET');
          }
        }
      );
    });
  }

  registerChannel(name, handler) {
    this.channels.set(name, handler);
  }

  async send(userId, notification, channels = ['database']) {
    const results = [];

    for (const channel of channels) {
      const handler = this.channels.get(channel);
      if (handler) {
        try {
          const result = await retryService.execute(
            async () => await handler(userId, notification),
            {
              maxRetries: channel === 'onesignal' ? 3 : 1,
              delay: 1000,
              backoff: 'exponential',
              shouldRetry: (error) => {
                if (channel === 'onesignal') {
                  return error.message.includes('timeout') || 
                         error.message.includes('network') ||
                         error.message.includes('ECONNRESET');
                }
                return false;
              }
            }
          );
          results.push({ channel, success: true, result });
        } catch (error) {
          console.error(`[NotificationService] Channel ${channel} failed:`, error);
          results.push({ channel, success: false, error: error.message });
        }
      }
    }

    return results;
  }

  async broadcast(notification, userFilter = null) {
    const db = require('../config/database');
    const queueService = require('./queueService');
    const users = Object.values(db.data.users || {});
    
    const targets = userFilter 
      ? users.filter(userFilter)
      : users;

    if (targets.length > 50) {
      for (const user of targets) {
        queueService.enqueue('notifications', {
          userId: user.id,
          notification,
          channels: ['database', 'onesignal']
        });
      }
      return { queued: targets.length };
    }

    const results = [];
    for (const user of targets) {
      const result = await this.send(user.id, notification);
      results.push({ userId: user.id, channels: result });
    }

    return results;
  }
}

const notificationService = new NotificationService();

module.exports = notificationService;

