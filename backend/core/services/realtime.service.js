/**
 * Real-time Service
 * Enterprise-level WebSocket and real-time communication management
 */

const { logger } = require('../utils/logger');

class RealtimeService {
  constructor() {
    this.io = null;
    this.rooms = new Map(); // roomId -> Set of socketIds
    this.userSockets = new Map(); // userId -> Set of socketIds
    this.socketUsers = new Map(); // socketId -> userId
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      peakConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
    };
    this.messageQueue = new Map(); // For offline message delivery
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    try {
      const { Server } = require('socket.io');
      
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : '*';

      this.io = new Server(server, {
        cors: {
          origin: allowedOrigins,
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB
        allowEIO3: true,
      });

      this.setupMiddleware();
      this.setupEventHandlers();
      
      logger.info(`Real-time service initialized - transports: ${this.io.opts.transports.join(', ')}, pingTimeout: ${this.io.opts.pingTimeout}ms`);

      return this.io;
    } catch (error) {
      logger.error(`Failed to initialize realtime service: ${error.message || error}`);
      return null;
    }
  }

  /**
   * Setup Socket.IO middleware
   */
  setupMiddleware() {
    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        next();
      } catch (error) {
        logger.warn(`Socket authentication failed: ${error.message || error}`);
        next(new Error('Invalid token'));
      }
    });

    // Rate limiting middleware
    const rateLimitMap = new Map();
    this.io.use((socket, next) => {
      const ip = socket.handshake.address;
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxRequests = 100;

      if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
      }

      const limit = rateLimitMap.get(ip);
      if (now > limit.resetTime) {
        limit.count = 1;
        limit.resetTime = now + windowMs;
        return next();
      }

      if (limit.count >= maxRequests) {
        return next(new Error('Rate limit exceeded'));
      }

      limit.count++;
      next();
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new connection
   */
  handleConnection(socket) {
    const userId = socket.userId;
    const socketId = socket.id;

    // Track connection
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
    this.socketUsers.set(socketId, userId);

    this.connectionStats.totalConnections++;
    this.connectionStats.activeConnections++;
    if (this.connectionStats.activeConnections > this.connectionStats.peakConnections) {
      this.connectionStats.peakConnections = this.connectionStats.activeConnections;
    }

    logger.info(`Socket connected - userId: ${userId}, socketId: ${socketId}, activeConnections: ${this.connectionStats.activeConnections}`);

    // Send queued messages
    this.deliverQueuedMessages(userId, socket);

    // Join default room
    socket.join(`user:${userId}`);

    // Handle events
    socket.on('join-room', (roomId) => this.handleJoinRoom(socket, roomId));
    socket.on('leave-room', (roomId) => this.handleLeaveRoom(socket, roomId));
    socket.on('location-update', (data) => this.handleLocationUpdate(socket, data));
    socket.on('group-message', (data) => this.handleGroupMessage(socket, data));
    socket.on('typing', (data) => this.handleTyping(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));

    // Send connection confirmation
    socket.emit('connected', {
      userId,
      socketId,
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
    });
  }

  /**
   * Handle join room
   */
  handleJoinRoom(socket, roomId) {
    if (!roomId) return;

    socket.join(roomId);
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(socket.id);

    socket.emit('room-joined', { roomId });
    socket.to(roomId).emit('user-joined', {
      userId: socket.userId,
      socketId: socket.id,
    });

    logger.debug('User joined room', { userId: socket.userId, roomId });
  }

  /**
   * Handle leave room
   */
  handleLeaveRoom(socket, roomId) {
    if (!roomId) return;

    socket.leave(roomId);
    
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(socket.id);
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }

    socket.to(roomId).emit('user-left', {
      userId: socket.userId,
      socketId: socket.id,
    });

    logger.debug('User left room', { userId: socket.userId, roomId });
  }

  /**
   * Handle location update
   */
  handleLocationUpdate(socket, data) {
    const userId = socket.userId;
    const { latitude, longitude, accuracy, timestamp } = data;

    if (!latitude || !longitude) {
      socket.emit('error', { message: 'Invalid location data' });
      return;
    }

    // Broadcast to user's rooms
    const userRooms = Array.from(this.rooms.entries())
      .filter(([roomId, sockets]) => sockets.has(socket.id))
      .map(([roomId]) => roomId);

    userRooms.forEach(roomId => {
      socket.to(roomId).emit('location-update', {
        userId,
        latitude,
        longitude,
        accuracy,
        timestamp: timestamp || Date.now(),
      });
    });

    this.connectionStats.messagesReceived++;
    logger.debug('Location update', { userId, roomCount: userRooms.length });
  }

  /**
   * Handle group message
   */
  handleGroupMessage(socket, data) {
    const userId = socket.userId;
    const { roomId, message, type = 'text' } = data;

    if (!roomId || !message) {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }

    // Broadcast to room
    this.io.to(roomId).emit('group-message', {
      userId,
      roomId,
      message,
      type,
      timestamp: Date.now(),
    });

    this.connectionStats.messagesSent++;
    logger.debug('Group message', { userId, roomId });
  }

  /**
   * Handle typing indicator
   */
  handleTyping(socket, data) {
    const { roomId, isTyping } = data;
    if (!roomId) return;

    socket.to(roomId).emit('typing', {
      userId: socket.userId,
      isTyping,
    });
  }

  /**
   * Handle disconnect
   */
  handleDisconnect(socket) {
    const userId = socket.userId;
    const socketId = socket.id;

    // Remove from user sockets
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socketId);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Remove from rooms
    this.rooms.forEach((sockets, roomId) => {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.rooms.delete(roomId);
      }
    });

    this.socketUsers.delete(socketId);
    this.connectionStats.activeConnections--;

    logger.info(`Socket disconnected - userId: ${userId}, socketId: ${socketId}, activeConnections: ${this.connectionStats.activeConnections}`);
  }

  /**
   * Deliver queued messages to user
   */
  deliverQueuedMessages(userId, socket) {
    if (this.messageQueue.has(userId)) {
      const messages = this.messageQueue.get(userId);
      messages.forEach(message => {
        socket.emit(message.event, message.data);
      });
      this.messageQueue.delete(userId);
      logger.debug('Delivered queued messages', { userId, count: messages.length });
    }
  }

  /**
   * Send message to user
   */
  sendToUser(userId, event, data) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      // Queue message for later delivery
      if (!this.messageQueue.has(userId)) {
        this.messageQueue.set(userId, []);
      }
      this.messageQueue.get(userId).push({ event, data, timestamp: Date.now() });
      return false;
    }

    sockets.forEach(socketId => {
      this.io.to(socketId).emit(event, data);
    });

    this.connectionStats.messagesSent++;
    return true;
  }

  /**
   * Send message to room
   */
  sendToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
    this.connectionStats.messagesSent++;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event, data) {
    this.io.emit(event, data);
    this.connectionStats.messagesSent++;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      ...this.connectionStats,
      activeRooms: this.rooms.size,
      activeUsers: this.userSockets.size,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, msgs) => sum + msgs.length, 0),
    };
  }

  /**
   * Get user's active connections
   */
  getUserConnections(userId) {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size : 0;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.getUserConnections(userId) > 0;
  }
}

module.exports = new RealtimeService();

