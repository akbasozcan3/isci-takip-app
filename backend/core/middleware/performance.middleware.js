const performanceService = require('../services/performance.service');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Performance');

function performanceMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  performanceService.recordRequestStart();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    performanceService.recordRequestEnd();

    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${Math.round(duration)}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id
      });
    }

    if (res.statusCode >= 500) {
      logger.error('Server error', null, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${Math.round(duration)}ms`
      });
    }
  });

  next();
}

module.exports = performanceMiddleware;

