/**
 * Professional Structured Logging Utility
 * Provides consistent, structured logging across the application
 */

const crypto = require('crypto');

class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  }

  /**
   * Generate unique log ID for tracing
   */
  generateLogId() {
    return crypto.randomBytes(4).toString('hex');
  }

  /**
   * Format log entry
   */
  formatLog(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logId = this.generateLogId();
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      logId,
      message,
      ...data
    };

    // Add request context if available
    if (data.requestId) {
      logEntry.requestId = data.requestId;
    }

    // Add user context if available
    if (data.userId) {
      logEntry.userId = data.userId;
    }

    // Remove sensitive data in production
    if (process.env.NODE_ENV === 'production') {
      delete logEntry.stack;
      if (logEntry.password) delete logEntry.password;
      if (logEntry.token) delete logEntry.token;
      if (logEntry.apiKey) delete logEntry.apiKey;
    }

    return logEntry;
  }

  /**
   * Log debug message
   */
  debug(message, data = {}) {
    if (this.shouldLog('debug')) {
      const logEntry = this.formatLog('debug', message, data);
      console.debug(JSON.stringify(logEntry));
    }
  }

  /**
   * Log info message
   * Supports: info(message), info(message, data)
   */
  info(message, data = {}) {
    if (this.shouldLog('info')) {
      // Handle string-only calls
      const logMessage = typeof message === 'string' ? message : String(message);
      const logData = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data : {};
      const logEntry = this.formatLog('info', logMessage, logData);
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log warning message
   * Supports: warn(message), warn(message, data)
   */
  warn(message, data = {}) {
    if (this.shouldLog('warn')) {
      // Handle string-only calls
      const logMessage = typeof message === 'string' ? message : String(message);
      const logData = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data : {};
      const logEntry = this.formatLog('warn', logMessage, logData);
      console.warn(JSON.stringify(logEntry));
    }
  }

  /**
   * Log error message
   * Supports: error(message), error(message, error), error(message, data)
   */
  error(message, errorOrData = null, data = {}) {
    if (this.shouldLog('error')) {
      // Handle string-only calls
      const logMessage = typeof message === 'string' ? message : String(message);
      let errorObj = null;
      let logData = {};
      
      // Handle second parameter
      if (errorOrData) {
        if (errorOrData instanceof Error || (typeof errorOrData === 'object' && errorOrData.message && errorOrData.stack)) {
          // Second param is an Error object
          errorObj = errorOrData;
          logData = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data : {};
        } else if (typeof errorOrData === 'object' && errorOrData !== null && !Array.isArray(errorOrData)) {
          // Second param is data object
          logData = errorOrData;
        } else if (typeof errorOrData === 'string') {
          // Second param is a string (concatenate with message)
          logData = { additionalInfo: errorOrData };
        }
      }
      
      const logEntry = this.formatLog('error', logMessage, {
        ...logData,
        ...(errorObj && {
          error: {
            message: errorObj.message,
            stack: process.env.NODE_ENV === 'development' ? errorObj.stack : undefined,
            name: errorObj.name,
            code: errorObj.code
          }
        })
      });
      console.error(JSON.stringify(logEntry));
    }
  }

  /**
   * Log API request
   */
  request(req, res, responseTime = null) {
    if (this.shouldLog('info')) {
      const logEntry = this.formatLog('info', 'API Request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: responseTime ? `${responseTime}ms` : null,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId
      });
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log API response
   */
  response(req, res, data = {}) {
    if (this.shouldLog('info')) {
      const logEntry = this.formatLog('info', 'API Response', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ...data,
        requestId: req.requestId
      });
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Check if should log at this level
   */
  shouldLog(level) {
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Create child logger with context
   */
  child(context) {
    return new Logger(`${this.context}:${context}`);
  }
}

// Singleton instance
let defaultLogger = null;

function getLogger(context = 'App') {
  if (!defaultLogger) {
    defaultLogger = new Logger(context);
  }
  return context === 'App' ? defaultLogger : defaultLogger.child(context);
}

// Create default logger instance for backward compatibility
const logger = getLogger('App');

module.exports = {
  Logger,
  getLogger,
  logger // Export default logger instance for backward compatibility
};
