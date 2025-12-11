/**
 * Advanced Rate Limiting Middleware
 * Enterprise-level rate limiting with plan-based limits and intelligent throttling
 */

const { logger } = require('../utils/logger');

class RateLimiter {
  constructor() {
    // Store: IP -> { count, resetTime, requests: [] }
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
    
    // Plan-based limits
    this.planLimits = {
      free: {
        windowMs: 60000, // 1 minute
        maxRequests: 50,
        burst: 10, // Allow burst of 10 requests
      },
      plus: {
        windowMs: 60000,
        maxRequests: 200,
        burst: 50,
      },
      business: {
        windowMs: 60000,
        maxRequests: 500,
        burst: 100,
      },
    };
  }

  /**
   * Get rate limit middleware
   */
  middleware() {
    return (req, res, next) => {
      const key = this.getKey(req);
      const planId = req.subscription?.planId || 'free';
      const limits = this.planLimits[planId] || this.planLimits.free;
      
      const now = Date.now();
      let record = this.store.get(key);
      
      // Initialize or reset if window expired
      if (!record || now > record.resetTime) {
        record = {
          count: 0,
          resetTime: now + limits.windowMs,
          requests: [],
          planId,
        };
        this.store.set(key, record);
      }
      
      // Check burst limit
      const recentRequests = record.requests.filter(
        reqTime => now - reqTime < 1000 // Last second
      );
      
      if (recentRequests.length >= limits.burst) {
        logger.warn('Rate limit burst exceeded', { 
          key, 
          planId, 
          burst: recentRequests.length 
        });
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please slow down.',
          code: 'RATE_LIMIT_BURST',
          retryAfter: 1,
        });
      }
      
      // Check window limit
      if (record.count >= limits.maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        logger.warn('Rate limit exceeded', { 
          key, 
          planId, 
          count: record.count,
          limit: limits.maxRequests 
        });
        
        res.setHeader('X-RateLimit-Limit', limits.maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
        res.setHeader('Retry-After', retryAfter);
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
          limit: limits.maxRequests,
          window: limits.windowMs / 1000 + 's',
        });
      }
      
      // Increment counter
      record.count++;
      record.requests.push(now);
      
      // Set response headers
      res.setHeader('X-RateLimit-Limit', limits.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
      
      next();
    };
  }

  /**
   * Get rate limit key (IP + User ID if available)
   */
  getKey(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.id || req.subscription?.userId;
    return userId ? `${userId}:${ip}` : ip;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
        cleaned++;
      } else {
        // Clean old requests from array
        record.requests = record.requests.filter(
          reqTime => now - reqTime < 60000 // Keep last minute
        );
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Get rate limit statistics
   */
  getStats() {
    const stats = {
      totalKeys: this.store.size,
      byPlan: {},
    };
    
    for (const record of this.store.values()) {
      const planId = record.planId || 'free';
      if (!stats.byPlan[planId]) {
        stats.byPlan[planId] = { count: 0, totalRequests: 0 };
      }
      stats.byPlan[planId].count++;
      stats.byPlan[planId].totalRequests += record.count;
    }
    
    return stats;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key) {
    return this.store.delete(key);
  }

  /**
   * Destroy rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Export singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter.middleware.bind(rateLimiter);
module.exports.RateLimiter = RateLimiter;

