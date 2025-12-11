let logger;
try {
  const { getLogger } = require('../utils/loggerHelper');
  logger = getLogger('Security');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[Security]', ...args),
    error: (...args) => console.error('[Security]', ...args),
    info: (...args) => console.log('[Security]', ...args),
    debug: (...args) => console.debug('[Security]', ...args)
  };
}

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
      const existing = suspiciousIPs.get(ip) || { count: 0, timestamp: Date.now() };
      const count = typeof existing === 'number' ? existing : existing.count;
      const newCount = count + 1;
      
      suspiciousIPs.set(ip, { 
        count: newCount, 
        timestamp: typeof existing === 'object' ? existing.timestamp : Date.now() 
      });
      
      logger.error('Suspicious activity detected', {
        ip,
        path: req.path,
        pattern: pattern.toString(),
        count: newCount
      });
      
      if (newCount >= 5) {
        blockedIPs.add(ip);
        logger.error('IP blocked due to suspicious activity', { ip });
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
  for (const [ip, data] of suspiciousIPs.entries()) {
    if (typeof data === 'object' && data.timestamp && now - data.timestamp > 3600000) {
      suspiciousIPs.delete(ip);
    } else if (typeof data === 'number' && data < 3) {
      suspiciousIPs.delete(ip);
    }
  }
}, 3600000);

module.exports = securityMiddleware;

