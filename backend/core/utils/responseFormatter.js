class ResponseFormatter {
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

  static paginated(data, page, limit, total, meta = {}) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data,
      pagination: {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        total,
        pages: Math.ceil(total / (parseInt(limit) || 10))
      },
      ...(Object.keys(meta).length > 0 && { meta })
    };
  }

  static error(message, code = null, details = null) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: message,
      ...(code && { code }),
      ...(details && { details })
    };
  }

  static withTrace(response, traceId, spanId) {
    return {
      ...response,
      trace: {
        traceId,
        spanId
      }
    };
  }
}

module.exports = ResponseFormatter;

