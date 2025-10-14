@echo off
echo 🚀 Cloudflare Tunnel - En Kolay Yöntem
echo.

echo 1. Cloudflare Tunnel indir:
echo    https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
echo    Windows -> cloudflared-windows-amd64.exe
echo    C:\cloudflared\ klasörüne koy
echo.

echo 2. Tunnel oluştur (Admin Terminal):
echo    cd C:\cloudflared
echo    cloudflared.exe tunnel login
echo    cloudflared.exe tunnel create isci-takip
echo    cloudflared.exe tunnel route dns isci-takip isci-takip.trycloudflare.com
echo.

echo 3. API'yi başlat:
pm2 start api/server.js --name "isci-takip-api"
pm2 status

echo.
echo 4. Tunnel başlat:
echo    cloudflared.exe tunnel run isci-takip
echo.

echo ✅ Sonuç: https://isci-takip.trycloudflare.com
echo ✅ Router ayarı gerekmez!
echo ✅ HTTPS otomatik!
echo.
pause
