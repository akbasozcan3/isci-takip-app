/**
 * Professional Validation Middleware
 * Request validation and sanitization
 */

const { ValidationError } = require('../utils/validation');
const { createError } = require('../utils/errorHandler');

/**
 * Validate request body against schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (validated.error) {
        const errors = validated.error.details.map(detail => ({
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

      req.validated = validated.value;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR',
          field: error.field
        });
      }
      next(createError('Validation error', 400, 'VALIDATION_ERROR'));
    }
  };
}

/**
 * Validate request query parameters
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (validated.error) {
        const errors = validated.error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          errors
        });
      }

      req.validatedQuery = validated.value;
      next();
    } catch (error) {
      next(createError('Query validation error', 400, 'VALIDATION_ERROR'));
    }
  };
}

/**
 * Validate request parameters
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (validated.error) {
        const errors = validated.error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Invalid route parameters',
          code: 'VALIDATION_ERROR',
          errors
        });
      }

      req.validatedParams = validated.value;
      next();
    } catch (error) {
      next(createError('Parameter validation error', 400, 'VALIDATION_ERROR'));
    }
  };
}

module.exports = {
  validateBody,
  validateQuery,
  validateParams
};

