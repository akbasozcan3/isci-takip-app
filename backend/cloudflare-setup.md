# 🚀 Cloudflare Tunnel - Hızlı Kurulum

## Adım 1: Cloudflare Tunnel İndir
1. https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Windows için: "Windows" seçin
3. "cloudflared-windows-amd64.exe" indirin
4. C:\cloudflared\ klasörüne koyun

## Adım 2: Tunnel Oluştur
```bash
# Terminal'de (Admin olarak):
cd C:\cloudflared
cloudflared.exe tunnel login
cloudflared.exe tunnel create isci-takip
cloudflared.exe tunnel route dns isci-takip isci-takip.trycloudflare.com
```

## Adım 3: Tunnel Başlat
```bash
cloudflared.exe tunnel run isci-takip
```

## Sonuç
✅ **Ücretsiz domain:** https://isci-takip.trycloudflare.com
✅ **HTTPS otomatik**
✅ **No-IP gerekmez**
✅ **Router ayarı gerekmez**
