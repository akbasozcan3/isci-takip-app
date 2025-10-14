# 🚀 Railway.app - Ücretsiz Backend Hosting

## 1. 🎯 Railway Hesabı Oluştur

### Adım 1: GitHub'a Kod Yükle
```bash
# Terminal'de:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/yourrepo.git
git push -u origin main
```

### Adım 2: Railway'a Bağla
1. https://railway.app → "Sign up"
2. **"Login with GitHub"** tıklayın
3. GitHub hesabınızla giriş yapın

### Adım 3: Proje Deploy Et
1. **"New Project"** tıklayın
2. **"Deploy from GitHub repo"** seçin
3. **Repository'nizi** seçin
4. **Otomatik deploy** başlar

## 2. ⚙️ Railway Ayarları

### Environment Variables:
```
NODE_ENV=production
PORT=4000
```

### Build Settings:
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Root Directory:** `api`

## 3. 🌐 Domain Ayarları

### Railway Domain:
- **Otomatik domain:** `yourapp.railway.app`
- **Custom domain:** `yourapp.com` (opsiyonel)

### DuckDNS ile Bağla:
1. **Railway domain'i** alın
2. **DuckDNS'de** IP güncelle
3. **Custom domain** ekle

## 4. 📱 Mobile App Bağlantısı

### API URL Güncelle:
```javascript
// utils/api.ts
return 'https://yourapp.railway.app';
```

## 5. ✅ Sonuç

**Tamamen ücretsiz backend:**
- ✅ **Domain:** `https://yourapp.railway.app`
- ✅ **HTTPS otomatik**
- ✅ **Otomatik deploy**
- ✅ **7/24 çalışır**
- ✅ **Sıfır maliyet**

## 6. 💼 Müşteri İçin

### Profesyonel Özellikler:
- ✅ **Güvenilir hosting**
- ✅ **Otomatik backup**
- ✅ **SSL sertifikası**
- ✅ **Monitoring**
- ✅ **Scalability**
