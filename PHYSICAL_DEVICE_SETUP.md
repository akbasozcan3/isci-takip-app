# 📱 Fiziksel Cihaz İçin Backend Bağlantısı

## 🔍 Sorun
Fiziksel cihazda (gerçek telefon) uygulama backend'e bağlanamıyor ve "İnternet Bağlantısı Gerekli" hatası gösteriyor.

## ✅ Çözüm

### 1. Bilgisayarınızın IP Adresini Bulun

**Windows:**
```powershell
ipconfig
```
`IPv4 Address` değerini bulun (örn: `192.168.1.102`)

**Mac/Linux:**
```bash
ifconfig
# veya
ip addr
```

### 2. Backend'i Başlatın
```bash
cd backend
npm start
```

Backend `0.0.0.0:4000` adresinde dinliyor olmalı (zaten öyle yapılandırılmış).

### 3. Firewall'ı Kontrol Edin
Windows Firewall'ın port 4000'i engellemediğinden emin olun:

**Windows:**
1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → 4000 → Allow

### 4. IP Adresini Güncelleyin

IP adresiniz değiştiyse şu dosyaları güncelleyin:

**`app.json`:**
```json
"extra": {
  "apiBase": "http://192.168.1.102:4000",
  "apiBaseDev": "http://192.168.1.102:4000",
  "apiBaseIOS": "http://192.168.1.102:4000"
}
```

**`.env` dosyası (opsiyonel):**
```env
EXPO_PUBLIC_DEVICE_IP=192.168.1.102
```

### 5. Aynı Wi-Fi Ağında Olduğunuzdan Emin Olun
- Bilgisayar ve telefon aynı Wi-Fi ağında olmalı
- Farklı ağlardaysa bağlantı çalışmaz

### 6. Uygulamayı Yeniden Başlatın
```bash
# Expo development server'ı yeniden başlatın
npx expo start --clear
```

## 🔧 Otomatik IP Tespiti (Gelecek Güncelleme)

Gelecekte otomatik IP tespiti eklenebilir, şimdilik manuel güncelleme gerekiyor.

## 📋 Test

1. Backend çalışıyor mu?
   ```bash
   curl http://192.168.1.102:4000/api/health
   ```

2. Telefondan test edin:
   - Telefonunuzun tarayıcısından: `http://192.168.1.102:4000/api/health`
   - Başarılı yanıt almalısınız

3. Uygulamayı açın ve bağlantı hatası gitmeli

## ⚠️ Önemli Notlar

- **Emulator için:** `10.0.2.2:4000` kullanılır (otomatik)
- **Fiziksel cihaz için:** Gerçek IP adresi gerekir (örn: `192.168.1.102:4000`)
- **Production için:** Railway URL kullanılır (otomatik)

## 🆘 Hala Çalışmıyorsa

1. Backend loglarını kontrol edin
2. Firewall ayarlarını kontrol edin
3. Wi-Fi ağını kontrol edin (aynı ağda mı?)
4. IP adresinin doğru olduğundan emin olun
5. Backend'in `0.0.0.0:4000` adresinde dinlediğinden emin olun

