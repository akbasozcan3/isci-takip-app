$javaPaths = @(
    "C:\Program Files\Java\jdk-21\bin",
    "C:\Program Files\Java\jdk-17\bin",
    "C:\Program Files\Java\jre-21\bin",
    "C:\Program Files\Java\jre-17\bin",
    "C:\Program Files (x86)\Java\jre-21\bin",
    "C:\Program Files (x86)\Java\jre-17\bin"
)

$found = $false
foreach ($javaPath in $javaPaths) {
    if (Test-Path "$javaPath\java.exe") {
        Write-Host "Java bulundu: $javaPath" -ForegroundColor Green
        
        $version = & "$javaPath\java.exe" -version 2>&1 | Select-Object -First 1
        Write-Host "Java versiyonu: $version" -ForegroundColor Cyan
        
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($currentPath -notlike "*$javaPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$javaPath", "User")
            Write-Host "Java PATH'e eklendi. Yeni terminal açın." -ForegroundColor Yellow
            $found = $true
        } else {
            Write-Host "Java zaten PATH'te." -ForegroundColor Green
            $found = $true
        }
        break
    }
}

if (-not $found) {
    Write-Host "Java 17+ bulunamadı. Mevcut Java versiyonu:" -ForegroundColor Yellow
    & java -version 2>&1
    
    Write-Host "`nSpring Boot 3.1 için Java 17+ gerekiyor. Şu adresten indirin:" -ForegroundColor Red
    Write-Host "https://adoptium.net/" -ForegroundColor Cyan
}
