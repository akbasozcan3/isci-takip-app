# Microservices Setup Guide

## Overview

Bavaxe platformu 6 farklı mikroservis ile çalışır:
1. Node.js (Port 4000) - Ana API
2. Python FastAPI (Port 8000) - AI/ML Analytics
3. Go (Port 8080) - Location Processing
4. PHP Laravel (Port 9000) - Notifications
5. Java Spring Boot (Port 7000) - Billing
6. Python Email (Port 5001) - Email Service

## Quick Start

### 1. Node.js Service (Main API)
```bash
cd backend
npm install
npm start
```

### 2. Python Service
```bash
cd backend/python_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Go Service
```bash
cd backend/go_service
go mod download
go run main.go
```

### 4. PHP Laravel Service
```bash
cd backend/php_service
composer install
cp .env.example .env
php artisan key:generate
php artisan serve --port=9000
```

### 5. Java Spring Boot Service
```bash
cd backend/java_service
mvn clean install
mvn spring-boot:run
```


## Environment Variables

Tüm servisler için `.env` dosyasında şu değişkenler tanımlı olmalı:

```env
NODEJS_SERVICE_URL=http://localhost:4000
PYTHON_SERVICE_URL=http://localhost:8000
GO_SERVICE_URL=http://localhost:8080
PHP_SERVICE_URL=http://localhost:9000
JAVA_SERVICE_URL=http://localhost:7000
```

## Health Checks

Tüm servislerin health endpoint'leri:
- Node.js: `GET http://localhost:4000/api/health`
- Python: `GET http://localhost:8000/health`
- Go: `GET http://localhost:8080/health`
- PHP: `GET http://localhost:9000/health`
- Java: `GET http://localhost:7000/api/health`

## API Gateway

Merkezi API Gateway tüm servisleri yönetir:
- Circuit breaker pattern
- Health monitoring
- Request routing
- Error handling

Gateway endpoint: `GET /api/microservices/status`

## Troubleshooting

### Port Conflicts
Her servis farklı bir port kullanır. Port çakışması durumunda:
1. Servisi durdurun
2. Port'u `.env` dosyasında değiştirin
3. Servisi yeniden başlatın

### Service Not Responding
1. Health check endpoint'ini test edin
2. Log dosyalarını kontrol edin
3. Circuit breaker durumunu kontrol edin: `GET /api/microservices/status`

### Dependencies
Her servis kendi bağımlılıklarına sahiptir:
- PHP: Composer packages
- Java: Maven dependencies
- C#: NuGet packages
- Python: pip packages
- Go: go modules

## Development

Her servis bağımsız olarak geliştirilebilir. API Gateway tüm servisleri otomatik olarak keşfeder ve yönetir.

