module.exports = {
  apps: [
    // Node.js Backend API
    {
      name: 'isci-takip-api',
      script: 'server.js',
      cwd: './backend',
      exec_mode: 'fork',  // CLUSTER DEĞİL, FORK MODU!
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 4000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: './backend/logs/api-err.log',
      out_file: './backend/logs/api-out.log',
      log_file: './backend/logs/api-combined.log',
      time: true
    },
    // Python Email Service
    {
      name: 'email-service',
      script: 'email_service.py',
      cwd: './backend',
      interpreter: 'C:\\Users\\ozcan\\my-app\\.venv\\Scripts\\python.exe',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        FLASK_ENV: 'development',
        EMAIL_SERVICE_PORT: 5001
      },
      env_production: {
        FLASK_ENV: 'production',
        EMAIL_SERVICE_PORT: 5001
      },
      error_file: './backend/logs/email-err.log',
      out_file: './backend/logs/email-out.log',
      log_file: './backend/logs/email-combined.log',
      time: true
    }
  ]
};
