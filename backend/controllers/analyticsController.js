const analyticsService = require('../services/analyticsService');
const db = require('../config/database');
const SubscriptionModel = require('../core/database/models/subscription.model');
const activityLogService = require('../services/activityLogService');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { logger } = require('../core/utils/logger');

function resolveUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const TokenModel = require('../core/database/models/token.model');
  const tokenData = TokenModel.get(token);
  if (!tokenData) return null;
  return db.findUserById(tokenData.userId) || null;
}

class AnalyticsController {
  async getDailyStats(req, res) {
    try {
      const { deviceId } = req.params;
      const { date } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const user = resolveUser(req);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';

      const targetDate = date || new Date().toISOString().split('T')[0];
      const stats = analyticsService.getDailyStats(deviceId, targetDate);

      if (user) {
        activityLogService.logActivity(user.id, 'analytics', 'view_daily_stats', {
          deviceId,
          date: targetDate,
          planId,
          path: req.path
        });
      }

      return res.json(ResponseFormatter.success(stats));
    } catch (error) {
      return res.status(500).json(ResponseFormatter.error('Günlük istatistikler alınamadı', 'ANALYTICS_ERROR'));
    }
  }

  async getWeeklyStats(req, res) {
    try {
      const { deviceId } = req.params;
      const { weekStart } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const user = resolveUser(req);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';

      const weekStartDate = weekStart || new Date().toISOString().split('T')[0];
      const stats = analyticsService.getWeeklyStats(deviceId, weekStartDate);

      if (user) {
        activityLogService.logActivity(user.id, 'analytics', 'view_weekly_stats', {
          deviceId,
          weekStart: weekStartDate,
          planId,
          path: req.path
        });
      }

      return res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error('Get weekly stats error', error);
      return res.status(500).json(ResponseFormatter.error('Haftalık istatistikler alınamadı', 'ANALYTICS_ERROR'));
    }
  }

  async getMonthlyStats(req, res) {
    try {
      const { deviceId } = req.params;
      const { year, month } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const user = resolveUser(req);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';

      const currentDate = new Date();
      const targetYear = year ? parseInt(year) : currentDate.getFullYear();
      const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

      const stats = analyticsService.getMonthlyStats(deviceId, targetYear, targetMonth);

      if (user) {
        activityLogService.logActivity(user.id, 'analytics', 'view_monthly_stats', {
          deviceId,
          year: targetYear,
          month: targetMonth,
          planId,
          path: req.path
        });
      }

      return res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error('Get monthly stats error', error);
      return res.status(500).json(ResponseFormatter.error('Aylık istatistikler alınamadı', 'ANALYTICS_ERROR'));
    }
  }

  async getHeatmapData(req, res) {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const user = resolveUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(user.id);
      const planId = subscription?.planId || 'free';

      if (planId === 'free') {
        return res.status(403).json({
          error: 'Heatmap analytics requires premium subscription',
          code: 'PREMIUM_REQUIRED',
          currentPlan: planId
        });
      }

      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = endDate || new Date().toISOString();

      const heatmap = analyticsService.getHeatmapData(deviceId, start, end);

      activityLogService.logActivity(user.id, 'analytics', 'view_heatmap', {
        deviceId,
        startDate: start,
        endDate: end,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(heatmap));
    } catch (error) {
      logger.error('Get heatmap data error', error);
      return res.status(500).json(ResponseFormatter.error('Heatmap verileri alınamadı', 'ANALYTICS_ERROR'));
    }
  }

  async getSpeedAnalysis(req, res) {
    try {
      const { deviceId } = req.params;
      const { timeWindow } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const user = resolveUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(user.id);
      const planId = subscription?.planId || 'free';

      if (planId === 'free') {
        return res.status(403).json({
          error: 'Speed analysis requires premium subscription',
          code: 'PREMIUM_REQUIRED',
          currentPlan: planId
        });
      }

      const timeWindowMs = timeWindow ? parseInt(timeWindow) : 3600000;
      const analysis = analyticsService.getSpeedAnalysis(deviceId, timeWindowMs);

      activityLogService.logActivity(user.id, 'analytics', 'view_speed_analysis', {
        deviceId,
        timeWindow: timeWindowMs,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(analysis));
    } catch (error) {
      logger.error('Get speed analysis error', error);
      return res.status(500).json(ResponseFormatter.error('Hız analizi alınamadı', 'ANALYTICS_ERROR'));
    }
  }
}

module.exports = new AnalyticsController();

