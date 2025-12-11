/**
 * Professional Health Check Middleware
 * Comprehensive system health monitoring
 */

const db = require('../../config/database');
const metricsService = require('../services/metrics.service');
const performanceService = require('../services/performance.service');
const circuitBreakerService = require('../services/circuitBreaker.service');
const advancedCacheService = require('../services/advancedCache.service');

class HealthCheckService {
  constructor() {
    this.startTime = Date.now();
    this.checks = {
      database: this.checkDatabase.bind(this),
      memory: this.checkMemory.bind(this),
      cache: this.checkCache.bind(this),
      services: this.checkServices.bind(this)
    };
  }

  async checkDatabase() {
    try {
      const start = Date.now();
      const testData = db.data;
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        dataSize: JSON.stringify(testData).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  checkMemory() {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal;
    const usedMemory = usage.heapUsed;
    const freeMemory = totalMemory - usedMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    return {
      status: memoryUsagePercent < 90 ? 'healthy' : 'warning',
      heapTotal: `${(totalMemory / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
      freeMemory: `${(freeMemory / 1024 / 1024).toFixed(2)} MB`,
      usagePercent: `${memoryUsagePercent.toFixed(2)}%`,
      timestamp: new Date().toISOString()
    };
  }

  checkCache() {
    try {
      const stats = advancedCacheService.getStats();
      const hitRate = stats.hits + stats.misses > 0 
        ? (stats.hits / (stats.hits + stats.misses)) * 100 
        : 0;
      
      return {
        status: 'healthy',
        hitRate: `${hitRate.toFixed(2)}%`,
        hits: stats.hits,
        misses: stats.misses,
        l1Size: stats.l1Size || 0,
        l2Size: stats.l2Size || 0,
        totalSize: (stats.l1Size || 0) + (stats.l2Size || 0),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  checkServices() {
    const services = {
      metrics: metricsService.getMetrics(),
      performance: performanceService.getHealthStatus(),
      circuitBreaker: circuitBreakerService.getStatus()
    };
    
    const allHealthy = Object.values(services).every(s => s.status === 'healthy' || s.status === 'operational');
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString()
    };
  }

  async performHealthCheck(detailed = false) {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor((Date.now() - this.startTime) / 1000)}s`,
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    if (detailed) {
      const checks = await Promise.allSettled(
        Object.entries(this.checks).map(async ([name, check]) => {
          try {
            const result = await check();
            return { name, ...result };
          } catch (error) {
            return { name, status: 'unhealthy', error: error.message };
          }
        })
      );

      results.checks = checks.map(c => c.status === 'fulfilled' ? c.value : { name: 'unknown', status: 'unhealthy', error: String(c.reason) });
      
      const unhealthyChecks = results.checks.filter(c => c.status === 'unhealthy');
      if (unhealthyChecks.length > 0) {
        results.status = 'unhealthy';
      } else if (results.checks.some(c => c.status === 'warning' || c.status === 'degraded')) {
        results.status = 'degraded';
      }
    }

    return results;
  }
}

const healthCheckService = new HealthCheckService();

function healthCheckMiddleware(req, res) {
  const detailed = req.query.detailed === 'true' || req.query.detailed === '1';
  
  healthCheckService.performHealthCheck(detailed).then(results => {
    const statusCode = results.status === 'healthy' ? 200 : 
                      results.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: results.status === 'healthy',
      ...results
    });
  }).catch(error => {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = {
  healthCheckMiddleware,
  healthCheckService
};

