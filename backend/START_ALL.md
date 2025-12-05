# Backend Servisleri - Toplu Başlatma

## Hızlı Başlatma

```powershell
cd backend
.\scripts\start-backend-full.ps1
```

## Manuel Başlatma

### 1. Node.js API (Ana Servis)
```powershell
cd backend
pm2 start ecosystem.config.js --only isci-takip-api
```

### 2. Python Email Service
```powershell
pm2 start ecosystem.config.js --only email-service
```

### 3. Python Analytics
```powershell
pm2 start ecosystem.config.js --only python-analytics
```

### 4. Go Location Service
```powershell
# Go PATH'e eklenmiş olmalı
pm2 start ecosystem.config.js --only go-location
```

### 5. Java Billing Service
```powershell
pm2 start ecosystem.config.js --only java-billing
```

### 6. PHP Notifications Service
```powershell
pm2 start ecosystem.config.js --only php-notifications
```


## Tüm Servisleri Başlat

```powershell
cd backend
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

## Servis Durumu Kontrol

```powershell
pm2 status
pm2 list
pm2 jlist | ConvertFrom-Json | Select-Object name, pm2_env.status
```

## Health Check

```powershell
# Node.js API
Invoke-WebRequest http://localhost:4000/api/health

# Python Email
Invoke-WebRequest http://localhost:5001/health

# Python Analytics
Invoke-WebRequest http://localhost:8000/health

# Go Location
Invoke-WebRequest http://localhost:8080/health

# Java Billing
Invoke-WebRequest http://localhost:7000/api/health

# PHP Notifications
Invoke-WebRequest http://localhost:9000/health

```

## Loglar

```powershell
pm2 logs                    # Tüm loglar
pm2 logs isci-takip-api     # Sadece Node.js API
pm2 logs --lines 50          # Son 50 satır
```

## Servis Yönetimi

```powershell
pm2 restart all             # Tümünü yeniden başlat
pm2 stop all                # Tümünü durdur
pm2 delete all              # Tümünü sil
pm2 reload all              # Zero-downtime reload
```

## Sorun Giderme

### Go servisi başlamıyorsa:
```powershell
cd backend\scripts
.\setup-go-path.ps1
```

### Java servisi başlamıyorsa:
```powershell
cd backend\scripts
.\setup-java-path.ps1
```

### Port çakışması:
```powershell
netstat -ano | findstr :4000
netstat -ano | findstr :5001
```
