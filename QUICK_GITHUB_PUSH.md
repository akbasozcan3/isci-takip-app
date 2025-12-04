# 🚀 GitHub'a Push - Hızlı Komutlar

## ✅ Git Hazır!

Proje commit edildi. Şimdi GitHub'a push et:

---

## 📋 Hızlı Adımlar

### 1. GitHub'da Repository Oluştur
1. https://github.com → "+" → "New repository"
2. İsim: `bavaxe-gps-tracking`
3. **"Initialize with README" SEÇME!**
4. "Create repository"

### 2. Push Et

PowerShell'de şu komutları çalıştır:

```powershell
# Remote ekle (URL'i kendi repo URL'inle değiştir)
git remote add origin https://github.com/KULLANICI-ADI/REPO-ADI.git

# Push et
git push -u origin main
```

---

## 🔐 GitHub Credentials

İlk kez push ediyorsan:
- **Kullanıcı adı:** GitHub kullanıcı adın
- **Şifre:** GitHub şifren (2FA varsa Personal Access Token)

**Personal Access Token oluştur:**
1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token
4. Permissions: `repo` seç
5. Token'ı şifre yerine kullan

---

## ✅ Başarılı!

Push başarılı olduysa GitHub'da tüm dosyaları göreceksin.

---

## 🎯 Sonraki Adım: Railway'a Deploy

1. Railway.app → New Project → Deploy from GitHub
2. Repository'yi seç
3. Backend deploy et
4. Environment variables ekle

Detaylar: `backend/README_DEPLOY.md`

