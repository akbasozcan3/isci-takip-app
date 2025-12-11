const db = require('../config/database');

class ActivityLogService {
  constructor() {
    this.activities = db.data.activities || [];
    if (!db.data.activities) {
      db.data.activities = this.activities;
    }
  }

  logActivity(userId, type, action, metadata = {}) {
    const activity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      action,
      metadata,
      timestamp: Date.now(),
      ip: metadata.ip || null,
      userAgent: metadata.userAgent || null,
      deviceId: metadata.deviceId || null,
      groupId: metadata.groupId || null,
      locationId: metadata.locationId || null
    };

    this.activities.push(activity);

    if (this.activities.length > 100000) {
      const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
      this.activities = this.activities.filter(a => a.timestamp > cutoff);
      db.data.activities = this.activities;
    }

    db.save();
    return activity;
  }

  getUserActivities(userId, limit = 50, offset = 0) {
    return this.activities
      .filter(a => a.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);
  }

  getGroupActivities(groupId, limit = 50, offset = 0) {
    return this.activities
      .filter(a => a.metadata?.groupId === groupId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);
  }

  getActivitiesByType(type, limit = 50, offset = 0) {
    return this.activities
      .filter(a => a.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);
  }

  getRecentActivities(limit = 100) {
    return this.activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getActivityStats(userId, startDate, endDate) {
    const userActivities = this.activities.filter(a => {
      if (a.userId !== userId) return false;
      if (startDate && a.timestamp < startDate) return false;
      if (endDate && a.timestamp > endDate) return false;
      return true;
    });

    const stats = {
      total: userActivities.length,
      byType: {},
      byAction: {},
      daily: {}
    };

    userActivities.forEach(activity => {
      stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
      stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
      
      const date = new Date(activity.timestamp).toISOString().split('T')[0];
      stats.daily[date] = (stats.daily[date] || 0) + 1;
    });

    return stats;
  }

  cleanupOldActivities(daysToKeep = 90) {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const before = this.activities.length;
    this.activities = this.activities.filter(a => a.timestamp > cutoff);
    const after = this.activities.length;
    db.data.activities = this.activities;
    db.save();
    return { before, after, removed: before - after };
  }
}

module.exports = new ActivityLogService();

