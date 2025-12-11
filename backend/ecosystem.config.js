const path = require('path');
const fs = require('fs');

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
      node_args: '--max-old-space-size=2048 --expose-gc',
      kill_timeout: 10000,
      wait_ready: false,
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
    }
  ]
};
