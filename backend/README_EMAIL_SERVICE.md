# Email Verification Service - Python

Bu proje için Python tabanlı e-posta doğrulama servisi kullanılmaktadır.

## Kurulum

### 1. Python Kurulumu
Python 3.8+ gereklidir. [Python.org](https://www.python.org/downloads/) adresinden indirebilirsiniz.

### 2. Virtual Environment Oluştur (Önerilen)
```bash
cd api
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Dependencies Kur
```bash
pip install -r requirements.txt
```

## Başlatma

### Windows
```bash
start-email-service.bat
```

### Manuel
```bash
cd api
python email_service.py
```

Servis `http://localhost:5001` adresinde çalışacaktır.

## Yapılandırma

`.env` dosyasında şu ayarlar olmalı:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
EMAIL_SERVICE_PORT=5001
```

**Gmail için App Password oluşturma:**
1. Google Hesabınıza giriş yapın
2. 2 Adımlı Doğrulama'yı açın
3. Uygulama Şifreleri'ne gidin
4. Yeni bir uygulama şifresi oluşturun
5. Bu şifreyi `SMTP_PASS` olarak kullanın

## API Endpoints

### POST /send-verification
E-posta doğrulama kodu gönderir.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent",
  "code": "123456"  // Sadece development modunda
}
```

### GET /health
Servis durumunu kontrol eder.

**Response:**
```json
{
  "status": "OK",
  "service": "Email Verification Service"
}
```

## Backend Entegrasyonu

Backend, email servisi için şu environment variable'ı kullanır:
- `EMAIL_SERVICE_URL`: Email servisinin URL'i (varsayılan: `http://localhost:5001`)

Backend'deki `authController.js` otomatik olarak bu servisi kullanır.

