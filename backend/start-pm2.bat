@echo off
echo ========================================
echo   NEXORA Backend - PM2 Başlatılıyor
echo ========================================
echo.

REM PM2 kontrolü
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] PM2 bulunamadı!
    echo PM2 kurulumu: npm install -g pm2
    pause
    exit /b 1
)

echo [1/3] PM2 durumu kontrol ediliyor...
pm2 status

echo.
echo [2/3] Mevcut process'ler durduruluyor...
pm2 delete ecosystem.config.js 2>nul

echo.
echo [3/3] Backend servisleri başlatılıyor...
cd /d %~dp0
pm2 start ecosystem.config.js

echo.
echo ========================================
echo   ✅ Backend PM2 ile başlatıldı!
echo ========================================
echo.
echo Komutlar:
echo   pm2 status       - Durum kontrolü
echo   pm2 logs         - Logları görüntüle
echo   pm2 monit        - Canlı monitör
echo   pm2 restart all  - Tümünü yeniden başlat
echo   pm2 stop all     - Tümünü durdur
echo   pm2 delete all   - Tümünü sil
echo.
pause

