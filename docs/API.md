# API Documentation

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-api-domain.com`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Response Format

All responses follow this format:

```json
{
  "success": true|false,
  "data": { ... },
  "error": "Error message if success is false"
}
```

---

## Authentication Endpoints

### Register

**POST** `/api/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "MyP@ssw0rd",
  "displayName": "John Doe",
  "phone": "+905551234567" // optional
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "displayName": "John Doe",
    "createdAt": "2025-12-23T10:00:00Z"
  },
  "requiresVerification": true
}
```

**Errors:**
- `400`: Validation error
- `409`: Email already exists

---

### Login

**POST** `/api/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "MyP@ssw0rd"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

**Rate Limit:** 5 requests per minute

**Errors:**
- `401`: Invalid credentials
- `429`: Too many requests

---

### Password Reset

**POST** `/api/auth/reset/request`

Request password reset code.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Doğrulama kodu gönderildi"
}
```

**Rate Limit:** 3 requests per minute

---

**POST** `/api/auth/reset/verify`

Verify reset code.

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Kod doğrulandı"
}
```

---

**POST** `/api/auth/reset/confirm`

Confirm password reset.

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewP@ssw0rd"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Şifre başarıyla sıfırlandı"
}
```

---

## User Endpoints

### Get Current User

**GET** `/users/me`

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "displayName": "John Doe",
    "phone": "+905551234567",
    "avatarUrl": "https://...",
    "createdAt": "2025-12-23T10:00:00Z"
  }
}
```

---

### Update Profile

**PATCH** `/users/me`

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "displayName": "Jane Doe",
  "phone": "+905559876543",
  "currentPassword": "OldP@ssw0rd", // required for password change
  "newPassword": "NewP@ssw0rd" // optional
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "displayName": "Jane Doe",
    "phone": "+905559876543"
  }
}
```

---

### Upload Avatar

**POST** `/users/me/avatar`

Upload user avatar.

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:** FormData with `avatar` field

**Response:** `200 OK`
```json
{
  "success": true,
  "avatarUrl": "https://storage.../avatar_user_123.jpg"
}
```

**Constraints:**
- Max file size: 5MB
- Allowed types: image/jpeg, image/png, image/gif, image/webp

---

### Delete Avatar

**DELETE** `/users/me/avatar`

Delete user avatar.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Avatar silindi"
}
```

---

## Location Endpoints

### Update Location

**POST** `/api/location`

Update user's current location.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "latitude": 41.0082,
  "longitude": 28.9784,
  "accuracy": 10.5,
  "heading": 45.0,
  "speed": 5.2,
  "timestamp": 1703328000000
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Konum güncellendi"
}
```

**Rate Limit:** 200 requests per minute

---

### Get Location History

**GET** `/api/location/history`

Get user's location history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `startDate`: ISO date string
- `endDate`: ISO date string

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "loc_123",
      "coords": {
        "latitude": 41.0082,
        "longitude": 28.9784,
        "accuracy": 10.5
      },
      "timestamp": 1703328000000,
      "createdAt": "2025-12-23T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Steps Endpoints

### Update Steps

**POST** `/api/steps`

Update daily step count.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "steps": 5000,
  "distance": 3.5, // km, optional
  "calories": 250, // optional
  "timestamp": 1703328000000
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Adımlar güncellendi"
}
```

**Rate Limit:** 200 requests per minute

---

### Get Steps History

**GET** `/api/steps/history`

Get step count history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate`: ISO date string
- `endDate`: ISO date string

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-12-23",
      "steps": 8500,
      "distance": 6.2,
      "calories": 420
    }
  ]
}
```

---

## Profile Stats

**GET** `/api/profile/stats`

Get user statistics.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalLocations": 1250,
    "totalSteps": 125000,
    "activeDays": 45,
    "lastActive": "2025-12-23T10:00:00Z"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

Different endpoints have different rate limits:

- **Auth endpoints**: 3-5 requests/minute
- **Location/Steps**: 200 requests/minute
- **Default**: 100 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703328060
```

---

## WebSocket Events

### Connection

```javascript
const socket = io('https://your-api-domain.com', {
  auth: { token: 'your-jwt-token' }
});
```

### Events

#### `location_update`

Emit user location update.

```javascript
socket.emit('location_update', {
  lat: 41.0082,
  lng: 28.9784,
  heading: 45.0,
  accuracy: 10.5
});
```

#### `send_message`

Send a message.

```javascript
socket.emit('send_message', {
  recipientId: 'user_456', // or groupId
  message: 'Hello!',
  type: 'text'
});
```

#### `typing`

Indicate typing status.

```javascript
socket.emit('typing', {
  recipientId: 'user_456',
  isTyping: true
});
```

---

## Changelog

### v1.0.0 (2025-12-23)
- Initial API release
- Authentication endpoints
- Location tracking
- Steps tracking
- Profile management
