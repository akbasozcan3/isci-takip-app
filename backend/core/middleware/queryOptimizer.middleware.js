/**
 * Query Optimizer Middleware
 * Automatically optimizes database queries
 */

const queryOptimizer = require('../utils/queryOptimizer');

function queryOptimizerMiddleware(req, res, next) {
  // Optimize query parameters
  if (req.query) {
    req.optimizedQuery = queryOptimizer.optimizeQuery({
      filter: req.query.filter ? JSON.parse(req.query.filter) : {},
      sort: req.query.sort,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      skip: req.query.skip ? parseInt(req.query.skip, 10) : undefined,
    }, {
      maxResults: 1000,
      defaultLimit: 50,
      enablePagination: true,
    });
  }

  // Add index hints to request
  if (req.optimizedQuery) {
    req.indexHints = queryOptimizer.getIndexHints(req.optimizedQuery);
  }

  next();
}

module.exports = queryOptimizerMiddleware;
