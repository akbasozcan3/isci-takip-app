const db = require('../config/database');
const emailService = require('../services/emailService');
const activityLogService = require('../services/activityLogService');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { logger } = require('../core/utils/logger');

class NotificationsController {
  async list(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.status(401).json({ error: 'Geçersiz token' });
      const userId = tokenData.userId;
      const items = db.getNotifications(userId);
      
      activityLogService.logActivity(userId, 'notification', 'view_notifications', {
        count: items.length,
        path: req.path
      });
      
      return res.json(ResponseFormatter.success(items));
    } catch (e) {
      return res.status(500).json(ResponseFormatter.error('Bildirimler yüklenemedi', 'NOTIFICATION_ERROR'));
    }
  }
  async markAllRead(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.status(401).json({ error: 'Geçersiz token' });
      const userId = tokenData.userId;
      db.markAllNotificationsRead(userId);
      
      activityLogService.logActivity(userId, 'notification', 'mark_all_read', {
        path: req.path
      });
      
      return res.json(ResponseFormatter.success(null, 'Tüm bildirimler okundu olarak işaretlendi'));
    } catch (e) {
      logger.error('notifications.markAllRead error', e);
      return res.status(500).json(ResponseFormatter.error('İşlem başarısız', 'NOTIFICATION_ERROR'));
    }
  }

  async markRead(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) return res.status(401).json({ error: 'Geçersiz token' });
      const userId = tokenData.userId;
      const { id } = req.params;
      db.markNotificationRead(userId, id);
      
      activityLogService.logActivity(userId, 'notification', 'mark_read', {
        notificationId: id,
        path: req.path
      });
      
      return res.json(ResponseFormatter.success(null, 'Bildirim okundu olarak işaretlendi'));
    } catch (e) {
      logger.error('notifications.markRead error', e);
      return res.status(500).json(ResponseFormatter.error('İşlem başarısız', 'NOTIFICATION_ERROR'));
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

      const { userIds, playerIds, segments, title, message, data, deepLink, url, imageUrl } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: 'title ve message zorunludur' });
      }

      if (!userIds?.length && !playerIds?.length && !segments?.length) {
        return res.status(400).json({ error: 'userIds, playerIds veya segments gerekli' });
      }

      const onesignalService = require('../services/onesignalService');
      
      const result = await onesignalService.sendNotification({
        userIds: userIds || [],
        playerIds: playerIds || [],
        segments: segments || [],
        title,
        message,
        data: data || {},
        deepLink: deepLink || null,
        url: url || null,
        imageUrl: imageUrl || null
      });

      const userId = tokenData.userId;
      
      activityLogService.logActivity(userId, 'notification', 'send_push', {
        targetUserIds: userIds?.length || 0,
        playerIds: playerIds?.length || 0,
        segments: segments?.length || 0,
        path: req.path
      });
      
      if (result.success) {
        res.json(ResponseFormatter.success({
          notificationId: result.data?.id,
          recipients: result.data?.recipients,
          ...result.data
        }, 'Bildirim başarıyla gönderildi'));
      } else {
        res.status(500).json(ResponseFormatter.error(result.error || 'Bildirim gönderilemedi', 'NOTIFICATION_SEND_ERROR'));
      }
    } catch (error) {
      logger.error('notifications.sendPush error', error);
      res.status(500).json(ResponseFormatter.error('Bildirim gönderilemedi', 'NOTIFICATION_SEND_ERROR', { message: error.message }));
    }
  }

  async testOneSignal(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');
      if (!tokenData) {
        return res.status(401).json({ error: 'Geçersiz token' });
      }

      const userId = tokenData.userId;
      const { playerId } = req.body; // Optional: client can send playerId for more reliable delivery
      
      const onesignalService = require('../services/onesignalService');
      
      // Try playerId first (most reliable), fallback to external_user_id
      let testResult;
      if (playerId) {
        logger.info('Testing OneSignal with playerId', { playerId });
        testResult = await onesignalService.sendToPlayer(
          playerId,
          '🧪 OneSignal Test Bildirimi',
          'OneSignal servisi aktif ve çalışıyor!',
          {
            data: {
              type: 'test',
              timestamp: Date.now()
            },
            deepLink: 'bavaxe://test'
          }
        );
      } else {
        logger.info('Testing OneSignal with external_user_id', { userId });
        testResult = await onesignalService.sendToUser(
          userId,
          '🧪 OneSignal Test Bildirimi',
          'OneSignal servisi aktif ve çalışıyor!',
          {
            data: {
              type: 'test',
              timestamp: Date.now()
            },
            deepLink: 'bavaxe://test'
          }
        );
      }

      activityLogService.logActivity(userId, 'notification', 'test_onesignal', {
        success: testResult.success,
        playerId: playerId || null,
        path: req.path
      });

      if (testResult.success) {
        return res.json(ResponseFormatter.success({
          notificationId: testResult.data?.id,
          recipients: testResult.data?.recipients,
          ...testResult.data,
          note: playerId 
            ? 'Notification sent using playerId (most reliable)' 
            : 'Notification sent using external_user_id. For better delivery, use playerId from client.'
        }, 'OneSignal test bildirimi gönderildi'));
      } else {
        return res.status(500).json(ResponseFormatter.error(
          testResult.error || 'OneSignal test başarısız',
          'ONESIGNAL_TEST_ERROR',
          testResult.data
        ));
      }
    } catch (error) {
      logger.error('notifications.testOneSignal error', error);
      return res.status(500).json(ResponseFormatter.error('OneSignal test hatası', 'ONESIGNAL_TEST_ERROR', { message: error.message }));
    }
  }

  async getOneSignalStatus(req, res) {
    try {
      const onesignalService = require('../services/onesignalService');
      const status = onesignalService.getStatus();
      
      // Test API key if service is enabled
      let apiKeyTest = null;
      if (status.enabled && status.apiKeyConfigured) {
        try {
          apiKeyTest = await onesignalService.testApiKey();
        } catch (error) {
          apiKeyTest = { success: false, error: error.message };
        }
      }
      
      return res.json(ResponseFormatter.success({
        ...status,
        apiKeyTest: apiKeyTest,
        timestamp: Date.now()
      }));
    } catch (error) {
      logger.error('notifications.getOneSignalStatus error', error);
      return res.status(500).json(ResponseFormatter.error('OneSignal durumu alınamadı', 'ONESIGNAL_STATUS_ERROR'));
    }
  }
}

module.exports = new NotificationsController();


