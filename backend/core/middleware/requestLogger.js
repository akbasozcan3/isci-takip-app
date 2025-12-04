const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown'
    };
    
    const logLine = `${timestamp} [${logEntry.method}] ${logEntry.path} ${logEntry.status} ${logEntry.duration} - ${logEntry.ip}\n`;
    
    if (process.env.NODE_ENV === 'production') {
      const logFile = path.join(LOG_DIR, `access-${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, logLine, 'utf8');
    } else {
      console.log(logLine.trim());
    }
  });
  
  next();
}

module.exports = requestLogger;

