// Demo users database
const users = {
  'admin@test.com': { password: '123456', id: '1', name: 'Admin User', role: 'admin' },
  'worker@test.com': { password: '123456', id: '2', name: 'İşçi User', role: 'worker' },
  'test': { password: 'test', id: '3', name: 'Test User', role: 'worker' }
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { email, password, username } = req.body;
    const loginKey = email || username;
    
    // Demo login kontrolü
    const user = users[loginKey];
    if (user && user.password === password) {
      const token = generateId() + generateId();
      
      res.status(200).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: loginKey.includes('@') ? loginKey : `${loginKey}@company.com`,
          role: user.role,
          createdAt: Date.now()
        }
      });
    } else {
      res.status(400).json({ 
        error: 'invalid credentials',
        message: 'Geçersiz kullanıcı adı veya şifre'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
