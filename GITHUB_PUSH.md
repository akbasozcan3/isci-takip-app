# 🚀 GitHub'a Push Etme Rehberi

## ✅ Git Repository Hazır!

Proje başarıyla commit edildi. Şimdi GitHub'a push et:

---

## 📋 Adımlar

### 1. GitHub'da Repository Oluştur

1. https://github.com adresine git
2. Sağ üstte "+" → "New repository"
3. Repository adı: `bavaxe-gps-tracking` (veya istediğin isim)
4. **Public** veya **Private** seç
5. **"Initialize with README" seçme!** (zaten dosyalar var)
6. "Create repository" tıkla

---

### 2. GitHub Repository URL'ini Kopyala

Repository oluşturulduktan sonra şu URL'i görürsün:
```
https://github.com/kullanici-adi/repo-adi.git
```

Bu URL'i kopyala!

---

### 3. Terminal'de Push Et

Proje klasöründe şu komutları çalıştır:

```bash
# Remote repository ekle (URL'i kendi repo URL'inle değiştir)
git remote add origin https://github.com/kullanici-adi/repo-adi.git

# Branch'i main olarak ayarla
git branch -M main

# GitHub'a push et
git push -u origin main
```

---

### 4. GitHub Credentials

İlk kez push ediyorsan GitHub kullanıcı adı ve şifre isteyebilir.

**Eğer 2FA (Two-Factor Authentication) aktifse:**
- Şifre yerine **Personal Access Token** kullan
- Token oluştur: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
- Permissions: `repo` seç
- Token'ı şifre yerine kullan

---

## 🔐 Alternatif: SSH ile Push

SSH key kullanmak istersen:

### 1. SSH Key Oluştur (yoksa)
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

### 2. SSH Key'i GitHub'a Ekle
1. GitHub → Settings → SSH and GPG keys
2. "New SSH key"
3. Public key'i ekle (`~/.ssh/id_ed25519.pub`)

### 3. Remote URL'i SSH ile Değiştir
```bash
git remote set-url origin git@github.com:kullanici-adi/repo-adi.git
git push -u origin main
```

---

## ✅ Kontrol Et

Push başarılı olduysa:
1. GitHub repository sayfasına git
2. Tüm dosyaların göründüğünü kontrol et
3. Commit geçmişini kontrol et

---

## 🎯 Sonraki Adımlar

GitHub'a push ettikten sonra:

1. **Railway.app'e deploy et:**
   - Railway → New Project → Deploy from GitHub
   - Repository'yi seç
   - Backend klasörünü deploy et

2. **Mobil app'te API URL'i güncelle:**
   - `app.json` → `extra.apiBase` → Backend URL'i ekle

---

## 📝 Notlar

- `.env` dosyaları `.gitignore`'da (güvenlik için)
- `node_modules` push edilmedi (çok büyük)
- Backend `data.json` push edilmedi (production'da oluşturulacak)

---

## 🆘 Sorun Giderme

### "Repository not found" hatası?
- Repository URL'ini kontrol et
- GitHub'da repository'nin var olduğundan emin ol

### "Authentication failed" hatası?
- Personal Access Token kullan
- SSH key kullan

### "Large files" hatası?
- Git LFS kullan veya büyük dosyaları `.gitignore`'a ekle

