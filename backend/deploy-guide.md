# 🚀 İşçi Takip API - Deployment Rehberi

## ✅ Mevcut Durum
- **PM2** ile production modunda çalışıyor
- **Port 4000** üzerinde aktif
- **Health check:** http://localhost:4000/health

## 🆓 Ücretsiz Domain Seçenekleri

### 1. 🎯 Cloudflare Tunnel (Önerilen)
```bash
# 1. Cloudflare Tunnel kur
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# 2. Tunnel oluştur
cloudflared tunnel login
cloudflared tunnel create isci-takip
cloudflared tunnel route dns isci-takip isci-takip.trycloudflare.com

# 3. Tunnel başlat
cloudflared tunnel run isci-takip
```
**Sonuç:** `https://isci-takip.trycloudflare.com`

### 2. 🦆 DuckDNS
```bash
# 1. https://duckdns.org → Sign up
# 2. Subdomain: isci-takip
# 3. Domain: isci-takip.duckdns.org
```
**Sonuç:** `https://isci-takip.duckdns.org`

### 3. 🌐 No-IP
```bash
# 1. https://noip.com → Sign up
# 2. Subdomain: isci-takip
# 3. Domain: isci-takip.ddns.net
```
**Sonuç:** `https://isci-takip.ddns.net`

### 4. 🆓 Freenom (Gerçek Domain)
```bash
# 1. https://freenom.com → Sign up
# 2. Domain ara: isci-takip
# 3. Uzantı: .tk, .ml, .ga, .cf
# 4. 1 yıl ücretsiz kaydet
```
**Sonuç:** `https://isci-takip.tk`

## 🔧 PM2 Komutları

```bash
# API durumu
pm2 status

# API logları
pm2 logs isci-takip-api

# API yeniden başlat
pm2 restart isci-takip-api

# API durdur
pm2 stop isci-takip-api

# API başlat
pm2 start isci-takip-api

# PM2 otomatik başlatma (sistem yeniden başladığında)
pm2 startup
pm2 save
```

## 📊 API Endpoints

- **Health:** `GET /health`
- **Articles:** `GET /api/articles`
- **Locations:** `GET /api/locations/latest`
- **Groups:** `GET /api/groups`
- **Auth:** `POST /auth/login`

## 🌐 Production URL'leri

API çalıştıktan sonra:
- **Local:** http://localhost:4000
- **Tunnel:** https://isci-takip.trycloudflare.com
- **DuckDNS:** https://isci-takip.duckdns.org
- **No-IP:** https://isci-takip.ddns.net
- **Freenom:** https://isci-takip.tk

## 🔒 Güvenlik

- ✅ **CORS** yapılandırıldı
- ✅ **Security headers** eklendi
- ✅ **Error handling** geliştirildi
- ✅ **Production optimizations** aktif

## 📱 Mobile App Bağlantısı

Mobile app'te API URL'ini güncelle:
```javascript
// utils/api.ts
const API_BASE_URL = 'https://isci-takip.trycloudflare.com';
// veya
const API_BASE_URL = 'https://isci-takip.duckdns.org';
```

## 🚀 Hızlı Başlatma

```bash
# 1. PM2 ile başlat
pm2 start server.js --name "isci-takip-api"

# 2. Cloudflare Tunnel (opsiyonel)
cloudflared tunnel run isci-takip

# 3. Durum kontrol
pm2 status
```

## 📞 Destek

- **PM2 Docs:** https://pm2.keymetrics.io/
- **Cloudflare Tunnel:** https://developers.cloudflare.com/cloudflare-one/
- **DuckDNS:** https://duckdns.org/
- **No-IP:** https://noip.com/
- **Freenom:** https://freenom.com/
