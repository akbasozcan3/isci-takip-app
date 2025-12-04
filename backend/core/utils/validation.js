class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required and must be a string', 'email', email);
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'email', email);
  }
  return email.toLowerCase().trim();
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required and must be a string', 'password');
  }
  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long', 'password');
  }
  if (password.length > 128) {
    throw new ValidationError('Password must be less than 128 characters', 'password');
  }
  return password;
}

function validateCardNumber(cardNumber) {
  if (!cardNumber || typeof cardNumber !== 'string') {
    throw new ValidationError('Card number is required', 'cardNumber');
  }
  const cleaned = cardNumber.replace(/\s/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) {
    throw new ValidationError('Card number must be between 13 and 19 digits', 'cardNumber', cardNumber);
  }
  if (!/^\d+$/.test(cleaned)) {
    throw new ValidationError('Card number must contain only digits', 'cardNumber', cardNumber);
  }
  return cleaned;
}

function validateCVV(cvv) {
  if (!cvv || typeof cvv !== 'string') {
    throw new ValidationError('CVV is required', 'cvv');
  }
  if (cvv.length < 3 || cvv.length > 4) {
    throw new ValidationError('CVV must be 3 or 4 digits', 'cvv', cvv);
  }
  if (!/^\d+$/.test(cvv)) {
    throw new ValidationError('CVV must contain only digits', 'cvv', cvv);
  }
  return cvv;
}

function validateExpiryDate(month, year) {
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new ValidationError('Invalid expiry month (must be 01-12)', 'expiryMonth', month);
  }
  
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    throw new ValidationError('Invalid expiry year', 'expiryYear', year);
  }
  
  const expiryDate = new Date(yearNum, monthNum - 1);
  const now = new Date();
  
  if (expiryDate < now) {
    throw new ValidationError('Card expiry date has passed', 'expiry', `${month}/${year}`);
  }
  
  return { month: monthNum, year: yearNum };
}

function validateRequired(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
  return value;
}

function validateString(value, fieldName, minLength = 0, maxLength = Infinity) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
  }
  if (value.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName, value);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be less than ${maxLength} characters`, fieldName, value);
  }
  return value.trim();
}

function validateNumber(value, fieldName, min = -Infinity, max = Infinity) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName, value);
  }
  if (num < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName, value);
  }
  if (num > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName, value);
  }
  return num;
}

function validatePlanId(planId) {
  const validPlans = ['free', 'plus', 'business'];
  if (!validPlans.includes(planId)) {
    throw new ValidationError(`Invalid plan ID. Must be one of: ${validPlans.join(', ')}`, 'planId', planId);
  }
  return planId;
}

module.exports = {
  ValidationError,
  validateEmail,
  validatePassword,
  validateCardNumber,
  validateCVV,
  validateExpiryDate,
  validateRequired,
  validateString,
  validateNumber,
  validatePlanId
};

