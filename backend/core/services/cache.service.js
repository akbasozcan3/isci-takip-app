/**
 * Advanced Cache Service
 * Enterprise-level multi-tier caching with intelligent eviction
 */

const { logger } = require('../utils/logger');

class AdvancedCacheService {
  constructor() {
    // L1 Cache: In-memory (fastest, limited size)
    this.l1Cache = new Map();
    this.l1MaxSize = 10000;
    this.l1TTL = 60000; // 1 minute default
    
    // L2 Cache: Persistent (slower, larger size)
    this.l2Cache = new Map();
    this.l2MaxSize = 100000;
    this.l2TTL = 300000; // 5 minutes default
    
    // Statistics
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      evictions: 0,
      sets: 0,
      gets: 0,
    };
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Get value from cache (L1 first, then L2)
   */
  get(key, options = {}) {
    this.stats.gets++;
    const { useL2 = true } = options;
    
    // Try L1 first
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && this.isValid(l1Entry)) {
      this.stats.l1Hits++;
      return l1Entry.value;
    }
    
    if (l1Entry) {
      this.l1Cache.delete(key); // Remove expired
      this.stats.l1Misses++;
    }
    
    // Try L2 if enabled
    if (useL2) {
      const l2Entry = this.l2Cache.get(key);
      if (l2Entry && this.isValid(l2Entry)) {
        this.stats.l2Hits++;
        // Promote to L1
        this.setL1(key, l2Entry.value, l2Entry.ttl);
        return l2Entry.value;
      }
      
      if (l2Entry) {
        this.l2Cache.delete(key); // Remove expired
        this.stats.l2Misses++;
      }
    }
    
    return null;
  }

  /**
   * Set value in cache
   */
  set(key, value, ttl = null, options = {}) {
    this.stats.sets++;
    const { 
      priority = 'normal', // 'high', 'normal', 'low'
      useL2 = true 
    } = options;
    
    const effectiveTTL = ttl || (priority === 'high' ? this.l1TTL * 2 : this.l1TTL);
    
    // Always set in L1
    this.setL1(key, value, effectiveTTL);
    
    // Set in L2 if enabled and priority is high/normal
    if (useL2 && priority !== 'low') {
      this.setL2(key, value, effectiveTTL * 5); // L2 has longer TTL
    }
    
    return true;
  }

  /**
   * Set in L1 cache
   */
  setL1(key, value, ttl) {
    // Evict if needed
    if (this.l1Cache.size >= this.l1MaxSize && !this.l1Cache.has(key)) {
      this.evictL1();
    }
    
    this.l1Cache.set(key, {
      value,
      ttl,
      timestamp: Date.now(),
    });
  }

  /**
   * Set in L2 cache
   */
  setL2(key, value, ttl) {
    // Evict if needed
    if (this.l2Cache.size >= this.l2MaxSize && !this.l2Cache.has(key)) {
      this.evictL2();
    }
    
    this.l2Cache.set(key, {
      value,
      ttl,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if cache entry is valid
   */
  isValid(entry) {
    if (!entry || !entry.timestamp) return false;
    const age = Date.now() - entry.timestamp;
    return age < entry.ttl;
  }

  /**
   * Evict from L1 (LRU strategy)
   */
  evictL1() {
    if (this.l1Cache.size === 0) return;
    
    // Find oldest entry
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Evict from L2 (LRU strategy)
   */
  evictL2() {
    if (this.l2Cache.size === 0) return;
    
    // Find oldest entry
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.l2Cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.l2Cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Delete from cache
   */
  delete(key) {
    const l1Deleted = this.l1Cache.delete(key);
    const l2Deleted = this.l2Cache.delete(key);
    return l1Deleted || l2Deleted;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    let cleaned = 0;
    
    // Clean L1
    for (const [key, entry] of this.l1Cache.entries()) {
      if (!this.isValid(entry)) {
        this.l1Cache.delete(key);
        cleaned++;
      }
    }
    
    // Clean L2
    for (const [key, entry] of this.l2Cache.entries()) {
      if (!this.isValid(entry)) {
        this.l2Cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.l1Hits + this.stats.l1Misses + this.stats.l2Hits + this.stats.l2Misses;
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    
    return {
      l1: {
        size: this.l1Cache.size,
        maxSize: this.l1MaxSize,
        hits: this.stats.l1Hits,
        misses: this.stats.l1Misses,
        hitRate: this.stats.l1Hits + this.stats.l1Misses > 0 
          ? (this.stats.l1Hits / (this.stats.l1Hits + this.stats.l1Misses)) * 100 
          : 0,
      },
      l2: {
        size: this.l2Cache.size,
        maxSize: this.l2MaxSize,
        hits: this.stats.l2Hits,
        misses: this.stats.l2Misses,
        hitRate: this.stats.l2Hits + this.stats.l2Misses > 0 
          ? (this.stats.l2Hits / (this.stats.l2Hits + this.stats.l2Misses)) * 100 
          : 0,
      },
      overall: {
        totalRequests,
        totalHits,
        totalMisses: this.stats.l1Misses + this.stats.l2Misses,
        hitRate: hitRate.toFixed(2) + '%',
        evictions: this.stats.evictions,
        sets: this.stats.sets,
        gets: this.stats.gets,
      },
    };
  }

  /**
   * Get cache size
   */
  size() {
    return {
      l1Size: this.l1Cache.size,
      l2Size: this.l2Cache.size,
      totalSize: this.l1Cache.size + this.l2Cache.size,
    };
  }

  /**
   * Warm up cache with data
   */
  warmup(data, ttl = null) {
    let warmed = 0;
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value, ttl, { priority: 'high' });
      warmed++;
    }
    logger.info(`Cache warmed up with ${warmed} entries`);
    return warmed;
  }

  /**
   * Destroy cache service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Export singleton instance
const cacheServiceInstance = new AdvancedCacheService();

module.exports = cacheServiceInstance;
