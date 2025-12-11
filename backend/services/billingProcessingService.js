const db = require('../config/database');

class BillingProcessingService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 300000;
    this.maxCacheSize = 200;
  }

  getCacheKey(userId) {
    return `billing:${userId}`;
  }

  getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  setCache(key, data) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async processBilling(userId, plan, amount) {
    if (!userId || !plan || amount === null || amount === undefined) {
      throw new Error('user_id, plan, and amount required');
    }

    return {
      user_id: userId,
      plan: plan,
      amount: parseFloat(amount),
      status: 'processed',
      transaction_id: this.generateId(),
      processed_at: new Date().toISOString()
    };
  }

  async getBillingHistory(userId) {
    const cacheKey = this.getCacheKey(userId);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const history = db.getBillingHistory(userId) || [];
    const totalAmount = history.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const result = {
      user_id: userId,
      transactions: history,
      total_amount: totalAmount,
      timestamp: new Date().toISOString()
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async validatePayment(paymentMethod) {
    return {
      valid: !!(paymentMethod && paymentMethod.trim()),
      payment_method: paymentMethod || null,
      validation_score: 0.95,
      timestamp: new Date().toISOString()
    };
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

module.exports = new BillingProcessingService();
