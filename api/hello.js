module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    message: 'Hello from Vercel API! 🚀',
    timestamp: new Date().toISOString(),
    method: req.method
  });
};
