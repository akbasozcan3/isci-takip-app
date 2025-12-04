const db = require('../config/database');
const paymentService = require('./paymentService');
const paymentLogger = require('./paymentTransactionLogger');

class PaymentReceiptService {
  generateReceiptNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RCPT-${timestamp}-${random}`;
  }

  createReceipt(userId, transaction, subscription) {
    const receipt = {
      receiptNumber: this.generateReceiptNumber(),
      transactionId: transaction.id,
      userId: userId,
      issuedAt: new Date().toISOString(),
      planId: transaction.planId,
      planName: this.getPlanName(transaction.planId),
      amount: transaction.amount,
      currency: transaction.currency,
      paymentId: transaction.gatewayTransactionId,
      gateway: transaction.gateway,
      cardLast4: transaction.cardLast4,
      cardBrand: transaction.cardBrand,
      subscriptionId: subscription?.id,
      subscriptionStatus: subscription?.status,
      status: transaction.status
    };

    this.saveReceipt(userId, receipt);
    paymentLogger.logTransaction(transaction.id, 'receipt_generated', {
      receiptNumber: receipt.receiptNumber
    });

    return receipt;
  }

  getPlanName(planId) {
    const plans = {
      free: 'Free',
      plus: 'Plus',
      business: 'Business'
    };
    return plans[planId] || 'Unknown';
  }

  saveReceipt(userId, receipt) {
    if (!db.data.receipts) {
      db.data.receipts = {};
    }
    if (!db.data.receipts[userId]) {
      db.data.receipts[userId] = [];
    }
    db.data.receipts[userId].push(receipt);
    db.scheduleSave();
  }

  getReceipts(userId, limit = 50) {
    if (!db.data.receipts || !db.data.receipts[userId]) {
      return [];
    }
    return db.data.receipts[userId]
      .slice()
      .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
      .slice(0, limit);
  }

  getReceiptByNumber(receiptNumber) {
    if (!db.data.receipts) {
      return null;
    }

    for (const userId in db.data.receipts) {
      const receipt = db.data.receipts[userId].find(
        r => r.receiptNumber === receiptNumber
      );
      if (receipt) {
        return { ...receipt, userId };
      }
    }

    return null;
  }

  formatReceiptForEmail(receipt) {
    return {
      subject: `Ödeme Makbuzu - ${receipt.receiptNumber}`,
      html: this.generateReceiptHTML(receipt),
      text: this.generateReceiptText(receipt)
    };
  }

  generateReceiptHTML(receipt) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .receipt-info { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #6b7280; }
    .value { color: #111827; }
    .amount { font-size: 24px; font-weight: 800; color: #7c3aed; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ödeme Makbuzu</h1>
    <p style="margin: 0; opacity: 0.9;">${receipt.receiptNumber}</p>
  </div>
  <div class="content">
    <div class="receipt-info">
      <div class="row">
        <span class="label">Makbuz No:</span>
        <span class="value">${receipt.receiptNumber}</span>
      </div>
      <div class="row">
        <span class="label">Tarih:</span>
        <span class="value">${new Date(receipt.issuedAt).toLocaleString('tr-TR')}</span>
      </div>
      <div class="row">
        <span class="label">Plan:</span>
        <span class="value">${receipt.planName}</span>
      </div>
      <div class="row">
        <span class="label">Ödeme Yöntemi:</span>
        <span class="value">${receipt.cardBrand?.toUpperCase() || 'Card'} •••• ${receipt.cardLast4}</span>
      </div>
      <div class="row">
        <span class="label">Ödeme ID:</span>
        <span class="value">${receipt.paymentId}</span>
      </div>
      <div class="row" style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #7c3aed;">
        <span class="label" style="font-size: 18px;">Toplam:</span>
        <span class="amount">${receipt.amount} ${receipt.currency}</span>
      </div>
    </div>
  </div>
  <div class="footer">
    <p>Bu makbuz elektronik ortamda oluşturulmuştur.</p>
    <p>${new Date().toLocaleString('tr-TR')}</p>
  </div>
</body>
</html>
    `.trim();
  }

  generateReceiptText(receipt) {
    return `
ÖDEME MAKBUZU
${'='.repeat(40)}

Makbuz No: ${receipt.receiptNumber}
Tarih: ${new Date(receipt.issuedAt).toLocaleString('tr-TR')}
Plan: ${receipt.planName}
Ödeme Yöntemi: ${receipt.cardBrand?.toUpperCase() || 'Card'} •••• ${receipt.cardLast4}
Ödeme ID: ${receipt.paymentId}

Toplam: ${receipt.amount} ${receipt.currency}

${'='.repeat(40)}
Bu makbuz elektronik ortamda oluşturulmuştur.
    `.trim();
  }
}

module.exports = new PaymentReceiptService();

