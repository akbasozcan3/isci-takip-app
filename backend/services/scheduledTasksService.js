const dailyActivityService = require('./dailyActivityService');
const pushNotificationService = require('./pushNotificationService');
const { createLogger } = require('../core/utils/logger');

const logger = createLogger('ScheduledTasksService');

class ScheduledTasksService {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Scheduled tasks already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Scheduled tasks service started');

    this.scheduleDailyActivityCheck();
    this.scheduleHourlyActivityCheck();
  }

  stop() {
    this.isRunning = false;
    for (const [name, interval] of this.tasks.entries()) {
      clearInterval(interval);
      logger.info(`Stopped task: ${name}`);
    }
    this.tasks.clear();
    logger.info('⏹️ Scheduled tasks service stopped');
  }

  scheduleDailyActivityCheck() {
    const runDailyCheck = async () => {
      if (!this.isRunning) return;

      try {
        logger.info('📊 Running daily activity check...');
        await this.checkDailyActivities();
      } catch (error) {
        logger.error('Error in daily activity check:', error);
      }
    };

    runDailyCheck();
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);

    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      const dailyInterval = setInterval(() => {
        runDailyCheck();
      }, 24 * 60 * 60 * 1000);

      this.tasks.set('dailyActivityCheck', dailyInterval);
    }, msUntilTomorrow);

    logger.info(`⏰ Daily activity check scheduled for ${tomorrow.toISOString()}`);
  }

  scheduleHourlyActivityCheck() {
    const runHourlyCheck = async () => {
      if (!this.isRunning) return;

      try {
        logger.info('⏱️ Running hourly activity check...');
        await this.checkHourlyActivities();
      } catch (error) {
        logger.error('Error in hourly activity check:', error);
      }
    };

    runHourlyCheck();
    
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

    const msUntilNextHour = nextHour.getTime() - now.getTime();

    setTimeout(() => {
      const hourlyInterval = setInterval(() => {
        runHourlyCheck();
      }, 60 * 60 * 1000);

      this.tasks.set('hourlyActivityCheck', hourlyInterval);
    }, msUntilNextHour);

    logger.info(`⏰ Hourly activity check scheduled for ${nextHour.toISOString()}`);
  }

  async checkDailyActivities() {
    try {
      const activities = dailyActivityService.getAllUsersDailyActivity();
      const notifications = [];

      for (const activity of activities) {
        if (activity.today.distance <= 0) continue;
        
        const checks = dailyActivityService.checkActivityThresholds(activity, {
          minDistance: 5,
          maxDistance: 50
        });

        if (checks.reachedMin) {
          const user = require('../config/database').findUserById(activity.userId);
          if (!user) continue;
          
          let title = '🏃 Günlük Aktivite';
          let message = `Bugün ${activity.today.distance.toFixed(1)} km yürüdünüz!`;
          
          if (checks.improved) {
            title = '🎉 Harika İlerleme!';
            message = `Bugün ${activity.today.distance.toFixed(1)} km yürüdünüz! Dünkünden daha fazla!`;
          } else if (activity.today.distance >= 5) {
            title = '✅ Hedef Aşıldı!';
            message = `Tebrikler! Bugün ${activity.today.distance.toFixed(1)} km yürüdünüz. 5 km hedefini aştınız!`;
          }
          
          notifications.push({
            userId: activity.userId,
            message,
            options: {
              title,
              type: 'daily_activity',
              data: {
                distance: activity.today.distance,
                threshold: 5,
                improved: checks.improved,
                yesterdayDistance: activity.yesterday.distance
              },
              deepLink: 'bavaxe://analytics'
            }
          });
        }
      }

      if (notifications.length > 0) {
        logger.info(`📤 Sending ${notifications.length} daily activity notifications...`);
        const results = await pushNotificationService.sendBatchNotifications(notifications);
        
        const successCount = results.filter(r => r.success).length;
        logger.info(`✅ Sent ${successCount}/${notifications.length} notifications successfully`);
      } else {
        logger.info('ℹ️ No daily activity notifications to send');
      }
    } catch (error) {
      logger.error('Error checking daily activities:', error);
    }
  }

  async checkHourlyActivities() {
    try {
      const activities = dailyActivityService.getAllUsersDailyActivity();
      const notifications = [];

      for (const activity of activities) {
        if (activity.today.distance >= 5 && activity.today.distance > 0) {
          const checks = dailyActivityService.checkActivityThresholds(activity, {
            minDistance: 5
          });

          if (checks.reachedMin && !checks.improved) {
            const user = require('../config/database').findUserById(activity.userId);
            if (user && user.displayName) {
              notifications.push({
                userId: activity.userId,
                message: `${user.displayName}, bugün ${activity.today.distance.toFixed(1)} km yürüdünüz!`,
                options: {
                  title: '🎯 Hedef Aşıldı!',
                  type: 'activity_milestone',
                  data: {
                    distance: activity.today.distance,
                    threshold: 5
                  }
                }
              });
            }
          }
        }
      }

      if (notifications.length > 0) {
        logger.info(`📤 Sending ${notifications.length} hourly activity notifications...`);
        const results = await pushNotificationService.sendBatchNotifications(notifications);
        
        const successCount = results.filter(r => r.success).length;
        logger.info(`✅ Sent ${successCount}/${notifications.length} notifications successfully`);
      }
    } catch (error) {
      logger.error('Error checking hourly activities:', error);
    }
  }

  async triggerManualCheck() {
    logger.info('🔔 Manual activity check triggered');
    await this.checkDailyActivities();
  }
}

const scheduledTasksService = new ScheduledTasksService();

module.exports = scheduledTasksService;
