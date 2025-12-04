const db = require('../../../config/database');

const PLAN_LIMITS = {
  free: {
    maxWorkspaces: 1,
    maxMembers: 5,
    maxGroups: 1,
    dataRetentionDays: 7,
    realtimeTracking: false,
    advancedReports: false,
    apiAccess: false,
    prioritySupport: false,
    rateLimitRequests: 50,
    rateLimitWindow: 60000,
    cacheTTL: 60000,
    batchSize: 10,
    maxConcurrentRequests: 2,
    responseCompression: false,
    advancedAnalytics: false,
    exportLimit: 10,
    apiRateLimit: 0
  },
  plus: {
    maxWorkspaces: 5,
    maxMembers: 25,
    maxGroups: 10,
    dataRetentionDays: 90,
    realtimeTracking: true,
    advancedReports: true,
    apiAccess: false,
    prioritySupport: true,
    rateLimitRequests: 200,
    rateLimitWindow: 60000,
    cacheTTL: 300000,
    batchSize: 50,
    maxConcurrentRequests: 5,
    responseCompression: true,
    advancedAnalytics: true,
    exportLimit: 100,
    apiRateLimit: 0
  },
  business: {
    maxWorkspaces: -1,
    maxMembers: -1,
    maxGroups: -1,
    dataRetentionDays: -1,
    realtimeTracking: true,
    advancedReports: true,
    apiAccess: true,
    prioritySupport: true,
    rateLimitRequests: 500,
    rateLimitWindow: 60000,
    cacheTTL: 600000,
    batchSize: 200,
    maxConcurrentRequests: 20,
    responseCompression: true,
    advancedAnalytics: true,
    exportLimit: -1,
    apiRateLimit: 1000
  }
};

class SubscriptionModel {
  static getPlanLimits(planId) {
    return PLAN_LIMITS[planId] || PLAN_LIMITS.free;
  }

  static isActive(subscription) {
    if (!subscription) return false;
    if (subscription.status !== 'active') return false;
    if (subscription.renewsAt) {
      const renewDate = new Date(subscription.renewsAt);
      if (renewDate < new Date()) {
        return false;
      }
    }
    return true;
  }

  static hasFeature(userId, feature) {
    const subscription = db.getUserSubscription(userId);
    const planId = subscription?.planId || 'free';
    const limits = this.getPlanLimits(planId);
    return limits[feature] === true || limits[feature] === -1;
  }

  static checkLimit(userId, limitType, currentCount) {
    const subscription = db.getUserSubscription(userId);
    const planId = subscription?.planId || 'free';
    const limits = this.getPlanLimits(planId);
    const limit = limits[limitType];
    if (limit === -1) return { allowed: true, remaining: -1 };
    if (currentCount >= limit) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: limit - currentCount };
  }

  static getSubscriptionSummary(userId) {
    const subscription = db.getUserSubscription(userId) || {
      planId: 'free',
      planName: 'Free',
      status: 'active'
    };
    const limits = this.getPlanLimits(subscription.planId);
    const isActive = this.isActive(subscription);
    return {
      ...subscription,
      isActive,
      limits,
      features: {
        realtimeTracking: limits.realtimeTracking,
        advancedReports: limits.advancedReports,
        apiAccess: limits.apiAccess,
        prioritySupport: limits.prioritySupport
      }
    };
  }

  static isExpired(subscription) {
    if (!subscription?.renewsAt) return false;
    return new Date(subscription.renewsAt) < new Date();
  }

  static checkAndUpdateExpiredSubscriptions() {
    const users = Object.values(db.data.users || {});
    let updated = 0;
    for (const user of users) {
      if (user.subscription && this.isExpired(user.subscription)) {
        db.setUserSubscription(user.id, {
          planId: 'free',
          planName: 'Free',
          price: 0,
          currency: 'TRY',
          interval: 'monthly',
          status: 'expired',
          previousPlan: user.subscription.planId,
          expiredAt: new Date().toISOString()
        });
        updated++;
      }
    }
    return updated;
  }
}

module.exports = SubscriptionModel;

