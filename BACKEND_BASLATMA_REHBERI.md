# 🚀 Backend Sunucusu Başlatma Rehberi

## ❌ Sorun: "Sunucuya Bağlanılamıyor" Hatası

Bu hata, backend sunucusunun çalışmadığını gösterir. Uygulama backend'e bağlanamıyor.

---

## ✅ Çözüm: Backend Sunucusunu Başlatın

### Yöntem 1: Manuel Başlatma (Geliştirme)

```bash
cd backend
node server.js
```

**Beklenen Çıktı:**
```
🚀  BAVAXE GPS TRACKING API - SERVER STARTED
📡 Port: 4000
✅ Database initialized
✅ Cache service started
✅ OneSignal service initialized
...
```

### Yöntem 2: PM2 ile Başlatma (Production)

```bash
cd backend
npm start
```

veya

```bash
cd backend
pm2 start server.js --name bavaxe-backend
```

### Yöntem 3: Nodemon ile Başlatma (Auto-reload)

```bash
cd backend
npm run dev
```

---

## 🔍 Backend Durumunu Kontrol Etme

### 1. Port Kontrolü (Windows PowerShell)

```powershell
Test-NetConnection -ComputerName localhost -Port 4000
```

**Başarılı ise:**
```
TcpTestSucceeded : True
```

**Başarısız ise:**
```
TcpTestSucceeded : False
```

### 2. Health Check

Tarayıcıda veya Postman'de:
```
http://localhost:4000/api/health
```

**Beklenen Yanıt:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-11T...",
  "uptime": 123.45
}
```

### 3. Process Kontrolü (Windows)

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue
```

---

## 📱 Frontend API Yapılandırması

### Geliştirme Ortamı (app.json)

```json
{
  "extra": {
    "apiBase": "http://192.168.1.102:4000",
    "apiBaseDev": "http://192.168.1.102:4000",
    "apiBaseIOS": "http://192.168.1.102:4000",
    "apiBaseWeb": "http://localhost:4000"
  }
}
```

### IP Adresi Değiştirme

Eğer bilgisayarınızın IP adresi farklıysa:

1. **IP Adresinizi Bulun:**
   ```powershell
   ipconfig
   ```
   IPv4 Address'i bulun (örn: `192.168.1.102`)

2. **app.json'u Güncelleyin:**
   - `apiBase`
   - `apiBaseDev`
   - `apiBaseIOS`

3. **Uygulamayı Yeniden Başlatın:**
   ```bash
   npm start
   ```

---

## 🔧 Yaygın Sorunlar ve Çözümleri

### Sorun 1: Port 4000 Zaten Kullanılıyor

**Hata:**
```
Error: listen EADDRINUSE: address already in use :::4000
```

**Çözüm:**
```powershell
# Port 4000'i kullanan process'i bulun
Get-NetTCPConnection -LocalPort 4000 | Select-Object OwningProcess

# Process'i sonlandırın (PID'yi değiştirin)
Stop-Process -Id <PID>
```

### Sorun 2: Firewall Engellemesi

**Çözüm:**
1. Windows Defender Firewall'ı açın
2. "Gelen Kuralları Yönet" → "Yeni Kural"
3. Port → TCP → 4000 → İzin Ver

### Sorun 3: Backend Başlamıyor

**Kontrol Listesi:**
- ✅ Node.js yüklü mü? (`node --version`)
- ✅ `backend/.env` dosyası var mı?
- ✅ `backend/node_modules` yüklü mü? (`npm install`)
- ✅ Port 4000 boş mu?

### Sorun 4: Android Emulator'den Erişilemiyor

**Android Emulator için:**
- Emulator otomatik olarak `http://10.0.2.2:4000` kullanır
- `utils/api.ts` dosyası bunu otomatik yönetir

**Fiziksel Cihaz için:**
- Bilgisayarınızın yerel IP'sini kullanın (örn: `192.168.1.102`)
- `app.json`'daki `apiBase` değerini güncelleyin

---

## 🎯 Hızlı Test

### 1. Backend Başlat
```bash
cd backend
node server.js
```

### 2. Health Check
Tarayıcıda: `http://localhost:4000/api/health`

### 3. Uygulamayı Başlat
```bash
npm start
```

### 4. Uygulamada Test
- Ana sayfa yükleniyor mu?
- WiFi ikonu yeşil mi?
- "Sunucuya Bağlanılamıyor" hatası gitti mi?

---

## 📋 Backend Başlatma Komutları Özeti

| Ortam | Komut | Açıklama |
|-------|-------|----------|
| Development | `cd backend && node server.js` | Manuel başlatma |
| Development (Auto-reload) | `cd backend && npm run dev` | Nodemon ile otomatik yeniden başlatma |
| Production | `cd backend && npm start` | PM2 ile başlatma |
| Production (PM2) | `cd backend && pm2 start server.js` | PM2 process manager |

---

## ✅ Başarı Kriterleri

Backend başarıyla başladığında:

1. ✅ Terminal'de "SERVER STARTED" mesajı görünür
2. ✅ `http://localhost:4000/api/health` yanıt verir
3. ✅ Uygulamada WiFi ikonu yeşil olur
4. ✅ "Sunucuya Bağlanılamıyor" hatası kaybolur
5. ✅ Ana sayfa verileri yüklenir

---

**Tarih:** 11 Aralık 2025  
**Durum:** ✅ Çözüm Hazır

