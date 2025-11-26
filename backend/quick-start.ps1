# İşçi Takip - Hızlı Başlangıç Script
Write-Host "🚀 İşçi Takip Uygulaması - Hızlı Başlangıç" -ForegroundColor Green

# 1. Dependencies kontrol
Write-Host "📦 Dependencies kontrol ediliyor..." -ForegroundColor Yellow
if (!(Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js bulunamadı! Lütfen Node.js kurun." -ForegroundColor Red
    exit 1
}

if (!(Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ NPM bulunamadı!" -ForegroundColor Red
    exit 1
}

# 2. Frontend dependencies
Write-Host "📱 Frontend dependencies kuruluyor..." -ForegroundColor Yellow
npm install

# 3. Backend dependencies
Write-Host "🔧 Backend dependencies kuruluyor..." -ForegroundColor Yellow
Set-Location backend
npm install
Set-Location ..

# 4. EAS CLI kontrol
Write-Host "🛠️ EAS CLI kontrol ediliyor..." -ForegroundColor Yellow
if (!(Get-Command "eas" -ErrorAction SilentlyContinue)) {
    Write-Host "📥 EAS CLI kuruluyor..." -ForegroundColor Yellow
    npm install -g @expo/eas-cli
}

# 5. Railway CLI kontrol (opsiyonel)
Write-Host "🚂 Railway CLI kontrol ediliyor..." -ForegroundColor Yellow
if (!(Get-Command "railway" -ErrorAction SilentlyContinue)) {
    Write-Host "📥 Railway CLI kuruluyor..." -ForegroundColor Yellow
    npm install -g @railway/cli
}

Write-Host "✅ Kurulum tamamlandı!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Sonraki adımlar:" -ForegroundColor Cyan
Write-Host "1. Backend deploy: cd backend && railway up" -ForegroundColor White
Write-Host "2. Mobile app başlat: npm start" -ForegroundColor White
Write-Host "3. Android build: npm run build:android" -ForegroundColor White
Write-Host "4. iOS build: npm run build:ios" -ForegroundColor White
Write-Host ""
Write-Host "📚 Detaylı rehber: DEPLOYMENT_REHBERI.md" -ForegroundColor Cyan
Write-Host "👥 Müşteri rehberi: MUSTERI_REHBERI.md" -ForegroundColor Cyan
