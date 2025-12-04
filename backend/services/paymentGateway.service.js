const crypto = require('crypto');
const db = require('../config/database');

let Iyzipay;
let iyzipay;
let stripe;

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

try {
  const Stripe = require('stripe');
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_xxxxxxxx';
  if (stripeKey !== 'sk_test_xxxxxxxx') {
    stripe = new Stripe(stripeKey);
    console.log('[PaymentGateway] Stripe SDK yüklendi');
  } else {
    stripe = null;
  }
} catch (err) {
  console.warn('[PaymentGateway] Stripe SDK yüklenemedi:', err.message);
  stripe = null;
}

class PaymentGatewayService {
  constructor() {
    this.activeGateway = this.detectActiveGateway();
  }

  detectActiveGateway() {
    if (stripe && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_xxxxxxxx') {
      return 'stripe';
    }
    if (iyzipay && process.env.IYZICO_API_KEY && process.env.IYZICO_API_KEY !== 'sandbox-xxxxxxxx') {
      return 'iyzico';
    }
    return 'mock';
  }

  async processPayment(transaction, cardData, userData) {
    switch (this.activeGateway) {
      case 'stripe':
        return await this.processStripe(transaction, cardData, userData);
      case 'iyzico':
        return await this.processIyzico(transaction, cardData, userData);
      default:
        return await this.processMock(transaction, cardData, userData);
    }
  }

  async processStripe(transaction, cardData, userData) {
    if (!stripe) {
      throw new Error('Stripe gateway kullanılamıyor');
    }

    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: cardData.cardNumber,
          exp_month: parseInt(cardData.expiryMonth, 10),
          exp_year: parseInt(cardData.expiryYear, 10),
          cvc: cardData.cvc
        },
        billing_details: {
          name: cardData.cardName,
          email: userData.email
        }
      });

      const amountInCents = Math.round(transaction.amount * 100);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: transaction.currency.toLowerCase(),
        payment_method: paymentMethod.id,
        confirm: true,
        description: `Subscription: ${transaction.planId}`,
        metadata: {
          userId: transaction.userId,
          planId: transaction.planId,
          transactionId: transaction.id
        }
      });

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          paymentId: paymentIntent.id,
          gateway: 'stripe',
          cardLast4: paymentMethod.card.last4,
          cardBrand: paymentMethod.card.brand,
          gatewayTransactionId: paymentIntent.id
        };
      }

      throw new Error(`Ödeme başarısız: ${paymentIntent.status}`);
    } catch (error) {
      console.error('[PaymentGateway] Stripe error:', error);
      throw new Error(error.message || 'Stripe ödeme işlemi başarısız');
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
    
    if (cleanedCardNumber === '4000000000000002') {
      await new Promise(resolve => setTimeout(resolve, 800));
      throw new Error('Kart reddedildi. Lütfen farklı bir kart deneyin.');
    }

    if (cleanedCardNumber === '4000000000009995') {
      await new Promise(resolve => setTimeout(resolve, 800));
      throw new Error('Yetersiz bakiye. Lütfen farklı bir kart deneyin.');
    }

    if (cleanedCardNumber === '4000000000000119') {
      await new Promise(resolve => setTimeout(resolve, 800));
      throw new Error('Kart limiti aşıldı.');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

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

