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

function findGoBinary() {
  if (process.platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\Go\\bin\\go.exe',
      'C:\\Go\\bin\\go.exe',
      path.join(process.env.USERPROFILE || '', 'go', 'bin', 'go.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Go', 'bin', 'go.exe')
    ];
    
    for (const goPath of commonPaths) {
      if (fs.existsSync(goPath)) {
        return goPath;
      }
    }
    
    try {
      const { execSync } = require('child_process');
      const result = execSync('where go', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (result.trim()) {
        return result.trim().split('\n')[0];
      }
    } catch (e) {}
  }
  return 'go';
}

function findJavaBinary() {
  if (process.platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Java\\jre-17\\bin\\java.exe',
      'C:\\Program Files (x86)\\Java\\jre-17\\bin\\java.exe'
    ];
    
    for (const javaPath of commonPaths) {
      if (fs.existsSync(javaPath)) {
        return javaPath;
      }
    }
    
    try {
      const { execSync } = require('child_process');
      const result = execSync('where java', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (result.trim()) {
        return result.trim().split('\n')[0];
      }
    } catch (e) {}
  }
  return 'java';
}

function findPhpBinary() {
  return process.platform === 'win32' ? 'php' : 'php';
}

function findMavenBinary() {
  if (process.platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\Apache\\maven\\bin\\mvn.cmd',
      'C:\\apache-maven\\bin\\mvn.cmd',
      path.join(process.env.USERPROFILE || '', 'apache-maven', 'bin', 'mvn.cmd'),
      path.join(process.env.LOCALAPPDATA || '', 'Apache', 'maven', 'bin', 'mvn.cmd')
    ];
    
    for (const mvnPath of commonPaths) {
      if (fs.existsSync(mvnPath)) {
        return mvnPath;
      }
    }
    
    try {
      const { execSync } = require('child_process');
      const result = execSync('where mvn', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (result.trim()) {
        return result.trim().split('\n')[0];
      }
    } catch (e) {}
  }
  return 'mvn';
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
    },
    {
      name: 'python-analytics',
      script: pythonInterpreter,
      cwd: path.join(__dirname, 'python_service'),
      exec_mode: 'fork',
      args: ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
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
        PYTHONUNBUFFERED: '1'
      },
      error_file: path.join(logsDir, 'python-err.log'),
      out_file: path.join(logsDir, 'python-out.log'),
      log_file: path.join(logsDir, 'python-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      ignore_watch: ['node_modules', 'logs', '.git', '__pycache__']
    },
    {
      name: 'go-location',
      script: path.join(__dirname, 'go_service', 'run-go-service.js'),
      cwd: path.join(__dirname, 'go_service'),
      exec_mode: 'fork',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      windowsHide: true,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 3,
      restart_delay: 10000,
      kill_timeout: 5000,
      env: {
        PORT: '8080'
      },
      error_file: path.join(logsDir, 'go-err.log'),
      out_file: path.join(logsDir, 'go-out.log'),
      log_file: path.join(logsDir, 'go-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      ignore_watch: ['node_modules', 'logs', '.git']
    },
    {
      name: 'java-billing',
      script: path.join(__dirname, 'java_service', 'run-java-service.js'),
      cwd: path.join(__dirname, 'java_service'),
      exec_mode: 'fork',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      windowsHide: true,
      max_memory_restart: '1024M',
      min_uptime: '10s',
      max_restarts: 3,
      restart_delay: 10000,
      kill_timeout: 10000,
      env: {
        SERVER_PORT: '7000',
        SPRING_PROFILES_ACTIVE: 'development'
      },
      error_file: path.join(logsDir, 'java-err.log'),
      out_file: path.join(logsDir, 'java-out.log'),
      log_file: path.join(logsDir, 'java-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      ignore_watch: ['node_modules', 'logs', '.git', 'target']
    },
    {
      name: 'php-notifications',
      script: findPhpBinary(),
      cwd: path.join(__dirname, 'php_service'),
      exec_mode: 'fork',
      args: ['artisan', 'serve', '--port=9000', '--host=0.0.0.0'],
      instances: 1,
      autorestart: true,
      watch: false,
      windowsHide: true,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 3,
      restart_delay: 10000,
      kill_timeout: 5000,
      env: {
        APP_ENV: 'local',
        APP_DEBUG: 'true'
      },
      error_file: path.join(logsDir, 'php-err.log'),
      out_file: path.join(logsDir, 'php-out.log'),
      log_file: path.join(logsDir, 'php-combined.log'),
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      ignore_watch: ['node_modules', 'logs', '.git', 'vendor', 'storage']
    },
  ]
};
