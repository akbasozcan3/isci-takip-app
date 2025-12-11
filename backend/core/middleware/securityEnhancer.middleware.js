/**
 * Professional Security Enhancer Middleware
 * Advanced security features for API protection
 */

const crypto = require('crypto');

class SecurityEnhancer {
  constructor() {
    this.suspiciousIPs = new Map();
    this.failedAttempts = new Map();
    this.blockedIPs = new Set();
    this.maxFailedAttempts = 5;
    this.blockDuration = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Check if IP is blocked
   */
  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  /**
   * Record failed attempt
   */
  recordFailedAttempt(ip, reason = 'unknown') {
    const key = `${ip}-${reason}`;
    const attempts = this.failedAttempts.get(key) || 0;
    this.failedAttempts.set(key, attempts + 1);

    if (attempts + 1 >= this.maxFailedAttempts) {
      this.blockIP(ip);
      return true; // IP is now blocked
    }
    return false;
  }

  /**
   * Block IP address
   */
  blockIP(ip) {
    this.blockedIPs.add(ip);
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      this.failedAttempts.delete(ip);
    }, this.blockDuration);
  }

  /**
   * Check for SQL injection patterns
   */
  detectSQLInjection(input) {
    if (typeof input !== 'string') return false;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|#|\/\*|\*\/|;)/,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\bUNION\s+SELECT\b)/i,
      /(\b(SELECT|INSERT|UPDATE|DELETE)\s+.*\bFROM\b)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for XSS patterns
   */
  detectXSS(input) {
    if (typeof input !== 'string') return false;
    
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[^>]*=.*javascript:/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  /**
   * Generate secure token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate request origin
   */
  validateOrigin(origin, allowedOrigins) {
    if (!origin) return false;
    if (allowedOrigins.includes('*')) return true;
    return allowedOrigins.includes(origin);
  }

  /**
   * Get security stats
   */
  getStats() {
    return {
      blockedIPs: this.blockedIPs.size,
      suspiciousIPs: this.suspiciousIPs.size,
      failedAttempts: this.failedAttempts.size
    };
  }
}

const securityEnhancer = new SecurityEnhancer();

/**
 * Security enhancer middleware
 */
function securityEnhancerMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  // Check if IP is blocked
  if (securityEnhancer.isBlocked(ip)) {
    return res.status(403).json({
      success: false,
      error: 'IP address is temporarily blocked due to suspicious activity',
      code: 'IP_BLOCKED',
      timestamp: new Date().toISOString()
    });
  }

  // Check request body for malicious patterns
  if (req.body) {
    const bodyString = JSON.stringify(req.body);
    
    if (securityEnhancer.detectSQLInjection(bodyString)) {
      securityEnhancer.recordFailedAttempt(ip, 'sql_injection');
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString()
      });
    }

    if (securityEnhancer.detectXSS(bodyString)) {
      securityEnhancer.recordFailedAttempt(ip, 'xss');
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString()
      });
    }

    // Sanitize request body (only if it's a string)
    if (typeof req.body === 'string') {
      req.body = securityEnhancer.sanitizeInput(req.body);
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        // If parsing fails, keep original body
      }
    } else if (typeof req.body === 'object' && req.body !== null) {
      // Recursively sanitize object properties
      const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
          return securityEnhancer.sanitizeInput(obj);
        } else if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        } else if (typeof obj === 'object' && obj !== null) {
          const sanitized = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
          }
          return sanitized;
        }
        return obj;
      };
      req.body = sanitizeObject(req.body);
    }
  }

  // Check query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        if (securityEnhancer.detectSQLInjection(value) || securityEnhancer.detectXSS(value)) {
          securityEnhancer.recordFailedAttempt(ip, 'malicious_query');
          return res.status(400).json({
            success: false,
            error: 'Invalid query parameters',
            code: 'INVALID_QUERY',
            timestamp: new Date().toISOString()
          });
        }
        req.query[key] = securityEnhancer.sanitizeInput(value);
      }
    }
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

module.exports = securityEnhancerMiddleware;
module.exports.SecurityEnhancer = SecurityEnhancer;

