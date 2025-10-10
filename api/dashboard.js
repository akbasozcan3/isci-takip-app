export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const { userId } = req.query;
    const now = Date.now();
    
    // Demo dashboard data
    const dashboardData = {
      userId,
      timestamp: now,
      stats: {
        totalWorkers: 15,
        activeWorkers: 8,
        onlineWorkers: 5,
        totalGroups: 3,
        activeGroups: 2
      },
      recentActivity: [
        {
          id: '1',
          type: 'location_update',
          userId: 'worker1',
          userName: 'Ahmet Yılmaz',
          message: 'Konum güncellendi',
          timestamp: now - 300000,
          location: { lat: 41.0082, lng: 28.9784 }
        },
        {
          id: '2',
          type: 'checkin',
          userId: 'worker2',
          userName: 'Mehmet Demir',
          message: 'İşe giriş yaptı',
          timestamp: now - 600000
        },
        {
          id: '3',
          type: 'group_join',
          userId: 'worker3',
          userName: 'Fatma Kaya',
          message: 'Gruba katıldı',
          timestamp: now - 900000,
          groupName: 'Saha Ekibi A'
        }
      ],
      activeLocations: [
        {
          workerId: 'worker1',
          workerName: 'Ahmet Yılmaz',
          lat: 41.0082,
          lng: 28.9784,
          accuracy: 10,
          timestamp: now - 120000,
          isActive: true
        },
        {
          workerId: 'worker2',
          workerName: 'Mehmet Demir',
          lat: 41.0085,
          lng: 28.9790,
          accuracy: 15,
          timestamp: now - 180000,
          isActive: true
        }
      ],
      workingHours: {
        today: {
          totalHours: 6.5,
          checkedInWorkers: 5,
          averageWorkTime: 7.2
        },
        thisWeek: {
          totalHours: 45.5,
          averageDaily: 6.5,
          productivity: 85
        }
      }
    };

    res.json(dashboardData);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
