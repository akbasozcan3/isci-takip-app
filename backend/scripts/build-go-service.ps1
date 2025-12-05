Write-Host "Go servisi derleniyor..." -ForegroundColor Cyan

$goServicePath = Join-Path $PSScriptRoot "..\go_service"
Set-Location $goServicePath

$goPath = "C:\Program Files\Go\bin"
if ($env:Path -notlike "*$goPath*") {
    $env:Path += ";$goPath"
}

if (Get-Command go -ErrorAction SilentlyContinue) {
    Write-Host "Go bulundu, modüller indiriliyor..." -ForegroundColor Yellow
    go mod download
    
    Write-Host "Servis derleniyor..." -ForegroundColor Yellow
    go build -o main.exe main.go
    
    if (Test-Path "main.exe") {
        Write-Host "✓ Go servisi başarıyla derlendi: main.exe" -ForegroundColor Green
    } else {
        Write-Host "❌ Derleme başarısız" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Go bulunamadı. PATH'e ekleyin:" -ForegroundColor Red
    Write-Host "   $env:Path += `";C:\Program Files\Go\bin`"" -ForegroundColor Yellow
}
