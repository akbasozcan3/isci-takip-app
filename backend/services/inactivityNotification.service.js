/**
 * Inactivity Notification Service
 * Sends notifications when devices are inactive for 15 minutes
 */

const { logger } = require('../core/utils/logger');
const db = require('../config/database');
const onesignalService = require('./onesignalService');

class InactivityNotificationService {
  constructor() {
    this.checkInterval = 60000; // Check every minute
    this.inactivityThreshold = 15 * 60 * 1000; // 15 minutes in milliseconds
    this.intervalId = null;
    this.lastCheckTime = Date.now();
    this.notifiedDevices = new Set(); // Track devices we've already notified
  }

  /**
   * Start the inactivity monitoring service
   */
  start() {
    if (this.intervalId) {
      logger.warn('Inactivity notification service already running');
      return;
    }

    logger.info('Starting inactivity notification service');
    
    this.intervalId = setInterval(() => {
      this.checkInactiveDevices();
    }, this.checkInterval);

    // Run initial check after 1 minute
    setTimeout(() => {
      this.checkInactiveDevices();
    }, 60000);
  }

  /**
   * Stop the inactivity monitoring service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Inactivity notification service stopped');
    }
  }

  /**
   * Check for inactive devices and send notifications
   */
  async checkInactiveDevices() {
    try {
      const now = Date.now();
      const users = Object.values(db.data.users || {});
      const inactiveUsers = [];

      for (const user of users) {
        const userId = user.id || user._id;
        if (!userId) continue;

        // Get user's last location from store
        const userLocations = db.data.store?.[userId] || [];
        if (userLocations.length === 0) continue;

        const lastLocation = userLocations[userLocations.length - 1];
        let lastLocationTime = 0;
        
        if (lastLocation.timestamp) {
          if (typeof lastLocation.timestamp === 'string') {
            lastLocationTime = Date.parse(lastLocation.timestamp) || 0;
          } else if (typeof lastLocation.timestamp === 'number') {
            lastLocationTime = lastLocation.timestamp;
          }
        } else if (lastLocation.time) {
          lastLocationTime = typeof lastLocation.time === 'string' ? Date.parse(lastLocation.time) : lastLocation.time;
        }
        
        const timeSinceLastLocation = now - lastLocationTime;

        // Check if user is inactive (no location update in last 15 minutes)
        if (timeSinceLastLocation >= this.inactivityThreshold) {
          // Check if we've already notified this user in the last hour
          const notificationKey = `inactive_${userId}`;
          const lastNotification = this.notifiedDevices.has(notificationKey);
          
          if (!lastNotification) {
            inactiveUsers.push({
              userId,
              user,
              lastLocationTime,
              timeSinceLastLocation: Math.floor(timeSinceLastLocation / 60000), // minutes
            });
          }
        } else {
          // User is active, remove from notified set if exists
          const notificationKey = `inactive_${userId}`;
          this.notifiedDevices.delete(notificationKey);
        }
      }

      // Send notifications to inactive users
      if (inactiveUsers.length > 0) {
        await this.sendInactivityNotifications(inactiveUsers);
      }

      this.lastCheckTime = now;
    } catch (error) {
      logger.error(`Error checking inactive devices: ${error.message || error}`);
    }
  }

  /**
   * Send inactivity notifications to users
   */
  async sendInactivityNotifications(inactiveUsers) {
    for (const { userId, user, timeSinceLastLocation } of inactiveUsers) {
      try {
        // Get user's OneSignal player ID
        const playerId = user.onesignalPlayerId || db.getUserOnesignalPlayerId(userId);
        if (!playerId) {
          logger.debug(`No OneSignal player ID for user ${userId}, skipping notification`);
          continue;
        }

        const userName = user.name || user.email || 'Kullanıcı';
        const minutes = Math.floor(timeSinceLastLocation);

        // Send notification
        const notificationResult = await onesignalService.sendToPlayer(
          playerId,
          {
            title: '📍 Konum Güncellemesi',
            message: `${userName}, ${minutes} dakikadır konum bilginiz güncellenmedi. Lütfen uygulamayı açın ve konum paylaşımınızı kontrol edin.`,
            data: {
              type: 'inactivity_alert',
              userId,
              minutes,
            },
            android_channel_id: 'inactivity_alerts',
            android_visibility: 1,
            android_accent_color: 'FF6B6B',
          }
        );

        if (notificationResult.success) {
          logger.info(`Inactivity notification sent to user ${userId} (${minutes} minutes inactive)`);
          
          // Mark as notified
          const notificationKey = `inactive_${userId}`;
          this.notifiedDevices.add(notificationKey);
          
          // Remove from notified set after 1 hour
          setTimeout(() => {
            this.notifiedDevices.delete(notificationKey);
          }, 60 * 60 * 1000);
        } else {
          logger.warn(`Failed to send inactivity notification to user ${userId}: ${notificationResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        logger.error(`Error sending inactivity notification to user ${userId}: ${error.message || error}`);
      }
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      running: !!this.intervalId,
      lastCheckTime: this.lastCheckTime,
      inactivityThreshold: this.inactivityThreshold / 60000, // minutes
      notifiedDevicesCount: this.notifiedDevices.size,
    };
  }

  /**
   * Manually check inactive devices (for testing)
   */
  async manualCheck() {
    logger.info('Manual inactivity check triggered');
    await this.checkInactiveDevices();
  }
}

module.exports = new InactivityNotificationService();

