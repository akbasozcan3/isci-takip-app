# Backend Kurulum Rehberi

## Gereksinimler

### 1. Node.js (Ana Servis)
- **Versiyon**: 18+
- **Durum**: ✅ Çalışıyor
- **Port**: 4000

### 2. Python
- **Versiyon**: 3.11+
- **Durum**: ✅ Çalışıyor (Python 3.11.9)
- **Portlar**: 5001 (Email), 8000 (Analytics)

### 3. Java
- **Mevcut Versiyon**: 1.8.0_471
- **Gereken Versiyon**: 17+ (Spring Boot 3.1 için)
- **Durum**: ⚠️ Eski versiyon, güncelleme önerilir
- **Port**: 7000

**Java 17+ Kurulumu:**
1. https://adoptium.net/ adresinden Java 17+ indirin
2. Kurulumdan sonra PATH'e ekleyin:
   ```powershell
   cd backend\scripts
   .\setup-java-path.ps1
   ```

### 4. Go
- **Durum**: ❌ PATH'te bulunamadı
- **Port**: 8080

**Go Kurulumu:**
1. https://go.dev/dl/ adresinden Go'yu indirin
2. Kurulumdan sonra PATH'e ekleyin:
   ```powershell
   cd backend\scripts
   .\setup-go-path.ps1
   ```
3. Yeni terminal açın veya:
   ```powershell
   $env:Path += ";C:\Program Files\Go\bin"
   ```

### 5. PHP
- **Versiyon**: 8.4.14
- **Durum**: ✅ Çalışıyor
- **Port**: 9000

### 6. C# (.NET)
- **Durum**: ✅ Çalışıyor
- **Port**: 6000

## Hızlı Başlatma

```powershell
cd backend
pm2 start ecosystem.config.js
pm2 status
```

## Servis Durumu

| Servis | Dil | Port | Durum | Notlar |
|--------|-----|------|-------|--------|
| Node.js API | JavaScript | 4000 | ✅ | Ana servis |
| Python Email | Python | 5001 | ✅ | SMTP servisi |
| Python Analytics | Python | 8000 | ✅ | FastAPI servisi |
| Go Location | Go | 8080 | ⚠️ | PATH'e eklenmeli |
| Java Billing | Java | 7000 | ⚠️ | Java 17+ önerilir |
| PHP Notifications | PHP | 9000 | ✅ | Laravel servisi |
| C# Reports | C# | 6000 | ✅ | ASP.NET Core |

## Notlar

- Go servisi Redis olmadan da çalışır (opsiyonel)
- Java 1.8 çalışıyor ama Spring Boot 3.1 için Java 17+ önerilir
- Tüm servisler PM2 ile yönetiliyor
