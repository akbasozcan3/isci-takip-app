/**
 * Professional Performance Optimizer Middleware
 * Optimizes API responses, database queries, and memory usage
 */

const ResponseFormatter = require('../utils/responseFormatter');

class PerformanceOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.responseCache = new Map();
    this.cacheMaxSize = 1000;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Optimize database query
   */
  optimizeQuery(query, params = {}) {
    const cacheKey = `${query}-${JSON.stringify(params)}`;
    
    // Check cache
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return { cached: true, query: cached.query };
      }
      this.queryCache.delete(cacheKey);
    }

    // Optimize query
    let optimizedQuery = query;
    
    // Remove unnecessary fields
    if (params.select) {
      optimizedQuery = this.addSelectFields(query, params.select);
    }

    // Add pagination
    if (params.limit) {
      optimizedQuery = this.addLimit(query, params.limit);
    }

    // Cache optimized query
    if (this.queryCache.size >= this.cacheMaxSize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    
    this.queryCache.set(cacheKey, {
      query: optimizedQuery,
      timestamp: Date.now()
    });

    return { cached: false, query: optimizedQuery };
  }

  /**
   * Add select fields to query
   */
  addSelectFields(query, fields) {
    if (Array.isArray(fields) && fields.length > 0) {
      return `${query} SELECT ${fields.join(', ')}`;
    }
    return query;
  }

  /**
   * Add limit to query
   */
  addLimit(query, limit) {
    if (!query.includes('LIMIT')) {
      return `${query} LIMIT ${limit}`;
    }
    return query;
  }

  /**
   * Optimize response data
   */
  optimizeResponse(data, options = {}) {
    if (!data) return data;

    const {
      maxDepth = 5,
      removeNulls = true,
      removeEmptyArrays = false,
      removeEmptyObjects = false
    } = options;

    return this.deepOptimize(data, maxDepth, {
      removeNulls,
      removeEmptyArrays,
      removeEmptyObjects
    });
  }

  /**
   * Deep optimize object
   */
  deepOptimize(obj, depth, options) {
    if (depth <= 0) return obj;
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      const optimized = obj
        .map(item => this.deepOptimize(item, depth - 1, options))
        .filter(item => {
          if (options.removeNulls && item === null) return false;
          if (options.removeEmptyArrays && Array.isArray(item) && item.length === 0) return false;
          return true;
        });
      return optimized;
    }

    if (typeof obj === 'object') {
      const optimized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (options.removeNulls && value === null) continue;
        if (options.removeEmptyArrays && Array.isArray(value) && value.length === 0) continue;
        if (options.removeEmptyObjects && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
        
        optimized[key] = this.deepOptimize(value, depth - 1, options);
      }
      return optimized;
    }

    return obj;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.queryCache.clear();
    this.responseCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      queryCacheSize: this.queryCache.size,
      responseCacheSize: this.responseCache.size,
      maxSize: this.cacheMaxSize,
      ttl: this.cacheTTL
    };
  }
}

const optimizer = new PerformanceOptimizer();

/**
 * Performance optimization middleware
 */
function performanceOptimizerMiddleware(req, res, next) {
  // Attach optimizer to request
  req.performanceOptimizer = optimizer;

  // Optimize response before sending
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // Only optimize if data is large
    if (data && JSON.stringify(data).length > 10000) {
      const optimized = optimizer.optimizeResponse(data, {
        maxDepth: 5,
        removeNulls: true,
        removeEmptyArrays: false,
        removeEmptyObjects: false
      });
      return originalJson(optimized);
    }
    return originalJson(data);
  };

  next();
}

module.exports = performanceOptimizerMiddleware;
module.exports.PerformanceOptimizer = PerformanceOptimizer;

