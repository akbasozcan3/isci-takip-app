const paymentService = require('./paymentService');
const paymentLogger = require('./paymentTransactionLogger');
const db = require('../config/database');

class PaymentRetryService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelays = [5000, 15000, 30000];
    this.failedPayments = new Map();
  }

  async retryPayment(transactionId, cardData, attempt = 1) {
    const transaction = paymentService.getTransaction(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (attempt > this.maxRetries) {
      this.failedPayments.set(transactionId, {
        transaction,
        attempts: attempt,
        lastAttempt: Date.now(),
        status: 'failed'
      });

      paymentLogger.log('error', transactionId, 'Payment retry exhausted', {
        attempts: attempt,
        maxRetries: this.maxRetries
      });

      return { success: false, error: 'Max retries exceeded' };
    }

    paymentLogger.log('info', transactionId, `Retry attempt ${attempt}`, {
      attempt,
      maxRetries: this.maxRetries
    });

    try {
      const delay = this.retryDelays[attempt - 1] || 30000;
      await new Promise(resolve => setTimeout(resolve, delay));

      const result = await paymentService.processPayment(
        transaction.userId,
        transaction.planId,
        transaction.amount,
        transaction.currency,
        cardData,
        transaction.metadata
      );

      if (result.success) {
        this.failedPayments.delete(transactionId);
        paymentLogger.log('info', transactionId, 'Payment retry succeeded', {
          attempt
        });
        return result;
      }

      return await this.retryPayment(transactionId, cardData, attempt + 1);
    } catch (error) {
      paymentLogger.log('error', transactionId, `Retry attempt ${attempt} failed`, {
        attempt,
        error: error.message
      });

      if (attempt < this.maxRetries) {
        return await this.retryPayment(transactionId, cardData, attempt + 1);
      }

      throw error;
    }
  }

  getFailedPayment(transactionId) {
    return this.failedPayments.get(transactionId) || null;
  }

  markForRetry(transactionId, cardData) {
    const transaction = paymentService.getTransaction(transactionId);
    if (!transaction) {
      return null;
    }

    this.failedPayments.set(transactionId, {
      transaction,
      cardData,
      attempts: 0,
      createdAt: Date.now()
    });

    return transactionId;
  }

  async processRetryQueue() {
    const now = Date.now();
    const retryable = [];

    for (const [transactionId, data] of this.failedPayments.entries()) {
      if (data.status === 'failed' && data.lastAttempt) {
        const timeSinceLastAttempt = now - data.lastAttempt;
        if (timeSinceLastAttempt > 3600000) {
          retryable.push({ transactionId, data });
        }
      }
    }

    for (const { transactionId, data } of retryable) {
      try {
        await this.retryPayment(transactionId, data.cardData, 1);
      } catch (error) {
        paymentLogger.log('error', transactionId, 'Automatic retry failed', {
          error: error.message
        });
      }
    }

    return retryable.length;
  }

  getRetryStats(transactionId) {
    const failed = this.failedPayments.get(transactionId);
    if (!failed) {
      return null;
    }

    return {
      transactionId,
      attempts: failed.attempts,
      lastAttempt: failed.lastAttempt,
      status: failed.status,
      createdAt: failed.createdAt
    };
  }
}

setInterval(() => {
  const retryService = require('./paymentRetryService');
  retryService.processRetryQueue().catch(err => {
    console.error('[PaymentRetry] Queue processing error:', err);
  });
}, 300000);

module.exports = new PaymentRetryService();

