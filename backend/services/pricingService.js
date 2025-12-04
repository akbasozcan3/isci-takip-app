const EXCHANGE_RATE_USD_TO_TRY = 30;

class PricingService {
  constructor() {
    this.basePrices = {
      free: { usd: 0, try: 0 },
      plus: { usd: 20, try: 600 },
      business: { usd: 50, try: 1500 }
    };
    
    this.exchangeRate = EXCHANGE_RATE_USD_TO_TRY;
  }

  getPrice(planId, currency = 'USD') {
    const plan = this.basePrices[planId];
    if (!plan) {
      return { usd: 0, try: 0 };
    }

    if (currency === 'TRY') {
      return {
        usd: plan.usd,
        try: plan.try,
        currency: 'TRY',
        amount: plan.try
      };
    }

    return {
      usd: plan.usd,
      try: plan.try,
      currency: 'USD',
      amount: plan.usd
    };
  }

  calculateTRY(usdAmount) {
    return Math.round(usdAmount * this.exchangeRate);
  }

  calculateUSD(tryAmount) {
    return Math.round((tryAmount / this.exchangeRate) * 100) / 100;
  }

  formatPrice(planId, currency = 'USD') {
    const price = this.getPrice(planId, 'USD');
    
    if (!price || !price.usd && !price.try) {
      console.error(`[PricingService] Invalid planId: ${planId}`);
      return {
        priceLabel: '$0 / ay',
        monthlyPrice: 0,
        monthlyPriceTRY: 0,
        currency: 'USD'
      };
    }
    
    return {
      priceLabel: `$${price.usd} / ay`,
      monthlyPrice: price.usd,
      monthlyPriceTRY: price.try,
      currency: 'USD'
    };
  }

  getAllPlanPrices() {
    return {
      free: this.formatPrice('free', 'USD'),
      plus: this.formatPrice('plus', 'USD'),
      business: this.formatPrice('business', 'USD')
    };
  }

  updateExchangeRate(newRate) {
    if (newRate > 0 && newRate < 100) {
      this.exchangeRate = newRate;
      this.basePrices.plus.try = this.calculateTRY(this.basePrices.plus.usd);
      this.basePrices.business.try = this.calculateTRY(this.basePrices.business.usd);
      return true;
    }
    return false;
  }

  getPlanComparison() {
    return {
      free: {
        id: 'free',
        title: 'Free',
        ...this.formatPrice('free', 'USD'),
        badge: null,
        recommended: false
      },
      plus: {
        id: 'plus',
        title: 'Plus',
        ...this.formatPrice('plus', 'USD'),
        badge: 'Popüler',
        recommended: false
      },
      business: {
        id: 'business',
        title: 'Business',
        ...this.formatPrice('business', 'USD'),
        badge: 'Önerilen',
        recommended: true
      }
    };
  }
}

module.exports = new PricingService();

