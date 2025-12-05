# OneSignal Bildirim Testi

## API Key Oluşturma

1. OneSignal Dashboard'a gidin: https://dashboard.onesignal.com
2. **Ayarlar > Anahtarlar ve Kimlikler** bölümüne gidin
3. **"+ Anahtar Ekle"** butonuna tıklayın
4. İsim verin (örn: "Mobile-Onesignal")
5. **"Create"** butonuna tıklayın
6. Oluşturulan API key'i kopyalayın

## API Key'i .env Dosyasına Ekleme

`backend/.env` dosyasını açın ve şu satırı ekleyin/güncelleyin:

```
ONESIGNAL_REST_API_KEY=your_api_key_here
```

## Test Script'lerini Çalıştırma

### Basit Test
```bash
cd backend
npm run test:onesignal
```

veya

```bash
node test-onesignal.js
```

### Grup Bildirimi Testi (2 bildirim)
```bash
npm run test:group-notification
```

veya

```bash
node test-group-notification.js
```

## Beklenen Sonuç

Script başarılı çalışırsa:
- ✅ Bildirim gönderildi mesajı görürsünüz
- 📱 Uygulamada push bildirimi gelir
- 🔗 OneSignal dashboard'da bildirim görünür

## Sorun Giderme

### API Key Bulunamadı
- `.env` dosyasında `ONESIGNAL_REST_API_KEY` olduğundan emin olun
- API key'in başında/sonunda boşluk olmamalı

### Bildirim Gelmiyor
- Uygulamanın OneSignal SDK'sı kurulu ve çalışıyor olmalı
- Uygulama açık olmalı veya arka planda çalışıyor olmalı
- OneSignal dashboard'da "Subscribed Users" kontrol edin
