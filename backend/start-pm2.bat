@echo off
if not "%1"=="silent" (
    echo ========================================
    echo   NEXORA Backend - PM2 Başlatılıyor
    echo ========================================
    echo.
)

REM PM2 kontrolü
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if not "%1"=="silent" (
        echo [HATA] PM2 bulunamadı!
        echo PM2 kurulumu: npm install -g pm2
        timeout /t 5 >nul
    )
    exit /b 1
)

if not "%1"=="silent" (
    echo [1/3] PM2 durumu kontrol ediliyor...
    pm2 status
    echo.
    echo [2/3] Mevcut process'ler durduruluyor...
)

pm2 delete ecosystem.config.js >nul 2>&1

if not "%1"=="silent" (
    echo.
    echo [2.5/3] Backend hazırlık kontrolü...
)
if not exist "data.json" (
    if not "%1"=="silent" (
        echo [UYARI] data.json bulunamadı, oluşturuluyor...
    )
    call npm run init >nul 2>&1
)

if not "%1"=="silent" (
    echo [3/3] Backend servisleri başlatılıyor...
)
cd /d %~dp0
if "%NODE_ENV%"=="production" (
    pm2 start ecosystem.config.js --env production >nul 2>&1
) else (
    pm2 start ecosystem.config.js --env development >nul 2>&1
)

if not "%1"=="silent" (
    echo.
    echo [4/4] PM2 durumu kaydediliyor...
)
pm2 save >nul 2>&1

if not "%1"=="silent" (
    echo.
    echo ========================================
    echo   ✅ Backend PM2 ile başlatıldı!
    echo ========================================
    echo.
    echo Servisler sürekli çalışacak ve otomatik yeniden başlatılacak.
    echo.
    echo Komutlar:
    echo   pm2 status       - Durum kontrolü
    echo   pm2 logs         - Logları görüntüle
    echo   pm2 monit        - Canlı monitör
    echo   pm2 restart all  - Tümünü yeniden başlat
    echo   pm2 stop all     - Tümünü durdur
    echo   pm2 delete all   - Tümünü sil
    echo   npm run ensure:running - Servisleri kontrol et ve başlat
    echo.
    echo Otomatik başlatma için:
    echo   npm run setup:startup
    echo.
    timeout /t 2 >nul
)

