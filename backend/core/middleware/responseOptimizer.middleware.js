/**
 * Response Optimizer Middleware
 * Automatically optimizes API responses
 */

const responseOptimizer = require('../utils/responseOptimizer');

function responseOptimizerMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Only optimize if response is successful and data exists
    if (res.statusCode < 400 && data) {
      const optimized = responseOptimizer.optimize(data, {
        removeNulls: true,
        removeEmptyArrays: false,
        removeEmptyObjects: false,
      });
      return originalJson(optimized);
    }

    return originalJson(data);
  };

  next();
}

module.exports = responseOptimizerMiddleware;

