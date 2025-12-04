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
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiry) {
          this.cache.delete(key);
        }
      }
    }, this.cleanupInterval);
  }
}

module.exports = new CacheService();

