# PM2 Sürekli Çalışma Rehberi

Backend servislerinin PM2 ile sürekli çalışması için rehber.

## 🚀 Hızlı Başlatma

### Windows
```bash
cd backend
start-pm2.bat
```

### PowerShell
```powershell
cd backend
.\start-pm2.ps1
```

### NPM Script
```bash
cd backend
npm run start:prod
```

## ⚙️ Otomatik Başlatma Kurulumu

### Linux/Mac
```bash
cd backend
npm run setup:startup
```

Bu komut:
- PM2 startup script'ini oluşturur
- Sistem başlangıcında otomatik başlatmayı ayarlar
- Mevcut PM2 process'lerini kaydeder

### Windows
Windows için Task Scheduler kullanın:

1. **Task Scheduler'ı açın** (taskschd.msc)
2. **Create Basic Task** seçin
3. **Trigger**: "When the computer starts"
4. **Action**: "Start a program"
5. **Program**: `C:\Windows\System32\cmd.exe`
6. **Arguments**: `/c cd /d C:\Users\ozcan\my-app\backend && npm run start:prod`

## 🔄 Sürekli Çalışma Özellikleri

### Otomatik Yeniden Başlatma
- Servis çökerse otomatik başlar
- Maksimum 50 yeniden başlatma
- Exponential backoff ile restart delay

### Günlük Yeniden Başlatma
- Her gün saat 03:00'te otomatik restart
- Memory leak'leri önler
- Sistem performansını korur

### Memory Limit
- API: 1.5GB limit
- Email Service: 512MB limit
- Limit aşılırsa otomatik restart

### Log Yönetimi
- Tüm loglar `logs/` klasöründe
- JSON formatında loglama
- Tarih/saat bilgisi ile
- Otomatik log rotation

## 📊 Durum Kontrolü

### Servis Durumu
```bash
npm run status
# veya
pm2 status
```

### Servisleri Kontrol Et ve Başlat
```bash
npm run ensure:running
```

Bu komut:
- Çalışmayan servisleri tespit eder
- Otomatik olarak başlatır
- Durum raporu verir

### Logları Görüntüle
```bash
npm run logs
# veya
pm2 logs
```

### Canlı Monitör
```bash
npm run monit
# veya
pm2 monit
```

## 🔧 Yönetim Komutları

### Başlat
```bash
npm run start:prod    # Production
npm run start:dev     # Development
```

### Durdur
```bash
npm run stop
# veya
pm2 stop all
```

### Yeniden Başlat
```bash
npm run restart
# veya
pm2 restart all
```

### PM2 Durumunu Kaydet
```bash
npm run save
# veya
pm2 save
```

## 🛡️ Güvenlik ve Performans

### Production Ayarları
- 2 instance (load balancing)
- Rate limiting: 200 req/min
- Memory limit: 1.5GB
- Graceful shutdown

### Development Ayarları
- 1 instance
- Rate limiting: 100 req/min
- Memory limit: 1.5GB
- Detaylı logging

## 📁 Log Dosyaları

- `logs/api-err.log` - API hata logları
- `logs/api-out.log` - API çıktı logları
- `logs/api-combined.log` - API birleşik loglar
- `logs/email-err.log` - Email hata logları
- `logs/email-out.log` - Email çıktı logları
- `logs/email-combined.log` - Email birleşik loglar

## 🔍 Sorun Giderme

### Servisler Başlamıyor
```bash
npm run ensure:running
```

### Port Kullanımda
```bash
# Port 4000'i kullanan process'i bul
netstat -ano | findstr :4000

# Process'i sonlandır
taskkill /PID <PID> /F
```

### PM2 Process'leri Temizle
```bash
pm2 delete all
pm2 kill
npm run start:prod
```

### Logları Temizle
```bash
pm2 flush
```

## 📝 Önemli Notlar

1. **PM2 Save**: Her değişiklikten sonra `pm2 save` çalıştırın
2. **Graceful Shutdown**: Servisler SIGTERM/SIGINT ile düzgün kapanır
3. **Health Check**: `/api/health` endpoint'i ile servis durumunu kontrol edin
4. **Memory Monitoring**: `pm2 monit` ile memory kullanımını izleyin
5. **Auto Restart**: Servisler otomatik yeniden başlar, manuel müdahale gerekmez

## 🎯 Best Practices

1. Production'da her zaman `npm run start:prod` kullanın
2. Değişikliklerden sonra `pm2 save` çalıştırın
3. Düzenli olarak `npm run ensure:running` ile kontrol edin
4. Log dosyalarını düzenli temizleyin
5. Memory kullanımını izleyin

