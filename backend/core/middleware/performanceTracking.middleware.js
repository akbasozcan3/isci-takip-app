/**
 * Performance Tracking Middleware
 * Tracks request performance and integrates with PerformanceService
 */

const performanceService = require('../services/performance.service');
const performanceMonitor = require('../utils/performanceMonitor');

function performanceTrackingMiddleware(req, res, next) {
  const startTime = Date.now();
  const method = req.method;
  const endpoint = req.path;

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    performanceService.recordRequest(method, endpoint, duration, success);
    performanceMonitor.recordRequest(method, endpoint, duration, res.statusCode);
  });

  next();
}

module.exports = performanceTrackingMiddleware;

