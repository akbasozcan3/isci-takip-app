const db = require('../config/database');

class NotificationsController {
  async list(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.status(401).json({ error: 'Geçersiz token' });
      const userId = tokenData.userId;
      const items = db.getNotifications(userId);
      return res.json(items);
    } catch (e) {
      console.error('notifications.list error:', e);
      return res.json([]);
    }
  }
  async markAllRead(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.status(401).json({ error: 'Geçersiz token' });
      db.markAllNotificationsRead(tokenData.userId);
      return res.json({ success: true });
    } catch (e) {
      console.error('notifications.markAllRead error:', e);
      return res.status(500).json({ error: 'İşlem başarısız' });
    }
  }

  async markRead(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.status(401).json({ error: 'Geçersiz token' });
      const { id } = req.params;
      db.markNotificationRead(tokenData.userId, id);
      return res.json({ success: true });
    } catch (e) {
      console.error('notifications.markRead error:', e);
      return res.status(500).json({ error: 'İşlem başarısız' });
    }
  }
}

module.exports = new NotificationsController();


