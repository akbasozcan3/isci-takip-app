/**
 * Response Optimizer
 * Optimizes API responses for performance
 */

const compression = require('compression');

class ResponseOptimizer {
  constructor() {
    this.compressionThreshold = 1024; // 1KB
  }

  /**
   * Optimize response data
   */
  optimize(data, options = {}) {
    const {
      removeNulls = true,
      removeEmptyArrays = false,
      removeEmptyObjects = false,
      maxDepth = 10,
    } = options;

    if (!data || typeof data !== 'object') {
      return data;
    }

    return this.cleanObject(data, {
      removeNulls,
      removeEmptyArrays,
      removeEmptyObjects,
      maxDepth,
      currentDepth: 0,
    });
  }

  /**
   * Clean object recursively
   */
  cleanObject(obj, options) {
    if (options.currentDepth >= options.maxDepth) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj
        .map(item => this.cleanObject(item, { ...options, currentDepth: options.currentDepth + 1 }))
        .filter(item => {
          if (options.removeNulls && item === null) return false;
          if (options.removeEmptyArrays && Array.isArray(item) && item.length === 0) return false;
          return true;
        });
    }

    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (options.removeNulls && value === null) continue;
      if (options.removeEmptyArrays && Array.isArray(value) && value.length === 0) continue;
      if (options.removeEmptyObjects && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;

      cleaned[key] = this.cleanObject(value, { ...options, currentDepth: options.currentDepth + 1 });
    }

    return cleaned;
  }

  /**
   * Compress response if needed
   */
  shouldCompress(data) {
    if (!data) return false;
    const dataSize = JSON.stringify(data).length;
    return dataSize > this.compressionThreshold;
  }

  /**
   * Get compression middleware
   */
  getCompressionMiddleware() {
    return compression({
      level: 6,
      threshold: this.compressionThreshold,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    });
  }
}

module.exports = new ResponseOptimizer();

