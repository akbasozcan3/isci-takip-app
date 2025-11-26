// Subscription Check Middleware
// Belirli özelliklere erişimi kontrol eder

const db = require('../config/database');
const SubscriptionModel = require('../models/subscription');

// Kullanıcıyı token'dan çöz
function resolveUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const tokenData = db.getToken(token);
  if (!tokenData) return null;
  return db.findUserById(tokenData.userId) || null;
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
      case 'maxGroups':
        const groups = db.getGroupsByAdmin(user.id);
        currentCount = groups.length;
        break;
      case 'maxMembers':
        // Tüm gruplarındaki toplam üye sayısı
        const userGroups = db.getUserGroups(user.id);
        currentCount = userGroups.reduce((sum, g) => sum + (g.memberCount || 0), 0);
        break;
      case 'maxWorkspaces':
        // Workspace sayısı (şimdilik grup sayısı ile aynı)
        currentCount = db.getUserGroups(user.id).length;
        break;
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
    req.subscription = SubscriptionModel.getSubscriptionSummary(user.id);
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

