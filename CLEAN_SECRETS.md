# 🔐 GitHub Secret Temizleme

GitHub eski commit'lerde secret'lar buldu. İki seçenek:

## Seçenek 1: GitHub'da Allow Et (Hızlı)

GitHub'ın verdiği URL'lerden secret'ları allow et:
1. https://github.com/akbasozcan3/isci-takip-app/security/secret-scanning/unblock-secret/36O31nmbGvQbuoCCP3OwumJic2g
2. https://github.com/akbasozcan3/isci-takip-app/security/secret-scanning/unblock-secret/36O31mycoFwjEcLjf2mCrBRN3hz
3. https://github.com/akbasozcan3/isci-takip-app/security/secret-scanning/unblock-secret/36O31kxzBoJvyvOrzxW5QtEzysg
4. https://github.com/akbasozcan3/isci-takip-app/security/secret-scanning/unblock-secret/36O31kTmpWm3QZDKOssCuAdNdT1
5. https://github.com/akbasozcan3/isci-takip-app/security/secret-scanning/unblock-secret/36O31kzaESUJXy7nrScegi8OkGg

Her URL'de "Allow secret" tıkla, sonra tekrar push et.

---

## Seçenek 2: Git History Temizle (Önerilen)

Eski commit'lerdeki secret'ları tamamen kaldır:

```powershell
# BFG Repo-Cleaner kullan (daha güvenli)
# veya git filter-branch kullan

# Basit yol: Yeni branch oluştur
git checkout --orphan clean-main
git add .
git commit -m "Initial commit: Clean version without secrets"
git branch -D main
git branch -m main
git push -f origin main
```

⚠️ **DİKKAT:** Bu işlem git history'yi silecek!

---

## Seçenek 3: Yeni Repository (En Kolay)

1. GitHub'da yeni repository oluştur
2. Bu komutları çalıştır:

```powershell
git remote remove origin
git remote add origin https://github.com/KULLANICI-ADI/YENI-REPO.git
git push -u origin main
```

---

## ✅ Önerilen: Seçenek 1 (Allow Et)

En hızlı ve kolay yol. GitHub'da secret'ları allow et, sonra push et.

