# İşçi Takip Paneli 🚀

Expo + React Native tabanlı, gerçek zamanlı konum takip ve grup yönetim sistemi. Socket.IO ile canlı konum paylaşımı, WhatsApp benzeri grup sistemi ve admin paneli içerir.

## 🎯 Özellikler

- ✅ **Gerçek Zamanlı Konum Takibi** - Socket.IO ile anlık konum güncellemeleri
- ✅ **Grup Yönetimi** - Grup oluştur, katıl, üye onaylama
- ✅ **Admin Paneli** - Grup başvurularını yönet
- ✅ **Auth Sistemi** - E-posta/şifre ve OTP ile giriş
- ✅ **Harita Görünümü** - React Native Maps ve Leaflet entegrasyonu
- ✅ **Arka Plan Takip** - Foreground service ile sürekli konum gönderimi
- ✅ **Kalıcı Veri** - JSON tabanlı dosya depolama

## 📦 Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Backend Sunucusunu Başlat

```bash
npm run server
```

Backend varsayılan olarak `http://localhost:4000` adresinde çalışır.

### 3. Mobil Uygulamayı Başlat

```bash
npx expo start
```

Ardından:
- iOS Simulator için `i` tuşuna basın
- Android Emulator için `a` tuşuna basın
- Fiziksel cihazda test için Expo Go uygulamasını kullanın

## ⚙️ Yapılandırma

### API Base URL

Mobil uygulamanın backend'e bağlanması için `app.json` dosyasındaki `extra.apiBase` değerini güncelleyin:

```json
{
  "expo": {
    "extra": {
      "apiBase": "http://10.0.2.2:4000"  // Android emulator
    }
  }
}
```

**Platform Bazlı Adresler:**
- **Android Emulator:** `http://10.0.2.2:4000`
- **iOS Simulator:** `http://localhost:4000`
- **Fiziksel Cihaz (LAN):** `http://<BILGISAYAR_IP>:4000`

Alternatif olarak ortam değişkeni kullanabilirsiniz:

```bash
export EXPO_PUBLIC_API_BASE=http://192.168.1.100:4000
```

### Backend Ortam Değişkenleri

```bash
# CORS ayarları
export CORS_ORIGIN=*

# Port (varsayılan: 4000)
export PORT=4000
```

## 📡 API Endpoints

### Auth
- `POST /auth/register` - Yeni kullanıcı kaydı
- `POST /auth/login` - E-posta/şifre ile giriş
- `POST /auth/otp/request` - OTP kodu gönder
- `POST /auth/otp/verify` - OTP kodu doğrula
- `GET /auth/me` - Kullanıcı bilgisi

### Gruplar
- `POST /api/groups` - Yeni grup oluştur
- `GET /api/groups/:code/info` - Grup bilgisi
- `GET /api/groups/:groupId/members` - Grup üyeleri
- `GET /api/groups/user/:userId/active` - Kullanıcının aktif grupları
- `GET /api/groups/user/:userId/admin` - Kullanıcının admin olduğu gruplar

### Grup Üyelik
- `POST /api/groups/:code/join-request` - Gruba katılma isteği
- `GET /api/groups/:groupId/requests` - Bekleyen istekler
- `POST /api/groups/:groupId/requests/:requestId/approve` - İsteği onayla
- `POST /api/groups/:groupId/requests/:requestId/reject` - İsteği reddet

### Konum
- `POST /api/locations` - Konum gönder (legacy)
- `GET /api/locations/:workerId` - Kullanıcı konum geçmişi
- `GET /api/locations/:workerId/recent` - Son konumlar
- `GET /api/locations/latest` - Tüm kullanıcıların son konumu
- `GET /api/active` - Aktif cihazlar
- `POST /api/groups/:groupId/locations` - Grup konumu gönder
- `GET /api/groups/:groupId/locations` - Grup konumları

### Socket.IO Events
- `join_group` - Gruba katıl
- `leave_group` - Gruptan ayrıl
- `group_location_update` - Konum güncelle (client → server)
- `location_update` - Konum güncellemesi (server → clients)
- `new_request` - Yeni katılma isteği
- `member_approved` - Üye onaylandı

## 🗂️ Proje Yapısı

```
my-app/
├── api/
│   ├── server.js          # Express + Socket.IO backend
│   └── data.json          # Kalıcı veri depolama
├── app/
│   ├── (tabs)/
│   │   ├── auth/          # Auth ekranları (login, register, otp)
│   │   ├── index.tsx      # Ana sayfa
│   │   ├── groups.tsx     # Grup yönetimi
│   │   ├── track.tsx      # Konum takip
│   │   ├── admin.tsx      # Admin paneli
│   │   └── settings.tsx   # Ayarlar
│   ├── group-map.tsx      # Grup harita görünümü
│   ├── guide.tsx          # Rehber ekranı
│   └── _layout.tsx        # Root layout
├── components/
│   └── leaflet-map.tsx    # Leaflet harita bileşeni
├── utils/
│   ├── api.ts             # API base URL yönetimi
│   └── auth.ts            # Auth yardımcıları
└── package.json
```

## 🚀 Dağıtım

### 📱 Mobil Uygulama Build

#### **Android APK Build (Hızlı Test)**

```bash
# 1. EAS CLI yükle (ilk kez)
npm install -g eas-cli

# 2. Expo hesabına giriş
eas login

# 3. Proje yapılandır (ilk kez)
eas build:configure

# 4. Preview APK oluştur
eas build --platform android --profile preview

# 5. Production APK
eas build --platform android --profile production-apk
```

#### **iOS Build (Mac gerekli)**

```bash
# Development build (simulator)
eas build --platform ios --profile development

# Production build (App Store)
eas build --platform ios --profile production
```

#### **Local Development Build**

```bash
# Android
npx expo run:android

# iOS (Mac gerekli)
npx expo run:ios
```

### 🔧 Platform-Specific Optimizasyonlar

#### **Android**
- ✅ Foreground service için `FOREGROUND_SERVICE_LOCATION` izni eklendi
- ✅ Edge-to-edge UI aktif
- ✅ Adaptive icon yapılandırıldı
- ✅ Keyboard behavior: `pan` mode
- ✅ ProGuard/R8 minification hazır

#### **iOS**
- ✅ Background location tracking aktif
- ✅ Status bar appearance yapılandırıldı
- ✅ Tablet desteği aktif
- ✅ Universal links hazır (`iscitakip://`)

### 🐳 Docker ile Backend

```bash
# Docker image oluştur
docker build -t worker-tracker-backend .

# Container çalıştır
docker run -p 4000:4000 -e CORS_ORIGIN="*" worker-tracker-backend
```

### ☁️ Cloud Platformlar

**Render / Railway / Heroku:**
1. Node.js servisi oluştur
2. Start command: `node api/server.js`
3. Ortam değişkenlerini ayarla: `CORS_ORIGIN`, `PORT`
4. Port'u expose et

### 📦 Build Profilleri (eas.json)

- **development**: Debug build, simulator için
- **preview**: Internal testing, APK format
- **production**: App Store/Play Store için optimize
- **production-apk**: Production APK (Play Store dışı dağıtım)

## 📱 Ekranlar

1. **Ana Sayfa** - Uygulama özeti ve hızlı erişim
2. **Gruplar** - Grup oluştur, katıl, yönet
3. **Takip** - Konum takip ve harita görünümü
4. **Admin** - Grup başvurularını onayla/reddet
5. **Ayarlar** - Hesap ve uygulama ayarları
6. **Grup Haritası** - Gerçek zamanlı grup konumları
7. **Rehber** - Uygulama kullanım kılavuzu
8. **Auth** - Giriş, kayıt, OTP

## 🔧 Geliştirme

Geliştirmeye **app** klasöründeki dosyaları düzenleyerek başlayabilirsiniz. Bu proje [Expo Router](https://docs.expo.dev/router/introduction) ile dosya tabanlı yönlendirme kullanır.

## 🐛 Sorun Giderme

### Backend'e bağlanamıyorum
- Backend'in çalıştığından emin olun: `npm run server`
- `app.json` dosyasındaki `apiBase` adresini kontrol edin
- Firewall ayarlarını kontrol edin
- Android emulator için `10.0.2.2`, iOS için `localhost` kullanın

### Konum izni alınamıyor
- `app.json` dosyasındaki izin açıklamalarını kontrol edin
- Cihaz ayarlarından konum iznini manuel olarak verin
- iOS için "Always" izni gereklidir (arka plan takip için)

### Socket.IO bağlantı hatası
- Backend'in Socket.IO desteğiyle çalıştığından emin olun
- CORS ayarlarını kontrol edin
- Network inspector ile bağlantıyı kontrol edin

## 📚 Kaynaklar

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 👥 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📞 İletişim

**ELEKS İntegrasyon**
- E-posta: destek@ornek.com
- Telefon: +90 555 123 45 67
- Web: https://eleks.com.tr

---

**Not:** Bu proje demo amaçlıdır. Production ortamında kullanmadan önce güvenlik önlemlerini (şifre hashleme, JWT token, rate limiting, vb.) eklemeyi unutmayın.

# İşçi Takip Uygulaması (Expo + Node)

Modern saha ekip takibi. Gruplar, canlı konum paylaşımı, raporlar ve blog rehberleriyle birlikte gelir.

## Özellikler
- Gruplar: Oluştur/katıl/ayrıl, son admin devretme, silme (canlı yansır).
- Canlı Takip: Socket.IO + HTTP fallback, arka plan desteği.
- Dashboard: Deterministik istatistikler (aktif işçi, grup, km).
- Blog & Rehberler: Liste + detay sayfaları, uzun makaleler.
- Verileri Temizle: Leave-all + purge + cihaz temizliği + global reset.
- Android için optimize: Ripple, grid, elevation, spacing.

## Gereksinimler
- Node.js 18+
- Expo CLI
- (Opsiyonel) EAS CLI (build için)

## Kurulum
```bash
# Bağımlılıklar
npm install

# Backend
npm run server  # http://localhost:4000

# Mobil uygulama
npx expo start  # LAN seçin