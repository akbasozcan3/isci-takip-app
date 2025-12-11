const scheduledTasksService = require('../services/scheduledTasksService');
const dailyActivityService = require('../services/dailyActivityService');
const pushNotificationService = require('../services/pushNotificationService');
const activityLogService = require('../services/activityLogService');
let logger;
try {
  const { getLogger } = require('../core/utils/loggerHelper');
  logger = getLogger('ScheduledTasksController');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[ScheduledTasksController]', ...args),
    error: (...args) => console.error('[ScheduledTasksController]', ...args),
    info: (...args) => console.log('[ScheduledTasksController]', ...args),
    debug: (...args) => console.debug('[ScheduledTasksController]', ...args)
  };
}
const ResponseFormatter = require('../core/utils/responseFormatter');

class ScheduledTasksController {
  async triggerManualCheck(req, res) {
    try {
      const userId = req.user?.id;
      await scheduledTasksService.triggerManualCheck();
      
      if (userId) {
        activityLogService.logActivity(userId, 'scheduled', 'trigger_manual_check', { path: req.path });
      }
      
      return res.json(ResponseFormatter.success({
        message: 'Manual activity check triggered',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      logger.error('Error triggering manual check:', error);
      return res.status(500).json(ResponseFormatter.error('Failed to trigger manual check', error.message));
    }
  }

  async getUserActivity(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const requestUserId = req.user?.id;
      const activity = dailyActivityService.getUserDailyActivity(targetUserId);
      const checks = dailyActivityService.checkActivityThresholds(activity, {
        minDistance: 5
      });

      if (requestUserId) {
        activityLogService.logActivity(requestUserId, 'scheduled', 'view_user_activity', {
          targetUserId,
          path: req.path
        });
      }

      return res.json(ResponseFormatter.success({
        activity,
        checks,
        summary: {
          todayDistance: activity.today.distance,
          yesterdayDistance: activity.yesterday.distance,
          reachedGoal: checks.reachedMin,
          improved: checks.improved
        }
      }));
    } catch (error) {
      logger.error('Error getting user activity:', error);
      return res.status(500).json(ResponseFormatter.error('Failed to get user activity', error.message));
    }
  }

  async sendTestNotification(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const db = require('../config/database');
      const tokenData = db.getToken(token || '');
      if (!tokenData) {
        return res.status(401).json(ResponseFormatter.error('Unauthorized'));
      }

      const userId = tokenData.userId;
      const { message = 'Test bildirimi', title = '🧪 Test' } = req.body;

      const result = await pushNotificationService.sendPushNotification(userId, message, {
        title,
        type: 'test',
        data: { test: true }
      });

      if (result.success) {
        activityLogService.logActivity(userId, 'scheduled', 'send_test_notification', {
          notificationId: result.notificationId,
          path: req.path
        });
        
        return res.json(ResponseFormatter.success({
          message: 'Test notification sent',
          notificationId: result.notificationId
        }));
      } else {
        return res.status(500).json(ResponseFormatter.error('Failed to send notification', result.error));
      }
    } catch (error) {
      logger.error('Error sending test notification:', error);
      return res.status(500).json(ResponseFormatter.error('Failed to send test notification', error.message));
    }
  }

  async getAllActivities(req, res) {
    try {
      const userId = req.user?.id;
      const activities = dailyActivityService.getAllUsersDailyActivity();
      
      if (userId) {
        activityLogService.logActivity(userId, 'scheduled', 'view_all_activities', {
          activityCount: activities.length,
          path: req.path
        });
      }
      
      return res.json(ResponseFormatter.success({
        activities,
        count: activities.length,
        summary: {
          totalUsers: activities.length,
          usersWithActivity: activities.filter(a => a.today.distance > 0).length,
          totalDistance: activities.reduce((sum, a) => sum + a.today.distance, 0)
        }
      }));
    } catch (error) {
      logger.error('Error getting all activities:', error);
      return res.status(500).json(ResponseFormatter.error('Failed to get activities', error.message));
    }
  }
}

module.exports = new ScheduledTasksController();
