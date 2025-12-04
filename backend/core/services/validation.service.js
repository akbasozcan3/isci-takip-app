const ValidationService = require('../utils/validation');

class ExtendedValidationService {
  validateLocationData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid location data format' };
    }

    const { coords, timestamp, deviceId } = data;

    if (!coords || typeof coords !== 'object') {
      return { valid: false, error: 'Coordinates required' };
    }

    if (!ValidationService.validateCoordinates(coords.latitude, coords.longitude)) {
      return { valid: false, error: 'Invalid coordinates' };
    }

    if (!timestamp || typeof timestamp !== 'number' || timestamp <= 0) {
      return { valid: false, error: 'Invalid timestamp' };
    }

    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      return { valid: false, error: 'Device ID required' };
    }

    return { valid: true };
  }

  validateGroupData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid group data format' };
    }

    const { name, createdBy } = data;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { valid: false, error: 'Group name required' };
    }

    if (name.trim().length > 100) {
      return { valid: false, error: 'Group name too long (max 100 characters)' };
    }

    if (!createdBy || typeof createdBy !== 'string') {
      return { valid: false, error: 'Creator ID required' };
    }

    return { valid: true };
  }

  validateUserData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid user data format' };
    }

    const { email, password, displayName } = data;

    if (!ValidationService.validateEmail(email)) {
      return { valid: false, error: 'Invalid email format' };
    }

    if (!ValidationService.validatePassword(password)) {
      return { valid: false, error: 'Password must be 6-128 characters' };
    }

    if (displayName && (typeof displayName !== 'string' || displayName.trim().length > 100)) {
      return { valid: false, error: 'Display name invalid or too long' };
    }

    return { valid: true };
  }

  sanitizeUserInput(input) {
    if (typeof input === 'string') {
      return ValidationService.sanitizeString(input, 1000);
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeUserInput(value);
      }
      return sanitized;
    }
    return input;
  }
}

module.exports = new ExtendedValidationService();

