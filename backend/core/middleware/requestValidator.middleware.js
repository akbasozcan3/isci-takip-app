const { ValidationError, validateRequired, validateString, validateEmail, validateNumber } = require('../utils/validation');
const { createError } = require('../utils/errorHandler');

function validateRequest(rules) {
  return (req, res, next) => {
    try {
      const errors = {};
      
      for (const [field, rule] of Object.entries(rules)) {
        const value = req.body[field] || req.query[field] || req.params[field];
        
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors[field] = `${field} is required`;
          continue;
        }
        
        if (value === undefined || value === null || value === '') {
          continue;
        }
        
        if (rule.type === 'email') {
          try {
            validateEmail(value);
          } catch (e) {
            errors[field] = e.message;
          }
        } else if (rule.type === 'string') {
          try {
            validateString(value, field, rule.minLength || 0, rule.maxLength || Infinity);
          } catch (e) {
            errors[field] = e.message;
          }
        } else if (rule.type === 'number') {
          try {
            validateNumber(value, field, rule.min || -Infinity, rule.max || Infinity);
          } catch (e) {
            errors[field] = e.message;
          }
        } else if (rule.type === 'enum' && rule.values) {
          if (!rule.values.includes(value)) {
            errors[field] = `${field} must be one of: ${rule.values.join(', ')}`;
          }
        } else if (rule.custom) {
          try {
            rule.custom(value);
          } catch (e) {
            errors[field] = e.message;
          }
        }
      }
      
      if (Object.keys(errors).length > 0) {
        throw createError('Validation failed', 422, 'VALIDATION_ERROR', errors);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = validateRequest;

