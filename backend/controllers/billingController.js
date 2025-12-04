// Billing / Subscription Controller - iyzico Entegrasyonu
// Kart bilgileri asla backend'den geçmez, sadece iyzico'nun güvenli sayfasında işlenir

const db = require('../config/database');
const crypto = require('crypto');
const paymentService = require('../services/paymentService');
const paymentLogger = require('../services/paymentTransactionLogger');
const receiptService = require('../services/paymentReceiptService');
const subscriptionService = require('../services/subscriptionService');
const mobileDeepLink = require('../services/mobileDeepLinkService');
const paymentRetry = require('../services/paymentRetryService');
const { logPaymentAttempt } = require('../middleware/paymentSecurity');

let Iyzipay;
let iyzipay;
let stripe;

try {
  Iyzipay = require('iyzipay');
  
  const iyzicoApiKey = process.env.IYZICO_API_KEY || 'sandbox-xxxxxxxx';
  const iyzicoSecretKey = process.env.IYZICO_SECRET_KEY || 'sandbox-xxxxxxxx';
  
  iyzipay = new Iyzipay({
    apiKey: iyzicoApiKey,
    secretKey: iyzicoSecretKey,
    uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
  });
  
  if (iyzicoApiKey !== 'sandbox-xxxxxxxx' && iyzicoSecretKey !== 'sandbox-xxxxxxxx') {
    console.log('[Billing] iyzico SDK yüklendi (Production):', process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com');
  } else {
    console.log('[Billing] iyzico SDK yüklendi (Sandbox):', process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com');
  }
} catch (err) {
  console.warn('[Billing] iyzico SDK yüklenemedi, mock mod aktif:', err.message);
  iyzipay = null;
}

try {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_xxxxxxxx');
  console.log('[Billing] Stripe SDK yüklendi');
} catch (err) {
  console.warn('[Billing] Stripe SDK yüklenemedi:', err.message);
  stripe = null;
}

const pricingService = require('../services/pricingService');

const PLAN_CATALOG = [
  {
    id: 'free',
    title: 'Free',
    priceLabel: 'Ücretsiz',
    monthlyPrice: 0,
    monthlyPriceTRY: 0,
    currency: 'TRY',
    interval: 'monthly',
    badge: null,
    description: 'Başlangıç için temel özellikler',
    features: [
      'Temel konum takibi',
      '1 çalışma alanı',
      'Standart destek',
      '7 günlük veri saklama'
    ]
  },
  {
    id: 'plus',
    title: 'Plus',
    priceLabel: '$20 / ay',
    monthlyPrice: 20,
    monthlyPriceTRY: 600,
    currency: 'USD',
    interval: 'monthly',
    badge: 'Popüler',
    description: 'Profesyoneller için gelişmiş özellikler',
    features: [
      'Öncelikli destek',
      '5 çalışma alanı',
      'Gerçek zamanlı takip',
      'Gelişmiş raporlama',
      '90 günlük veri saklama',
      '200 istek/dakika',
      '5 dakika cache',
      '50 aktivite limiti',
      '2000 konum geçmişi'
    ],
    performance: {
      rateLimit: 200,
      cacheTTL: 300000,
      batchSize: 50
    }
  },
  {
    id: 'business',
    title: 'Business',
    priceLabel: '$50 / ay',
    monthlyPrice: 50,
    monthlyPriceTRY: 1500,
    currency: 'USD',
    interval: 'monthly',
    badge: 'Önerilen',
    recommended: true,
    description: 'Kurumsal düzey güvenlik ve yönetim',
    features: [
      'Sınırsız çalışma alanı',
      'Takım rol yönetimi',
      'Kurumsal güvenlik raporları',
      'Özel müşteri yöneticisi',
      'API erişimi',
      'Sınırsız veri saklama',
      '500 istek/dakika',
      '10 dakika cache',
      '200 aktivite limiti',
      '10000 konum geçmişi',
      'Sınırsız export'
    ],
    performance: {
      rateLimit: 500,
      cacheTTL: 600000,
      batchSize: 200
    }
  }
];

// Checkout session'ları (geçici, bellek içi)
const checkoutSessions = new Map();

class BillingController {
  constructor() {
    this.plans = PLAN_CATALOG;
  }

  getPlan(planId) {
    const plan = this.plans.find(plan => plan.id === planId);
    if (!plan) return null;
    
    const pricing = pricingService.formatPrice(planId, 'USD');
    return {
      ...plan,
      priceLabel: pricing.priceLabel,
      monthlyPrice: pricing.monthlyPrice,
      monthlyPriceTRY: pricing.monthlyPriceTRY,
      currency: pricing.currency
    };
  }

  resolveUser(req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const tokenData = db.getToken(token);
    if (!tokenData) return null;
    return db.findUserById(tokenData.userId) || null;
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
    return interval === 'yearly'
      ? new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  getPlans(req, res) {
    try {
      const user = this.resolveUser(req);
      const subscription = user
        ? db.getUserSubscription(user.id)
        : db.getDefaultSubscription();
      const history = user ? db.getBillingHistory(user.id) : [];
      
      const SubscriptionModel = require('../core/database/models/subscription.model');
      
      const enrichedPlans = this.plans.map(plan => {
        try {
          const limits = SubscriptionModel.getPlanLimits(plan.id);
          const isCurrent = subscription?.planId === plan.id;
          const pricing = pricingService.formatPrice(plan.id, 'USD');
          
          return {
            id: plan.id,
            title: plan.title,
            priceLabel: pricing.priceLabel,
            monthlyPrice: pricing.monthlyPrice,
            monthlyPriceTRY: pricing.monthlyPriceTRY,
            currency: pricing.currency,
            interval: plan.interval || 'monthly',
            badge: plan.badge || null,
            recommended: plan.recommended || false,
            description: plan.description || '',
            features: Array.isArray(plan.features) ? plan.features : [],
            performance: plan.performance || {},
            limits: limits || {},
            isCurrent: isCurrent
          };
        } catch (err) {
          console.error(`[BillingController] Error enriching plan ${plan.id}:`, err);
          const pricing = pricingService.formatPrice(plan.id, 'USD');
          return {
            id: plan.id,
            title: plan.title,
            priceLabel: pricing.priceLabel,
            monthlyPrice: pricing.monthlyPrice,
            monthlyPriceTRY: pricing.monthlyPriceTRY,
            currency: pricing.currency,
            interval: plan.interval || 'monthly',
            badge: plan.badge || null,
            recommended: plan.recommended || false,
            description: plan.description || '',
            features: Array.isArray(plan.features) ? plan.features : [],
            isCurrent: false
          };
        }
      });

      return res.json({
        success: true,
        plans: enrichedPlans,
        currentPlan: subscription?.planId || 'free',
        subscription: subscription ? {
          planId: subscription.planId,
          planName: subscription.planName,
          status: subscription.status,
          renewsAt: subscription.renewsAt,
          createdAt: subscription.createdAt
        } : null,
        history: Array.isArray(history) ? history.slice(0, 10) : []
      });
    } catch (error) {
      console.error('[BillingController] getPlans error:', error);
      const fallbackPlans = this.plans.map(plan => {
        const pricing = pricingService.formatPrice(plan.id, 'USD');
        return {
          id: plan.id,
          title: plan.title,
          priceLabel: pricing.priceLabel,
          monthlyPrice: pricing.monthlyPrice,
          monthlyPriceTRY: pricing.monthlyPriceTRY,
          currency: pricing.currency,
          interval: plan.interval || 'monthly',
          badge: plan.badge || null,
          recommended: plan.recommended || false,
          description: plan.description || '',
          features: Array.isArray(plan.features) ? plan.features : []
        };
      });
      
      return res.json({
        success: true,
        plans: fallbackPlans,
        currentPlan: 'free',
        subscription: null,
        history: []
      });
    }
  }

  // GET /api/me/subscription - Kullanıcının aktif aboneliği
  getMySubscription(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const subscription = db.getUserSubscription(user.id) || {
      planId: 'free',
      planName: 'Free',
      price: 0,
      currency: 'TRY',
      interval: 'monthly',
      status: 'active',
      renewsAt: null
    };

    return res.json({
      success: true,
      subscription
    });
  }

  // POST /api/checkout veya /api/billing/checkout
  // iyzico Checkout Form ile güvenli ödeme sayfası oluşturur
  async checkout(req, res) {
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

    if (plan.id === 'free') {
      return res.status(400).json({ error: 'Free plan için ödeme gerekli değil' });
    }

    // Benzersiz conversation ID oluştur
    const conversationId = crypto.randomBytes(16).toString('hex');
    const basketId = 'B' + Date.now();

    // Session bilgilerini kaydet (webhook'ta kullanılacak)
    const session = {
      id: conversationId,
      basketId,
      userId: user.id,
      userEmail: user.email,
      planId: plan.id,
      planName: plan.title,
      amount: plan.monthlyPriceTRY,
      currency: plan.currency,
      status: 'pending',
      createdAt: Date.now()
    };
    checkoutSessions.set(conversationId, session);

    // iyzico SDK yoksa mock URL döndür
    if (!iyzipay) {
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
      const mockUrl = `${baseUrl}/api/checkout/mock/${conversationId}`;
      
      return res.json({
        success: true,
        sessionId: conversationId,
        checkoutUrl: mockUrl,
        mode: 'mock',
        message: 'iyzico SDK yüklü değil, mock ödeme sayfası kullanılıyor'
      });
    }

    // Callback URL'leri
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const callbackUrl = process.env.IYZICO_CALLBACK_URL || `${baseUrl}/api/payment/callback`;

    // iyzico Checkout Form isteği
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: conversationId,
      price: plan.monthlyPriceTRY.toString(),
      paidPrice: plan.monthlyPriceTRY.toString(),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: basketId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
      callbackUrl: callbackUrl,
      enabledInstallments: [1], // Tek çekim
      buyer: {
        id: user.id,
        name: user.displayName?.split(' ')[0] || 'Kullanıcı',
        surname: user.displayName?.split(' ').slice(1).join(' ') || 'Kullanıcı',
        gsmNumber: '+905350000000', // Zorunlu alan
        email: user.email,
        identityNumber: '11111111111', // TC Kimlik (zorunlu, test için sabit)
        lastLoginDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
        registrationDate: new Date(user.createdAt || Date.now()).toISOString().replace('T', ' ').substring(0, 19),
        registrationAddress: 'Türkiye',
        ip: req.ip || '127.0.0.1',
        city: 'Istanbul',
        country: 'Turkey',
        zipCode: '34000'
      },
      shippingAddress: {
        contactName: user.displayName || 'Kullanıcı',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Türkiye',
        zipCode: '34000'
      },
      billingAddress: {
        contactName: user.displayName || 'Kullanıcı',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Türkiye',
        zipCode: '34000'
      },
      basketItems: [
        {
          id: plan.id,
          name: `${plan.title} Plan - Aylık Abonelik`,
          category1: 'Abonelik',
          category2: 'Dijital Hizmet',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: plan.monthlyPriceTRY.toString()
        }
      ]
    };

    // iyzico Checkout Form oluştur
    return new Promise((resolve) => {
      iyzipay.checkoutFormInitialize.create(request, (err, result) => {
        if (err) {
          console.error('[Billing] iyzico error:', err);
          return resolve(res.status(500).json({ 
            error: 'Ödeme sayfası oluşturulamadı', 
            details: err.message 
          }));
        }

        if (result.status !== 'success') {
          console.error('[Billing] iyzico result error:', result);
          return resolve(res.status(400).json({ 
            error: result.errorMessage || 'Ödeme başlatılamadı',
            errorCode: result.errorCode
          }));
        }

        console.log('[Billing] Checkout created:', conversationId);

        // iyzico'nun döndürdüğü token'ı session'a kaydet
        session.token = result.token;
        checkoutSessions.set(conversationId, session);

        return resolve(res.json({
          success: true,
          sessionId: conversationId,
          checkoutUrl: result.paymentPageUrl,
          token: result.token,
          mode: 'live'
        }));
      });
    });
  }

  async paymentCallback(req, res) {
    const { token } = req.body || req.query || {};
    const { type } = req.params || {};

    if (!token) {
      const deepLink = mobileDeepLink.generatePaymentFailureLink('unknown', 'Token bulunamadı');
      return res.redirect(deepLink);
    }

    if (!iyzipay) {
      const deepLink = mobileDeepLink.generatePaymentSuccessLink('mock', 'mock_payment', 'unknown');
      return res.redirect(deepLink);
    }

    return new Promise((resolve) => {
      iyzipay.checkoutForm.retrieve({
        locale: Iyzipay.LOCALE.TR,
        token: token
      }, async (err, result) => {
        if (err) {
          paymentLogger.log('error', 'callback', 'Callback verification failed', { error: err.message });
          const deepLink = mobileDeepLink.generatePaymentFailureLink('unknown', 'Ödeme doğrulanamadı');
          return resolve(res.redirect(deepLink));
        }

        paymentLogger.logWebhook(result.conversationId || 'unknown', 'iyzico', 'callback', {
          status: result.status,
          paymentStatus: result.paymentStatus
        });

        if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
          const conversationId = result.conversationId;
          const session = checkoutSessions.get(conversationId);

          if (session) {
            const plan = this.getPlan(session.planId);
            const transaction = paymentService.getTransaction(conversationId);
            
            if (transaction) {
              paymentService.updateTransaction(conversationId, {
                status: 'succeeded',
                gatewayTransactionId: result.paymentId,
                cardLast4: result.lastFourDigits,
                cardBrand: result.cardAssociation
              });
            }

            db.addBillingEvent(session.userId, {
              type: 'payment',
              planId: plan.id,
              planName: plan.title,
              amount: plan.monthlyPriceTRY,
              currency: 'TRY',
              interval: plan.interval,
              provider: 'iyzico',
              status: 'succeeded',
              paymentId: result.paymentId,
              conversationId: conversationId,
              cardAssociation: result.cardAssociation,
              cardFamily: result.cardFamily,
              lastFourDigits: result.lastFourDigits,
              description: `${plan.title} planı için ödeme tamamlandı`
            });

            const subscription = await subscriptionService.activateSubscription(
              session.userId,
              plan.id,
              {
                paymentId: result.paymentId,
                transactionId: conversationId,
                gateway: 'iyzico'
              }
            );

            if (transaction) {
              receiptService.createReceipt(session.userId, transaction, subscription);
            }

            session.status = 'completed';
            checkoutSessions.set(conversationId, session);

            paymentLogger.logPaymentSuccess(conversationId, result.paymentId, 'iyzico');
          }

          const deepLink = mobileDeepLink.generatePaymentSuccessLink(
            conversationId,
            result.paymentId,
            session?.planId || 'unknown'
          );
          return resolve(res.redirect(deepLink));
        } else {
          const errorMessage = result.errorMessage || 'Ödeme başarısız';
          const deepLink = mobileDeepLink.generatePaymentFailureLink(
            result.conversationId || 'unknown',
            errorMessage
          );
          return resolve(res.redirect(deepLink));
        }
      });
    });
  }

  // POST /api/webhook/payment - iyzico webhook (opsiyonel, callback yeterli)
  async handleWebhook(req, res) {
    const { type, data, token } = req.body || {};

    console.log('[Webhook] Received:', type || 'iyzico-callback', data || req.body);

    // Mock webhook (test için)
    if (type === 'checkout.session.completed' && data?.sessionId) {
      const session = checkoutSessions.get(data.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session bulunamadı' });
      }

      if (session.status === 'completed') {
        return res.json({ success: true, message: 'Zaten işlendi', subscription: db.getUserSubscription(session.userId) });
      }

      const plan = this.getPlan(session.planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan bulunamadı' });
      }

      // Ödeme kaydı
      db.addBillingEvent(session.userId, {
        type: 'payment',
        planId: plan.id,
        planName: plan.title,
        amount: plan.monthlyPriceTRY,
        currency: 'TRY',
        interval: plan.interval,
        provider: 'MOCK',
        status: 'succeeded',
        cardLast4: data.cardLast4 || '4242',
        cardBrand: data.cardBrand || 'visa',
        sessionId: data.sessionId,
        description: `${plan.title} planı için ödeme tamamlandı`,
        timestamp: Date.now()
      });

      // Abonelik aktifleştir
      const subscription = db.setUserSubscription(session.userId, {
        planId: plan.id,
        planName: plan.title,
        price: plan.monthlyPriceTRY,
        priceLabel: plan.priceLabel,
        currency: 'TRY',
        interval: plan.interval,
        status: 'active',
        renewsAt: this.getRenewalDate(plan.interval),
        activatedAt: new Date().toISOString(),
        updatedAt: Date.now()
      });

      session.status = 'completed';
      checkoutSessions.set(data.sessionId, session);

      console.log(`[Billing] Mock payment completed: ${session.userId} -> ${plan.id}`);

      return res.json({
        success: true,
        message: 'Abonelik aktifleştirildi',
        subscription: subscription
      });
    }

    // iyzico webhook (token ile)
    if (token && iyzipay) {
      return new Promise((resolve) => {
        iyzipay.checkoutForm.retrieve({
          locale: Iyzipay.LOCALE.TR,
          token: token
        }, (err, result) => {
          if (err) {
            console.error('[Webhook] iyzico error:', err);
            return resolve(res.status(500).json({ error: 'Webhook işlenemedi' }));
          }

          console.log('[Webhook] iyzico result:', result.status, result.paymentStatus);

          if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
            const session = checkoutSessions.get(result.conversationId);
            if (session && session.status !== 'completed') {
              const plan = this.getPlan(session.planId);
              
              db.addBillingEvent(session.userId, {
                type: 'payment',
                planId: plan.id,
                planName: plan.title,
                amount: plan.monthlyPriceTRY,
                currency: 'TRY',
                interval: plan.interval,
                provider: 'iyzico',
                status: 'succeeded',
                paymentId: result.paymentId,
                description: `${plan.title} planı için ödeme tamamlandı`
              });

              db.setUserSubscription(session.userId, {
                planId: plan.id,
                planName: plan.title,
                price: plan.monthlyPriceTRY,
                priceLabel: plan.priceLabel,
                currency: 'TRY',
                interval: plan.interval,
                status: 'active',
                renewsAt: this.getRenewalDate(plan.interval)
              });

              session.status = 'completed';
            }
          }

          return resolve(res.json({ success: true, received: true }));
        });
      });
    }

    return res.json({ success: true, message: 'Webhook received' });
  }

  // Mock checkout sayfası (iyzico yokken test için)
  mockCheckoutPage(req, res) {
    const { sessionId } = req.params;
    const session = checkoutSessions.get(sessionId);

    if (!session) {
      return res.status(404).send('<h1>Oturum bulunamadı</h1>');
    }

    const plan = this.getPlan(session.planId);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Ödeme - ${plan.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { max-width: 420px; width: 100%; }
    .card { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 32px; }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo span { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #a855f7, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .badge { display: inline-block; background: #f59e0b; color: #000; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
    .plan-name { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .amount { font-size: 36px; font-weight: 800; color: #a855f7; margin-bottom: 24px; }
    .amount small { font-size: 16px; color: #9ca3af; }
    .divider { height: 1px; background: rgba(255,255,255,0.1); margin: 24px 0; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; color: #9ca3af; margin-bottom: 8px; font-weight: 500; }
    input { width: 100%; padding: 14px 16px; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; background: rgba(255,255,255,0.05); color: #fff; font-size: 16px; transition: border-color 0.2s; }
    input:focus { outline: none; border-color: #a855f7; }
    input::placeholder { color: #6b7280; }
    .row { display: flex; gap: 12px; }
    .row .form-group { flex: 1; }
    .btn { width: 100%; padding: 16px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform 0.2s, opacity 0.2s; }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; margin-top: 8px; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #9ca3af; margin-top: 12px; }
    .secure { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 24px; font-size: 13px; color: #6b7280; }
    .secure svg { width: 16px; height: 16px; }
    .test-notice { background: #fef3c7; color: #92400e; padding: 12px 16px; border-radius: 12px; font-size: 13px; margin-bottom: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo"><span>NEXORA</span></div>
      
      <div class="test-notice">
        ⚠️ Bu bir TEST ödeme sayfasıdır. Gerçek ödeme yapılmaz.
      </div>
      
      <div class="badge">TEST MODU</div>
      <div class="plan-name">${plan.title} Plan</div>
      <div class="amount">₺${plan.monthlyPriceTRY} <small>/ ay</small></div>
      
      <div class="divider"></div>
      
      <form id="paymentForm">
        <div class="form-group">
          <label>Kart Numarası</label>
          <input type="text" id="cardNumber" placeholder="4242 4242 4242 4242" value="4242424242424242" maxlength="19">
        </div>
        <div class="row">
          <div class="form-group">
            <label>Son Kullanma</label>
            <input type="text" id="expiry" placeholder="AA/YY" value="12/28" maxlength="5">
          </div>
          <div class="form-group">
            <label>CVV</label>
            <input type="text" id="cvc" placeholder="123" value="123" maxlength="4">
          </div>
        </div>
        <div class="form-group">
          <label>Kart Üzerindeki İsim</label>
          <input type="text" id="cardName" placeholder="AD SOYAD" value="${session.userEmail?.split('@')[0]?.toUpperCase() || 'TEST USER'}">
        </div>
        
        <button type="submit" class="btn btn-primary" id="submitBtn">
          ₺${plan.monthlyPriceTRY} Öde
        </button>
        <button type="button" class="btn btn-cancel" onclick="window.close()">İptal</button>
      </form>
      
      <div class="secure">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
        256-bit SSL ile güvenli test ödemesi
      </div>
    </div>
  </div>
  
  <script>
    document.getElementById('paymentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      btn.textContent = 'İşleniyor...';
      btn.disabled = true;
      
      try {
        const res = await fetch('/api/webhook/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'checkout.session.completed',
            data: {
              sessionId: '${sessionId}',
              cardLast4: document.getElementById('cardNumber').value.slice(-4),
              cardBrand: 'visa'
            }
          })
        });
        
        const data = await res.json();
        if (data.success) {
          btn.textContent = '✓ Ödeme Başarılı!';
          btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          setTimeout(() => {
            alert('Test ödemesi başarılı! Planınız aktifleştirildi.');
            window.close();
          }, 500);
        } else {
          throw new Error(data.error || 'Ödeme başarısız');
        }
      } catch (err) {
        alert('Hata: ' + err.message);
        btn.textContent = '₺${plan.monthlyPriceTRY} Öde';
        btn.disabled = false;
      }
    });
    
    // Kart numarası formatla
    document.getElementById('cardNumber').addEventListener('input', function(e) {
      let v = e.target.value.replace(/\\s+/g, '').replace(/[^0-9]/gi, '');
      let matches = v.match(/\\d{4,16}/g);
      let match = matches && matches[0] || '';
      let parts = [];
      for (let i = 0, len = match.length; i < len; i += 4) {
        parts.push(match.substring(i, i + 4));
      }
      e.target.value = parts.length ? parts.join(' ') : v;
    });
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  async processPayment(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const { planId, amount } = req.body || {};
    const cardData = req.validatedCardData;

    if (!cardData) {
      return res.status(400).json({
        success: false,
        error: 'Kart bilgileri doğrulanamadı',
        code: 'VALIDATION_ERROR'
      });
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      return res.status(404).json({ 
        success: false,
        error: 'Plan bulunamadı',
        code: 'PLAN_NOT_FOUND',
        planId 
      });
    }

    if (plan.id === 'free') {
      return res.status(400).json({ 
        success: false,
        error: 'Free plan için ödeme gerekli değil',
        code: 'FREE_PLAN_PAYMENT'
      });
    }

    const expectedAmount = plan.monthlyPriceTRY;
    if (amount !== undefined && Math.abs(parseFloat(amount) - expectedAmount) > 0.01) {
      return res.status(400).json({ 
        success: false,
        error: 'Fiyat uyuşmazlığı',
        code: 'AMOUNT_MISMATCH',
        expected: expectedAmount,
        received: amount,
        planId: plan.id
      });
    }

    let transaction = null;

    try {
      paymentLogger.logPaymentStart('pending', user.id, planId, expectedAmount);
      logPaymentAttempt(req, user.id, planId, false);

      const result = await paymentService.processPayment(
        user.id,
        planId,
        expectedAmount,
        plan.currency || 'TRY',
        cardData,
        {
          userEmail: user.email,
          userName: user.displayName || user.email,
          userCreatedAt: user.createdAt,
          clientIp: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'
        }
      );

      transaction = paymentService.getTransaction(result.transactionId);

      if (!transaction) {
        throw new Error('Transaction oluşturulamadı');
      }

      if (result.success) {
        paymentLogger.logPaymentSuccess(result.transactionId, result.paymentId, result.gateway);
        logPaymentAttempt(req, user.id, planId, true);

        const subscription = await subscriptionService.activateSubscription(
          user.id,
          planId,
          {
            paymentId: result.paymentId,
            transactionId: result.transactionId,
            gateway: result.gateway,
            paymentMethod: result.gateway
          }
        );

        if (!subscription) {
          throw new Error('Abonelik aktivasyonu başarısız');
        }

        const receipt = receiptService.createReceipt(user.id, transaction, subscription);

        console.log(`[Billing] ✅ Payment successful: User ${user.id}, Plan ${planId}, Amount ${expectedAmount} ${plan.currency || 'TRY'}, Transaction ${result.transactionId}, Gateway: ${result.gateway}`);

        return res.json({
          success: true,
          message: 'Ödeme başarıyla tamamlandı',
          paymentId: result.paymentId,
          transactionId: result.transactionId,
          receiptNumber: receipt?.receiptNumber || null,
          gateway: result.gateway,
          subscription: {
            planId: subscription.planId,
            planName: subscription.planName,
            status: subscription.status,
            renewsAt: subscription.renewsAt
          },
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(result.error || 'Ödeme başarısız');
      }
    } catch (error) {
      const transactionId = transaction?.id || 'unknown';
      paymentLogger.logPaymentFailure(transactionId, error, paymentService.gateway);

      console.error('[Billing] ❌ Payment processing error:', {
        userId: user.id,
        planId,
        error: error.message,
        transactionId
      });

      const errorMessage = error.message || 'Ödeme işlenirken bir hata oluştu';
      
      const isCardError = error.message && (
        error.message.includes('card') || 
        error.message.includes('kart') || 
        error.message.includes('CVV') ||
        error.message.includes('expiry') ||
        error.message.includes('tarih')
      );
      
      if (isCardError) {
        return res.status(400).json({
          success: false,
          error: errorMessage,
          errorCode: 'CARD_ERROR',
          transactionId: transaction?.id
        });
      }

      return res.status(500).json({
        success: false,
        error: errorMessage,
        errorCode: 'PAYMENT_FAILED',
        transactionId: transaction?.id
      });
    }
  }

  async cancelSubscription(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const { reason } = req.body || {};
    const subscription = db.getUserSubscription(user.id);

    if (!subscription || subscription.planId === 'free') {
      return res.status(400).json({ error: 'İptal edilecek aktif abonelik bulunamadı' });
    }

    if (subscription.status === 'cancelled') {
      return res.status(400).json({ error: 'Abonelik zaten iptal edilmiş' });
    }

    const SubscriptionService = require('../services/subscriptionService');
    const cancelled = await SubscriptionService.cancelSubscription(user.id, reason || 'user_requested');

    if (cancelled) {
      return res.json({
        success: true,
        message: 'Abonelik iptal edildi',
        subscription: cancelled
      });
    }

    return res.status(500).json({ error: 'Abonelik iptal edilemedi' });
  }

  async renewSubscription(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const subscription = db.getUserSubscription(user.id);

    if (!subscription || subscription.planId === 'free') {
      return res.status(400).json({ error: 'Yenilenecek aktif abonelik bulunamadı' });
    }

    const SubscriptionService = require('../services/subscriptionService');
    const renewed = await SubscriptionService.renewSubscription(user.id);

    if (renewed) {
      return res.json({
        success: true,
        message: 'Abonelik yenilendi',
        subscription: renewed
      });
    }

    return res.status(500).json({ error: 'Abonelik yenilenemedi' });
  }

  async changePlan(req, res) {
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

    const currentSubscription = db.getUserSubscription(user.id);
    if (currentSubscription?.planId === planId) {
      return res.status(400).json({ error: 'Zaten bu plandasınız' });
    }

    if (plan.id === 'free') {
      const SubscriptionService = require('../services/subscriptionService');
      await SubscriptionService.cancelSubscription(user.id, 'downgrade_to_free');
      
      return res.json({
        success: true,
        message: 'Free plana geçiş yapıldı',
        subscription: db.getUserSubscription(user.id)
      });
    }

    return res.status(400).json({ 
      error: 'Plan değiştirmek için önce yeni plan için ödeme yapmalısınız',
      message: 'Lütfen /api/payment/process endpoint\'ini kullanarak ödeme yapın'
    });
  }

  async getPaymentStatus(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;

    const { paymentId } = req.params || {};
    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId zorunludur' });
    }

    const history = db.getBillingHistory(user.id);
    const payment = history.find(event => 
      event.paymentId === paymentId || 
      event.id === paymentId ||
      event.sessionId === paymentId
    );

    if (!payment) {
      return res.status(404).json({ error: 'Ödeme bulunamadı' });
    }

    return res.json({
      success: true,
      payment: {
        id: payment.paymentId || payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        planId: payment.planId,
        planName: payment.planName,
        timestamp: payment.timestamp,
        description: payment.description
      }
    });
  }

  async handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    
    if (!stripe || !sig) {
      return res.status(400).json({ error: 'Stripe webhook signature gerekli' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_TEST_WEBHOOK_SECRET;
    const verification = await paymentService.verifyWebhook('stripe', sig, req.body, webhookSecret);

    if (!verification.valid) {
      paymentLogger.log('error', 'webhook', 'Stripe webhook verification failed', {
        error: verification.error
      });
      return res.status(400).json({ error: `Webhook verification failed: ${verification.error}` });
    }

    const event = verification.event;
    paymentLogger.logWebhook(event.id, 'stripe', event.type, {
      eventId: event.id
    });

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata || {};
      const userId = metadata.userId;
      const planId = metadata.planId;
      const transactionId = metadata.transactionId;

      if (userId && planId) {
        const plan = this.getPlan(planId);
        if (plan) {
          const transaction = transactionId ? paymentService.getTransaction(transactionId) : null;
          
          if (transaction) {
            paymentService.updateTransaction(transactionId, {
              status: 'succeeded',
              gatewayTransactionId: paymentIntent.id
            });
          }

          db.addBillingEvent(userId, {
            type: 'payment',
            planId: plan.id,
            planName: plan.title,
            amount: plan.monthlyPriceTRY,
            currency: 'TRY',
            interval: plan.interval,
            provider: 'stripe',
            status: 'succeeded',
            paymentId: paymentIntent.id,
            transactionId: transactionId,
            description: `${plan.title} planı için ödeme tamamlandı (webhook)`,
            timestamp: Date.now()
          });

          const subscription = await subscriptionService.activateSubscription(
            userId,
            plan.id,
            {
              paymentId: paymentIntent.id,
              transactionId: transactionId,
              gateway: 'stripe'
            }
          );

          if (transaction) {
            receiptService.createReceipt(userId, transaction, subscription);
          }

          paymentLogger.logPaymentSuccess(transactionId || 'webhook', paymentIntent.id, 'stripe');
        }
      }
    }

    return res.json({ received: true });
  }

  subscribe(req, res) {
    return this.checkout(req, res);
  }

  getHistory(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;
    
    const history = db.getBillingHistory(user.id);
    const receipts = receiptService.getReceipts(user.id);
    
    return res.json({ 
      success: true, 
      history,
      receipts
    });
  }

  async getReceipts(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;
    
    const receipts = receiptService.getReceipts(user.id);
    return res.json({ success: true, receipts });
  }

  async getReceipt(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;
    
    const { receiptNumber } = req.params;
    if (!receiptNumber) {
      return res.status(400).json({ error: 'Receipt number required' });
    }
    
    const receipt = receiptService.getReceiptByNumber(receiptNumber);
    if (!receipt || receipt.userId !== user.id) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    return res.json({ success: true, receipt });
  }
}

module.exports = new BillingController();

