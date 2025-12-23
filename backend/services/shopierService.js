/**
 * Shopier Payment Service
 * Shopier üzerinden ödeme işlemlerini yönetir
 */

const crypto = require('crypto');
const db = require('../config/database');

class ShopierService {
  constructor() {
    // Shopier'de oluşturduğunuz ürün linkleri
    // Her plan için ayrı ürün linki olmalı
    this.productLinks = {
      plus: process.env.SHOPIER_PLUS_PRODUCT_LINK || '',
      business: process.env.SHOPIER_BUSINESS_PRODUCT_LINK || ''
    };

    // Shopier webhook secret (güvenlik için)
    this.webhookSecret = process.env.SHOPIER_WEBHOOK_SECRET || '';
  }

  /**
   * Plan ID'ye göre Shopier ürün linkini döndürür
   */
  getProductLink(planId) {
    const link = this.productLinks[planId];
    if (!link || link.trim() === '' || link.includes('PLUS_PRODUCT_ID') || link.includes('BUSINESS_PRODUCT_ID')) {
      throw new Error(`Shopier ürün linki bulunamadı veya yapılandırılmamış: ${planId}. Lütfen backend/.env dosyasında SHOPIER_${planId.toUpperCase()}_PRODUCT_LINK değişkenini ayarlayın.`);
    }

    // Link formatını kontrol et
    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      // Eğer sadece domain varsa https ekle
      if (link.startsWith('shopier.com')) {
        return 'https://' + link;
      }
      throw new Error(`Geçersiz Shopier ürün linki formatı: ${planId}. Link http:// veya https:// ile başlamalı.`);
    }

    return link;
  }

  /**
   * Kullanıcı için ödeme linki oluşturur
   * Shopier linkine kullanıcı bilgilerini ekler (opsiyonel)
   */
  createPaymentLink(userId, planId, amount, metadata = {}) {
    // Input validation
    if (!userId) {
      throw new Error('userId zorunludur');
    }
    if (!planId || (planId !== 'plus' && planId !== 'business')) {
      throw new Error('Geçersiz planId. Sadece "plus" veya "business" kabul edilir.');
    }
    if (!amount || amount <= 0 || isNaN(amount)) {
      throw new Error('Geçersiz amount. Amount 0\'dan büyük bir sayı olmalıdır.');
    }

    const productLink = this.getProductLink(planId);

    // Transaction ID oluştur (webhook'ta eşleştirmek için)
    const transactionId = 'shopier_' + crypto.randomBytes(16).toString('hex');

    // Transaction'ı kaydet
    const transaction = {
      id: transactionId,
      userId,
      planId,
      amount,
      currency: 'TRY',
      status: 'pending',
      gateway: 'shopier',
      productLink,
      metadata: {
        ...metadata,
        createdAt: Date.now()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Transaction'ı geçici olarak sakla (webhook'ta kullanmak için)
    this.saveTransaction(transaction);

    // Shopier linkine custom parametreler eklenebilir (eğer Shopier destekliyorsa)
    // Örnek: ${productLink}?ref=${transactionId}&user=${userId}
    const paymentLink = productLink;

    return {
      success: true,
      transactionId,
      paymentLink,
      gateway: 'shopier',
      amount,
      currency: 'TRY'
    };
  }

  /**
   * Transaction'ı geçici olarak sakla
   * Production'da Redis veya database kullanılmalı
   */
  saveTransaction(transaction) {
    // Basit in-memory storage (production'da database kullanın)
    if (!this.transactions) {
      this.transactions = new Map();
    }
    this.transactions.set(transaction.id, transaction);

    // Database'e de kaydet
    try {
      if (!db.data.transactions) {
        db.data.transactions = [];
      }
      db.data.transactions.push(transaction);
      db.save();
    } catch (error) {
      console.error('[ShopierService] Transaction kaydetme hatası:', error);
    }
  }

  /**
   * Transaction'ı ID ile bul
   */
  getTransaction(transactionId) {
    // Önce memory'den kontrol et
    if (this.transactions && this.transactions.has(transactionId)) {
      return this.transactions.get(transactionId);
    }

    // Database'den kontrol et
    try {
      const transactions = db.data.transactions || [];
      return transactions.find(t => t.id === transactionId) || null;
    } catch (error) {
      console.error('[ShopierService] Transaction bulma hatası:', error);
      return null;
    }
  }

  /**
   * Shopier webhook'unu doğrula ve işle
   * Shopier ödeme sonrası bu fonksiyon çağrılır
   */
  async processWebhook(webhookData) {
    try {
      // Shopier webhook formatı (örnek - gerçek formatı Shopier dokümantasyonundan kontrol edin)
      const {
        order_id,
        transaction_id,
        status,
        amount,
        currency,
        customer_email,
        customer_name,
        product_id,
        payment_date,
        // Custom parametreler (eğer link'e eklediyseniz)
        ref, // transactionId
        user // userId
      } = webhookData;

      // Webhook doğrulama (güvenlik için)
      if (this.webhookSecret) {
        const isValid = this.verifyWebhookSignature(webhookData);
        if (!isValid) {
          throw new Error('Geçersiz webhook imzası');
        }
      }

      // Transaction'ı bul
      let transaction;
      if (ref) {
        transaction = this.getTransaction(ref);
      } else if (transaction_id) {
        // Shopier'in transaction_id'si ile eşleştirme yapılabilir
        transaction = this.findTransactionByShopierId(transaction_id);
      }

      if (!transaction) {
        console.warn('[ShopierService] Transaction bulunamadı:', { ref, transaction_id });

        // Eğer userId yoksa ve transaction da yoksa, bu bir sorun
        if (!user && !ref) {
          console.error('[ShopierService] Webhook\'ta userId ve transactionId bulunamadı. Ödeme işlenemiyor.');
          throw new Error('Webhook\'ta yeterli bilgi yok: userId ve transactionId bulunamadı');
        }

        // Yeni transaction oluştur (eğer webhook'ta yeterli bilgi varsa)
        transaction = {
          id: ref || 'shopier_' + crypto.randomBytes(16).toString('hex'),
          userId: user || null,
          planId: this.detectPlanFromProduct(product_id) || 'plus', // Varsayılan plan
          amount: parseFloat(amount) || 0,
          currency: currency || 'TRY',
          status: 'pending',
          gateway: 'shopier',
          shopierOrderId: order_id,
          shopierTransactionId: transaction_id,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // Yeni transaction'ı kaydet
        this.saveTransaction(transaction);
      }

      // Ödeme durumunu güncelle
      if (status === 'success' || status === 'completed' || status === 'paid') {
        transaction.status = 'succeeded';
        transaction.shopierOrderId = order_id;
        transaction.shopierTransactionId = transaction_id;
        transaction.paymentDate = payment_date || Date.now();
        transaction.updatedAt = Date.now();

        // Transaction'ı güncelle
        this.updateTransaction(transaction.id, transaction);

        return {
          success: true,
          transactionId: transaction.id,
          userId: transaction.userId,
          planId: transaction.planId,
          amount: transaction.amount,
          status: 'succeeded',
          shopierOrderId: order_id,
          shopierTransactionId: transaction_id
        };
      } else if (status === 'failed' || status === 'cancelled') {
        transaction.status = 'failed';
        transaction.updatedAt = Date.now();
        this.updateTransaction(transaction.id, transaction);

        return {
          success: false,
          transactionId: transaction.id,
          status: 'failed',
          error: 'Ödeme başarısız'
        };
      } else {
        // Pending durumu
        transaction.status = 'pending';
        transaction.updatedAt = Date.now();
        this.updateTransaction(transaction.id, transaction);

        return {
          success: false,
          transactionId: transaction.id,
          status: 'pending',
          message: 'Ödeme bekleniyor'
        };
      }
    } catch (error) {
      console.error('[ShopierService] Webhook işleme hatası:', error);
      throw error;
    }
  }

  /**
   * Shopier transaction ID ile transaction bul
   */
  findTransactionByShopierId(shopierTransactionId) {
    try {
      const transactions = db.data.transactions || [];
      return transactions.find(t => t.shopierTransactionId === shopierTransactionId) || null;
    } catch (error) {
      console.error('[ShopierService] Transaction arama hatası:', error);
      return null;
    }
  }

  /**
   * Product ID'den plan ID'yi tespit et
   */
  detectPlanFromProduct(productId) {
    // Shopier'deki ürün ID'lerine göre plan belirleme
    // Bu bilgiyi env'de saklayabilirsiniz
    const productPlanMap = {
      [process.env.SHOPIER_PLUS_PRODUCT_ID]: 'plus',
      [process.env.SHOPIER_BUSINESS_PRODUCT_ID]: 'business'
    };

    return productPlanMap[productId] || 'plus';
  }

  /**
   * Webhook imzasını doğrula (güvenlik)
   */
  verifyWebhookSignature(webhookData) {
    if (!this.webhookSecret) {
      return true; // Secret yoksa doğrulama yapma
    }

    // Shopier'in webhook imza doğrulama yöntemi
    // Gerçek implementasyon Shopier dokümantasyonuna göre yapılmalı
    const signature = webhookData.signature || webhookData.hash;
    if (!signature) {
      return false;
    }

    // Basit hash doğrulama (gerçek implementasyon Shopier'e göre)
    const expectedHash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(webhookData))
      .digest('hex');

    return signature === expectedHash;
  }

  /**
   * Transaction'ı güncelle
   */
  updateTransaction(transactionId, updates) {
    // Memory'de güncelle
    if (this.transactions && this.transactions.has(transactionId)) {
      const existing = this.transactions.get(transactionId);
      Object.assign(existing, updates);
      this.transactions.set(transactionId, existing);
    }

    // Database'de güncelle
    try {
      const transactions = db.data.transactions || [];
      const index = transactions.findIndex(t => t.id === transactionId);
      if (index !== -1) {
        Object.assign(transactions[index], updates);
        db.save();
      } else {
        // Yeni transaction ekle
        transactions.push(updates);
        db.data.transactions = transactions;
        db.save();
      }
    } catch (error) {
      console.error('[ShopierService] Transaction güncelleme hatası:', error);
    }
  }

  /**
   * Ödeme durumunu kontrol et
   */
  async checkPaymentStatus(transactionId) {
    const transaction = this.getTransaction(transactionId);
    if (!transaction) {
      return { found: false };
    }

    return {
      found: true,
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      planId: transaction.planId,
      userId: transaction.userId,
      shopierOrderId: transaction.shopierOrderId,
      shopierTransactionId: transaction.shopierTransactionId,
      paymentDate: transaction.paymentDate,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      metadata: transaction.metadata
    };
  }

  /**
   * Retry failed payment with exponential backoff
   */
  async retryPayment(transactionId, maxRetries = 3) {
    const transaction = this.getTransaction(transactionId);
    if (!transaction) {
      throw new Error('Transaction bulunamadı');
    }

    if (transaction.status === 'succeeded') {
      return { success: true, message: 'Ödeme zaten başarılı' };
    }

    let retryCount = transaction.retryCount || 0;
    const maxRetryAttempts = maxRetries;

    if (retryCount >= maxRetryAttempts) {
      throw new Error(`Maksimum retry sayısına ulaşıldı (${maxRetryAttempts})`);
    }

    // Exponential backoff: 2^retryCount seconds
    const backoffMs = Math.pow(2, retryCount) * 1000;

    console.log(`[ShopierService] Retry attempt ${retryCount + 1}/${maxRetryAttempts} for transaction ${transactionId}`);

    // Update retry count
    transaction.retryCount = retryCount + 1;
    transaction.lastRetryAt = Date.now();
    this.updateTransaction(transactionId, transaction);

    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, backoffMs));

    // Create new payment link
    const newPaymentLink = this.createPaymentLink(
      transaction.userId,
      transaction.planId,
      transaction.amount,
      { ...transaction.metadata, retryOf: transactionId }
    );

    return {
      success: true,
      newTransactionId: newPaymentLink.transactionId,
      paymentLink: newPaymentLink.paymentLink,
      retryCount: transaction.retryCount,
      backoffMs
    };
  }

  /**
   * Get all pending transactions for a user
   */
  getPendingTransactions(userId) {
    try {
      const transactions = db.data.transactions || [];
      return transactions.filter(t =>
        t.userId === userId &&
        t.status === 'pending' &&
        t.gateway === 'shopier'
      );
    } catch (error) {
      console.error('[ShopierService] Error getting pending transactions:', error);
      return [];
    }
  }

  /**
   * Cancel a pending transaction
   */
  cancelTransaction(transactionId) {
    const transaction = this.getTransaction(transactionId);
    if (!transaction) {
      throw new Error('Transaction bulunamadı');
    }

    if (transaction.status !== 'pending') {
      throw new Error(`Transaction iptal edilemez. Mevcut durum: ${transaction.status}`);
    }

    transaction.status = 'cancelled';
    transaction.cancelledAt = Date.now();
    transaction.updatedAt = Date.now();
    this.updateTransaction(transactionId, transaction);

    return {
      success: true,
      transactionId,
      status: 'cancelled'
    };
  }

  /**
   * Get transaction statistics
   */
  getTransactionStats(userId = null) {
    try {
      const transactions = db.data.transactions || [];
      const userTransactions = userId
        ? transactions.filter(t => t.userId === userId && t.gateway === 'shopier')
        : transactions.filter(t => t.gateway === 'shopier');

      const stats = {
        total: userTransactions.length,
        succeeded: userTransactions.filter(t => t.status === 'succeeded').length,
        failed: userTransactions.filter(t => t.status === 'failed').length,
        pending: userTransactions.filter(t => t.status === 'pending').length,
        cancelled: userTransactions.filter(t => t.status === 'cancelled').length,
        totalAmount: userTransactions
          .filter(t => t.status === 'succeeded')
          .reduce((sum, t) => sum + (t.amount || 0), 0),
        averageAmount: 0,
        successRate: 0
      };

      if (stats.succeeded > 0) {
        stats.averageAmount = stats.totalAmount / stats.succeeded;
      }

      if (stats.total > 0) {
        stats.successRate = (stats.succeeded / stats.total) * 100;
      }

      return stats;
    } catch (error) {
      console.error('[ShopierService] Error getting transaction stats:', error);
      return null;
    }
  }

  /**
   * Clean up old pending transactions (older than 24 hours)
   */
  cleanupOldTransactions() {
    try {
      const transactions = db.data.transactions || [];
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

      let cleaned = 0;
      const updatedTransactions = transactions.map(t => {
        if (t.gateway === 'shopier' && t.status === 'pending' && t.createdAt < oneDayAgo) {
          cleaned++;
          return { ...t, status: 'expired', expiredAt: Date.now(), updatedAt: Date.now() };
        }
        return t;
      });

      if (cleaned > 0) {
        db.data.transactions = updatedTransactions;
        db.save();
        console.log(`[ShopierService] Cleaned up ${cleaned} expired transactions`);
      }

      return { cleaned };
    } catch (error) {
      console.error('[ShopierService] Error cleaning up transactions:', error);
      return { cleaned: 0 };
    }
  }
}

// Auto cleanup every hour
setInterval(() => {
  const service = new ShopierService();
  service.cleanupOldTransactions();
}, 60 * 60 * 1000);

module.exports = new ShopierService();

