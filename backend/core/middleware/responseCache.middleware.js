/**
 * Response Cache Middleware
 * Intelligent caching for GET requests
 */

const advancedCacheService = require('../services/advancedCache.service');
const databaseService = require('../services/database.service');

function responseCacheMiddleware(options = {}) {
  const {
    ttl = 300000, // 5 minutes default
    varyByUser = false,
    varyByQuery = true,
    skipCache = (req) => false
  } = options;

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if specified
    if (skipCache(req)) {
      return next();
    }

    // Generate cache key
    const userId = varyByUser ? req.user?.id : null;
    const queryStr = varyByQuery ? JSON.stringify(req.query) : '';
    const cacheKey = databaseService.generateCacheKey(req.path, queryStr, userId);

    // Check cache
    const cached = advancedCacheService.get(cacheKey, userId);
    if (cached) {
      res.setHeader('X-Cache-Status', 'hit');
      res.setHeader('X-Cache-Key', cacheKey);
      return res.json(cached);
    }

    // Mark as cache miss
    res.setHeader('X-Cache-Status', 'miss');

    // Intercept response to cache it
    const originalJson = res.json;
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200 && data && data.success !== false) {
        const effectiveTTL = typeof ttl === 'function' ? ttl(req) : ttl;
        advancedCacheService.set(cacheKey, data, effectiveTTL, userId);
        res.setHeader('X-Cache-Key', cacheKey);
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = responseCacheMiddleware;

