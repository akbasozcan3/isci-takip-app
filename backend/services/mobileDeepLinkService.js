const crypto = require('crypto');

class MobileDeepLinkService {
  generateDeepLink(type, data) {
    const appScheme = process.env.APP_SCHEME || 'iscitakip';
    const baseUrl = `${appScheme}://`;
    
    const params = new URLSearchParams();
    Object.keys(data).forEach(key => {
      params.append(key, data[key]);
    });
    
    return `${baseUrl}${type}?${params.toString()}`;
  }

  generatePaymentSuccessLink(transactionId, paymentId, planId) {
    return this.generateDeepLink('payment-success', {
      transactionId,
      paymentId,
      planId,
      status: 'success'
    });
  }

  generatePaymentFailureLink(transactionId, error) {
    return this.generateDeepLink('payment-failure', {
      transactionId,
      error: encodeURIComponent(error),
      status: 'failed'
    });
  }

  generateCallbackUrl(type, data) {
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const token = crypto.randomBytes(16).toString('hex');
    
    return {
      url: `${baseUrl}/api/payment/callback/${type}?token=${token}`,
      token
    };
  }

  parseDeepLink(url) {
    try {
      const parsed = new URL(url);
      const params = {};
      parsed.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      
      return {
        type: parsed.pathname.replace('/', ''),
        params
      };
    } catch (err) {
      return null;
    }
  }
}

module.exports = new MobileDeepLinkService();

