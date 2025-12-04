// Subscription Check Middleware
// Belirli özelliklere erişimi kontrol eder

const db = require('../../config/database');
const SubscriptionModel = require('../database/models/subscription.model');
const TokenModel = require('../database/models/token.model');
const UserModel = require('../database/models/user.model');

function resolveUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const tokenData = TokenModel.get(token);
  if (!tokenData) return null;
  return UserModel.findById(tokenData.userId) || null;
}

// Belirli bir özelliğe erişim gerektiren middleware
function requireFeature(feature) {
  return (req, res, next) => {
    const user = resolveUser(req);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Kimlik doğrulaması gerekli',
        code: 'AUTH_REQUIRED'
      });
    }

    const hasAccess = SubscriptionModel.hasFeature(user.id, feature);
    
    if (!hasAccess) {
      const subscription = db.getUserSubscription(user.id);
      return res.status(403).json({
        error: `Bu özellik için ${feature === 'apiAccess' ? 'Business' : 'Plus veya Business'} plan gerekli`,
        code: 'UPGRADE_REQUIRED',
        currentPlan: subscription?.planId || 'free',
        requiredFeature: feature
      });
    }

    req.user = user;
    next();
  };
}

// Belirli bir limit kontrolü yapan middleware
function checkLimit(limitType) {
  return async (req, res, next) => {
    const user = resolveUser(req);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Kimlik doğrulaması gerekli',
        code: 'AUTH_REQUIRED'
      });
    }

    // Mevcut sayıyı hesapla (limit türüne göre)
    let currentCount = 0;
    
    switch (limitType) {
      case 'maxGroups': {
        const GroupModel = require('../database/models/group.model');
        const groups = GroupModel.getByAdmin(user.id);
        currentCount = groups.length;
        break;
      }
      case 'maxMembers': {
        const GroupModel = require('../database/models/group.model');
        const userGroups = GroupModel.getUserGroups(user.id);
        currentCount = userGroups.reduce((sum, g) => sum + (g.memberCount || 0), 0);
        break;
      }
      case 'maxWorkspaces': {
        const GroupModel = require('../database/models/group.model');
        currentCount = GroupModel.getUserGroups(user.id).length;
        break;
      }
      default:
        currentCount = 0;
    }

    const { allowed, remaining } = SubscriptionModel.checkLimit(user.id, limitType, currentCount);
    
    if (!allowed) {
      const subscription = db.getUserSubscription(user.id);
      return res.status(403).json({
        error: `${limitType} limitine ulaştınız. Planınızı yükseltin.`,
        code: 'LIMIT_REACHED',
        currentPlan: subscription?.planId || 'free',
        limitType,
        currentCount,
        limit: SubscriptionModel.getPlanLimits(subscription?.planId || 'free')[limitType]
      });
    }

    req.user = user;
    req.limitInfo = { remaining, currentCount };
    next();
  };
}

// Premium plan gerektiren middleware
function requirePremium(req, res, next) {
  const user = resolveUser(req);
  
  if (!user) {
    return res.status(401).json({ 
      error: 'Kimlik doğrulaması gerekli',
      code: 'AUTH_REQUIRED'
    });
  }

  const subscription = db.getUserSubscription(user.id);
  const planId = subscription?.planId || 'free';
  
  if (planId === 'free') {
    return res.status(403).json({
      error: 'Bu özellik için premium abonelik gerekli',
      code: 'PREMIUM_REQUIRED',
      currentPlan: planId
    });
  }

  req.user = user;
  next();
}

// Abonelik bilgisini request'e ekleyen middleware
function attachSubscription(req, res, next) {
  const user = resolveUser(req);
  
  if (user) {
    req.user = user;
    const summary = SubscriptionModel.getSubscriptionSummary(user.id);
    req.subscription = summary;
    
    const limits = SubscriptionModel.getPlanLimits(summary.planId);
    req.planLimits = limits;
    req.isPremium = summary.planId !== 'free';
    req.isBusiness = summary.planId === 'business';
    
    if (req.isPremium) {
      res.setHeader('X-Subscription-Plan', summary.planId);
      res.setHeader('X-Subscription-Status', summary.status || 'active');
    }
  }
  
  next();
}

module.exports = {
  requireFeature,
  checkLimit,
  requirePremium,
  attachSubscription,
  resolveUser
};

