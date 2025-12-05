# 🚀 GitHub'a Push Etme

## ✅ Hazırlık Tamamlandı!

Repository bağlandı: `https://github.com/akbasozcan3/isci-takip-app`

## 📝 Push Komutu

Terminal'de şu komutu çalıştır:

```powershell
cd c:\Users\ozcan\my-app
git push -u origin main
```

## 🔐 Authentication

Push sırasında GitHub kullanıcı adı ve şifre istenecek.

### Personal Access Token Kullan (Önerilen)

1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. "Generate new token (classic)"
4. Note: "isci-takip-app"
5. Scopes: `repo` işaretle
6. "Generate token" → Token'ı kopyala
7. Push yaparken:
   - Username: `akbasozcan3`
   - Password: Token'ı yapıştır

## ✅ Başarı Kontrolü

Push başarılı olduktan sonra:
- https://github.com/akbasozcan3/isci-takip-app sayfasına git
- Tüm dosyaların göründüğünü kontrol et
- Commit geçmişini kontrol et

## 🎯 Sonraki Adım: Railway Deploy

GitHub'a push ettikten sonra:

1. Railway.app → "New Project"
2. "Deploy from GitHub repo"
3. `akbasozcan3/isci-takip-app` repository'sini seç
4. Root Directory: `backend` seç
5. Environment variables ekle
6. Deploy!

---

## 💡 Hızlı Push (GitHub CLI ile)

Eğer GitHub CLI kuruluysa:

```powershell
gh auth login
git push -u origin main
```
