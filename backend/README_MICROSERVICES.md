# Bavaxe Microservices Architecture

## Overview

Bavaxe platformu çoklu dil ve teknoloji kullanan profesyonel bir microservices mimarisi ile tasarlanmıştır.

## Services

### 1. Node.js Service (Port 4000)
- **Teknoloji**: Node.js + Express
- **Görev**: Ana API servisi, authentication, location tracking
- **Özellikler**:
  - JWT authentication
  - Real-time Socket.IO
  - Database operations
  - Payment processing

### 2. Ruby on Rails Service (Port 3001)
- **Teknoloji**: Ruby 3.2.0 + Rails 7.1
- **Görev**: Analytics ve Reporting servisi
- **Özellikler**:
  - Advanced analytics
  - Report generation (CSV, JSON, PDF)
  - Trend analysis
  - Performance metrics

### 3. Python FastAPI Service (Port 8000)
- **Teknoloji**: Python 3.11+ + FastAPI
- **Görev**: AI/ML ve gelişmiş analytics
- **Özellikler**:
  - Machine learning predictions
  - Route optimization
  - Anomaly detection
  - Insights generation

### 4. Go Service (Port 8080)
- **Teknoloji**: Go 1.21+
- **Görev**: High-performance location processing
- **Özellikler**:
  - Batch location processing
  - Route optimization
  - Real-time location compression
  - High-throughput operations

### 5. PHP Laravel Service (Port 9000)
- **Teknoloji**: PHP 8.1+ + Laravel 10
- **Görev**: Notification processing and management
- **Özellikler**:
  - Notification queue processing
  - Notification statistics
  - Priority-based notification handling
  - Notification type grouping

### 6. Java Spring Boot Service (Port 7000)
- **Teknoloji**: Java 17 + Spring Boot 3.1
- **Görev**: Billing and payment processing
- **Özellikler**:
  - Payment transaction processing
  - Billing history management
  - Payment validation
  - Transaction tracking


## API Gateway

Merkezi API Gateway tüm servisleri yönetir:
- Service discovery
- Circuit breaker pattern
- Load balancing
- Health checks
- Request routing

## Setup

### Node.js Service
```bash
cd backend
npm install
npm start
```

### Ruby Service
```bash
cd backend/ruby_service
bundle install
rails server -p 3001
```

### Python Service
```bash
cd backend/python_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Go Service
```bash
cd backend/go_service
go mod download
go run main.go
```

### PHP Service
```bash
cd backend/php_service
composer install
php artisan serve --port=9000
```

### Java Service
```bash
cd backend/java_service
mvn clean install
mvn spring-boot:run
```


## Environment Variables

```env
NODEJS_SERVICE_URL=http://localhost:4000
RUBY_SERVICE_URL=http://localhost:3001
PYTHON_SERVICE_URL=http://localhost:8000
GO_SERVICE_URL=http://localhost:8080
PHP_SERVICE_URL=http://localhost:9000
JAVA_SERVICE_URL=http://localhost:7000
SERVICE_TOKEN=your-service-token
```

## API Endpoints

### Microservices Status
```
GET /api/microservices/status
```

### Analytics (via Gateway)
```
GET /api/microservices/analytics/:userId?date_range=7d
```

### Reports (via Gateway)
```
POST /api/microservices/reports/:userId
Body: { reportType: "daily" }
```

### Location Batch Processing
```
POST /api/microservices/location/batch
Body: { locations: [...] }
```

### Notifications (via Gateway - PHP)
```
POST /api/microservices/notifications/process
Body: { user_id: "userId", notifications: [...] }

GET /api/microservices/notifications/stats/:userId
```

### Billing (via Gateway - Java)
```
POST /api/microservices/billing/process
Body: { user_id: "userId", plan: "plan", amount: 100 }

GET /api/microservices/billing/history/:userId
```

### Reports (via Gateway - Python)
```
POST /api/microservices/reports/:userId
Body: { reportType: "daily" }
```

## Architecture Benefits

1. **Scalability**: Her servis bağımsız olarak ölçeklenebilir
2. **Technology Diversity**: Her servis için en uygun teknoloji seçilir
3. **Fault Tolerance**: Circuit breaker pattern ile hata toleransı
4. **Performance**: Go ile yüksek performanslı işlemler
5. **AI/ML**: Python ile gelişmiş analitik, tahminler ve raporlama

## Monitoring

Tüm servisler health check endpoint'lerine sahiptir:
- Node.js: `/api/health`
- Python: `/health`
- Go: `/health`
- PHP: `/health`
- Java: `/api/health`

## Development

Her servis bağımsız olarak geliştirilebilir ve test edilebilir. API Gateway tüm servisleri merkezi olarak yönetir.
