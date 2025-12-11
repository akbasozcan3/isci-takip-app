/**
 * Professional Request Validation Middleware
 * Advanced validation with schema support and detailed error messages
 */

const ResponseFormatter = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');

class RequestValidator {
  /**
   * Validate request body against schema
   */
  static validateBody(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }));

          logger.warn('Validation failed', {
            path: req.path,
            method: req.method,
            errors
          });

          return res.status(400).json(
            ResponseFormatter.validationError(errors)
          );
        }

        // Replace body with validated and sanitized data
        req.body = value;
        next();
      } catch (err) {
        logger.error('Validation middleware error', err);
        return res.status(500).json(
          ResponseFormatter.error('Validation error occurred', 'VALIDATION_ERROR')
        );
      }
    };
  }

  /**
   * Validate request query parameters
   */
  static validateQuery(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }));

          return res.status(400).json(
            ResponseFormatter.validationError(errors)
          );
        }

        req.query = value;
        next();
      } catch (err) {
        logger.error('Query validation error', err);
        return res.status(500).json(
          ResponseFormatter.error('Query validation error occurred', 'VALIDATION_ERROR')
        );
      }
    };
  }

  /**
   * Validate request parameters
   */
  static validateParams(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }));

          return res.status(400).json(
            ResponseFormatter.validationError(errors)
          );
        }

        req.params = value;
        next();
      } catch (err) {
        logger.error('Params validation error', err);
        return res.status(500).json(
          ResponseFormatter.error('Params validation error occurred', 'VALIDATION_ERROR')
        );
      }
    };
  }

  /**
   * Validate headers
   */
  static validateHeaders(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.headers, {
          abortEarly: false,
          stripUnknown: true,
          convert: true,
          allowUnknown: true // Allow unknown headers
        });

        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));

          return res.status(400).json(
            ResponseFormatter.validationError(errors)
          );
        }

        // Update headers with validated values
        Object.assign(req.headers, value);
        next();
      } catch (err) {
        logger.error('Headers validation error', err);
        return res.status(500).json(
          ResponseFormatter.error('Headers validation error occurred', 'VALIDATION_ERROR')
        );
      }
    };
  }

  /**
   * Combined validation for body, query, params, and headers
   */
  static validate(schemas = {}) {
    const middlewares = [];

    if (schemas.body) {
      middlewares.push(this.validateBody(schemas.body));
    }

    if (schemas.query) {
      middlewares.push(this.validateQuery(schemas.query));
    }

    if (schemas.params) {
      middlewares.push(this.validateParams(schemas.params));
    }

    if (schemas.headers) {
      middlewares.push(this.validateHeaders(schemas.headers));
    }

    return (req, res, next) => {
      let index = 0;

      const runNext = (err) => {
        if (err) {
          return next(err);
        }

        if (index < middlewares.length) {
          middlewares[index++](req, res, runNext);
        } else {
          next();
        }
      };

      runNext();
    };
  }

  /**
   * Sanitize and validate file uploads
   */
  static validateFile(options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes = [],
      required = false
    } = options;

    return (req, res, next) => {
      const file = req.file || req.files?.[0];

      if (required && !file) {
        return res.status(400).json(
          ResponseFormatter.validationError([{
            field: 'file',
            message: 'File is required'
          }])
        );
      }

      if (file) {
        // Check file size
        if (file.size > maxSize) {
          return res.status(400).json(
            ResponseFormatter.validationError([{
              field: 'file',
              message: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
            }])
          );
        }

        // Check MIME type
        if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
          return res.status(400).json(
            ResponseFormatter.validationError([{
              field: 'file',
              message: `File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`
            }])
          );
        }
      }

      next();
    };
  }
}

module.exports = RequestValidator;

