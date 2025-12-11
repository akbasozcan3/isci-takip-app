const onesignalService = require('./onesignalService');
const notificationService = require('./notificationService');
const activityLogService = require('./activityLogService');
let logger;
try {
  const { getLogger } = require('../core/utils/loggerHelper');
  logger = getLogger('PushNotificationService');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[PushNotificationService]', ...args),
    error: (...args) => console.error('[PushNotificationService]', ...args),
    info: (...args) => console.log('[PushNotificationService]', ...args),
    debug: (...args) => console.debug('[PushNotificationService]', ...args)
  };
}

async function sendPushNotification(userId, message, options = {}) {
  const {
    title = '🏃 Günlük Aktivite',
    type = 'activity',
    data = {},
    deepLink = null
  } = options;

  try {
    const user = require('../config/database').findUserById(userId);
    if (!user) {
      logger.warn(`User ${userId} not found for push notification`);
      return { success: false, error: 'User not found' };
    }

    const result = await notificationService.send(userId, {
      title,
      message,
      type: 'success',
      deepLink: deepLink || `bavaxe://analytics`,
      data: {
        type,
        ...data
      }
    }, ['database', 'onesignal']);

    const onesignalResult = result.find(r => r.channel === 'onesignal');
    if (onesignalResult && onesignalResult.success) {
      logger.info(`✅ Push notification sent to user ${userId}: ${message}`);
      
      activityLogService.logActivity(userId, 'notification', 'send_push_notification', {
        type,
        title,
        success: true,
        notificationId: onesignalResult.result?.data?.id
      });
      
      return { success: true, notificationId: onesignalResult.result?.data?.id };
    } else {
      logger.warn(`⚠️ Push notification partially failed for user ${userId}`);
      
      activityLogService.logActivity(userId, 'notification', 'send_push_notification', {
        type,
        title,
        success: false,
        error: 'OneSignal send failed'
      });
      
      return { success: false, error: 'OneSignal send failed' };
    }
  } catch (error) {
    logger.error(`❌ Error sending push notification to user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

async function sendDailyActivityNotification(userId, distance, options = {}) {
  const {
    threshold = 5,
    improved = false
  } = options;

  let title = '🏃 Günlük Aktivite';
  let message = `Bugün ${distance.toFixed(1)} km yürüdünüz!`;

  if (improved) {
    title = '🎉 Harika İlerleme!';
    message = `Bugün ${distance.toFixed(1)} km yürüdünüz! Dünkünden daha fazla!`;
  } else if (distance >= threshold) {
    title = '✅ Hedef Aşıldı!';
    message = `Tebrikler! Bugün ${distance.toFixed(1)} km yürüdünüz. ${threshold} km hedefini aştınız!`;
  }

  return await sendPushNotification(userId, message, {
    title,
    type: 'daily_activity',
    data: {
      distance,
      threshold,
      improved,
      date: new Date().toISOString().split('T')[0]
    },
    deepLink: 'bavaxe://analytics'
  });
}

async function sendBatchNotifications(notifications) {
  const results = [];
  
  for (const notification of notifications) {
    try {
      const result = await sendPushNotification(
        notification.userId,
        notification.message,
        notification.options
      );
      results.push({ userId: notification.userId, ...result });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error(`Error in batch notification for user ${notification.userId}:`, error);
      results.push({ 
        userId: notification.userId, 
        success: false, 
        error: error.message 
      });
    }
  }

  return results;
}

module.exports = {
  sendPushNotification,
  sendDailyActivityNotification,
  sendBatchNotifications
};
