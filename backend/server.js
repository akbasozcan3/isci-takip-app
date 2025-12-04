const path = require('path');
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  try { 
    require('dotenv').config(); 
  } catch (_) {}
}

// Import routes and services
const routes = require('./routes');
const db = require('./config/database');
const metricsService = require('./services/metricsService');
const cacheService = require('./services/cacheService');

class ServerApp {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.port = process.env.PORT || 4000;
    
    // Validate required environment variables
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: JWT_SECRET not set! Using fallback secret in production.');
    }
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupErrorHandling();
    this.setupBackgroundJobs();
  }

  setupMiddleware() {
    this.app.set('trust proxy', 1);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [];
    
    // CORS middleware - production'da sadece izin verilen origin'ler
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      
      if (isProduction && allowedOrigins.length > 0) {
        if (origin && allowedOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
          res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      if (isProduction && process.env.ENABLE_HSTS === 'true') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      res.setHeader('X-Powered-By', 'Bavaxe GPS Tracking');
      next();
    });

    const requestLogger = require('./core/middleware/requestLogger');
    this.app.use(requestLogger);

    const rateLimiter = require('./core/middleware/rateLimiter');
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
    this.app.use('/api', rateLimiter(windowMs, maxRequests));
    
    console.log('[Server] Plan-based rate limiting enabled');
    console.log('[Server] Free: 50 req/min, Plus: 200 req/min, Business: 500 req/min');
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Bavaxe GPS Tracking API',
        version: '2.0.0',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          location: '/api/location/*',
          devices: '/api/devices',
          analytics: '/api/analytics/*'
        }
      });
    });
    
    this.app.use('/api', routes);
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      socket.on('join-device', (deviceId) => {
        socket.join(`device-${deviceId}`);
        console.log(`Socket ${socket.id} joined device room: ${deviceId}`);
      });

      socket.on('join_group', (groupId) => {
        socket.join(`group-${groupId}`);
        console.log(`Socket ${socket.id} joined group: ${groupId}`);
      });
      
      socket.on('location-update', (data) => {
        const { deviceId, coords, timestamp, workerId } = data;
        const finalDeviceId = deviceId || workerId;
        
        if (finalDeviceId && coords && coords.latitude !== undefined && coords.longitude !== undefined) {
          const lat = parseFloat(coords.latitude);
          const lng = parseFloat(coords.longitude);

          if (!Number.isFinite(lat) || !Number.isFinite(lng) || 
              lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return;
          }

          const locationBatchService = require('./services/locationBatchService');
          locationBatchService.addToBatch(finalDeviceId, {
            timestamp: timestamp || Date.now(),
            coords: {
              latitude: lat,
              longitude: lng,
              accuracy: coords.accuracy ? parseFloat(coords.accuracy) : null,
              heading: coords.heading ? parseFloat(coords.heading) : null,
              speed: coords.speed ? parseFloat(coords.speed) : null
            }
          });

          socket.to(`device-${finalDeviceId}`).emit('location-updated', {
            deviceId: finalDeviceId,
            coords: {
              latitude: lat,
              longitude: lng,
              accuracy: coords.accuracy ? parseFloat(coords.accuracy) : null,
              heading: coords.heading ? parseFloat(coords.heading) : null,
              speed: coords.speed ? parseFloat(coords.speed) : null
            },
            timestamp: timestamp || Date.now()
          });
        }
      });
      socket.on('group_location_update', (data) => {
        const { userId, groupId, lat, lng, heading, accuracy, timestamp } = data;
        
        if (userId && groupId && lat !== undefined && lng !== undefined) {
          const latitude = parseFloat(lat);
          const longitude = parseFloat(lng);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || 
              latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return;
          }

          const locationBatchService = require('./services/locationBatchService');
          locationBatchService.addToBatch(userId, {
            timestamp: timestamp || Date.now(),
            coords: {
              latitude,
              longitude,
              accuracy: accuracy ? parseFloat(accuracy) : null,
              heading: heading ? parseFloat(heading) : null,
              speed: null
            }
          });

          this.io.to(`group-${groupId}`).emit('location_update', {
            groupId,
            userId,
            lat: latitude,
            lng: longitude,
            heading: heading ? parseFloat(heading) : null,
            accuracy: accuracy ? parseFloat(accuracy) : null,
            timestamp: timestamp || Date.now()
          });
        }
      });
      
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  setupErrorHandling() {
    const { handleError } = require('./core/utils/errorHandler');
    this.app.use(handleError);

    this.shutdownHandlers = [];
    this.isShuttingDown = false;

    const gracefulShutdown = async (signal) => {
      if (this.isShuttingDown) {
        console.log(`[${signal}] Shutdown already in progress, forcing exit...`);
        process.exit(1);
      }

      this.isShuttingDown = true;
      console.log(`\n[${signal}] Graceful shutdown initiated...`);

      const shutdownTimeout = setTimeout(() => {
        console.error('[SHUTDOWN] Forced shutdown after timeout');
        process.exit(1);
      }, 30000);

      try {
        console.log('[SHUTDOWN] Closing HTTP server...');
        await new Promise((resolve, reject) => {
          this.server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        console.log('[SHUTDOWN] Closing Socket.IO server...');
        this.io.close();

        console.log('[SHUTDOWN] Running shutdown handlers...');
        for (const handler of this.shutdownHandlers) {
          try {
            await handler();
          } catch (err) {
            console.error('[SHUTDOWN] Handler error:', err);
          }
        }

        console.log('[SHUTDOWN] Saving database...');
        const db = require('./config/database');
        if (db.save && typeof db.save === 'function') {
          db.save();
        }

        clearTimeout(shutdownTimeout);
        console.log('[SHUTDOWN] ✅ Graceful shutdown completed');
        process.exit(0);
      } catch (err) {
        console.error('[SHUTDOWN] Error during shutdown:', err);
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      console.error('[FATAL] Uncaught Exception:', err.message);
      console.error('[FATAL] Stack:', err.stack);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  }

  setupBackgroundJobs() {
  }

  addShutdownHandler(handler) {
    this.shutdownHandlers.push(handler);
  }

  async start() {
    try {
      await this.validateEnvironment();
      
      this.server.listen(this.port, '0.0.0.0', () => {
        const memUsage = process.memoryUsage();
        metricsService.updateMemory();
        
        const startTime = Date.now();
        
        console.log('\n' + '='.repeat(60));
        console.log('🚀  BAVAXE GPS TRACKING API - SERVER STARTED');
        console.log('='.repeat(60));
        console.log(`📡 Port: ${this.port}`);
        console.log(`🌐 Local: http://localhost:${this.port}/api`);
        console.log(`🌐 Network: http://0.0.0.0:${this.port}/api`);
        console.log(`📱 Android Emulator: http://10.0.2.2:${this.port}/api`);
        console.log(`🔌 Socket.IO: Active`);
        console.log(`📊 Database: ${Object.keys(db.data.users).length} users`);
        console.log(`💾 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⚡ Cache: Active`);
        console.log(`📈 Metrics: Active`);
        console.log(`⏱️  Startup Time: ${Date.now() - startTime}ms`);
        
        if (process.env.NODE_ENV === 'production') {
          console.log(`✅ Production Mode: Enabled`);
        }
        
        console.log('='.repeat(60) + '\n');

        const metricsInterval = setInterval(() => {
          metricsService.updateMemory();
        }, 30000);

        this.addShutdownHandler(async () => {
          clearInterval(metricsInterval);
        });

        if (process.send) {
          process.send('ready');
        }
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`\n❌ ERROR: Port ${this.port} is already in use`);
          console.error(`   Attempting to find and stop conflicting process...\n`);
          
          const { execSync } = require('child_process');
          try {
            if (process.platform === 'win32') {
              const netstat = execSync(`netstat -ano | findstr :${this.port}`, { encoding: 'utf-8' });
              const match = netstat.match(/LISTENING\s+(\d+)/);
              if (match) {
                const pid = match[1];
                console.log(`   Found process ${pid}, stopping...`);
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                console.log(`   Process stopped. Retrying in 2 seconds...\n`);
                setTimeout(() => {
                  this.server.listen(this.port, '0.0.0.0');
                }, 2000);
                return;
              }
            }
          } catch (e) {
            console.error(`   Could not auto-resolve port conflict. Please stop process manually.\n`);
          }
          process.exit(1);
        } else {
          console.error('\n❌ FATAL: Server error:', err);
          process.exit(1);
        }
      });
    } catch (error) {
      console.error('\n❌ FATAL: Failed to start server:', error);
      process.exit(1);
    }
  }

  validateEnvironment() {
    const required = ['JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0 && process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    if (missing.length > 0) {
      console.warn(`⚠️  WARNING: Missing environment variables: ${missing.join(', ')}`);
      console.warn(`   Using fallback values. Set these in production!\n`);
    }

    return true;
  }
}

// Start server
const serverApp = new ServerApp();
serverApp.start();

module.exports = serverApp;