// Vercel API Route - Backend
export default function handler(req, res) {
  // CORS ayarları
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Ana API endpoint
  if (req.method === 'GET') {
    res.status(200).json({
      message: 'İşçi Takip API Çalışıyor!',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /api/health',
        'GET /api/users',
        'POST /api/login',
        'POST /api/location',
        'GET /api/locations/[userId]',
        'POST /api/checkin',
        'POST /api/checkout'
      ]
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
