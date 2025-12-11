/**
 * System Status Controller
 * Provides comprehensive system health and status information
 */

const ResponseFormatter = require('../core/utils/responseFormatter');
const { logger } = require('../core/utils/logger');
const performanceService = require('../core/services/performance.service');
const databaseService = require('../core/services/database.service');
const advancedCacheService = require('../core/services/advancedCache.service');
const memoryOptimizer = require('../core/services/memoryOptimizer.service');

class SystemStatusController {
  /**
   * Get comprehensive system status
   */
  async getSystemStatus(req, res) {
    try {
      const uptime = process.uptime();
      const memory = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics = performanceService.getMetrics();
      const dbStats = databaseService.getStats();
      const cacheStats = advancedCacheService.getStats();
      const memoryStats = memoryOptimizer.getStats();
      
      const status = {
        system: {
          uptime: Math.floor(uptime),
          uptimeFormatted: this.formatUptime(uptime),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        },
        memory: {
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
          external: Math.round(memory.external / 1024 / 1024), // MB
          rss: Math.round(memory.rss / 1024 / 1024), // MB
          heapUsagePercent: Math.round((memory.heapUsed / memory.heapTotal) * 100),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        performance: {
          totalRequests: metrics.requests.total,
          successfulRequests: metrics.requests.successful,
          failedRequests: metrics.requests.failed,
          successRate: metrics.requests.total > 0 
            ? Math.round((metrics.requests.successful / metrics.requests.total) * 100) 
            : 100,
          averageResponseTime: metrics.responseTimes.average,
          p95ResponseTime: metrics.responseTimes.p95,
          p99ResponseTime: metrics.responseTimes.p99,
        },
        database: {
          totalQueries: dbStats.queries,
          cacheHits: dbStats.cacheHits,
          cacheMisses: dbStats.cacheMisses,
          cacheHitRate: dbStats.queries > 0 
            ? Math.round((dbStats.cacheHits / dbStats.queries) * 100) 
            : 0,
          averageQueryTime: dbStats.averageQueryTime,
          slowQueries: dbStats.slowQueries.length,
        },
        cache: {
          hits: cacheStats.hits || 0,
          misses: cacheStats.misses || 0,
          size: cacheStats.size || 0,
          hitRate: (cacheStats.hits + cacheStats.misses) > 0
            ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
            : 0,
        },
        memoryOptimizer: {
          optimizations: memoryStats.optimizations || 0,
          lastOptimization: memoryStats.lastOptimization || null,
          gcCount: memoryStats.gcCount || 0,
        },
        health: {
          status: this.determineHealthStatus(memory, metrics),
          timestamp: new Date().toISOString(),
        },
      };
      
      return res.json(ResponseFormatter.success(status, 'Sistem durumu başarıyla alındı'));
    } catch (error) {
      logger.error('Get system status error', error);
      return res.status(500).json(
        ResponseFormatter.error('Sistem durumu alınamadı', 'SYSTEM_STATUS_ERROR')
      );
    }
  }

  /**
   * Get health check (lightweight)
   */
  async getHealthCheck(req, res) {
    try {
      const memory = process.memoryUsage();
      const heapUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
      
      const health = {
        status: heapUsagePercent < 90 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: {
          heapUsagePercent: Math.round(heapUsagePercent),
        },
      };
      
      const statusCode = health.status === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(ResponseFormatter.success(health));
    } catch (error) {
      logger.error('Health check error', error);
      return res.status(503).json(
        ResponseFormatter.error('Health check failed', 'HEALTH_CHECK_ERROR')
      );
    }
  }

  /**
   * Get API version information
   */
  async getApiVersion(req, res) {
    try {
      const packageJson = require('../../package.json');
      
      const version = {
        api: {
          version: packageJson.version || '2.0.0',
          name: packageJson.name || 'isci-takip-backend',
          description: packageJson.description || 'Professional İşçi Takip Backend API',
        },
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          port: process.env.PORT || 4000,
        },
        timestamp: new Date().toISOString(),
      };
      
      return res.json(ResponseFormatter.success(version));
    } catch (error) {
      logger.error('Get API version error', error);
      return res.status(500).json(
        ResponseFormatter.error('API versiyonu alınamadı', 'VERSION_ERROR')
      );
    }
  }

  /**
   * Format uptime to human readable
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Determine overall health status
   */
  determineHealthStatus(memory, metrics) {
    const heapUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    const errorRate = metrics.requests.total > 0 
      ? (metrics.requests.failed / metrics.requests.total) * 100 
      : 0;
    
    if (heapUsagePercent > 95 || errorRate > 10) {
      return 'critical';
    } else if (heapUsagePercent > 85 || errorRate > 5) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

module.exports = new SystemStatusController();

