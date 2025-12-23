# BAVAXE - GPS Takip ve İşçi Yönetim Sistemi

## 📱 Genel Bakış

BAVAXE, modern bir GPS takip ve işçi yönetim sistemidir. React Native (Expo) ile geliştirilmiş mobil uygulama ve Node.js/Express backend'e sahiptir.

### ✨ Özellikler

- 🔐 **Güvenli Kimlik Doğrulama**: Email/şifre ve Google OAuth
- 📍 **GPS Takip**: Gerçek zamanlı konum izleme
- 👥 **Kullanıcı Yönetimi**: Profil, avatar, şifre değiştirme
- 📧 **İletişim Formu**: Gmail entegrasyonu ile e-posta gönderimi
- 🔔 **Push Bildirimleri**: OneSignal entegrasyonu
- 📊 **İstatistikler**: Kullanıcı aktivite raporları
- 🎨 **Premium UI/UX**: Modern, karanlık tema tasarım

---

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js >= 18.0.0
- npm >= 8.0.0
- Expo CLI
- PM2 (backend için)

### Kurulum

```bash
# Repository'yi klonlayın
git clone <repository-url>
cd my-app

# Bağımlılıkları yükleyin
npm install
cd backend && npm install && cd ..

# Environment dosyalarını yapılandırın
cp backend/.env.example backend/.env
# .env dosyasını düzenleyin

# Backend'i başlatın
npm run start:backend

# Yeni terminalde uygulamayı başlatın
npm start
```

---

## 📁 Proje Yapısı

```
my-app/
├── app/                    # Expo Router sayfaları
│   ├── (tabs)/            # Tab navigasyon sayfaları
│   ├── auth/              # Kimlik doğrulama sayfaları
│   └── contact.tsx        # İletişim formu
├── backend/               # Node.js/Express backend
│   ├── controllers/       # API controller'ları
│   ├── middleware/        # Express middleware
│   ├── routes/            # API rotaları
│   ├── services/          # İş mantığı servisleri
│   └── server.js          # Ana server dosyası
├── components/            # React bileşenleri
│   ├── ui/               # UI bileşenleri
│   └── Toast.tsx         # Bildirim bileşeni
├── hooks/                # Custom React hooks
├── utils/                # Yardımcı fonksiyonlar
└── contexts/             # React Context'ler
```

---

## 🔧 Yapılandırma

### Backend Environment Variables

```env
# Server
PORT=4000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# OneSignal
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_REST_API_KEY=your-api-key
```

### Frontend Environment Variables

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
EXPO_PUBLIC_ONESIGNAL_APP_ID=your-app-id
```

---

## 📜 Kullanılabilir Komutlar

### Geliştirme

```bash
# Uygulamayı başlat
npm start

# Backend'i başlat
npm run start:backend

# Her ikisini birden başlat
npm run start:all

# Backend'i geliştirme modunda başlat
npm run start:dev
```

### Production

```bash
# Backend'i PM2 ile başlat
npm run server:pm2

# Backend'i durdur
npm run server:stop

# Backend'i yeniden başlat
npm run server:restart

# Logları görüntüle
npm run server:logs
```

### Build

```bash
# Android APK
npm run build:android

# Android AAB (Play Store)
npm run build:android:aab

# iOS
npm run build:ios

# Tüm platformlar
npm run build:all
```

---

## 🔐 Güvenlik

### Implemented Security Features

- ✅ JWT token authentication
- ✅ Password hashing (bcryptjs)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Input validation
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Admin authorization middleware

### Best Practices

- Tüm hassas bilgiler environment variables'da
- HTTPS kullanımı (production)
- Secure cookie ayarları
- Regular dependency updates

---

## 📧 Email Yapılandırması

### Gmail App Password Oluşturma

1. Google Account Settings → Security
2. 2-Step Verification'ı aktifleştir
3. App Passwords → Mail → Generate
4. Oluşturulan şifreyi `.env` dosyasına ekle

```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=generated-app-password
```

---

## 🔔 Push Notifications (OneSignal)

### Kurulum

1. [OneSignal](https://onesignal.com) hesabı oluştur
2. Yeni uygulama oluştur
3. App ID ve REST API Key'i al
4. `.env` dosyasına ekle

```env
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_REST_API_KEY=your-rest-api-key
```

---

## 🗄️ Database

### PostgreSQL (Recommended for Production)

```bash
# PostgreSQL bağlantısı
DATABASE_URL=postgresql://user:password@host:5432/database

# Otomatik migration
# Backend başlatıldığında tablolar otomatik oluşturulur
```

### JSON Database (Development)

```bash
# Otomatik olarak data.json dosyası oluşturulur
# Geliştirme için uygundur
```

---

## 📱 Deployment

### Backend (Node.js)

#### Option 1: PM2 (Recommended)

```bash
cd backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### Option 2: Docker

```bash
# Dockerfile oluştur
# docker build -t bavaxe-backend .
# docker run -p 4000:4000 bavaxe-backend
```

### Mobile App

#### Android

```bash
# EAS Build ile
npm run build:android:aab

# Play Store'a yükle
npm run submit:android
```

#### iOS

```bash
# EAS Build ile
npm run build:ios

# App Store'a yükle
npm run submit:ios
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Login/Register flow
- [ ] Google OAuth login
- [ ] Password reset
- [ ] Contact form email delivery
- [ ] Profile management
- [ ] Avatar upload
- [ ] Push notifications
- [ ] GPS tracking
- [ ] Admin features

---

## 📊 Monitoring

### Recommended Tools

- **Backend**: PM2, New Relic, Sentry
- **Database**: PostgreSQL monitoring
- **Logs**: PM2 logs, CloudWatch
- **Uptime**: UptimeRobot, Pingdom

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

MIT License - see LICENSE file for details

---

## 👨‍💻 Author

**Ozcan Akbas**

---

## 🆘 Support

For issues and questions:
- Email: support@bavaxe.com
- GitHub Issues: [Create Issue](https://github.com/...)

---

## 🎉 Acknowledgments

- Expo team for amazing framework
- OneSignal for push notifications
- All open-source contributors

---

**Version**: 1.0.0  
**Last Updated**: December 2024