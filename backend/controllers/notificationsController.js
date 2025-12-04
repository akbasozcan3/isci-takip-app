const db = require('../config/database');
const emailService = require('../services/emailService');

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

  async notifyUser(req, res) {
    const payload = { to: req.body.to, subject: req.body.subject, body: req.body.body };
    try {
      const result = await emailService.sendEmail(payload);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  async sendPush(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.status(401).json({ error: 'Geçersiz token' });

      const { userIds, segments, title, message, data, deepLink, url, imageUrl } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: 'title ve message zorunludur' });
      }

      const onesignalService = require('../services/onesignalService');
      
      const result = await onesignalService.sendNotification({
        userIds: userIds || [],
        segments: segments || [],
        title,
        message,
        data: data || {},
        deepLink: deepLink || null,
        url: url || null,
        imageUrl: imageUrl || null
      });

      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('notifications.sendPush error:', error);
      res.status(500).json({ error: 'Bildirim gönderilemedi' });
    }
  }
}

module.exports = new NotificationsController();


