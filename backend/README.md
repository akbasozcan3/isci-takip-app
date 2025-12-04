# Professional İşçi Takip Backend API

## 🚀 Features

- **Modular Architecture**: Clean separation of concerns with controllers, services, and database layers
- **Authentication System**: JWT-based authentication with email verification
- **Location Tracking**: Real-time location storage and retrieval with Socket.IO
- **Security**: Helmet.js security headers, CORS protection, rate limiting
- **Performance**: Compression, efficient database operations
- **Professional Error Handling**: Comprehensive error management and logging

## 📁 Project Structure

```
api/
├── config/
│   └── database.js          # Database configuration and operations
├── controllers/
│   ├── authController.js    # Authentication endpoints
│   └── locationController.js # Location tracking endpoints
├── services/
│   └── authService.js       # Authentication business logic
├── routes/
│   └── index.js             # Route definitions and middleware
├── server.js                # Main server application
└── package.json             # Dependencies and scripts
```

## 🔧 Installation

```bash
cd api
npm install
```

## ⚙️ Environment Variables

Create a `.env` file in the `api` directory:

```env
# Server Configuration
NODE_ENV=production
PORT=4000

# JWT Secret
SECRET_KEY=your-super-secret-jwt-key

# CORS Origins
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Email Verification Settings
OTP_DAILY_LIMIT=5
OTP_MAX_ATTEMPTS=5
RESET_CODE_EXPIRE_MIN=30
VERIFY_CODE_EXPIRE_MIN=30
RESET_DEV_RETURN_CODE=1
ENFORCE_PRE_EMAIL=1

# Email Templates
EMAIL_SUBJECT_VERIFY=Hesabınızı Doğrulayın
EMAIL_SUBJECT_RESET=Şifre Sıfırlama Kodu
```

## 🚀 Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/pre-verify-email` - Send verification code
- `POST /api/auth/pre-verify-email/verify` - Verify email code
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user (protected)
- `GET /api/auth/profile` - Get user profile (protected)
- `PUT /api/auth/profile` - Update user profile (protected)

### Location Tracking
- `POST /api/location/store` - Store location data
- `GET /api/location/:deviceId` - Get location history
- `GET /api/location/:deviceId/latest` - Get latest location
- `GET /api/location/:deviceId/stats` - Get location statistics
- `DELETE /api/location/:deviceId` - Delete location data
- `GET /api/devices` - Get all devices with latest locations

### System
- `GET /api/health` - Health check
- `GET /` - API information

## 🔌 Socket.IO Events

### Client to Server
- `join-device` - Join device room for location updates
- `location-update` - Send location update

### Server to Client
- `location-updated` - Broadcast location update to device room

## 🛡️ Security Features

- JWT token authentication
- Email verification required
- Rate limiting for email sending
- CORS protection
- Security headers with Helmet.js
- Password hashing with bcrypt
- Input validation and sanitization

## 📊 Database

The application uses a JSON file-based database (`data.json`) with the following structure:

```json
{
  "users": {},
  "tokens": {},
  "emailPasswords": {},
  "emailVerifications": {},
  "resendMeta": {},
  "store": {}
}
```

## 🔄 Migration from Old System

The new backend is fully compatible with the existing frontend. No changes are required on the client side.

## 📈 Performance Optimizations

- Database operations are batched and scheduled
- Compression middleware for response optimization
- Efficient JSON file operations
- Socket.IO for real-time communication
- Proper error handling and logging

## 🐛 Debugging

Set `NODE_ENV=development` to enable detailed error messages and logging.

## 📝 License

MIT License - see LICENSE file for details.