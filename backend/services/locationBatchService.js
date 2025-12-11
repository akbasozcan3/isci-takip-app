const db = require('../config/database');
const smartTrackingService = require('./smartTrackingService');
const activityLogService = require('./activityLogService');

class LocationBatchService {
  constructor() {
    this.batchQueue = new Map();
    this.batchSize = 10;
    this.flushInterval = 2000;
    this.maxQueueSize = 1000;
    this.flushTimer = null;
    this.startFlushTimer();
  }

  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flushAll().catch(err => {
        console.error('[LocationBatch] Flush all error:', err);
      });
    }, this.flushInterval);
  }

  addToBatch(deviceId, locationData) {
    const user = db.findUserById(deviceId);
    const subscription = user ? db.getUserSubscription(user.id) : null;
    const planId = subscription?.planId || 'free';

    const shouldUpdate = smartTrackingService.shouldUpdateLocation(
      locationData,
      deviceId,
      planId
    );

    if (!shouldUpdate.shouldUpdate) {
      return;
    }

    if (!this.batchQueue.has(deviceId)) {
      this.batchQueue.set(deviceId, []);
    }

    const queue = this.batchQueue.get(deviceId);
    
    if (queue.length >= this.maxQueueSize) {
      queue.shift();
    }

    queue.push(locationData);

    if (queue.length >= this.batchSize) {
      this.flushDevice(deviceId);
    }
  }

  async flushDevice(deviceId) {
    const queue = this.batchQueue.get(deviceId);
    if (!queue || queue.length === 0) return;

    const locations = [...queue];
    queue.length = 0;

    try {
      const batchSize = 50;
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        batch.forEach(loc => {
          db.addToStore(deviceId, loc);
        });
        if (i + batchSize < locations.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      activityLogService.logActivity(deviceId, 'location', 'batch_location_flush', {
        deviceId,
        batchSize: locations.length
      });
    } catch (error) {
      console.error(`[LocationBatch] Error flushing device ${deviceId}:`, error);
      const currentQueue = this.batchQueue.get(deviceId) || [];
      if (currentQueue.length < this.maxQueueSize) {
        currentQueue.unshift(...locations);
        this.batchQueue.set(deviceId, currentQueue);
      }
    }
  }

  async flushAll() {
    const deviceIds = Array.from(this.batchQueue.keys());
    const flushPromises = [];
    
    for (const deviceId of deviceIds) {
      flushPromises.push(this.flushDevice(deviceId).catch(err => {
        console.error(`[LocationBatch] Error flushing device ${deviceId}:`, err);
      }));
    }
    
    await Promise.allSettled(flushPromises);
  }

  getQueueSize(deviceId) {
    const queue = this.batchQueue.get(deviceId);
    return queue ? queue.length : 0;
  }

  clearQueue(deviceId) {
    this.batchQueue.delete(deviceId);
  }

  async destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushAll();
    this.batchQueue.clear();
  }
}

module.exports = new LocationBatchService();

