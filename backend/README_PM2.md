# PM2 ile Backend Yönetimi

Backend servislerini PM2 ile yönetmek için rehber.

## 📋 Gereksinimler

1. **PM2 Kurulumu**
   ```bash
   npm install -g pm2
   ```

2. **Python Virtual Environment**
   - `.venv` klasörü proje root'unda olmalı
   - Veya `backend/.venv` klasöründe olabilir

## 🚀 Hızlı Başlatma

### Windows (Batch)
```bash
cd backend
start-pm2.bat
```

### Windows (PowerShell)
```powershell
cd backend
.\start-pm2.ps1
```

### NPM Script ile
```bash
cd backend
npm run start
```

## 📝 PM2 Komutları

### Temel Komutlar
```bash
# Durum kontrolü
pm2 status

# Logları görüntüle
pm2 logs

# Canlı monitör
pm2 monit

# Tüm servisleri yeniden başlat
pm2 restart all

# Tüm servisleri durdur
pm2 stop all

# Tüm servisleri sil
pm2 delete all
```

### NPM Script Komutları
```bash
# Başlat
npm run start

# Durdur
npm run stop

# Yeniden başlat
npm run restart

# Logları görüntüle
npm run logs

# Durum kontrolü
npm run status

# Canlı monitör
npm run monit
```

## 🔧 Yönetilen Servisler

### 1. isci-takip-api
- **Port**: 4000
- **Script**: server.js
- **Log**: `logs/api-*.log`

### 2. email-service
- **Port**: 5001
- **Script**: email_service.py
- **Interpreter**: Python (otomatik bulunur)
- **Log**: `logs/email-*.log`

## 📊 PM2 Özellikleri

- ✅ **Otomatik Yeniden Başlatma**: Servis çökerse otomatik başlar
- ✅ **Log Yönetimi**: Tüm loglar `logs/` klasöründe
- ✅ **Memory Limit**: API 1GB, Email 512MB
- ✅ **Process Monitoring**: Canlı izleme
- ✅ **Cluster Mode**: Gerekirse cluster modu aktif edilebilir

## 🔄 Ortam Değişkenleri

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run start:prod
```

## 📁 Log Dosyaları

- `logs/api-err.log` - API hata logları
- `logs/api-out.log` - API çıktı logları
- `logs/api-combined.log` - API birleşik loglar
- `logs/email-err.log` - Email hata logları
- `logs/email-out.log` - Email çıktı logları
- `logs/email-combined.log` - Email birleşik loglar

## 🛠️ Sorun Giderme

### PM2 Bulunamıyor
```bash
npm install -g pm2
```

### Python Bulunamıyor
- `.venv` klasörünün doğru yerde olduğundan emin olun
- `ecosystem.config.js` dosyasında interpreter path'ini kontrol edin

### Port Zaten Kullanılıyor
```bash
# Port kullanan process'i bul
netstat -ano | findstr :4000
netstat -ano | findstr :5001

# Process'i sonlandır
taskkill /PID <PID> /F
```

### Servisler Başlamıyor
```bash
# PM2 loglarını kontrol et
pm2 logs

# Manuel başlat
pm2 start ecosystem.config.js --no-daemon
```

## 📚 Daha Fazla Bilgi

- [PM2 Dokümantasyonu](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)

