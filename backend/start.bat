@echo off
if not "%1"=="silent" (
    title Backend Başlatılıyor...
    echo ========================================
    echo   Backend PM2 ile Başlatılıyor
    echo ========================================
    echo.
)

cd /d %~dp0

echo [1/2] PM2 durumu kontrol ediliyor...
pm2 describe isci-takip-api >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [BILGI] Servisler zaten çalışıyor!
    pm2 status
    echo.
    echo Servisleri yeniden başlatmak için:
    echo   npm run restart
    echo.
    timeout /t 3 >nul
    exit /b 0
)

if not "%1"=="silent" (
    echo [2/2] Backend servisleri başlatılıyor...
)
call npm start >nul 2>&1

if not "%1"=="silent" (
    echo.
    echo ========================================
    echo   ✅ Backend başlatıldı!
    echo ========================================
    echo.
    pm2 status
    echo.
    echo Komutlar:
    echo   npm run status    - Durum kontrolü
    echo   npm run logs      - Logları görüntüle
    echo   npm run stop      - Durdur
    echo   npm run restart   - Yeniden başlat
    echo.
    timeout /t 2 >nul
)

