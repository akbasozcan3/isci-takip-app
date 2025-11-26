// Billing / Subscription Controller - iyzico Entegrasyonu
// Kart bilgileri asla backend'den geçmez, sadece iyzico'nun güvenli sayfasında işlenir

const db = require('../config/database');
const crypto = require('crypto');

// iyzico SDK
let Iyzipay;
let iyzipay;

try {
  Iyzipay = require('iyzipay');
  
  // iyzico yapılandırması (.env'den okunur)
  iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY || 'sandbox-xxxxxxxx',
    secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-xxxxxxxx',
    uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
  });
  
  console.log('[Billing] iyzico SDK yüklendi:', process.env.IYZICO_BASE_URL || 'sandbox');
} catch (err) {
  console.warn('[Billing] iyzico SDK yüklenemedi, mock mod aktif:', err.message);
  iyzipay = null;
}

// Plan Kataloğu
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
    priceLabel: '₺699 / ay',
    monthlyPrice: 699,
    monthlyPriceTRY: 699,
    currency: 'TRY',
    interval: 'monthly',
    badge: 'Popüler',
    description: 'Profesyoneller için gelişmiş özellikler',
    features: [
      'Öncelikli destek',
      '5 çalışma alanı',
      'Gerçek zamanlı takip',
      'Gelişmiş raporlama',
      '90 günlük veri saklama'
    ]
  },
  {
    id: 'business',
    title: 'Business',
    priceLabel: '₺999 / ay',
    monthlyPrice: 999,
    monthlyPriceTRY: 999,
    currency: 'TRY',
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
      'Sınırsız veri saklama'
    ]
  }
];

// Checkout session'ları (geçici, bellek içi)
const checkoutSessions = new Map();

class BillingController {
  constructor() {
    this.plans = PLAN_CATALOG;
  }

  getPlan(planId) {
    return this.plans.find(plan => plan.id === planId);
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

  // GET /api/plans - Tüm planları listele
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

  // GET /api/payment/callback - iyzico ödeme sonrası callback
  async paymentCallback(req, res) {
    const { token } = req.body || req.query || {};

    if (!token) {
      return res.redirect('/payment-error?message=Token+bulunamadı');
    }

    if (!iyzipay) {
      // Mock mod - session'dan bilgileri al
      return res.redirect('/UpgradeScreen?status=success');
    }

    // iyzico'dan ödeme sonucunu al
    return new Promise((resolve) => {
      iyzipay.checkoutForm.retrieve({
        locale: Iyzipay.LOCALE.TR,
        token: token
      }, async (err, result) => {
        if (err) {
          console.error('[Billing] Callback error:', err);
          return resolve(res.redirect('/payment-error?message=Ödeme+doğrulanamadı'));
        }

        console.log('[Billing] Payment result:', JSON.stringify(result, null, 2));

        if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
          // Ödeme başarılı - aboneliği aktifleştir
          const conversationId = result.conversationId;
          const session = checkoutSessions.get(conversationId);

          if (session) {
            const plan = this.getPlan(session.planId);
            
            // Billing event kaydet
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

            // Aboneliği aktifleştir
            db.setUserSubscription(session.userId, {
              planId: plan.id,
              planName: plan.title,
              price: plan.monthlyPriceTRY,
              priceLabel: plan.priceLabel,
              currency: 'TRY',
              interval: plan.interval,
              status: 'active',
              renewsAt: this.getRenewalDate(plan.interval),
              iyzicoPaymentId: result.paymentId
            });

            session.status = 'completed';
            checkoutSessions.set(conversationId, session);

            console.log('[Billing] Subscription activated for user:', session.userId);
          }

          // Başarı sayfasına yönlendir
          return resolve(res.redirect('/UpgradeScreen?status=success'));
        } else {
          // Ödeme başarısız
          const errorMessage = encodeURIComponent(result.errorMessage || 'Ödeme başarısız');
          return resolve(res.redirect(`/payment-error?message=${errorMessage}`));
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
        return res.json({ success: true, message: 'Zaten işlendi' });
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
        description: `${plan.title} planı için ödeme tamamlandı`
      });

      // Abonelik aktifleştir
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
      checkoutSessions.set(data.sessionId, session);

      return res.json({
        success: true,
        message: 'Abonelik aktifleştirildi',
        subscription: db.getUserSubscription(session.userId)
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

  // Eski metodlar (geriye uyumluluk)
  subscribe(req, res) {
    return this.checkout(req, res);
  }

  getHistory(req, res) {
    const user = this.requireUser(req, res);
    if (!user) return;
    return res.json({ success: true, history: db.getBillingHistory(user.id) });
  }
}

module.exports = new BillingController();

