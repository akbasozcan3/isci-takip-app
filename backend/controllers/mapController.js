const db = require('../config/database');
const SubscriptionModel = require('../core/database/models/subscription.model');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');
const activityLogService = require('../services/activityLogService');

class MapController {
  async getMapFeatures(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';
      const limits = SubscriptionModel.getPlanLimits(planId);

      const features = {
        realtimeTracking: limits.realtimeTracking || false,
        advancedLayers: planId !== 'free',
        satelliteView: planId !== 'free',
        topographicView: planId === 'business',
        exportMap: planId !== 'free',
        multipleGroups: planId !== 'free',
        geofencing: planId !== 'free',
        routeOptimization: planId === 'business',
        heatmap: planId === 'business',
        customMarkers: planId !== 'free',
        maxZoom: planId === 'business' ? 20 : (planId === 'plus' ? 19 : 18),
        maxMarkers: planId === 'business' ? -1 : (planId === 'plus' ? 100 : 20),
        maxRoutes: limits.maxRoutes || 20
      };

      activityLogService.logActivity(userId, 'map', 'view_features', {
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(features));
    } catch (error) {
      console.error('getMapFeatures error:', error);
      return res.status(500).json({ error: 'Failed to get map features' });
    }
  }

  async exportMap(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';

      if (planId === 'free') {
        return res.status(403).json({
          error: 'Map export requires premium subscription',
          code: 'PREMIUM_REQUIRED',
          currentPlan: planId
        });
      }

      const { bounds, format = 'png', markers, routes } = req.body || {};

      activityLogService.logActivity(userId, 'map', 'export_map', {
        planId,
        format,
        markerCount: markers?.length || 0,
        routeCount: routes?.length || 0
      });

      return res.json(ResponseFormatter.success({
        message: 'Map export initiated',
        exportId: `export_${Date.now()}`,
        format,
        estimatedTime: '30s'
      }));
    } catch (error) {
      console.error('exportMap error:', error);
      return res.status(500).json({ error: 'Failed to export map' });
    }
  }

  async getMapLayers(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = db.getUserSubscription(userId);
      const planId = subscription?.planId || 'free';

      const layers = {
        standard: {
          name: 'OpenStreetMap',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          available: true
        },
        dark: {
          name: 'Koyu Tema',
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          available: planId !== 'free'
        },
        satellite: {
          name: 'Uydu',
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          available: planId !== 'free'
        },
        topographic: {
          name: 'Topografik',
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          available: planId === 'business'
        }
      };

      activityLogService.logActivity(userId, 'map', 'view_layers', {
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(layers));
    } catch (error) {
      console.error('getMapLayers error:', error);
      return res.status(500).json({ error: 'Failed to get map layers' });
    }
  }
}

module.exports = new MapController();

