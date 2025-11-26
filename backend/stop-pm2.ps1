# NEXORA Backend - PM2 Durdurma Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NEXORA Backend - PM2 Durduruluyor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot
pm2 stop ecosystem.config.js

Write-Host ""
Write-Host "✅ Backend servisleri durduruldu!" -ForegroundColor Green
Write-Host ""

