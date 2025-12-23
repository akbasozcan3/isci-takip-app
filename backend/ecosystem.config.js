/**
 * PM2 Ecosystem Configuration
 * Production deployment için PM2 yapılandırması
 */

module.exports = {
  apps: [{
    name: 'bavaxe-backend',
    script: './server.js',
    instances: 1, // Cluster mode için: 'max' veya sayı
    exec_mode: 'fork', // 'cluster' veya 'fork'
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development',
      PORT: 4000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // Advanced settings
    node_args: '--max-old-space-size=512',
    // Log rotation
    log_type: 'json',
    // Health check
    health_check_grace_period: 3000
  }]
};
