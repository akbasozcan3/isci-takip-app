// Billing / Subscription Controller
const db = require('../config/database');

const PLAN_CATALOG = [
  {
    id: 'plus',
    title: 'Plus',
    priceLabel: '$20 / ay',
    monthlyPrice: 20,
    currency: 'USD',
    interval: 'monthly',
    badge: 'Mevcut planın',
    description: 'Profesyoneller için hızlandırılmış destek ve raporlama araçları',
    accentColor: '#94a3b8',
    backgroundColor: 'rgba(255,255,255,0.05)',
    features: [
      'Öncelikli yanıt ve destek hattı',
      'Hızlandırılmış rapor üretimi',
      'Standart çalışma alanları',
      'Gerçek zamanlı cihaz takibi',
      'Gelişmiş güvenlik kontrolleri'
    ]
  },
  {
    id: 'business',
    title: 'Business',
    priceLabel: '$25 / ay',
    monthlyPrice: 25,
    currency: 'USD',
    interval: 'monthly',
    badge: 'Önerilen',
    recommended: true,
    accentColor: '#c084fc',
    backgroundColor: '#5E33D1',
    buttonLabel: 'Business çalışma alanı ekle',
    description: 'Takımlar için kurumsal düzey güvenlik ve yönetim araçları',
    features: [
      'Sınırsız çalışma alanı ve proje',
      'Takım rol ve izin yönetimi',
      'Kurumsal düzey güvenlik raporları',
      'Özel müşteri başarı yöneticisi',
      'API/SDK için %50 daha yüksek limitler',
      'Gelişmiş otomasyon ve entegrasyon köprüleri'
    ]
  }
];

class BillingController {
  constructor() {
    this.plans = PLAN_CATALOG;
  }

  getPlan(planId) {
    return this.plans.find(plan => plan.id === planId);
  }

  resolveUser(req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return null;
    }
    const tokenData = db.getToken(token);
    if (!tokenData) {
      return null;
    }
    const user = db.findUserById(tokenData.userId);
    return user || null;
  }

  requireUser(req, res) {
    const user = this.resolveUser(req);
    if (!user) {
      res.status(401).json({ error: 'Kimlik doğrulaması gerekli' });
      return null;
    }
    return user;
  }

  getRenewalDate(interval) {
    const now = Date.now();
    switch (interval) {
      case 'yearly':
        return new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
      case 'monthly':
      default:
        return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  getPlans(req, res) {
    const user = this.resolveUser(req);
    const subscription = user
      ? db.getUserSubscription(user.id)
      : db.getDefaultSubscription();
    const history = user ? db.getBillingHistory(user.id) : [];

    return res.json({
      plans: this.plans,
      currentPlan: subscription?.planId || 'free',
      subscription,
      history
    });
  }

  checkout(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const { planId, cardLast4, cardBrand } = req.body || {};
    if (!planId) {
      return res.status(400).json({ error: 'planId zorunludur' });
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan bulunamadı' });
    }

    const payment = db.addBillingEvent(user.id, {
      type: 'payment',
      planId: plan.id,
      planName: plan.title,
      amount: plan.monthlyPrice,
      currency: plan.currency,
      interval: plan.interval,
      provider: 'INTERNAL_TEST_GATEWAY',
      status: 'succeeded',
      cardLast4: cardLast4 || '4242',
      cardBrand: cardBrand || 'visa',
      description: `${plan.title} planı için test ödemesi tamamlandı`
    });

    const subscription = db.setUserSubscription(user.id, {
      planId: plan.id,
      planName: plan.title,
      price: plan.monthlyPrice,
      priceLabel: plan.priceLabel,
      currency: plan.currency,
      interval: plan.interval,
      status: 'active',
      renewsAt: this.getRenewalDate(plan.interval)
    });

    return res.json({
      success: true,
      message: `${plan.title} planı için test ödemesi başarıyla alındı`,
      payment,
      subscription,
      history: db.getBillingHistory(user.id)
    });
  }

  subscribe(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const { planId } = req.body || {};
    if (!planId) {
      return res.status(400).json({ error: 'planId zorunludur' });
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan bulunamadı' });
    }

    const current = db.getUserSubscription(user.id);
    if (current?.planId === plan.id) {
      return res.json({
        success: true,
        message: `Zaten ${plan.title} planındasınız`,
        subscription: current,
        history: db.getBillingHistory(user.id)
      });
    }

    const updated = db.setUserSubscription(user.id, {
      planId: plan.id,
      planName: plan.title,
      price: plan.monthlyPrice,
      priceLabel: plan.priceLabel,
      currency: plan.currency,
      interval: plan.interval,
      status: 'active',
      renewsAt: this.getRenewalDate(plan.interval)
    });

    db.addBillingEvent(user.id, {
      type: 'upgrade',
      planId: plan.id,
      planName: plan.title,
      amount: plan.monthlyPrice,
      currency: plan.currency,
      interval: plan.interval,
      description: `${plan.title} planına yükseltildi`
    });

    return res.json({
      success: true,
      message: `${plan.title} planı aktifleştirildi`,
      subscription: updated,
      history: db.getBillingHistory(user.id)
    });
  }

  getHistory(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const history = db.getBillingHistory(user.id);
    return res.json({
      success: true,
      history
    });
  }
}

module.exports = new BillingController();

