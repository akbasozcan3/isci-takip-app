/**
 * Database Optimizer
 * Optimizes database queries and indexes
 */

const db = require('../../config/database');

class DatabaseOptimizer {
  constructor() {
    this.indexes = new Map();
    this.queryCache = new Map();
    this.stats = {
      queries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      optimizations: 0
    };
  }

  /**
   * Create index for faster lookups
   */
  createIndex(collection, field) {
    const indexKey = `${collection}:${field}`;
    if (!this.indexes.has(indexKey)) {
      this.indexes.set(indexKey, new Map());
      this.buildIndex(collection, field);
    }
  }

  /**
   * Build index from existing data
   */
  buildIndex(collection, field) {
    const indexKey = `${collection}:${field}`;
    const index = this.indexes.get(indexKey);
    const data = db.data[collection] || {};
    
    for (const [id, item] of Object.entries(data)) {
      const value = item[field];
      if (value !== undefined && value !== null) {
        if (!index.has(value)) {
          index.set(value, []);
        }
        index.get(value).push(id);
      }
    }
  }

  /**
   * Find by indexed field
   */
  findByIndex(collection, field, value) {
    const indexKey = `${collection}:${field}`;
    const index = this.indexes.get(indexKey);
    
    if (!index) {
      this.createIndex(collection, field);
      return this.findByIndex(collection, field, value);
    }
    
    const ids = index.get(value) || [];
    const data = db.data[collection] || {};
    return ids.map(id => data[id]).filter(Boolean);
  }

  /**
   * Optimize database structure
   */
  optimize() {
    console.log('[DatabaseOptimizer] Starting optimization...');
    
    // Create common indexes
    this.createIndex('users', 'email');
    this.createIndex('users', 'onesignalPlayerId');
    this.createIndex('groups', 'createdBy');
    this.createIndex('groupMembers', 'userId');
    this.createIndex('groupMembers', 'groupId');
    
    // Cleanup old cache entries
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if (entry.expiry && now > entry.expiry) {
        this.queryCache.delete(key);
      }
    }
    
    console.log('[DatabaseOptimizer] Optimization complete');
    console.log('[DatabaseOptimizer] Indexes:', this.indexes.size);
    console.log('[DatabaseOptimizer] Cache size:', this.queryCache.size);
  }

  /**
   * Get optimization stats
   */
  getStats() {
    return {
      ...this.stats,
      indexes: this.indexes.size,
      cacheSize: this.queryCache.size,
      cacheHitRate: this.stats.queries > 0 
        ? (this.stats.cacheHits / this.stats.queries * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

const optimizer = new DatabaseOptimizer();

// Auto-optimize on startup
setTimeout(() => {
  optimizer.optimize();
}, 5000);

// Periodic optimization
setInterval(() => {
  optimizer.optimize();
}, 3600000); // Every hour

module.exports = optimizer;

