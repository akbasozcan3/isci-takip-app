const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();

// CORS ayarları
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Test endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'İşçi Takip API Çalışıyor!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'İşçi Takip Backend' });
});

// Kullanıcı endpoints
app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Test Kullanıcı', role: 'worker' },
    { id: 2, name: 'Admin', role: 'admin' }
  ]);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  res.json({ 
    success: true, 
    token: 'demo-token-123',
    user: { id: 1, name: username, role: 'worker' }
  });
});

// Konum endpoints
app.post('/api/location', (req, res) => {
  const { latitude, longitude, userId } = req.body;
  res.json({ 
    success: true, 
    message: 'Konum kaydedildi',
    data: { latitude, longitude, userId, timestamp: new Date() }
  });
});

app.get('/api/locations/:userId', (req, res) => {
  const { userId } = req.params;
  res.json([
    { 
      id: 1, 
      userId, 
      latitude: 41.0082, 
      longitude: 28.9784, 
      timestamp: new Date() 
    }
  ]);
});

// Çalışma saatleri
app.post('/api/checkin', (req, res) => {
  const { userId } = req.body;
  res.json({ 
    success: true, 
    message: 'Giriş kaydedildi',
    checkinTime: new Date()
  });
});

app.post('/api/checkout', (req, res) => {
  const { userId } = req.body;
  res.json({ 
    success: true, 
    message: 'Çıkış kaydedildi',
    checkoutTime: new Date()
  });
});

module.exports.handler = serverless(app);
