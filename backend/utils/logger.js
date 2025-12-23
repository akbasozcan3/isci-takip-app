/**
 * Structured Logging Utility
 * Provides consistent logging across the application
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'bavaxe-backend' },
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),

        // Combined logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),

        // Debug logs (only in development)
        ...(process.env.NODE_ENV !== 'production' ? [
            new winston.transports.File({
                filename: path.join(logsDir, 'debug.log'),
                level: 'debug',
                maxsize: 5242880,
                maxFiles: 3,
            })
        ] : []),
    ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
    }));
}

// Helper functions for common log patterns
const logHelpers = {
    /**
     * Log API request
     */
    apiRequest: (method, path, userId = null) => {
        logger.info('API Request', {
            type: 'api_request',
            method,
            path,
            userId,
        });
    },

    /**
     * Log API response
     */
    apiResponse: (method, path, statusCode, duration) => {
        const level = statusCode >= 400 ? 'warn' : 'info';
        logger[level]('API Response', {
            type: 'api_response',
            method,
            path,
            statusCode,
            duration: `${duration}ms`,
        });
    },

    /**
     * Log database query
     */
    dbQuery: (query, duration = null) => {
        logger.debug('Database Query', {
            type: 'db_query',
            query: query.substring(0, 100), // Truncate long queries
            duration: duration ? `${duration}ms` : null,
        });
    },

    /**
     * Log authentication event
     */
    auth: (event, userId, success = true) => {
        logger.info('Authentication Event', {
            type: 'auth',
            event,
            userId,
            success,
        });
    },

    /**
     * Log security event
     */
    security: (event, details = {}) => {
        logger.warn('Security Event', {
            type: 'security',
            event,
            ...details,
        });
    },

    /**
     * Log performance metric
     */
    performance: (metric, value, unit = 'ms') => {
        logger.info('Performance Metric', {
            type: 'performance',
            metric,
            value,
            unit,
        });
    },

    /**
     * Log business event
     */
    business: (event, data = {}) => {
        logger.info('Business Event', {
            type: 'business',
            event,
            ...data,
        });
    },
};

// Export logger with helpers
module.exports = {
    logger,
    ...logHelpers,

    // Convenience methods
    info: (...args) => logger.info(...args),
    error: (...args) => logger.error(...args),
    warn: (...args) => logger.warn(...args),
    debug: (...args) => logger.debug(...args),
};
