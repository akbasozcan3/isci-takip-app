/**
 * Performance Service
 * Enterprise-level performance monitoring and optimization
 */

const { logger } = require('../utils/logger');

class PerformanceService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: new Map(),
        byMethod: new Map(),
      },
      responseTimes: {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0,
        max: 0,
        min: Infinity,
        samples: [],
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
      },
      database: {
        queries: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
      },
      cache: {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
      },
    };
    this.slowQueries = [];
    this.maxSlowQueries = 100;
    this.startTime = Date.now();
  }

  /**
   * Record socket connection
   */
  recordSocketConnection() {
    // Track socket connections
  }

  /**
   * Record socket disconnection
   */
  recordSocketDisconnection() {
    // Track socket disconnections
  }

  /**
   * Set socket rooms count
   */
  setSocketRooms(count) {
    // Track active rooms
  }

  /**
   * Record request
   */
  recordRequest(method, endpoint, duration, success) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Track by endpoint
    const key = `${method} ${endpoint}`;
    if (!this.metrics.requests.byEndpoint.has(key)) {
      this.metrics.requests.byEndpoint.set(key, { count: 0, totalDuration: 0, errors: 0 });
    }
    const endpointMetric = this.metrics.requests.byEndpoint.get(key);
    endpointMetric.count++;
    endpointMetric.totalDuration += duration;
    if (!success) endpointMetric.errors++;

    // Track by method
    if (!this.metrics.requests.byMethod.has(method)) {
      this.metrics.requests.byMethod.set(method, { count: 0, totalDuration: 0 });
    }
    const methodMetric = this.metrics.requests.byMethod.get(method);
    methodMetric.count++;
    methodMetric.totalDuration += duration;

    // Track response times
    this.metrics.responseTimes.samples.push(duration);
    if (this.metrics.responseTimes.samples.length > 1000) {
      this.metrics.responseTimes.samples.shift();
    }

    this.updateResponseTimeStats();
    this.updateMemoryStats();
  }

  /**
   * Update response time statistics
   */
  updateResponseTimeStats() {
    const samples = this.metrics.responseTimes.samples;
    if (samples.length === 0) return;

    const sorted = [...samples].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.responseTimes.p50 = sorted[Math.floor(len * 0.5)];
    this.metrics.responseTimes.p95 = sorted[Math.floor(len * 0.95)];
    this.metrics.responseTimes.p99 = sorted[Math.floor(len * 0.99)];
    this.metrics.responseTimes.average = samples.reduce((a, b) => a + b, 0) / len;
    this.metrics.responseTimes.max = Math.max(...samples);
    this.metrics.responseTimes.min = Math.min(...samples);
  }

  /**
   * Update memory statistics
   */
  updateMemoryStats() {
    const usage = process.memoryUsage();
    this.metrics.memory.heapUsed = usage.heapUsed;
    this.metrics.memory.heapTotal = usage.heapTotal;
    this.metrics.memory.external = usage.external;
    this.metrics.memory.rss = usage.rss;
  }

  /**
   * Record database query
   */
  recordQuery(duration, cached = false) {
    this.metrics.database.queries++;
    
    if (cached) {
      this.metrics.database.cacheHits++;
      this.metrics.cache.hits++;
    } else {
      this.metrics.database.cacheMisses++;
      this.metrics.cache.misses++;
    }

    // Track slow queries
    if (duration > 100) { // > 100ms
      this.metrics.database.slowQueries++;
      this.slowQueries.push({
        duration,
        timestamp: Date.now(),
        query: 'unknown', // Can be enhanced to track actual queries
      });
      
      if (this.slowQueries.length > this.maxSlowQueries) {
        this.slowQueries.shift();
      }
    }

    // Update average query time
    const totalQueries = this.metrics.database.queries;
    const currentAvg = this.metrics.database.averageQueryTime;
    this.metrics.database.averageQueryTime = 
      (currentAvg * (totalQueries - 1) + duration) / totalQueries;
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(hit, size = 0) {
    if (hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
    this.metrics.cache.size = size;
  }

  /**
   * Record cache eviction
   */
  recordCacheEviction() {
    this.metrics.cache.evictions++;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const successRate = this.metrics.requests.total > 0
      ? (this.metrics.requests.successful / this.metrics.requests.total) * 100
      : 0;
    
    const cacheHitRate = (this.metrics.cache.hits + this.metrics.cache.misses) > 0
      ? (this.metrics.cache.hits / (this.metrics.cache.hits + this.metrics.cache.misses)) * 100
      : 0;

    return {
      ...this.metrics,
      uptime,
      successRate: `${successRate.toFixed(2)}%`,
      cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
      requestsPerSecond: this.metrics.requests.total / (uptime / 1000),
      slowQueries: this.slowQueries.slice(-10), // Last 10 slow queries
      topEndpoints: Array.from(this.metrics.requests.byEndpoint.entries())
        .map(([endpoint, data]) => ({
          endpoint,
          count: data.count,
          averageDuration: data.totalDuration / data.count,
          errorRate: (data.errors / data.count) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const issues = [];

    // Check response times
    if (metrics.responseTimes.p95 > 1000) {
      issues.push('High p95 response time');
    }

    // Check error rate
    const errorRate = (metrics.requests.failed / metrics.requests.total) * 100;
    if (errorRate > 5) {
      issues.push('High error rate');
    }

    // Check memory
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      issues.push('High memory usage');
    }

    // Check slow queries
    if (metrics.database.slowQueries > 100) {
      issues.push('Many slow queries detected');
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      issues,
      metrics: {
        responseTime: {
          p95: `${metrics.responseTimes.p95.toFixed(2)}ms`,
          average: `${metrics.responseTimes.average.toFixed(2)}ms`,
        },
        errorRate: `${errorRate.toFixed(2)}%`,
        memoryUsage: `${memoryUsagePercent.toFixed(2)}%`,
        cacheHitRate: metrics.cacheHitRate,
      },
    };
  }

  /**
   * Record slow request
   */
  recordSlowRequest({ method, path, duration, statusCode, requestId }) {
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method,
        path,
        duration: `${Math.round(duration)}ms`,
        statusCode,
        requestId
      });
    }
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  reset() {
    this.metrics.requests.total = 0;
    this.metrics.requests.successful = 0;
    this.metrics.requests.failed = 0;
    this.metrics.requests.byEndpoint.clear();
    this.metrics.requests.byMethod.clear();
    this.metrics.responseTimes.samples = [];
    this.slowQueries = [];
    this.startTime = Date.now();
    logger.info('Performance metrics reset');
  }
}

module.exports = new PerformanceService();
