# 🚀 Backend Deployment Rehberi

## ✅ Backend Entegrasyonu Tamamlandı

Tüm backend endpoint'leri authentication token ile çalışıyor:
- ✅ Location tracking
- ✅ Grup yönetimi
- ✅ Socket.IO real-time updates
- ✅ Dashboard verileri
- ✅ Analytics
- ✅ Payment processing

---

## 🌐 En İyi Sunucu Seçenekleri

### 🥇 1. Railway.app (ÖNERİLEN - En Kolay)

**Fiyat:** $5-10/ay (ücretsiz $5 kredi/ay var)
**Kurulum Süresi:** 5 dakika
**Avantajlar:**
- ✅ Otomatik GitHub deployment
- ✅ SSL sertifikası otomatik
- ✅ Environment variables kolay yönetim
- ✅ PM2 desteği
- ✅ Log görüntüleme
- ✅ Database desteği (PostgreSQL, MySQL)
- ✅ Çok kolay kullanım

**Adımlar:**
1. https://railway.app → GitHub ile giriş
2. "New Project" → "Deploy from GitHub repo"
3. Backend klasörünü seç
4. Environment variables ekle (aşağıdaki listeye bak)
5. Deploy!

**Backend URL Format:**
```
https://your-app-name.railway.app
```

**Mobil App'te Güncelleme:**
`app.json` dosyasında `extra.apiBase` değerini güncelle:
```json
"extra": {
  "apiBase": "https://your-app-name.railway.app"
}
```

---

### 🥈 2. Render.com (Ücretsiz Tier)

**Fiyat:** Ücretsiz tier var, Pro $7/ay
**Kurulum Süresi:** 10 dakika
**Avantajlar:**
- ✅ Ücretsiz başlangıç
- ✅ Otomatik SSL
- ✅ GitHub entegrasyonu
- ✅ Kolay setup

**Adımlar:**
1. https://render.com → Kayıt ol
2. "New Web Service"
3. GitHub repo'yu bağla
4. Build: `cd backend && npm install`
5. Start: `cd backend && npm start`
6. Environment variables ekle

---

### 🥉 3. DigitalOcean App Platform

**Fiyat:** $5/ay başlangıç
**Kurulum Süresi:** 15 dakika
**Avantajlar:**
- ✅ Güvenilir
- ✅ Auto-scaling
- ✅ SSL otomatik
- ✅ Kolay yönetim

**Adımlar:**
1. https://cloud.digitalocean.com
2. "Create" → "App"
3. GitHub repo'yu bağla
4. Backend klasörünü seç
5. Environment variables ekle

---

### 4. Fly.io (Ücretsiz Tier)

**Fiyat:** Ücretsiz tier var
**Kurulum Süresi:** 20 dakika
**Avantajlar:**
- ✅ Ücretsiz başlangıç
- ✅ Global edge network
- ✅ Hızlı

**Adımlar:**
```bash
cd backend
flyctl auth login
flyctl launch
flyctl secrets set JWT_SECRET=your-secret
```

---

### 5. AWS Lightsail (En Ucuz)

**Fiyat:** $3.50/ay (512MB RAM)
**Kurulum Süresi:** 30 dakika
**Avantajlar:**
- ✅ Çok ucuz
- ✅ AWS altyapısı
- ✅ Tam kontrol

**Adımlar:**
1. AWS Lightsail console
2. "Create instance" → Node.js
3. SSH ile bağlan
4. Git clone
5. PM2 ile çalıştır

---

## 📋 Production Environment Variables

Sunucuya deploy ederken şu environment variables'ları ekle:

```env
NODE_ENV=production
PORT=4000

# JWT Secret (güçlü bir değer oluştur)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# CORS Origins (mobil app origin'leri)
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-app-url

# Email (Gmail)
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

## 🔧 Mobil App'te Backend URL Güncelleme

### Yöntem 1: app.json (Önerilen)

`app.json` dosyasını güncelle:
```json
{
  "expo": {
    "extra": {
      "apiBase": "https://your-backend-url.com",
      "apiBaseDev": "https://your-backend-url.com",
      "apiBaseIOS": "https://your-backend-url.com",
      "apiBaseWeb": "https://your-backend-url.com"
    }
  }
}
```

### Yöntem 2: Environment Variable

`.env` dosyası oluştur:
```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-url.com
```

---

## ✅ Deployment Checklist

### Öncesi:
- [ ] Backend kodunu GitHub'a push et
- [ ] `.env` production değerleriyle hazırla
- [ ] `JWT_SECRET` güçlü bir değer oluştur
- [ ] `ALLOWED_ORIGINS` mobil app domain'lerini ekle
- [ ] SMTP bilgilerini kontrol et

### Deployment:
- [ ] Sunucu seç (Railway önerilir)
- [ ] GitHub repo'yu bağla
- [ ] Environment variables ekle
- [ ] Deploy et
- [ ] Health check: `GET https://your-url.com/api/health`

### Sonrası:
- [ ] SSL sertifikası kontrol et
- [ ] CORS ayarlarını test et
- [ ] Socket.IO bağlantısını test et
- [ ] Mobil app'te API URL'i güncelle
- [ ] Test et!

---

## 🎯 Önerilen: Railway.app

**Neden Railway?**
1. ✅ En kolay kurulum (5 dakika)
2. ✅ Otomatik SSL
3. ✅ GitHub entegrasyonu
4. ✅ Log görüntüleme
5. ✅ Environment variables kolay
6. ✅ PM2 desteği
7. ✅ $5/ay başlangıç

**Hızlı Başlangıç:**
1. Railway.app'e git → GitHub ile giriş
2. "New Project" → "Deploy from GitHub"
3. Backend klasörünü seç
4. Environment variables ekle
5. Deploy!

**Backend URL:** `https://your-app-name.railway.app`

---

## 📞 Destek

Sorun yaşarsan:
1. Backend log'larını kontrol et
2. Health check yap: `/api/health`
3. Environment variables kontrol et
4. CORS ayarlarını kontrol et

