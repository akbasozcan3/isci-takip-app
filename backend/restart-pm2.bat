@echo off
echo ========================================
echo   NEXORA Backend - PM2 Yeniden Başlatılıyor
echo ========================================
echo.

cd /d %~dp0
pm2 restart ecosystem.config.js

echo.
echo ✅ Backend servisleri yeniden başlatıldı!
echo.
pause

