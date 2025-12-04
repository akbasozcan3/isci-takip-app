# 🚀 Backend Deployment - Hızlı Başlangıç

## Railway.app ile Deployment (ÖNERİLEN)

### 1. Railway'a Git
https://railway.app → GitHub ile giriş yap

### 2. Yeni Proje Oluştur
- "New Project" → "Deploy from GitHub repo"
- Backend klasörünü seç
- Root directory: `backend`

### 3. Environment Variables Ekle

Railway dashboard'da "Variables" sekmesine git ve şunları ekle:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-app-url
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
ENABLE_HSTS=true
```

### 4. Deploy!

Railway otomatik olarak:
- ✅ Dependencies yükler
- ✅ PM2 ile çalıştırır
- ✅ SSL sertifikası ekler
- ✅ Log'ları gösterir

### 5. Backend URL'i Al

Railway dashboard'da "Settings" → "Domains" bölümünden URL'i kopyala:
```
https://your-app-name.railway.app
```

### 6. Mobil App'te Güncelle

`app.json` dosyasında:
```json
"extra": {
  "apiBase": "https://your-app-name.railway.app"
}
```

---

## 🔐 JWT Secret Oluşturma

Terminal'de:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## ✅ Test Et

Deployment sonrası:
```bash
curl https://your-app-name.railway.app/api/health
```

Başarılı response:
```json
{
  "status": "healthy",
  "version": "2.0.0"
}
```

---

## 📊 Monitoring

Railway dashboard'da:
- Logs: Real-time log görüntüleme
- Metrics: CPU, Memory kullanımı
- Deployments: Deployment geçmişi

---

## 🔄 Güncelleme

Kod değişikliği yaptığında:
1. GitHub'a push et
2. Railway otomatik deploy eder
3. Mobil app'te test et

---

## 💰 Maliyet

Railway.app:
- **Starter:** $5/ay (512MB RAM, 1GB storage)
- **Developer:** $10/ay (1GB RAM, 5GB storage)
- **Pro:** $20/ay (2GB RAM, 10GB storage)

**Ücretsiz kredi:** Her ay $5 ücretsiz kredi veriyor!

---

## 🆘 Sorun Giderme

### Backend çalışmıyor?
1. Log'ları kontrol et (Railway dashboard)
2. Environment variables kontrol et
3. Health check yap: `/api/health`

### CORS hatası?
`ALLOWED_ORIGINS` değişkenine mobil app origin'ini ekle

### Socket.IO bağlanmıyor?
Backend URL'inin HTTPS olduğundan emin ol

---

## 📞 Yardım

Sorun yaşarsan:
1. Railway log'larını kontrol et
2. Backend health check yap
3. Environment variables kontrol et

