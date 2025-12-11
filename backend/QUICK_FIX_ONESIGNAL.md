# 🚨 OneSignal API Key Hızlı Çözüm

## Sorun
OneSignal API key 403 hatası veriyor - "Access denied"

## Hızlı Çözüm (5 Dakika)

### 1. OneSignal Dashboard'a Gidin
- https://onesignal.com → Login
- App'inizi seçin (App ID: `4a846145-621c-4a0d-a29f-0598da946c50`)

### 2. Yeni REST API Key Oluşturun
- **Settings** → **Keys & IDs**
- **REST API Key** bölümünde **"Regenerate"** veya **"Create New"** tıklayın
- ⚠️ **ÖNEMLİ**: Eski key'i not alın (gerekirse), sonra silebilirsiniz

### 3. Yeni Key'i Kopyalayın
- Yeni oluşturulan key'in yanındaki **"Copy"** butonuna tıklayın
- Key'in **TAMAMINI** kopyalayın (100+ karakter olmalı)
- Key `os_v2_app_` ile başlamalı

### 4. .env Dosyasını Güncelleyin
- `backend/.env` dosyasını açın
- Şu satırı bulun:
  ```env
  ONESIGNAL_REST_API_KEY=eski_key_burada
  ```
- Yeni key ile değiştirin:
  ```env
  ONESIGNAL_REST_API_KEY=yeni_kopyaladiginiz_key_buraya
  ```
- ⚠️ **ÖNEMLİ**:
  - ❌ Tırnak işareti kullanmayın
  - ❌ Başta/sonda boşluk bırakmayın
  - ✅ Key'i olduğu gibi yapıştırın

### 5. Doğrulayın
```bash
cd backend
npm run verify-onesignal
```

Başarılı çıktı:
```
✅ SUCCESS: API Key is valid!
✅ OneSignal service should work correctly.
```

### 6. Backend'i Yeniden Başlatın
```bash
# Backend'i durdurun (Ctrl+C)
npm start
```

## Kontrol Listesi

- [ ] OneSignal dashboard'da yeni key oluşturuldu
- [ ] Key tam olarak kopyalandı (100+ karakter)
- [ ] `.env` dosyasına tırnak olmadan eklendi
- [ ] `npm run verify-onesignal` başarılı
- [ ] Backend yeniden başlatıldı
- [ ] Terminal'de "✅ API Key validation successful" mesajı görünüyor

## Hala Çalışmıyorsa

1. **Key Formatını Kontrol Edin:**
   ```bash
   npm run verify-onesignal
   ```
   Bu script key'in formatını ve geçerliliğini kontrol eder.

2. **App ID'yi Kontrol Edin:**
   - OneSignal dashboard'daki App ID ile `.env` dosyasındaki `ONESIGNAL_APP_ID` aynı olmalı
   - Şu anki App ID: `4a846145-621c-4a0d-a29f-0598da946c50`

3. **OneSignal Dashboard'da Key Durumunu Kontrol Edin:**
   - Key'in "Active" durumunda olduğundan emin olun
   - Key'in süresi dolmamış olmalı

4. **Yeni Bir App Oluşturun (Son Çare):**
   - OneSignal'da yeni bir app oluşturun
   - Yeni App ID ve REST API Key alın
   - `.env` dosyasını güncelleyin

## Yardım

Daha fazla bilgi için: `backend/ONESIGNAL_SETUP.md`

