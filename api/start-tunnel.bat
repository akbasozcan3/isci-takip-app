@echo off
echo Starting Cloudflare Tunnel for İşçi Takip API...
echo.

REM Cloudflare Tunnel başlat
REM Önce cloudflared kurulumu gerekli: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

echo 1. Cloudflare Tunnel kurulumu için:
echo    https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
echo.
echo 2. Tunnel oluştur:
echo    cloudflared tunnel login
echo    cloudflared tunnel create isci-takip
echo    cloudflared tunnel route dns isci-takip isci-takip.trycloudflare.com
echo.
echo 3. Tunnel başlat:
echo    cloudflared tunnel run isci-takip
echo.

REM PM2 ile API'yi başlat
echo Starting API with PM2...
pm2 start server.js --name "isci-takip-api"
pm2 status

echo.
echo API is running on: http://localhost:4000
echo Health check: http://localhost:4000/health
echo.
pause
