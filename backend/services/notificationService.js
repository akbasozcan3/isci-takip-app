const onesignalService = require('./onesignalService');
const db = require('../config/database');
const retryService = require('../core/services/retry.service');
const SubscriptionModel = require('../core/database/models/subscription.model');

class NotificationService {
  constructor() {
    this.channels = new Map();
    this.notificationCounts = new Map();
    this.setupDefaultChannels();
    this.resetDailyCounts();
    setInterval(() => this.resetDailyCounts(), 24 * 60 * 60 * 1000);
  }

  resetDailyCounts() {
    this.notificationCounts.clear();
  }

  canSendPushNotification(userId) {
    const subscription = db.getUserSubscription(userId);
    const planId = subscription?.planId || 'free';
    const limits = SubscriptionModel.getPlanLimits(planId);
    
    if (!limits.pushNotificationsEnabled) {
      return { allowed: false, reason: 'Push notifications disabled for this plan' };
    }

    const maxPerDay = limits.maxPushNotificationsPerDay;
    if (maxPerDay === -1) {
      return { allowed: true };
    }

    const today = new Date().toDateString();
    const key = `${userId}:${today}`;
    const count = this.notificationCounts.get(key) || 0;

    if (count >= maxPerDay) {
      return { allowed: false, reason: `Daily limit reached (${maxPerDay})` };
    }

    return { allowed: true, remaining: maxPerDay - count };
  }

  recordNotificationSent(userId) {
    const today = new Date().toDateString();
    const key = `${userId}:${today}`;
    const count = this.notificationCounts.get(key) || 0;
    this.notificationCounts.set(key, count + 1);
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

      const pushCheck = this.canSendPushNotification(userId);
      if (!pushCheck.allowed) {
        throw new Error(pushCheck.reason || 'Push notification not allowed');
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      const limits = SubscriptionModel.getPlanLimits(planId);
      const priorityMap = { normal: 5, high: 8, max: 10 };
      const notificationPriority = priorityMap[limits.pushNotificationPriority] || 10;

      const result = await retryService.execute(
        async () => {
          const sendResult = await onesignalService.sendToUser(
            userId,
            notification.title || notification.subject || 'Bildirim',
            notification.message || notification.body || '',
            {
              data: notification.data || {},
              deepLink: notification.deepLink || notification.url,
              imageUrl: notification.imageUrl,
              priority: notification.priority || notificationPriority
            }
          );

          if (!sendResult.success) {
            throw new Error(sendResult.error || 'OneSignal send failed');
          }

          this.recordNotificationSent(userId);
          return sendResult;
        },
        {
          maxRetries: 3,
          delay: 1000,
          backoff: 'exponential',
          shouldRetry: (error) => {
            return error.message.includes('timeout') || 
                   error.message.includes('network') ||
                   error.message.includes('ECONNRESET') ||
                   error.message.includes('5');
          }
        }
      );

      return result;
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
                         error.message.includes('ECONNRESET') ||
                         error.message.includes('5');
                }
                return false;
              }
            }
          );
          results.push({ channel, success: true, result });
        } catch (error) {
          if (channel === 'onesignal') {
            console.error(`[NotificationService] OneSignal failed for user ${userId}:`, error.message);
          }
          results.push({ channel, success: false, error: error.message });
        }
      } else {
        results.push({ channel, success: false, error: `Channel ${channel} not registered` });
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

