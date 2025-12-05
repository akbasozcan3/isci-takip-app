const os = require('os');
const v8 = require('v8');

class PerformanceService {
  constructor() {
    this.metrics = {
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0],
        user: 0,
        system: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        available: 0,
        total: 0,
        usagePercent: 0,
        heapLimit: 0
      },
      eventLoop: {
        delay: 0,
        utilization: 0,
        lag: 0
      },
      gc: {
        count: 0,
        duration: 0,
        major: 0,
        minor: 0
      },
      requests: {
        active: 0,
        queued: 0,
        total: 0,
        errors: 0
      },
      sockets: {
        connected: 0,
        rooms: 0
      }
    };
    
    this.requestHistory = [];
    this.maxHistorySize = 1000;
    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(() => this.collectMetrics(), 5000);
    this.setupGCMonitoring();
    this.setupEventLoopMonitoring();
  }

  collectMetrics() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      available: Math.round(freeMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      heapLimit: v8.getHeapStatistics ? Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024) : 0
    };

    this.metrics.cpu = {
      usage: cpuUsage,
      loadAverage: os.loadavg(),
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000)
    };
  }

  setupGCMonitoring() {
    if (v8.getHeapStatistics) {
      const heapStats = v8.getHeapStatistics();
      this.metrics.gc = {
        count: heapStats.number_of_native_contexts || 0,
        duration: 0,
        major: 0,
        minor: 0
      };
    }
    
    if (process.setMaxListeners) {
      process.setMaxListeners(0);
    }
  }

  setupEventLoopMonitoring() {
    let lastCheck = process.hrtime.bigint();
    
    setInterval(() => {
      const now = process.hrtime.bigint();
      const delay = Number(now - lastCheck) / 1000000;
      lastCheck = now;
      
      this.metrics.eventLoop = {
        delay: Math.round(delay),
        utilization: Math.min(100, Math.round((delay / 16) * 100))
      };
    }, 1000);
  }

  getHealthStatus() {
    const memUsage = this.metrics.memory.usagePercent;
    const eventLoopUtil = this.metrics.eventLoop.utilization;
    
    let status = 'healthy';
    let issues = [];
    
    if (memUsage > 90) {
      status = 'critical';
      issues.push('High memory usage');
    } else if (memUsage > 75) {
      status = 'degraded';
      issues.push('Elevated memory usage');
    }
    
    if (eventLoopUtil > 80) {
      status = status === 'critical' ? 'critical' : 'degraded';
      issues.push('High event loop utilization');
    }
    
    return {
      status,
      issues,
      metrics: this.metrics
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  recordRequestStart() {
    this.metrics.requests.active++;
    this.metrics.requests.total++;
  }

  recordRequestEnd(success = true) {
    if (this.metrics.requests.active > 0) {
      this.metrics.requests.active--;
    }
    if (!success) {
      this.metrics.requests.errors++;
    }
  }

  recordSocketConnection() {
    this.metrics.sockets.connected++;
  }

  recordSocketDisconnection() {
    if (this.metrics.sockets.connected > 0) {
      this.metrics.sockets.connected--;
    }
  }

  setSocketRooms(count) {
    this.metrics.sockets.rooms = count;
  }
}

module.exports = new PerformanceService();

