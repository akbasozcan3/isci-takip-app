const crypto = require('crypto');

class AppError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCode(statusCode);
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  getDefaultCode(statusCode) {
    const codes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE'
    };
    return codes[statusCode] || 'UNKNOWN_ERROR';
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

function createError(message, statusCode = 500, code = null, details = null) {
  return new AppError(message, statusCode, code, details);
}

function handleError(err, req, res, next) {
  const errorId = crypto.randomBytes(8).toString('hex');
  const timestamp = new Date().toISOString();

  if (err instanceof AppError) {
    console.error(`[${timestamp}] [ERROR-${errorId}]`, {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      ip: req.ip
    });

    return res.status(err.statusCode).json({
      ...err.toJSON(),
      errorId,
      timestamp
    });
  }

  console.error(`[${timestamp}] [ERROR-${errorId}]`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip
  });

  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    errorId,
    timestamp,
    ...(isDevelopment && { stack: err.stack })
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  createError,
  handleError,
  asyncHandler
};

