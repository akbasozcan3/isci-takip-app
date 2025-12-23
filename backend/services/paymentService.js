/**
 * Payment Service - Shopier Entegrasyonu
 * Shopier üzerinden ödeme işlemlerini yönetir
 */

const crypto = require('crypto');
const db = require('../config/database');
const activityLogService = require('./activityLogService');
const shopierService = require('./shopierService');

const transactions = new Map();

class PaymentService {
  constructor() {
    this.gateway = 'shopier'; // Artık sadece Shopier kullanılıyor
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
      gateway: 'shopier',
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    transactions.set(transactionId, transaction);
    return transaction;
  }

  getTransaction(transactionId) {
    // Önce memory'den kontrol et
    if (transactions.has(transactionId)) {
      return transactions.get(transactionId);
    }

    // Shopier service'den kontrol et
    const shopierTransaction = shopierService.getTransaction(transactionId);
    if (shopierTransaction) {
      return shopierTransaction;
    }

    // Database'den kontrol et
    try {
      const dbTransactions = db.data.transactions || [];
      return dbTransactions.find(t => t.id === transactionId) || null;
    } catch (error) {
      console.error('[PaymentService] Transaction bulma hatası:', error);
      return null;
    }
  }

  updateTransaction(transactionId, updates) {
    const transaction = transactions.get(transactionId);
    if (transaction) {
      Object.assign(transaction, updates, { updatedAt: Date.now() });
      transactions.set(transactionId, transaction);
    }

    // Shopier service'e de güncelle
    shopierService.updateTransaction(transactionId, updates);

    return transaction;
  }

  /**
   * Shopier ödeme linki oluşturur
   * Kart bilgileri Shopier'de işlendiği için burada sadece link oluşturuyoruz
   */
  async createCheckoutSession(userId, planId, amount, currency, metadata = {}) {
    try {
      // Shopier ödeme linki oluştur
      const result = shopierService.createPaymentLink(
        userId,
        planId,
        amount,
        metadata
      );

      return {
        success: true,
        sessionId: result.transactionId,
        checkoutUrl: result.paymentLink,
        transactionId: result.transactionId,
        gateway: 'shopier',
        mode: 'live'
      };
    } catch (error) {
      console.error('[PaymentService] Checkout session oluşturma hatası:', error);
      throw error;
    }
  }

  /**
   * Ödeme işleme - Shopier'de direkt kart işlemi yok
   * Bu metod artık kullanılmıyor, sadece geriye dönük uyumluluk için
   */
  async processPayment(userId, planId, amount, currency, cardData, metadata = {}, retryCount = 0) {
    // Shopier'de direkt kart işlemi yok, bu metod artık kullanılmıyor
    throw new Error('Shopier entegrasyonunda direkt kart işlemi desteklenmiyor. Lütfen createCheckoutSession metodunu kullanın.');
  }

  recordBillingEvent(userId, transaction, result) {
    try {
      const plan = this.getPlanDetails(transaction.planId);
      
      db.addBillingEvent(userId, {
        type: 'payment',
        planId: transaction.planId,
        planName: plan.name,
        amount: transaction.amount,
        currency: transaction.currency,
        interval: 'monthly',
        provider: 'shopier',
        status: 'succeeded',
        paymentId: result.paymentId || result.shopierTransactionId,
        transactionId: transaction.id,
        description: `${plan.name} abonelik ödemesi tamamlandı`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[PaymentService] recordBillingEvent error:', error);
    }
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

  async verifyWebhook(gateway, signature, payload, secret) {
    if (gateway === 'shopier') {
      // Shopier webhook doğrulama shopierService'de yapılıyor
      return { valid: true };
    }
    return { valid: false };
  }

  generateReceipt(transaction, subscription) {
    return {
      receiptId: 'RCPT_' + crypto.randomBytes(8).toString('hex').toUpperCase(),
      transactionId: transaction.id,
      userId: transaction.userId,
      planId: transaction.planId,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentId: transaction.shopierTransactionId || transaction.gatewayTransactionId,
      gateway: 'shopier',
      subscriptionId: subscription?.id,
      issuedAt: new Date().toISOString(),
      status: transaction.status
    };
  }
}

module.exports = new PaymentService();
