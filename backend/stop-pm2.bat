@echo off
echo ========================================
echo   NEXORA Backend - PM2 Durduruluyor
echo ========================================
echo.

cd /d %~dp0
pm2 stop ecosystem.config.js

echo.
echo ✅ Backend servisleri durduruldu!
echo.
pause

