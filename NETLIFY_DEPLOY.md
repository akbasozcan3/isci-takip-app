# 🚀 Netlify Backend Deployment Rehberi

## ⚠️ ÖNEMLİ NOT

Netlify **serverless functions** kullanır. Bu demek oluyor ki:
- ✅ API endpoint'leri çalışır
- ❌ Socket.IO persistent connections çalışmaz (serverless'de sınırlı)
- ❌ PM2 gibi process manager'lar çalışmaz
- ❌ Background jobs zor
- ✅ Ücretsiz tier var
- ✅ Otomatik SSL

**Öneri:** Socket.IO ve real-time özellikler için **Railway.app** daha uygun. Ama sadece REST API için Netlify iyi çalışır.

---

## 📋 Netlify'a Deploy Etme

### 1. Netlify'a Git
https://app.netlify.com → GitHub ile giriş

### 2. Yeni Site Oluştur
1. "Add new project" → "Import an existing project"
2. GitHub repository'yi seç: `akbasozcan3/isci-takip-app`
3. Build settings:
   - **Build command:** `cd backend && npm install`
   - **Publish directory:** `backend/public` (opsiyonel)
   - **Functions directory:** `netlify/functions`

### 3. Environment Variables Ekle

Netlify dashboard → Site settings → Environment variables:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-app-url
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Deploy!

Netlify otomatik deploy eder. Backend URL:
```
https://your-site-name.netlify.app/.netlify/functions/api
```

---

## 🔧 Netlify Functions Yapısı

Netlify serverless functions kullanır:
- Her API request ayrı function instance'ı
- Cold start olabilir (ilk request yavaş)
- 10 saniye timeout (Pro plan'da 26 saniye)

---

## ⚠️ Sınırlamalar

### Socket.IO Çalışmaz
Netlify Functions serverless olduğu için persistent WebSocket connections desteklemez. Socket.IO için:
- Railway.app kullan (önerilir)
- Veya Socket.IO'yu başka bir servise taşı

### Background Jobs
Netlify'da cron jobs veya background tasks için:
- Netlify Scheduled Functions kullan
- Veya external service kullan (Railway, Render)

---

## 🎯 Alternatif: Railway.app (ÖNERİLEN)

Socket.IO ve real-time özellikler için **Railway.app** daha uygun:
- ✅ Full Node.js backend
- ✅ Socket.IO çalışır
- ✅ PM2 desteği
- ✅ Background jobs
- ✅ $5/ay başlangıç

**Railway'a deploy:**
1. https://railway.app → New Project → Deploy from GitHub
2. Repository seç
3. Environment variables ekle
4. Deploy!

Detaylar: `backend/README_DEPLOY.md`

---

## 📊 Netlify vs Railway Karşılaştırma

| Özellik | Netlify | Railway |
|---------|---------|---------|
| Fiyat | Ücretsiz tier | $5/ay |
| Socket.IO | ❌ Çalışmaz | ✅ Çalışır |
| REST API | ✅ Çalışır | ✅ Çalışır |
| Background Jobs | ❌ Zor | ✅ Çalışır |
| PM2 | ❌ Çalışmaz | ✅ Çalışır |
| Cold Start | ⚠️ Var | ✅ Yok |
| Timeout | 10s (Free) | ✅ Yok |

---

## ✅ Netlify'da Deploy Et (Sadece REST API)

Eğer sadece REST API kullanacaksan:

1. Netlify'a git → Import project
2. GitHub repo'yu seç
3. Build settings ayarla
4. Environment variables ekle
5. Deploy!

**Backend URL:**
```
https://your-site.netlify.app/.netlify/functions/api
```

Mobil app'te `app.json` güncelle:
```json
"extra": {
  "apiBase": "https://your-site.netlify.app/.netlify/functions/api"
}
```

---

## 🎯 Öneri

**Socket.IO ve real-time tracking için Railway.app kullan!**

Netlify sadece REST API için uygun. GPS tracking uygulaması için Railway daha iyi.

