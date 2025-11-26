// PM2 Ecosystem Configuration
// Backend servislerini PM2 ile yönetmek için
const path = require('path');
const fs = require('fs');

// Python interpreter path'ini otomatik bul
function findPythonInterpreter() {
  // Önce .venv'i kontrol et
  const venvPath = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPath)) {
    return venvPath;
  }
  
  // Alternatif venv yolları
  const altVenvPaths = [
    path.join(__dirname, '.venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
  ];
  
  for (const altPath of altVenvPaths) {
    if (fs.existsSync(altPath)) {
      return altPath;
    }
  }
  
  // Sistem Python'unu kullan
  return 'python';
}

const pythonInterpreter = findPythonInterpreter();

module.exports = {
  apps: [
    // Node.js Backend API
    {
      name: 'isci-takip-api',
      script: 'server.js',
      cwd: path.join(__dirname),
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        PORT: 4000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: path.join(__dirname, 'logs', 'api-err.log'),
      out_file: path.join(__dirname, 'logs', 'api-out.log'),
      log_file: path.join(__dirname, 'logs', 'api-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    // Python Email Service
    {
      name: 'email-service',
      script: 'email_service.py',
      cwd: path.join(__dirname),
      interpreter: pythonInterpreter,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 10,
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
      error_file: path.join(__dirname, 'logs', 'email-err.log'),
      out_file: path.join(__dirname, 'logs', 'email-out.log'),
      log_file: path.join(__dirname, 'logs', 'email-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
