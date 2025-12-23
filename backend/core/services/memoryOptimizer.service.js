/**
 * Memory Optimizer Service
 * Monitors and optimizes memory usage
 */

let logger;
try {
  logger = require('../utils/logger');
  if (!logger || typeof logger.info !== 'function') {
    logger = {
      info: (...args) => console.log('[MemoryOptimizer]', ...args),
      warn: (...args) => console.warn('[MemoryOptimizer]', ...args),
      error: (...args) => console.error('[MemoryOptimizer]', ...args),
      debug: (...args) => console.log('[MemoryOptimizer]', ...args),
    };
  }
} catch (err) {
  logger = {
    info: (...args) => console.log('[MemoryOptimizer]', ...args),
    warn: (...args) => console.warn('[MemoryOptimizer]', ...args),
    error: (...args) => console.error('[MemoryOptimizer]', ...args),
    debug: (...args) => console.log('[MemoryOptimizer]', ...args),
  };
}

class MemoryOptimizer {
  constructor() {
    this.monitoringInterval = null;
    this.warningThreshold = 0.95; // 95% memory usage (only warn at very high usage)
    this.criticalThreshold = 0.98; // 98% memory usage (critical threshold)
    this.lastGC = Date.now();
    this.gcInterval = 5 * 60 * 1000; // 5 minutes
    this.lastWarning = 0;
    this.warningCooldown = 2 * 60 * 1000; // Only warn once every 2 minutes
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

    if (logger && typeof logger.info === 'function') {
      logger.info('Memory optimizer started');
    } else {
      console.log('[MemoryOptimizer] Memory optimizer started');
    }
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
    const now = Date.now();

    if (usagePercent >= this.criticalThreshold) {
      // Only log critical errors, not every check
      if (!this.lastWarning || now - this.lastWarning > this.warningCooldown) {
        this.lastWarning = now;
        const errorMsg = `Critical memory usage detected - heapUsed: ${(heapUsed / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(heapTotal / 1024 / 1024).toFixed(2)}MB, usagePercent: ${(usagePercent * 100).toFixed(2)}%`;
        if (logger && typeof logger.error === 'function') {
          logger.error(errorMsg);
        } else {
          console.error(`[MemoryOptimizer] ${errorMsg}`);
        }
      }
      this.forceGC();
    } else if (usagePercent >= this.warningThreshold) {
      // Only warn once per cooldown period
      if (!this.lastWarning || now - this.lastWarning > this.warningCooldown) {
        this.lastWarning = now;
        const warnMsg = `High memory usage detected - heapUsed: ${(heapUsed / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(heapTotal / 1024 / 1024).toFixed(2)}MB, usagePercent: ${(usagePercent * 100).toFixed(2)}%`;
        if (logger && typeof logger.warn === 'function') {
          logger.warn(warnMsg);
        } else {
          console.warn(`[MemoryOptimizer] ${warnMsg}`);
        }
      }
      
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
        if (logger && typeof logger.info === 'function') {
          logger.info('Garbage collection triggered');
        } else {
          console.log('[MemoryOptimizer] Garbage collection triggered');
        }
      } catch (error) {
        const errorMsg = error?.message || String(error) || 'Unknown error';
        if (logger && typeof logger.warn === 'function') {
          logger.warn(`Failed to trigger GC: ${errorMsg}`);
        } else {
          console.warn(`[MemoryOptimizer] Failed to trigger GC: ${errorMsg}`);
        }
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
    
    if (logger && typeof logger.info === 'function') {
      logger.info('Memory optimization completed');
    } else {
      console.log('[MemoryOptimizer] Memory optimization completed');
    }
  }
}

module.exports = new MemoryOptimizer();

