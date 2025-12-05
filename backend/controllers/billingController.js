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
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');

let Iyzipay;
let iyzipay;

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

      return res.json(ResponseFormatter.success({
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
      }));
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
      
      return res.json(ResponseFormatter.success({
        plans: fallbackPlans,
        currentPlan: 'free',
        subscription: null,
        history: []
      }));
    }
  }

  getMySubscription(req, res) {
    try {
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

      const SubscriptionModel = require('../core/database/models/subscription.model');
      const limits = SubscriptionModel.getPlanLimits(subscription.planId);

      return res.json(ResponseFormatter.success({
        subscription: {
          ...subscription,
          limits
        }
      }));
    } catch (error) {
      console.error('[BillingController] getMySubscription error:', error);
      return res.status(500).json(ResponseFormatter.error('Abonelik bilgisi alınamadı', 'SUBSCRIPTION_ERROR'));
    }
  }

  // POST /api/checkout veya /api/billing/checkout
  // iyzico Checkout Form ile güvenli ödeme sayfası oluşturur
  async checkout(req, res) {
    try {
      const user = this.requireUser(req, res);
      if (!user) return;

      const { planId } = req.body || {};
      if (!planId) {
        return res.status(400).json(ResponseFormatter.error('planId zorunludur', 'MISSING_PLAN_ID'));
      }

      const plan = this.getPlan(planId);
      if (!plan) {
        return res.status(404).json(ResponseFormatter.error('Plan bulunamadı', 'PLAN_NOT_FOUND'));
      }

      if (plan.id === 'free') {
        return res.status(400).json(ResponseFormatter.error('Free plan için ödeme gerekli değil', 'FREE_PLAN_NO_PAYMENT'));
      }

      const conversationId = crypto.randomBytes(16).toString('hex');
      const basketId = 'B' + Date.now();

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

      if (!iyzipay) {
        const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
        const mockUrl = `${baseUrl}/api/checkout/mock/${conversationId}`;
        
        return res.json(ResponseFormatter.success({
          sessionId: conversationId,
          checkoutUrl: mockUrl,
          mode: 'mock',
          message: 'iyzico SDK yüklü değil, mock ödeme sayfası kullanılıyor',
          plan: {
            id: plan.id,
            title: plan.title,
            amount: plan.monthlyPriceTRY,
            currency: plan.currency
          }
        }));
      }

      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
      const callbackUrl = process.env.IYZICO_CALLBACK_URL || `${baseUrl}/api/payment/callback`;

      const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: conversationId,
        price: plan.monthlyPriceTRY.toString(),
        paidPrice: plan.monthlyPriceTRY.toString(),
        currency: Iyzipay.CURRENCY.TRY,
        basketId: basketId,
        paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
        callbackUrl: callbackUrl,
        enabledInstallments: [1],
        buyer: {
          id: user.id,
          name: user.displayName?.split(' ')[0] || 'Kullanıcı',
          surname: user.displayName?.split(' ').slice(1).join(' ') || 'Kullanıcı',
          gsmNumber: '+905350000000',
          email: user.email,
          identityNumber: '11111111111',
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

      return new Promise((resolve) => {
        iyzipay.checkoutFormInitialize.create(request, (err, result) => {
          if (err) {
            console.error('[Billing] iyzico error:', err);
            return resolve(res.status(500).json(ResponseFormatter.error(
              'Ödeme sayfası oluşturulamadı', 
              'CHECKOUT_ERROR',
              { details: err.message }
            )));
          }

          if (result.status !== 'success') {
            console.error('[Billing] iyzico result error:', result);
            return resolve(res.status(400).json(ResponseFormatter.error(
              result.errorMessage || 'Ödeme başlatılamadı',
              result.errorCode || 'CHECKOUT_FAILED'
            )));
          }

          console.log('[Billing] Checkout created:', conversationId);

          session.token = result.token;
          checkoutSessions.set(conversationId, session);

          return resolve(res.json(ResponseFormatter.success({
            sessionId: conversationId,
            checkoutUrl: result.paymentPageUrl,
            token: result.token,
            mode: 'live',
            plan: {
              id: plan.id,
              title: plan.title,
              amount: plan.monthlyPriceTRY,
              currency: plan.currency
            }
          })));
        });
      });
    } catch (error) {
      console.error('[BillingController] checkout error:', error);
      return res.status(500).json(ResponseFormatter.error('Checkout oluşturulamadı', 'CHECKOUT_ERROR'));
    }
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

  async handleWebhook(req, res) {
    try {
      const { type, data, token } = req.body || {};

      paymentLogger.logWebhook('webhook', 'iyzico', type || 'unknown', {
        type,
        hasData: !!data,
        hasToken: !!token
      });

      if (type === 'checkout.session.completed' && data?.sessionId) {
        const session = checkoutSessions.get(data.sessionId);
        if (!session) {
          return res.status(404).json(ResponseFormatter.error('Session bulunamadı', 'SESSION_NOT_FOUND'));
        }

        if (session.status === 'completed') {
          return res.json(ResponseFormatter.success({
            message: 'Zaten işlendi',
            subscription: db.getUserSubscription(session.userId)
          }));
        }

        const plan = this.getPlan(session.planId);
        if (!plan) {
          return res.status(404).json(ResponseFormatter.error('Plan bulunamadı', 'PLAN_NOT_FOUND'));
        }

        const transaction = paymentService.getTransaction(session.id) || paymentService.createTransaction(
          session.userId,
          session.planId,
          session.amount,
          session.currency,
          { userEmail: session.userEmail }
        );

        db.addBillingEvent(session.userId, {
          type: 'payment',
          planId: plan.id,
          planName: plan.title,
          amount: plan.monthlyPriceTRY,
          currency: 'TRY',
          interval: plan.interval,
          provider: 'MOCK',
          status: 'succeeded',
          paymentId: `mock_${session.id}`,
          transactionId: transaction.id,
          cardLast4: data.cardLast4 || '4242',
          cardBrand: data.cardBrand || 'visa',
          sessionId: data.sessionId,
          description: `${plan.title} planı için ödeme tamamlandı`,
          timestamp: Date.now()
        });

        paymentService.updateTransaction(transaction.id, {
          status: 'succeeded',
          gatewayTransactionId: `mock_${session.id}`,
          cardLast4: data.cardLast4 || '4242',
          cardBrand: data.cardBrand || 'visa'
        });

        const subscription = await subscriptionService.activateSubscription(
          session.userId,
          plan.id,
          {
            paymentId: `mock_${session.id}`,
            transactionId: transaction.id,
            gateway: 'mock'
          }
        );

        if (transaction) {
          receiptService.createReceipt(session.userId, transaction, subscription);
        }

        session.status = 'completed';
        checkoutSessions.set(data.sessionId, session);

        paymentLogger.logPaymentSuccess(transaction.id, `mock_${session.id}`, 'mock');

        return res.json(ResponseFormatter.success({
          message: 'Abonelik aktifleştirildi',
          subscription: subscription
        }));
      }

      if (token && iyzipay) {
        return new Promise((resolve) => {
          iyzipay.checkoutForm.retrieve({
            locale: Iyzipay.LOCALE.TR,
            token: token
          }, async (err, result) => {
            if (err) {
              console.error('[Webhook] iyzico error:', err);
              paymentLogger.log('error', 'webhook', 'Webhook işlenemedi', { error: err.message });
              return resolve(res.status(500).json(ResponseFormatter.error('Webhook işlenemedi', 'WEBHOOK_ERROR')));
            }

            paymentLogger.logWebhook(result.conversationId || 'unknown', 'iyzico', 'webhook', {
              status: result.status,
              paymentStatus: result.paymentStatus
            });

            if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
              const session = checkoutSessions.get(result.conversationId);
              if (session && session.status !== 'completed') {
                const plan = this.getPlan(session.planId);
                
                const transaction = paymentService.getTransaction(result.conversationId);
                if (transaction) {
                  paymentService.updateTransaction(result.conversationId, {
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
                  transactionId: result.conversationId,
                  cardLast4: result.lastFourDigits,
                  cardBrand: result.cardAssociation,
                  description: `${plan.title} planı için ödeme tamamlandı`,
                  timestamp: Date.now()
                });

                const subscription = await subscriptionService.activateSubscription(
                  session.userId,
                  plan.id,
                  {
                    paymentId: result.paymentId,
                    transactionId: result.conversationId,
                    gateway: 'iyzico'
                  }
                );

                if (transaction) {
                  receiptService.createReceipt(session.userId, transaction, subscription);
                }

                session.status = 'completed';
                checkoutSessions.set(result.conversationId, session);

                paymentLogger.logPaymentSuccess(result.conversationId, result.paymentId, 'iyzico');
              }
            }

            return resolve(res.json(ResponseFormatter.success({ received: true })));
          });
        });
      }

      return res.json(ResponseFormatter.success({ message: 'Webhook received' }));
    } catch (error) {
      console.error('[BillingController] handleWebhook error:', error);
      paymentLogger.log('error', 'webhook', 'Webhook processing error', { error: error.message });
      return res.status(500).json(ResponseFormatter.error('Webhook işlenemedi', 'WEBHOOK_ERROR'));
    }
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
    const startTime = Date.now();
    let transaction = null;
    
    try {
      const user = this.requireUser(req, res);
      if (!user) return;

      const { planId, amount } = req.body || {};
      const cardData = req.validatedCardData;

      if (!cardData) {
        return res.status(400).json(ResponseFormatter.error(
          'Kart bilgileri doğrulanamadı',
          'VALIDATION_ERROR'
        ));
      }

      const plan = this.getPlan(planId);
      if (!plan) {
        return res.status(404).json(ResponseFormatter.error(
          'Plan bulunamadı',
          'PLAN_NOT_FOUND',
          { planId }
        ));
      }

      if (plan.id === 'free') {
        return res.status(400).json(ResponseFormatter.error(
          'Free plan için ödeme gerekli değil',
          'FREE_PLAN_PAYMENT'
        ));
      }

      const expectedAmount = plan.monthlyPriceTRY;
      if (amount !== undefined && Math.abs(parseFloat(amount) - expectedAmount) > 0.01) {
        return res.status(400).json(ResponseFormatter.error(
          'Fiyat uyuşmazlığı',
          'AMOUNT_MISMATCH',
          {
            expected: expectedAmount,
            received: amount,
            planId: plan.id
          }
        ));
      }

      const currentSubscription = db.getUserSubscription(user.id);
      if (currentSubscription?.planId === planId && currentSubscription?.status === 'active') {
        return res.status(400).json(ResponseFormatter.error(
          'Bu plan zaten aktif',
          'PLAN_ALREADY_ACTIVE',
          { planId }
        ));
      }

      paymentLogger.logPaymentStart(transaction?.id || 'pending', user.id, planId, expectedAmount);
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
        throw createError('Transaction oluşturulamadı', 500, 'TRANSACTION_CREATION_FAILED');
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
          throw createError('Abonelik aktivasyonu başarısız', 500, 'SUBSCRIPTION_ACTIVATION_FAILED');
        }

        const receipt = receiptService.createReceipt(user.id, transaction, subscription);

        db.addBillingEvent(user.id, {
          type: 'payment',
          planId: plan.id,
          planName: plan.title,
          amount: expectedAmount,
          currency: plan.currency || 'TRY',
          interval: plan.interval || 'monthly',
          provider: result.gateway,
          status: 'succeeded',
          paymentId: result.paymentId,
          transactionId: result.transactionId,
          receiptNumber: receipt?.receiptNumber,
          cardLast4: transaction.cardLast4,
          cardBrand: transaction.cardBrand,
          description: `${plan.title} planı için ödeme tamamlandı`,
          timestamp: Date.now()
        });

        const processingTime = Date.now() - startTime;
        console.log(`[Billing] ✅ Payment successful: User ${user.id}, Plan ${planId}, Amount ${expectedAmount} ${plan.currency || 'TRY'}, Transaction ${result.transactionId}, Gateway: ${result.gateway}, Time: ${processingTime}ms`);

        return res.json(ResponseFormatter.success({
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
          transaction: {
            id: transaction.id,
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
            cardLast4: transaction.cardLast4,
            cardBrand: transaction.cardBrand
          },
          timestamp: new Date().toISOString(),
          processingTime: `${processingTime}ms`
        }));
      } else {
        throw createError(result.error || 'Ödeme başarısız', 400, 'PAYMENT_FAILED');
      }
    } catch (error) {
      const transactionId = transaction?.id || 'unknown';
      paymentLogger.logPaymentFailure(transactionId, error, paymentService.gateway);

      const processingTime = Date.now() - startTime;
      console.error('[Billing] ❌ Payment processing error:', {
        userId: req.user?.id || 'unknown',
        planId: req.body?.planId || 'unknown',
        error: error.message,
        transactionId,
        processingTime: `${processingTime}ms`
      });

      const errorMessage = error.message || 'Ödeme işlenirken bir hata oluştu';
      
      const isCardError = error.message && (
        error.message.includes('card') || 
        error.message.includes('kart') || 
        error.message.includes('CVV') ||
        error.message.includes('expiry') ||
        error.message.includes('tarih') ||
        error.message.includes('reddedildi') ||
        error.message.includes('bakiye')
      );
      
      if (isCardError) {
        return res.status(400).json(ResponseFormatter.error(
          errorMessage,
          'CARD_ERROR',
          { transactionId: transaction?.id }
        ));
      }

      if (error.isOperational) {
        return res.status(error.statusCode || 500).json(ResponseFormatter.error(
          errorMessage,
          error.code || 'PAYMENT_FAILED',
          { transactionId: transaction?.id }
        ));
      }

      return res.status(500).json(ResponseFormatter.error(
        errorMessage,
        'PAYMENT_FAILED',
        { transactionId: transaction?.id }
      ));
    }
  }

  async cancelSubscription(req, res) {
    try {
      const user = this.requireUser(req, res);
      if (!user) return;

      const { reason } = req.body || {};
      const subscription = db.getUserSubscription(user.id);

      if (!subscription || subscription.planId === 'free') {
        return res.status(400).json(ResponseFormatter.error('İptal edilecek aktif abonelik bulunamadı', 'NO_ACTIVE_SUBSCRIPTION'));
      }

      if (subscription.status === 'cancelled') {
        return res.status(400).json(ResponseFormatter.error('Abonelik zaten iptal edilmiş', 'ALREADY_CANCELLED'));
      }

      const SubscriptionService = require('../services/subscriptionService');
      const cancelled = await SubscriptionService.cancelSubscription(user.id, reason || 'user_requested');

      if (cancelled) {
        db.addBillingEvent(user.id, {
          type: 'cancellation',
          planId: cancelled.planId,
          planName: cancelled.planName,
          reason: reason || 'user_requested',
          status: 'cancelled',
          timestamp: Date.now()
        });

        return res.json(ResponseFormatter.success({
          message: 'Abonelik iptal edildi',
          subscription: cancelled
        }));
      }

      return res.status(500).json(ResponseFormatter.error('Abonelik iptal edilemedi', 'CANCEL_FAILED'));
    } catch (error) {
      console.error('[BillingController] cancelSubscription error:', error);
      return res.status(500).json(ResponseFormatter.error('Abonelik iptal edilemedi', 'CANCEL_ERROR'));
    }
  }

  async renewSubscription(req, res) {
    try {
      const user = this.requireUser(req, res);
      if (!user) return;

      const subscription = db.getUserSubscription(user.id);

      if (!subscription || subscription.planId === 'free') {
        return res.status(400).json(ResponseFormatter.error('Yenilenecek aktif abonelik bulunamadı', 'NO_ACTIVE_SUBSCRIPTION'));
      }

      const SubscriptionService = require('../services/subscriptionService');
      const renewed = await SubscriptionService.renewSubscription(user.id);

      if (renewed) {
        db.addBillingEvent(user.id, {
          type: 'renewal',
          planId: renewed.planId,
          planName: renewed.planName,
          status: 'renewed',
          renewsAt: renewed.renewsAt,
          timestamp: Date.now()
        });

        return res.json(ResponseFormatter.success({
          message: 'Abonelik yenilendi',
          subscription: renewed
        }));
      }

      return res.status(500).json(ResponseFormatter.error('Abonelik yenilenemedi', 'RENEW_FAILED'));
    } catch (error) {
      console.error('[BillingController] renewSubscription error:', error);
      return res.status(500).json(ResponseFormatter.error('Abonelik yenilenemedi', 'RENEW_ERROR'));
    }
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
      const newSubscription = db.getUserSubscription(user.id);
      
      db.addBillingEvent(user.id, {
        type: 'downgrade',
        fromPlanId: currentSubscription?.planId || 'unknown',
        toPlanId: 'free',
        status: 'completed',
        timestamp: Date.now()
      });

      return res.json(ResponseFormatter.success({
        message: 'Free plana geçiş yapıldı',
        subscription: newSubscription
      }));
    }

    return this.checkout(req, res);
  }

  async getPaymentStatus(req, res) {
    try {
      const user = this.requireUser(req, res);
      if (!user) return;

      const { paymentId } = req.params || {};
      if (!paymentId) {
        return res.status(400).json(ResponseFormatter.error('Ödeme ID gereklidir', 'MISSING_PAYMENT_ID'));
      }

      const history = db.getBillingHistory(user.id) || [];
      const payment = history.find(event => 
        event.paymentId === paymentId || 
        event.id === paymentId ||
        event.sessionId === paymentId ||
        event.conversationId === paymentId
      );

      if (!payment) {
        const transaction = paymentService.getTransaction(paymentId);
        if (transaction && transaction.userId === user.id) {
          return res.json(ResponseFormatter.success({
            payment: {
              id: transaction.id,
              status: transaction.status,
              amount: transaction.amount,
              currency: transaction.currency,
              planId: transaction.planId,
              gateway: transaction.gateway || 'iyzico',
              createdAt: transaction.createdAt,
              updatedAt: transaction.updatedAt
            }
          }));
        }
        return res.status(404).json(ResponseFormatter.error('Ödeme bulunamadı', 'PAYMENT_NOT_FOUND'));
      }

      return res.json(ResponseFormatter.success({
        payment: {
          id: payment.paymentId || payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          planId: payment.planId,
          planName: payment.planName,
          timestamp: payment.timestamp,
          description: payment.description,
          provider: payment.provider || 'iyzico'
        }
      }));
    } catch (error) {
      console.error('[BillingController] getPaymentStatus error:', error);
      return res.status(500).json(ResponseFormatter.error('Ödeme durumu alınamadı', 'PAYMENT_STATUS_ERROR'));
    }
  }


  subscribe(req, res) {
    return this.checkout(req, res);
  }

  getHistory(req, res) {
    try {
      const user = this.requireUser(req, res);
      if (!user) return;
      
      const history = db.getBillingHistory(user.id) || [];
      const receipts = receiptService.getReceipts(user.id) || [];
      const subscription = db.getUserSubscription(user.id);
      
      return res.json(ResponseFormatter.success({ 
        history: Array.isArray(history) ? history.slice(0, 50) : [],
        receipts: Array.isArray(receipts) ? receipts.slice(0, 20) : [],
        subscription: subscription ? {
          planId: subscription.planId,
          planName: subscription.planName,
          status: subscription.status,
          renewsAt: subscription.renewsAt
        } : null,
        totalPayments: history.filter(h => h.type === 'payment' && h.status === 'succeeded').length,
        totalAmount: history
          .filter(h => h.type === 'payment' && h.status === 'succeeded')
          .reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0)
      }));
    } catch (error) {
      console.error('[BillingController] getHistory error:', error);
      return res.status(500).json(ResponseFormatter.error('Fatura geçmişi alınamadı', 'HISTORY_ERROR'));
    }
  }

  async getReceipts(req, res) {
    try {
      const user = this.requireUser(req, res);
      if (!user) return;
      
      const receipts = receiptService.getReceipts(user.id) || [];
      
      return res.json(ResponseFormatter.success({ 
        receipts: Array.isArray(receipts) ? receipts.slice(0, 50) : [],
        count: receipts.length
      }));
    } catch (error) {
      console.error('[BillingController] getReceipts error:', error);
      return res.status(500).json(ResponseFormatter.error('Makbuzlar alınamadı', 'RECEIPTS_ERROR'));
    }
  }

  async getReceipt(req, res) {
    try {
      const user = this.requireUser(req, res);
      if (!user) return;
      
      const { receiptNumber } = req.params;
      if (!receiptNumber) {
        return res.status(400).json(ResponseFormatter.error('Makbuz numarası gereklidir', 'MISSING_RECEIPT_NUMBER'));
      }
      
      const receipt = receiptService.getReceiptByNumber(receiptNumber);
      if (!receipt || receipt.userId !== user.id) {
        return res.status(404).json(ResponseFormatter.error('Makbuz bulunamadı', 'RECEIPT_NOT_FOUND'));
      }
      
      return res.json(ResponseFormatter.success({ receipt }));
    } catch (error) {
      console.error('[BillingController] getReceipt error:', error);
      return res.status(500).json(ResponseFormatter.error('Makbuz alınamadı', 'RECEIPT_ERROR'));
    }
  }
}

module.exports = new BillingController();

