/**
 * Professional Controller Wrapper Middleware
 * Standardizes controller responses and error handling
 */

const ResponseFormatter = require('../utils/responseFormatter');
const { createError } = require('../utils/errorHandler');
const databaseService = require('../services/database.service');

/**
 * Wraps controller methods with standardized error handling and response formatting
 */
function controllerWrapper(controllerMethod) {
  return async (req, res, next) => {
    try {
      // Attach database service to request
      req.dbService = databaseService;
      
      // Execute controller method
      const result = await controllerMethod(req, res, next);
      
      // If response already sent, return
      if (res.headersSent) {
        return;
      }
      
      // Format response if not already formatted
      if (result !== undefined && result !== null) {
        if (result.success === undefined) {
          // Auto-format as success response
          return res.json(ResponseFormatter.success(result));
        } else {
          // Already formatted
          return res.json(result);
        }
      }
    } catch (error) {
      // Handle operational errors
      if (error.isOperational) {
        return res.status(error.statusCode || 500).json(
          ResponseFormatter.error(error.message, error.code, error.details)
        );
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json(
          ResponseFormatter.error(error.message, 'VALIDATION_ERROR', {
            field: error.field
          })
        );
      }
      
      // Handle unknown errors
      console.error('[ControllerWrapper] Unhandled error:', error);
      return res.status(500).json(
        ResponseFormatter.error(
          'Bir hata oluştu',
          'INTERNAL_ERROR',
          process.env.NODE_ENV === 'development' ? { message: error.message, stack: error.stack } : null
        )
      );
    }
  };
}

/**
 * Validates request body against schema
 */
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
        
        return res.status(400).json(
          ResponseFormatter.error('Validation failed', 'VALIDATION_ERROR', { errors })
        );
      }
      
      req.validated = value;
      next();
    } catch (err) {
      next(createError('Validation error', 400, 'VALIDATION_ERROR'));
    }
  };
}

/**
 * Validates query parameters
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        return res.status(400).json(
          ResponseFormatter.error('Invalid query parameters', 'VALIDATION_ERROR', { errors })
        );
      }
      
      req.validatedQuery = value;
      next();
    } catch (err) {
      next(createError('Query validation error', 400, 'VALIDATION_ERROR'));
    }
  };
}

/**
 * Pagination helper
 */
function paginate(data, page, limit) {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const offset = (pageNum - 1) * limitNum;
  
  const paginated = Array.isArray(data) 
    ? data.slice(offset, offset + limitNum)
    : [];
  
  return {
    data: paginated,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: Array.isArray(data) ? data.length : 0,
      pages: Math.ceil((Array.isArray(data) ? data.length : 0) / limitNum)
    }
  };
}

module.exports = {
  controllerWrapper,
  validateRequest,
  validateQuery,
  paginate
};

