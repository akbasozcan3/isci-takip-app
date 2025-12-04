const crypto = require('crypto');

function tracingMiddleware(req, res, next) {
  const traceId = req.headers['x-trace-id'] || crypto.randomBytes(16).toString('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  
  req.traceId = traceId;
  req.spanId = spanId;
  
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Span-Id', spanId);
  res.setHeader('X-Request-Id', req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex'));
  
  next();
}

module.exports = tracingMiddleware;

