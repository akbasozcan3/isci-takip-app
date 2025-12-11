# BAVAXE GPS Tracking Backend API

Professional GPS Tracking and Location Management Backend API built with Node.js and Express.

## 🚀 Features

- **Real-time Location Tracking** via Socket.IO
- **Group Management** and collaboration
- **Advanced Analytics** and reporting
- **Subscription-based Billing** system (Free, Plus, Business plans)
- **Email Verification** and authentication
- **Push Notifications** via OneSignal
- **Professional API Documentation** (Swagger/OpenAPI)
- **Comprehensive Validation** with Joi schemas
- **Structured Logging** with request tracing
- **Error Handling** with error IDs and structured responses
- **Rate Limiting** based on subscription plans
- **Security** headers and input sanitization
- **Performance Monitoring** and optimization
- **Database Backup** and recovery

## 📋 Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env file with your configuration
# Required variables:
# - JWT_SECRET
# - ONESIGNAL_APP_ID
# - ONESIGNAL_REST_API_KEY
# - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
```

## 🚦 Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Check deployment readiness
npm run deploy-check
```

## 📚 API Documentation

Once the server is running, access the Swagger UI at:
- **Development**: `http://localhost:4000/api-docs`
- **Production**: `https://your-domain.com/api-docs`

## 🔐 Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## 📊 Rate Limiting

Rate limits are applied based on subscription plan:
- **Free**: 50 requests/minute
- **Plus**: 200 requests/minute
- **Business**: 500 requests/minute

## 🏗️ Architecture

### Core Structure

```
backend/
├── core/
│   ├── middleware/      # Custom middleware (auth, validation, rate limiting)
│   ├── schemas/         # API validation schemas (Joi)
│   ├── services/        # Business logic services
│   └── utils/          # Utility functions (logger, error handler)
├── controllers/         # Request handlers
├── routes/             # API route definitions
├── config/             # Configuration files
├── services/           # External service integrations
└── server.js           # Main server file
```

### Key Components

1. **API Validation**: Centralized validation schemas using Joi
2. **Error Handling**: Custom error classes with error IDs
3. **Logging**: Structured JSON logging with request tracing
4. **Security**: Helmet, CORS, rate limiting, input sanitization
5. **Performance**: Compression, caching, query optimization
6. **Monitoring**: Health checks, metrics, performance tracking

## 🔧 Environment Variables

See `.env.example` for all available environment variables.

### Required Variables

- `JWT_SECRET`: Secret key for JWT token signing
- `ONESIGNAL_APP_ID`: OneSignal application ID
- `ONESIGNAL_REST_API_KEY`: OneSignal REST API key
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Email service configuration

### Optional Variables

- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window
- `ENABLE_SWAGGER`: Enable Swagger UI in production (default: false)

## 📝 API Endpoints

### Health & System
- `GET /api/health` - Health check
- `GET /system/status` - System status (requires auth)
- `GET /system/version` - API version

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/verify-email` - Verify email address

## 🚀 Deployment

### Quick Start
See [PRODUCTION.md](./PRODUCTION.md) for quick deployment guide.

### Full Guide
See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment documentation.

### Environment Setup
Copy `env.example` to `.env` and configure:
```bash
cp env.example .env
# Edit .env with your values
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure `JWT_SECRET` (min 32 chars)
- [ ] Set `ALLOWED_ORIGINS` (not `*`)
- [ ] Configure OneSignal keys
- [ ] Configure SMTP credentials
- [ ] Enable SSL/TLS (HTTPS)
- [ ] Configure firewall
- [ ] Set up monitoring
- `POST /auth/reset-password` - Reset password

### Location Tracking
- `POST /api/location/store` - Store location data
- `GET /api/location/:deviceId` - Get location history
- `GET /api/location/:deviceId/latest` - Get latest location
- `GET /api/location/:deviceId/stats` - Get location statistics

### Groups
- `POST /api/groups` - Create new group
- `GET /api/groups/user/:userId/active` - Get user's active groups
- `GET /api/groups/:groupId/members` - Get group members
- `POST /api/groups/:groupId/leave` - Leave group

### Analytics
- `GET /api/analytics/:deviceId/daily` - Daily analytics
- `GET /api/analytics/:deviceId/weekly` - Weekly analytics
- `GET /api/analytics/:deviceId/monthly` - Monthly analytics

### Billing
- `POST /api/payment/process` - Process payment
- `GET /api/billing/history` - Get billing history
- `GET /api/billing/receipts` - Get receipts

## 🧪 Testing

```bash
# Run deployment checks
npm test

# Verify OneSignal configuration
npm run verify-onesignal

# Diagnose OneSignal issues
npm run diagnose-onesignal
```

## 🔒 Security

- JWT-based authentication
- Rate limiting per subscription plan
- Input validation and sanitization
- Security headers (Helmet)
- CORS configuration
- SQL injection prevention
- XSS protection

## 📈 Performance

- Response compression
- API response caching
- Database query optimization
- Connection pooling
- Memory optimization
- Background job processing

## 🐛 Error Handling

All errors are returned in a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "errorId": "unique-error-id",
  "timestamp": "2025-01-09T12:00:00.000Z",
  "details": {}
}
```

## 📖 Logging

Structured JSON logging with:
- Request ID tracing
- User context
- Error tracking
- Performance metrics
- Security events

## 🤝 Contributing

1. Follow the existing code style
2. Add validation schemas for new endpoints
3. Update Swagger documentation
4. Write tests for new features
5. Update this README

## 📄 License

MIT

## 👨‍💻 Author

Ozcan Akbas

## 🔗 Links

- API Documentation: `/api-docs`
- Health Check: `/api/health`
- System Status: `/system/status`

