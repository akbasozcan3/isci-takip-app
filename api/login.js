export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { username, password } = req.body;
    
    // Demo login - gerçek projede database kontrolü yapılır
    if (username && password) {
      res.status(200).json({
        success: true,
        token: 'demo-token-' + Date.now(),
        user: {
          id: 1,
          name: username,
          role: 'worker',
          email: username + '@company.com'
        },
        message: 'Giriş başarılı'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Kullanıcı adı ve şifre gerekli'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
