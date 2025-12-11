/**
 * Request ID Middleware
 * Generates unique request IDs for tracing
 */

const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
  // Generate unique request ID
  const requestId = req.headers['x-request-id'] || 
                   req.headers['x-correlation-id'] ||
                   `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', requestId);
  
  next();
}

module.exports = requestIdMiddleware;

