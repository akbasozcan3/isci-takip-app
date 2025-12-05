Write-Host "=== Backend Servisleri Başlatılıyor ===" -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot ".."
Set-Location $backendPath

Write-Host "`n1. Mevcut servisler durduruluyor..." -ForegroundColor Yellow
pm2 delete all 2>$null

Write-Host "`n2. Go PATH kontrolü..." -ForegroundColor Yellow
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    $goPath = "C:\Program Files\Go\bin"
    if (Test-Path "$goPath\go.exe") {
        $env:Path += ";$goPath"
        Write-Host "   Go PATH'e eklendi: $goPath" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Go bulunamadı, go-location servisi başlatılamayabilir" -ForegroundColor Yellow
    }
}

Write-Host "`n3. Tüm servisler başlatılıyor..." -ForegroundColor Yellow
pm2 start ecosystem.config.js

Write-Host "`n4. Servis durumu kontrol ediliyor..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
pm2 list

Write-Host "`n5. Servis logları:" -ForegroundColor Yellow
pm2 logs --lines 5 --nostream

Write-Host "`n=== Servisler Başlatıldı ===" -ForegroundColor Green
Write-Host "`nKomutlar:" -ForegroundColor Cyan
Write-Host "  pm2 status       - Servis durumu" -ForegroundColor White
Write-Host "  pm2 logs         - Canlı loglar" -ForegroundColor White
Write-Host "  pm2 restart all  - Tümünü yeniden başlat" -ForegroundColor White
Write-Host "  pm2 stop all     - Tümünü durdur" -ForegroundColor White
