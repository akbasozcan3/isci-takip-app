export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { latitude, longitude, userId } = req.body;
    
    res.status(200).json({
      success: true,
      message: 'Konum kaydedildi',
      data: {
        id: Date.now(),
        userId,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
        accuracy: 10
      }
    });
  } else if (req.method === 'GET') {
    // Demo konum verileri
    res.status(200).json([
      {
        id: 1,
        userId: 1,
        latitude: 41.0082,
        longitude: 28.9784,
        timestamp: new Date().toISOString(),
        address: 'İstanbul, Türkiye'
      },
      {
        id: 2,
        userId: 1,
        latitude: 41.0085,
        longitude: 28.9790,
        timestamp: new Date(Date.now() - 300000).toISOString(),
        address: 'İstanbul, Türkiye'
      }
    ]);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
