const db = require('../config/database');

class NotificationsProcessingService {
  constructor() {
    this.statsCache = new Map();
    this.cacheTTL = 300;
    this.maxCacheSize = 200;
  }

  getCacheKey(userId) {
    return `stats:${userId}`;
  }

  getCached(key) {
    const entry = this.statsCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTTL * 1000) {
      this.statsCache.delete(key);
      return null;
    }
    return entry.data;
  }

  setCache(key, data) {
    if (this.statsCache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.statsCache.keys())[0];
      this.statsCache.delete(oldestKey);
    }
    this.statsCache.set(key, { data, timestamp: Date.now() });
  }

  async processNotifications(userId, notifications) {
    if (!userId || !Array.isArray(notifications)) {
      throw new Error('user_id and notifications array required');
    }

    const processed = notifications.map(notif => ({
      user_id: userId,
      type: notif.type,
      message: notif.message,
      priority: notif.priority || 'medium',
      processed_at: Date.now(),
      status: 'queued'
    }));

    return {
      success: true,
      processed: processed.length,
      notifications: processed,
      timestamp: Date.now()
    };
  }

  async getNotificationStats(userId) {
    if (!userId) {
      throw new Error('user_id required');
    }

    const cacheKey = this.getCacheKey(userId);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const notifications = db.getNotifications(userId) || [];
    
    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      by_type: this.groupByType(notifications),
      by_priority: this.groupByPriority(notifications)
    };

    const result = {
      user_id: userId,
      stats: stats,
      timestamp: Date.now()
    };

    this.setCache(cacheKey, result);
    return result;
  }

  groupByType(notifications) {
    const grouped = {};
    for (const notif of notifications) {
      const type = notif.type || 'unknown';
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }

  groupByPriority(notifications) {
    const grouped = { low: 0, medium: 0, high: 0 };
    for (const notif of notifications) {
      const priority = notif.priority || 'medium';
      grouped[priority] = (grouped[priority] || 0) + 1;
    }
    return grouped;
  }
}

module.exports = new NotificationsProcessingService();
