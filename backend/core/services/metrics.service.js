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
    
    const normalizedEndpoint = endpoint.split('?')[0].split('/').slice(0, 3).join('/');
    this.metrics.requests.byEndpoint[normalizedEndpoint] = (this.metrics.requests.byEndpoint[normalizedEndpoint] || 0) + 1;
    
    if (statusCode >= 400) {
      this.metrics.requests.errors++;
    } else {
      this.metrics.requests.success++;
    }

    if (responseTime !== undefined && responseTime > 0) {
      this.metrics.responseTime.total += responseTime;
      this.metrics.responseTime.count++;
      this.metrics.responseTime.average = this.metrics.responseTime.total / this.metrics.responseTime.count;
      this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, responseTime);
      this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, responseTime);
    }
    
    if (this.metrics.requests.total > 1000000) {
      this.metrics.requests.total = Math.floor(this.metrics.requests.total * 0.9);
      this.metrics.requests.errors = Math.floor(this.metrics.requests.errors * 0.9);
      this.metrics.requests.success = Math.floor(this.metrics.requests.success * 0.9);
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

