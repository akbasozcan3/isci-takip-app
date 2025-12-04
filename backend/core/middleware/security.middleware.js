const { createLogger } = require('../utils/logger');

const logger = createLogger('Security');

const suspiciousPatterns = [
  /\.\./, // Path traversal
  /<script/i, // XSS attempts
  /union.*select/i, // SQL injection
  /exec\(/i, // Code injection
  /eval\(/i, // Code injection
  /javascript:/i, // XSS
  /on\w+\s*=/i // Event handlers
];

const blockedIPs = new Set();
const suspiciousIPs = new Map();

function securityMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || '';
  const path = req.path.toLowerCase();
  const query = JSON.stringify(req.query).toLowerCase();
  const body = JSON.stringify(req.body || {}).toLowerCase();
  
  if (blockedIPs.has(ip)) {
    logger.warn('Blocked IP attempt', { ip, path });
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'IP_BLOCKED'
    });
  }

  const suspiciousContent = path + query + body + userAgent;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(suspiciousContent)) {
      const count = suspiciousIPs.get(ip) || 0;
      suspiciousIPs.set(ip, count + 1);
      
      logger.error('Suspicious activity detected', null, {
        ip,
        path: req.path,
        pattern: pattern.toString(),
        count: count + 1
      });
      
      if (count + 1 >= 5) {
        blockedIPs.add(ip);
        logger.error('IP blocked due to suspicious activity', null, { ip });
        return res.status(403).json({
          success: false,
          error: 'Suspicious activity detected',
          code: 'SUSPICIOUS_ACTIVITY'
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        code: 'INVALID_INPUT'
      });
    }
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamp] of suspiciousIPs.entries()) {
    if (now - timestamp > 3600000) {
      suspiciousIPs.delete(ip);
    }
  }
}, 3600000);

module.exports = securityMiddleware;

