/**
 * Audit Log Middleware
 * Logs all important operations for compliance and debugging
 */

const activityLogService = require('../../services/activityLogService');

function auditLogMiddleware(req, res, next) {
  const startTime = Date.now();
  const userId = req.user?.id;
  const method = req.method;
  const path = req.path;
  
  // Log request
  if (userId && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const auditData = {
      method,
      path,
      query: req.query,
      body: method === 'POST' || method === 'PUT' ? sanitizeBody(req.body) : undefined,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    };
    
    // Log asynchronously (non-blocking)
    setImmediate(() => {
      try {
        activityLogService.logActivity(userId, 'audit', `${method.toLowerCase()}_${path.replace(/\//g, '_')}`, auditData);
      } catch (error) {
        console.warn('[AuditLog] Failed to log activity:', error.message);
      }
    });
  }
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (userId && res.statusCode >= 400) {
      const errorData = {
        statusCode: res.statusCode,
        duration,
        path,
        method
      };
      
      setImmediate(() => {
        try {
          activityLogService.logActivity(userId, 'error', 'api_error', errorData);
        } catch (error) {
          // Non-critical
        }
      });
    }
  });
  
  next();
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'creditCard', 'cvv'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

module.exports = auditLogMiddleware;

