/**
 * API Response Cache Middleware
 * Intelligent caching for GET requests with configurable TTL
 */

const advancedCacheService = require('../services/advancedCache.service');
const { logger } = require('../utils/logger');

class ApiResponseCache {
  constructor() {
    this.defaultTTL = 300000; // 5 minutes
    this.cacheableMethods = ['GET'];
    this.excludedPaths = [
      '/health',
      '/metrics',
      '/system/status',
      '/system/health',
      '/notifications',
      '/location/live'
    ];
  }

  /**
   * Generate cache key from request
   */
  generateCacheKey(req) {
    const path = req.path;
    // Sanitize query string for header compatibility
    let query = '';
    if (req.query && Object.keys(req.query).length > 0) {
      query = Object.entries(req.query)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${String(value).replace(/[^\w\-.]/g, '_')}`)
        .join('&');
    }
    const userId = req.user?.id || 'anonymous';
    const apiVersion = req.apiVersion || 'v1';

    // Sanitize cache key for header use (remove invalid characters)
    const cacheKey = `api:${apiVersion}:${path}:${userId}:${query}`;
    return cacheKey.replace(/[^\w\-.:=&]/g, '_');
  }

  /**
   * Check if request should be cached
   */
  shouldCache(req) {
    // Only cache GET requests
    if (!this.cacheableMethods.includes(req.method)) {
      return false;
    }

    // Don't cache excluded paths
    if (this.excludedPaths.some(path => req.path.includes(path))) {
      return false;
    }

    // Don't cache if no-cache header is present
    if (req.headers['cache-control']?.includes('no-cache')) {
      return false;
    }

    // Don't cache authenticated endpoints that require fresh data
    if (req.headers['x-no-cache'] === 'true') {
      return false;
    }

    return true;
  }

  /**
   * Get cache TTL from request or use default
   */
  getCacheTTL(req) {
    // Check for custom TTL in header
    const customTTL = req.headers['x-cache-ttl'];
    if (customTTL) {
      const ttl = parseInt(customTTL, 10);
      if (!isNaN(ttl) && ttl > 0) {
        return ttl * 1000; // Convert to milliseconds
      }
    }

    // Check for cache-control max-age
    const cacheControl = req.headers['cache-control'];
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1], 10) * 1000;
      }
    }

    return this.defaultTTL;
  }

  /**
   * Cache middleware
   */
  middleware(options = {}) {
    const {
      ttl = this.defaultTTL,
      keyGenerator = this.generateCacheKey.bind(this),
      shouldCache = this.shouldCache.bind(this),
      getTTL = this.getCacheTTL.bind(this)
    } = options;

    return async (req, res, next) => {
      // Check if request should be cached
      if (!shouldCache(req)) {
        return next();
      }

      const cacheKey = keyGenerator(req);
      const cacheTTL = getTTL(req);

      try {
        // Try to get from cache
        const cached = advancedCacheService.get(cacheKey);
        if (cached) {
          if (logger && typeof logger.debug === 'function') {
            logger.debug('Cache hit', { path: req.path, cacheKey });
          }

          // Set cache headers (sanitize cacheKey for header)
          res.setHeader('X-Cache', 'HIT');
          const sanitizedKey = cacheKey.replace(/[^\w\-.:=&]/g, '_').substring(0, 200); // Limit length
          res.setHeader('X-Cache-Key', sanitizedKey);

          return res.json(cached);
        }

        // Cache miss - intercept response
        if (logger && typeof logger.debug === 'function') {
          logger.debug('Cache miss', { path: req.path, cacheKey });
        }

        const originalJson = res.json.bind(res);
        res.json = function (data) {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              advancedCacheService.set(cacheKey, data, cacheTTL);
              if (logger && typeof logger.debug === 'function') {
                logger.debug('Response cached', { path: req.path, cacheKey, ttl: cacheTTL });
              }
            } catch (error) {
              logger.warn('Failed to cache response', { error: error.message, cacheKey });
            }
          }

          // Set cache headers (sanitize cacheKey for header)
          res.setHeader('X-Cache', 'MISS');
          const sanitizedKey = cacheKey.replace(/[^\w\-.:=&]/g, '_').substring(0, 200); // Limit length
          res.setHeader('X-Cache-Key', sanitizedKey);
          res.setHeader('X-Cache-TTL', Math.floor(cacheTTL / 1000));

          return originalJson(data);
        };

        next();
      } catch (error) {
        try {
          if (logger && typeof logger.error === 'function') {
            logger.error('Cache middleware error', error);
          } else {
            console.error('[ApiResponseCache] Cache middleware error:', error);
          }
        } catch (logError) {
          console.error('[ApiResponseCache] Cache middleware error:', error);
        }
        next();
      }
    };
  }

  /**
   * Clear cache for a specific pattern
   */
  clearCache(pattern) {
    try {
      // This would need to be implemented in advancedCacheService
      // For now, we'll just log it
      logger.info('Cache clear requested', { pattern });
      return true;
    } catch (error) {
      logger.error('Cache clear error', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    try {
      const cacheStats = advancedCacheService.getStats();
      return {
        ...cacheStats,
        defaultTTL: this.defaultTTL,
        cacheableMethods: this.cacheableMethods,
        excludedPaths: this.excludedPaths
      };
    } catch (error) {
      logger.error('Get cache stats error', error);
      return null;
    }
  }
}

// Export singleton instance
const apiResponseCache = new ApiResponseCache();

module.exports = apiResponseCache.middleware.bind(apiResponseCache);
module.exports.ApiResponseCache = ApiResponseCache;
module.exports.clearCache = apiResponseCache.clearCache.bind(apiResponseCache);
module.exports.getStats = apiResponseCache.getStats.bind(apiResponseCache);

