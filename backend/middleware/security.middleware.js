/**
 * Security Middleware
 * Provides comprehensive security features including XSS protection,
 * request sanitization, and security headers
 */

const helmet = require('helmet');

/**
 * Sanitize request data to prevent XSS and injection attacks
 */
const sanitizeRequest = (req, res, next) => {
    // Sanitize query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeString(req.query[key]);
            }
        });
    }

    // Sanitize body parameters
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }

    next();
};

/**
 * Sanitize a string by removing potentially dangerous characters
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;

    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
};

/**
 * Recursively sanitize an object
 */
const sanitizeObject = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return typeof obj === 'string' ? sanitizeString(obj) : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    Object.keys(obj).forEach(key => {
        sanitized[key] = sanitizeObject(obj[key]);
    });

    return sanitized;
};

/**
 * Configure Helmet.js for security headers
 */
const configureHelmet = () => {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        },
        noSniff: true,
        xssFilter: true,
        hidePoweredBy: true,
        frameguard: {
            action: 'deny'
        }
    });
};

/**
 * Validate file uploads
 */
const validateFileUpload = (req, res, next) => {
    if (!req.file && !req.files) {
        return next();
    }

    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    const maxFileSize = 5 * 1024 * 1024; // 5MB

    const files = req.files ? Object.values(req.files).flat() : [req.file];

    for (const file of files) {
        if (!file) continue;

        // Check mime type
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file type. Only images are allowed.'
            });
        }

        // Check file size
        if (file.size > maxFileSize) {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 5MB.'
            });
        }
    }

    next();
};

/**
 * Prevent parameter pollution
 */
const preventParameterPollution = (req, res, next) => {
    // Convert array parameters to single values (use last value)
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (Array.isArray(req.query[key])) {
                req.query[key] = req.query[key][req.query[key].length - 1];
            }
        });
    }

    next();
};

/**
 * Log security events
 */
const logSecurityEvent = (event, details) => {
    const timestamp = new Date().toISOString();
    console.warn(`[SECURITY] ${timestamp} - ${event}:`, details);

    // In production, send to security monitoring service
    if (process.env.NODE_ENV === 'production') {
        // TODO: Integrate with security monitoring (e.g., Sentry, DataDog)
    }
};

module.exports = {
    sanitizeRequest,
    configureHelmet,
    validateFileUpload,
    preventParameterPollution,
    sanitizeString,
    sanitizeObject,
    logSecurityEvent
};
