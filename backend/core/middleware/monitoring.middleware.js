/**
 * Professional Monitoring Middleware
 * Real-time performance and error monitoring
 */

const metricsService = require('../services/metrics.service');
const performanceService = require('../services/performance.service');

function monitoringMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = req.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  req.requestId = requestId;
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Track request in metrics service
    metricsService.recordRequest(req.method, req.path, res.statusCode, duration);
    
    // API metrics
    try {
      const apiMetrics = require('../utils/apiMetrics');
      apiMetrics.recordRequest(req.method, req.path, res.statusCode, duration);
    } catch (error) {
      // Non-critical, continue
    }
    
    // Performance tracking
    try {
      performanceService.recordRequest(req.method, req.path, duration, res.statusCode < 400);
    } catch (error) {
      // Non-critical, continue
    }
    
    // Set performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Request-ID', requestId);
    
    return originalSend.call(this, data);
  };
  
  next();
}

module.exports = monitoringMiddleware;

