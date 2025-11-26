# İşçi Takip Backend Başlatma Script'i
Write-Host "🚀 İşçi Takip Backend Başlatılıyor..." -ForegroundColor Green
Write-Host ""

Set-Location api

# .env dosyası kontrolü
if (-not (Test-Path .env)) {
    Write-Host "⚠️  .env dosyası bulunamadı, env.example'dan oluşturuluyor..." -ForegroundColor Yellow
    Copy-Item env.example .env
    Write-Host "✅ .env dosyası oluşturuldu" -ForegroundColor Green
    Write-Host ""
}

# Dependencies kontrolü
if (-not (Test-Path node_modules)) {
    Write-Host "📦 Dependencies kuruluyor..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

Write-Host "🔧 Backend başlatılıyor..." -ForegroundColor Cyan
Write-Host "📡 API: http://localhost:4000" -ForegroundColor White
Write-Host "📊 Health Check: http://localhost:4000/api/health" -ForegroundColor White
Write-Host ""
Write-Host "Durdurmak için Ctrl+C tuşlarına basın." -ForegroundColor Yellow
Write-Host ""

npm start

