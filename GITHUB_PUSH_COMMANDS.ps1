# GitHub Push Script
# Bu script'i çalıştırmak için: .\GITHUB_PUSH_COMMANDS.ps1

Write-Host "🚀 GitHub Push Script" -ForegroundColor Green
Write-Host ""

# GitHub kullanıcı adını sor
$githubUser = Read-Host "GitHub kullanıcı adınızı girin (örn: ozcanakbas)"
$repoName = Read-Host "Repository adını girin (örn: my-app)"

if ([string]::IsNullOrWhiteSpace($githubUser) -or [string]::IsNullOrWhiteSpace($repoName)) {
    Write-Host "❌ Kullanıcı adı ve repository adı gereklidir!" -ForegroundColor Red
    exit 1
}

$repoUrl = "https://github.com/$githubUser/$repoName.git"

Write-Host ""
Write-Host "📋 Yapılacaklar:" -ForegroundColor Yellow
Write-Host "1. Git repository kontrolü"
Write-Host "2. Tüm dosyaları ekle"
Write-Host "3. Commit yap"
Write-Host "4. Remote ekle"
Write-Host "5. GitHub'a push et"
Write-Host ""

$confirm = Read-Host "Devam etmek istiyor musunuz? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ İptal edildi" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🔄 Git repository kontrol ediliyor..." -ForegroundColor Cyan

# Git init (eğer yoksa)
if (-not (Test-Path ".git")) {
    Write-Host "📦 Git repository başlatılıyor..." -ForegroundColor Yellow
    git init
}

# Git config (eğer yoksa)
$gitName = git config user.name
$gitEmail = git config user.email

if ([string]::IsNullOrWhiteSpace($gitName)) {
    $name = Read-Host "Git kullanıcı adınızı girin"
    git config user.name $name
}

if ([string]::IsNullOrWhiteSpace($gitEmail)) {
    $email = Read-Host "Git email adresinizi girin"
    git config user.email $email
}

Write-Host "✅ Git config tamamlandı" -ForegroundColor Green

# Dosyaları ekle
Write-Host ""
Write-Host "📁 Dosyalar ekleniyor..." -ForegroundColor Cyan
git add .

# Commit
Write-Host "💾 Commit yapılıyor..." -ForegroundColor Cyan
$commitMessage = "feat: Professional backend with microservices - Optimized Node.js, Python, Go, Java, PHP services"
git commit -m $commitMessage

# Remote kontrolü
Write-Host ""
Write-Host "🔗 Remote kontrol ediliyor..." -ForegroundColor Cyan
$existingRemote = git remote get-url origin 2>$null

if ($existingRemote) {
    Write-Host "⚠️  Mevcut remote: $existingRemote" -ForegroundColor Yellow
    $updateRemote = Read-Host "Remote'u güncellemek istiyor musunuz? (y/n)"
    if ($updateRemote -eq "y" -or $updateRemote -eq "Y") {
        git remote remove origin
        git remote add origin $repoUrl
    }
} else {
    git remote add origin $repoUrl
}

# Branch'i main yap
Write-Host ""
Write-Host "🌿 Branch ayarlanıyor..." -ForegroundColor Cyan
git branch -M main

# Push
Write-Host ""
Write-Host "🚀 GitHub'a push ediliyor..." -ForegroundColor Cyan
Write-Host "Repository URL: $repoUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  NOT: Push sırasında GitHub kullanıcı adı ve Personal Access Token istenecek!" -ForegroundColor Yellow
Write-Host "   Token oluşturmak için: https://github.com/settings/tokens" -ForegroundColor Yellow
Write-Host ""

$pushConfirm = Read-Host "Push etmek istiyor musunuz? (y/n)"
if ($pushConfirm -eq "y" -or $pushConfirm -eq "Y") {
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Başarılı! Proje GitHub'a push edildi!" -ForegroundColor Green
        Write-Host "🔗 Repository URL: https://github.com/$githubUser/$repoName" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🎯 Sonraki adım: Railway/Render'a deploy et!" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "❌ Push başarısız oldu. Lütfen hataları kontrol edin." -ForegroundColor Red
        Write-Host "💡 İpucu: Personal Access Token kullanmanız gerekebilir." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Push iptal edildi" -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 Manuel push için:" -ForegroundColor Cyan
Write-Host "   git push -u origin main" -ForegroundColor White
