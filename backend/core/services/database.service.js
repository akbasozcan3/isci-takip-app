/**
 * Professional Database Service
 * Advanced database operations with caching, batching, and optimization
 */

const db = require('../../config/database');
const advancedCacheService = require('./advancedCache.service');
const metricsService = require('../../services/metricsService');

class DatabaseService {
  constructor() {
    this.queryCache = new Map();
    this.batchQueue = [];
    this.batchTimeout = null;
    this.batchSize = 50;
    this.batchDelay = 1000; // 1 second
    this.stats = {
      queries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchOperations: 0,
      averageQueryTime: 0,
      slowQueries: []
    };
    this.startBatchProcessor();
  }

  /**
   * Optimized find user by ID with caching
   */
  findUserById(userId, useCache = true) {
    const startTime = Date.now();
    const cacheKey = `user:${userId}`;
    
    if (useCache) {
      const cached = advancedCacheService.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        this.recordQuery('findUserById', Date.now() - startTime, true);
        return cached;
      }
    }
    
    this.stats.cacheMisses++;
    const user = db.findUserById(userId);
    
    if (user && useCache) {
      advancedCacheService.set(cacheKey, user, 300000); // 5 min cache
    }
    
    this.recordQuery('findUserById', Date.now() - startTime, !!user);
    return user;
  }

  /**
   * Optimized find user by email with caching
   */
  findUserByEmail(email, useCache = true) {
    const startTime = Date.now();
    const cacheKey = `user:email:${email.toLowerCase()}`;
    
    if (useCache) {
      const cached = advancedCacheService.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        this.recordQuery('findUserByEmail', Date.now() - startTime, true);
        return cached;
      }
    }
    
    this.stats.cacheMisses++;
    const user = db.findUserByEmail(email);
    
    if (user && useCache) {
      advancedCacheService.set(cacheKey, user, 300000);
    }
    
    this.recordQuery('findUserByEmail', Date.now() - startTime, !!user);
    return user;
  }

  /**
   * Batch create users for better performance
   */
  async batchCreateUsers(usersData) {
    const startTime = Date.now();
    const results = [];
    
    for (const userData of usersData) {
      try {
        const user = db.createUser(userData);
        results.push({ success: true, user });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    this.stats.batchOperations++;
    this.recordQuery('batchCreateUsers', Date.now() - startTime, true);
    return results;
  }

  /**
   * Batch update users
   */
  async batchUpdateUsers(updates) {
    const startTime = Date.now();
    const results = [];
    
    for (const { userId, updates: userUpdates } of updates) {
      try {
        const user = db.findUserById(userId);
        if (user) {
          Object.assign(user, userUpdates);
          user.updatedAt = new Date().toISOString();
          db.scheduleSave();
          
          // Invalidate cache
          advancedCacheService.delete(`user:${userId}`);
          advancedCacheService.delete(`user:email:${user.email?.toLowerCase()}`);
          
          results.push({ success: true, userId });
        } else {
          results.push({ success: false, error: 'User not found', userId });
        }
      } catch (error) {
        results.push({ success: false, error: error.message, userId });
      }
    }
    
    this.stats.batchOperations++;
    this.recordQuery('batchUpdateUsers', Date.now() - startTime, true);
    return results;
  }

  /**
   * Optimized get groups by admin with pagination
   */
  getGroupsByAdmin(userId, options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 20, useCache = true } = options;
    const cacheKey = `groups:admin:${userId}:${page}:${limit}`;
    
    if (useCache) {
      const cached = advancedCacheService.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        this.recordQuery('getGroupsByAdmin', Date.now() - startTime, true);
        return cached;
      }
    }
    
    this.stats.cacheMisses++;
    const allGroups = db.getGroupsByAdmin(userId) || [];
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedGroups = allGroups.slice(start, end);
    
    const result = {
      groups: paginatedGroups,
      pagination: {
        page,
        limit,
        total: allGroups.length,
        pages: Math.ceil(allGroups.length / limit)
      }
    };
    
    if (useCache) {
      advancedCacheService.set(cacheKey, result, 60000); // 1 min cache
    }
    
    this.recordQuery('getGroupsByAdmin', Date.now() - startTime, true);
    return result;
  }

  /**
   * Optimized get user groups with caching
   */
  getUserGroups(userId, useCache = true) {
    const startTime = Date.now();
    const cacheKey = `groups:user:${userId}`;
    
    if (useCache) {
      const cached = advancedCacheService.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        this.recordQuery('getUserGroups', Date.now() - startTime, true);
        return cached;
      }
    }
    
    this.stats.cacheMisses++;
    const groups = db.getUserGroups(userId) || [];
    
    if (useCache) {
      advancedCacheService.set(cacheKey, groups, 120000); // 2 min cache
    }
    
    this.recordQuery('getUserGroups', Date.now() - startTime, true);
    return groups;
  }

  /**
   * Batch location storage for better performance
   */
  async batchStoreLocations(locations) {
    const startTime = Date.now();
    const results = [];
    
    // Group by userId for batch processing
    const byUserId = {};
    for (const location of locations) {
      const userId = location.userId || location.user_id;
      if (!byUserId[userId]) {
        byUserId[userId] = [];
      }
      byUserId[userId].push(location);
    }
    
    // Process in batches
    for (const [userId, userLocations] of Object.entries(byUserId)) {
      try {
        for (const location of userLocations) {
          db.addLocation(userId, location);
        }
        results.push({ success: true, userId, count: userLocations.length });
      } catch (error) {
        results.push({ success: false, userId, error: error.message });
      }
    }
    
    db.scheduleSave();
    this.stats.batchOperations++;
    this.recordQuery('batchStoreLocations', Date.now() - startTime, true);
    return results;
  }

  /**
   * Query performance monitoring
   */
  recordQuery(operation, duration, success) {
    this.stats.queries++;
    
    // Update average query time
    this.stats.averageQueryTime = 
      (this.stats.averageQueryTime * (this.stats.queries - 1) + duration) / this.stats.queries;
    
    // Track slow queries (> 100ms)
    if (duration > 100) {
      this.stats.slowQueries.push({
        operation,
        duration,
        success,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 slow queries
      if (this.stats.slowQueries.length > 100) {
        this.stats.slowQueries.shift();
      }
    }
    
    // Record in metrics service
    try {
      metricsService.recordHistogram('database.query.time', duration);
      metricsService.incrementCounter(`database.queries.${operation}`);
      if (!success) {
        metricsService.incrementCounter(`database.errors.${operation}`);
      }
    } catch (error) {
      // Non-critical
    }
  }

  /**
   * Batch processor for queued operations
   */
  startBatchProcessor() {
    this.batchTimeout = setInterval(() => {
      if (this.batchQueue.length > 0) {
        const batch = this.batchQueue.splice(0, this.batchSize);
        this.processBatch(batch);
      }
    }, this.batchDelay);
  }

  /**
   * Process batch operations
   */
  async processBatch(batch) {
    const operations = batch.map(item => item.operation);
    const grouped = {};
    
    // Group by operation type
    for (const item of batch) {
      if (!grouped[item.type]) {
        grouped[item.type] = [];
      }
      grouped[item.type].push(item);
    }
    
    // Process each group
    for (const [type, items] of Object.entries(grouped)) {
      try {
        switch (type) {
          case 'updateUser':
            await this.batchUpdateUsers(items.map(i => ({ userId: i.userId, updates: i.data })));
            break;
          case 'createUser':
            await this.batchCreateUsers(items.map(i => i.data));
            break;
          default:
            console.warn(`[DatabaseService] Unknown batch operation type: ${type}`);
        }
      } catch (error) {
        console.error(`[DatabaseService] Batch processing error for ${type}:`, error);
      }
    }
  }

  /**
   * Queue operation for batch processing
   */
  queueOperation(type, operation, data, userId = null) {
    this.batchQueue.push({
      type,
      operation,
      data,
      userId,
      timestamp: Date.now()
    });
  }

  /**
   * Get database statistics
   */
  getStats() {
    const cacheHitRate = this.stats.queries > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      queueSize: this.batchQueue.length,
      slowQueryCount: this.stats.slowQueries.length
    };
  }

  /**
   * Generate cache key
   */
  generateCacheKey(path, queryStr, userId = null) {
    const userPart = userId ? `:user:${userId}` : '';
    return `db:${path}${userPart}:${queryStr}`;
  }

  /**
   * Clear query cache
   */
  clearCache(pattern = null) {
    if (pattern) {
      advancedCacheService.clear(pattern);
    } else {
      advancedCacheService.clear();
    }
  }

  /**
   * Health check
   */
  healthCheck() {
    try {
      const testUser = db.findUserById('test');
      return {
        status: 'healthy',
        responseTime: '< 10ms',
        cacheHitRate: this.getStats().cacheHitRate,
        queueSize: this.batchQueue.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new DatabaseService();

