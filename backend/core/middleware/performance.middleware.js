const performanceService = require('../services/performance.service');

let logger;
try {
  const { getLogger } = require('../utils/loggerHelper');
  logger = getLogger('Performance');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[Performance]', ...args),
    error: (...args) => console.error('[Performance]', ...args),
    info: (...args) => console.log('[Performance]', ...args),
    debug: (...args) => console.debug('[Performance]', ...args)
  };
}

function performanceMiddleware(req, res, next) {
  const startTime = Date.now();
  const method = req.method;
  const endpoint = req.path;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // Record request in performance service
    performanceService.recordRequest(method, endpoint, duration, success);

    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method,
        path: endpoint,
        duration: `${Math.round(duration)}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id
      });
    }

    if (res.statusCode >= 500) {
      logger.error('Server error', {
        method,
        path: endpoint,
        statusCode: res.statusCode,
        duration: `${Math.round(duration)}ms`
      });
    }
  });

  next();
}

module.exports = performanceMiddleware;

