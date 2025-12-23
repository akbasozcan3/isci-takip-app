/**
 * Response Caching Middleware
 * Caches API responses for improved performance
 */

const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Create cache instance
const cache = new NodeCache({
    stdTTL: 600, // 10 minutes default
    checkperiod: 120, // Check for expired keys every 2 minutes
    useClones: false, // Don't clone objects (better performance)
});

/**
 * Cache middleware factory
 */
function cacheMiddleware(options = {}) {
    const {
        ttl = 600, // Time to live in seconds
        keyGenerator = null, // Custom key generator function
        shouldCache = null, // Function to determine if request should be cached
    } = options;

    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Check if should cache
        if (shouldCache && !shouldCache(req)) {
            return next();
        }

        // Generate cache key
        const cacheKey = keyGenerator
            ? keyGenerator(req)
            : `${req.path}:${JSON.stringify(req.query)}:${req.user?.id || 'anonymous'}`;

        // Try to get from cache
        const cachedResponse = cache.get(cacheKey);
        if (cachedResponse) {
            logger.debug('Cache hit', { key: cacheKey });
            res.setHeader('X-Cache', 'HIT');
            return res.json(cachedResponse);
        }

        // Cache miss - intercept response
        logger.debug('Cache miss', { key: cacheKey });
        res.setHeader('X-Cache', 'MISS');

        const originalJson = res.json.bind(res);
        res.json = function (data) {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const cacheTTL = typeof ttl === 'function' ? ttl(req) : ttl;
                cache.set(cacheKey, data, cacheTTL);
                logger.debug('Response cached', { key: cacheKey, ttl: cacheTTL });
            }
            return originalJson(data);
        };

        next();
    };
}

/**
 * Clear cache by pattern
 */
function clearCacheByPattern(pattern) {
    const keys = cache.keys();
    const matchedKeys = keys.filter(key => key.includes(pattern));

    matchedKeys.forEach(key => cache.del(key));

    logger.info('Cache cleared', { pattern, count: matchedKeys.length });
    return matchedKeys.length;
}

/**
 * Clear all cache
 */
function clearAllCache() {
    const count = cache.keys().length;
    cache.flushAll();
    logger.info('All cache cleared', { count });
    return count;
}

/**
 * Get cache stats
 */
function getCacheStats() {
    return {
        keys: cache.keys().length,
        hits: cache.getStats().hits,
        misses: cache.getStats().misses,
        ksize: cache.getStats().ksize,
        vsize: cache.getStats().vsize,
    };
}

module.exports = {
    cacheMiddleware,
    clearCacheByPattern,
    clearAllCache,
    getCacheStats,
    cache, // Export cache instance for direct access if needed
};
