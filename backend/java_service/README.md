# Bavaxe Java Spring Boot Service

## Requirements
- Java 17+
- Maven 3.6+

## Installation
```bash
mvn clean install
```

## Running
```bash
mvn spring-boot:run
```

## Endpoints
- GET /api/health - Health check
- POST /api/billing/process - Process billing transaction
- GET /api/billing/history?user_id={id} - Get billing history
- POST /api/billing/validate - Validate payment

