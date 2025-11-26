@echo off
echo 📧 Email Verification Service Başlatılıyor...
echo.

REM Python kontrolü
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python bulunamadı! Lütfen Python kurun.
    pause
    exit /b 1
)

REM Virtual environment oluştur (eğer yoksa)
if not exist venv (
    echo 📦 Virtual environment oluşturuluyor...
    python -m venv venv
)

REM Virtual environment aktif et
call venv\Scripts\activate.bat

REM Dependencies kur
if not exist venv\Lib\site-packages\flask (
    echo 📥 Dependencies kuruluyor...
    pip install -r requirements.txt
)

echo.
echo 🔧 Email Service başlatılıyor...
echo 📡 API: http://localhost:5001
echo 📊 Health Check: http://localhost:5001/health
echo.
echo Durdurmak için Ctrl+C tuşlarına basın.
echo.

python email_service.py

