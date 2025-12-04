const rateLimitMap = new Map();
const db = require('../../config/database');

function getPlanBasedLimits(userId) {
  if (!userId) {
    return { windowMs: 60000, maxRequests: 50 };
  }
  
  const subscription = db.getUserSubscription(userId);
  const planId = subscription?.planId || 'free';
  
  const planLimits = {
    free: { windowMs: 60000, maxRequests: 50 },
    plus: { windowMs: 60000, maxRequests: 200 },
    business: { windowMs: 60000, maxRequests: 500 }
  };
  
  return planLimits[planId] || planLimits.free;
}

function rateLimiter(windowMs = 60000, maxRequests = 100) {
  return (req, res, next) => {
    const userId = req.user?.id || req.subscription?.userId || null;
    const planLimits = getPlanBasedLimits(userId);
    const effectiveWindowMs = planLimits.windowMs;
    const effectiveMaxRequests = planLimits.maxRequests;
    
    const key = userId ? `user:${userId}` : (req.ip || req.connection.remoteAddress);
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, resetTime: now + effectiveWindowMs });
      return next();
    }
    
    const record = rateLimitMap.get(key);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + effectiveWindowMs;
      return next();
    }
    
    if (record.count >= effectiveMaxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Max ${effectiveMaxRequests} requests per ${effectiveWindowMs / 1000} seconds.`,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        plan: userId ? (db.getUserSubscription(userId)?.planId || 'free') : 'anonymous'
      });
    }
    
    record.count++;
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

module.exports = rateLimiter;

