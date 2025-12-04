const crypto = require('crypto');

class SecurityService {
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  hashData(data, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.createHash('sha256').update(data + salt).digest('hex');
    return { hash, salt };
  }

  verifyHash(data, hash, salt) {
    const computed = crypto.createHash('sha256').update(data + salt).digest('hex');
    return computed === hash;
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }

  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 6 || password.length > 128) return false;
    return true;
  }

  rateLimitKey(req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    return crypto.createHash('sha256').update(ip + userAgent).digest('hex').substring(0, 16);
  }

  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  verifyCSRFToken(token, sessionToken) {
    return token === sessionToken && token.length === 64;
  }
}

module.exports = new SecurityService();

