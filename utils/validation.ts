/**
 * Frontend Validation Utilities
 * Client-side validation helpers
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email', email);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ValidationError('Invalid email format', 'email', email);
  }

  return email.trim().toLowerCase();
}

/**
 * Validate password strength
 */
export function validatePassword(password: string, minLength = 8): string {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  if (password.length < minLength) {
    throw new ValidationError(
      `Password must be at least ${minLength} characters`,
      'password'
    );
  }

  return password;
}

/**
 * Validate coordinates
 */
export function validateCoordinates(
  latitude: number | string,
  longitude: number | string
): { latitude: number; longitude: number } {
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ValidationError(
      'Invalid coordinates: must be numbers',
      'coordinates',
      { latitude, longitude }
    );
  }

  if (lat < -90 || lat > 90) {
    throw new ValidationError(
      'Latitude must be between -90 and 90',
      'latitude',
      lat
    );
  }

  if (lng < -180 || lng > 180) {
    throw new ValidationError(
      'Longitude must be between -180 and 180',
      'longitude',
      lng
    );
  }

  return { latitude: lat, longitude: lng };
}

/**
 * Validate string length
 */
export function validateString(
  value: string,
  fieldName: string,
  minLength = 1,
  maxLength = 255
): string {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName, value);
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`,
      fieldName,
      value
    );
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${maxLength} characters`,
      fieldName,
      value
    );
  }

  return trimmed;
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .substring(0, 10000);
}

// ============================================
// Turkish Validation Functions (User-Facing)
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate email address format (Turkish)
 */
export function validateEmailTR(email: string): ValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, error: 'E-posta adresi gereklidir' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Geçerli bir e-posta adresi girin' };
  }

  return { valid: true };
}

/**
 * Validate password strength (Turkish)
 */
export function validatePasswordTR(password: string, minLength: number = 6): ValidationResult {
  if (!password || !password.trim()) {
    return { valid: false, error: 'Şifre gereklidir' };
  }

  if (password.length < minLength) {
    return { valid: false, error: `Şifre en az ${minLength} karakter olmalıdır` };
  }

  return { valid: true };
}

/**
 * Validate password confirmation (Turkish)
 */
export function validatePasswordMatchTR(password: string, confirmPassword: string): ValidationResult {
  if (password !== confirmPassword) {
    return { valid: false, error: 'Şifreler eşleşmiyor' };
  }

  return { valid: true };
}

/**
 * Validate 6-digit verification code (Turkish)
 */
export function validateVerificationCodeTR(code: string): ValidationResult {
  if (!email || !code.trim()) {
    return { valid: false, error: 'Doğrulama kodu gereklidir' };
  }

  if (!/^\d{6}$/.test(code.trim())) {
    return { valid: false, error: 'Lütfen 6 haneli doğrulama kodunu girin' };
  }

  return { valid: true };
}

/**
 * Calculate password strength score (0-4)
 */
export function calculatePasswordStrength(password: string): number {
  let score = 0;
  if (!password) return 0;

  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  return Math.min(score, 4);
}

/**
 * Get password strength label (Turkish)
 */
export function getPasswordStrengthLabel(score: number): string {
  if (score === 0) return 'Şifre Giriniz';
  if (score < 2) return 'Zayıf';
  if (score < 3) return 'Orta';
  return 'Güçlü';
}

/**
 * Get password strength color
 */
export function getPasswordStrengthColor(score: number): string {
  if (score === 0) return '#64748b';
  if (score < 2) return '#ef4444';
  if (score < 3) return '#0EA5E9';
  return '#10b981';
}
