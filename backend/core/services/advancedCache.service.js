const db = require('../../config/database');

class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value.value;
  }

  set(key, value, ttl = null) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    const expiry = ttl ? Date.now() + ttl : null;
    this.cache.set(key, { value, expiry });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

class AdvancedCacheService {
  constructor() {
    this.l1Cache = new LRUCache(5000);
    this.l2Cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    this.startCleanup();
  }

  getPlanBasedTTL(planId) {
    const planTTL = {
      free: 60000,
      plus: 300000,
      business: 600000
    };
    return planTTL[planId] || 300000;
  }

  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  get(key, userId = null) {
    const l1Value = this.l1Cache.get(key);
    if (l1Value !== null) {
      this.stats.hits++;
      return l1Value;
    }

    const l2Value = this.l2Cache.get(key);
    if (l2Value && (!l2Value.expiry || Date.now() < l2Value.expiry)) {
      this.l1Cache.set(key, l2Value.value);
      this.stats.hits++;
      return l2Value.value;
    }

    this.stats.misses++;
    return null;
  }

  set(key, value, ttl = null, userId = null) {
    let effectiveTTL = ttl;
    
    if (!effectiveTTL && userId) {
      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      effectiveTTL = this.getPlanBasedTTL(planId);
    }

    this.l1Cache.set(key, value, effectiveTTL);
    this.l2Cache.set(key, {
      value,
      expiry: effectiveTTL ? Date.now() + effectiveTTL : null
    });
    
    this.stats.sets++;
  }

  delete(key) {
    this.l1Cache.delete(key);
    this.l2Cache.delete(key);
    this.stats.deletes++;
  }

  clear(pattern = null) {
    if (!pattern) {
      this.l1Cache.clear();
      this.l2Cache.clear();
      return;
    }

    for (const key of this.l1Cache.cache.keys()) {
      if (key.includes(pattern)) {
        this.l1Cache.delete(key);
      }
    }

    for (const key of this.l2Cache.keys()) {
      if (key.includes(pattern)) {
        this.l2Cache.delete(key);
      }
    }
  }

  invalidateUser(userId) {
    this.clear(`user:${userId}`);
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0,
      l1Size: this.l1Cache.size(),
      l2Size: this.l2Cache.size
    };
  }

  startCleanup() {
    setInterval(() => {
      this.l1Cache.cleanup();
      const now = Date.now();
      for (const [key, item] of this.l2Cache.entries()) {
        if (item.expiry && now > item.expiry) {
          this.l2Cache.delete(key);
        }
      }
    }, 60000);
  }
}

module.exports = new AdvancedCacheService();

