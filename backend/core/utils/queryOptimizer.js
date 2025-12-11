/**
 * Query Optimizer
 * Advanced query optimization utilities
 */

class QueryOptimizer {
  /**
   * Optimize database query
   */
  optimizeQuery(query, options = {}) {
    const {
      maxResults = 1000,
      defaultLimit = 50,
      enablePagination = true,
    } = options;

    // Add default limit if not present
    if (enablePagination && !query.limit) {
      query.limit = Math.min(query.limit || defaultLimit, maxResults);
    }

    // Optimize sort
    if (query.sort && typeof query.sort === 'string') {
      query.sort = this.parseSort(query.sort);
    }

    // Optimize filter
    if (query.filter) {
      query.filter = this.optimizeFilter(query.filter);
    }

    return query;
  }

  /**
   * Parse sort string to object
   */
  parseSort(sortString) {
    const sort = {};
    const parts = sortString.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('-')) {
        sort[trimmed.substring(1)] = -1;
      } else {
        sort[trimmed] = 1;
      }
    }
    
    return sort;
  }

  /**
   * Optimize filter object
   */
  optimizeFilter(filter) {
    const optimized = {};
    
    for (const [key, value] of Object.entries(filter)) {
      // Remove null/undefined values
      if (value === null || value === undefined) continue;
      
      // Optimize date ranges
      if (key.includes('date') || key.includes('Date')) {
        optimized[key] = this.optimizeDateFilter(value);
        continue;
      }
      
      // Optimize number ranges
      if (typeof value === 'object' && (value.$gte || value.$lte || value.$gt || value.$lt)) {
        optimized[key] = value;
        continue;
      }
      
      optimized[key] = value;
    }
    
    return optimized;
  }

  /**
   * Optimize date filter
   */
  optimizeDateFilter(value) {
    if (typeof value === 'string') {
      return new Date(value);
    }
    
    if (typeof value === 'object') {
      const optimized = {};
      for (const [op, val] of Object.entries(value)) {
        optimized[op] = typeof val === 'string' ? new Date(val) : val;
      }
      return optimized;
    }
    
    return value;
  }

  /**
   * Build index hints for query
   */
  getIndexHints(query) {
    const hints = [];
    
    if (query.filter) {
      // Suggest indexes based on filters
      for (const key of Object.keys(query.filter)) {
        hints.push(key);
      }
    }
    
    if (query.sort) {
      // Suggest indexes based on sort
      for (const key of Object.keys(query.sort)) {
        if (!hints.includes(key)) {
          hints.push(key);
        }
      }
    }
    
    return hints;
  }

  /**
   * Estimate query cost
   */
  estimateCost(query, stats = {}) {
    let cost = 1; // Base cost
    
    // Add cost for filters
    if (query.filter) {
      cost += Object.keys(query.filter).length * 0.5;
    }
    
    // Add cost for sorting
    if (query.sort) {
      cost += Object.keys(query.sort).length * 0.3;
    }
    
    // Add cost for pagination
    if (query.limit) {
      cost += Math.log10(query.limit) * 0.2;
    }
    
    // Factor in collection size
    if (stats.collectionSize) {
      cost += Math.log10(stats.collectionSize) * 0.1;
    }
    
    return cost;
  }
}

module.exports = new QueryOptimizer();

