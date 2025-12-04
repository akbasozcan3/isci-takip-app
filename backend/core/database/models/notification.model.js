const db = require('../../../config/database');

class NotificationModel {
  static getByUser(userId) {
    return db.getNotifications(userId);
  }

  static add(userId, notification) {
    return db.addNotification(userId, notification);
  }

  static markAllRead(userId) {
    return db.markAllNotificationsRead(userId);
  }

  static markRead(userId, id) {
    return db.markNotificationRead(userId, id);
  }
}

module.exports = NotificationModel;

