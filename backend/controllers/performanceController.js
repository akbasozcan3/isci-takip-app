/**
 * Performance Controller
 * Provides performance metrics and statistics
 */

const performanceService = require('../core/services/performance.service');
const realtimeService = require('../core/services/realtime.service');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');
const { logger } = require('../core/utils/logger');

class PerformanceController {
  /**
   * Get performance metrics
   */
  async getMetrics(req, res) {
    try {
      const metrics = performanceService.getMetrics();
      const realtimeStats = realtimeService.getStats();
      const health = performanceService.getHealthStatus();

      return res.json(ResponseFormatter.success({
        performance: metrics,
        realtime: realtimeStats,
        health,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('Get performance metrics error', error);
      return res.status(500).json(ResponseFormatter.error('Performans metrikleri alınamadı', 'PERFORMANCE_ERROR'));
    }
  }

  /**
   * Get health status
   */
  async getHealth(req, res) {
    try {
      const health = performanceService.getHealthStatus();
      return res.json(ResponseFormatter.success(health));
    } catch (error) {
      logger.error('Get health status error', error);
      return res.status(500).json(ResponseFormatter.error('Sağlık durumu alınamadı', 'HEALTH_ERROR'));
    }
  }

  /**
   * Reset metrics (admin only)
   */
  async resetMetrics(req, res) {
    try {
      // TODO: Add admin check
      performanceService.reset();
      return res.json(ResponseFormatter.success(null, 'Metrikler sıfırlandı'));
    } catch (error) {
      logger.error('Reset metrics error', error);
      return res.status(500).json(ResponseFormatter.error('Metrikler sıfırlanamadı', 'PERFORMANCE_ERROR'));
    }
  }
}

module.exports = new PerformanceController();

