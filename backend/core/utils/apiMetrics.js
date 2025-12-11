/**
 * API Metrics Collection
 * Comprehensive API performance and usage metrics
 */

class ApiMetrics {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatus: {}
      },
      responseTimes: {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0,
        min: Infinity,
        max: 0
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {}
      },
      throughput: {
        requestsPerSecond: 0,
        requestsPerMinute: 0
      },
      activeConnections: 0
    };
    
    this.responseTimeHistory = [];
    this.requestTimestamps = [];
    this.startTime = Date.now();
    
    this.startCleanup();
  }

  recordRequest(method, endpoint, statusCode, duration) {
    // Total requests
    this.metrics.requests.total++;
    
    // By method
    this.metrics.requests.byMethod[method] = 
      (this.metrics.requests.byMethod[method] || 0) + 1;
    
    // By endpoint
    this.metrics.requests.byEndpoint[endpoint] = 
      (this.metrics.requests.byEndpoint[endpoint] || 0) + 1;
    
    // By status
    this.metrics.requests.byStatus[statusCode] = 
      (this.metrics.requests.byStatus[statusCode] || 0) + 1;
    
    // Response time
    this.responseTimeHistory.push(duration);
    if (this.responseTimeHistory.length > 10000) {
      this.responseTimeHistory.shift();
    }
    
    this.updateResponseTimeMetrics();
    
    // Request timestamps for throughput
    this.requestTimestamps.push(Date.now());
    this.updateThroughput();
    
    // Errors
    if (statusCode >= 400) {
      this.metrics.errors.total++;
      this.metrics.errors.byType[statusCode] = 
        (this.metrics.errors.byType[statusCode] || 0) + 1;
      this.metrics.errors.byEndpoint[endpoint] = 
        (this.metrics.errors.byEndpoint[endpoint] || 0) + 1;
    }
  }

  updateResponseTimeMetrics() {
    if (this.responseTimeHistory.length === 0) return;
    
    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const len = sorted.length;
    
    this.metrics.responseTimes.p50 = sorted[Math.floor(len * 0.5)];
    this.metrics.responseTimes.p95 = sorted[Math.floor(len * 0.95)];
    this.metrics.responseTimes.p99 = sorted[Math.floor(len * 0.99)];
    this.metrics.responseTimes.average = 
      sorted.reduce((a, b) => a + b, 0) / len;
    this.metrics.responseTimes.min = sorted[0];
    this.metrics.responseTimes.max = sorted[len - 1];
  }

  updateThroughput() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;
    
    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    this.metrics.throughput.requestsPerSecond = 
      this.requestTimestamps.filter(t => t > oneSecondAgo).length;
    this.metrics.throughput.requestsPerMinute = 
      this.requestTimestamps.filter(t => t > oneMinuteAgo).length;
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }

  getTopEndpoints(limit = 10) {
    return Object.entries(this.metrics.requests.byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  getErrorRate() {
    if (this.metrics.requests.total === 0) return 0;
    return (this.metrics.errors.total / this.metrics.requests.total * 100).toFixed(2) + '%';
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatus: {}
      },
      responseTimes: {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0,
        min: Infinity,
        max: 0
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {}
      },
      throughput: {
        requestsPerSecond: 0,
        requestsPerMinute: 0
      },
      activeConnections: 0
    };
    this.responseTimeHistory = [];
    this.requestTimestamps = [];
    this.startTime = Date.now();
  }

  startCleanup() {
    setInterval(() => {
      // Keep only last 10k response times
      if (this.responseTimeHistory.length > 10000) {
        this.responseTimeHistory = this.responseTimeHistory.slice(-10000);
      }
      
      // Keep only last minute of timestamps
      const oneMinuteAgo = Date.now() - 60000;
      this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    }, 60000); // Every minute
  }
}

module.exports = new ApiMetrics();

