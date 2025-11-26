# NEXORA Backend - PM2 Kurulum Kontrolü
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NEXORA Backend - PM2 Kurulum Kontrolü" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# PM2 kontrolü
try {
    $pm2Check = Get-Command pm2 -ErrorAction Stop
    Write-Host "[OK] PM2 zaten kurulu" -ForegroundColor Green
} catch {
    Write-Host "[UYARI] PM2 bulunamadı!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "PM2 kuruluyor..." -ForegroundColor Yellow
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[HATA] PM2 kurulumu başarısız!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] PM2 başarıyla kuruldu!" -ForegroundColor Green
}

Write-Host ""
Write-Host "[1/2] Logs klasörü oluşturuluyor..." -ForegroundColor Yellow
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}
Write-Host "[OK] Logs klasörü hazır" -ForegroundColor Green

Write-Host ""
Write-Host "[2/2] PM2 startup script'i ekleniyor..." -ForegroundColor Yellow
pm2 startup
Write-Host ""
Write-Host "[NOT] Yukarıdaki komutu çalıştırmayı unutmayın!" -ForegroundColor Yellow

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ PM2 Kurulum Kontrolü Tamamlandı!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

