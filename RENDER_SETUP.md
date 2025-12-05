# 🚀 Render.com Deployment Rehberi

## ❌ Hata: "You must specify a workspaceId to create a project"

Bu hata, Render'da workspace seçimi yapılmadığında oluşur.

## ✅ Çözüm Adımları

### 1. Workspace Oluştur (İlk Kez Kullanıyorsan)

1. Render.com → Giriş yap
2. Sol menüde **"Workspaces"** veya **"Teams"** sekmesine git
3. **"New Workspace"** veya **"Create Workspace"** butonuna tıkla
4. Workspace adı: `Personal` veya `My Projects` (istediğin isim)
5. **"Create Workspace"** tıkla

### 2. Workspace Seç

1. Render dashboard'a git
2. Sol üstte **workspace dropdown**'ı gör (muhtemelen "Personal" yazıyor)
3. Workspace'i seç (eğer birden fazla varsa)

### 3. Web Service Oluştur

1. Render dashboard'da **"New +"** butonuna tıkla
2. **"Web Service"** seç
3. GitHub repository'ni bağla:
   - **"Connect GitHub"** tıkla (ilk kez ise)
   - Repository'ni seç: `akbasozcan3/isci-takip-app`
   - **"Connect"** tıkla

### 4. Service Ayarları

**Name:**
```
bavaxe-backend
```

**Region:**
```
Frankfurt (EU) veya Oregon (US)
```

**Branch:**
```
main
```

**Root Directory:**
```
backend
```

**Runtime:**
```
Node
```

**Build Command:**
```
npm install
```

**Start Command:**
```
npm start
```

**Instance Type:**
```
Free (ücretsiz) veya Starter ($7/ay)
```

### 5. Environment Variables Ekle

**"Environment"** sekmesine git ve şunları ekle:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ALLOWED_ORIGINS=https://yourdomain.com,exp://your-app-url
EMAIL_SERVICE_URL=http://localhost:5001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
APP_SCHEME=iscitakip
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://bavaxe-backend.onrender.com
EXPO_PUBLIC_API_BASE_URL=https://bavaxe-backend.onrender.com
ONESIGNAL_APP_ID=4a846145-621c-4a0d-a29f-0598da946c50
ONESIGNAL_REST_API_KEY=YOUR_ONESIGNAL_REST_API_KEY
```

### 6. Deploy!

**"Create Web Service"** butonuna tıkla.

---

## 🎯 Alternatif: Railway.app (Daha Kolay)

Render'da sorun yaşıyorsan, **Railway.app** daha kolay:

1. https://railway.app → GitHub ile giriş
2. **"New Project"** → **"Deploy from GitHub repo"**
3. Repository'ni seç: `akbasozcan3/isci-takip-app`
4. Root Directory: `backend` seç
5. Environment variables ekle
6. Deploy!

**Railway avantajları:**
- ✅ Workspace sorunu yok
- ✅ Daha kolay kurulum
- ✅ Otomatik SSL
- ✅ İlk ay $5 ücretsiz kredi

---

## 📋 Render vs Railway Karşılaştırma

| Özellik | Render | Railway |
|---------|--------|---------|
| Workspace gerekli | ✅ Evet | ❌ Hayır |
| Ücretsiz tier | ✅ Var (sınırlı) | ✅ $5 kredi/ay |
| Kurulum zorluğu | ⚠️ Orta | ✅ Kolay |
| SSL | ✅ Otomatik | ✅ Otomatik |
| GitHub entegrasyonu | ✅ Var | ✅ Var |

---

## 💡 İpucu

Eğer Render'da workspace sorunu devam ediyorsa:

1. **Farklı tarayıcı dene** (Chrome, Firefox, Edge)
2. **Cookies'i temizle** ve tekrar dene
3. **Incognito/Private mode** dene
4. **Railway.app kullan** (daha kolay)

---

## ✅ Başarılı Deployment Sonrası

1. Render dashboard'da service'in **"Live"** olduğunu gör
2. URL'i kopyala: `https://bavaxe-backend.onrender.com`
3. Health check: `https://bavaxe-backend.onrender.com/api/health`
4. Mobil app'te API URL'i güncelle

---

## 🎉 Tamamlandı!

Backend artık canlıda! 🚀
