# OneSignal Push Notification Setup

## 🔔 OneSignal API Key Yapılandırması

OneSignal push notification servisini kullanmak için API key'inizi yapılandırmanız gerekiyor.

### Adımlar:

1. **OneSignal Dashboard'a gidin**
   - https://onesignal.com adresine giriş yapın
   - Projenizi seçin veya yeni bir app oluşturun

2. **API Key'i bulun**
   - Settings → Keys & IDs bölümüne gidin
   - "REST API Key" bölümünü bulun
   - Key'in `os_v2_app_` ile başladığından emin olun

3. **API Key'i kopyalayın**
   - Key'in yanındaki kopyala butonuna tıklayın
   - **ÖNEMLİ**: Key'i tam olarak kopyalayın (tüm karakterler)

4. **.env dosyasına ekleyin**
   - `backend/.env` dosyasını açın
   - Şu satırı bulun veya ekleyin:
   ```env
   ONESIGNAL_REST_API_KEY=your_api_key_here
   ```
   - `your_api_key_here` yerine kopyaladığınız key'i yapıştırın

5. **Önemli Notlar:**
   - ❌ Key'in etrafında **TIRNAK İŞARETİ** kullanmayın
   - ❌ Key'in önünde veya arkasında **BOŞLUK** bırakmayın
   - ✅ Key'i olduğu gibi yapıştırın
   - ✅ Örnek: `ONESIGNAL_REST_API_KEY=os_v2_app_abc123...xyz789`

6. **Backend'i yeniden başlatın**
   ```bash
   cd backend
   npm start
   ```

### Doğrulama:

Backend başladığında şu mesajları görmelisiniz:
```
[OneSignalService] ✅ Initialized with App ID: 4a846145-621c-4a0d-a29f-0598da946c50
[OneSignalService] ✅ API Key configured: os_v2_app_...
[OneSignalService] ✅ Service enabled: true
[OneSignalService] ✅ API Key validation successful
```

### Sorun Giderme:

**403 Forbidden Hatası:**
- API key'in doğru kopyalandığından emin olun
- .env dosyasında tırnak işareti olmadığından emin olun
- Backend'i yeniden başlatın
- OneSignal dashboard'da key'in aktif olduğunu kontrol edin

**API Key Bulunamadı:**
- .env dosyasının `backend/` klasöründe olduğundan emin olun
- Dosya adının `.env` olduğundan emin (`.env.example` değil)
- Environment variable adının `ONESIGNAL_REST_API_KEY` olduğundan emin

### Test:

**Option 1: Verification Script (Recommended)**
```bash
cd backend
npm run verify-onesignal
```

Bu script:
- API key'in formatını kontrol eder
- Key formatını test eder
- Basic Auth formatını test eder
- Detaylı hata mesajları verir

**Option 2: API Endpoint**
```bash
curl http://localhost:4000/api/notifications/onesignal-status
```

Başarılı yanıt:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "appId": "4a846145-621c-4a0d-a29f-0598da946c50",
    "apiKeyConfigured": true
  }
}
```

### API Key Sorun Giderme:

**403 Forbidden Hatası:**
1. OneSignal dashboard'dan yeni bir REST API Key oluşturun
2. Eski key'i silin (güvenlik için)
3. Yeni key'i `.env` dosyasına ekleyin
4. Backend'i yeniden başlatın
5. `npm run verify-onesignal` ile test edin

**Key Eksik Görünüyorsa:**
- Key'in tamamını kopyaladığınızdan emin olun
- Key genellikle 100+ karakter uzunluğundadır
- Key'in başında `os_v2_app_` olmalı
- Key'in sonunda karakter eksik olmamalı

