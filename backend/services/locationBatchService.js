const db = require('../config/database');
const smartTrackingService = require('./smartTrackingService');

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
      this.flushAll();
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
      const retryService = require('../core/services/retry.service');
      await retryService.execute(
        async () => {
          locations.forEach(loc => {
            db.addToStore(deviceId, loc);
          });
        },
        {
          maxRetries: 2,
          delay: 500,
          backoff: 'exponential'
        }
      );
    } catch (error) {
      console.error(`[LocationBatch] Error flushing device ${deviceId}:`, error);
      if (queue.length < this.maxQueueSize) {
        queue.unshift(...locations);
      }
    }
  }

  flushAll() {
    const deviceIds = Array.from(this.batchQueue.keys());
    deviceIds.forEach(deviceId => {
      this.flushDevice(deviceId);
    });
  }

  getQueueSize(deviceId) {
    const queue = this.batchQueue.get(deviceId);
    return queue ? queue.length : 0;
  }

  clearQueue(deviceId) {
    this.batchQueue.delete(deviceId);
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushAll();
    this.batchQueue.clear();
  }
}

module.exports = new LocationBatchService();

