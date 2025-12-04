const express = require('express');
const serverless = require('serverless-http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
} catch (_) {
  try {
    require('dotenv').config();
  } catch (_) {}
}

// Import backend routes
const routes = require('../../backend/routes');

const app = express();

// Middleware
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Request logger
try {
  const requestLogger = require('../../backend/core/middleware/requestLogger');
  app.use(requestLogger);
} catch (e) {
  console.warn('Request logger not available');
}

// Rate limiter
try {
  const rateLimiter = require('../../backend/core/middleware/rateLimiter');
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
  app.use('/api', rateLimiter(windowMs, maxRequests));
} catch (e) {
  console.warn('Rate limiter not available');
}

// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Bavaxe GPS Tracking API',
    version: '2.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    platform: 'netlify-functions',
    note: 'Socket.IO not supported on Netlify. Use Railway.app for full features.'
  });
});

// Error handler
try {
  const { handleError } = require('../../backend/core/utils/errorHandler');
  app.use(handleError);
} catch (e) {
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports.handler = serverless(app, {
  binary: ['image/*', 'application/pdf']
});

