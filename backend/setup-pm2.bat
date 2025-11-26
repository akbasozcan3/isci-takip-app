@echo off
echo ========================================
echo   NEXORA Backend - PM2 Kurulum Kontrolü
echo ========================================
echo.

REM PM2 kontrolü
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [UYARI] PM2 bulunamadı!
    echo.
    echo PM2 kuruluyor...
    call npm install -g pm2
    if %ERRORLEVEL% NEQ 0 (
        echo [HATA] PM2 kurulumu başarısız!
        pause
        exit /b 1
    )
    echo [OK] PM2 başarıyla kuruldu!
) else (
    echo [OK] PM2 zaten kurulu
)

echo.
echo [1/2] Logs klasörü oluşturuluyor...
if not exist "logs" mkdir logs
echo [OK] Logs klasörü hazır

echo.
echo [2/2] PM2 startup script'i ekleniyor...
pm2 startup
echo.
echo [NOT] Yukarıdaki komutu çalıştırmayı unutmayın!

echo.
echo ========================================
echo   ✅ PM2 Kurulum Kontrolü Tamamlandı!
echo ========================================
echo.
pause

