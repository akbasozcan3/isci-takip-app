class MetricsService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        errors: 0,
        success: 0
      },
      responseTime: {
        total: 0,
        count: 0,
        average: 0,
        min: Infinity,
        max: 0
      },
      activeConnections: 0,
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      },
      uptime: 0,
      startTime: Date.now()
    };
  }

  recordRequest(method, endpoint, statusCode, responseTime) {
    this.metrics.requests.total++;
    
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;
    this.metrics.requests.byEndpoint[endpoint] = (this.metrics.requests.byEndpoint[endpoint] || 0) + 1;
    
    if (statusCode >= 400) {
      this.metrics.requests.errors++;
    } else {
      this.metrics.requests.success++;
    }

    if (responseTime !== undefined) {
      this.metrics.responseTime.total += responseTime;
      this.metrics.responseTime.count++;
      this.metrics.responseTime.average = this.metrics.responseTime.total / this.metrics.responseTime.count;
      this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, responseTime);
      this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, responseTime);
    }
  }

  updateMemory() {
    const mem = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024)
    };
  }

  updateUptime() {
    this.metrics.uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
  }

  getMetrics() {
    this.updateMemory();
    this.updateUptime();
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        errors: 0,
        success: 0
      },
      responseTime: {
        total: 0,
        count: 0,
        average: 0,
        min: Infinity,
        max: 0
      },
      activeConnections: 0,
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      },
      uptime: 0,
      startTime: Date.now()
    };
  }
}

module.exports = new MetricsService();

