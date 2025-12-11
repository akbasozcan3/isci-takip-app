const db = require('../config/database');
const activityLogService = require('../services/activityLogService');

class AdminController {
  resetAllData(req, res) {
    try {
      const configuredToken = (process.env.ADMIN_RESET_TOKEN || '').trim();
      const incomingToken =
        req.headers['x-reset-token'] ||
        req.body?.token ||
        req.query?.token;

      if (!configuredToken) {
        return res.status(501).json({
          error: 'ADMIN_RESET_TOKEN is not configured on the server'
        });
      }

      if (!incomingToken || incomingToken !== configuredToken) {
        return res.status(403).json({ error: 'Yetkisiz istek' });
      }

      const snapshot = db.resetAllData();
      const userCount = Object.keys(snapshot.users || {}).length;

      activityLogService.logActivity('admin', 'admin', 'reset_all_data', {
        userCount,
        path: req.path,
        ip: req.ip || req.connection?.remoteAddress
      });

      return res.json({
        success: true,
        message: 'Tüm kullanıcı ve veri kayıtları sıfırlandı',
        stats: {
          users: userCount,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Admin resetAllData error:', error);
      return res.status(500).json({ error: 'Sıfırlama başarısız' });
    }
  }
}

module.exports = new AdminController();

