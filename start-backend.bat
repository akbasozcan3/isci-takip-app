@echo off
echo 🚀 İşçi Takip Backend Başlatılıyor...
echo.

cd api

REM .env dosyası kontrolü
if not exist .env (
    echo ⚠️  .env dosyası bulunamadı, env.example'dan oluşturuluyor...
    copy env.example .env
    echo ✅ .env dosyası oluşturuldu
    echo.
)

REM Dependencies kontrolü
if not exist node_modules (
    echo 📦 Dependencies kuruluyor...
    call npm install
    echo.
)

echo 🔧 Backend başlatılıyor...
echo 📡 API: http://localhost:4000
echo 📊 Health Check: http://localhost:4000/api/health
echo.
echo Durdurmak için Ctrl+C tuşlarına basın.
echo.

call npm start

