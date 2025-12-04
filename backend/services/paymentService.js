const crypto = require('crypto');
const db = require('../config/database');

let Iyzipay;
let iyzipay;
let stripe;

try {
  Iyzipay = require('iyzipay');
  iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY || 'sandbox-xxxxxxxx',
    secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-xxxxxxxx',
    uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
  });
} catch (err) {
  iyzipay = null;
}

try {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_xxxxxxxx');
} catch (err) {
  stripe = null;
}

const transactions = new Map();

class PaymentService {
  constructor() {
    this.gateway = this.detectGateway();
  }

  detectGateway() {
    if (stripe && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_xxxxxxxx') {
      return 'stripe';
    }
    if (iyzipay && process.env.IYZICO_API_KEY && process.env.IYZICO_API_KEY !== 'sandbox-xxxxxxxx' && process.env.IYZICO_SECRET_KEY && process.env.IYZICO_SECRET_KEY !== 'sandbox-xxxxxxxx') {
      return 'iyzico';
    }
    return 'mock';
  }

  generateTransactionId() {
    return 'txn_' + crypto.randomBytes(16).toString('hex');
  }

  createTransaction(userId, planId, amount, currency, metadata = {}) {
    const transactionId = this.generateTransactionId();
    const transaction = {
      id: transactionId,
      userId,
      planId,
      amount,
      currency,
      status: 'pending',
      gateway: this.gateway,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    transactions.set(transactionId, transaction);
    return transaction;
  }

  getTransaction(transactionId) {
    return transactions.get(transactionId) || null;
  }

  updateTransaction(transactionId, updates) {
    const transaction = transactions.get(transactionId);
    if (!transaction) return null;
    Object.assign(transaction, updates, { updatedAt: Date.now() });
    transactions.set(transactionId, transaction);
    return transaction;
  }

  async processWithStripe(transaction, cardData) {
    if (!stripe) {
      throw new Error('Stripe gateway not available');
    }

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
        email: transaction.metadata.userEmail
      }
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(transaction.amount * 100),
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
      this.updateTransaction(transaction.id, {
        status: 'succeeded',
        gatewayTransactionId: paymentIntent.id,
        paymentMethodId: paymentMethod.id,
        cardLast4: paymentMethod.card.last4,
        cardBrand: paymentMethod.card.brand
      });

      return {
        success: true,
        transactionId: transaction.id,
        paymentId: paymentIntent.id,
        gateway: 'stripe'
      };
    }

    throw new Error(`Payment failed: ${paymentIntent.status}`);
  }

  async processWithIyzico(transaction, cardData) {
    if (!iyzipay) {
      throw new Error('Iyzico gateway not available');
    }

    const conversationId = transaction.id;
    const basketId = 'B' + Date.now();

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: conversationId,
      price: transaction.amount.toString(),
      paidPrice: transaction.amount.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: basketId,
      paymentCard: {
        cardHolderName: cardData.cardName,
        cardNumber: cardData.cardNumber,
        expireMonth: cardData.expiryMonth,
        expireYear: cardData.expiryYear,
        cvc: cardData.cvc,
        registerCard: 0
      },
      buyer: {
        id: transaction.userId,
        name: cardData.cardName.split(' ')[0] || 'User',
        surname: cardData.cardName.split(' ').slice(1).join(' ') || 'User',
        gsmNumber: transaction.metadata.phone || '+905350000000',
        email: transaction.metadata.userEmail,
        identityNumber: transaction.metadata.identityNumber || '11111111111',
        lastLoginDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
        registrationDate: new Date(transaction.metadata.userCreatedAt || Date.now()).toISOString().replace('T', ' ').substring(0, 19),
        registrationAddress: 'Turkey',
        ip: transaction.metadata.clientIp || '127.0.0.1',
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
          name: `Subscription: ${transaction.planId}`,
          category1: 'Subscription',
          category2: 'Digital Service',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: transaction.amount.toString()
        }
      ]
    };

    return new Promise((resolve, reject) => {
      iyzipay.payment.create(request, (err, result) => {
        if (err) {
          this.updateTransaction(transaction.id, {
            status: 'failed',
            error: err.message
          });
          return reject(new Error(err.message));
        }

        if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
          this.updateTransaction(transaction.id, {
            status: 'succeeded',
            gatewayTransactionId: result.paymentId,
            conversationId: result.conversationId,
            cardLast4: result.lastFourDigits,
            cardBrand: result.cardAssociation
          });

          resolve({
            success: true,
            transactionId: transaction.id,
            paymentId: result.paymentId,
            gateway: 'iyzico'
          });
        } else {
          this.updateTransaction(transaction.id, {
            status: 'failed',
            error: result.errorMessage || 'Payment failed'
          });
          reject(new Error(result.errorMessage || 'Payment failed'));
        }
      });
    });
  }

  async processWithMock(transaction, cardData) {
    const cleanedCardNumber = cardData.cardNumber.replace(/\s/g, '');
    
    if (cleanedCardNumber === '4000000000000002') {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.updateTransaction(transaction.id, {
        status: 'failed',
        error: 'Kart reddedildi'
      });
      throw new Error('Kart reddedildi. Lütfen farklı bir kart deneyin.');
    }

    if (cleanedCardNumber === '4000000000009995') {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.updateTransaction(transaction.id, {
        status: 'failed',
        error: 'Yetersiz bakiye'
      });
      throw new Error('Yetersiz bakiye. Lütfen farklı bir kart deneyin.');
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const cardBrand = this.detectCardBrand(cleanedCardNumber);
    const paymentId = 'mock_pay_' + crypto.randomBytes(8).toString('hex');

    this.updateTransaction(transaction.id, {
      status: 'succeeded',
      gatewayTransactionId: paymentId,
      cardLast4: cleanedCardNumber.slice(-4),
      cardBrand: cardBrand
    });

    return {
      success: true,
      transactionId: transaction.id,
      paymentId: paymentId,
      gateway: 'mock'
    };
  }

  detectCardBrand(cardNumber) {
    if (/^4/.test(cardNumber)) return 'visa';
    if (/^5[1-5]/.test(cardNumber)) return 'mastercard';
    if (/^3[47]/.test(cardNumber)) return 'amex';
    if (/^6/.test(cardNumber)) return 'discover';
    return 'unknown';
  }

  async processPayment(userId, planId, amount, currency, cardData, metadata = {}) {
    const paymentGateway = require('./paymentGateway.service');
    
    const validation = paymentGateway.validateCardData(cardData);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const cleanedCardNumber = cardData.cardNumber.replace(/\s/g, '');
    if (!/^\d+$/.test(cleanedCardNumber)) {
      throw new Error('Kart numarası sadece rakam içermelidir');
    }

    const transaction = this.createTransaction(userId, planId, amount, currency, metadata);

    try {
      const userData = {
        email: metadata.userEmail || '',
        phone: metadata.phone || '',
        identityNumber: metadata.identityNumber || '',
        createdAt: metadata.userCreatedAt || Date.now(),
        clientIp: metadata.clientIp || '127.0.0.1'
      };

      const result = await paymentGateway.processPayment(transaction, {
        cardNumber: cleanedCardNumber,
        expiryMonth: cardData.expiryMonth.padStart(2, '0'),
        expiryYear: cardData.expiryYear,
        cvc: cardData.cvc,
        cardName: cardData.cardName.trim()
      }, userData);

      if (result.success) {
        this.updateTransaction(transaction.id, {
          status: 'succeeded',
          gatewayTransactionId: result.gatewayTransactionId,
          cardLast4: result.cardLast4,
          cardBrand: result.cardBrand
        });
        
        this.recordBillingEvent(userId, transaction, result);
      }

      return {
        success: result.success,
        transactionId: transaction.id,
        paymentId: result.paymentId,
        gateway: result.gateway
      };
    } catch (error) {
      this.updateTransaction(transaction.id, {
        status: 'failed',
        error: error.message
      });
      throw error;
    }
  }

  recordBillingEvent(userId, transaction, result) {
    const plan = this.getPlanDetails(transaction.planId);
    
    db.addBillingEvent(userId, {
      type: 'payment',
      planId: transaction.planId,
      planName: plan.name,
      amount: transaction.amount,
      currency: transaction.currency,
      interval: 'monthly',
      provider: result.gateway,
      status: 'succeeded',
      paymentId: result.paymentId,
      transactionId: transaction.id,
      cardLast4: transaction.cardLast4,
      cardBrand: transaction.cardBrand,
      description: `${plan.name} subscription payment completed`,
      timestamp: Date.now()
    });
  }

  getPlanDetails(planId) {
    const pricingService = require('./pricingService');
    const price = pricingService.getPrice(planId, 'TRY');
    const planNames = {
      free: 'Free',
      plus: 'Plus',
      business: 'Business'
    };
    return {
      name: planNames[planId] || 'Free',
      price: price.try
    };
  }

  async createCheckoutSession(userId, planId, amount, currency, metadata = {}) {
    const transaction = this.createTransaction(userId, planId, amount, currency, metadata);

    if (this.gateway === 'iyzico' && iyzipay) {
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
      const callbackUrl = process.env.IYZICO_CALLBACK_URL || `${baseUrl}/api/payment/callback`;

      const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: transaction.id,
        price: amount.toString(),
        paidPrice: amount.toString(),
        currency: Iyzipay.CURRENCY.TRY,
        basketId: 'B' + Date.now(),
        paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
        callbackUrl: callbackUrl,
        enabledInstallments: [1],
        buyer: {
          id: userId,
          name: metadata.userName?.split(' ')[0] || 'User',
          surname: metadata.userName?.split(' ').slice(1).join(' ') || 'User',
          gsmNumber: metadata.phone || '+905350000000',
          email: metadata.userEmail,
          identityNumber: metadata.identityNumber || '11111111111',
          lastLoginDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
          registrationDate: new Date(metadata.userCreatedAt || Date.now()).toISOString().replace('T', ' ').substring(0, 19),
          registrationAddress: 'Turkey',
          ip: metadata.clientIp || '127.0.0.1',
          city: 'Istanbul',
          country: 'Turkey',
          zipCode: '34000'
        },
        shippingAddress: {
          contactName: metadata.userName || 'User',
          city: 'Istanbul',
          country: 'Turkey',
          address: 'Turkey',
          zipCode: '34000'
        },
        billingAddress: {
          contactName: metadata.userName || 'User',
          city: 'Istanbul',
          country: 'Turkey',
          address: 'Turkey',
          zipCode: '34000'
        },
        basketItems: [
          {
            id: planId,
            name: `Subscription: ${planId}`,
            category1: 'Subscription',
            category2: 'Digital Service',
            itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
            price: amount.toString()
          }
        ]
      };

      return new Promise((resolve, reject) => {
        iyzipay.checkoutFormInitialize.create(request, (err, result) => {
          if (err) {
            return reject(new Error(err.message));
          }

          if (result.status !== 'success') {
            return reject(new Error(result.errorMessage || 'Checkout creation failed'));
          }

          this.updateTransaction(transaction.id, {
            gatewayToken: result.token,
            checkoutUrl: result.paymentPageUrl
          });

          resolve({
            success: true,
            sessionId: transaction.id,
            checkoutUrl: result.paymentPageUrl,
            token: result.token,
            mode: 'live'
          });
        });
      });
    }

    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const mockUrl = `${baseUrl}/api/checkout/mock/${transaction.id}`;

    return {
      success: true,
      sessionId: transaction.id,
      checkoutUrl: mockUrl,
      mode: 'mock'
    };
  }

  async verifyWebhook(gateway, signature, payload, secret) {
    if (gateway === 'stripe' && stripe) {
      try {
        const event = stripe.webhooks.constructEvent(payload, signature, secret);
        return { valid: true, event };
      } catch (err) {
        return { valid: false, error: err.message };
      }
    }
    return { valid: true };
  }

  generateReceipt(transaction, subscription) {
    return {
      receiptId: 'RCPT_' + crypto.randomBytes(8).toString('hex').toUpperCase(),
      transactionId: transaction.id,
      userId: transaction.userId,
      planId: transaction.planId,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentId: transaction.gatewayTransactionId,
      gateway: transaction.gateway,
      cardLast4: transaction.cardLast4,
      cardBrand: transaction.cardBrand,
      subscriptionId: subscription?.id,
      issuedAt: new Date().toISOString(),
      status: transaction.status
    };
  }
}

module.exports = new PaymentService();

