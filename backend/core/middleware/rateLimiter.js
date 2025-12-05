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
    const isAnalyticsEndpoint = req.path.includes('/analytics') || req.path.includes('/location/analytics');
    
    if (isAnalyticsEndpoint) {
      const analyticsLimits = {
        free: { windowMs: 30000, maxRequests: 20 },
        plus: { windowMs: 30000, maxRequests: 50 },
        business: { windowMs: 30000, maxRequests: 100 }
      };
      
      const userId = req.user?.id || req.subscription?.userId || null;
      const subscription = userId ? db.getUserSubscription(userId) : null;
      const planId = subscription?.planId || 'free';
      const limits = analyticsLimits[planId] || analyticsLimits.free;
      
      const key = `analytics:${userId || req.ip || req.connection.remoteAddress}`;
      const now = Date.now();
      
      if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, resetTime: now + limits.windowMs });
        return next();
      }
      
      const record = rateLimitMap.get(key);
      
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + limits.windowMs;
        return next();
      }
      
      if (record.count >= limits.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Analytics rate limit exceeded. Max ${limits.maxRequests} requests per ${limits.windowMs / 1000} seconds.`,
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
          plan: planId
        });
      }
      
      record.count++;
      return next();
    }
    
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
  const keysToDelete = [];
  let processed = 0;
  const maxProcessPerIteration = 5000;
  
  for (const [key, record] of rateLimitMap.entries()) {
    if (processed >= maxProcessPerIteration) break;
    if (now > record.resetTime) {
      keysToDelete.push(key);
      processed++;
    }
  }
  
  for (const key of keysToDelete) {
    rateLimitMap.delete(key);
  }
  
  if (rateLimitMap.size > 10000) {
    const sortedEntries = Array.from(rateLimitMap.entries())
      .sort((a, b) => a[1].resetTime - b[1].resetTime);
    
    const toRemove = sortedEntries.slice(0, Math.floor(rateLimitMap.size * 0.15));
    for (const [key] of toRemove) {
      rateLimitMap.delete(key);
    }
  }
  
  if (global.gc && rateLimitMap.size > 50000) {
    global.gc();
  }
}, 20000);

module.exports = rateLimiter;

