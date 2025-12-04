const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const TRANSACTION_LOG_FILE = path.join(LOG_DIR, 'transactions.jsonl');

class PaymentTransactionLogger {
  constructor() {
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  log(level, transactionId, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      transactionId,
      message,
      ...data
    };

    const line = JSON.stringify(entry) + '\n';
    
    try {
      fs.appendFileSync(TRANSACTION_LOG_FILE, line, 'utf8');
    } catch (err) {
      console.error('[PaymentLogger] Failed to write log:', err);
    }

    if (level === 'error' || level === 'critical') {
      console.error(`[PaymentLogger] ${level.toUpperCase()}:`, message, data);
    }
  }

  logTransaction(transactionId, event, data = {}) {
    this.log('info', transactionId, `Transaction ${event}`, data);
  }

  logPaymentStart(transactionId, userId, planId, amount) {
    this.logTransaction(transactionId, 'started', {
      userId,
      planId,
      amount,
      event: 'payment_started'
    });
  }

  logPaymentSuccess(transactionId, paymentId, gateway) {
    this.logTransaction(transactionId, 'succeeded', {
      paymentId,
      gateway,
      event: 'payment_succeeded'
    });
  }

  logPaymentFailure(transactionId, error, gateway) {
    this.log('error', transactionId, 'Payment failed', {
      error: error.message || error,
      gateway,
      event: 'payment_failed'
    });
  }

  logWebhook(transactionId, gateway, event, data = {}) {
    this.log('info', transactionId, `Webhook received: ${event}`, {
      gateway,
      event,
      ...data
    });
  }

  logRefund(transactionId, refundId, amount, reason) {
    this.logTransaction(transactionId, 'refunded', {
      refundId,
      amount,
      reason,
      event: 'refund_processed'
    });
  }

  getTransactionLogs(transactionId, limit = 100) {
    if (!fs.existsSync(TRANSACTION_LOG_FILE)) {
      return [];
    }

    try {
      const content = fs.readFileSync(TRANSACTION_LOG_FILE, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const logs = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(log => log && log.transactionId === transactionId)
        .slice(-limit);

      return logs;
    } catch (err) {
      console.error('[PaymentLogger] Failed to read logs:', err);
      return [];
    }
  }
}

module.exports = new PaymentTransactionLogger();

