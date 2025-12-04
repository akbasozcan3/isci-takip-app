const db = require('../../../config/database');

class BillingModel {
  static getUserSubscription(userId) {
    return db.getUserSubscription(userId);
  }

  static setUserSubscription(userId, updates) {
    return db.setUserSubscription(userId, updates);
  }

  static addEvent(userId, event) {
    return db.addBillingEvent(userId, event);
  }

  static getHistory(userId) {
    return db.getBillingHistory(userId);
  }
}

module.exports = BillingModel;

