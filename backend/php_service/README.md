# Bavaxe PHP Laravel Service

## Requirements
- PHP 8.1+
- Composer

## Installation
```bash
composer install
cp .env.example .env
php artisan key:generate
```

## Running
```bash
php artisan serve --port=9000
```

## Endpoints
- GET /health - Health check
- POST /api/notifications/process - Process notifications
- GET /api/notifications/stats?user_id={id} - Get notification statistics

