/**
 * Startup Check Middleware
 * Ensures all services are initialized before handling requests
 * Professional implementation with graceful degradation
 */

const startupService = require('../services/startup.service');

function startupCheckMiddleware(req, res, next) {
  // Always allow health check, metrics, and root endpoints
  if (req.path === '/api/health' || 
      req.path === '/health' || 
      req.path === '/api/metrics' || 
      req.path === '/metrics' || 
      req.path === '/' ||
      req.path.startsWith('/api-docs')) {
    return next();
  }

  // In development mode, be more lenient - allow requests after 2 seconds
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const startupTime = Date.now() - (startupService.startTime || Date.now());
  const maxStartupWait = isDevelopment ? 2000 : 10000; // 2s dev, 10s prod

  // Check if application is ready
  const isReady = startupService.isReady();
  
  // If not ready but enough time has passed, allow requests anyway (graceful degradation)
  if (!isReady && startupTime > maxStartupWait) {
    // Log warning but allow request
    if (isDevelopment) {
      console.warn('[StartupCheck] Services not fully initialized but allowing request (dev mode)');
    }
    return next();
  }

  // If not ready and not enough time passed, return 503
  if (!isReady) {
    const status = startupService.getStatus();
    
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_STARTING',
      message: 'Application is still initializing. Please try again in a moment.',
      status: {
        initialized: status.initialized,
        servicesReady: status.summary.successful,
        servicesTotal: status.summary.total,
        startupTime: Math.round(startupTime / 1000) + 's',
      },
    });
  }

  next();
}

module.exports = startupCheckMiddleware;

