const rateLimitMap = new Map();
const db = require('../../config/database');

function getPlanBasedLimits(userId) {
  if (!userId) {
    return { windowMs: 60000, maxRequests: 100 }; // Increased from 50 to 100
  }
  
  const subscription = db.getUserSubscription(userId);
  const planId = subscription?.planId || 'free';
  
  const planLimits = {
    free: { windowMs: 60000, maxRequests: 100 }, // Increased from 50 to 100 for better UX
    plus: { windowMs: 60000, maxRequests: 300 }, // Increased from 200 to 300
    business: { windowMs: 60000, maxRequests: 1000 } // Increased from 500 to 1000
  };
  
  return planLimits[planId] || planLimits.free;
}

function rateLimiter(windowMs = 60000, maxRequests = 100) {
  return (req, res, next) => {
    // Skip rate limiting for critical system endpoints
    const criticalEndpoints = [
      '/api/users/update-onesignal-id',
      '/api/health',
      '/api/auth/refresh',
      '/api/steps/start-tracking',
      '/api/steps/stop-tracking',
    ];
    
    if (criticalEndpoints.some(endpoint => req.path.includes(endpoint))) {
      return next();
    }
    
    const isStepsNotification = req.path.includes('/steps/start-tracking') || req.path.includes('/steps/stop-tracking');
    if (isStepsNotification) {
      return next();
    }
    
    // Steps endpoint'leri için özel rate limit (daha yüksek limit)
    const isStepsEndpoint = req.path.includes('/steps/');
    if (isStepsEndpoint) {
      const stepsLimits = {
        free: { windowMs: 60000, maxRequests: 60 }, // Free plan için 60 req/min (increased)
        plus: { windowMs: 60000, maxRequests: 150 }, // Plus plan için 150 req/min
        business: { windowMs: 60000, maxRequests: 300 } // Business plan için 300 req/min
      };
      
      const userId = req.user?.id || req.subscription?.userId || null;
      const subscription = userId ? db.getUserSubscription(userId) : null;
      const planId = subscription?.planId || 'free';
      const limits = stepsLimits[planId] || stepsLimits.free;
      
      const key = `steps:${userId || req.ip || req.connection.remoteAddress}`;
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
        const ResponseFormatter = require('../utils/responseFormatter');
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return res.status(429).json(
          ResponseFormatter.rateLimitError(retryAfter, limits.maxRequests, 0)
        );
      }
      
      record.count++;
      return next();
    }
    
    const isAnalyticsEndpoint = req.path.includes('/analytics') || req.path.includes('/location/analytics');
    
    if (isAnalyticsEndpoint) {
      const analyticsLimits = {
        free: { windowMs: 30000, maxRequests: 40 }, // Increased from 20 to 40
        plus: { windowMs: 30000, maxRequests: 100 }, // Increased from 50 to 100
        business: { windowMs: 30000, maxRequests: 200 } // Increased from 100 to 200
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
        const ResponseFormatter = require('../utils/responseFormatter');
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return res.status(429).json(
          ResponseFormatter.rateLimitError(retryAfter, limits.maxRequests, 0)
        );
      }
      
      record.count++;
      return next();
    }
    
    let userId = req.user?.id || req.subscription?.userId || null;
    
    if (!userId) {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const TokenModel = require('../database/models/token.model');
        const tokenData = TokenModel.get(token);
        if (tokenData) {
          userId = tokenData.userId;
        }
      }
    }
    
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
      const ResponseFormatter = require('../utils/responseFormatter');
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return res.status(429).json(
        ResponseFormatter.rateLimitError(retryAfter, effectiveMaxRequests, 0)
      );
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

