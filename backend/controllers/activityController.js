const db = require('../config/database');
const activityLogService = require('../services/activityLogService');
const ResponseFormatter = require('../core/utils/responseFormatter');
const SubscriptionModel = require('../core/database/models/subscription.model');

class ActivityController {
  async getActivities(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      const limits = SubscriptionModel.getPlanLimits(planId);

      const limit = Math.min(parseInt(req.query.limit || '50'), planId === 'business' ? 200 : (planId === 'plus' ? 50 : 10));
      const offset = parseInt(req.query.offset || '0');
      const type = req.query.type;

      let activities;
      if (type) {
        activities = activityLogService.getActivitiesByType(type, limit, offset);
      } else {
        activities = activityLogService.getUserActivities(userId, limit, offset);
      }

      activityLogService.logActivity(userId, 'activity', 'view_activities', {
        planId,
        limit,
        offset,
        type: type || 'all'
      });

      return res.json(ResponseFormatter.success({
        activities,
        total: activities.length,
        limit,
        offset,
        hasMore: activities.length === limit
      }));
    } catch (error) {
      console.error('getActivities error:', error);
      return res.status(500).json({ error: 'Failed to get activities' });
    }
  }

  async getActivityStats(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';

      if (planId === 'free') {
        return res.status(403).json({
          error: 'Activity statistics require premium subscription',
          code: 'PREMIUM_REQUIRED',
          currentPlan: planId
        });
      }

      const startDate = req.query.startDate ? parseInt(req.query.startDate) : Date.now() - (30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? parseInt(req.query.endDate) : Date.now();

      const stats = activityLogService.getActivityStats(userId, startDate, endDate);

      activityLogService.logActivity(userId, 'activity', 'view_stats', {
        planId,
        startDate,
        endDate
      });

      return res.json(ResponseFormatter.success(stats));
    } catch (error) {
      console.error('getActivityStats error:', error);
      return res.status(500).json({ error: 'Failed to get activity stats' });
    }
  }

  async getGroupActivities(req, res) {
    try {
      const userId = req.user?.id;
      const { groupId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      const limits = SubscriptionModel.getPlanLimits(planId);

      const limit = Math.min(parseInt(req.query.limit || '50'), planId === 'business' ? 200 : (planId === 'plus' ? 50 : 10));
      const offset = parseInt(req.query.offset || '0');

      const activities = activityLogService.getGroupActivities(groupId, limit, offset);

      activityLogService.logActivity(userId, 'activity', 'view_group_activities', {
        planId,
        groupId,
        limit,
        offset
      });

      return res.json(ResponseFormatter.success({
        activities,
        total: activities.length,
        limit,
        offset,
        hasMore: activities.length === limit
      }));
    } catch (error) {
      console.error('getGroupActivities error:', error);
      return res.status(500).json({ error: 'Failed to get group activities' });
    }
  }
}

module.exports = new ActivityController();

