const paymentGateway = require('../services/paymentGateway.service');

const validatePaymentRequest = (req, res, next) => {
  const { planId, cardNumber, expiryMonth, expiryYear, cvc, cardName, amount } = req.body || {};

  if (!planId) {
    return res.status(400).json({
      success: false,
      error: 'Plan ID gereklidir',
      code: 'MISSING_PLAN_ID'
    });
  }

  if (!cardNumber || !expiryMonth || !expiryYear || !cvc || !cardName) {
    return res.status(400).json({
      success: false,
      error: 'Tüm kart bilgileri gereklidir',
      code: 'MISSING_CARD_DATA',
      missing: {
        cardNumber: !cardNumber,
        expiryMonth: !expiryMonth,
        expiryYear: !expiryYear,
        cvc: !cvc,
        cardName: !cardName
      }
    });
  }

  const cleanedCardNumber = cardNumber.replace(/\s/g, '');
  
  if (cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz kart numarası uzunluğu',
      code: 'INVALID_CARD_LENGTH'
    });
  }

  if (!/^\d+$/.test(cleanedCardNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Kart numarası sadece rakam içermelidir',
      code: 'INVALID_CARD_FORMAT'
    });
  }

  const expiryMonthNum = parseInt(expiryMonth, 10);
  const expiryYearNum = parseInt(expiryYear, 10);

  if (isNaN(expiryMonthNum) || expiryMonthNum < 1 || expiryMonthNum > 12) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz son kullanma ayı (01-12)',
      code: 'INVALID_EXPIRY_MONTH'
    });
  }

  if (isNaN(expiryYearNum) || expiryYearNum < new Date().getFullYear()) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz son kullanma yılı',
      code: 'INVALID_EXPIRY_YEAR'
    });
  }

  const now = new Date();
  const expiryDate = new Date(expiryYearNum, expiryMonthNum - 1);
  if (expiryDate < now) {
    return res.status(400).json({
      success: false,
      error: 'Kartın son kullanma tarihi geçmiş',
      code: 'EXPIRED_CARD'
    });
  }

  if (!/^\d+$/.test(cvc) || cvc.length < 3 || cvc.length > 4) {
    return res.status(400).json({
      success: false,
      error: 'CVV 3 veya 4 haneli olmalıdır',
      code: 'INVALID_CVC'
    });
  }

  if (!cardName || cardName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Kart sahibi adı en az 2 karakter olmalıdır',
      code: 'INVALID_CARD_NAME'
    });
  }

  const validation = paymentGateway.validateCardData({
    cardNumber: cleanedCardNumber,
    expiryMonth: expiryMonth.padStart(2, '0'),
    expiryYear: expiryYear.toString(),
    cvc,
    cardName: cardName.trim()
  });

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.errors.join(', '),
      code: 'CARD_VALIDATION_FAILED',
      errors: validation.errors
    });
  }

  req.validatedCardData = {
    cardNumber: cleanedCardNumber,
    expiryMonth: expiryMonth.padStart(2, '0'),
    expiryYear: expiryYear.toString(),
    cvc,
    cardName: cardName.trim()
  };

  next();
};

module.exports = { validatePaymentRequest };

