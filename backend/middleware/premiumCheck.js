const db = require('../config/database');
const SubscriptionModel = require('../core/database/models/subscription.model');
const ResponseFormatter = require('../core/utils/responseFormatter');

function requirePremium(featureName = 'this feature') {
  return (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED'));
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';

      if (planId === 'free') {
        return res.status(403).json(ResponseFormatter.error(
          `${featureName} requires premium subscription`,
          'PREMIUM_REQUIRED',
          { currentPlan: planId, requiredPlan: 'plus' }
        ));
      }

      req.subscription = subscription;
      req.planId = planId;
      next();
    } catch (error) {
      console.error('Premium check error:', error);
      return res.status(500).json(ResponseFormatter.error('Subscription check failed', 'SUBSCRIPTION_CHECK_ERROR'));
    }
  };
}

function requireBusiness(featureName = 'this feature') {
  return (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED'));
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';

      if (planId !== 'business') {
        return res.status(403).json(ResponseFormatter.error(
          `${featureName} requires business subscription`,
          'BUSINESS_REQUIRED',
          { currentPlan: planId, requiredPlan: 'business' }
        ));
      }

      req.subscription = subscription;
      req.planId = planId;
      next();
    } catch (error) {
      console.error('Business check error:', error);
      return res.status(500).json(ResponseFormatter.error('Subscription check failed', 'SUBSCRIPTION_CHECK_ERROR'));
    }
  };
}

function checkFeature(featureKey) {
  return (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Authentication required', 'AUTH_REQUIRED'));
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      const limits = SubscriptionModel.getPlanLimits(planId);

      if (!limits[featureKey]) {
        return res.status(403).json(ResponseFormatter.error(
          `Feature '${featureKey}' is not available in your plan`,
          'FEATURE_NOT_AVAILABLE',
          { currentPlan: planId, feature: featureKey }
        ));
      }

      req.subscription = subscription;
      req.planId = planId;
      req.planLimits = limits;
      next();
    } catch (error) {
      console.error('Feature check error:', error);
      return res.status(500).json(ResponseFormatter.error('Feature check failed', 'FEATURE_CHECK_ERROR'));
    }
  };
}

module.exports = {
  requirePremium,
  requireBusiness,
  checkFeature
};

