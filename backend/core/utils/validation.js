/**
 * Professional Validation Utilities
 * Centralized validation functions for backend
 */

class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email', email);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ValidationError('Invalid email format', 'email', email);
  }

  if (email.length > 254) {
    throw new ValidationError('Email is too long (max 254 characters)', 'email', email);
  }

  return email.trim().toLowerCase();
}

/**
 * Validate password strength
 */
function validatePassword(password, minLength = 8) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  if (password.length < minLength) {
    throw new ValidationError(`Password must be at least ${minLength} characters`, 'password');
  }

  if (password.length > 128) {
    throw new ValidationError('Password is too long (max 128 characters)', 'password');
  }

  // Optional: Add complexity requirements
  // if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
  //   throw new ValidationError('Password must contain uppercase, lowercase, and number', 'password');
  // }

  return password;
}

/**
 * Validate coordinates
 */
function validateCoordinates(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ValidationError('Invalid coordinates: must be numbers', 'coordinates', { latitude, longitude });
  }

  if (lat < -90 || lat > 90) {
    throw new ValidationError('Latitude must be between -90 and 90', 'latitude', lat);
  }

  if (lng < -180 || lng > 180) {
    throw new ValidationError('Longitude must be between -180 and 180', 'longitude', lng);
  }

  return { latitude: lat, longitude: lng };
}

/**
 * Validate string length
 */
function validateString(value, fieldName, minLength = 1, maxLength = 255) {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName, value);
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName, value);
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`, fieldName, value);
  }

  return trimmed;
}

/**
 * Validate ID format (UUID, MongoDB ObjectId, or custom format)
 */
function validateId(id, fieldName = 'id') {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName, id);
  }

  if (id.length < 1 || id.length > 100) {
    throw new ValidationError(`${fieldName} is invalid`, fieldName, id);
  }

  return id.trim();
}

/**
 * Validate phone number (basic)
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new ValidationError('Phone number is required', 'phone', phone);
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // Basic validation: 10-15 digits
  if (!/^\d{10,15}$/.test(cleaned)) {
    throw new ValidationError('Invalid phone number format', 'phone', phone);
  }

  return cleaned;
}

/**
 * Validate timestamp
 */
function validateTimestamp(timestamp) {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  
  if (!Number.isFinite(ts) || ts <= 0) {
    throw new ValidationError('Invalid timestamp', 'timestamp', timestamp);
  }

  // Check if timestamp is reasonable (not too far in past/future)
  const now = Date.now();
  const maxPast = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years
  const maxFuture = 1 * 365 * 24 * 60 * 60 * 1000; // 1 year

  if (ts < now - maxPast) {
    throw new ValidationError('Timestamp is too far in the past', 'timestamp', timestamp);
  }

  if (ts > now + maxFuture) {
    throw new ValidationError('Timestamp is too far in the future', 'timestamp', timestamp);
  }

  return ts;
}

/**
 * Validate pagination parameters
 */
function validatePagination(page, limit, maxLimit = 100) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;

  if (pageNum < 1) {
    throw new ValidationError('Page must be at least 1', 'page', page);
  }

  if (limitNum < 1) {
    throw new ValidationError('Limit must be at least 1', 'limit', limit);
  }

  if (limitNum > maxLimit) {
    throw new ValidationError(`Limit cannot exceed ${maxLimit}`, 'limit', limit);
  }

  return { page: pageNum, limit: limitNum };
}

/**
 * Sanitize string (remove dangerous characters)
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 10000); // Max length
}

/**
 * Validate request body structure
 */
function validateRequestBody(body, requiredFields = [], optionalFields = []) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required', 'body');
  }

  const missing = requiredFields.filter(field => !(field in body) || body[field] === null || body[field] === undefined);
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`, 'body', missing);
  }

  // Check for unknown fields (optional strict mode)
  const allFields = [...requiredFields, ...optionalFields];
  const unknown = Object.keys(body).filter(key => !allFields.includes(key));
  if (unknown.length > 0 && process.env.STRICT_VALIDATION === 'true') {
    throw new ValidationError(`Unknown fields: ${unknown.join(', ')}`, 'body', unknown);
  }

  return body;
}

module.exports = {
  ValidationError,
  validateEmail,
  validatePassword,
  validateCoordinates,
  validateString,
  validateId,
  validatePhone,
  validateTimestamp,
  validatePagination,
  sanitizeString,
  validateRequestBody,
};
