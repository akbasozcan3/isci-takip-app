# NEXORA Backend - PM2 Başlatma Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NEXORA Backend - PM2 Başlatılıyor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# PM2 kontrolü
try {
    $pm2Check = Get-Command pm2 -ErrorAction Stop
} catch {
    Write-Host "[HATA] PM2 bulunamadı!" -ForegroundColor Red
    Write-Host "PM2 kurulumu: npm install -g pm2" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] PM2 durumu kontrol ediliyor..." -ForegroundColor Yellow
pm2 status

Write-Host ""
Write-Host "[2/3] Mevcut process'ler durduruluyor..." -ForegroundColor Yellow
pm2 delete ecosystem.config.js 2>$null

Write-Host ""
Write-Host "[2.5/3] Backend hazırlık kontrolü..." -ForegroundColor Yellow
if (!(Test-Path "data.json")) {
    Write-Host "[UYARI] data.json bulunamadı, oluşturuluyor..." -ForegroundColor Yellow
    npm run init
}

Write-Host "[3/3] Backend servisleri başlatılıyor..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
if ($env:NODE_ENV -eq "production") {
    pm2 start ecosystem.config.js --env production
} else {
    pm2 start ecosystem.config.js --env development
}

Write-Host ""
Write-Host "[4/4] PM2 durumu kaydediliyor..." -ForegroundColor Yellow
pm2 save

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Backend PM2 ile başlatıldı!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Servisler sürekli çalışacak ve otomatik yeniden başlatılacak." -ForegroundColor Cyan
Write-Host ""
Write-Host "Komutlar:" -ForegroundColor Cyan
Write-Host "  pm2 status       - Durum kontrolü" -ForegroundColor White
Write-Host "  pm2 logs         - Logları görüntüle" -ForegroundColor White
Write-Host "  pm2 monit        - Canlı monitör" -ForegroundColor White
Write-Host "  pm2 restart all  - Tümünü yeniden başlat" -ForegroundColor White
Write-Host "  pm2 stop all      - Tümünü durdur" -ForegroundColor White
Write-Host "  pm2 delete all   - Tümünü sil" -ForegroundColor White
Write-Host "  npm run ensure:running - Servisleri kontrol et ve başlat" -ForegroundColor White
Write-Host ""
Write-Host "Otomatik başlatma için:" -ForegroundColor Cyan
Write-Host "  npm run setup:startup" -ForegroundColor White
Write-Host ""

