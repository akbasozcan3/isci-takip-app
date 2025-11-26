# İşçi Takip Uygulaması - Müşteri Deployment Rehberi

## 📱 Uygulama Paketi İçeriği

### Frontend (Mobile App)
- ✅ **Android APK** - Müşteriye test için
- ✅ **Kaynak kodlar** - React Native/Expo
- ✅ **Kurulum rehberi**

### Backend (API Server)
- ✅ **Node.js API** - Tüm backend servisleri
- ✅ **PostgreSQL Database** - Veri tabanı şemaları
- ✅ **Deployment scriptleri**

## 🚀 Backend Deployment Seçenekleri

### Seçenek 1: Railway (Önerilen - Kolay)
**Maliyet:** $5/ay
**Avantajlar:** 
- Otomatik deployment
- PostgreSQL dahil
- SSL sertifikası otomatik

**Kurulum:**
1. Railway.app'e kayıt ol
2. GitHub'dan backend kodunu import et
3. PostgreSQL servisini ekle
4. Environment variables ayarla
5. Deploy et

### Seçenek 2: Render (Ücretsiz Plan Var)
**Maliyet:** Ücretsiz (sınırlı) / $7/ay
**Avantajlar:**
- Ücretsiz plan
- PostgreSQL dahil
- Kolay kurulum

### Seçenek 3: VPS (Kendi Sunucu)
**Maliyet:** $5-20/ay
**Avantajlar:**
- Tam kontrol
- Daha ucuz (uzun vadede)
- Özelleştirilebilir

**Gereksinimler:**
- Ubuntu 20.04+
- Node.js 18+
- PostgreSQL 14+
- Nginx (opsiyonel)

## 🔧 Environment Variables (Gerekli)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Secret
JWT_SECRET=your-super-secret-key-here

# API Port
PORT=4000

# Frontend URL (CORS için)
FRONTEND_URL=https://your-app-domain.com
```

## 📱 Mobile App Konfigürasyonu

### API URL Değiştirme
`app.json` dosyasında:
```json
{
  "expo": {
    "extra": {
      "apiBase": "https://your-backend-url.com"
    }
  }
}
```

### Yeni Build Alma
```bash
# Android APK
eas build --platform android

# iOS (Apple Developer hesabı gerekli)
eas build --platform ios
```

## 💾 Database Setup

### 1. PostgreSQL Kurulumu
```sql
-- Veritabanı oluştur
CREATE DATABASE isci_takip;

-- Kullanıcı oluştur
CREATE USER isci_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE isci_takip TO isci_user;
```

### 2. Tablo Oluşturma
Backend ilk çalıştırıldığında otomatik olarak tablolar oluşturulur.

## 🔒 Güvenlik Ayarları

### SSL Sertifikası
- Railway/Render: Otomatik
- VPS: Let's Encrypt kullanın

### Firewall
```bash
# Sadece gerekli portları aç
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw allow 4000  # API (opsiyonel)
```

## 📊 Monitoring (Opsiyonel)

### Log Takibi
- **Railway:** Built-in logs
- **VPS:** PM2 + Winston

### Uptime Monitoring
- UptimeRobot (ücretsiz)
- Pingdom

## 💰 Maliyet Hesaplaması

| Seçenek | Aylık Maliyet | Kurulum | Bakım |
|---------|---------------|---------|-------|
| Railway | $5-15 | Kolay | Minimal |
| Render | $0-7 | Kolay | Minimal |
| VPS | $5-20 | Orta | Manuel |

## 🆘 Destek

### Teknik Destek
- **Kurulum:** 1 hafta ücretsiz destek
- **Bakım:** Aylık destek paketi mevcut

### Dokümantasyon
- API dokümantasyonu
- Troubleshooting rehberi
- Video kurulum rehberi

## 📞 İletişim

**Acil Durum:** WhatsApp/Telegram
**Teknik Sorular:** Email
**Kurulum Desteği:** Uzaktan bağlantı

---

## ⚡ Hızlı Başlangıç (Railway)

1. **Railway.app**'e git
2. **"Deploy from GitHub"** seç
3. Backend repository'sini seç
4. **PostgreSQL** ekle
5. Environment variables ekle
6. **Deploy** butonuna bas
7. Domain'i kopyala
8. Mobile app'te API URL'i güncelle

**Tahmini Süre:** 15 dakika
**Maliyet:** $5/ay

Bu şekilde uygulamanız 15 dakika içinde canlıya alınabilir!
