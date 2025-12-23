/**
 * Performance Monitor
 * Advanced performance monitoring and alerting
 */

const logger = require('./logger');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: [],
      slowRequests: [],
      errors: [],
      memory: [],
    };
    this.thresholds = {
      slowRequest: 1000, // 1 second
      memoryWarning: 0.85, // 85%
      memoryCritical: 0.95, // 95%
    };
    this.alerts = [];
  }

  /**
   * Record request performance
   */
  recordRequest(method, path, duration, statusCode) {
    const metric = {
      method,
      path,
      duration,
      statusCode,
      timestamp: Date.now(),
    };

    this.metrics.requests.push(metric);

    // Keep only last 1000 requests
    if (this.metrics.requests.length > 1000) {
      this.metrics.requests.shift();
    }

    // Track slow requests
    if (duration > this.thresholds.slowRequest) {
      this.metrics.slowRequests.push(metric);
      if (this.metrics.slowRequests.length > 100) {
        this.metrics.slowRequests.shift();
      }
      
      logger.warn('Slow request detected', {
        method,
        path,
        duration: `${duration}ms`,
      });
    }

    // Track errors
    if (statusCode >= 400) {
      this.metrics.errors.push(metric);
      if (this.metrics.errors.length > 100) {
        this.metrics.errors.shift();
      }
    }
  }

  /**
   * Record memory usage
   */
  recordMemory() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const heapTotal = usage.heapTotal;
    const usagePercent = heapUsed / heapTotal;

    this.metrics.memory.push({
      heapUsed,
      heapTotal,
      usagePercent,
      timestamp: Date.now(),
    });

    // Keep only last 100 measurements
    if (this.metrics.memory.length > 100) {
      this.metrics.memory.shift();
    }

    // Check thresholds
    if (usagePercent >= this.thresholds.memoryCritical) {
      this.alert('CRITICAL', 'Memory usage critical', {
        usagePercent: `${(usagePercent * 100).toFixed(2)}%`,
        heapUsed: `${(heapUsed / 1024 / 1024).toFixed(2)}MB`,
      });
    } else if (usagePercent >= this.thresholds.memoryWarning) {
      this.alert('WARNING', 'Memory usage high', {
        usagePercent: `${(usagePercent * 100).toFixed(2)}%`,
        heapUsed: `${(heapUsed / 1024 / 1024).toFixed(2)}MB`,
      });
    }
  }

  /**
   * Generate alert
   */
  alert(level, message, data = {}) {
    const alert = {
      level,
      message,
      data,
      timestamp: Date.now(),
    };

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    if (level === 'CRITICAL') {
      logger.error(`[ALERT] ${message}`, data);
    } else {
      logger.warn(`[ALERT] ${message}`, data);
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const requests = this.metrics.requests;
    if (requests.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        errorRate: 0,
      };
    }

    const totalDuration = requests.reduce((sum, r) => sum + r.duration, 0);
    const averageResponseTime = totalDuration / requests.length;
    const errorCount = requests.filter(r => r.statusCode >= 400).length;
    const errorRate = (errorCount / requests.length) * 100;

    return {
      totalRequests: requests.length,
      averageResponseTime: Math.round(averageResponseTime),
      slowRequests: this.metrics.slowRequests.length,
      errorRate: errorRate.toFixed(2) + '%',
      recentAlerts: this.alerts.slice(-10),
    };
  }

  /**
   * Get slow requests
   */
  getSlowRequests(limit = 10) {
    return this.metrics.slowRequests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const errors = this.metrics.errors;
    const byPath = {};
    const byStatus = {};

    for (const error of errors) {
      byPath[error.path] = (byPath[error.path] || 0) + 1;
      byStatus[error.statusCode] = (byStatus[error.statusCode] || 0) + 1;
    }

    return {
      total: errors.length,
      byPath,
      byStatus,
    };
  }
}

module.exports = new PerformanceMonitor();

