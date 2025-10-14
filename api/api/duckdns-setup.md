# 🦆 DuckDNS - Hızlı Kurulum

## Adım 1: DuckDNS Hesabı
1. https://duckdns.org → "Sign in with Google"
2. Google hesabınızla giriş yapın
3. Subdomain seçin: `isci-takip`
4. Domain: `isci-takip.duckdns.org`

## Adım 2: DuckDNS Updater Kur
1. https://www.duckdns.org/install.jsp
2. "Windows" seçin
3. DuckDNS updater indirin
4. Kurun ve çalıştırın

## Adım 3: API URL Güncelle
```javascript
// utils/api.ts
return 'http://isci-takip.duckdns.org:4000';
```

## Sonuç
✅ **Ücretsiz domain:** http://isci-takip.duckdns.org:4000
✅ **Google ile giriş**
✅ **Kolay kurulum**
