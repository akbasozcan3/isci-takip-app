# ✅ Proje Çalışır Durumda!

## 🎉 Yapılanlar

### Backend (Node.js)
- ✅ Python backend tamamen Node.js'e çevrildi
- ✅ Telefon/SMS doğrulama kaldırıldı (ücretsiz)
- ✅ **E-posta doğrulama** Gmail SMTP ile aktif
- ✅ Tüm auth endpoint'leri çalışıyor:
  - `POST /auth/pre-verify-email` → Kod gönderir
  - `POST /auth/pre-verify-email/verify` → Kodu doğrular, pre_token verir
  - `POST /auth/register` → Kayıt (pre_token gerekli)
  - `POST /auth/login` → Giriş (JWT access_token döner)
  - `POST /auth/forgot` → Şifre sıfırlama kodu gönderir
  - `POST /auth/reset` → Şifreyi sıfırlar
  - `GET /auth/me` → Kullanıcı bilgisi (Bearer token ile)
  - `GET /health` → Sunucu durumu

### Frontend
- ✅ Geliştirmede otomatik `http://localhost:4000` kullanır
- ✅ Üretimde Render URL'ini kullanır
- ✅ E-posta doğrulama akışı hazır:
  - `app/auth/register.tsx` → Kayıt formu
  - `app/auth/verify-email.tsx` → E-posta doğrulama
  - `app/auth/login.tsx` → Giriş
  - `app/auth/forgot.tsx` → Şifremi unuttum

## 🚀 Nasıl Çalıştırılır?

### 1. Backend'i Başlat (Terminal 1)
```powershell
cd api
npm start
```

Çıktı:
```
[data] Loaded from disk
🚀 İşçi Takip API running on port 4000
🏥 Health check: http://localhost:4000/health
```

### 2. Frontend'i Başlat (Terminal 2)
```powershell
npm start
# veya
npx expo start
```

### 3. Test Et (Terminal 3 - Opsiyonel)
```powershell
cd api
powershell -ExecutionPolicy Bypass -File test-email.ps1
powershell -ExecutionPolicy Bypass -File test-verify.ps1
```

## 📧 Gmail SMTP Ayarları

**Dosya**: `api/.env`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ozcanakbas38@gmail.com
SMTP_PASS=icwu lngv whvq nzvk
SMTP_FROM=ozcanakbas38@gmail.com
```

**Not**: 
- `SMTP_PASS` Gmail'de **2 Adımlı Doğrulama** + **Uygulama Şifresi**dir
- E-postalar gelmezse Spam klasörünü kontrol edin
- Dev modda `dev_code` response'da döner (test için)

## 🌐 Render'a Yayınlama

### Node Backend Ayarları
- **Root Directory**: `api/`
- **Build Command**: `npm ci` (yoksa `npm install`)
- **Start Command**: `node server.js`
- **Health Check Path**: `/health`

### Environment Variables (Render Settings)
```
SECRET_KEY=cfd1df8df3a71c6c0a47cb55a55fe8e8bd1dda006e10c8eab9685719d2da7d11efdd2fb1e10e8ae7ae1214e729ebe05a
ALLOWED_ORIGINS=https://isci-takip-paneli.onrender.com,http://localhost:19006
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ozcanakbas38@gmail.com
SMTP_PASS=icwu lngv whvq nzvk
SMTP_FROM=ozcanakbas38@gmail.com
VERIFY_CODE_EXPIRE_MIN=30
RESET_CODE_EXPIRE_MIN=15
RESET_DEV_RETURN_CODE=0
PRE_EMAIL_TOKEN_MIN=30
ACCESS_TOKEN_EXPIRE_MIN=10080
```

## 📱 Frontend API Bağlantısı

**Dosya**: `utils/api.ts`

- **Geliştirme**: Otomatik `http://localhost:4000`
- **Üretim**: `https://isci-takip-paneli.onrender.com`

Manuel değiştirmek için:
```typescript
// utils/api.ts içinde
export function getApiBase(): string {
  const envBase = process.env.EXPO_PUBLIC_API_BASE;
  if (envBase) return envBase.replace(/\/$/, '');
  
  // Geliştirme
  if (__DEV__) {
    return 'http://localhost:4000';
  }
  // Üretim
  return 'https://<sizin-render-url>.onrender.com';
}
```

## 🧪 Test Akışı

### 1. E-posta Kodu Gönder
```powershell
$body = @{ email = "ozcanakbas38@gmail.com" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/pre-verify-email" -ContentType "application/json" -Body $body
```
**Response**: `{ ok: true, dev_code: "123456" }`

### 2. Kodu Doğrula
```powershell
$body = @{ email = "ozcanakbas38@gmail.com"; code = "123456" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/pre-verify-email/verify" -ContentType "application/json" -Body $body
```
**Response**: `{ pre_token: "eyJhbG..." }`

### 3. Kayıt Ol
```powershell
$body = @{
  email = "ozcanakbas38@gmail.com"
  password = "Sifre123!"
  name = "Özcan"
  pre_token = "eyJhbG..."
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/register" -ContentType "application/json" -Body $body
```
**Response**: `{ id: "...", email: "...", name: "..." }`

### 4. Giriş Yap
```powershell
$body = @{
  username = "ozcanakbas38@gmail.com"
  password = "Sifre123!"
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:4000/auth/login" -ContentType "application/json" -Body $body
```
**Response**: `{ access_token: "eyJhbG...", token_type: "bearer" }`

## 📂 Proje Yapısı

```
my-app/
├── api/
│   ├── server.js          # ✅ Node backend (E-posta auth ile)
│   ├── .env              # ✅ SMTP ayarları
│   ├── package.json       # ✅ Bağımlılıklar
│   ├── data.json         # Veri depolama
│   ├── test-email.ps1    # ✅ Test scripti
│   └── test-verify.ps1   # ✅ Tam akış testi
├── app/
│   ├── auth/
│   │   ├── register.tsx   # ✅ Kayıt (telefon opsiyonel)
│   │   ├── verify-email.tsx # ✅ E-posta doğrulama
│   │   ├── login.tsx      # ✅ Giriş
│   │   └── forgot.tsx     # ✅ Şifremi unuttum
│   └── ...
├── utils/
│   └── api.ts            # ✅ API base URL (localhost:4000)
└── CALISMA_REHBERI.md    # 👈 Bu dosya
```

## ✨ Önemli Notlar

1. **Backend Port**: Varsayılan 4000. Değiştirmek için: `set PORT=4001 && npm start`

2. **Aynı Terminal Hatası**: Server ve test komutlarını aynı terminalde çalıştırmayın. Server'ı bir pencerede açık tutun, testleri başka pencerede yapın.

3. **E-posta Gelmiyorsa**:
   - Spam klasörünü kontrol edin
   - Gmail 2FA + App Password doğru mu bakın
   - `RESET_DEV_RETURN_CODE=1` ise response'da `dev_code` gelir

4. **Frontend Bağlantısı**: 
   - Geliştirmede otomatik `localhost:4000` kullanır
   - Backend çalışırken Expo uygulamasını başlatın

## 🎯 Sonuç

✅ **Backend çalışıyor** (http://localhost:4000)
✅ **E-posta doğrulama aktif** (Gmail SMTP)
✅ **Telefon/SMS yok** (ücretsiz)
✅ **Frontend hazır** (localhost:4000'e bağlı)
✅ **Testler başarılı** (kayıt, giriş, şifre sıfırlama)

**Render'a yayın için**: `api/.env` değerlerini Render Environment Variables'a ekle ve deploy et!
