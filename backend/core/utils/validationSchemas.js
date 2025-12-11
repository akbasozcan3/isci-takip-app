/**
 * Validation Schemas
 * Reusable validation schemas for common data types
 */

class ValidationSchemas {
  /**
   * Email validation
   */
  static email(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email is required' };
    }
    if (!emailRegex.test(email.trim())) {
      return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true, value: email.trim().toLowerCase() };
  }

  /**
   * Phone number validation (Turkish format)
   */
  static phone(phone) {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Phone number is required' };
    }
    const cleanPhone = phone.replace(/\s/g, '');
    const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return { valid: false, error: 'Invalid phone number format. Must be Turkish format (5XXXXXXXXX)' };
    }
    return { valid: true, value: cleanPhone };
  }

  /**
   * Coordinates validation
   */
  static coordinates(lat, lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      return { valid: false, error: 'Invalid coordinates format' };
    }
    
    if (latNum < -90 || latNum > 90) {
      return { valid: false, error: 'Latitude must be between -90 and 90' };
    }
    
    if (lngNum < -180 || lngNum > 180) {
      return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return { valid: true, value: { lat: latNum, lng: lngNum } };
  }

  /**
   * String validation
   */
  static string(value, options = {}) {
    const { minLength = 0, maxLength = Infinity, required = false, fieldName = 'Field' } = options;
    
    if (required && (!value || typeof value !== 'string')) {
      return { valid: false, error: `${fieldName} is required` };
    }
    
    if (value === undefined || value === null) {
      return { valid: true, value: null };
    }
    
    if (typeof value !== 'string') {
      return { valid: false, error: `${fieldName} must be a string` };
    }
    
    const trimmed = value.trim();
    
    if (trimmed.length < minLength) {
      return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
    }
    
    if (trimmed.length > maxLength) {
      return { valid: false, error: `${fieldName} must be at most ${maxLength} characters` };
    }
    
    return { valid: true, value: trimmed };
  }

  /**
   * Number validation
   */
  static number(value, options = {}) {
    const { min = -Infinity, max = Infinity, required = false, fieldName = 'Field' } = options;
    
    if (required && (value === undefined || value === null)) {
      return { valid: false, error: `${fieldName} is required` };
    }
    
    if (value === undefined || value === null) {
      return { valid: true, value: null };
    }
    
    const num = parseFloat(value);
    
    if (!isFinite(num)) {
      return { valid: false, error: `${fieldName} must be a valid number` };
    }
    
    if (num < min) {
      return { valid: false, error: `${fieldName} must be at least ${min}` };
    }
    
    if (num > max) {
      return { valid: false, error: `${fieldName} must be at most ${max}` };
    }
    
    return { valid: true, value: num };
  }

  /**
   * Array validation
   */
  static array(value, options = {}) {
    const { minLength = 0, maxLength = Infinity, required = false, fieldName = 'Field' } = options;
    
    if (required && (!value || !Array.isArray(value))) {
      return { valid: false, error: `${fieldName} is required and must be an array` };
    }
    
    if (value === undefined || value === null) {
      return { valid: true, value: [] };
    }
    
    if (!Array.isArray(value)) {
      return { valid: false, error: `${fieldName} must be an array` };
    }
    
    if (value.length < minLength) {
      return { valid: false, error: `${fieldName} must have at least ${minLength} items` };
    }
    
    if (value.length > maxLength) {
      return { valid: false, error: `${fieldName} must have at most ${maxLength} items` };
    }
    
    return { valid: true, value };
  }

  /**
   * Date validation
   */
  static date(value, options = {}) {
    const { required = false, fieldName = 'Field' } = options;
    
    if (required && !value) {
      return { valid: false, error: `${fieldName} is required` };
    }
    
    if (!value) {
      return { valid: true, value: null };
    }
    
    const date = new Date(value);
    
    if (isNaN(date.getTime())) {
      return { valid: false, error: `${fieldName} must be a valid date` };
    }
    
    return { valid: true, value: date.toISOString() };
  }

  /**
   * URL validation
   */
  static url(value, options = {}) {
    const { required = false, fieldName = 'Field' } = options;
    
    if (required && !value) {
      return { valid: false, error: `${fieldName} is required` };
    }
    
    if (!value) {
      return { valid: true, value: null };
    }
    
    try {
      new URL(value);
      return { valid: true, value };
    } catch (error) {
      return { valid: false, error: `${fieldName} must be a valid URL` };
    }
  }

  /**
   * Validate multiple fields at once
   */
  static validateFields(data, schema) {
    const errors = [];
    const validated = {};
    
    for (const [field, validator] of Object.entries(schema)) {
      const value = data[field];
      const result = validator(value);
      
      if (!result.valid) {
        errors.push({ field, error: result.error });
      } else {
        validated[field] = result.value;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data: validated
    };
  }
}

module.exports = ValidationSchemas;

