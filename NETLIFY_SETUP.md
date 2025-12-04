# 🚀 Netlify Backend Deployment - Hızlı Başlangıç

## ⚠️ ÖNEMLİ UYARI

Netlify **serverless functions** kullanır. Bu demek oluyor ki:
- ✅ REST API endpoint'leri çalışır
- ❌ **Socket.IO çalışmaz** (persistent connections serverless'de desteklenmez)
- ❌ PM2 gibi process manager'lar çalışmaz
- ⚠️ Cold start olabilir (ilk request yavaş)
- ✅ Ücretsiz tier var
- ✅ Otomatik SSL

**GPS tracking uygulaması için Railway.app önerilir!** Socket.IO ve real-time özellikler için gerekli.

---

## 📋 Netlify'a Deploy Etme

### 1. Netlify'a Git ve Giriş Yap
https://app.netlify.com → GitHub ile giriş yap

### 2. Yeni Site Oluştur
1. "Add new project" butonuna tıkla
2. "Import an existing project" seç
3. GitHub repository'yi seç: `akbasozcan3/isci-takip-app`

### 3. Build Settings Ayarla

**Build settings:**
- **Base directory:** `backend` (veya boş bırak)
- **Build command:** `npm install` (veya boş bırak - Netlify otomatik yükler)
- **Publish directory:** (boş bırak - functions için gerekli değil)
- **Functions directory:** `netlify/functions`

**Deploy settings:**
- **Branch to deploy:** `main`
- **Production branch:** `main`

### 4. Environment Variables Ekle

Netlify dashboard → Site settings → Environment variables → Add variable:

```env
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-app-url
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Deploy!

"Deploy site" butonuna tıkla. Netlify otomatik deploy eder.

**Backend URL:**
```
https://your-site-name.netlify.app/.netlify/functions/api
```

---

## 🔧 Mobil App'te API URL Güncelle

`app.json` dosyasını güncelle:

```json
{
  "expo": {
    "extra": {
      "apiBase": "https://your-site-name.netlify.app/.netlify/functions/api"
    }
  }
}
```

---

## ⚠️ Netlify Sınırlamaları

### Socket.IO Çalışmaz
Netlify Functions serverless olduğu için persistent WebSocket connections desteklemez. Socket.IO için:
- **Railway.app kullan** (önerilir)
- Veya Socket.IO'yu başka bir servise taşı

### Timeout
- Free plan: 10 saniye
- Pro plan: 26 saniye
- Business plan: 26 saniye

Uzun süren işlemler için timeout hatası alabilirsin.

### Cold Start
İlk request yavaş olabilir (1-3 saniye). Sonraki request'ler hızlı.

---

## 🎯 Socket.IO İçin Çözüm

### Seçenek 1: Railway.app (ÖNERİLEN)
Socket.IO ve real-time özellikler için Railway.app kullan:
- ✅ Full Node.js backend
- ✅ Socket.IO çalışır
- ✅ PM2 desteği
- ✅ Background jobs
- ✅ $5/ay başlangıç

**Railway'a deploy:**
1. https://railway.app → New Project → Deploy from GitHub
2. Repository seç: `akbasozcan3/isci-takip-app`
3. Root directory: `backend`
4. Environment variables ekle
5. Deploy!

Detaylar: `backend/README_DEPLOY.md`

### Seçenek 2: Hybrid Yaklaşım
- REST API → Netlify
- Socket.IO → Railway (sadece WebSocket için)

---

## 📊 Netlify vs Railway Karşılaştırma

| Özellik | Netlify | Railway |
|---------|---------|---------|
| **Fiyat** | Ücretsiz tier | $5/ay |
| **Socket.IO** | ❌ Çalışmaz | ✅ Çalışır |
| **REST API** | ✅ Çalışır | ✅ Çalışır |
| **Background Jobs** | ❌ Zor | ✅ Çalışır |
| **PM2** | ❌ Çalışmaz | ✅ Çalışır |
| **Cold Start** | ⚠️ Var (1-3s) | ✅ Yok |
| **Timeout** | 10s (Free) | ✅ Yok |
| **SSL** | ✅ Otomatik | ✅ Otomatik |

---

## ✅ Netlify'da Deploy Et (Sadece REST API)

Eğer sadece REST API kullanacaksan ve Socket.IO gerekmiyorsa:

1. Netlify'a git → Import project
2. GitHub repo'yu seç: `akbasozcan3/isci-takip-app`
3. Build settings:
   - Build command: (boş bırak)
   - Functions directory: `netlify/functions`
4. Environment variables ekle
5. Deploy!

**Backend URL:**
```
https://your-site.netlify.app/.netlify/functions/api
```

---

## 🎯 Öneri

**GPS tracking uygulaması için Railway.app kullan!**

Neden?
- ✅ Socket.IO çalışır (real-time tracking için gerekli)
- ✅ PM2 ile process management
- ✅ Background jobs
- ✅ Full Node.js backend
- ✅ $5/ay başlangıç (ücretsiz kredi var)

Netlify sadece REST API için uygun. GPS tracking için Socket.IO gerekli olduğundan Railway daha iyi.

---

## 📞 Yardım

Sorun yaşarsan:
1. Netlify log'larını kontrol et (Site → Functions → Logs)
2. Environment variables kontrol et
3. Health check yap: `GET https://your-site.netlify.app/.netlify/functions/api/health`

