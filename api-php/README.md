## PHP Email Verification API

Bu mini API; 6 haneli OTP üretir, 15 dk geçerli olacak şekilde `verification_codes` tablosunda saklar, Gmail SMTP ile e-posta gönderir ve doğrulama akışını yönetir.

### Özellikler
- 6 haneli OTP, 15 dk geçerlilik
- `POST /api/auth/resend-code`: 60s cooldown, günlük limit
- `POST /api/auth/verify-code`: yanlış denemelerde kilit (varsayılan 5)
- PHPMailer ile Gmail SMTP
- SQLite varsayılan, MySQL opsiyonel

### Kurulum
1) Dizine girin ve bağımlılıkları kurun:
```bash
cd api-php
composer install
```

2) Ortam değişkenlerini ayarlayın:
```bash
copy env.sample .env    # Windows
# veya
cp env.sample .env      # macOS/Linux
```
`.env` içinde aşağıdaki değerleri doldurun:

```
APP_ENV=local
DEV_RETURN_CODE=1

DB_DRIVER=sqlite
SQLITE_PATH=storage/app.sqlite

OTP_EXPIRE_MIN=15
OTP_MAX_ATTEMPTS=5
OTP_DAILY_LIMIT=5

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=app_password_here   # Gmail Uygulama Şifresi
SMTP_FROM=your@gmail.com
SMTP_FROM_NAME=My App
```

3) Sunucuyu başlatın:
```bash
php -S 0.0.0.0:8080 -t public
```
veya Windows için `quick-start.bat` kullanın.

### Endpointler
- POST `/api/auth/resend-code`
  - body: `{ "email": "user@example.com" }`
  - 60 saniye cooldown, günlük limit (`OTP_DAILY_LIMIT`)

- POST `/api/auth/verify-code`
  - body: `{ "email": "user@example.com", "code": "123456" }`
  - Başarılıysa ilgili kullanıcının `users.is_verified = 1` yapılır

### Notlar
- Varsayılan DB `SQLite` olarak `storage/app.sqlite` dosyasıdır. MySQL için `.env` değerlerini doldurun ve `DB_DRIVER=mysql` yapın.
- Gmail SMTP için 2FA açıkken Uygulama Şifresi kullanmanız gerekir.


