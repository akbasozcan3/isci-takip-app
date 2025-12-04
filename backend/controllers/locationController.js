// Location Tracking Controller
const db = require('../config/database');
const locationService = require('../services/locationService');
const locationBatchService = require('../services/locationBatchService');
const validationService = require('../services/validationService');
const cacheService = require('../core/services/advancedCache.service');
const SubscriptionModel = require('../core/database/models/subscription.model');
const smartTrackingService = require('../services/smartTrackingService');
const locationAnalytics = require('../core/services/locationAnalytics.service');
const { createLogger } = require('../core/utils/logger');
const ResponseFormatter = require('../core/utils/responseFormatter');

const logger = createLogger('LocationController');

const DEFAULT_ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function getPlanBasedLocationLimits(planId) {
  const limits = SubscriptionModel.getPlanLimits(planId);
  return {
    maxLocationsPerDevice: planId === 'business' ? 50000 : (planId === 'plus' ? 20000 : 10000),
    maxHistoryLimit: planId === 'business' ? 10000 : (planId === 'plus' ? 2000 : 500),
    cacheEnabled: planId !== 'free',
    cacheTTL: limits.cacheTTL || 60000
  };
}

class LocationController {
  // Store location data (optimized with batch processing)
  async storeLocation(req, res) {
    try {
      const { deviceId, coords, timestamp, workerId, name, phone } = req.body || {};
      
      const finalDeviceId = deviceId || workerId;
      
      const validation = validationService.validateLocationData({
        deviceId: finalDeviceId,
        coords,
        timestamp: timestamp || Date.now()
      });

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const lat = parseFloat(coords.latitude);
      const lng = parseFloat(coords.longitude);
      
      if (!isFinite(lat) || !isFinite(lng)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      const locationData = {
        timestamp: timestamp || Date.now(),
        coords: {
          latitude: lat,
          longitude: lng,
          accuracy: coords.accuracy ? parseFloat(coords.accuracy) : null,
          heading: coords.heading ? parseFloat(coords.heading) : null,
          speed: coords.speed ? parseFloat(coords.speed) : null
        },
        metadata: {
          name: name || null,
          phone: phone || null
        }
      };

      locationBatchService.addToBatch(finalDeviceId, locationData);

      const user = db.findUserById(finalDeviceId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const locationLimits = getPlanBasedLocationLimits(planId);
      
      const existingLocations = db.getStore(finalDeviceId);
      if (existingLocations.length > locationLimits.maxLocationsPerDevice) {
        const toKeep = existingLocations.slice(-locationLimits.maxLocationsPerDevice + 100);
        db.data.store[finalDeviceId] = toKeep;
        db.scheduleSave();
      }
      
      if (locationLimits.cacheEnabled) {
        cacheService.delete(`location:${finalDeviceId}:latest`);
        cacheService.delete(`location:${finalDeviceId}:history`);
      }

      const quality = locationAnalytics.getLocationQuality(finalDeviceId);
      
      return res.json(ResponseFormatter.success({
        timestamp: locationData.timestamp,
        queueSize: locationBatchService.getQueueSize(finalDeviceId),
        quality
      }, 'Location queued successfully'));
    } catch (error) {
      console.error('Store location error:', error);
      return res.status(500).json({ error: 'Failed to store location' });
    }
  }

  // Get location history for a device
  async getLocationHistory(req, res) {
    try {
      const { deviceId } = req.params;
      const { limit: reqLimit, offset = 0 } = req.query;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const user = db.findUserById(deviceId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const locationLimits = getPlanBasedLocationLimits(planId);
      
      const maxLimit = locationLimits.maxHistoryLimit;
      const limit = Math.min(maxLimit, parseInt(reqLimit || maxLimit));
      
      const cacheKey = `location:${deviceId}:history:${limit}:${offset}`;
      
      if (locationLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
          return res.json({
            ...cached,
            cached: true,
            planId
          });
        }
      }

      const locations = db.getStore(deviceId);
      const total = locations.length;
      
      // Apply pagination
      const startIndex = parseInt(offset);
      const endIndex = startIndex + limit;
      const paginatedLocations = locations.slice(startIndex, endIndex);

      const response = {
        locations: paginatedLocations,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: endIndex < total
        },
        planId,
        performance: {
          cacheEnabled: locationLimits.cacheEnabled,
          maxLimit: locationLimits.maxHistoryLimit
        }
      };

      if (locationLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, locationLimits.cacheTTL, user?.id);
      }

      return res.json(response);
    } catch (error) {
      console.error('Get location history error:', error);
      return res.status(500).json({ error: 'Failed to get location history' });
    }
  }

  // Get recent locations (last N entries) for a device
  async getRecentLocations(req, res) {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const limit = Math.max(1, Math.min(2000, parseInt(req.query.limit || '100', 10)));
      const locations = db.getStore(deviceId);
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.json([]);
      }

      const startIndex = Math.max(0, locations.length - limit);
      const recent = locations.slice(startIndex);
      return res.json(recent);
    } catch (error) {
      console.error('Get recent locations error:', error);
      return res.status(500).json({ error: 'Failed to get recent locations' });
    }
  }

  // Get latest location for a device
  async getLatestLocation(req, res) {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const locations = db.getStore(deviceId);
      if (locations.length === 0) {
        return res.status(404).json({ error: 'No location data found' });
      }

      const latestLocation = locations[locations.length - 1];
      return res.json(latestLocation);
    } catch (error) {
      console.error('Get latest location error:', error);
      return res.status(500).json({ error: 'Failed to get latest location' });
    }
  }

  // Get all devices with their latest locations
  async getAllDevices(req, res) {
    try {
      const devices = [];
      const store = db.data.store;
      
      for (const deviceId in store) {
        const locations = store[deviceId];
        if (locations.length > 0) {
          const latestLocation = locations[locations.length - 1];
          devices.push({
            deviceId,
            latestLocation,
            totalLocations: locations.length,
            lastUpdate: latestLocation.timestamp
          });
        }
      }

      return res.json({ devices });
    } catch (error) {
      console.error('Get all devices error:', error);
      return res.status(500).json({ error: 'Failed to get devices' });
    }
  }

  // Get latest snapshot for every device (used by mobile dashboards)
  async getLatestLocations(req, res) {
    try {
      const store = db.data.store || {};
      const items = Object.entries(store)
        .map(([workerId, locations]) => {
          if (!Array.isArray(locations) || locations.length === 0) {
            return null;
          }
          const last = locations[locations.length - 1];
          return { workerId, last };
        })
        .filter(Boolean);

      return res.json({
        count: items.length,
        items
      });
    } catch (error) {
      console.error('Get latest locations error:', error);
      return res.status(500).json({ error: 'Failed to get latest locations' });
    }
  }

  // Delete location data for a device
  async deleteLocationData(req, res) {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      delete db.data.store[deviceId];
      db.scheduleSave();

      return res.json({ 
        success: true, 
        message: 'Location data deleted successfully' 
      });
    } catch (error) {
      console.error('Delete location data error:', error);
      return res.status(500).json({ error: 'Failed to delete location data' });
    }
  }

  // Active devices within time window (searchable)
  async getActiveDevices(req, res) {
    try {
      const sinceMsParam = parseInt(req.query.sinceMs || '', 10);
      const windowMs = Number.isFinite(sinceMsParam) && sinceMsParam > 0 ? sinceMsParam : DEFAULT_ACTIVE_WINDOW_MS;
      const cutoff = Date.now() - windowMs;
      const query = String(req.query.q || '').trim().toLowerCase();

      const items = [];
      const store = db.data.store || {};

      for (const [workerId, locations] of Object.entries(store)) {
        if (!Array.isArray(locations) || locations.length === 0) continue;
        const last = locations[locations.length - 1];
        if (!last || typeof last.timestamp !== 'number' || last.timestamp < cutoff) continue;

        const user = db.findUserById(workerId);
        const name = user?.displayName || user?.name || null;
        const phone = user?.phone || null;

        const matchesQuery =
          !query ||
          workerId.toLowerCase().includes(query) ||
          (name && name.toLowerCase().includes(query)) ||
          (phone && phone.toLowerCase().includes(query));

        if (!matchesQuery) continue;

        items.push({
          workerId,
          name,
          phone,
          lastSeen: last.timestamp,
          coords: {
            latitude: last.coords?.latitude ?? null,
            longitude: last.coords?.longitude ?? null,
            accuracy: last.coords?.accuracy ?? null,
            heading: last.coords?.heading ?? null,
            speed: last.coords?.speed ?? null,
          },
        });
      }

      return res.json({
        count: items.length,
        items,
      });
    } catch (error) {
      console.error('Get active devices error:', error);
      return res.status(500).json({ error: 'Failed to get active devices' });
    }
  }

  async getLocationStats(req, res) {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const stats = locationService.getLocationStats(deviceId);
      const user = db.findUserById(deviceId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const recommendations = smartTrackingService.getTrackingRecommendations(deviceId, planId);
      const routeMetrics = locationAnalytics.calculateRouteMetrics(deviceId);
      const speedZones = locationAnalytics.calculateSpeedZones(deviceId);
      const quality = locationAnalytics.getLocationQuality(deviceId);
      const prediction = locationAnalytics.predictNextLocation(deviceId);
      
      return res.json(ResponseFormatter.success({
        deviceId,
        ...stats,
        routeMetrics,
        speedZones,
        quality,
        prediction,
        smartTracking: recommendations,
        planId
      }));
    } catch (error) {
      console.error('Get location stats error:', error);
      return res.status(500).json({ error: 'Failed to get location statistics' });
    }
  }

  async getRouteOptimized(req, res) {
    try {
      const { deviceId } = req.params;
      const { minDistance = 5 } = req.query;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const locations = db.getStore(deviceId);
      const optimized = locationService.optimizeRoute(locations, Number(minDistance));
      
      return res.json({
        deviceId,
        originalCount: locations.length,
        optimizedCount: optimized.length,
        locations: optimized
      });
    } catch (error) {
      console.error('Get optimized route error:', error);
      return res.status(500).json({ error: 'Failed to optimize route' });
    }
  }

  async checkGeofence(req, res) {
    try {
      const { deviceId } = req.params;
      const { centerLat, centerLng, radiusMeters } = req.query;
      
      if (!deviceId || !centerLat || !centerLng || !radiusMeters) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const locations = db.getStore(deviceId);
      if (locations.length === 0) {
        return res.json({ inside: false, distance: null });
      }

      const last = locations[locations.length - 1];
      const lat = parseFloat(centerLat);
      const lng = parseFloat(centerLng);
      const radius = parseFloat(radiusMeters);

      const inside = locationService.checkGeofence(
        last.coords.latitude,
        last.coords.longitude,
        lat,
        lng,
        radius
      );

      const distance = locationService.haversineDistance(
        last.coords.latitude,
        last.coords.longitude,
        lat,
        lng
      );

      return res.json({ inside, distance });
    } catch (error) {
      console.error('Geofence check error:', error);
      return res.status(500).json({ error: 'Failed to check geofence' });
    }
  }

  async getTrackingRecommendations(req, res) {
    try {
      const { deviceId } = req.params;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const user = db.findUserById(deviceId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      
      const recommendations = smartTrackingService.getTrackingRecommendations(deviceId, planId);
      
      return res.json(ResponseFormatter.success({
        deviceId,
        planId,
        ...recommendations
      }));
    } catch (error) {
      logger.error('Get tracking recommendations error', error);
      return res.status(500).json({ error: 'Failed to get tracking recommendations' });
    }
  }

  async getLocationAnalytics(req, res) {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const routeMetrics = locationAnalytics.calculateRouteMetrics(deviceId);
      const speedZones = locationAnalytics.calculateSpeedZones(deviceId);
      const quality = locationAnalytics.getLocationQuality(deviceId);
      const heatmap = locationAnalytics.getLocationHeatmap(deviceId, 0.01);

      return res.json(ResponseFormatter.success({
        deviceId,
        routeMetrics,
        speedZones,
        quality,
        heatmap: heatmap.slice(0, 100)
      }));
    } catch (error) {
      logger.error('Get location analytics error', error);
      return res.status(500).json({ error: 'Failed to get location analytics' });
    }
  }

  async getRouteMetrics(req, res) {
    try {
      const { deviceId } = req.params;
      const { startTime, endTime } = req.query;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const start = startTime ? parseInt(startTime) : null;
      const end = endTime ? parseInt(endTime) : null;
      const metrics = locationAnalytics.calculateRouteMetrics(deviceId, start, end);

      return res.json(ResponseFormatter.success({
        deviceId,
        ...metrics
      }));
    } catch (error) {
      logger.error('Get route metrics error', error);
      return res.status(500).json({ error: 'Failed to get route metrics' });
    }
  }

  async getLocationQuality(req, res) {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const quality = locationAnalytics.getLocationQuality(deviceId);

      return res.json(ResponseFormatter.success({
        deviceId,
        ...quality
      }));
    } catch (error) {
      logger.error('Get location quality error', error);
      return res.status(500).json({ error: 'Failed to get location quality' });
    }
  }

  async getLocationPrediction(req, res) {
    try {
      const { deviceId } = req.params;
      const { lookbackMinutes = 5 } = req.query;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }

      const prediction = locationAnalytics.predictNextLocation(deviceId, parseInt(lookbackMinutes));

      return res.json(ResponseFormatter.success({
        deviceId,
        prediction
      }));
    } catch (error) {
      logger.error('Get location prediction error', error);
      return res.status(500).json({ error: 'Failed to get location prediction' });
    }
  }
}

module.exports = new LocationController();
