/**
 * Step Tracking Notification Service
 * Professional notification system for step tracking events
 */

const notificationService = require('./notificationService');
const db = require('../config/database');
const activityLogService = require('./activityLogService');
const logger = require('../core/utils/logger');

class StepNotificationService {
  /**
   * Get motivational message based on step count
   */
  getStepMessage(steps) {
    if (steps >= 10000) {
      return {
        message: `Harika bir gün geçirdiniz! 🎉`,
        emoji: '🎉',
        level: 'excellent'
      };
    } else if (steps >= 5000) {
      return {
        message: `Mükemmel bir performans! 👏`,
        emoji: '👏',
        level: 'great'
      };
    } else if (steps >= 1000) {
      return {
        message: `İyi iş çıkardınız! 💪`,
        emoji: '💪',
        level: 'good'
      };
    } else if (steps >= 100) {
      return {
        message: `Devam edin! 🚶`,
        emoji: '🚶',
        level: 'ok'
      };
    } else {
      return {
        message: `Takip durduruldu.`,
        emoji: '✅',
        level: 'info'
      };
    }
  }

  /**
   * Send step tracking start notification
   */
  async notifyTrackingStart(userId) {
    try {
      const user = db.findUserById(userId);
      if (!user) {
        logger.warn(`[StepNotificationService] User not found: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      const playerId = user?.onesignalPlayerId || db.getUserOnesignalPlayerId(userId);
      
      const notificationPayload = {
        title: '🚶 Adım Sayarınız Başladı',
        message: 'Adım takibi aktif. Yürüyüşünüzü kaydediyoruz.',
        type: 'info',
        deepLink: 'bavaxe://steps',
        priority: 10,
        data: {
          type: 'step_tracking_started',
          timestamp: Date.now(),
          userId
        }
      };

      logger.info(`[StepNotificationService] 📤 Sending start notification to user ${userId}`);

      const result = await notificationService.send(userId, notificationPayload, ['database', 'onesignal']);
      
      const onesignalResult = result.find(r => r.channel === 'onesignal');
      const databaseResult = result.find(r => r.channel === 'database');
      
      if (onesignalResult?.success) {
        logger.info(`[StepNotificationService] ✅ OneSignal notification sent to user ${userId}`);
      } else {
        logger.warn(`[StepNotificationService] ⚠️ OneSignal notification failed: ${onesignalResult?.error || 'Unknown error'}`);
      }

      // Log activity
      activityLogService.logActivity(userId, 'steps', 'notification_start_tracking', {
        success: onesignalResult?.success || false,
        playerId: playerId || null
      });

      return {
        success: onesignalResult?.success || databaseResult?.success || false,
        channels: result
      };
    } catch (error) {
      logger.error(`[StepNotificationService] ❌ Start notification error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send step tracking stop notification
   */
  async notifyTrackingStop(userId, todaySteps = 0) {
    try {
      const user = db.findUserById(userId);
      if (!user) {
        logger.warn(`[StepNotificationService] User not found: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      const playerId = user?.onesignalPlayerId || db.getUserOnesignalPlayerId(userId);
      
      // Get appropriate message based on step count
      const stepInfo = this.getStepMessage(todaySteps);
      
      const notificationPayload = {
        title: '✅ Adım Takibi Durduruldu',
        message: `Bugün ${todaySteps.toLocaleString('tr-TR')} adım kaydedildi. ${stepInfo.message}`,
        type: 'info',
        deepLink: 'bavaxe://steps',
        priority: 10,
        data: {
          type: 'step_tracking_stopped',
          steps: todaySteps,
          timestamp: Date.now(),
          userId,
          level: stepInfo.level,
          hasMotivation: todaySteps >= 100
        }
      };

      logger.info(`[StepNotificationService] 📤 Sending stop notification to user ${userId} (${todaySteps} steps)`);

      const result = await notificationService.send(userId, notificationPayload, ['database', 'onesignal']);
      
      const onesignalResult = result.find(r => r.channel === 'onesignal');
      const databaseResult = result.find(r => r.channel === 'database');
      
      if (onesignalResult?.success) {
        logger.info(`[StepNotificationService] ✅ OneSignal notification sent to user ${userId}`);
      } else {
        logger.warn(`[StepNotificationService] ⚠️ OneSignal notification failed: ${onesignalResult?.error || 'Unknown error'}`);
      }

      // Log activity
      activityLogService.logActivity(userId, 'steps', 'notification_stop_tracking', {
        steps: todaySteps,
        success: onesignalResult?.success || false,
        playerId: playerId || null,
        level: stepInfo.level
      });

      return {
        success: onesignalResult?.success || databaseResult?.success || false,
        channels: result,
        stepInfo
      };
    } catch (error) {
      logger.error(`[StepNotificationService] ❌ Stop notification error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send goal achievement notification
   */
  async notifyGoalAchieved(userId, steps, goal) {
    try {
      const user = db.findUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const percentage = Math.round((steps / goal) * 100);
      let message = `Hedefinize ulaştınız! 🎯`;
      
      if (percentage >= 150) {
        message = `Hedefinizi %${percentage} ile aştınız! 🚀`;
      } else if (percentage >= 120) {
        message = `Hedefinizi %${percentage} ile geçtiniz! 🎉`;
      }

      const notificationPayload = {
        title: '🎯 Hedef Tamamlandı!',
        message: `${message} Bugün ${steps.toLocaleString('tr-TR')} adım attınız.`,
        type: 'success',
        deepLink: 'bavaxe://steps',
        priority: 10,
        data: {
          type: 'goal_achieved',
          steps,
          goal,
          percentage,
          timestamp: Date.now()
        }
      };

      const result = await notificationService.send(userId, notificationPayload, ['database', 'onesignal']);
      
      activityLogService.logActivity(userId, 'steps', 'notification_goal_achieved', {
        steps,
        goal,
        percentage
      });

      return {
        success: result.some(r => r.success),
        channels: result
      };
    } catch (error) {
      logger.error(`[StepNotificationService] ❌ Goal achievement notification error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send milestone notification (e.g., 1000, 5000, 10000 steps)
   */
  async notifyMilestone(userId, steps, milestone) {
    try {
      const milestones = {
        100: { emoji: '🌱', message: 'İlk 100 adım!' },
        500: { emoji: '🌿', message: '500 adıma ulaştınız!' },
        1000: { emoji: '🏃', message: '1000 adım tamamlandı!' },
        5000: { emoji: '💪', message: '5000 adım harika!' },
        10000: { emoji: '🎉', message: '10000 adım mükemmel!' }
      };

      const milestoneInfo = milestones[milestone] || { emoji: '🎯', message: 'Yeni kilometre taşı!' };

      const notificationPayload = {
        title: `${milestoneInfo.emoji} Kilometre Taşı`,
        message: `${milestoneInfo.message} Toplam ${steps.toLocaleString('tr-TR')} adım.`,
        type: 'success',
        deepLink: 'bavaxe://steps',
        priority: 10,
        data: {
          type: 'milestone_reached',
          steps,
          milestone,
          timestamp: Date.now()
        }
      };

      const result = await notificationService.send(userId, notificationPayload, ['database', 'onesignal']);
      
      activityLogService.logActivity(userId, 'steps', 'notification_milestone', {
        steps,
        milestone
      });

      return {
        success: result.some(r => r.success),
        channels: result
      };
    } catch (error) {
      logger.error(`[StepNotificationService] ❌ Milestone notification error:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new StepNotificationService();

