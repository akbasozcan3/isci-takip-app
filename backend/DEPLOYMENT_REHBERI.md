# 🚀 İşçi Takip - Deployment Rehberi

## 📋 Gereksinimler

- Node.js 18+
- Expo CLI
- EAS CLI
- Git
- Railway/Render hesabı

## 🔧 Backend Deploy (Railway)

### 1. Railway Hesabı
```bash
# Railway CLI kur
npm install -g @railway/cli

# Giriş yap
railway login
```

### 2. Backend Deploy
```bash
cd backend/
railway init
railway up
```

### 3. Environment Variables
Railway dashboard'da:
- `NODE_ENV=production`
- `PORT` (otomatik)

## 📱 Mobile App Build

### 1. EAS CLI Kurulum
```bash
npm install -g @expo/eas-cli
eas login
```

### 2. Android Build
```bash
# Development build
eas build --platform android --profile development

# Production build (APK)
eas build --platform android --profile production-apk

# Production build (AAB - Play Store)
eas build --platform android --profile production
```

### 3. iOS Build
```bash
# Development build
eas build --platform ios --profile development

# Production build
eas build --platform ios --profile production
```

## 🔄 Update Workflow

### Backend Güncelleme:
```bash
cd backend/
git add .
git commit -m "Update: açıklama"
git push origin main
# Railway otomatik deploy eder
```

### Mobile App Güncelleme:
```bash
# OTA Update (küçük değişiklikler)
eas update --branch production

# Yeni Build (büyük değişiklikler)
npm run build:android
npm run build:ios
```

## 📊 Monitoring

### Backend Health Check:
- URL: `https://your-app.railway.app/health`
- Response: `{"ok": true, "timestamp": 1234567890, "env": "production"}`

### Mobile App Analytics:
- Expo Analytics dashboard
- Crash reports
- Performance metrics

## 🔐 Environment Management

### Development:
```json
{
  "apiBase": "http://192.168.0.173:4000"
}
```

### Production:
```json
{
  "apiBase": "https://your-app.railway.app"
}
```

## 📦 Build Profiles (eas.json)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "android": {
        "gradleCommand": ":app:bundleRelease -x lint"
      }
    },
    "production-apk": {
      "extends": "production",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

## 🚀 Hızlı Deploy Komutları

```bash
# Backend deploy
cd backend && railway up

# Android APK build
npm run build:android

# iOS build
npm run build:ios

# Her iki platform
npm run build:all

# OTA update
eas update --branch production
```

## 🆘 Troubleshooting

### Backend Deploy Sorunları:
- Port conflict → Railway otomatik çözer
- Dependencies → `npm install` kontrol et
- Environment vars → Railway dashboard kontrol et

### Mobile Build Sorunları:
- Keystore → EAS otomatik yönetir
- Dependencies → `npm install` yap
- Cache → `expo r -c` ile temizle

## 📈 Production Checklist

### Backend:
- ✅ Environment variables set
- ✅ Health check endpoint
- ✅ CORS configured
- ✅ Error handling
- ✅ Logging enabled

### Mobile:
- ✅ Production API URL
- ✅ App icons set
- ✅ Splash screen configured
- ✅ Permissions configured
- ✅ Build profiles ready

## 🔄 CI/CD (Opsiyonel)

### GitHub Actions:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: railway up
  build-mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: eas build --platform all --non-interactive
```

---

**🎯 Bu rehberle uygulamanız production'a hazır!**
