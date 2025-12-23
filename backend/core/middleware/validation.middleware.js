/**
 * Professional Validation Middleware
 * Centralized input validation and sanitization
 */

const ResponseFormatter = require('../utils/responseFormatter');

/**
 * Input sanitization helper
 */
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
}

/**
 * Email validation
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Password validation
 */
function isValidPassword(password) {
  return password && typeof password === 'string' && password.length >= 6;
}

/**
 * Phone validation (basic)
 */
function isValidPhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validation middleware factory
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      const errors = [];
      const sanitizedBody = sanitizeInput(req.body);
      req.body = sanitizedBody;

      // Validate each field in schema
      for (const field in schema) {
        const rules = schema[field];
        const value = req.body[field];

        // Required check
        if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
          errors.push({
            field,
            message: `${field} gereklidir`,
            code: 'REQUIRED'
          });
          continue;
        }

        // Skip other validations if field is not required and empty
        if (!rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
          continue;
        }

        // Type validation
        if (rules.type && typeof value !== rules.type) {
          errors.push({
            field,
            message: `${field} ${rules.type} tipinde olmalıdır`,
            code: 'INVALID_TYPE'
          });
        }

        // Email validation
        if (rules.email && !isValidEmail(value)) {
          errors.push({
            field,
            message: 'Geçersiz e-posta formatı',
            code: 'INVALID_EMAIL'
          });
        }

        // Password validation
        if (rules.password && !isValidPassword(value)) {
          errors.push({
            field,
            message: 'Şifre en az 6 karakter olmalıdır',
            code: 'INVALID_PASSWORD'
          });
        }

        // Phone validation
        if (rules.phone && !isValidPhone(value)) {
          errors.push({
            field,
            message: 'Geçersiz telefon numarası formatı',
            code: 'INVALID_PHONE'
          });
        }

        // Min length validation
        if (rules.minLength && value.length < rules.minLength) {
          errors.push({
            field,
            message: `${field} en az ${rules.minLength} karakter olmalıdır`,
            code: 'MIN_LENGTH'
          });
        }

        // Max length validation
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push({
            field,
            message: `${field} en fazla ${rules.maxLength} karakter olmalıdır`,
            code: 'MAX_LENGTH'
          });
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({
            field,
            message: rules.patternMessage || `${field} geçersiz format`,
            code: 'INVALID_PATTERN'
          });
        }

        // Custom validation
        if (rules.custom && typeof rules.custom === 'function') {
          const customResult = rules.custom(value, req.body);
          if (customResult !== true) {
            errors.push({
              field,
              message: customResult || `${field} geçersiz`,
              code: 'CUSTOM_VALIDATION'
            });
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json(
          ResponseFormatter.validationError(errors)
        );
      }

      next();
    } catch (error) {
      console.error('[Validation] Error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Validation hatası', 'VALIDATION_ERROR')
      );
    }
  };
}

/**
 * Common validation schemas
 */
const commonSchemas = {
  email: {
    required: true,
    type: 'string',
    email: true,
    maxLength: 255,
  },
  password: {
    required: true,
    type: 'string',
    password: true,
    minLength: 6,
    maxLength: 128,
  },
  code: {
    required: true,
    type: 'string',
    pattern: /^\d{6}$/,
    patternMessage: 'Kod 6 haneli olmalıdır',
  },
  phone: {
    required: false,
    type: 'string',
    phone: true,
  },
};

module.exports = {
  validate,
  sanitizeInput,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  commonSchemas,
};
