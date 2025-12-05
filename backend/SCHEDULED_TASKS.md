# Scheduled Background Tasks + OneSignal Push Notifications

## 📋 Özet

Scheduled background task sistemi ve OneSignal push notification trigger'ları eklendi.

## 🎯 Özellikler

### 1. Daily Activity Service
- Kullanıcıların günlük yürüyüş mesafelerini hesaplar
- Bugün ve dünkü aktiviteleri karşılaştırır
- Eşik değerlerini kontrol eder (min: 5 km, max: 50 km)

**Dosya:** `backend/services/dailyActivityService.js`

**Fonksiyonlar:**
- `calculateDailyDistance(userId, date)` - Belirli bir gün için mesafe hesaplar
- `getUserDailyActivity(userId)` - Kullanıcının bugün ve dünkü aktivitesini döner
- `getAllUsersDailyActivity()` - Tüm kullanıcıların aktivitelerini döner
- `checkActivityThresholds(activity, thresholds)` - Eşik kontrolleri yapar

### 2. Push Notification Service
- OneSignal API'ye push notification gönderir
- Batch notification desteği
- Deep link entegrasyonu

**Dosya:** `backend/services/pushNotificationService.js`

**Fonksiyonlar:**
- `sendPushNotification(userId, message, options)` - Tek kullanıcıya bildirim gönderir
- `sendDailyActivityNotification(userId, distance, options)` - Günlük aktivite bildirimi
- `sendBatchNotifications(notifications)` - Toplu bildirim gönderir

### 3. Scheduled Tasks Service
- Günlük ve saatlik cron job'lar
- Otomatik aktivite kontrolü
- Push notification tetikleme

**Dosya:** `backend/services/scheduledTasksService.js`

**Zamanlama:**
- **Günlük Kontrol:** Her gün saat 20:00'de çalışır
- **Saatlik Kontrol:** Her saat başı çalışır

**Görevler:**
- `checkDailyActivities()` - Günlük aktivite kontrolü ve bildirim gönderimi
- `checkHourlyActivities()` - Saatlik aktivite kontrolü

## 🚀 Kullanım

### Otomatik Başlatma
Server başladığında otomatik olarak scheduled tasks başlar:
```javascript
// server.js içinde
setupBackgroundJobs() {
  const scheduledTasksService = require('./services/scheduledTasksService');
  scheduledTasksService.start();
}
```

### Manuel Tetikleme
API endpoint'i ile manuel kontrol:
```bash
POST /api/scheduled/trigger-check
Authorization: Bearer {token}
```

### Test Notification
```bash
POST /api/scheduled/test-notification
Authorization: Bearer {token}
Body: {
  "message": "Test bildirimi",
  "title": "🧪 Test"
}
```

### Kullanıcı Aktivitesi
```bash
GET /api/scheduled/activity/:userId
Authorization: Bearer {token}
```

### Tüm Aktiviteler
```bash
GET /api/scheduled/activities
Authorization: Bearer {token}
```

## 📊 Bildirim Senaryoları

### 1. Günlük Aktivite Bildirimi (20:00)
- **Koşul:** Kullanıcı bugün 5 km veya daha fazla yürüdüyse
- **Mesaj:** "Bugün {distance} km yürüdünüz!"
- **Başlık:** "🏃 Günlük Aktivite"

### 2. Hedef Aşıldı Bildirimi
- **Koşul:** 5 km hedefi aşıldıysa
- **Mesaj:** "Tebrikler! Bugün {distance} km yürüdünüz. 5 km hedefini aştınız!"
- **Başlık:** "✅ Hedef Aşıldı!"

### 3. İlerleme Bildirimi
- **Koşul:** Bugünkü mesafe dünkünden fazlaysa
- **Mesaj:** "Bugün {distance} km yürüdünüz! Dünkünden daha fazla!"
- **Başlık:** "🎉 Harika İlerleme!"

## 🔧 Yapılandırma

### Eşik Değerleri
`scheduledTasksService.js` içinde:
```javascript
checkActivityThresholds(activity, {
  minDistance: 5,  // Minimum km
  maxDistance: 50  // Maximum km
})
```

### Zamanlama
```javascript
// Günlük: Her gün 20:00
scheduleDailyActivityCheck()

// Saatlik: Her saat başı
scheduleHourlyActivityCheck()
```

## 📝 Loglar

Tüm işlemler logger ile kaydedilir:
- `[ScheduledTasksService]` - Cron job logları
- `[DailyActivityService]` - Aktivite hesaplama logları
- `[PushNotificationService]` - Bildirim gönderim logları

## ✅ Test

1. Server'ı başlatın
2. Bir kullanıcı ile giriş yapın
3. Konum verileri gönderin (5 km+ mesafe)
4. Manuel kontrol tetikleyin:
   ```bash
   POST /api/scheduled/trigger-check
   ```
5. Bildirimi kontrol edin

## 🎯 Örnek Senaryo

1. **Ayşe** bugün 5.2 km yürüdü
2. Saat 20:00'de cron job çalışır
3. `checkDailyActivities()` Ayşe'nin aktivitesini kontrol eder
4. 5 km eşiğini aştığı için bildirim gönderilir
5. OneSignal push notification Ayşe'nin cihazına gelir
6. Bildirim tıklandığında `bavaxe://analytics` sayfasına yönlendirilir
