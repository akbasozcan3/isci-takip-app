const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Steps endpoint'leri için özel log
  if (req.path.includes('/steps/')) {
    console.log(`\n🔵 [REQUEST LOGGER] ${req.method} ${req.path}`);
    console.log(`🔵 [REQUEST LOGGER] IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`🔵 [REQUEST LOGGER] User-Agent: ${req.get('user-agent') || 'unknown'}`);
    console.log(`🔵 [REQUEST LOGGER] Headers:`, JSON.stringify(req.headers, null, 2));
  }
  
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
    
    // Steps endpoint'leri için özel log
    if (req.path.includes('/steps/')) {
      console.log(`🔵 [REQUEST LOGGER] Response: ${res.statusCode} in ${duration}ms`);
    }
    
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

