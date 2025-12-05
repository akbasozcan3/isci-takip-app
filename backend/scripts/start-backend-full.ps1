$ErrorActionPreference = "Continue"
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  BACKEND SERVİSLERİ BAŞLATILIYOR" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot ".."
Set-Location $backendPath

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "❌ PM2 bulunamadı! npm install -g pm2" -ForegroundColor Red
    exit 1
}

Write-Host "[1/6] Mevcut servisler temizleniyor..." -ForegroundColor Yellow
pm2 delete all 2>$null | Out-Null
Start-Sleep -Seconds 1

Write-Host "[2/6] Go PATH kontrolü..." -ForegroundColor Yellow
$goPath = "C:\Program Files\Go\bin"
if (Test-Path "$goPath\go.exe") {
    if ($env:Path -notlike "*$goPath*") {
        $env:Path += ";$goPath"
        Write-Host "   ✓ Go PATH'e eklendi" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️  Go bulunamadı (go-location servisi başlatılamayabilir)" -ForegroundColor Yellow
}

Write-Host "[3/6] Ecosystem config kontrol ediliyor..." -ForegroundColor Yellow
if (-not (Test-Path "ecosystem.config.js")) {
    Write-Host "   ❌ ecosystem.config.js bulunamadı!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ Config dosyası bulundu" -ForegroundColor Green

Write-Host "[4/6] Tüm servisler başlatılıyor..." -ForegroundColor Yellow
$result = pm2 start ecosystem.config.js 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ PM2 başlatıldı" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  PM2 başlatma uyarısı: $result" -ForegroundColor Yellow
}

Write-Host "[5/6] Servislerin başlaması bekleniyor (10 saniye)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "[6/6] Servis durumu kontrol ediliyor..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $pm2List = pm2 jlist 2>&1 | Out-String
    if ($pm2List -and $pm2List -notmatch "error|Error") {
        $services = $pm2List | ConvertFrom-Json
        Write-Host "`n========================================" -ForegroundColor Cyan
        Write-Host "  SERVİS DURUMU" -ForegroundColor Cyan
        Write-Host "========================================`n" -ForegroundColor Cyan
        
        foreach ($svc in $services) {
            $name = $svc.name
            $status = $svc.pm2_env.status
            $restarts = $svc.pm2_env.restart_time
            
            if ($status -eq "online") {
                Write-Host "  ✓ $name - $status (restarts: $restarts)" -ForegroundColor Green
            } elseif ($status -eq "stopped") {
                Write-Host "  ⚠️  $name - $status" -ForegroundColor Yellow
            } else {
                Write-Host "  ❌ $name - $status" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ⚠️  PM2 servis listesi alınamadı" -ForegroundColor Yellow
        pm2 list
    }
} catch {
    Write-Host "  ⚠️  Durum kontrolü hatası, manuel kontrol:" -ForegroundColor Yellow
    pm2 list
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  KULLANIM KOMUTLARI" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "  pm2 status          - Servis durumu" -ForegroundColor White
Write-Host "  pm2 logs             - Canlı loglar" -ForegroundColor White
Write-Host "  pm2 logs [servis]    - Belirli servis logları" -ForegroundColor White
Write-Host "  pm2 restart all      - Tümünü yeniden başlat" -ForegroundColor White
Write-Host "  pm2 stop all         - Tümünü durdur" -ForegroundColor White
Write-Host "  pm2 delete all       - Tümünü sil" -ForegroundColor White
Write-Host "  pm2 save             - Durumu kaydet" -ForegroundColor White
Write-Host ""
