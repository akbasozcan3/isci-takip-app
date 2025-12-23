/**
 * PostgreSQL Middleware
 * Ensures PostgreSQL connection is available before processing requests
 * Optimized to reduce connection attempts and log spam
 */

const postgres = require('../config/postgres');

// Throttle connection attempts - only try once per 30 seconds
let lastConnectionAttempt = 0;
const CONNECTION_RETRY_INTERVAL = 30000; // 30 seconds

async function ensurePostgresConnection(req, res, next) {
  // Skip Socket.IO and WebSocket requests
  if (req.path?.includes('/socket.io/') || 
      req.url?.includes('/socket.io/') ||
      req.headers.upgrade === 'websocket' ||
      req.headers.connection?.toLowerCase().includes('upgrade')) {
    return next();
  }

  // Only try to connect in production or if DATABASE_URL is set
  if (process.env.DATABASE_URL || process.env.NODE_ENV === 'production') {
    // If already connected, skip
    if (postgres.isConnected) {
      return next();
    }

    // Throttle connection attempts
    const now = Date.now();
    if (now - lastConnectionAttempt < CONNECTION_RETRY_INTERVAL) {
      // Too soon to retry, just continue
      return next();
    }

    lastConnectionAttempt = now;

    try {
      await postgres.connect();
    } catch (error) {
      // In development, silently continue without PostgreSQL
      if (process.env.NODE_ENV !== 'production') {
        // Only log once per minute to reduce spam
        if (now - (postgres.lastErrorLog || 0) > 60000) {
          postgres.lastErrorLog = now;
          // Silent in development - JSON fallback is expected
        }
      } else {
        // In production, log error but don't spam
        if (now - (postgres.lastErrorLog || 0) > 60000) {
          postgres.lastErrorLog = now;
          console.error('[PostgreSQL Middleware] Connection failed:', error.message);
        }
      }
    }
  }
  
  next();
}

module.exports = ensurePostgresConnection;

