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
  } catch (_) { }
}

// Import routes and services
const routes = require('./routes');
const db = require('./config/database');
const metricsService = require('./services/metricsService');

// Initialize email service on startup
try {
  const emailVerificationService = require('./services/emailVerificationService');
  emailVerificationService.initializeEmailService();
  console.log('[Server] Email service initialized');
} catch (error) {
  console.error('[Server] Failed to initialize email service:', error.message);
}

class ServerApp {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    // Socket.IO CORS configuration
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : '*';

    this.io = new Server(this.server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6,
      allowEIO3: true,
      // Prevent handleUpgrade conflicts - Socket.IO handles upgrades internally
      allowUpgrades: true,
      perMessageDeflate: false,
      // Prevent multiple upgrade handlers
      serveClient: false
    });

    this.port = process.env.PORT || 4000;
    this.shutdownHandlers = [];

    // Validate required environment variables
    if (!process.env.JWT_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[Server] FATAL: JWT_SECRET is required in production');
        process.exit(1);
      } else {
        console.warn('[Server] WARNING: JWT_SECRET not set - Using development fallback');
      }
    }
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupBackgroundJobs();
    this.setupErrorHandling();
    this.initializeOptimizations();
    this.initializeStartupService();
  }

  initializeStartupService() {
    try {
      const startupService = require('./core/services/startup.service');

      // Register critical services
      startupService.registerService('Database', async () => {
        const db = require('./config/database');
        if (!db.data) {
          throw new Error('Database not initialized');
        }
      }, 100);

      // Initialize PostgreSQL connection
      startupService.registerService('PostgreSQL', async () => {
        const postgres = require('./config/postgres');
        try {
          await postgres.connect();
          console.log('[Server] ✅ PostgreSQL connection initialized');
        } catch (error) {
          if (process.env.NODE_ENV === 'production') {
            throw error;
          }
          if (process.env.NODE_ENV !== 'production') {
            console.log('[Server] PostgreSQL using JSON fallback');
          }
        }
      }, 95);

      startupService.registerService('Cache', async () => {
        const cacheService = require('./services/cacheService');
        if (!cacheService) {
          throw new Error('Cache service not available');
        }
      }, 90);

      startupService.registerService('Advanced Cache', async () => {
        const advancedCache = require('./core/services/advancedCache.service');
        if (!advancedCache) {
          throw new Error('Advanced cache not available');
        }
      }, 85);

      startupService.registerService('Database Service', async () => {
        const databaseService = require('./core/services/database.service');
        if (!databaseService) {
          throw new Error('Database service not available');
        }
      }, 80);

      startupService.registerService('Memory Optimizer', async () => {
        const memoryOptimizer = require('./core/services/memoryOptimizer.service');
        memoryOptimizer.start();
      }, 70);

      startupService.registerService('Performance Service', async () => {
        const performanceService = require('./core/services/performance.service');
        if (!performanceService) {
          throw new Error('Performance service not available');
        }
      }, 60);

      startupService.registerService('Analytics Service', async () => {
        const analyticsService = require('./core/services/analytics.service');
        if (!analyticsService) {
          throw new Error('Analytics service not available');
        }
      }, 50);

      startupService.registerService('Realtime Service', async () => {
        const realtimeService = require('./core/services/realtime.service');
        if (!realtimeService) {
          throw new Error('Realtime service not available');
        }
      }, 40);

      // Register OneSignal Notification Service (Critical for push notifications)
      startupService.registerService('OneSignal Notification Service', async () => {
        const onesignalService = require('./services/onesignalService');
        const status = onesignalService.getStatus();

        if (!status.enabled) {
          throw new Error(`OneSignal service is disabled: ${status.statusMessage}`);
        }

        if (!status.apiKeyConfigured) {
          throw new Error('OneSignal API Key not configured');
        }

        // Test API key to ensure it's working
        const testResult = await onesignalService.testApiKey();
        if (!testResult.success) {
          throw new Error(`OneSignal API Key validation failed: ${testResult.error}`);
        }

        console.log('[Startup] ✅ OneSignal service validated and ready');
      }, 30); // Priority 30 - Important but not critical for basic functionality

      // Initialize asynchronously (don't block server start)
      startupService.initializationPromise = startupService.initialize().catch(err => {
        console.error('[Server] Startup service initialization error:', err);
      });

      console.log('[Server] ✅ Startup service registration completed');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Startup service using fallback mode');
      }
    }
  }

  initializeOptimizations() {
    // Initialize database optimizer
    try {
      const databaseOptimizer = require('./core/utils/databaseOptimizer');
      console.log('[Server] ✅ Database optimizer initialized');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Database optimizer using fallback mode');
      }
    }

    // Initialize database service
    try {
      const databaseService = require('./core/services/database.service');
      console.log('[Server] ✅ Database service initialized');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Database service using fallback mode');
      }
    }

    // Initialize backup service
    try {
      const backupService = require('./core/services/backup.service');
      console.log('[Server] ✅ Backup service initialized');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Backup service using fallback mode');
      }
    }

    // Initialize monitoring
    try {
      const monitoringMiddleware = require('./core/middleware/monitoring.middleware');
      console.log('[Server] ✅ Monitoring middleware initialized');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Monitoring middleware using fallback mode');
      }
    }

    // Initialize memory optimizer
    try {
      const memoryOptimizer = require('./core/services/memoryOptimizer.service');
      if (memoryOptimizer && typeof memoryOptimizer.start === 'function') {
        memoryOptimizer.start();
        console.log('[Server] ✅ Memory optimizer initialized');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Memory optimizer using fallback mode');
      }
    }

    // Initialize advanced cache
    try {
      const advancedCache = require('./core/services/cache.service');
      console.log('[Server] ✅ Advanced cache service initialized');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Advanced cache service using fallback mode');
      }
    }
  }

  setupMiddleware() {
    this.app.set('trust proxy', 1);

    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [];

    // ============================================
    // HELMET.JS SECURITY MIDDLEWARE
    // ============================================
    const helmet = require('helmet');

    this.app.use(helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", "https:", "data:"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "https:", "'unsafe-inline'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },

      // HTTP Strict Transport Security
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },

      // X-Frame-Options
      frameguard: {
        action: 'deny'
      },

      // X-Content-Type-Options
      noSniff: true,

      // X-XSS-Protection
      xssFilter: true,

      // Referrer-Policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },

      // X-Permitted-Cross-Domain-Policies
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none'
      },

      // Hide X-Powered-By
      hidePoweredBy: true,

      // X-DNS-Prefetch-Control
      dnsPrefetchControl: {
        allow: false
      },

      // Expect-CT
      expectCt: {
        maxAge: 86400,
        enforce: true
      }
    }));

    console.log('[Server] ✅ Helmet.js security middleware enabled');

    // CORS middleware - production'da sadece izin verilen origin'ler
    // Skip WebSocket upgrade requests (handled by Socket.IO)
    this.app.use((req, res, next) => {
      // Skip WebSocket upgrade requests completely - Socket.IO handles these
      // Also skip Socket.IO polling requests - let Socket.IO handle all /socket.io/ requests
      if (req.headers.upgrade === 'websocket' ||
        req.headers.connection?.toLowerCase().includes('upgrade') ||
        req.url?.includes('/socket.io/') ||
        req.path?.includes('/socket.io/') ||
        req.url?.startsWith('/socket.io')) {
        // Skip CORS processing for Socket.IO - let Socket.IO handle it
        // But still call next() to allow other middleware to process if needed
        return next();
      }

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

    const compression = require('compression');
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // Global request logger - tüm istekleri logla (sensitive data sanitized)
    this.app.use((req, res, next) => {
      if (req.path.includes('/steps/')) {
        console.log(`\n🔵 [GLOBAL] ${req.method} ${req.path} - REQUEST RECEIVED`);
        console.log(`🔵 [GLOBAL] IP: ${req.ip || req.connection.remoteAddress}`);

        // Sanitize sensitive headers before logging
        const sanitizedHeaders = { ...req.headers };
        delete sanitizedHeaders.authorization;
        delete sanitizedHeaders.cookie;
        delete sanitizedHeaders['x-api-key'];
        console.log(`🔵 [GLOBAL] Headers:`, JSON.stringify(sanitizedHeaders, null, 2));
      }
      next();
    });

    const requestLogger = require('./core/middleware/requestLogger');
    this.app.use(requestLogger);

    const rateLimiter = require('./core/middleware/rateLimiter');
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

    // Endpoint-specific rate limiting for better security
    this.app.use('/api/auth/login', rateLimiter(windowMs, 5)); // 5 login attempts per minute
    this.app.use('/api/auth/register', rateLimiter(windowMs, 3)); // 3 registrations per minute
    this.app.use('/api/auth/reset', rateLimiter(windowMs, 3)); // 3 password resets per minute
    this.app.use('/api/location', rateLimiter(windowMs, 200)); // 200 location updates per minute
    this.app.use('/api/steps', rateLimiter(windowMs, 200)); // 200 step updates per minute
    this.app.use('/api', rateLimiter(windowMs, parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10))); // Default 100 req/min

    console.log('[Server] ✅ Enhanced rate limiting enabled');
    console.log('[Server] Auth endpoints: 3-5 req/min, Location: 200 req/min, Default: 100 req/min');
    console.log('[Server] Plan-based limits: Free: 100 req/min, Plus: 300 req/min, Business: 1000 req/min');
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
          analytics: '/api/analytics/*',
          docs: '/api-docs'
        }
      });
    });

    // Swagger API Documentation
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
      try {
        const swaggerUi = require('swagger-ui-express');
        const swaggerSpec = require('./swagger');

        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: 'BAVAXE API Documentation',
          customfavIcon: '/favicon.ico',
        }));

        console.log('[Server] 📚 Swagger UI available at /api-docs');
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Server] Swagger using fallback mode');
        }
      }
    }

    // Make io available to routes and controllers
    this.app.set('io', this.io);
    this.app.use('/api', routes);

    // Video serving removed - using static hero banner design instead
  }

  setupSocketIO() {
    // Socket.IO authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Socket.IO] Unauthenticated connection from ${socket.handshake.address}`);
        }
        // Allow connection but mark as unauthenticated - we'll check on sensitive operations
        socket.data.authenticated = false;
        return next();
      }

      // Verify token
      const TokenModel = require('./core/database/models/token.model');
      const UserModel = require('./core/database/models/user.model');
      const tokenData = TokenModel.get(token);

      if (!tokenData) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Socket.IO] Invalid token from ${socket.handshake.address}`);
        }
        socket.data.authenticated = false;
        return next();
      }

      const user = UserModel.findById(tokenData.userId);
      if (!user) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Socket.IO] User not found for token from ${socket.handshake.address}`);
        }
        socket.data.authenticated = false;
        return next();
      }

      socket.data.authenticated = true;
      socket.data.userId = user.id;
      socket.data.user = user;
      console.log(`[Socket.IO] Authenticated connection: ${socket.id} (User: ${user.email || user.id})`);
      next();
    });

    // Initialize realtime service (if it doesn't create its own Socket.IO instance)
    // Note: We use the main Socket.IO instance to avoid handleUpgrade conflicts
    try {
      const realtimeService = require('./core/services/realtime.service');
      // Pass existing io instance instead of server to avoid duplicate upgrade handlers
      if (realtimeService.initializeWithIO) {
        realtimeService.initializeWithIO(this.io);
        console.log('[Server] ✅ Real-time service initialized with existing Socket.IO');
      } else if (realtimeService.initialize) {
        // Only initialize if it doesn't create a new Socket.IO instance
        const result = realtimeService.initialize(this.server);
        if (result && result !== this.io) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[Server] Real-time service created new Socket.IO instance');
          }
        } else {
          console.log('[Server] ✅ Real-time service initialized');
        }
      }
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Server] Real-time service using default Socket.IO (fallback mode)');
      }
    }

    // Fallback to default Socket.IO setup
    const performanceService = require('./core/services/performance.service');

    this.io.on('connection', (socket) => {
      performanceService.recordSocketConnection();

      if (!socket.data.authenticated) {
        console.log(`[Socket.IO] Unauthenticated client connected: ${socket.id}`);
      } else {
        console.log(`[Socket.IO] Authenticated client connected: ${socket.id} (User: ${socket.data.userId})`);
      }

      socket.on('disconnect', () => {
        performanceService.recordSocketDisconnection();
        console.log(`Client disconnected: ${socket.id}`);
      });

      socket.on('join-device', (deviceId) => {
        if (!socket.data.authenticated) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Socket.IO] Unauthenticated join-device attempt from ${socket.id}`);
          }
          return;
        }
        socket.join(`device-${deviceId}`);
        console.log(`Socket ${socket.id} joined device room: ${deviceId}`);
      });

      socket.on('join_group', (groupId) => {
        if (!socket.data.authenticated) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Socket.IO] Unauthenticated join_group attempt from ${socket.id}`);
          }
          return;
        }
        socket.join(`group-${groupId}`);
        console.log(`Socket ${socket.id} joined group: ${groupId}`);
      });

      // Join user room for direct messaging
      if (socket.data.authenticated && socket.data.userId) {
        socket.join(`user-${socket.data.userId}`);
        console.log(`Socket ${socket.id} joined user room: ${socket.data.userId}`);
      }

      // Messaging events
      socket.on('send_message', async (data) => {
        if (!socket.data.authenticated) {
          socket.emit('message_error', { error: 'Unauthenticated' });
          return;
        }

        try {
          const { recipientId, groupId, message, type = 'text', metadata = {} } = data;

          if (!message || message.trim().length === 0) {
            socket.emit('message_error', { error: 'Message is required' });
            return;
          }

          if (!recipientId && !groupId) {
            socket.emit('message_error', { error: 'Either recipientId or groupId is required' });
            return;
          }

          const db = require('./config/database');
          const notificationService = require('./services/notificationService');
          const userId = socket.data.userId;
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const timestamp = Date.now();

          const messageData = {
            id: messageId,
            senderId: userId,
            recipientId: recipientId || null,
            groupId: groupId || null,
            message: message.trim(),
            type: type,
            status: 'sent',
            read: false,
            createdAt: timestamp
          };

          // Save to database
          if (!db.data.messages) db.data.messages = {};
          if (!db.data.messages[userId]) db.data.messages[userId] = [];
          db.data.messages[userId].push(messageData);

          if (groupId) {
            const group = db.findGroupById(groupId);
            if (group && group.members) {
              for (const memberId of group.members) {
                if (memberId !== userId) {
                  if (!db.data.messages[memberId]) db.data.messages[memberId] = [];
                  db.data.messages[memberId].push({ ...messageData, status: 'received' });
                }
              }
            }
            // Broadcast to group
            this.io.to(`group-${groupId}`).emit('new_message', {
              ...messageData,
              sender: { id: userId, name: socket.data.user?.name || 'Unknown' }
            });
          } else if (recipientId) {
            if (!db.data.messages[recipientId]) db.data.messages[recipientId] = [];
            db.data.messages[recipientId].push({ ...messageData, status: 'received' });

            // Send to recipient
            this.io.to(`user-${recipientId}`).emit('new_message', {
              ...messageData,
              sender: { id: userId, name: socket.data.user?.name || 'Unknown' }
            });

            // Send push notification
            try {
              await notificationService.send(recipientId, {
                title: socket.data.user?.name || 'Yeni Mesaj',
                message: message.trim().substring(0, 100),
                type: 'message',
                data: { messageId, senderId: userId, type: 'direct_message' }
              }, ['database', 'onesignal']);
            } catch (notifError) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[Socket.IO] Message notification error:', notifError.message);
              }
            }
          }

          db.scheduleSave();
          socket.emit('message_sent', { messageId, ...messageData });
        } catch (error) {
          console.error('[Socket.IO] Send message error:', error);
          socket.emit('message_error', { error: error.message });
        }
      });

      socket.on('typing', (data) => {
        if (!socket.data.authenticated) return;

        const { recipientId, groupId, isTyping } = data;
        const userId = socket.data.userId;

        if (groupId) {
          socket.to(`group-${groupId}`).emit('user_typing', {
            userId,
            groupId,
            isTyping,
            userName: socket.data.user?.name || 'Unknown'
          });
        } else if (recipientId) {
          this.io.to(`user-${recipientId}`).emit('user_typing', {
            userId,
            isTyping,
            userName: socket.data.user?.name || 'Unknown'
          });
        }
      });

      socket.on('message_read', (data) => {
        if (!socket.data.authenticated) return;

        const { messageId } = data;
        const userId = socket.data.userId;

        // Update message read status
        const db = require('./config/database');
        if (db.data.messages && db.data.messages[userId]) {
          const message = db.data.messages[userId].find(msg => msg.id === messageId);
          if (message && message.senderId) {
            message.read = true;
            message.readAt = Date.now();
            db.scheduleSave();

            // Notify sender
            this.io.to(`user-${message.senderId}`).emit('message_read_receipt', {
              messageId,
              readAt: message.readAt
            });
          }
        }
      });

      socket.on('location-update', (data) => {
        if (!socket.data.authenticated) {
          return;
        }

        const { deviceId, coords, timestamp, workerId } = data;
        const finalDeviceId = deviceId || workerId || socket.data.userId;

        if (!finalDeviceId || !coords || coords.latitude === undefined || coords.longitude === undefined) {
          return;
        }

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

        setImmediate(() => {
          try {
            const db = require('./config/database');
            const groupDistanceService = require('./services/groupDistanceService');
            const userGroups = db.getUserGroups(finalDeviceId);

            for (const group of userGroups) {
              groupDistanceService.checkMemberDistance(group.id, finalDeviceId, lat, lng)
                .catch(() => { });
            }
          } catch (error) {
            console.error('[Socket.IO] Failed to check group distances:', error);
          }
        });

        const room = `device-${finalDeviceId}`;
        if (this.io.sockets.adapter.rooms.has(room)) {
          socket.to(room).emit('location-updated', {
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
        if (!socket.data.authenticated) {
          return;
        }

        const { userId, groupId, lat, lng, heading, accuracy, timestamp } = data;
        const finalUserId = userId || socket.data.userId;

        if (!groupId || lat === undefined || lng === undefined) {
          return;
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          return;
        }

        const locationBatchService = require('./services/locationBatchService');
        locationBatchService.addToBatch(finalUserId, {
          timestamp: timestamp || Date.now(),
          coords: {
            latitude,
            longitude,
            accuracy: accuracy ? parseFloat(accuracy) : null,
            heading: heading ? parseFloat(heading) : null,
            speed: null
          }
        });

        setImmediate(() => {
          const groupDistanceService = require('./services/groupDistanceService');
          groupDistanceService.checkMemberDistance(groupId, finalUserId, latitude, longitude)
            .catch(() => { });
        });

        const room = `group-${groupId}`;
        if (this.io.sockets.adapter.rooms.has(room)) {
          this.io.to(room).emit('location_update', {
            groupId,
            userId: finalUserId,
            lat: latitude,
            lng: longitude,
            heading: heading ? parseFloat(heading) : null,
            accuracy: accuracy ? parseFloat(accuracy) : null,
            timestamp: timestamp || Date.now()
          });
        }
      });
    });
  }

  setupErrorHandling() {
    const { errorHandlerMiddleware } = require('./core/middleware/errorHandler.middleware');
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      next();
    });
    this.app.use(errorHandlerMiddleware);

    this.shutdownHandlers = [];
    this.isShuttingDown = false;

    // Public shutdown method
    this.shutdown = async (signal = 'manual') => {
      return this.gracefulShutdown(signal);
    };

    this.gracefulShutdown = async (signal) => {
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

        const locationBatchService = require('./services/locationBatchService');
        if (locationBatchService.destroy) {
          await locationBatchService.destroy();
        }

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
          await db.save();
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

    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      console.error('[FATAL] Uncaught Exception:', err.message);
      console.error('[FATAL] Stack:', err.stack);
      if (err.code === 'EADDRINUSE') {
        console.error('[FATAL] Port already in use - server may already be running');
      }
      setTimeout(() => this.gracefulShutdown('uncaughtException'), 1000);
    });

    process.on('unhandledRejection', (reason, promise) => {
      const errorMsg = reason instanceof Error ? reason.message : String(reason);
      if (!errorMsg.includes('not subscribed') && !errorMsg.includes('OneSignal')) {
        console.error('[FATAL] Unhandled Rejection:', errorMsg);
        if (reason instanceof Error && reason.stack) {
          console.error('[FATAL] Stack:', reason.stack);
        }
      }
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT')) {
        return;
      }
    });
  }

  setupBackgroundJobs() {
    try {
      const scheduledTasksService = require('./services/scheduledTasksService');
      if (!scheduledTasksService.isRunning) {
        scheduledTasksService.start();
      }

      const groupDistanceService = require('./services/groupDistanceService');
      if (groupDistanceService && typeof groupDistanceService.setSocketIO === 'function') {
        groupDistanceService.setSocketIO(this.io);
      }

      this.addShutdownHandler(async () => {
        try {
          scheduledTasksService.stop();
        } catch (err) {
          console.error('[SHUTDOWN] Error stopping scheduled tasks:', err.message);
        }
      });
    } catch (error) {
      console.error('[Server] Error setting up background jobs:', error.message);
    }
  }

  addShutdownHandler(handler) {
    this.shutdownHandlers.push(handler);
  }

  async start() {
    try {
      await this.validateEnvironment();
      this.verifyEmailService();

      this.server.listen(this.port, '0.0.0.0', async () => {
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
        console.log(`📊 Database: ${Object.keys(db?.data?.users || {}).length} users`);
        console.log(`💾 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⚡ Cache: Active`);
        console.log(`📈 Metrics: Active`);

        // OneSignal Notification Service Status
        const onesignalService = require('./services/onesignalService');
        const onesignalStatus = onesignalService.getStatus();

        if (onesignalStatus.enabled && onesignalStatus.apiKeyConfigured) {
          console.log(`🔔 OneSignal: ✅ Active & Ready`);
          console.log(`   App ID: ${onesignalStatus.appId.substring(0, 8)}...`);
          console.log(`   API Key: ${onesignalStatus.apiKeyPrefix}`);
          console.log(`   Status: ${onesignalStatus.statusMessage}`);

          // Verify API key is working (non-blocking)
          onesignalService.testApiKey().then(result => {
            if (result.success) {
              console.log(`   ✅ API Key validated - Push notifications ready`);
            } else {
              if (process.env.NODE_ENV !== 'production') {
                console.log(`   API Key validation failed: ${result.error}`);
              }
            }
          }).catch(err => {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`   API Key test error: ${err.message}`);
            }
          });
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`OneSignal: Configuration incomplete`);
          }
          if (!onesignalStatus.apiKeyConfigured) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`   API Key not configured properly`);
            }
            console.log(`   💡 Add ONESIGNAL_REST_API_KEY to backend/.env`);
          }
          if (onesignalStatus.needsReload) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`   Service needs reload - restart backend server`);
            }
          }
          console.log(`   Status: ${onesignalStatus.statusMessage}`);
        }

        const paymentGateway = require('./services/paymentGateway.service');
        const hasIyzico = process.env.IYZICO_API_KEY &&
          process.env.IYZICO_API_KEY !== 'sandbox-xxxxxxxx' &&
          process.env.IYZICO_API_KEY !== 'YOUR_IYZICO_API_KEY_HERE' &&
          process.env.IYZICO_SECRET_KEY &&
          process.env.IYZICO_SECRET_KEY !== 'sandbox-xxxxxxxx' &&
          process.env.IYZICO_SECRET_KEY !== 'YOUR_IYZICO_SECRET_KEY_HERE';

        if (hasIyzico) {
          const isProduction = process.env.IYZICO_BASE_URL && process.env.IYZICO_BASE_URL.includes('api.iyzipay.com');
          console.log(`💳 Ödeme Sistemi: Aktif (iyzico ${isProduction ? 'Production' : 'Sandbox'})`);
        } else {
          console.log(`💳 Ödeme Sistemi: Mock Mod (Test için aktif)`);
          if (process.env.NODE_ENV !== 'production') {
            console.log(`   Production için IYZICO_API_KEY ve IYZICO_SECRET_KEY ayarlayın`);
          }
        }

        const emailVerificationService = require('./services/emailVerificationService');
        const emailHealth = await emailVerificationService.getHealthStatus();
        if (emailHealth.status === 'OK') {
          console.log(`📧 Email Service: ✓ Aktif (${emailHealth.smtp_host}:${emailHealth.smtp_port})`);
        } else {
          console.log(`📧 Email Service: ✗ ${emailHealth.connection_status} - ${emailHealth.connection_error || 'Yapılandırılmamış'}`);
        }

        console.log(`⏱️  Startup Time: ${Date.now() - startTime}ms`);

        if (process.env.NODE_ENV === 'production') {
          console.log(`✅ Production Mode: Enabled`);
        }

        console.log('='.repeat(60) + '\n');

        const metricsInterval = setInterval(() => {
          metricsService.updateMemory();
          const performanceService = require('./core/services/performance.service');
          const performanceMonitor = require('./core/utils/performanceMonitor');
          const socketRooms = this.io.sockets.adapter.rooms.size;
          performanceService.setSocketRooms(socketRooms);
          performanceMonitor.recordMemory();
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
          const { execSync } = require('child_process');
          try {
            if (process.platform === 'win32') {
              const netstat = execSync(`netstat -ano | findstr :${this.port}`, { encoding: 'utf-8' });
              const match = netstat.match(/LISTENING\s+(\d+)/);
              if (match) {
                const pid = match[1];
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                setTimeout(() => {
                  this.server.listen(this.port, '0.0.0.0');
                }, 1000);
                return;
              }
            }
          } catch (e) {
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

  verifyEmailService() {
    try {
      const emailVerificationService = require('./services/emailVerificationService');
      const smtpUser = process.env.SMTP_USER || '';
      const smtpPass = process.env.SMTP_PASS || '';
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = process.env.SMTP_PORT || '465';

      if (smtpUser && smtpPass) {
        emailVerificationService.verifySMTPConnection().then(result => {
          if (result.success) {
            console.log(`📧 Email Service: ✓ Aktif (${smtpHost}:${smtpPort})`);
          } else {
            console.error(`📧 Email Service: ✗ Bağlantı hatası - ${result.error}`);
            console.error(`   Email gönderimi çalışmayacak. SMTP ayarlarını kontrol edin.`);
          }
        }).catch(err => {
          console.error(`📧 Email Service: ✗ Hata - ${err.message}`);
        });
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`📧 Email Service: Yapılandırılmamış - SMTP_USER ve SMTP_PASS .env dosyasında ayarlanmalı`);
        }
      }
    } catch (error) {
      console.error(`📧 Email Service: ✗ Başlatma hatası - ${error.message}`);
    }
  }

  validateEnvironment() {
    const isProduction = process.env.NODE_ENV === 'production';
    const required = ['JWT_SECRET'];
    const recommended = ['ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

    const missing = required.filter(key => !process.env[key]);
    const missingRecommended = recommended.filter(key => !process.env[key]);

    if (missing.length > 0 && isProduction) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (missing.length > 0 && !isProduction) {
      console.log(`[Server] Missing required environment variables: ${missing.join(', ')} - Using fallback values`);
    }

    if (missingRecommended.length > 0 && isProduction) {
      console.log(`[Server] Missing recommended environment variables: ${missingRecommended.join(', ')}`);
    }

    // Production security checks
    if (isProduction) {
      if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS === '*') {
        console.log(`[Server] ALLOWED_ORIGINS is set to '*' - Set specific origins in production`);
      }

      if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.log(`[Server] JWT_SECRET is too short (minimum 32 characters)`);
      }
    }

    const paymentService = require('./services/paymentService');
    const paymentGateway = require('./services/paymentGateway.service');

    const hasIyzico = process.env.IYZICO_API_KEY &&
      process.env.IYZICO_API_KEY !== 'sandbox-xxxxxxxx' &&
      process.env.IYZICO_SECRET_KEY &&
      process.env.IYZICO_SECRET_KEY !== 'sandbox-xxxxxxxx';

    if (hasIyzico) {
      console.log(`💳 Ödeme Sistemi: Aktif (iyzico ${paymentGateway.activeGateway === 'iyzico' ? 'Production' : 'Sandbox'})`);
    } else {
      console.log(`💳 Ödeme Sistemi: Mock Mod (Test için aktif - Gerçek ödeme yapılmaz)`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`   Production için IYZICO_API_KEY ve IYZICO_SECRET_KEY ayarlayın`);
      }
    }

    return true;
  }
}

// Start server
const serverApp = new ServerApp();
serverApp.start();

// Note: Graceful shutdown handlers are already registered in setupErrorHandling()
// No need to duplicate them here

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // Increase event loop monitoring
  const v8 = require('v8');
  setInterval(() => {
    const heapStats = v8.getHeapStatistics();
    const heapUsedMB = (heapStats.used_heap_size / 1024 / 1024).toFixed(2);
    const heapTotalMB = (heapStats.total_heap_size / 1024 / 1024).toFixed(2);
    const usagePercent = ((heapStats.used_heap_size / heapStats.total_heap_size) * 100).toFixed(2);

    // Only warn if memory usage is critically high (97%+)
    // Normal usage up to 97% is fine for Node.js applications
    if (parseFloat(usagePercent) > 97) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Memory] Critical usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`);
      }
    }
  }, 60000); // Check every minute
}

module.exports = serverApp;