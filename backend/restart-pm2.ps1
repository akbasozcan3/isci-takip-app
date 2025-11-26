# NEXORA Backend - PM2 Yeniden Başlatma Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NEXORA Backend - PM2 Yeniden Başlatılıyor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot
pm2 restart ecosystem.config.js

Write-Host ""
Write-Host "✅ Backend servisleri yeniden başlatıldı!" -ForegroundColor Green
Write-Host ""

