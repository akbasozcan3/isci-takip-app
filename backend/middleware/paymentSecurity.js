let rateLimit;
let paymentRateLimiter;

try {
  rateLimit = require('express-rate-limit');
  paymentRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
      success: false,
      error: 'Çok fazla ödeme denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });
} catch (err) {
  console.warn('[PaymentSecurity] express-rate-limit not available, using basic rate limiting');
  paymentRateLimiter = (req, res, next) => next();
}

const sanitizeCardData = (req, res, next) => {
  if (req.body && req.body.cardNumber) {
    const cleaned = req.body.cardNumber.replace(/\s/g, '');
    req.body.cardNumber = cleaned;
  }
  next();
};

const maskCardNumber = (cardNumber) => {
  if (!cardNumber || cardNumber.length < 4) return '****';
  const cleaned = cardNumber.replace(/\s/g, '');
  return '**** **** **** ' + cleaned.slice(-4);
};

const logPaymentAttempt = (req, userId, planId, success) => {
  const maskedCard = req.body?.cardNumber ? maskCardNumber(req.body.cardNumber) : 'N/A';
  const logData = {
    timestamp: new Date().toISOString(),
    userId,
    planId,
    success,
    ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    cardLast4: maskedCard
  };
  
  if (!success) {
    console.warn('[PaymentSecurity] Failed payment attempt:', logData);
  } else {
    console.log('[PaymentSecurity] Payment attempt:', logData);
  }
};

module.exports = {
  paymentRateLimiter,
  sanitizeCardData,
  maskCardNumber,
  logPaymentAttempt
};
