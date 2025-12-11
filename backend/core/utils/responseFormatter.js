const crypto = require('crypto');

class ResponseFormatter {
  /**
   * Generate unique error ID for tracking
   */
  static generateErrorId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Success response
   */
  static success(data = null, message = null, meta = {}) {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      ...(data !== null && { data }),
      ...(message && { message }),
      ...(Object.keys(meta).length > 0 && { meta })
    };
    
    return response;
  }

  /**
   * Paginated response
   */
  static paginated(data, page, limit, total, meta = {}) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data,
      pagination: {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        total,
        pages: Math.ceil(total / (parseInt(limit) || 10)),
        hasNext: (parseInt(page) || 1) < Math.ceil(total / (parseInt(limit) || 10)),
        hasPrev: (parseInt(page) || 1) > 1
      },
      ...(Object.keys(meta).length > 0 && { meta })
    };
  }

  /**
   * Error response with error ID for tracking
   */
  static error(message, code = null, details = null, errorId = null) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: message,
      errorId: errorId || this.generateErrorId(),
      ...(code && { code }),
      ...(details && { details })
    };
  }

  /**
   * Validation error response
   */
  static validationError(errors, errorId = null) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errorId: errorId || this.generateErrorId(),
      errors: Array.isArray(errors) ? errors : [errors]
    };
  }

  /**
   * Add trace information to response
   */
  static withTrace(response, traceId, spanId) {
    return {
      ...response,
      trace: {
        traceId,
        spanId
      }
    };
  }

  /**
   * Add metadata to response
   */
  static withMeta(response, meta) {
    return {
      ...response,
      meta: {
        ...(response.meta || {}),
        ...meta
      }
    };
  }

  /**
   * Rate limit error response
   */
  static rateLimitError(retryAfter, limit, remaining = 0) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      errorId: this.generateErrorId(),
      details: {
        retryAfter,
        limit,
        remaining
      }
    };
  }
}

module.exports = ResponseFormatter;

