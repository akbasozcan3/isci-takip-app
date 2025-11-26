# 🚀 Render.com - Alternatif Ücretsiz Hosting

## 1. 🎯 Render Hesabı Oluştur

### Adım 1: Giriş Yap
1. https://render.com → "Sign up"
2. **"Login with GitHub"** tıklayın
3. GitHub hesabınızla giriş yapın

### Adım 2: Proje Deploy Et
1. **"New +"** tıklayın
2. **"Web Service"** seçin
3. **"Build and deploy from a Git repository"** seçin
4. **"Connect account"** → GitHub'ı bağlayın
5. **"isci-takip-paneli"** repository'sini seçin

## 2. ⚙️ Render Ayarları

### Build Settings:
```
Build Command: cd api && npm install
Start Command: cd api && npm start
Environment: Node
```

### Environment Variables:
```
NODE_ENV=production
PORT=10000
```

## 3. 🌐 Domain Ayarları

### Render Domain:
- **Otomatik domain:** `isci-takip-paneli.onrender.com`
- **Custom domain:** `isci-takip.com` (opsiyonel)

## 4. 📱 Mobile App Bağlantısı

### API URL Güncelle:
```javascript
// utils/api.ts
return 'https://isci-takip-paneli.onrender.com';
```

## 5. ✅ Sonuç

**Tamamen ücretsiz backend:**
- ✅ **Domain:** `https://isci-takip-paneli.onrender.com`
- ✅ **HTTPS otomatik**
- ✅ **Otomatik deploy**
- ✅ **7/24 çalışır**
- ✅ **Sıfır maliyet**

## 6. 💼 Müşteri İçin

### Avantajlar:
- ✅ **Güvenilir hosting**
- ✅ **Otomatik backup**
- ✅ **SSL sertifikası**
- ✅ **Monitoring**
- ✅ **Scalability**
