/**
 * Memory Optimizer Service
 * Monitors and optimizes memory usage
 */

const { logger } = require('../utils/logger');

class MemoryOptimizer {
  constructor() {
    this.monitoringInterval = null;
    this.warningThreshold = 0.85; // 85% memory usage
    this.criticalThreshold = 0.95; // 95% memory usage
    this.lastGC = Date.now();
    this.gcInterval = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Start memory monitoring
   */
  start() {
    if (this.monitoringInterval) {
      return; // Already started
    }

    this.monitoringInterval = setInterval(() => {
      this.checkMemory();
    }, 30000); // Every 30 seconds

    logger.info('Memory optimizer started');
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check memory usage
   */
  checkMemory() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const heapTotal = usage.heapTotal;
    const usagePercent = heapUsed / heapTotal;

    if (usagePercent >= this.criticalThreshold) {
      logger.error(`Critical memory usage detected - heapUsed: ${(heapUsed / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(heapTotal / 1024 / 1024).toFixed(2)}MB, usagePercent: ${(usagePercent * 100).toFixed(2)}%`);
      this.forceGC();
    } else if (usagePercent >= this.warningThreshold) {
      logger.warn(`High memory usage detected - heapUsed: ${(heapUsed / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(heapTotal / 1024 / 1024).toFixed(2)}MB, usagePercent: ${(usagePercent * 100).toFixed(2)}%`);
      
      // Trigger GC if enough time has passed
      if (Date.now() - this.lastGC > this.gcInterval) {
        this.forceGC();
      }
    }
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC() {
    if (global.gc) {
      try {
        global.gc();
        this.lastGC = Date.now();
        logger.info('Garbage collection triggered');
      } catch (error) {
        logger.warn(`Failed to trigger GC: ${error.message || error}`);
      }
    }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const heapTotal = usage.heapTotal;
    const usagePercent = heapUsed / heapTotal;

    return {
      heapUsed: `${(heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(heapTotal / 1024 / 1024).toFixed(2)}MB`,
      heapFree: `${((heapTotal - heapUsed) / 1024 / 1024).toFixed(2)}MB`,
      usagePercent: `${(usagePercent * 100).toFixed(2)}%`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
      status: usagePercent >= this.criticalThreshold ? 'critical' :
              usagePercent >= this.warningThreshold ? 'warning' : 'healthy',
    };
  }

  /**
   * Optimize memory
   */
  optimize() {
    // Clear module cache for unused modules (be careful!)
    // This is a simple optimization - in production, use more sophisticated strategies
    
    // Force GC
    this.forceGC();
    
    logger.info('Memory optimization completed');
  }
}

module.exports = new MemoryOptimizer();

