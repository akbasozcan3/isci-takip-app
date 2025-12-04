# 🚀 Netlify Deployment - Hızlı Başlangıç

## ⚠️ ÖNEMLİ: GitHub Entegrasyonu Gerekli

Netlify'da backend deploy etmek için **GitHub entegrasyonu** kullanman gerekiyor. Manuel folder upload çalışmaz!

---

## 📋 Adım Adım Netlify Deployment

### 1. Netlify'da Yeni Site Oluştur

1. **Netlify Dashboard'a git:** https://app.netlify.com
2. **"Add new project"** butonuna tıkla
3. **"Import an existing project"** seç
4. **"Deploy with GitHub"** seç
5. GitHub repository'ni seç: `akbasozcan3/isci-takip-app`
6. **"Connect"** tıkla

### 2. Build Settings Ayarla

Netlify otomatik olarak ayarları algılamaya çalışır. Eğer algılamazsa:

**Build settings:**
- **Base directory:** `backend` (veya boş bırak)
- **Build command:** (boş bırak - Netlify otomatik `npm install` yapar)
- **Publish directory:** (boş bırak - functions için gerekli değil)
- **Functions directory:** `netlify/functions`

**Deploy settings:**
- **Branch to deploy:** `main`
- **Production branch:** `main`

### 3. Environment Variables Ekle

**Site settings → Environment variables → Add variable:**

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

### 4. Deploy!

**"Deploy site"** butonuna tıkla. Netlify otomatik olarak:
- GitHub'dan kodu çeker
- Dependencies yükler
- Functions'ları hazırlar
- Deploy eder

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
Netlify serverless functions kullanır, bu yüzden:
- ❌ Socket.IO persistent connections çalışmaz
- ❌ Real-time tracking zor
- ✅ REST API endpoint'leri çalışır

**GPS tracking için Railway.app önerilir!**

---

## 🎯 Alternatif: Railway.app (ÖNERİLEN)

Socket.IO ve real-time tracking için **Railway.app** kullan:

1. https://railway.app → New Project → Deploy from GitHub
2. Repository seç: `akbasozcan3/isci-takip-app`
3. Root directory: `backend`
4. Environment variables ekle
5. Deploy!

**Avantajlar:**
- ✅ Socket.IO çalışır
- ✅ PM2 desteği
- ✅ Background jobs
- ✅ $5/ay başlangıç

Detaylar: `backend/README_DEPLOY.md`

---

## 🆘 Sorun Giderme

### "Unable to read file api-combined.log" hatası
Bu hata genellikle önceki bir deploy denemesinden kalır. Yeni bir deploy yap veya site'i silip yeniden oluştur.

### Build başarısız oluyor
1. Netlify log'larını kontrol et (Site → Deploys → Build log)
2. Environment variables kontrol et
3. `netlify.toml` dosyasını kontrol et

### Functions çalışmıyor
1. Functions directory doğru mu? (`netlify/functions`)
2. `serverless-http` dependency yüklü mü? (`backend/package.json`)
3. Netlify log'larını kontrol et

---

## ✅ Kontrol Listesi

- [ ] GitHub repository Netlify'a bağlandı
- [ ] Build settings doğru ayarlandı
- [ ] Functions directory: `netlify/functions`
- [ ] Environment variables eklendi
- [ ] Deploy başarılı
- [ ] Health check: `GET https://your-site.netlify.app/.netlify/functions/api/health`
- [ ] Mobil app'te API URL güncellendi

---

## 📞 Yardım

Sorun yaşarsan:
1. Netlify log'larını kontrol et
2. `NETLIFY_SETUP.md` dosyasına bak
3. Railway.app'i dene (Socket.IO için)

