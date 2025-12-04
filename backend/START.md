# 🚀 Backend Başlatma Rehberi

## ⚡ En Hızlı Yöntem

### Windows
```bash
cd backend
start.bat
```

Veya çift tıklayarak `start.bat` dosyasını çalıştırın!

## 📋 Tüm Başlatma Yöntemleri

### 1. NPM Script (Önerilen) ⭐
```bash
cd backend
npm start
```

**Production için:**
```bash
npm run start:prod
```

**Development için:**
```bash
npm run start:dev
```

### 2. PM2 Direkt
```bash
cd backend
pm2 start ecosystem.config.js
```

### 3. Windows Script'leri
```bash
# Batch
start-pm2.bat

# PowerShell
.\start-pm2.ps1

# Basit başlatma
start.bat
```

### 4. Otomatik Kontrol ve Başlatma
```bash
npm run ensure:running
```
Bu komut servisleri kontrol eder, çalışmıyorsa otomatik başlatır.

## 🔍 Durum Kontrolü

```bash
# Durum
npm run status
# veya
pm2 status

# Loglar
npm run logs
# veya
pm2 logs

# Canlı monitör
npm run monit
# veya
pm2 monit
```

## 🛑 Durdurma

```bash
npm run stop
# veya
pm2 stop all
```

## 🔄 Yeniden Başlatma

```bash
npm run restart
# veya
pm2 restart all
```

## 📝 Önemli Notlar

1. **İlk Başlatma**: `npm run init` komutunu çalıştırın
2. **PM2 Save**: Değişikliklerden sonra `npm run save` çalıştırın
3. **Otomatik Başlatma**: Sistem yeniden başlatıldığında servisler otomatik başlar (PM2 save ile)
4. **Port Kontrolü**: Port 4000 ve 5001'in boş olduğundan emin olun

## 🎯 Hızlı Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm start` | Backend'i başlat |
| `npm run status` | Durum kontrolü |
| `npm run logs` | Logları görüntüle |
| `npm run stop` | Durdur |
| `npm run restart` | Yeniden başlat |
| `npm run ensure:running` | Kontrol et ve başlat |

## ✅ Başarı Kontrolü

Backend başarıyla başladıysa:
- ✅ `pm2 status` komutunda servisler "online" görünür
- ✅ `http://localhost:4000/api/health` endpoint'i çalışır
- ✅ Log dosyaları `logs/` klasöründe oluşur

