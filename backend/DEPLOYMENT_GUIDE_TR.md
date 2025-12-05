# 🚀 Backend Deployment Rehberi - Türkçe

## 🥇 En İyi Seçenekler (Sıralama)

### 1. Railway.app ⭐ ÖNERİLEN
**Fiyat:** $5-10/ay (ücretsiz $5 kredi/ay)
**Kurulum:** 5 dakika
**Neden En İyi:**
- ✅ Otomatik GitHub deployment
- ✅ SSL sertifikası otomatik
- ✅ PM2 desteği (tüm servisler çalışır)
- ✅ Environment variables kolay yönetim
- ✅ Log görüntüleme
- ✅ Database desteği (PostgreSQL, MySQL, Redis)
- ✅ Çok kolay kullanım

**Adımlar:**
1. https://railway.app → GitHub ile giriş yap
2. "New Project" → "Deploy from GitHub repo"
3. Repository'ni seç
4. Root Directory: `backend` seç
5. Environment Variables ekle (aşağıdaki listeye bak)
6. Deploy!

**Backend URL:**
```
https://your-app-name.railway.app
```

**Maliyet:** İlk ay ücretsiz $5 kredi, sonra $5-10/ay

---

### 2. Render.com 🆓 ÜCRETSİZ BAŞLANGIÇ
**Fiyat:** Ücretsiz tier var, Pro $7/ay
**Kurulum:** 10 dakika
**Avantajlar:**
- ✅ Ücretsiz tier (sınırlı ama yeterli)
- ✅ Otomatik SSL
- ✅ GitHub entegrasyonu
- ✅ Kolay setup

**Adımlar:**
1. https://render.com → Kayıt ol
2. "New Web Service"
3. GitHub repo'yu bağla
4. Build Command: `cd backend && npm install`
5. Start Command: `cd backend && npm start`
6. Environment variables ekle

**Backend URL:**
```
https://your-app-name.onrender.com
```

**Not:** Ücretsiz tier'da servis 15 dakika idle kalırsa uyku moduna geçer (ilk request yavaş olur)

---

### 3. DigitalOcean App Platform 💪 GÜVENİLİR
**Fiyat:** $5/ay başlangıç
**Kurulum:** 15 dakika
**Avantajlar:**
- ✅ Çok güvenilir
- ✅ Auto-scaling
- ✅ SSL otomatik
- ✅ Kolay yönetim
- ✅ Global CDN

**Adımlar:**
1. https://cloud.digitalocean.com
2. "Create" → "App"
3. GitHub repo'yu bağla
4. Backend klasörünü seç
5. Environment variables ekle

**Backend URL:**
```
https://your-app-name.ondigitalocean.app
```

---

### 4. Fly.io 🌍 GLOBAL EDGE
**Fiyat:** Ücretsiz tier var
**Kurulum:** 20 dakika
**Avantajlar:**
- ✅ Ücretsiz başlangıç
- ✅ Global edge network (dünya çapında hızlı)
- ✅ Hızlı deployment
- ✅ Docker desteği

**Adımlar:**
1. https://fly.io → Kayıt ol
2. `flyctl auth login` (terminal)
3. `cd backend`
4. `flyctl launch`
5. Environment variables: `flyctl secrets set KEY=value`

**Backend URL:**
```
https://your-app-name.fly.dev
```

---

### 5. AWS Lightsail 💰 EN UCUZ VPS
**Fiyat:** $3.50/ay (512MB RAM)
**Kurulum:** 30 dakika
**Avantajlar:**
- ✅ Çok ucuz
- ✅ AWS altyapısı
- ✅ Tam kontrol
- ✅ Tüm servisleri çalıştırabilirsin

**Adımlar:**
1. AWS Lightsail console'a git
2. "Create instance" → Ubuntu
3. SSH ile bağlan
4. Node.js, Python, Go, Java, PHP kur
5. Git clone yap
6. PM2 ile çalıştır

**Not:** Tüm servisleri manuel kurman gerekir (Node.js, Python, Go, Java, PHP)

---

## 📋 Production Environment Variables

Railway/Render/DigitalOcean'da şu environment variables'ları ekle:

```env
NODE_ENV=production
PORT=4000

# JWT Secret (güçlü bir değer oluştur)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# CORS - Mobil app origin'leri
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-app-url

# Email Service
EMAIL_SERVICE_URL=http://localhost:5001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_SECURE=1

# App Settings
APP_SCHEME=iscitakip
FRONTEND_URL=https://yourdomain.com
BRAND_NAME=Bavaxe
BRAND_COLOR_PRIMARY=#06b6d4
BRAND_COLOR_SECONDARY=#7c3aed

# Payment
IYZICO_CALLBACK_URL=https://your-app-name.railway.app/api/payment/callback
IYZICO_WEBHOOK_URL=https://your-app-name.railway.app/api/webhook/payment
API_BASE_URL=https://your-app-name.railway.app
EXPO_PUBLIC_API_BASE_URL=https://your-app-name.railway.app

# OneSignal
ONESIGNAL_APP_ID=4a846145-621c-4a0d-a29f-0598da946c50
ONESIGNAL_REST_API_KEY=YOUR_ONESIGNAL_REST_API_KEY

# Microservices URLs (eğer ayrı deploy edersen)
PYTHON_SERVICE_URL=http://localhost:8000
GO_SERVICE_URL=http://localhost:8080
PHP_SERVICE_URL=http://localhost:9000
JAVA_SERVICE_URL=http://localhost:7000
```

---

## 🔐 JWT Secret Oluşturma

**Windows PowerShell:**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Linux/Mac:**
```bash
openssl rand -hex 32
```

---

## ✅ Deployment Sonrası Test

1. **Health Check:**
```bash
curl https://your-app-name.railway.app/api/health
```

2. **Mobil App'te Güncelle:**
`app.json` dosyasında:
```json
"extra": {
  "apiBase": "https://your-app-name.railway.app",
  "apiBaseDev": "https://your-app-name.railway.app",
  "apiBaseIOS": "https://your-app-name.railway.app",
  "apiBaseWeb": "https://your-app-name.railway.app"
}
```

---

## 🎯 Öneri: Railway.app

**Neden Railway?**
1. ✅ En kolay kurulum (5 dakika)
2. ✅ Otomatik SSL
3. ✅ GitHub entegrasyonu (push = deploy)
4. ✅ PM2 desteği (tüm servisler çalışır)
5. ✅ Log görüntüleme
6. ✅ Environment variables kolay yönetim
7. ✅ $5/ay başlangıç (ücretsiz kredi var)
8. ✅ Database desteği (PostgreSQL, MySQL, Redis)

**Railway Kurulum Adımları:**
1. https://railway.app → GitHub ile giriş
2. "New Project" → "Deploy from GitHub repo"
3. Repository'ni seç
4. Root Directory: `backend` seç
5. "Variables" sekmesine git
6. Environment variables ekle (yukarıdaki listeye bak)
7. Deploy otomatik başlar!

**Backend URL'i Al:**
Railway dashboard → Settings → Domains → URL'i kopyala

---

## 📊 Karşılaştırma Tablosu

| Platform | Fiyat | Kurulum | Özellikler | Öneri |
|----------|-------|---------|------------|-------|
| **Railway** | $5-10/ay | ⭐⭐⭐⭐⭐ | PM2, SSL, DB | ✅ En İyi |
| **Render** | Ücretsiz/$7 | ⭐⭐⭐⭐ | Ücretsiz tier | ✅ İyi |
| **DigitalOcean** | $5/ay | ⭐⭐⭐ | Güvenilir | ✅ İyi |
| **Fly.io** | Ücretsiz | ⭐⭐⭐ | Edge network | ⚠️ Orta |
| **AWS Lightsail** | $3.50/ay | ⭐⭐ | Tam kontrol | ⚠️ Zor |

---

## 🚨 Önemli Notlar

1. **Microservices:** Railway/Render'da tüm servisler aynı container'da çalışır (PM2 ile)
2. **Database:** JSON file-based database kullanıyorsun, production'da PostgreSQL önerilir
3. **SSL:** Tüm platformlar otomatik SSL sağlar
4. **Domain:** Custom domain ekleyebilirsin (ücretsiz)
5. **Backup:** Railway/Render otomatik backup yapar

---

## 💡 İpuçları

- Railway'de ilk ay ücretsiz $5 kredi var
- Render'da ücretsiz tier 15 dakika idle sonra uyku moduna geçer
- DigitalOcean'da $200 kredi promosyonu var (yeni kullanıcılar için)
- Fly.io'da ücretsiz tier 3 shared-cpu-1x instance'a kadar

---

## 🎉 Başarılı Deployment!

Deployment sonrası:
1. ✅ Health check çalışıyor mu?
2. ✅ SSL sertifikası aktif mi?
3. ✅ Mobil app backend'e bağlanıyor mu?
4. ✅ Log'lar temiz mi?

Her şey tamam! 🚀
