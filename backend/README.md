# Backend API

## Quick Start

```powershell
cd backend
.\scripts\start-backend-full.ps1
```

Veya manuel:
```powershell
cd backend
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

## Services

All services managed by PM2:

1. **Node.js API** (Port 4000) - Main backend
2. **Python Email** (Port 5001) - Email service
3. **Python Analytics** (Port 8000) - FastAPI analytics
4. **Go Location** (Port 8080) - Location processing
5. **Java Billing** (Port 7000) - Spring Boot billing
6. **PHP Notifications** (Port 9000) - Laravel notifications

## Project Structure

```
backend/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── core/            # Core utilities
│   ├── database/    # Database models
│   ├── middleware/  # Express middleware
│   ├── services/    # Business logic services
│   └── utils/       # Utility functions
├── modules/          # Feature modules
│   └── auth/        # Authentication module
├── routes/          # Route definitions
└── services/        # External service integrations
```

## API Architecture

- **Router** → **Controller** → **Service** → **Model**
- Standardized error handling via `errorHandler.js`
- Consistent responses via `responseFormatter.js`
- All endpoints use `/api` prefix

## Environment Variables

See `env.example` for required variables.

## PM2 Commands

```bash
pm2 start ecosystem.config.js    # Start all services
pm2 status                        # Check status
pm2 logs                          # View logs
pm2 restart all                   # Restart all
pm2 stop all                      # Stop all
pm2 delete all                    # Remove all
```

## Health Checks

- Node.js: `http://localhost:4000/api/health`
- Python Email: `http://localhost:5001/health`
