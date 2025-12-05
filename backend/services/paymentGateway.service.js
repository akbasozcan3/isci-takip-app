const crypto = require('crypto');
const db = require('../config/database');

let Iyzipay;
let iyzipay;

try {
  Iyzipay = require('iyzipay');
  const iyzicoApiKey = process.env.IYZICO_API_KEY || 'sandbox-xxxxxxxx';
  const iyzicoSecretKey = process.env.IYZICO_SECRET_KEY || 'sandbox-xxxxxxxx';
  
  if (iyzicoApiKey !== 'sandbox-xxxxxxxx' && iyzicoSecretKey !== 'sandbox-xxxxxxxx') {
    iyzipay = new Iyzipay({
      apiKey: iyzicoApiKey,
      secretKey: iyzicoSecretKey,
      uri: process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com'
    });
    console.log('[PaymentGateway] iyzico Production mode aktif');
  } else {
    iyzipay = new Iyzipay({
      apiKey: iyzicoApiKey,
      secretKey: iyzicoSecretKey,
      uri: 'https://sandbox-api.iyzipay.com'
    });
    console.log('[PaymentGateway] iyzico Sandbox mode aktif');
  }
} catch (err) {
  console.warn('[PaymentGateway] iyzico SDK yüklenemedi:', err.message);
  iyzipay = null;
}

class PaymentGatewayService {
  constructor() {
    this.activeGateway = this.detectActiveGateway();
  }

  detectActiveGateway() {
    const iyzicoApiKey = process.env.IYZICO_API_KEY || '';
    const iyzicoSecretKey = process.env.IYZICO_SECRET_KEY || '';
    const hasValidIyzico = iyzipay && 
      iyzicoApiKey !== 'sandbox-xxxxxxxx' && 
      iyzicoApiKey !== 'YOUR_IYZICO_API_KEY_HERE' &&
      iyzicoSecretKey !== 'sandbox-xxxxxxxx' &&
      iyzicoSecretKey !== 'YOUR_IYZICO_SECRET_KEY_HERE';
    
    if (hasValidIyzico) {
      return 'iyzico';
    }
    return 'mock';
  }

  async processPayment(transaction, cardData, userData) {
    switch (this.activeGateway) {
      case 'iyzico':
        return await this.processIyzico(transaction, cardData, userData);
      default:
        return await this.processMock(transaction, cardData, userData);
    }
  }

  async processIyzico(transaction, cardData, userData) {
    if (!iyzipay) {
      throw new Error('iyzico gateway kullanılamıyor');
    }

    const conversationId = transaction.id;
    const basketId = 'BASKET_' + Date.now();

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: conversationId,
      price: transaction.amount.toFixed(2),
      paidPrice: transaction.amount.toFixed(2),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: basketId,
      paymentCard: {
        cardHolderName: cardData.cardName,
        cardNumber: cardData.cardNumber.replace(/\s/g, ''),
        expireMonth: cardData.expiryMonth.padStart(2, '0'),
        expireYear: cardData.expiryYear,
        cvc: cardData.cvc,
        registerCard: 0
      },
      buyer: {
        id: transaction.userId,
        name: cardData.cardName.split(' ')[0] || 'User',
        surname: cardData.cardName.split(' ').slice(1).join(' ') || 'User',
        gsmNumber: userData.phone || '+905350000000',
        email: userData.email,
        identityNumber: userData.identityNumber || '11111111111',
        lastLoginDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
        registrationDate: new Date(userData.createdAt || Date.now()).toISOString().replace('T', ' ').substring(0, 19),
        registrationAddress: 'Turkey',
        ip: userData.clientIp || '127.0.0.1',
        city: 'Istanbul',
        country: 'Turkey',
        zipCode: '34000'
      },
      shippingAddress: {
        contactName: cardData.cardName,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Turkey',
        zipCode: '34000'
      },
      billingAddress: {
        contactName: cardData.cardName,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Turkey',
        zipCode: '34000'
      },
      basketItems: [
        {
          id: transaction.planId,
          name: `Abonelik: ${transaction.planId}`,
          category1: 'Abonelik',
          category2: 'Dijital Hizmet',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: transaction.amount.toFixed(2)
        }
      ]
    };

    return new Promise((resolve, reject) => {
      iyzipay.payment.create(request, (err, result) => {
        if (err) {
          console.error('[PaymentGateway] iyzico error:', err);
          return reject(new Error(err.message || 'iyzico ödeme işlemi başarısız'));
        }

        if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
          resolve({
            success: true,
            paymentId: result.paymentId,
            gateway: 'iyzico',
            cardLast4: result.lastFourDigits,
            cardBrand: result.cardAssociation,
            gatewayTransactionId: result.paymentId,
            conversationId: result.conversationId
          });
        } else {
          const errorMsg = result.errorMessage || result.errorCode || 'Ödeme başarısız';
          console.error('[PaymentGateway] iyzico payment failed:', result);
          reject(new Error(errorMsg));
        }
      });
    });
  }

  async processMock(transaction, cardData, userData) {
    const cleanedCardNumber = cardData.cardNumber.replace(/\s/g, '');
    
    const testCards = {
      '4000000000000002': { error: 'Kart reddedildi. Lütfen farklı bir kart deneyin.', delay: 800 },
      '4000000000009995': { error: 'Yetersiz bakiye. Lütfen farklı bir kart deneyin.', delay: 800 },
      '4000000000000119': { error: 'Kart limiti aşıldı.', delay: 800 },
      '4000000000000127': { error: 'Kartın son kullanma tarihi geçmiş.', delay: 800 },
      '4000000000000069': { error: 'CVV hatalı.', delay: 800 },
      '4000000000000259': { error: '3D Secure doğrulaması başarısız.', delay: 1200 }
    };

    const testCard = testCards[cleanedCardNumber];
    if (testCard) {
      await new Promise(resolve => setTimeout(resolve, testCard.delay));
      throw new Error(testCard.error);
    }

    if (cleanedCardNumber.startsWith('4242424242424242') || cleanedCardNumber.startsWith('5555555555554444')) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    } else {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const cardBrand = this.detectCardBrand(cleanedCardNumber);
    const paymentId = 'MOCK_' + crypto.randomBytes(12).toString('hex').toUpperCase();

    return {
      success: true,
      paymentId: paymentId,
      gateway: 'mock',
      cardLast4: cleanedCardNumber.slice(-4),
      cardBrand: cardBrand,
      gatewayTransactionId: paymentId
    };
  }

  detectCardBrand(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6/.test(cleaned)) return 'discover';
    return 'unknown';
  }

  validateCardData(cardData) {
    const errors = [];

    if (!cardData.cardNumber || cardData.cardNumber.replace(/\s/g, '').length < 13) {
      errors.push('Geçersiz kart numarası');
    }

    if (!cardData.expiryMonth || parseInt(cardData.expiryMonth, 10) < 1 || parseInt(cardData.expiryMonth, 10) > 12) {
      errors.push('Geçersiz son kullanma ayı');
    }

    const now = new Date();
    const expiryYear = parseInt(cardData.expiryYear, 10);
    const expiryMonth = parseInt(cardData.expiryMonth, 10);
    const expiryDate = new Date(expiryYear, expiryMonth - 1);
    
    if (expiryDate < now) {
      errors.push('Kartın son kullanma tarihi geçmiş');
    }

    if (!cardData.cvc || cardData.cvc.length < 3 || cardData.cvc.length > 4) {
      errors.push('Geçersiz CVV');
    }

    if (!cardData.cardName || cardData.cardName.trim().length < 2) {
      errors.push('Geçersiz kart sahibi adı');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = new PaymentGatewayService();

