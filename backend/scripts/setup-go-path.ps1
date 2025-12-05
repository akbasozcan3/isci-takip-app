$goPaths = @(
    "C:\Program Files\Go\bin",
    "C:\Go\bin",
    "$env:USERPROFILE\go\bin",
    "$env:LOCALAPPDATA\Go\bin"
)

$found = $false
foreach ($goPath in $goPaths) {
    if (Test-Path "$goPath\go.exe") {
        Write-Host "Go bulundu: $goPath" -ForegroundColor Green
        
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($currentPath -notlike "*$goPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$goPath", "User")
            Write-Host "Go PATH'e eklendi. Yeni terminal açın veya şu komutu çalıştırın:" -ForegroundColor Yellow
            Write-Host "`$env:Path += `";$goPath`"" -ForegroundColor Cyan
            $found = $true
        } else {
            Write-Host "Go zaten PATH'te." -ForegroundColor Green
            $found = $true
        }
        break
    }
}

if (-not $found) {
    Write-Host "Go bulunamadı. Lütfen Go'yu şu adresten indirin:" -ForegroundColor Red
    Write-Host "https://go.dev/dl/" -ForegroundColor Cyan
    Write-Host "`nKurulumdan sonra bu scripti tekrar çalıştırın." -ForegroundColor Yellow
}
