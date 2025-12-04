class ValidationUtils {
  static sanitizeString(str, maxLength = 1000) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLength);
  }

  static validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
  }

  static validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 6 && password.length <= 128;
  }

  static validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  static validateDeviceId(deviceId) {
    if (!deviceId || typeof deviceId !== 'string') return false;
    return deviceId.trim().length > 0 && deviceId.trim().length <= 100;
  }

  static validateVerificationCode(code) {
    if (!code || typeof code !== 'string') return false;
    return /^\d{6}$/.test(code.trim());
  }

  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return input.trim().replace(/[<>]/g, '');
    }
    return input;
  }
}

module.exports = ValidationUtils;

