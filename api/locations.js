// Demo location storage (in-memory)
let store = {}; // { workerId: [ { timestamp, coords } ] }

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (!payload || !payload.workerId || !payload.coords) {
      return res.status(400).json({ error: 'invalid payload' });
    }

    const id = payload.workerId;
    if (!store[id]) store[id] = [];

    const entry = {
      timestamp: Date.now(),
      coords: payload.coords,
      accuracy: payload.accuracy || 10,
      heading: payload.heading || 0
    };

    store[id].push(entry);

    // Keep only last 1000 entries per worker
    if (store[id].length > 1000) {
      store[id] = store[id].slice(-1000);
    }

    res.json({ ok: true, stored: entry });

  } else if (req.method === 'GET') {
    const { workerId } = req.query;
    
    if (workerId) {
      // Get locations for specific worker
      res.json(store[workerId] || []);
    } else {
      // Get latest location for all workers
      const result = [];
      for (const id of Object.keys(store)) {
        const arr = store[id];
        if (arr && arr.length > 0) {
          const latest = arr[arr.length - 1];
          result.push({ workerId: id, ...latest });
        }
      }
      res.json(result);
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
