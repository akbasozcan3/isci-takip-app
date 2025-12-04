const path = require('path');
const fs = require('fs');

function findPythonInterpreter() {
  const roots = [path.join(__dirname, '..'), __dirname, process.cwd()];
  const folders = ['.venv', 'venv'];
  const binaries = process.platform === 'win32'
    ? [['Scripts', 'python.exe']]
    : [['bin', 'python3'], ['bin', 'python']];

  for (const root of roots) {
    for (const folder of folders) {
      for (const bin of binaries) {
        const candidate = path.join(root, folder, ...bin);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }

  return process.platform === 'win32' ? 'py' : 'python3';
}

const pythonInterpreter = findPythonInterpreter();

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = {
  apps: [
    {
      name: 'isci-takip-api',
      script: 'server.js',
      cwd: path.join(__dirname),
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      windowsHide: true,
      interpreter: 'node',
      max_memory_restart: '2000M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX_REQUESTS: 100
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX_REQUESTS: 200
      },
      error_file: path.join(logsDir, 'api-err.log'),
      out_file: path.join(logsDir, 'api-out.log'),
      log_file: path.join(logsDir, 'api-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      ignore_watch: ['node_modules', 'logs', '.git']
    },
    {
      name: 'email-service',
      script: process.platform === 'win32' ? 'start-python-hidden.js' : 'email_service.py',
      args: process.platform === 'win32' ? ['email_service.py'] : [],
      cwd: path.join(__dirname),
      exec_mode: 'fork',
      interpreter: process.platform === 'win32' ? 'node' : pythonInterpreter,
      instances: 1,
      autorestart: true,
      watch: false,
      windowsHide: true,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      env: {
        FLASK_ENV: 'development',
        EMAIL_SERVICE_PORT: 5001,
        PYTHONUNBUFFERED: '1'
      },
      env_production: {
        FLASK_ENV: 'production',
        EMAIL_SERVICE_PORT: 5001,
        PYTHONUNBUFFERED: '1'
      },
      error_file: path.join(logsDir, 'email-err.log'),
      out_file: path.join(logsDir, 'email-out.log'),
      log_file: path.join(logsDir, 'email-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
