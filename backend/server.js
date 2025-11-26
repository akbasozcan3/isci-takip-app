// Main Server Application
const path = require('path');
const express = require('express');
const http = require('http');
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
  }

  setupMiddleware() {
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
    
    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  setupRoutes() {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Bavaxe API',
        version: '2.0.0',
        status: 'running',
        endpoints: {
          health: '/api/health',
          location: '/api/location/*',
          devices: '/api/devices'
        }
      });
    });
    
    // API routes
    this.app.use('/api', routes);
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Join device room for location updates
      socket.on('join-device', (deviceId) => {
        socket.join(`device-${deviceId}`);
        console.log(`Socket ${socket.id} joined device room: ${deviceId}`);
      });
      
      // Handle location updates
      socket.on('location-update', (data) => {
        const { deviceId, coords, timestamp } = data;
        
        if (deviceId && coords) {
          // Store location in database
          db.addToStore(deviceId, {
            timestamp: timestamp || Date.now(),
            coords: {
              latitude: parseFloat(coords.latitude),
              longitude: parseFloat(coords.longitude),
              accuracy: coords.accuracy ? parseFloat(coords.accuracy) : null,
              heading: coords.heading ? parseFloat(coords.heading) : null,
              speed: coords.speed ? parseFloat(coords.speed) : null
            }
          });
          
          // Broadcast to device room
          socket.to(`device-${deviceId}`).emit('location-updated', {
            deviceId,
            coords,
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
    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error('Global error handler:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      this.server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      this.server.close(() => {
        console.log('Server closed');
        process.exit(0);
  });
});
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Server running on port ${this.port}`);
      console.log(`📱 API available at http://localhost:${this.port}/api`);
      console.log(`🔌 Socket.IO server running`);
      console.log(`📊 Database loaded with ${Object.keys(db.data.users).length} users`);
    });
  }
}

// Start server
const serverApp = new ServerApp();
serverApp.start();

module.exports = serverApp;