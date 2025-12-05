# Backend Servis Durumu

## Başlatma

```powershell
cd backend
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
pm2 list
```

## Servis Listesi

| # | Servis | Dil | Port | Durum | Health Check |
|---|--------|-----|------|-------|--------------|
| 1 | isci-takip-api | Node.js | 4000 | ✅ | http://localhost:4000/api/health |
| 2 | email-service | Python | 5001 | ✅ | http://localhost:5001/health |
| 3 | python-analytics | Python | 8000 | ✅ | http://localhost:8000/health |
| 4 | go-location | Go | 8080 | ⚠️ | http://localhost:8080/health |
| 5 | java-billing | Java | 7000 | ⚠️ | http://localhost:7000/api/health |
| 6 | php-notifications | PHP | 9000 | ✅ | http://localhost:9000/health |
| 7 | csharp-reports | C# | 6000 | ✅ | http://localhost:6000/api/health |

## Notlar

- Go servisi için `main.exe` derlenmiş olmalı: `.\scripts\build-go-service.ps1`
- Java servisi için Maven gerekli: `mvn spring-boot:run`
- Tüm servisler PM2 ile yönetiliyor

## Komutlar

```powershell
pm2 status              # Durum
pm2 logs                # Loglar
pm2 restart all         # Yeniden başlat
pm2 stop all            # Durdur
pm2 delete all          # Sil
```
