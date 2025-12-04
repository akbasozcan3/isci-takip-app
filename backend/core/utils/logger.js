const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      pid: process.pid,
      ...data
    };

    if (process.env.NODE_ENV === 'production') {
      const logFile = path.join(LOG_DIR, `${level.toLowerCase()}-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      try {
        fs.appendFileSync(logFile, logLine, 'utf8');
      } catch (err) {
        console.error('Failed to write log:', err);
      }
    }

    return logEntry;
  }

  info(message, data = {}) {
    const entry = this.formatMessage('INFO', message, data);
    console.log(`[${entry.timestamp}] [${this.context}] ${message}`, data && Object.keys(data).length > 0 ? data : '');
  }

  error(message, error = null, data = {}) {
    const entry = this.formatMessage('ERROR', message, {
      ...data,
      ...(error && {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    });
    console.error(`[${entry.timestamp}] [${this.context}] ${message}`, error || data);
  }

  warn(message, data = {}) {
    const entry = this.formatMessage('WARN', message, data);
    console.warn(`[${entry.timestamp}] [${this.context}] ${message}`, data && Object.keys(data).length > 0 ? data : '');
  }

  debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      const entry = this.formatMessage('DEBUG', message, data);
      console.debug(`[${entry.timestamp}] [${this.context}] ${message}`, data && Object.keys(data).length > 0 ? data : '');
    }
  }
}

function createLogger(context) {
  return new Logger(context);
}

module.exports = {
  Logger,
  createLogger,
  default: new Logger('App')
};

