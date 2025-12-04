# Backend Deployment Guide

## 🚀 Hızlı Deployment Seçenekleri

### 1. Railway.app (ÖNERİLEN - En Kolay)
**Fiyat:** $5-10/ay (ücretsiz $5 kredi/ay)
**Avantajlar:**
- Otomatik deployment (GitHub bağlantısı)
- SSL sertifikası otomatik
- Environment variables kolay yönetim
- PM2 desteği
- Log görüntüleme
- Database desteği (PostgreSQL, MySQL)

**Kurulum:**
1. https://railway.app adresine git
2. GitHub ile giriş yap
3. "New Project" > "Deploy from GitHub repo"
4. Backend klasörünü seç
5. Environment variables ekle (.env dosyasındakiler)
6. Deploy!

**Environment Variables:**
```
NODE_ENV=production
PORT=4000
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=https://yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

### 2. Render.com (ÜCRETSİZ Tier Var)
**Fiyat:** Ücretsiz tier var, Pro $7/ay
**Avantajlar:**
- Ücretsiz tier (sınırlı)
- Otomatik SSL
- GitHub entegrasyonu
- Kolay setup

**Kurulum:**
1. https://render.com adresine git
2. "New Web Service" seç
3. GitHub repo'yu bağla
4. Build Command: `cd backend && npm install`
5. Start Command: `cd backend && npm start`
6. Environment variables ekle

---

### 3. DigitalOcean App Platform
**Fiyat:** $5/ay başlangıç
**Avantajlar:**
- Güvenilir
- Kolay yönetim
- Auto-scaling
- SSL otomatik

**Kurulum:**
1. https://cloud.digitalocean.com adresine git
2. "Create" > "App"
3. GitHub repo'yu bağla
4. Backend klasörünü seç
5. Environment variables ekle

---

### 4. Fly.io (Ücretsiz Tier)
**Fiyat:** Ücretsiz tier var
**Avantajlar:**
- Ücretsiz başlangıç
- Global edge network
- Hızlı deployment

**Kurulum:**
1. https://fly.io adresine git
2. `flyctl auth login`
3. `flyctl launch` (backend klasöründe)
4. Environment variables: `flyctl secrets set KEY=value`

---

### 5. AWS Lightsail (En Ucuz)
**Fiyat:** $3.50/ay (512MB RAM)
**Avantajlar:**
- Çok ucuz
- AWS altyapısı
- Tam kontrol

**Kurulum:**
1. AWS Lightsail console'a git
2. "Create instance" > Node.js
3. SSH ile bağlan
4. Git clone yap
5. PM2 ile çalıştır

---

## 📋 Deployment Checklist

### Öncesi:
- [ ] `.env` dosyasını production değerleriyle güncelle
- [ ] `JWT_SECRET` güçlü bir değer oluştur
- [ ] `ALLOWED_ORIGINS` mobil app domain'lerini ekle
- [ ] SMTP bilgilerini kontrol et
- [ ] Database backup stratejisi planla

### Deployment:
- [ ] Git repository'ye push yap
- [ ] Sunucuya deploy et
- [ ] Environment variables ekle
- [ ] Health check yap: `GET /api/health`
- [ ] Log'ları kontrol et

### Sonrası:
- [ ] SSL sertifikası kontrol et
- [ ] CORS ayarlarını test et
- [ ] Rate limiting çalışıyor mu kontrol et
- [ ] Socket.IO bağlantısını test et
- [ ] Email gönderimini test et

---

## 🔧 Production Environment Variables

```env
NODE_ENV=production
PORT=4000

# JWT - Güçlü bir secret oluştur
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# CORS - Mobil app origin'leri
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-app-url

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Security
ENABLE_HSTS=true
```

---

## 🎯 Önerilen: Railway.app

**Neden Railway?**
1. ✅ En kolay kurulum (5 dakika)
2. ✅ Otomatik SSL
3. ✅ GitHub entegrasyonu
4. ✅ Log görüntüleme
5. ✅ Environment variables kolay yönetim
6. ✅ PM2 desteği
7. ✅ $5/ay başlangıç (ücretsiz kredi var)

**Adımlar:**
1. Railway.app'e git ve kayıt ol
2. "New Project" > "Deploy from GitHub"
3. Backend klasörünü seç
4. Environment variables ekle
5. Deploy!

**URL Format:**
Backend URL: `https://your-app-name.railway.app`

Mobil app'te `API_BASE` değişkenini bu URL'e güncelle!

