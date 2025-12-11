const { handleError, AppError, createError } = require('../utils/errorHandler');
let logger;
try {
  const { getLogger } = require('../utils/loggerHelper');
  logger = getLogger('ErrorHandler');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[ErrorHandler]', ...args),
    error: (...args) => console.error('[ErrorHandler]', ...args),
    info: (...args) => console.log('[ErrorHandler]', ...args),
    debug: (...args) => console.debug('[ErrorHandler]', ...args)
  };
}

function errorHandlerMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const errorId = require('crypto').randomBytes(8).toString('hex');
  const timestamp = new Date().toISOString();

  if (err instanceof AppError) {
    logger.warn('Operational error', {
      errorId,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      ip: req.ip
    });

    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      errorId,
      timestamp,
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  if (err.name === 'ValidationError') {
    logger.warn('Validation error', {
      errorId,
      message: err.message,
      field: err.field,
      path: req.path,
      method: req.method
    });

    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR',
      errorId,
      timestamp,
      field: err.field,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError') {
    logger.warn('Authentication error', {
      errorId,
      message: err.message,
      path: req.path,
      method: req.method
    });

    return res.status(401).json({
      success: false,
      error: 'Geçersiz veya süresi dolmuş token',
      code: 'AUTH_ERROR',
      errorId,
      timestamp
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    logger.error('Connection error', {
      errorId,
      message: err.message,
      code: err.code,
      path: req.path
    });

    return res.status(503).json({
      success: false,
      error: 'Servis şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
      code: 'SERVICE_UNAVAILABLE',
      errorId,
      timestamp
    });
  }

  logger.error('Unexpected error', {
    errorId,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    body: process.env.NODE_ENV === 'development' ? req.body : undefined
  });

  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.',
    code: 'INTERNAL_SERVER_ERROR',
    errorId,
    timestamp,
    ...(isDevelopment && { stack: err.stack })
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (!error.isOperational && error instanceof Error) {
        logger.error('Unhandled promise rejection in async handler', {
          message: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method
        });
      }
      next(error);
    });
  };
}

function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors
        });
      }

      req.validated = value;
      next();
    } catch (err) {
      next(createError('Validation error', 400, 'VALIDATION_ERROR'));
    }
  };
}

module.exports = {
  errorHandlerMiddleware,
  asyncHandler,
  validateRequest
};
