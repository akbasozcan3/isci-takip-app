# 🚀 Backend Servisleri Başlatma Kılavuzu

## Hızlı Başlatma

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File start-all-backend.ps1
```

## PM2 Komutları

```powershell
# Tüm servisleri başlat
pm2 start ecosystem.config.js --update-env

# Servis durumunu kontrol et
pm2 status

# Logları görüntüle
pm2 logs

# Belirli servis logları
pm2 logs isci-takip-api
pm2 logs email-service

# Servisleri yeniden başlat
pm2 restart all --update-env

# Servisleri durdur
pm2 stop all

# Servisleri sil
pm2 delete all

# PM2 yapılandırmasını kaydet
pm2 save
```

## Servisler

1. **Node.js API** (Port 4000)
   - Health: `http://localhost:4000/api/health`
   - Ana backend servisi

2. **Python Email Service** (Port 5001)
   - Health: `http://localhost:5001/health`
   - Email gönderimi

## Sorun Giderme

### Servis Başlamıyorsa

1. Port çakışması kontrol et:
```powershell
netstat -ano | findstr ":4000"
netstat -ano | findstr ":5001"
```

2. Logları kontrol et:
```powershell
pm2 logs isci-takip-api --err
pm2 logs email-service --err
```

3. Servisleri temizle ve yeniden başlat:
```powershell
pm2 delete all
pm2 start ecosystem.config.js --update-env
pm2 save
```

### Health Check Başarısız

- Servislerin başlaması için 10-15 saniye bekleyin
- Port'ların kullanılabilir olduğundan emin olun
- Log dosyalarını kontrol edin: `backend/logs/`
