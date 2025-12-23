/**
 * Payment Gateway Service - Shopier Entegrasyonu
 * Artık sadece Shopier kullanılıyor, bu servis geriye dönük uyumluluk için tutuluyor
 */

const crypto = require('crypto');

class PaymentGatewayService {
  constructor() {
    this.activeGateway = 'shopier';
  }

  /**
   * Shopier'de direkt kart işlemi yok
   * Bu metod artık kullanılmıyor
   */
  async processPayment(transaction, cardData, userData) {
    throw new Error('Shopier entegrasyonunda direkt kart işlemi desteklenmiyor. Lütfen Shopier checkout linki kullanın.');
  }

  /**
   * Kart doğrulama - Artık kullanılmıyor ama geriye dönük uyumluluk için tutuluyor
   */
  validateCardData(cardData) {
    // Shopier'de kart bilgileri backend'den geçmediği için doğrulama yapılmıyor
    return {
      valid: true,
      errors: []
    };
  }
}

module.exports = new PaymentGatewayService();
