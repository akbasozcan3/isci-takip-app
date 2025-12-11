const db = require('../config/database');
const ResponseFormatter = require('../core/utils/responseFormatter');
const activityLogService = require('../services/activityLogService');

class UIController {
  async updateUIPreference(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(ResponseFormatter.error('Kimlik doğrulaması gerekli', 'AUTH_REQUIRED'));
      }

      const { preference, value } = req.body;
      if (!preference) {
        return res.status(400).json(ResponseFormatter.error('Preference gerekli', 'INVALID_INPUT'));
      }

      const user = db.findUserById(userId);
      if (!user) {
        return res.status(404).json(ResponseFormatter.error('Kullanıcı bulunamadı', 'USER_NOT_FOUND'));
      }

      if (!user.uiPreferences) {
        user.uiPreferences = {};
      }

      user.uiPreferences[preference] = value;
      db.scheduleSave();

      activityLogService.logActivity(userId, 'ui', 'update_preference', {
        preference,
        value,
        path: req.path
      });

      return res.json(ResponseFormatter.success({ 
        preference, 
        value,
        message: 'UI tercihi güncellendi'
      }));
    } catch (error) {
      console.error('[UIController] Update UI preference error:', error);
      return res.status(500).json(ResponseFormatter.error('UI tercihi güncellenemedi', 'UPDATE_ERROR'));
    }
  }
}

module.exports = new UIController();
