/**
 * Professional Logging Utility
 * Centralized logging with levels and structured output
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    };
    this.currentLevel = isDevelopment ? this.levels.DEBUG : this.levels.INFO;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  error(message, meta = {}) {
    if (this.currentLevel >= this.levels.ERROR) {
      console.error(this.formatMessage('ERROR', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.currentLevel >= this.levels.WARN) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.currentLevel >= this.levels.INFO) {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.currentLevel >= this.levels.DEBUG && isDevelopment) {
      console.log(this.formatMessage('DEBUG', message, meta));
    }
  }

  // Specialized logging methods
  request(req, res, responseTime) {
    const meta = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    
    if (res.statusCode >= 500) {
      this.error(`Request failed: ${req.method} ${req.path}`, meta);
    } else if (res.statusCode >= 400) {
      this.warn(`Request warning: ${req.method} ${req.path}`, meta);
    } else {
      this.info(`Request: ${req.method} ${req.path}`, meta);
    }
  }

  auth(action, userId, success, meta = {}) {
    const message = `Auth ${action}: ${success ? 'SUCCESS' : 'FAILED'}`;
    const authMeta = {
      userId,
      action,
      success,
      ...meta,
    };
    
    if (success) {
      this.info(message, authMeta);
    } else {
      this.warn(message, authMeta);
    }
  }

  database(operation, success, meta = {}) {
    const message = `Database ${operation}: ${success ? 'SUCCESS' : 'FAILED'}`;
    const dbMeta = {
      operation,
      success,
      ...meta,
    };
    
    if (success) {
      this.debug(message, dbMeta);
    } else {
      this.error(message, dbMeta);
    }
  }

  email(action, email, success, meta = {}) {
    const message = `Email ${action}: ${success ? 'SUCCESS' : 'FAILED'}`;
    const emailMeta = {
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
      action,
      success,
      ...meta,
    };
    
    if (success) {
      this.info(message, emailMeta);
    } else {
      this.warn(message, emailMeta);
    }
  }

  performance(operation, duration, meta = {}) {
    if (duration > 1000) {
      this.warn(`Slow operation: ${operation}`, { duration: `${duration}ms`, ...meta });
    } else {
      this.debug(`Performance: ${operation}`, { duration: `${duration}ms`, ...meta });
    }
  }
}

const logger = new Logger();

module.exports = logger;
module.exports.getLogger = (name) => ({
  info: (...args) => logger.info(`[${name}]`, ...args),
  warn: (...args) => logger.warn(`[${name}]`, ...args),
  error: (...args) => logger.error(`[${name}]`, ...args),
  debug: (...args) => logger.debug(`[${name}]`, ...args),
});
