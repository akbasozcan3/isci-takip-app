# Backend Hızlı Başlatma

## Tek Komutla Tüm Servisleri Başlat

```powershell
cd backend
.\scripts\start-backend-full.ps1
```

## Servisler

1. **isci-takip-api** (Node.js) - Port 4000
2. **email-service** (Python) - Port 5001  
3. **python-analytics** (Python FastAPI) - Port 8000
4. **go-location** (Go) - Port 8080
5. **java-billing** (Java Spring Boot) - Port 7000
6. **php-notifications** (PHP Laravel) - Port 9000

## Durum Kontrol

```powershell
pm2 status
pm2 list
pm2 logs
```

## Health Check

Tüm servislerin health endpoint'leri:
- http://localhost:4000/api/health
- http://localhost:5001/health
- http://localhost:8000/health
- http://localhost:8080/health
- http://localhost:7000/api/health
- http://localhost:9000/health
