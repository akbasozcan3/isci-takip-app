# Authentication Flow - Modern Email Verification

## 📋 Genel Bakış

Bu proje **zorunlu email doğrulama** ile modern bir kimlik doğrulama sistemi kullanmaktadır.

## 🔄 Akış Diagramı

### Kayıt (Register) Akışı

```
1. Kullanıcı Email Girer
   ↓
2. Backend Email Formatını Kontrol Eder
   ↓
3. Backend Email'in Kayıtlı Olmadığını Kontrol Eder
   ↓
4. Rate Limiting Kontrolü (10 dakikada max 3 istek)
   ↓
5. Backend 6 Haneli Kod Üretir
   ↓
6. Backend Kodu Veritabanına Kaydeder
   ↓
7. Backend Python Email Servisini Çağırır (Kod ile birlikte)
   ↓
8. Python Servisi Gmail SMTP ile Email Gönderir
   ↓
9. Kullanıcı Email'inde Kodu Görür
   ↓
10. Kullanıcı Kodu Girer
   ↓
11. Backend Kodu Doğrular (10 dakika geçerlilik)
   ↓
12. Email Verified = true olarak işaretlenir
   ↓
13. Kullanıcı Şifre ve İsim Bilgilerini Girer
   ↓
14. Kayıt Tamamlanır, Token Oluşturulur
```

### Giriş (Login) Akışı

```
1. Kullanıcı Email ve Şifre Girer
   ↓
2. Backend Email'i Bulur
   ↓
3. Backend Email'in Doğrulanmış Olduğunu Kontrol Eder
   ↓
4. ❌ Email Doğrulanmamışsa → Hata Mesajı (Giriş Yapılamaz)
   ↓
5. ✅ Email Doğrulanmışsa → Şifre Kontrolü
   ↓
6. Şifre Doğruysa → Token Oluşturulur → Giriş Başarılı
```

## 🐍 Python Email Servisi

### Özellikler

- ✅ **Gerçekçi Email Tasarımı**: Modern HTML email template
- ✅ **Güvenlik**: SMTP authentication, input validation
- ✅ **Error Handling**: Detaylı hata mesajları
- ✅ **Logging**: Tüm işlemler loglanır
- ✅ **Timeout**: 10 saniye timeout koruması

### Çalışma Prensibi

1. **Backend** kod üretir
2. **Backend** kodu Python servisine gönderir
3. **Python Servisi** sadece email gönderir (kod üretmez)
4. Bu sayede **tek kaynak gerçeği** (single source of truth) sağlanır

## 🔒 Güvenlik Özellikleri

1. **Rate Limiting**: 10 dakikada maksimum 3 kod isteği
2. **Kod Geçerliliği**: Kodlar 10 dakika geçerlidir
3. **Email Validation**: Hem frontend hem backend'de
4. **Zorunlu Doğrulama**: Email doğrulanmadan kayıt/giriş yapılamaz
5. **Password Hashing**: bcrypt ile şifre hashleme

## 📧 Email Template

Email'ler şu bilgileri içerir:
- Modern gradyan tasarım
- Büyük, okunabilir kod
- Güvenlik uyarısı
- Geçerlilik süresi bilgisi
- Marka kimliği

## 🚀 Kullanım

### 1. Backend'i Başlat
```bash
cd api
npm start
```

### 2. Python Email Servisini Başlat
```bash
cd api
start-email-service.bat
```

### 3. Frontend'i Başlat
```bash
npm start
```

## ⚙️ Yapılandırma

`.env` dosyası:
```env
# Backend
NODE_ENV=development
PORT=4000
JWT_SECRET=your-secret-key
EMAIL_SERVICE_URL=http://localhost:5001

# Python Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
EMAIL_SERVICE_PORT=5001
```

## 🧪 Test Senaryoları

### Senaryo 1: Başarılı Kayıt
1. Email gir → Kod gönderilir
2. Kod gir → Doğrulanır
3. Şifre/İsim gir → Kayıt tamamlanır

### Senaryo 2: Email Doğrulanmadan Giriş
1. Email/Şifre gir → ❌ "Email not verified" hatası

### Senaryo 3: Rate Limiting
1. 4. kez kod iste → ❌ "Too many requests" hatası
2. 10 dakika bekle → ✅ Tekrar deneyebilir

### Senaryo 4: Kod Süresi Dolmuş
1. 10 dakikadan sonra kod gir → ❌ "Code expired" hatası

## 📝 Notlar

- Development modunda kod console'da gösterilir
- Production'da kod asla response'da dönmez
- Email servisi çalışmıyorsa backend kod üretmeye devam eder (test için)
- Tüm hatalar kullanıcıya anlaşılır şekilde gösterilir

