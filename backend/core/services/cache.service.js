const db = require('../../config/database');

class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 300000;
    this.cleanupInterval = 60000;
    this.startCleanup();
  }

  getPlanBasedTTL(planId) {
    const planTTL = {
      free: 60000,
      plus: 300000,
      business: 600000
    };
    return planTTL[planId] || this.defaultTTL;
  }

  set(key, value, ttl = null, userId = null) {
    let effectiveTTL = ttl || this.defaultTTL;
    
    if (userId && !ttl) {
      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      effectiveTTL = this.getPlanBasedTTL(planId);
    }
    
    const expiry = Date.now() + effectiveTTL;
    this.cache.set(key, { value, expiry });
    return true;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
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

  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];
      let processed = 0;
      const maxProcessPerIteration = 10000;
      
      for (const [key, item] of this.cache.entries()) {
        if (processed >= maxProcessPerIteration) break;
        if (now > item.expiry) {
          keysToDelete.push(key);
          processed++;
        }
      }
      
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
      
      if (this.cache.size > 50000) {
        const sortedEntries = Array.from(this.cache.entries())
          .sort((a, b) => a[1].expiry - b[1].expiry);
        
        const toRemove = sortedEntries.slice(0, Math.floor(this.cache.size * 0.25));
        for (const [key] of toRemove) {
          this.cache.delete(key);
        }
      }
      
      if (global.gc && this.cache.size > 100000) {
        global.gc();
      }
    }, this.cleanupInterval);
  }
}

module.exports = new CacheService();

