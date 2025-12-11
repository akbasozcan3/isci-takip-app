/**
 * Startup Check Middleware
 * Ensures all services are initialized before handling requests
 */

const startupService = require('../services/startup.service');

function startupCheckMiddleware(req, res, next) {
  // Allow health check and metrics endpoints during startup
  if (req.path === '/api/health' || req.path === '/api/metrics' || req.path === '/') {
    return next();
  }

  // Check if application is ready
  if (!startupService.isReady()) {
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
      },
    });
  }

  next();
}

module.exports = startupCheckMiddleware;

