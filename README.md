# İşçi Takip Platformu (Expo + Node.js)

Gerçek zamanlı konum takibi, grup yönetimi ve e-posta doğrulamalı kimlik doğrulama içeren, yayınlanmaya hazır bir mobil + backend çözümü.

---

## İçindekiler
1. [Mimari](#mimari)
2. [Gereksinimler](#gereksinimler)
3. [Kurulum & Çalıştırma](#kurulum--çalıştırma)
4. [Ortam Değişkenleri](#ortam-değişkenleri)
5. [PM2 ile Production Backend](#pm2-ile-production-backend)
6. [Build / Dağıtım](#build--dağıtım)
7. [Test Akışı](#test-akışı)
8. [Sorun Giderme](#sorun-giderme)

---

## Mimari

```
my-app
├── app/                  # Expo Router tabanlı mobil istemci
├── backend/              # Express + Socket.IO + Flask SMTP servisi
│   ├── server.js         # Ana Node.js API
│   ├── email_service.py  # Gmail SMTP doğrulama servisi
│   └── data.json         # Dosya tabanlı veri deposu
├── components/, utils/   # Paylaşılan RN bileşenleri / yardımcılar
└── package.json          # Monorepo script'leri
```

Başlıca özellikler:
- Socket.IO ile canlı konum yayını ve grup bazlı odalar
- OTP + e-posta doğrulamalı auth akışı
- Leaflet & React Native Maps destekli takip ekranları
- PM2 üzerinden 7/24 çalışan backend + SMTP servisi

---

## Gereksinimler

- Node.js **18+**
- npm **8+**
- Python **3.11+** (Flask e-posta servisi için)
- Expo CLI (`npx expo …` komutları yeterli)
- (Opsiyonel) EAS CLI – market build’leri için

---

## Kurulum & Çalıştırma

1. **Bağımlılıkları yükle**
   ```bash
   npm install
   npm --prefix backend install
   python -m venv venv && venv\Scripts\pip install -r backend/requirements.txt  # Windows
   ```

2. **Ortam dosyalarını oluştur**
   - `cp backend/env.example backend/.env`
   - `cp env.example .env` (Expo için opsiyonel)

3. **Geliştirme ortamı**
   ```bash
   # Sadece backend
   npm run start:backend          # Node + Socket.IO
   (cd backend && python email_service.py)  # Gmail SMTP servisi

   # Mobil uygulama
   npx expo start
   ```
   Android emulator API tabanı otomatik olarak `http://10.0.2.2:4000`’e düşer; iOS simulator için `http://localhost:4000` kullanılır. Farklı bir backend URL’si vermek için (ör. fiziksel cihazdan LAN IP’ye gitmek):
   ```bash
   $env:EXPO_PUBLIC_API_BASE_URL="https://api.domain.com"   # PowerShell
   export EXPO_PUBLIC_API_BASE_URL=https://api.domain.com   # macOS/Linux
   ```

### Windows tek komut başlatma

- **PowerShell:** `.\start-backend.ps1`
- **CMD:** `start-backend.bat`

Bu scriptler:
- `backend/.env` dosyasını `env.example` üzerinden üretir,
- Node bağımlılıklarını yükler,
- Repodaki `venv/` altında Python sanal ortamını kurup `backend/requirements.txt` içindeki Flask + SMTP bağımlılıklarını yükler,
- `pm2` ile hem Express API’yi hem de `email_service.py` sürecini arka planda başlatır.

Servisler başladıktan sonra sağlık kontrolleri:
- API: `http://localhost:4000/api/health`
- Email servisi: `http://localhost:5001/health`

---

## Ortam Değişkenleri

| Dosya | Anahtar | Açıklama |
|-------|---------|----------|
| `backend/.env` | `PORT` | Node API portu (varsayılan 4000) |
|  | `JWT_SECRET` | JWT imzalama anahtarı (production’da zorunlu) |
|  | `EMAIL_SERVICE_URL` | Node’un Flask servisine erişeceği URL (`http://localhost:5001`) |
|  | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gmail App Password bilgileri |
|  | `EMAIL_LOGO_URL` | Doğrulama e-postasında gösterilecek logo (https link) |
|  | `ALLOWED_ORIGINS` | CORS whitelist (virgülle ayır) |
|  | `APP_SCHEME`, `FRONTEND_URL` | Şifre sıfırlama linkleri için deep link ayarları |
|  | `ADMIN_RESET_TOKEN` | Tüm veriyi silen admin endpoint’i için gizli anahtar |
| `.env` (opsiyonel) | `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_API_URL` | Mobil istemci için varsayılan API tabanı |

Güncel örnek değerler için `backend/env.example` ve kök `env.example` dosyalarına bakın.

---

## PM2 ile Production Backend

1. **İlk kurulum**
   ```bash
   cd backend
   pm2 delete all                 # varsa eski süreçleri temizle
   pm2 start ecosystem.config.js  # hem api hem email servisi
   pm2 save
   ```
2. **Windows’ta otomatik başlangıç**
   ```powershell
   # PowerShell'i yönetici olarak aç
   pm2 startup windows
   # Komut çıktısında verilen ek satırı çalıştır (ör. Register-ScheduledTask ...).
   ```
3. **Durum ve loglar**
   ```bash
   pm2 status
   pm2 logs isci-takip-api
   pm2 logs email-service
   ```
4. **Sağlık kontrolleri**
   - API: `http://<server>:4000/api/health`
   - SMTP servisi: `http://<server>:5001/health`

PM2 konfig dosyası (`backend/ecosystem.config.js`) Node sürecini `server.js` ile, SMTP sürecini de sanal ortam Python yorumlayıcısı ile başlatır; ekstra script yazmaya gerek yoktur.

---

## Build / Dağıtım

- **Android APK (Preview):**
  ```bash
  npm install -g eas-cli
  eas login
  eas build:configure
  eas build --platform android --profile preview
  ```
- **Production APK / AAB:** `eas build --platform android --profile production-apk` veya `--profile production`.
- **iOS:** Mac gerektirir → `eas build --platform ios --profile production`.
- **Yerel cihaz test:** `npx expo run:android` veya `npx expo run:ios`.

Backend’i Render/Railway gibi platformlara taşıyacaksan:
1. Node 18 ortamı aç.
2. Start komutu: `cd backend && node server.js`.
3. `PORT`, `JWT_SECRET`, `EMAIL_SERVICE_URL`, `SMTP_*` gibi değişkenleri UI’dan tanımla.
4. Flask servisini ayrı bir dyno/VM’de çalıştır veya `EMAIL_SERVICE_URL`’i mevcut hosta göre güncelle.

### Tüm Veriyi Sıfırlama

Üretim dışı ortamlarda tüm kullanıcıları, tokenları ve JSON verisini sıfırlamak için korumalı admin endpoint’i kullan:

```bash
curl -X POST https://<host>/api/admin/reset-all \
  -H "Content-Type: application/json" \
  -H "x-reset-token: <ADMIN_RESET_TOKEN>"
```

`ADMIN_RESET_TOKEN` değeri `.env` dosyasında tanımlanmalıdır. Yanlış token gönderilirse istek reddedilir.

---

## Test Akışı

1. `pm2 start ecosystem.config.js` → `http://localhost:4000/api/health` = OK  
2. `curl -X POST http://localhost:5001/send-verification -d '{"email":"test@domain.com","code":"123456"}'` → Gmail kutusuna düşmesi  
3. Mobilde `Register` ekranı → e-posta OTP → `login` → `track` sekmesinde Socket.IO akışı  
4. `POST /api/location/store` ile manuel konum gönder; admin panelinde listelenmeli  
5. `npm run lint` (Expo) ve `npm --prefix backend run lint` (varsa) → hatasız

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `localhost:5001` açılmıyor | Flask servisi çalışmıyor; `pm2 logs email-service` ile kontrol et, App Password / firewall ayarlarını doğrula. |
| Android emülatörü API’ye bağlanmıyor | `EXPO_PUBLIC_API_BASE` boş bırak, app varsayılan olarak `http://10.0.2.2:4000` kullanır. Fiziksel cihaz için `http://<LAN_IP>:4000` gir. |
| Render’da soğuk başlama | İlk istekte 30 sn kadar beklemek normal. Keep-alive için ücretsiz cron ping kullanabilirsin. |
| Gmail doğrulama e-postası gelmiyor | `backend/.env` içindeki `SMTP_*` değerlerini (özellikle App Password) kontrol et, `http://localhost:5001/health` endpoint’inden servis durumunu doğrula ve detay için `backend/logs/email-err.log` dosyasını incele. |
| JSON veritabanı bozuldu | `backend/data.backup.json` dosyasını `data.json` olarak kopyala, servisleri yeniden başlat. |

---

## Lisans

MIT Lisansı. Üretim ortamında ek güvenlik katmanları (gerçek DB, rate limit, şifre rotasyonu vb.) eklemeniz önerilir.

---

Soruların için: `destek@iscitakip.com`

İyi yayınlar! 🚀