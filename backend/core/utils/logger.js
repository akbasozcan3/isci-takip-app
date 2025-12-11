/**
 * Professional Logger Utility
 * Centralized logging with levels and formatting
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] 
  : (process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG);

class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${metaStr}`;
  }

  error(message, error = null, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.ERROR) {
      const errorMeta = error ? { 
        error: error.message, 
        stack: error.stack,
        ...meta 
      } : meta;
      console.error(this.formatMessage('ERROR', message, errorMeta));
    }
  }

  warn(message, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  info(message, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, meta));
    }
  }
}

// Export singleton instance
const logger = new Logger();

// Export class for custom loggers
module.exports = { Logger, logger };
