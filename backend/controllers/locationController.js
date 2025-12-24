const db = require('../config/database');
const locationService = require('../services/locationService');
const locationBatchService = require('../services/locationBatchService');
const validationService = require('../services/validationService');
const cacheService = require('../core/services/advancedCache.service');
const SubscriptionModel = require('../core/database/models/subscription.model');
const smartTrackingService = require('../services/smartTrackingService');
const locationAnalytics = require('../core/services/locationAnalytics.service');
const notificationService = require('../services/notificationService');
const autoNotificationService = require('../services/autoNotificationService');
const geocodingService = require('../services/geocodingService');
const { logger } = require('../core/utils/logger');
const ResponseFormatter = require('../core/utils/responseFormatter');
const { createError } = require('../core/utils/errorHandler');

const REQUEST_METRICS = new Map();
const ERROR_METRICS = new Map();

function trackRequest(endpoint, planId, duration, success) {
  const key = `${endpoint}:${planId}`;
  if (!REQUEST_METRICS.has(key)) {
    REQUEST_METRICS.set(key, { count: 0, totalDuration: 0, success: 0, errors: 0 });
  }
  const metric = REQUEST_METRICS.get(key);
  metric.count++;
  metric.totalDuration += duration;
  if (success) {
    metric.success++;
  } else {
    metric.errors++;
  }
}

function trackError(endpoint, planId, errorType) {
  const key = `${endpoint}:${planId}:${errorType}`;
  ERROR_METRICS.set(key, (ERROR_METRICS.get(key) || 0) + 1);
}

function getRequestMetrics() {
  const metrics = {};
  for (const [key, value] of REQUEST_METRICS.entries()) {
    metrics[key] = {
      ...value,
      avgDuration: value.totalDuration / value.count,
      successRate: (value.success / value.count) * 100
    };
  }
  return metrics;
}

const DEFAULT_ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function getPlanBasedLocationLimits(planId) {
  const limits = SubscriptionModel.getPlanLimits(planId);
  return {
    maxLocationsPerDevice: planId === 'business' ? 50000 : (planId === 'plus' ? 20000 : 10000),
    maxHistoryLimit: planId === 'business' ? 10000 : (planId === 'plus' ? 2000 : 500),
    cacheEnabled: planId !== 'free',
    cacheTTL: limits.cacheTTL || 60000,
    priorityProcessing: limits.priorityProcessing || false,
    prefetching: limits.prefetching || false,
    parallelProcessing: limits.parallelProcessing || false,
    smartCaching: limits.smartCaching || false,
    responseOptimization: limits.responseOptimization || false,
    queryOptimization: limits.queryOptimization || false,
    backgroundSync: limits.backgroundSync || false,
    realtimeUpdates: limits.realtimeUpdates || false,
    performanceBoost: limits.performanceBoost || 1.0
  };
}

function applyPerformanceOptimization(req, res, planLimits, data) {
  const startTime = Date.now();

  if (planLimits.responseOptimization && data) {
    if (Array.isArray(data)) {
      data = data.map(item => {
        if (item && typeof item === 'object') {
          const optimized = { ...item };
          if (planLimits.performanceBoost > 1.0) {
            if (optimized.timestamp) optimized.timestamp = new Date(optimized.timestamp).toISOString();
            if (optimized.createdAt) optimized.createdAt = new Date(optimized.createdAt).toISOString();
            if (optimized.updatedAt) optimized.updatedAt = new Date(optimized.updatedAt).toISOString();
          }
          return optimized;
        }
        return item;
      });
    } else if (data && typeof data === 'object') {
      const optimized = { ...data };
      if (planLimits.performanceBoost > 1.0) {
        if (optimized.timestamp) optimized.timestamp = new Date(optimized.timestamp).toISOString();
        if (optimized.createdAt) optimized.createdAt = new Date(optimized.createdAt).toISOString();
        if (optimized.updatedAt) optimized.updatedAt = new Date(optimized.updatedAt).toISOString();
      }
      data = optimized;
    }
  }

  const processingTime = Date.now() - startTime;

  if (planLimits.performanceBoost > 1.0) {
    res.setHeader('X-Performance-Boost', planLimits.performanceBoost.toFixed(1));
    res.setHeader('X-Processing-Time', `${processingTime}ms`);
    res.setHeader('X-Cache-Enabled', planLimits.cacheEnabled ? 'true' : 'false');
    res.setHeader('X-Priority-Processing', planLimits.priorityProcessing ? 'true' : 'false');
  }

  return data;
}

async function processWithPlanOptimization(req, res, planLimits, processor, endpoint = 'unknown') {
  const startTime = Date.now();
  const planId = req.user?.subscription?.planId || 'free';
  let success = false;

  if (planLimits.priorityProcessing) {
    res.setHeader('X-Priority', 'high');
    res.setHeader('X-Plan-Level', planId);
  }

  try {
    let result = await processor();
    success = true;

    if (planLimits.responseOptimization) {
      result = applyPerformanceOptimization(req, res, planLimits, result);
    }

    const processingTime = Date.now() - startTime;

    if (planLimits.performanceBoost > 1.0 && result && typeof result === 'object') {
      if (Array.isArray(result)) {
        result = result.map(item => {
          if (item && typeof item === 'object') {
            return {
              ...item,
              _performance: {
                boost: planLimits.performanceBoost,
                cached: planLimits.cacheEnabled,
                priority: planLimits.priorityProcessing,
                planId
              }
            };
          }
          return item;
        });
      } else {
        result._performance = {
          boost: planLimits.performanceBoost,
          cached: planLimits.cacheEnabled,
          priority: planLimits.priorityProcessing,
          processingTime: `${processingTime}ms`,
          planId
        };
      }
    }

    trackRequest(endpoint, planId, processingTime, true);
    logger.info(`[${endpoint}] Processed successfully`, { planId, processingTime, boost: planLimits.performanceBoost });

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    trackRequest(endpoint, planId, processingTime, false);
    trackError(endpoint, planId, error.constructor.name);
    logger.error(`[${endpoint}] Processing failed`, error, { planId, processingTime });
    throw error;
  }
}

function validateCoordinates(lat, lng, fieldName = 'coordinates') {
  if (lat === undefined || lng === undefined) {
    throw createError(`${fieldName} gereklidir`, 400, 'MISSING_COORDINATES');
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (!isFinite(latNum) || !isFinite(lngNum)) {
    throw createError(`Geçersiz ${fieldName} formatı`, 400, 'INVALID_COORDINATES', { lat, lng });
  }

  if (latNum < -90 || latNum > 90) {
    throw createError(`Enlem -90 ile 90 arasında olmalıdır`, 400, 'INVALID_LATITUDE', { lat: latNum });
  }

  if (lngNum < -180 || lngNum > 180) {
    throw createError(`Boylam -180 ile 180 arasında olmalıdır`, 400, 'INVALID_LONGITUDE', { lng: lngNum });
  }

  return { lat: latNum, lng: lngNum };
}

function validatePhoneNumber(phone, fieldName = 'phone') {
  if (!phone || !phone.trim()) {
    throw createError(`${fieldName} gereklidir`, 400, 'MISSING_PHONE');
  }

  const cleanPhone = phone.replace(/\s/g, '');
  const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;

  if (!phoneRegex.test(cleanPhone)) {
    throw createError(`Geçersiz telefon numarası formatı. Türkiye telefon numarası olmalıdır (5XXXXXXXXX)`, 400, 'INVALID_PHONE_FORMAT', {
      phone: cleanPhone,
      example: '5551234567'
    });
  }

  return cleanPhone;
}

function validateName(name, fieldName = 'name', minLength = 2, maxLength = 50) {
  if (!name || !name.trim()) {
    throw createError(`${fieldName} gereklidir`, 400, 'MISSING_NAME');
  }

  const trimmed = name.trim();

  if (trimmed.length < minLength) {
    throw createError(`${fieldName} en az ${minLength} karakter olmalıdır`, 400, 'NAME_TOO_SHORT', {
      minLength,
      current: trimmed.length
    });
  }

  if (trimmed.length > maxLength) {
    throw createError(`${fieldName} en fazla ${maxLength} karakter olabilir`, 400, 'NAME_TOO_LONG', {
      maxLength,
      current: trimmed.length
    });
  }

  return trimmed;
}

function getUserIdFromToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw createError('Token gereklidir', 401, 'MISSING_TOKEN');
  }

  const tokenData = db.getToken(token);
  if (!tokenData) {
    throw createError('Geçersiz token', 401, 'INVALID_TOKEN');
  }

  return tokenData.userId;
}

function getUserPlan(userId) {
  const user = db.findUserById(userId);
  if (!user) {
    return {
      user: null,
      subscription: null,
      planId: 'free',
      planLimits: SubscriptionModel.getPlanLimits('free')
    };
  }

  const subscription = db.getUserSubscription(user.id);
  const planId = subscription?.planId || 'free';
  const planLimits = SubscriptionModel.getPlanLimits(planId);

  return { user, subscription, planId, planLimits };
}

function checkGroupAccess(userId, groupId, requireAdmin = false) {
  if (!groupId) return null;

  const group = db.getGroupById(groupId);
  if (!group) {
    throw createError('Grup bulunamadı', 404, 'GROUP_NOT_FOUND', { groupId });
  }

  const members = db.getMembers(groupId) || [];
  const member = members.find(m => m.userId === userId);

  if (!member) {
    throw createError('Bu grup için yetkiniz yok', 403, 'GROUP_ACCESS_DENIED', { groupId });
  }

  if (requireAdmin && member.role !== 'admin') {
    throw createError('Bu işlem için grup yöneticisi olmanız gerekiyor', 403, 'GROUP_ADMIN_REQUIRED', { groupId });
  }

  return { group, member };
}

class LocationController {
  // Store location data (optimized with batch processing)
  async storeLocation(req, res) {
    const startTime = Date.now();
    try {
      const { deviceId, coords, timestamp, workerId, name, phone } = req.body || {};

      const finalDeviceId = deviceId || workerId;

      const validation = validationService.validateLocationData({
        deviceId: finalDeviceId,
        coords,
        timestamp: timestamp || Date.now()
      });

      if (!validation.valid) {
        return res.status(400).json(ResponseFormatter.error(validation.error, 'VALIDATION_ERROR'));
      }

      if (!coords || typeof coords !== 'object') {
        return res.status(400).json(ResponseFormatter.error('Koordinatlar gereklidir', 'MISSING_COORDINATES'));
      }

      const lat = parseFloat(coords.latitude);
      const lng = parseFloat(coords.longitude);

      if (!isFinite(lat) || !isFinite(lng)) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz koordinat formatı', 'INVALID_COORDINATES'));
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json(ResponseFormatter.error('Koordinatlar geçerli aralıkta değil', 'COORDINATES_OUT_OF_RANGE'));
      }

      const locationActivityService = require('../services/locationActivityService');

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
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      try {
        const geocode = await Promise.race([
          geocodingService.getCityProvince(lat, lng),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        locationData.geocode = geocode;
      } catch (err) {
        logger.warn('Geocoding failed or timed out, continuing without city data', { error: err.message });
      }

      const locationWithActivity = locationActivityService.updateLocationWithActivity(finalDeviceId, locationData);

      if (locationData.geocode) {
        locationWithActivity.geocode = locationData.geocode;
      }

      locationBatchService.addToBatch(finalDeviceId, locationWithActivity);

      const { planId, planLimits: locationLimits } = getUserPlan(finalDeviceId);

      try {
        const userGroups = db.getUserGroups(finalDeviceId);
        if (userGroups && userGroups.length > 0) {
          setImmediate(() => {
            autoNotificationService.notifyLocationUpdate(finalDeviceId, {
              latitude: lat,
              longitude: lng,
              timestamp: locationData.timestamp
            }).catch(err => {
              logger.debug('Location update notification skipped:', err.message);
            });
          });
        }
      } catch (notifError) {
        logger.debug('Location update notification error (non-critical):', notifError.message);
      }

      const existingLocations = db.getStore(finalDeviceId);
      if (existingLocations.length > locationLimits.maxLocationsPerDevice) {
        const toKeep = existingLocations.slice(-locationLimits.maxLocationsPerDevice + 100);
        db.data.store[finalDeviceId] = toKeep;
        db.scheduleSave();
      }

      if (locationLimits.cacheEnabled) {
        cacheService.delete(`location:${finalDeviceId}:latest`);
        cacheService.delete(`location:${finalDeviceId}:history`);
        cacheService.clear(`analytics:${finalDeviceId}:`);
      }

      // 30 km grup mesafe kontrolü (async, hata olsa bile devam et)
      try {
        const groupDistanceService = require('../services/groupDistanceService');
        const userGroups = db.getUserGroups(finalDeviceId);

        // Kullanıcının tüm gruplarında mesafe kontrolü yap
        for (const group of userGroups) {
          groupDistanceService.checkMemberDistance(group.id, finalDeviceId, lat, lng)
            .catch(error => {
              console.error(`[LocationController] Group distance check error for group ${group.id}:`, error);
            });
        }
      } catch (error) {
        console.error('[LocationController] Failed to check group distances:', error);
      }

      const quality = locationAnalytics.getLocationQuality(finalDeviceId);
      const processingTime = Date.now() - startTime;

      trackRequest('storeLocation', planId, processingTime, true);

      const activityLogService = require('../services/activityLogService');
      activityLogService.logActivity(finalDeviceId, 'location', 'store_location', {
        deviceId: finalDeviceId,
        lat: latitude,
        lng: longitude,
        accuracy: accuracy !== undefined ? Number(accuracy) : null,
        planId,
        path: req.path
      });
      logger.info('Location stored successfully', {
        deviceId: finalDeviceId,
        planId,
        processingTime,
        queueSize: locationBatchService.getQueueSize(finalDeviceId)
      });

      return res.json(ResponseFormatter.success({
        timestamp: locationData.timestamp,
        queueSize: locationBatchService.getQueueSize(finalDeviceId),
        quality,
        _performance: {
          boost: locationLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }, 'Location queued successfully'));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('storeLocation', 'unknown', processingTime, false);
      trackError('storeLocation', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Store location validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Store location error', error, {
        processingTime,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });

      const { createError } = require('../core/utils/errorHandler');
      throw createError('Konum kaydedilemedi', 500, 'STORAGE_ERROR', {
        processingTime: `${processingTime}ms`
      });
    }
  }

  async getMetrics(req, res) {
    const startTime = Date.now();
    try {
      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      const cacheKey = `metrics:${userId}`;

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, userId);
        if (cached) {
          return res.json(ResponseFormatter.success({
            ...cached,
            cached: true,
            _performance: {
              boost: planLimits.performanceBoost,
              cached: true,
              planId
            }
          }));
        }
      }

      const metrics = {
        requestMetrics: getRequestMetrics(),
        errorMetrics: Object.fromEntries(ERROR_METRICS),
        cacheStats: {
          size: cacheService.size(),
          hits: cacheService.stats?.hits || 0,
          misses: cacheService.stats?.misses || 0,
          hitRate: cacheService.stats?.hits && cacheService.stats?.misses
            ? (cacheService.stats.hits / (cacheService.stats.hits + cacheService.stats.misses) * 100).toFixed(2) + '%'
            : '0%'
        },
        planLimits: {
          maxFamilyMembers: planLimits.maxFamilyMembers,
          maxDeliveries: planLimits.maxDeliveries,
          maxRoutes: planLimits.maxRoutes,
          maxMessages: planLimits.maxMessages,
          maxSMS: planLimits.maxSMS,
          performanceBoost: planLimits.performanceBoost,
          cacheTTL: planLimits.cacheTTL,
          priorityProcessing: planLimits.priorityProcessing
        },
        planId,
        timestamp: new Date().toISOString()
      };

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        cacheService.set(cacheKey, metrics, planLimits.cacheTTL, userId);
      }

      const processingTime = Date.now() - startTime;
      trackRequest('getMetrics', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'view_metrics', {
        planId,
        processingTime,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        ...metrics,
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getMetrics', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get metrics error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Metrikler alınamadı', 'METRICS_ERROR'));
    }
  }

  async getHealthStatus(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'operational',
          cache: cacheService.size() > 0 ? 'operational' : 'degraded',
          notifications: 'operational',
          analytics: 'operational'
        },
        plan: {
          planId,
          performanceBoost: planLimits.performanceBoost,
          features: {
            realtimeTracking: planLimits.realtimeTracking,
            advancedAnalytics: planLimits.advancedAnalytics,
            priorityProcessing: planLimits.priorityProcessing,
            smartCaching: planLimits.smartCaching
          }
        },
        metrics: {
          cacheSize: cacheService.size(),
          requestCount: REQUEST_METRICS.size,
          errorCount: ERROR_METRICS.size
        }
      };

      activityLogService.logActivity(userId, 'location', 'view_health_status', {
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(health));
    } catch (error) {
      logger.error('Get health status error', error);
      return res.status(500).json(ResponseFormatter.error('Health status alınamadı', 'HEALTH_CHECK_ERROR'));
    }
  }

  async getPerformanceStats(req, res) {
    try {
      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      const stats = {
        planId,
        performanceBoost: planLimits.performanceBoost,
        cacheEnabled: planLimits.cacheEnabled,
        smartCaching: planLimits.smartCaching,
        priorityProcessing: planLimits.priorityProcessing,
        parallelProcessing: planLimits.parallelProcessing,
        queryOptimization: planLimits.queryOptimization,
        responseOptimization: planLimits.responseOptimization,
        cacheTTL: planLimits.cacheTTL,
        maxConcurrentRequests: planLimits.maxConcurrentRequests,
        batchSize: planLimits.batchSize,
        requestMetrics: getRequestMetrics(),
        cacheStats: {
          size: cacheService.size(),
          hits: cacheService.stats?.hits || 0,
          misses: cacheService.stats?.misses || 0
        },
        timestamp: new Date().toISOString()
      };

      activityLogService.logActivity(userId, 'location', 'view_performance_stats', {
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(stats));
    } catch (error) {
      logger.error('Get performance stats error', error);
      return res.status(500).json(ResponseFormatter.error('Performans istatistikleri alınamadı', 'PERFORMANCE_STATS_ERROR'));
    }
  }

  // Get location history for a device
  async getLocationHistory(req, res) {
    try {
      const { deviceId } = req.params;
      const { limit: reqLimit, offset = 0 } = req.query;

      if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
        return res.status(400).json(ResponseFormatter.error('Device ID gereklidir', 'MISSING_DEVICE_ID'));
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

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'view_location_history', {
          deviceId,
          limit,
          offset,
          total,
          planId,
          path: req.path
        });
      }

      return res.json(response);
    } catch (error) {
      logger.error('Get location history error', error, {
        deviceId: req.params.deviceId,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      const { createError } = require('../core/utils/errorHandler');
      throw createError('Konum geçmişi alınamadı', 500, 'LOCATION_HISTORY_ERROR');
    }
  }

  // Get recent locations (last N entries) for a device
  async getRecentLocations(req, res) {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      const limit = Math.max(1, Math.min(2000, parseInt(req.query.limit || '100', 10)));
      const locations = db.getStore(deviceId);
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.json([]);
      }

      const startIndex = Math.max(0, locations.length - limit);
      const recent = locations.slice(startIndex);

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'view_recent_locations', {
          deviceId,
          limit,
          count: recent.length,
          path: req.path
        });
      }

      return res.json(recent);
    } catch (error) {
      console.error('Get recent locations error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Failed to get recent locations', 'LOCATION_FETCH_ERROR')
      );
    }
  }

  // Get latest location for a device
  async getLatestLocation(req, res) {
    try {
      const { deviceId } = req.params;

      if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
        return res.status(400).json(ResponseFormatter.error('Device ID gereklidir', 'MISSING_DEVICE_ID'));
      }

      const locations = db.getStore(deviceId);
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.status(404).json(ResponseFormatter.error('Konum verisi bulunamadı', 'NO_LOCATION_DATA', { deviceId }));
      }

      const locationActivityService = require('../services/locationActivityService');
      const latestLocation = locations[locations.length - 1];
      const activity = locationActivityService.getActivityForLocation(deviceId, latestLocation);

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'view_latest_location', {
          deviceId,
          path: req.path
        });
      }

      return res.json(ResponseFormatter.success({
        ...latestLocation,
        activity: activity
      }));
    } catch (error) {
      logger.error('Get latest location error', error, {
        deviceId: req.params.deviceId,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      const { createError } = require('../core/utils/errorHandler');
      throw createError('Son konum alınamadı', 500, 'LATEST_LOCATION_ERROR');
    }
  }

  // Get all devices with their latest locations
  async getAllDevices(req, res) {
    try {
      const devices = [];
      const store = db.data.store;

      for (const [deviceId, locations] of Object.entries(store)) {
        if (Array.isArray(locations) && locations.length > 0) {
          const latest = locations[locations.length - 1];
          const locationActivityService = require('../services/locationActivityService');
          const activity = locationActivityService.getActivityForLocation(deviceId, latest);

          devices.push({
            deviceId,
            latestLocation: {
              ...latest,
              activity
            }
          });
        }
      }

      return res.json(devices);
    } catch (error) {
      console.error('Get all devices error:', error);
      return res.status(500).json(ResponseFormatter.error('Cihazlar alınamadı', 'DEVICES_ERROR'));
    }
  }

  // Group Analytics
  async getGroupAnalytics(req, res) {
    try {
      const { groupId } = req.params;
      const { duration = '24h' } = req.query; // 24h, 7d, 30d

      // Verify group access
      await checkGroupAccess(req.user.id, groupId);

      const db = req.db;

      let interval = '24 hours';
      if (duration === '7d') interval = '7 days';
      if (duration === '30d') interval = '30 days';

      // Get group members
      const membersQuery = await db.query(
        `SELECT m.user_id, u.name 
         FROM group_members m 
         JOIN users u ON m.user_id = u.id 
         WHERE m.group_id = $1`,
        [groupId]
      );

      const memberStats = [];
      let groupTotalDistance = 0;
      let groupMaxSpeed = 0;

      for (const member of membersQuery.rows) {
        // Get locations for this member in duration
        const locationsResult = await db.query(
          `SELECT latitude, longitude, speed, timestamp 
           FROM locations 
           WHERE user_id = $1 
           AND timestamp > NOW() - $2::INTERVAL 
           ORDER BY timestamp ASC`,
          [member.user_id, interval]
        );

        const locations = locationsResult.rows;
        let distance = 0;
        let maxSpeed = 0;
        let avgSpeed = 0;

        if (locations.length > 1) {
          // Calculate stats
          for (let i = 1; i < locations.length; i++) {
            const prev = locations[i - 1];
            const curr = locations[i];

            // Haversine distance
            const R = 6371e3; // metres
            const φ1 = prev.latitude * Math.PI / 180;
            const φ2 = curr.latitude * Math.PI / 180;
            const Δφ = (curr.latitude - prev.latitude) * Math.PI / 180;
            const Δλ = (curr.longitude - prev.longitude) * Math.PI / 180;

            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c;

            distance += d;

            if (curr.speed > maxSpeed) maxSpeed = curr.speed;
            avgSpeed += curr.speed || 0;
          }
          avgSpeed = avgSpeed / locations.length;
        }

        memberStats.push({
          userId: member.user_id,
          name: member.name,
          distance: Math.round(distance), // meters
          maxSpeed: Math.round(maxSpeed),
          avgSpeed: Math.round(avgSpeed),
          points: locations.length
        });

        groupTotalDistance += distance;
        groupMaxSpeed = Math.max(groupMaxSpeed, maxSpeed);
      }

      return res.json(ResponseFormatter.success({
        groupTotalDistance: Math.round(groupTotalDistance),
        groupMaxSpeed: Math.round(groupMaxSpeed),
        memberStats,
        period: duration
      }));

    } catch (error) {
      console.error('Group analytics error:', error);
      return res.status(500).json(ResponseFormatter.error('Analiz verileri alınamadı', 'ANALYTICS_ERROR'));
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
      return res.status(500).json(
        ResponseFormatter.error('Failed to get latest locations', 'LOCATION_FETCH_ERROR')
      );
    }
  }

  // Delete location data for a device
  async deleteLocationData(req, res) {
    try {
      const { deviceId } = req.params;

      if (!deviceId) {
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      delete db.data.store[deviceId];
      db.scheduleSave();

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'delete_location_data', {
          deviceId,
          path: req.path
        });
      }

      return res.json({
        success: true,
        message: 'Location data deleted successfully'
      });
    } catch (error) {
      console.error('Delete location data error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Failed to delete location data', 'LOCATION_DELETE_ERROR')
      );
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

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'view_active_devices', {
          count: items.length,
          query,
          path: req.path
        });
      }

      return res.json({
        count: items.length,
        items,
      });
    } catch (error) {
      console.error('Get active devices error:', error);
      return res.status(500).json(
        ResponseFormatter.error('Failed to get active devices', 'DEVICE_FETCH_ERROR')
      );
    }
  }

  async getLocationStats(req, res) {
    try {
      const { deviceId } = req.params;

      if (!deviceId) {
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
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

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'view_location_stats', {
          deviceId,
          planId,
          path: req.path
        });
      }

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
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      const locations = db.getStore(deviceId);
      const optimized = locationService.optimizeRoute(locations, Number(minDistance));

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'view_route_optimized', {
          deviceId,
          originalCount: locations.length,
          optimizedCount: optimized.length,
          path: req.path
        });
      }

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
        return res.status(400).json(
          ResponseFormatter.error('Missing required parameters', 'MISSING_PARAMS')
        );
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
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      const user = db.findUserById(deviceId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';

      const recommendations = smartTrackingService.getTrackingRecommendations(deviceId, planId);

      const requestUserId = getUserIdFromToken(req);
      if (requestUserId) {
        activityLogService.logActivity(requestUserId, 'location', 'view_tracking_recommendations', {
          deviceId,
          planId,
          path: req.path
        });
      }

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
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      const userId = getUserIdFromToken(req);
      const { planId } = getUserPlan(userId);

      if (planId === 'free') {
        return res.status(403).json({
          error: 'Location analytics requires premium subscription',
          code: 'PREMIUM_REQUIRED',
          currentPlan: planId
        });
      }

      const routeMetrics = locationAnalytics.calculateRouteMetrics(deviceId);
      const speedZones = locationAnalytics.calculateSpeedZones(deviceId);
      const quality = locationAnalytics.getLocationQuality(deviceId);
      const heatmap = locationAnalytics.getLocationHeatmap(deviceId, 0.01);

      activityLogService.logActivity(userId, 'location', 'view_analytics', {
        deviceId,
        planId,
        path: req.path
      });

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
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      const userId = getUserIdFromToken(req);
      const { planId } = getUserPlan(userId);

      if (planId === 'free') {
        return res.status(403).json({
          error: 'Route metrics requires premium subscription',
          code: 'PREMIUM_REQUIRED',
          currentPlan: planId
        });
      }

      const start = startTime ? parseInt(startTime) : null;
      const end = endTime ? parseInt(endTime) : null;
      const metrics = locationAnalytics.calculateRouteMetrics(deviceId, start, end);

      activityLogService.logActivity(userId, 'location', 'view_route_metrics', {
        deviceId,
        startTime: start,
        endTime: end,
        planId,
        path: req.path
      });

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
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      const quality = locationAnalytics.getLocationQuality(deviceId);

      const userId = getUserIdFromToken(req);
      if (userId) {
        activityLogService.logActivity(userId, 'location', 'view_location_quality', {
          deviceId,
          path: req.path
        });
      }

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
        return res.status(400).json(
          ResponseFormatter.error('Device ID required', 'MISSING_DEVICE_ID')
        );
      }

      const userId = getUserIdFromToken(req);
      const { planId } = getUserPlan(userId);

      if (planId === 'free') {
        return res.status(403).json({
          error: 'Location prediction requires premium subscription',
          code: 'PREMIUM_REQUIRED',
          currentPlan: planId
        });
      }

      const prediction = locationAnalytics.predictNextLocation(deviceId, parseInt(lookbackMinutes));

      activityLogService.logActivity(userId, 'location', 'view_prediction', {
        deviceId,
        lookbackMinutes: parseInt(lookbackMinutes),
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        deviceId,
        prediction
      }));
    } catch (error) {
      logger.error('Get location prediction error', error);
      return res.status(500).json({ error: 'Failed to get location prediction' });
    }
  }

  async getAdvancedAnalytics(req, res) {
    const startTime = Date.now();
    try {
      const { deviceId } = req.query;
      const dateRange = req.query.dateRange || '30d';
      const includeTimeSeries = req.query.includeTimeSeries === 'true';
      const includePatterns = req.query.includePatterns === 'true';
      const includePredictions = req.query.includePredictions === 'true';
      const includeHeader = req.query.includeHeader === 'true';

      let userId = null;
      try {
        userId = getUserIdFromToken(req);
      } catch (e) {
      }

      const deviceIdToUse = deviceId || userId;

      const emptyResponse = {
        summary: {
          totalLocations: 0,
          totalDistance: 0,
          totalTime: 0,
          averageSpeed: 0,
          maxSpeed: 0,
          activeDays: 0,
          averageDailyDistance: 0,
          topSpeedZone: 'parked',
          mostActiveHour: 0,
          mostActiveDay: 'Pazartesi'
        },
        routeMetrics: {
          totalRoutes: 0,
          averageRouteDistance: 0,
          longestRoute: 0,
          shortestRoute: 0,
          averageRouteDuration: 0
        },
        quality: {
          accuracy: 0,
          reliability: 0,
          consistency: 0,
          gpsQuality: 'Yetersiz'
        },
        insights: [{
          type: 'info',
          message: 'Konum takibini başlatarak veri toplamaya başlayın',
          icon: 'location'
        }],
        _performance: {
          boost: false,
          processingTime: `${Date.now() - startTime}ms`,
          planId: 'free'
        }
      };

      if (!deviceIdToUse) {
        return res.json(ResponseFormatter.success(emptyResponse));
      }

      const userPlanData = userId ? getUserPlan(userId) : { planId: 'free', planLimits: SubscriptionModel.getPlanLimits('free'), user: null };
      const planId = userPlanData?.planId || 'free';
      const planLimits = userPlanData?.planLimits || SubscriptionModel.getPlanLimits('free');
      const user = userPlanData?.user || (userId ? db.findUserById(userId) : null);

      const cacheService = require('../core/services/advancedCache.service');
      const cacheKey = `analytics:${deviceIdToUse}:${dateRange}:${includeTimeSeries}:${includePatterns}:${includePredictions}:${includeHeader}`;
      const cached = cacheService.get(cacheKey, userId);

      if (cached) {
        const processingTime = Date.now() - startTime;
        trackRequest('getAdvancedAnalytics', planId, processingTime, true);
        return res.json(ResponseFormatter.success({
          ...cached,
          _performance: {
            ...cached._performance,
            cached: true,
            processingTime: `${processingTime}ms`
          }
        }));
      }

      const locations = db.getStore(deviceIdToUse);
      if (!Array.isArray(locations) || locations.length === 0) {
        return res.json(ResponseFormatter.success({
          summary: {
            totalLocations: 0,
            totalDistance: 0,
            totalTime: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            activeDays: 0,
            averageDailyDistance: 0,
            topSpeedZone: 'parked',
            mostActiveHour: 0,
            mostActiveDay: 'Pazartesi'
          },
          routeMetrics: {
            totalRoutes: 0,
            averageRouteDistance: 0,
            longestRoute: 0,
            shortestRoute: 0,
            averageRouteDuration: 0
          },
          quality: {
            accuracy: 0,
            reliability: 0,
            consistency: 0,
            gpsQuality: 'Yetersiz'
          },
          insights: [],
          _performance: {
            boost: planLimits.performanceBoost,
            processingTime: `${Date.now() - startTime}ms`,
            planId
          }
        }));
      }

      const now = Date.now();
      let startTimeFilter = null;
      if (dateRange === '7d') {
        startTimeFilter = now - (7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30d') {
        startTimeFilter = now - (30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '90d') {
        startTimeFilter = now - (90 * 24 * 60 * 60 * 1000);
      }

      const validLocations = locations.filter(loc => {
        if (!loc || !loc.coords) return false;
        const lat = parseFloat(loc.coords.latitude);
        const lng = parseFloat(loc.coords.longitude);
        return isFinite(lat) && isFinite(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180 &&
          loc.timestamp && typeof loc.timestamp === 'number' && loc.timestamp > 0;
      });

      const filteredLocations = startTimeFilter
        ? validLocations.filter(loc => loc.timestamp >= startTimeFilter)
        : validLocations;

      if (filteredLocations.length < 2) {
        return res.json(ResponseFormatter.success({
          summary: {
            totalLocations: 0,
            totalDistance: 0,
            totalTime: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            activeDays: 0,
            averageDailyDistance: 0,
            topSpeedZone: 'parked',
            mostActiveHour: 0,
            mostActiveDay: 'Pazartesi'
          },
          routeMetrics: {
            totalRoutes: 0,
            averageRouteDistance: 0,
            longestRoute: 0,
            shortestRoute: 0,
            averageRouteDuration: 0
          },
          quality: {
            accuracy: 0,
            reliability: 0,
            consistency: 0,
            gpsQuality: 'Yetersiz'
          },
          insights: [],
          _performance: {
            boost: planLimits.performanceBoost,
            processingTime: `${Date.now() - startTime}ms`,
            planId
          }
        }));
      }

      const routeMetrics = locationAnalytics.calculateRouteMetrics(deviceId, startTimeFilter, null);
      const speedZonesData = locationAnalytics.calculateSpeedZones(deviceId);
      const quality = locationAnalytics.getLocationQuality(deviceId);

      const validFilteredLocations = filteredLocations.filter(loc => {
        if (!loc || !loc.coords) return false;
        const lat = parseFloat(loc.coords.latitude);
        const lng = parseFloat(loc.coords.longitude);
        return isFinite(lat) && isFinite(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180;
      });

      const totalDistance = routeMetrics.totalDistance || 0;
      const totalTime = routeMetrics.movingTime + routeMetrics.stoppedTime || 0;
      const averageSpeed = routeMetrics.averageSpeed || 0;
      const maxSpeed = routeMetrics.maxSpeed || 0;

      const activeDaysSet = new Set();
      const hourlyCounts = new Array(24).fill(0);
      const dailyCounts = { 'Pazartesi': 0, 'Salı': 0, 'Çarşamba': 0, 'Perşembe': 0, 'Cuma': 0, 'Cumartesi': 0, 'Pazar': 0 };
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

      (Array.isArray(validFilteredLocations) ? validFilteredLocations : []).forEach(loc => {
        if (loc && loc.timestamp) {
          const date = new Date(loc.timestamp);
          activeDaysSet.add(date.toISOString().split('T')[0]);
          hourlyCounts[date.getHours()]++;
          dailyCounts[dayNames[date.getDay()]]++;
        }
      });

      const activeDays = activeDaysSet.size;
      const averageDailyDistance = activeDays > 0 ? totalDistance / activeDays : 0;
      const mostActiveHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
      const dailyEntries = Object.entries(dailyCounts || {});
      const mostActiveDay = dailyEntries.length > 0 ? dailyEntries.reduce((a, b) => dailyCounts[a[0]] > dailyCounts[b[0]] ? a : b)[0] : null;

      const speedZones = speedZonesData?.zones || {};
      const speedEntries = Object.entries(speedZones);
      const topSpeedZone = speedEntries.length > 0 ? speedEntries.reduce((a, b) => speedZones[a[0]] > speedZones[b[0]] ? a : b)[0] : 'parked';

      const validCount = validFilteredLocations.length;

      const summary = {
        totalLocations: validCount,
        totalDistance,
        totalTime,
        averageSpeed,
        maxSpeed,
        activeDays,
        averageDailyDistance,
        topSpeedZone,
        mostActiveHour,
        mostActiveDay
      };

      const routeMetricsFormatted = {
        totalRoutes: routeMetrics.stops + 1,
        averageRouteDistance: routeMetrics.stops > 0 ? totalDistance / (routeMetrics.stops + 1) : totalDistance,
        longestRoute: totalDistance,
        shortestRoute: 0,
        averageRouteDuration: routeMetrics.stops > 0 ? totalTime / (routeMetrics.stops + 1) : totalTime
      };

      const qualityFormatted = {
        accuracy: quality.accuracy || 0,
        reliability: quality.consistency || 0,
        consistency: quality.frequency || 0,
        gpsQuality: quality.score >= 80 ? 'Mükemmel' : quality.score >= 60 ? 'İyi' : quality.score >= 40 ? 'Orta' : 'Yetersiz'
      };

      const insights = [];
      if (validCount < 10) {
        insights.push({
          type: 'warning',
          message: 'Yetersiz konum verisi. Daha fazla veri toplamak için takibi aktif tutun.',
          icon: 'information-circle'
        });
      }
      if (quality.issues && quality.issues.length > 0) {
        quality.issues.forEach(issue => {
          insights.push({
            type: 'warning',
            message: issue,
            icon: 'warning'
          });
        });
      }
      if (validCount >= 50 && averageSpeed > 100) {
        insights.push({
          type: 'info',
          message: 'Yüksek hız tespit edildi',
          icon: 'speedometer'
        });
      }
      if (validCount >= 50 && activeDays >= 7) {
        insights.push({
          type: 'success',
          message: 'Düzenli aktivite gösteriliyor',
          icon: 'checkmark-circle'
        });
      }

      let predictions = null;
      if (includePredictions && validCount >= 20) {
        const prediction = locationAnalytics.predictNextLocation(deviceId, 5);
        if (prediction) {
          const estimatedDailyDistance = averageDailyDistance;
          const estimatedWeeklyDistance = estimatedDailyDistance * 7;
          const trend = averageDailyDistance > (totalDistance / activeDays) ? 'up' : 'down';
          const confidence = Math.min(95, Math.max(50, quality.score || 50));

          predictions = {
            estimatedDailyDistance,
            estimatedWeeklyDistance,
            trend,
            confidence
          };
        }
      }

      let timeSeries = null;
      if (includeTimeSeries && validFilteredLocations.length > 0) {
        const timeSeriesMap = new Map();
        validFilteredLocations.forEach(loc => {
          if (loc && loc.timestamp && loc.coords) {
            const date = new Date(loc.timestamp).toISOString().split('T')[0];
            if (!timeSeriesMap.has(date)) {
              timeSeriesMap.set(date, { date, distance: 0, locations: 0, speeds: [] });
            }
            const entry = timeSeriesMap.get(date);
            entry.locations++;
          }
        });

        for (let i = 1; i < validFilteredLocations.length; i++) {
          const prev = validFilteredLocations[i - 1];
          const curr = validFilteredLocations[i];
          if (prev && prev.coords && curr && curr.coords) {
            const date = new Date(curr.timestamp).toISOString().split('T')[0];
            const entry = timeSeriesMap.get(date);
            if (entry) {
              const distance = locationService.haversineDistance(
                prev.coords.latitude,
                prev.coords.longitude,
                curr.coords.latitude,
                curr.coords.longitude
              );
              entry.distance += distance;
              if (curr.coords.speed) {
                entry.speeds.push(curr.coords.speed * 3.6);
              }
            }
          }
        }

        timeSeries = Array.from(timeSeriesMap.values()).map(entry => ({
          date: entry.date,
          distance: entry.distance,
          locations: entry.locations,
          averageSpeed: entry.speeds.length > 0 ? entry.speeds.reduce((a, b) => a + b, 0) / entry.speeds.length : 0
        })).sort((a, b) => a.date.localeCompare(b.date));
      }

      let activityPatterns = null;
      if (includePatterns) {
        activityPatterns = {
          hourly: hourlyCounts.map((count, hour) => ({ hour, count })),
          daily: Object.entries(dailyCounts).map(([day, count]) => ({ day, count })),
          weekly: []
        };
      }

      const speedZonesFormatted = Object.entries(speedZones || {}).map(([zone, count]) => {
        const total = Object.values(speedZones || {}).reduce((a, b) => (a || 0) + (b || 0), 0);
        const percentage = total > 0 ? (count / total) * 100 : 0;
        const distance = percentage * totalDistance / 100;
        const duration = percentage * totalTime / 100;

        return {
          zone,
          duration,
          percentage,
          distance
        };
      }).filter(z => z.percentage > 0);

      let headerData = null;
      if (includeHeader) {
        const userData = user || db.findUserById(userId);
        headerData = {
          userName: userData?.name || userData?.displayName || 'Kullanıcı',
          planId: planId,
          planName: planId === 'business' ? 'Business' : planId === 'plus' ? 'Plus' : 'Free',
          totalStats: {
            locations: validCount,
            distance: totalDistance,
            activeDays: activeDays
          }
        };
      }

      const processingTime = Date.now() - startTime;
      trackRequest('getAdvancedAnalytics', planId, processingTime, true);

      const responseData = {
        summary,
        routeMetrics: routeMetricsFormatted,
        speedZones: speedZonesFormatted,
        quality: qualityFormatted,
        timeSeries,
        activityPatterns,
        predictions,
        insights,
        header: headerData,
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId,
          cached: false
        }
      };

      const cacheTTL = planId === 'business' ? 120000 : planId === 'plus' ? 60000 : 30000;
      cacheService.set(cacheKey, responseData, cacheTTL, userId);

      return res.json(ResponseFormatter.success(responseData));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getAdvancedAnalytics', 'unknown', processingTime, false);

      if (error.isOperational) {
        logger.warn('Get advanced analytics validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get advanced analytics error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Gelişmiş analitik alınamadı', 'ANALYTICS_ERROR'));
    }
  }

  async createShareLink(req, res) {
    try {
      const { lat, lng, name, address } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (!isFinite(latNum) || !isFinite(lngNum)) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz koordinatlar', 'INVALID_COORDINATES'));
      }

      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        return res.status(400).json(ResponseFormatter.error('Koordinatlar geçerli aralıkta değil', 'COORDINATES_OUT_OF_RANGE'));
      }

      const crypto = require('crypto');
      const shareToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

      if (!db.data.locationShares) {
        db.data.locationShares = {};
      }

      const tokenData = token ? db.getToken(token) : null;

      db.data.locationShares[shareToken] = {
        lat: latNum,
        lng: lngNum,
        name: name || null,
        address: address || null,
        createdAt: Date.now(),
        expiresAt: expiresAt,
        userId: tokenData?.userId || null
      };
      db.scheduleSave();

      const baseUrl = process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';
      const shareUrl = `${baseUrl}/api/location/share/${shareToken}`;
      const googleMapsUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;
      const appleMapsUrl = `https://maps.apple.com/?ll=${latNum},${lngNum}`;

      if (tokenData && tokenData.userId) {
        try {
          const notificationService = require('../services/notificationService');
          await notificationService.send(tokenData.userId, {
            title: '📍 Konum Paylaşıldı',
            message: `Konumunuz başarıyla paylaşıldı. Link 24 saat geçerli.`,
            type: 'success',
            deepLink: `bavaxe://location/share/${shareToken}`,
            data: {
              type: 'location_shared',
              shareToken,
              lat: latNum,
              lng: lngNum
            }
          }, ['onesignal']).catch((notifError) => {
            logger.warn('Notification send error (non-critical)', notifError);
          });
        } catch (notifError) {
          logger.warn('Notification send error', notifError);
        }
      }

      if (tokenData && tokenData.userId) {
        activityLogService.logActivity(tokenData.userId, 'location', 'create_share_link', {
          shareToken,
          lat: latNum,
          lng: lngNum,
          path: req.path
        });
      }

      const response = ResponseFormatter.success({
        shareToken,
        shareUrl,
        googleMapsUrl,
        appleMapsUrl,
        expiresAt,
        message: 'Konum paylaşım linki oluşturuldu'
      });

      return res.json(response);
    } catch (error) {
      logger.error('Create share link error', error);
      return res.status(500).json(ResponseFormatter.error('Paylaşım linki oluşturulamadı', 'SHARE_ERROR'));
    }
  }

  // Paylaşılan konumu görüntüle
  async getSharedLocation(req, res) {
    try {
      const { shareToken } = req.params;

      if (!db.data.locationShares || !db.data.locationShares[shareToken]) {
        return res.status(404).json({ error: 'Paylaşım linki bulunamadı veya süresi dolmuş' });
      }

      const share = db.data.locationShares[shareToken];

      // Süre kontrolü
      if (Date.now() > share.expiresAt) {
        delete db.data.locationShares[shareToken];
        db.scheduleSave();
        return res.status(410).json({ error: 'Paylaşım linkinin süresi dolmuş' });
      }

      return res.json(ResponseFormatter.success({
        lat: share.lat,
        lng: share.lng,
        name: share.name,
        address: share.address,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt
      }));
    } catch (error) {
      logger.error('Get shared location error', error);
      return res.status(500).json({ error: 'Paylaşılan konum alınamadı' });
    }
  }

  async findLocationByPhone(req, res) {
    try {
      const { phone, groupId } = req.query;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const userId = tokenData.userId;
      const user = db.findUserById(userId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const locationLimits = getPlanBasedLocationLimits(planId);

      if (!phone) {
        return res.status(400).json({ error: 'Telefon numarası gereklidir' });
      }

      const cacheKey = `phone:${phone}:${groupId || 'all'}`;

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, userId);
        if (cached) {
          const response = {
            ...cached,
            cached: true,
            _performance: {
              boost: locationLimits.performanceBoost,
              cached: true,
              priority: locationLimits.priorityProcessing
            }
          };
          if (locationLimits.responseOptimization) {
            return res.json(applyPerformanceOptimization(req, res, locationLimits, response));
          }
          return res.json(ResponseFormatter.success(response));
        }
      }

      let searchUsers = [];

      if (groupId) {
        const group = db.getGroupById(groupId);
        if (!group) {
          return res.status(404).json({ error: 'Grup bulunamadı' });
        }

        const members = db.getMembers(groupId);
        const isMember = members.some(m => m.userId === userId);
        if (!isMember) {
          return res.status(403).json({ error: 'Bu grup için yetkiniz yok' });
        }

        const memberUserIds = Array.isArray(members) ? members.map(m => m.userId) : [];
        searchUsers = Object.values(db.data.users || {}).filter(u => memberUserIds.includes(u.id));
      } else {
        if (locationLimits.queryOptimization) {
          const users = Object.values(db.data.users || {});
          searchUsers = users.filter(u => u.phone);
        } else {
          searchUsers = Object.values(db.data.users || {});
        }
      }

      const cleanPhone = phone.replace(/\s/g, '');
      const foundUser = locationLimits.parallelProcessing && searchUsers.length > 100
        ? searchUsers.find(u => u.phone && u.phone.replace(/\s/g, '') === cleanPhone)
        : searchUsers.find(u => u.phone && u.phone.replace(/\s/g, '') === cleanPhone);

      if (!foundUser) {
        return res.status(404).json({
          error: groupId
            ? 'Bu telefon numarasına sahip grup üyesi bulunamadı'
            : 'Bu telefon numarasına kayıtlı kullanıcı bulunamadı'
        });
      }

      const locations = db.getStore(foundUser.id);
      if (!locations || locations.length === 0) {
        return res.status(404).json({ error: 'Kullanıcının konum bilgisi bulunamadı' });
      }

      const latestLocation = locations[locations.length - 1];
      const isActive = latestLocation.timestamp > (Date.now() - 15 * 60 * 1000);

      const response = await processWithPlanOptimization(req, res, locationLimits, async () => ({
        userId: foundUser.id,
        name: foundUser.name || foundUser.displayName || foundUser.email,
        phone: foundUser.phone,
        location: {
          lat: latestLocation.coords.latitude,
          lng: latestLocation.coords.longitude,
          accuracy: latestLocation.coords.accuracy,
          timestamp: latestLocation.timestamp,
          isActive
        },
        groupId: groupId || null,
        performance: {
          boost: locationLimits.performanceBoost,
          queryOptimization: locationLimits.queryOptimization,
          smartCaching: locationLimits.smartCaching
        }
      }));

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, locationLimits.cacheTTL, userId);
      }

      activityLogService.logActivity(userId, 'location', 'find_location_by_phone', {
        phone,
        foundUserId: foundUser.id,
        groupId,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(response));
    } catch (error) {
      if (error.isOperational) {
        logger.warn('Find location by phone validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      logger.error('Find location by phone error', error);
      return res.status(500).json(ResponseFormatter.error('Konum bulunamadı', 'LOCATION_SEARCH_ERROR'));
    }
  }

  // Canlı konum gönderme (real-time)
  async startLiveLocation(req, res) {
    try {
      const { duration, recipients } = req.body; // duration: dakika, recipients: userId array
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const userId = tokenData.userId;
      const expiresAt = Date.now() + (duration || 60) * 60 * 1000; // Varsayılan 60 dakika

      // Canlı konum kaydı oluştur
      if (!db.data.liveLocations) {
        db.data.liveLocations = {};
      }

      const liveLocationId = `live_${userId}_${Date.now()}`;
      db.data.liveLocations[liveLocationId] = {
        userId,
        recipients: recipients || [],
        expiresAt,
        createdAt: Date.now(),
        isActive: true
      };
      db.scheduleSave();

      const processingTime = Date.now() - startTime;
      trackRequest('startLiveLocation', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'start_live_location', {
        deviceId,
        groupId,
        planId,
        path: req.path
      });
      logger.info('Live location started', { userId, liveLocationId, planId, processingTime });

      return res.json(ResponseFormatter.success({
        liveLocationId,
        expiresAt,
        message: 'Canlı konum paylaşımı başlatıldı',
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('startLiveLocation', 'unknown', processingTime, false);
      trackError('startLiveLocation', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Start live location validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Start live location error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Canlı konum başlatılamadı', 'LIVE_LOCATION_ERROR'));
    }
  }

  async addFamilyMember(req, res) {
    try {
      const { userId: targetUserId, name: targetName, displayName, relation, groupId } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const userId = tokenData.userId;
      const user = db.findUserById(userId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const planLimits = SubscriptionModel.getPlanLimits(planId);

      if (!targetUserId && !targetName) {
        return res.status(400).json({
          error: 'Kullanıcı ID veya isim gereklidir',
          validation: {
            userId: { required: false, format: 'string', minLength: 3 },
            name: { required: false, format: 'string', minLength: 2, maxLength: 50 }
          }
        });
      }

      if (targetName && (targetName.trim().length < 2 || targetName.trim().length > 50)) {
        return res.status(400).json({
          error: 'İsim 2-50 karakter arasında olmalıdır',
          validation: {
            name: { minLength: 2, maxLength: 50, current: targetName.trim().length }
          }
        });
      }

      if (targetUserId && (targetUserId.trim().length < 3 || !/^[a-zA-Z0-9_-]+$/.test(targetUserId))) {
        return res.status(400).json({
          error: 'Kullanıcı ID en az 3 karakter olmalı ve sadece harf, rakam, tire ve alt çizgi içermelidir',
          validation: {
            userId: { minLength: 3, format: 'alphanumeric_with_dash_underscore' }
          }
        });
      }

      if (groupId) {
        const group = db.getGroupById(groupId);
        if (!group) {
          return res.status(404).json({ error: 'Grup bulunamadı' });
        }
        const members = db.getMembers(groupId) || [];
        const isMember = Array.isArray(members) && members.some(m => m.userId === userId);
        if (!isMember) {
          return res.status(403).json({ error: 'Bu grup için yetkiniz yok' });
        }
      }

      if (!db.data.familyMembers) {
        db.data.familyMembers = {};
      }

      if (!db.data.familyMembers[userId]) {
        db.data.familyMembers[userId] = [];
      }

      const currentFamilyCount = db.data.familyMembers[userId].filter(m =>
        !groupId || m.groupId === groupId
      ).length;
      const maxFamilyMembers = planLimits.maxFamilyMembers || planLimits.maxMembers || 5;

      if (maxFamilyMembers > 0 && currentFamilyCount >= maxFamilyMembers) {
        return res.status(403).json({
          error: `Plan limiti aşıldı. Maksimum ${maxFamilyMembers} aile üyesi ekleyebilirsiniz. Planınızı yükseltmek için lütfen abonelik sayfasını ziyaret edin.`,
          limit: maxFamilyMembers,
          current: currentFamilyCount,
          planId
        });
      }

      const users = Object.values(db.data.users || {});
      let familyUser = null;

      if (targetUserId) {
        familyUser = users.find(u => u.id === targetUserId);
        if (!familyUser) {
          familyUser = db.findUserById(targetUserId);
        }
      } else if (targetName) {
        familyUser = users.find(u =>
          (u.name && u.name.toLowerCase().includes(targetName.toLowerCase())) ||
          (u.displayName && u.displayName.toLowerCase().includes(targetName.toLowerCase())) ||
          (u.email && u.email.toLowerCase().includes(targetName.toLowerCase()))
        );
      }

      if (!familyUser) {
        return res.status(404).json({
          error: targetUserId
            ? 'Bu ID\'ye sahip kullanıcı bulunamadı'
            : 'Bu isme sahip kullanıcı bulunamadı'
        });
      }

      // Zaten ekli mi kontrol et
      const existing = db.data.familyMembers[userId].find(m => m.userId === familyUser.id);
      if (existing) {
        return res.status(400).json({ error: 'Bu kullanıcı zaten aile üyesi olarak ekli' });
      }

      const finalName = displayName || familyUser.name || familyUser.displayName || targetName || 'İsimsiz Kullanıcı';

      db.data.familyMembers[userId].push({
        userId: familyUser.id,
        phone: familyUser.phone || null,
        name: finalName,
        relation: relation || 'family',
        groupId: groupId || null,
        addedAt: Date.now()
      });
      db.scheduleSave();

      // OneSignal bildirimi gönder - hem ekleyene hem eklenene
      try {
        const notificationService = require('../services/notificationService');

        const adderName = db.findUserById(userId)?.name || db.findUserById(userId)?.displayName || 'Bir kullanıcı';
        const memberName = finalName;

        await notificationService.send(userId, {
          title: '👨‍👩‍👧‍👦 Aile Üyesi Eklendi',
          message: `${memberName} aile listenize eklendi.`,
          type: 'success',
          deepLink: `bavaxe://location-features?tab=family`,
          data: {
            type: 'family_member_added',
            memberId: familyUser.id
          }
        }, ['onesignal']);

        await notificationService.send(familyUser.id, {
          title: '👨‍👩‍👧‍👦 Aile Üyesi Olarak Eklendiniz',
          message: `${adderName} sizi aile üyesi olarak ekledi.`,
          type: 'info',
          deepLink: `bavaxe://location-features?tab=family`,
          data: {
            type: 'added_to_family',
            addedBy: userId
          }
        }, ['onesignal']);
      } catch (notifError) {
        console.error('[LocationController] Family notification error:', notifError);
      }

      const processingTime = Date.now() - startTime;
      trackRequest('addFamilyMember', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'add_family_member', {
        memberId: familyUser.id,
        memberName: finalName,
        planId,
        path: req.path
      });

      logger.info('Family member added successfully', {
        userId,
        memberId: familyUser.id,
        planId,
        processingTime
      });

      return res.json(ResponseFormatter.success({
        member: {
          userId: familyUser.id,
          name: finalName,
          phone: familyUser.phone || null,
          relation: relation || 'family',
          groupId: groupId || null
        },
        message: 'Aile üyesi eklendi',
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('addFamilyMember', 'unknown', processingTime, false);
      trackError('addFamilyMember', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Add family member validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Add family member error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Aile üyesi eklenemedi', 'FAMILY_MEMBER_ERROR'));
    }
  }

  async getFamilyLocations(req, res) {
    try {
      const { groupId } = req.query;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const userId = tokenData.userId;
      const user = db.findUserById(userId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const locationLimits = getPlanBasedLocationLimits(planId);

      const cacheKey = `family:${userId}:${groupId || 'all'}`;

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, userId);
        if (cached) {
          const response = {
            ...cached,
            cached: true,
            _performance: {
              boost: locationLimits.performanceBoost,
              cached: true,
              priority: locationLimits.priorityProcessing
            }
          };
          if (locationLimits.responseOptimization) {
            return res.json(applyPerformanceOptimization(req, res, locationLimits, response));
          }
          return res.json(ResponseFormatter.success(response));
        }
      }

      let familyMembers = db.data.familyMembers?.[userId] || [];

      if (groupId) {
        familyMembers = familyMembers.filter(m => m.groupId === groupId);
      }

      const locations = [];

      if (locationLimits.parallelProcessing && familyMembers.length > 5) {
        const chunkSize = Math.ceil(familyMembers.length / locationLimits.maxConcurrentRequests);
        const chunks = [];
        for (let i = 0; i < familyMembers.length; i += chunkSize) {
          chunks.push(familyMembers.slice(i, i + chunkSize));
        }

        const locationPromises = chunks.map(chunk => {
          return chunk.map(member => {
            const memberLocations = db.getStore(member.userId);
            if (memberLocations && memberLocations.length > 0) {
              const latest = memberLocations[memberLocations.length - 1];
              const user = db.findUserById(member.userId);
              return {
                userId: member.userId,
                name: member.name || user?.name,
                phone: member.phone,
                relation: member.relation,
                location: {
                  lat: latest.coords.latitude,
                  lng: latest.coords.longitude,
                  accuracy: latest.coords.accuracy,
                  timestamp: latest.timestamp,
                  isActive: latest.timestamp > (Date.now() - 15 * 60 * 1000)
                }
              };
            }
            return null;
          });
        });

        const results = locationPromises.flat();
        locations.push(...results.filter(Boolean));
      } else {
        for (let i = 0; i < familyMembers.length; i++) {
          const member = familyMembers[i];
          const memberLocations = db.getStore(member.userId);
          if (memberLocations && memberLocations.length > 0) {
            const latest = memberLocations[memberLocations.length - 1];
            const user = db.findUserById(member.userId);
            locations.push({
              userId: member.userId,
              name: member.name || user?.name,
              phone: member.phone,
              relation: member.relation,
              location: {
                lat: latest.coords.latitude,
                lng: latest.coords.longitude,
                accuracy: latest.coords.accuracy,
                timestamp: latest.timestamp,
                isActive: latest.timestamp > (Date.now() - 15 * 60 * 1000)
              }
            });
          }
        }
      }

      const response = await processWithPlanOptimization(req, res, locationLimits, async () => ({
        members: locations,
        count: locations.length,
        performance: {
          boost: locationLimits.performanceBoost,
          parallelProcessing: locationLimits.parallelProcessing,
          smartCaching: locationLimits.smartCaching
        }
      }));

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, locationLimits.cacheTTL, userId);
      }

      activityLogService.logActivity(userId, 'location', 'view_family_locations', {
        groupId,
        memberCount: locations.length,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(response));
    } catch (error) {
      if (error.isOperational) {
        logger.warn('Get family locations validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      logger.error('Get family locations error', error);
      return res.status(500).json(ResponseFormatter.error('Aile konumları alınamadı', 'FAMILY_LOCATIONS_ERROR'));
    }
  }

  async reverseGeocode(req, res) {
    const startTime = Date.now();
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        return res.status(400).json(ResponseFormatter.error('lat ve lng parametreleri gereklidir', 'MISSING_COORDINATES'));
      }

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (!isFinite(latNum) || !isFinite(lngNum)) {
        return res.status(400).json(ResponseFormatter.error('Geçersiz koordinatlar', 'INVALID_COORDINATES'));
      }

      const userId = getUserIdFromToken(req);
      const geocode = await geocodingService.getCityProvince(latNum, lngNum);

      const processingTime = Date.now() - startTime;

      if (userId) {
        activityLogService.logActivity(userId, 'location', 'reverse_geocode', {
          lat: latNum,
          lng: lngNum,
          path: req.path
        });
      }

      return res.json(ResponseFormatter.success({
        geocode,
        processingTime: `${processingTime}ms`
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Reverse geocode error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Reverse geocoding başarısız', 'REVERSE_GEOCODE_ERROR'));
    }
  }

  async geocodeAddress(req, res) {
    const startTime = Date.now();
    try {
      const { address } = req.body;

      if (!address || !address.trim()) {
        throw createError('Adres gereklidir', 400, 'MISSING_ADDRESS');
      }

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      const fetch = require('node-fetch');
      const encodedAddress = encodeURIComponent(address.trim());

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=tr`, {
          headers: {
            'User-Agent': 'BavaxePlatform/1.0'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw createError('Adres servisi erişilemiyor', 500, 'GEOCODE_SERVICE_ERROR');
        }

        const data = await response.json();

        if (!data || data.length === 0) {
          throw createError('Adres bulunamadı. Lütfen daha detaylı bir adres girin.', 404, 'ADDRESS_NOT_FOUND');
        }

        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        if (!isFinite(lat) || !isFinite(lng)) {
          throw createError('Geçersiz koordinatlar alındı', 500, 'INVALID_GEOCODE_RESULT');
        }

        const processingTime = Date.now() - startTime;
        trackRequest('geocodeAddress', planId, processingTime, true);

        activityLogService.logActivity(userId, 'location', 'geocode_address', {
          address: address.trim(),
          planId,
          path: req.path
        });

        return res.json(ResponseFormatter.success({
          address: result.display_name,
          coordinates: {
            lat,
            lng
          },
          details: {
            city: result.address?.city || result.address?.town || result.address?.village,
            district: result.address?.suburb || result.address?.neighbourhood,
            street: result.address?.road,
            postalCode: result.address?.postcode
          },
          _performance: {
            boost: planLimits.performanceBoost,
            processingTime: `${processingTime}ms`,
            planId
          }
        }));
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw createError('Adres servisi zaman aşımına uğradı', 408, 'GEOCODE_TIMEOUT');
        }
        throw fetchError;
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('geocodeAddress', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return res.status(408).json(ResponseFormatter.error('Adres servisi zaman aşımına uğradı. Lütfen tekrar deneyin.', 'GEOCODE_TIMEOUT'));
      }

      logger.error('Geocode address error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Adres işlenemedi', 'GEOCODE_ERROR'));
    }
  }

  async createDelivery(req, res) {
    const startTime = Date.now();
    try {
      const { recipientName, recipientPhone, destinationLat, destinationLng, destinationAddress, notes, groupId } = req.body;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      if (!recipientName || !recipientName.trim()) {
        throw createError('Alıcı adı gereklidir', 400, 'MISSING_RECIPIENT_NAME');
      }

      if (!recipientPhone || !recipientPhone.trim()) {
        throw createError('Alıcı telefonu gereklidir', 400, 'MISSING_RECIPIENT_PHONE');
      }

      const validatedName = validateName(recipientName.trim(), 'Alıcı adı');
      const validatedPhone = validatePhoneNumber(recipientPhone.trim(), 'Alıcı telefonu');

      let latNum, lngNum;

      if (destinationAddress && destinationAddress.trim()) {
        try {
          const fetch = require('node-fetch');
          const encodedAddress = encodeURIComponent(destinationAddress.trim());

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=tr`, {
              headers: {
                'User-Agent': 'BavaxePlatform/1.0'
              },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
              throw createError('Adres servisi erişilemiyor', 500, 'GEOCODE_SERVICE_ERROR');
            }

            const data = await response.json();

            if (!data || data.length === 0) {
              throw createError('Adres bulunamadı. Lütfen daha detaylı bir adres girin.', 400, 'ADDRESS_NOT_FOUND');
            }

            latNum = parseFloat(data[0].lat);
            lngNum = parseFloat(data[0].lon);

            if (!isFinite(latNum) || !isFinite(lngNum)) {
              throw createError('Geçersiz koordinatlar alındı', 400, 'INVALID_GEOCODE_RESULT');
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              throw createError('Adres servisi zaman aşımına uğradı', 408, 'GEOCODE_TIMEOUT');
            }
            throw fetchError;
          }
        } catch (geocodeError) {
          if (geocodeError.isOperational) {
            throw geocodeError;
          }
          throw createError('Adres işlenemedi: ' + (geocodeError.message || 'Bilinmeyen hata'), 400, 'GEOCODE_ERROR');
        }
      } else if (destinationLat !== undefined && destinationLng !== undefined) {
        const coords = validateCoordinates(destinationLat, destinationLng, 'Hedef konum');
        latNum = coords.lat;
        lngNum = coords.lng;
      } else {
        throw createError('Hedef konum gereklidir (adres veya koordinat)', 400, 'MISSING_DESTINATION');
      }

      if (groupId) {
        checkGroupAccess(userId, groupId);
      }

      if (!db.data.deliveries) {
        db.data.deliveries = {};
      }

      const userDeliveries = Object.values(db.data.deliveries || {}).filter(
        d => d.courierId === userId && d.status !== 'delivered' && d.status !== 'cancelled' && (!groupId || d.groupId === groupId)
      );

      const maxDeliveries = planLimits.maxDeliveries || (planId === 'business' ? -1 : (planId === 'plus' ? 50 : 10));
      if (maxDeliveries > 0 && userDeliveries.length >= maxDeliveries) {
        throw createError(
          `Plan limiti aşıldı. Maksimum ${maxDeliveries} aktif teslimat oluşturabilirsiniz. Planınızı yükseltmek için lütfen abonelik sayfasını ziyaret edin.`,
          403,
          'PLAN_LIMIT_EXCEEDED',
          { limit: maxDeliveries, current: userDeliveries.length, planId }
        );
      }

      const deliveryId = `delivery_${userId}_${Date.now()}`;
      db.data.deliveries[deliveryId] = {
        deliveryId,
        courierId: userId,
        recipientName: validatedName,
        recipientPhone: validatedPhone,
        destination: {
          lat: latNum,
          lng: lngNum
        },
        destinationAddress: destinationAddress ? destinationAddress.trim() : null,
        status: 'pending',
        notes: notes ? notes.trim() : null,
        groupId: groupId || null,
        planId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };
      db.scheduleSave();

      try {
        await notificationService.send(courierId, {
          title: '📦 Yeni Teslimat Oluşturuldu',
          message: `${recipientName} için teslimat hazırlandı`,
          type: 'success',
          deepLink: `bavaxe://location-features?tab=courier&deliveryId=${deliveryId}`,
          data: {
            type: 'delivery_created',
            deliveryId,
            recipientName: recipientName.trim(),
            groupId: groupId || null
          }
        }, ['database', 'onesignal']);
      } catch (notifError) {
        logger.error('[LocationController] Delivery creation notification error:', notifError);
      }

      const processingTime = Date.now() - startTime;
      trackRequest('createDelivery', planId, processingTime, true);
      logger.info('Delivery created successfully', {
        courierId,
        deliveryId,
        planId,
        processingTime
      });

      return res.json(ResponseFormatter.success({
        deliveryId,
        message: 'Teslimat oluşturuldu',
        delivery: {
          deliveryId,
          recipientName: validatedName,
          recipientPhone: validatedPhone,
          destination: {
            lat: latNum,
            lng: lngNum
          },
          status: 'pending',
          groupId: groupId || null
        },
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('createDelivery', 'unknown', processingTime, false);
      trackError('createDelivery', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Create delivery validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Create delivery error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Teslimat oluşturulamadı', 'DELIVERY_CREATION_ERROR'));
    }
  }

  // Kurye teslimatlarını listele
  async getDeliveries(req, res) {
    try {
      const { groupId } = req.query;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const courierId = tokenData.userId;
      let deliveries = Object.values(db.data.deliveries || {}).filter(
        d => d.courierId === courierId
      );

      if (groupId) {
        deliveries = deliveries.filter(d => d.groupId === groupId);
      }

      deliveries = deliveries.sort((a, b) => b.createdAt - a.createdAt);

      const user = db.findUserById(courierId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const locationLimits = getPlanBasedLocationLimits(planId);

      const cacheKey = `deliveries:${courierId}:${groupId || 'all'}`;

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, courierId);
        if (cached) {
          const response = {
            ...cached,
            cached: true,
            _performance: {
              boost: locationLimits.performanceBoost,
              cached: true,
              priority: locationLimits.priorityProcessing
            }
          };
          if (locationLimits.responseOptimization) {
            return res.json(applyPerformanceOptimization(req, res, locationLimits, response));
          }
          return res.json(ResponseFormatter.success(response));
        }
      }

      if (locationLimits.queryOptimization && deliveries.length > 100) {
        deliveries = deliveries.slice(0, 100);
      }

      const response = await processWithPlanOptimization(req, res, locationLimits, async () => ({
        deliveries,
        count: deliveries.length,
        performance: {
          boost: locationLimits.performanceBoost,
          queryOptimization: locationLimits.queryOptimization,
          smartCaching: locationLimits.smartCaching
        }
      }));

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, locationLimits.cacheTTL, courierId);
      }

      activityLogService.logActivity(courierId, 'location', 'view_deliveries', {
        groupId,
        deliveryCount: deliveries.length,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(response));
    } catch (error) {
      if (error.isOperational) {
        logger.warn('Get deliveries validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      logger.error('Get deliveries error', error);
      return res.status(500).json(ResponseFormatter.error('Teslimatlar alınamadı', 'DELIVERIES_FETCH_ERROR'));
    }
  }

  // Kurye teslimat durumunu güncelle
  async updateDeliveryStatus(req, res) {
    try {
      const { deliveryId } = req.params;
      const { status, currentLat, currentLng, groupId } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const delivery = db.data.deliveries?.[deliveryId];
      if (!delivery) {
        return res.status(404).json({ error: 'Teslimat bulunamadı' });
      }

      if (delivery.courierId !== tokenData.userId) {
        return res.status(403).json({ error: 'Bu teslimat size ait değil' });
      }

      if (groupId && delivery.groupId !== groupId) {
        return res.status(403).json({ error: 'Bu teslimat bu gruba ait değil' });
      }

      const previousStatus = delivery.status;
      delivery.status = status;
      delivery.updatedAt = Date.now();

      if (currentLat && currentLng) {
        const { lat, lng } = validateCoordinates(currentLat, currentLng, 'Mevcut konum');
        delivery.currentLocation = {
          lat,
          lng,
          timestamp: Date.now()
        };
      }

      db.scheduleSave();

      // OneSignal bildirimi gönder
      try {
        const notificationService = require('../services/notificationService');
        const statusMessages = {
          'pending': '⏳ Teslimat bekleniyor',
          'in_progress': '🚚 Teslimat yolda',
          'delivered': '✅ Teslimat tamamlandı',
          'cancelled': '❌ Teslimat iptal edildi'
        };

        await notificationService.send(courierId, {
          title: statusMessages[status] || '📦 Teslimat Güncellendi',
          message: `${delivery.recipientName} için teslimat durumu: ${status}`,
          type: status === 'delivered' ? 'success' : status === 'cancelled' ? 'error' : 'info',
          deepLink: `bavaxe://location-features?tab=courier&deliveryId=${deliveryId}`,
          data: {
            type: 'delivery_status_update',
            deliveryId,
            status,
            recipientName: delivery.recipientName
          }
        }, ['onesignal']);
      } catch (notifError) {
        console.error('[LocationController] Delivery notification error:', notifError);
      }

      const processingTime = Date.now() - startTime;
      trackRequest('updateDeliveryStatus', planId, processingTime, true);

      activityLogService.logActivity(courierId, 'location', 'update_delivery_status', {
        deliveryId,
        previousStatus,
        newStatus: status,
        planId,
        path: req.path
      });

      logger.info('Delivery status updated', {
        courierId,
        deliveryId,
        previousStatus,
        newStatus: status,
        planId,
        processingTime
      });

      return res.json(ResponseFormatter.success({
        delivery: {
          deliveryId: delivery.deliveryId,
          status: delivery.status,
          updatedAt: delivery.updatedAt,
          currentLocation: delivery.currentLocation
        },
        message: 'Teslimat durumu güncellendi',
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('updateDeliveryStatus', 'unknown', processingTime, false);
      trackError('updateDeliveryStatus', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Update delivery status validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Update delivery status error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Teslimat durumu güncellenemedi', 'DELIVERY_UPDATE_ERROR'));
    }
  }

  async saveRoute(req, res) {
    try {
      const { name, waypoints, startLocation, endLocation, groupId } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const userId = tokenData.userId;
      const user = db.findUserById(userId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const planLimits = SubscriptionModel.getPlanLimits(planId);

      if (!db.data.routes) {
        db.data.routes = {};
      }

      const userRoutes = Object.values(db.data.routes || {}).filter(
        r => r.userId === userId
      );

      const maxRoutes = planLimits.maxRoutes || (planId === 'business' ? -1 : (planId === 'plus' ? 100 : 20));
      if (maxRoutes > 0 && userRoutes.length >= maxRoutes) {
        return res.status(403).json({
          error: `Plan limiti aşıldı. Maksimum ${maxRoutes} rota kaydedebilirsiniz. Planınızı yükseltmek için lütfen abonelik sayfasını ziyaret edin.`,
          limit: maxRoutes,
          current: userRoutes.length,
          planId
        });
      }

      const routeId = `route_${userId}_${Date.now()}`;
      db.data.routes[routeId] = {
        routeId,
        userId,
        name: (name || 'Yeni Rota').trim(),
        waypoints: waypoints || [],
        startLocation: {
          lat: start.lat,
          lng: start.lng
        },
        endLocation: {
          lat: end.lat,
          lng: end.lng
        },
        groupId: groupId || null,
        planId,
        createdAt: Date.now(),
        distance: null,
        duration: null,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };
      db.scheduleSave();

      try {
        await notificationService.send(userId, {
          title: '🗺️ Rota Kaydedildi',
          message: `${name || 'Yeni Rota'} başarıyla kaydedildi`,
          type: 'success',
          deepLink: `bavaxe://location-features?tab=routes&routeId=${routeId}`,
          data: {
            type: 'route_saved',
            routeId,
            groupId: groupId || null
          }
        }, ['database', 'onesignal']);
      } catch (notifError) {
        logger.error('[LocationController] Route save notification error:', notifError);
      }

      const processingTime = Date.now() - startTime;
      trackRequest('saveRoute', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'save_route', {
        routeId,
        routeName: (name || 'Yeni Rota').trim(),
        waypointsCount: (waypoints || []).length,
        planId,
        path: req.path
      });

      logger.info('Route saved successfully', { userId, routeId, planId, processingTime });

      return res.json(ResponseFormatter.success({
        routeId,
        message: 'Rota kaydedildi',
        route: {
          routeId,
          name: (name || 'Yeni Rota').trim(),
          startLocation: {
            lat: start.lat,
            lng: start.lng
          },
          endLocation: {
            lat: end.lat,
            lng: end.lng
          },
          waypointsCount: (waypoints || []).length,
          groupId: groupId || null
        },
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('saveRoute', 'unknown', processingTime, false);
      trackError('saveRoute', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Save route validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Save route error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Rota kaydedilemedi', 'ROUTE_SAVE_ERROR'));
    }
  }

  // Rotaları listele
  async listRoutes(req, res) {
    try {
      const { groupId } = req.query;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const tokenData = db.getToken(token || '');

      if (!tokenData) {
        return res.status(401).json({ error: 'Token gereklidir' });
      }

      const userId = tokenData.userId;
      const user = db.findUserById(userId);
      const subscription = user ? db.getUserSubscription(user.id) : null;
      const planId = subscription?.planId || 'free';
      const locationLimits = getPlanBasedLocationLimits(planId);

      const cacheKey = `routes:${userId}:${groupId || 'all'}`;

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, userId);
        if (cached) {
          const response = {
            ...cached,
            cached: true,
            _performance: {
              boost: locationLimits.performanceBoost,
              cached: true,
              priority: locationLimits.priorityProcessing
            }
          };
          if (locationLimits.responseOptimization) {
            return res.json(applyPerformanceOptimization(req, res, locationLimits, response));
          }
          return res.json(ResponseFormatter.success(response));
        }
      }

      let routes = Object.values(db.data.routes || {}).filter(
        r => r.userId === userId
      );

      if (groupId) {
        routes = routes.filter(r => r.groupId === groupId);
      }

      routes = routes.sort((a, b) => b.createdAt - a.createdAt);

      if (locationLimits.queryOptimization && routes.length > 100) {
        routes = routes.slice(0, 100);
      }

      const response = await processWithPlanOptimization(req, res, locationLimits, async () => ({
        routes,
        count: routes.length,
        performance: {
          boost: locationLimits.performanceBoost,
          queryOptimization: locationLimits.queryOptimization,
          smartCaching: locationLimits.smartCaching
        }
      }));

      if (locationLimits.smartCaching || locationLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, locationLimits.cacheTTL, userId);
      }

      activityLogService.logActivity(userId, 'location', 'view_routes', {
        groupId,
        routeCount: routes.length,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(response));
    } catch (error) {
      if (error.isOperational) {
        logger.warn('List routes validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }
      logger.error('List routes error', error);
      return res.status(500).json(ResponseFormatter.error('Rotalar alınamadı', 'ROUTES_FETCH_ERROR'));
    }
  }

  async validateInput(req, res) {
    const startTime = Date.now();
    try {
      const { type, value, groupId } = req.body;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      let validation = { valid: false, error: null, suggestions: [] };

      switch (type) {
        case 'phone':
          try {
            validatePhoneNumber(value, 'Telefon numarası');
            validation.valid = true;
          } catch (error) {
            validation.error = error.message;
            validation.suggestions = ['Telefon numarası 5 ile başlamalıdır', '10 haneli olmalıdır', 'Örnek: 5551234567'];
          }
          break;

        case 'name':
          try {
            validateName(value, 'İsim', 2, 50);
            validation.valid = true;
          } catch (error) {
            validation.error = error.message;
            validation.suggestions = ['İsim 2-50 karakter arasında olmalıdır'];
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validation.error = 'Geçersiz e-posta adresi formatı';
            validation.suggestions = ['Örnek: kullanici@example.com'];
          } else {
            validation.valid = true;
          }
          break;

        case 'coordinates':
          try {
            const coords = value.split(',').map(c => c.trim());
            if (coords.length !== 2) {
              throw createError('Koordinat formatı hatalı', 400, 'INVALID_COORDINATE_FORMAT');
            }
            validateCoordinates(coords[0], coords[1], 'Koordinatlar');
            validation.valid = true;
          } catch (error) {
            validation.error = error.message;
            validation.suggestions = ['Format: enlem,boylam', 'Örnek: 41.0082,28.9784'];
          }
          break;

        case 'userId':
          const trimmed = value?.trim() || '';
          if (trimmed.length < 3) {
            validation.error = 'Kullanıcı ID en az 3 karakter olmalıdır';
            validation.suggestions = ['En az 3 karakter', 'Sadece harf, rakam, tire ve alt çizgi'];
          } else if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            validation.error = 'Kullanıcı ID sadece harf, rakam, tire ve alt çizgi içerebilir';
            validation.suggestions = ['Geçerli karakterler: a-z, A-Z, 0-9, _, -'];
          } else {
            validation.valid = true;
          }
          break;

        default:
          validation.error = 'Bilinmeyen validasyon tipi';
          validation.suggestions = ['Geçerli tipler: phone, name, email, coordinates, userId'];
      }

      const processingTime = Date.now() - startTime;
      trackRequest('validateInput', planId, processingTime, true);

      return res.json(ResponseFormatter.success({
        ...validation,
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('validateInput', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Validate input error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Validasyon yapılamadı', 'VALIDATION_ERROR'));
    }
  }

  async sendMessage(req, res) {
    const startTime = Date.now();
    try {
      const { recipientId, recipientPhone, message, type, groupId } = req.body;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      if (!message || message.trim().length === 0) {
        throw createError('Mesaj içeriği gereklidir', 400, 'MISSING_MESSAGE');
      }

      if (message.trim().length > 1000) {
        throw createError('Mesaj en fazla 1000 karakter olabilir', 400, 'MESSAGE_TOO_LONG', {
          maxLength: 1000,
          current: message.trim().length
        });
      }

      if (!recipientId && !recipientPhone) {
        throw createError('Alıcı ID veya telefon numarası gereklidir', 400, 'MISSING_RECIPIENT');
      }

      if (recipientPhone && type === 'sms' && !planLimits.smsEnabled) {
        throw createError('SMS gönderimi planınızda mevcut değil', 403, 'SMS_NOT_AVAILABLE', { planId });
      }

      if (groupId) {
        checkGroupAccess(userId, groupId);
      }

      if (!db.data.messages) {
        db.data.messages = {};
      }

      if (!db.data.messages[userId]) {
        db.data.messages[userId] = [];
      }

      const userMessages = db.data.messages[userId].filter(m =>
        planLimits.messageRetentionDays > 0
          ? Date.now() - m.createdAt < (planLimits.messageRetentionDays * 24 * 60 * 60 * 1000)
          : true
      );

      const maxMessages = planLimits.maxMessages || 50;
      if (maxMessages > 0 && userMessages.length >= maxMessages) {
        throw createError(
          `Plan limiti aşıldı. Maksimum ${maxMessages} mesaj gönderebilirsiniz. Planınızı yükseltmek için lütfen abonelik sayfasını ziyaret edin.`,
          403,
          'MESSAGE_LIMIT_EXCEEDED',
          {
            limit: maxMessages,
            current: userMessages.length,
            planId
          }
        );
      }

      const messageId = `msg_${userId}_${Date.now()}`;
      const messageData = {
        messageId,
        senderId: userId,
        recipientId: recipientId || null,
        recipientPhone: recipientPhone ? validatePhoneNumber(recipientPhone) : null,
        message: message.trim(),
        type: type || 'notification',
        groupId: groupId || null,
        status: 'sent',
        createdAt: Date.now(),
        planId,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      db.data.messages[userId].push(messageData);
      db.scheduleSave();

      if (recipientId) {
        if (!db.data.messages[recipientId]) {
          db.data.messages[recipientId] = [];
        }
        db.data.messages[recipientId].push({
          ...messageData,
          messageId: `msg_${recipientId}_${Date.now()}`,
          status: 'received'
        });
        db.scheduleSave();

        try {
          await notificationService.send(recipientId, {
            title: db.findUserById(userId)?.name || db.findUserById(userId)?.displayName || 'Yeni Mesaj',
            message: message.trim(),
            type: 'info',
            deepLink: `bavaxe://messages/${messageId}`,
            data: {
              type: 'location_message',
              messageId,
              senderId: userId,
              groupId: groupId || null
            }
          }, ['database', 'onesignal']);
        } catch (notifError) {
          logger.error('[LocationController] Message notification error:', notifError);
        }
      }

      if (recipientPhone && type === 'sms' && planLimits.smsEnabled) {
        const maxSMS = planLimits.maxSMS || 0;
        if (maxSMS > 0) {
          const userSMS = db.data.messages[userId].filter(m => m.type === 'sms');
          if (userSMS.length >= maxSMS) {
            throw createError(
              `SMS limiti aşıldı. Maksimum ${maxSMS} SMS gönderebilirsiniz.`,
              403,
              'SMS_LIMIT_EXCEEDED',
              {
                limit: maxSMS,
                current: userSMS.length,
                planId
              }
            );
          }
        }

        try {
          const smsService = require('../services/smsService');
          await smsService.send(recipientPhone, message.trim());
        } catch (smsError) {
          logger.error('[LocationController] SMS send error:', smsError);
          throw createError('SMS gönderilemedi', 500, 'SMS_SEND_ERROR');
        }
      }

      const processingTime = Date.now() - startTime;
      trackRequest('sendMessage', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'send_message', {
        messageId,
        recipientId,
        recipientPhone,
        type,
        groupId,
        planId,
        path: req.path
      });

      logger.info('Message sent successfully', { userId, messageId, planId, processingTime, type });

      return res.json(ResponseFormatter.success({
        messageId,
        status: 'sent',
        message: 'Mesaj gönderildi',
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('sendMessage', 'unknown', processingTime, false);
      trackError('sendMessage', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Send message validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Send message error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Mesaj gönderilemedi', 'MESSAGE_SEND_ERROR'));
    }
  }

  async getMessages(req, res) {
    const startTime = Date.now();
    try {
      const { groupId, limit = 50, offset = 0 } = req.query;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      const cacheKey = `messages:${userId}:${groupId || 'all'}:${limit}:${offset}`;

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, userId);
        if (cached) {
          const response = {
            ...cached,
            cached: true,
            _performance: {
              boost: planLimits.performanceBoost,
              cached: true,
              priority: planLimits.priorityProcessing
            }
          };
          if (planLimits.responseOptimization) {
            return res.json(applyPerformanceOptimization(req, res, planLimits, response));
          }
          return res.json(ResponseFormatter.success(response));
        }
      }

      if (!db.data.messages || !db.data.messages[userId]) {
        return res.json(ResponseFormatter.success({
          messages: [],
          count: 0,
          _performance: {
            boost: planLimits.performanceBoost,
            planId
          }
        }));
      }

      let messages = db.data.messages[userId];

      const retentionDays = planLimits.messageRetentionDays;
      if (retentionDays > 0) {
        const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        messages = messages.filter(m => m.createdAt > cutoff);
      }

      if (groupId) {
        messages = messages.filter(m => m.groupId === groupId);
      }

      const total = messages.length;
      const paginated = messages
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      const response = await processWithPlanOptimization(req, res, planLimits, async () => ({
        messages: paginated,
        count: total,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        },
        performance: {
          boost: planLimits.performanceBoost,
          queryOptimization: planLimits.queryOptimization,
          smartCaching: planLimits.smartCaching
        }
      }), 'getMessages');

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, planLimits.cacheTTL, userId);
      }

      activityLogService.logActivity(userId, 'location', 'view_messages', {
        groupId,
        limit: parseInt(limit),
        offset: parseInt(offset),
        messageCount: total,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(response));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getMessages', 'unknown', processingTime, false);

      if (error.isOperational) {
        logger.warn('Get messages validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get messages error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Mesajlar alınamadı', 'MESSAGES_FETCH_ERROR'));
    }
  }

  async sendLocationMessage(req, res) {
    const startTime = Date.now();
    try {
      const { recipientId, recipientPhone, lat, lng, name, address, message, groupId } = req.body;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      const { lat: latNum, lng: lngNum } = validateCoordinates(lat, lng, 'Konum koordinatları');

      const locationMessage = message || `Konum paylaşıldı: ${name || address || `${latNum}, ${lngNum}`}`;
      const googleMapsUrl = `https://www.google.com/maps?q=${latNum},${lngNum}`;
      const appleMapsUrl = `https://maps.apple.com/?ll=${latNum},${lngNum}`;

      if (groupId) {
        checkGroupAccess(userId, groupId);
      }

      const messageId = `loc_msg_${userId}_${Date.now()}`;

      if (!db.data.messages) {
        db.data.messages = {};
      }

      if (!db.data.messages[userId]) {
        db.data.messages[userId] = [];
      }

      const messageData = {
        messageId,
        senderId: userId,
        recipientId: recipientId || null,
        recipientPhone: recipientPhone ? validatePhoneNumber(recipientPhone) : null,
        message: locationMessage,
        type: 'location_share',
        location: {
          lat: latNum,
          lng: lngNum,
          name: name || null,
          address: address || null,
          googleMapsUrl,
          appleMapsUrl
        },
        groupId: groupId || null,
        status: 'sent',
        createdAt: Date.now(),
        planId,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      db.data.messages[userId].push(messageData);
      db.scheduleSave();

      if (recipientId) {
        if (!db.data.messages[recipientId]) {
          db.data.messages[recipientId] = [];
        }
        db.data.messages[recipientId].push({
          ...messageData,
          messageId: `loc_msg_${recipientId}_${Date.now()}`,
          status: 'received'
        });
        db.scheduleSave();

        try {
          await notificationService.send(recipientId, {
            title: '📍 Konum Paylaşıldı',
            message: locationMessage,
            type: 'info',
            deepLink: `bavaxe://location/share/${messageId}`,
            data: {
              type: 'location_share',
              messageId,
              senderId: userId,
              lat: latNum,
              lng: lngNum,
              groupId: groupId || null
            }
          }, ['database', 'onesignal']);

          if (groupId) {
            try {
              await autoNotificationService.notifyGroupActivity(groupId, 'location_shared', userId, {
                lat: latNum,
                lng: lngNum
              }).catch(err => {
                logger.debug('Group activity notification skipped:', err.message);
              });
            } catch (groupNotifError) {
              logger.debug('Group activity notification error (non-critical):', groupNotifError.message);
            }
          }
        } catch (notifError) {
          logger.error('[LocationController] Location message notification error:', notifError);
        }
      }

      const processingTime = Date.now() - startTime;
      trackRequest('sendLocationMessage', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'send_location_message', {
        messageId,
        recipientId,
        recipientPhone,
        lat: latNum,
        lng: lngNum,
        groupId,
        planId,
        path: req.path
      });

      logger.info('Location message sent successfully', { userId, messageId, planId, processingTime });

      return res.json(ResponseFormatter.success({
        messageId,
        location: {
          lat: latNum,
          lng: lngNum,
          name: name || null,
          address: address || null,
          googleMapsUrl,
          appleMapsUrl
        },
        message: 'Konum mesajı gönderildi',
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('sendLocationMessage', 'unknown', processingTime, false);
      trackError('sendLocationMessage', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Send location message validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Send location message error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Konum mesajı gönderilemedi', 'LOCATION_MESSAGE_ERROR'));
    }
  }

  detectVehicleUsage(locations) {
    if (!locations || locations.length < 2) {
      return { isInVehicle: false, confidence: 0, reason: 'Yetersiz veri' };
    }

    const recentLocations = locations.slice(-10);
    let vehicleIndicators = 0;
    let totalSpeed = 0;
    let speedCount = 0;
    let totalDistance = 0;
    let timeSpan = 0;

    const calculateDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371e3;
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lng2 - lng1) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    };

    for (let i = 1; i < recentLocations.length; i++) {
      const prev = recentLocations[i - 1];
      const curr = recentLocations[i];

      if (!prev.coords || !curr.coords) continue;

      const timeDiff = (curr.timestamp - prev.timestamp) / 1000;
      if (timeDiff <= 0 || timeDiff > 300) continue;

      const lat1 = prev.coords.latitude;
      const lng1 = prev.coords.longitude;
      const lat2 = curr.coords.latitude;
      const lng2 = curr.coords.longitude;

      const distance = calculateDistance(lat1, lng1, lat2, lng2);
      const speed = (distance / timeDiff) * 3.6;

      if (speed > 0) {
        totalSpeed += speed;
        speedCount++;
        totalDistance += distance;
        timeSpan += timeDiff;

        if (speed > 20) {
          vehicleIndicators += 2;
        } else if (speed > 10) {
          vehicleIndicators += 1;
        } else if (speed > 5) {
          vehicleIndicators += 0.5;
        }
      }

      if (curr.coords.speed && curr.coords.speed > 0) {
        const gpsSpeed = curr.coords.speed * 3.6;
        if (gpsSpeed > 20) {
          vehicleIndicators += 1.5;
        } else if (gpsSpeed > 10) {
          vehicleIndicators += 0.5;
        }
      }
    }

    const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
    const avgSpeedKmh = totalDistance > 0 && timeSpan > 0 ? (totalDistance / timeSpan) * 3.6 : 0;
    const finalSpeed = Math.max(avgSpeed, avgSpeedKmh);

    let confidence = 0;
    let reason = '';

    if (finalSpeed > 30) {
      confidence = Math.min(95, 60 + (finalSpeed - 30) * 1.5);
      reason = `Yüksek hız tespiti: ${finalSpeed.toFixed(1)} km/h`;
    } else if (finalSpeed > 20) {
      confidence = 70 + (finalSpeed - 20);
      reason = `Orta hız tespiti: ${finalSpeed.toFixed(1)} km/h`;
    } else if (finalSpeed > 10) {
      confidence = 50 + (finalSpeed - 10) * 2;
      reason = `Düşük hız tespiti: ${finalSpeed.toFixed(1)} km/h`;
    } else {
      confidence = Math.max(0, 30 - (10 - finalSpeed) * 3);
      reason = `Yavaş hareket: ${finalSpeed.toFixed(1)} km/h`;
    }

    confidence = Math.min(95, confidence + (vehicleIndicators * 5));

    const isInVehicle = confidence > 60;

    return {
      isInVehicle,
      confidence: Math.round(confidence),
      speed: finalSpeed,
      avgSpeed: avgSpeed,
      distance: totalDistance,
      timeSpan: timeSpan,
      reason,
      indicators: vehicleIndicators,
      locationCount: recentLocations.length
    };
  }

  detectActivityType(locations) {
    if (!locations || locations.length < 2) {
      return {
        activity: 'stationary',
        confidence: 0,
        speed: 0,
        reason: 'Yetersiz veri',
        icon: '📍',
        color: '#64748b'
      };
    }

    const recentLocations = locations.slice(-10);
    let totalSpeed = 0;
    let speedCount = 0;
    let totalDistance = 0;
    let timeSpan = 0;
    let accelerationCount = 0;
    let decelerationCount = 0;
    let maxSpeed = 0;
    let speedVariance = 0;
    const speeds = [];

    const calculateDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371e3;
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    for (let i = 1; i < recentLocations.length; i++) {
      const prev = recentLocations[i - 1];
      const curr = recentLocations[i];

      if (!prev.coords || !curr.coords) continue;

      const timeDiff = (curr.timestamp - prev.timestamp) / 1000;
      if (timeDiff <= 0 || timeDiff > 300) continue;

      const lat1 = prev.coords.latitude;
      const lng1 = prev.coords.longitude;
      const lat2 = curr.coords.latitude;
      const lng2 = curr.coords.longitude;

      const distance = calculateDistance(lat1, lng1, lat2, lng2);
      const speed = (distance / timeDiff) * 3.6;

      if (speed > 0) {
        speeds.push(speed);
        totalSpeed += speed;
        speedCount++;
        totalDistance += distance;
        timeSpan += timeDiff;
        maxSpeed = Math.max(maxSpeed, speed);

        if (i > 1) {
          const prevSpeed = speeds[speeds.length - 2] || 0;
          if (speed > prevSpeed + 5) {
            accelerationCount++;
          } else if (speed < prevSpeed - 5) {
            decelerationCount++;
          }
        }
      }

      if (curr.coords.speed && curr.coords.speed > 0) {
        const gpsSpeed = curr.coords.speed * 3.6;
        speeds.push(gpsSpeed);
        totalSpeed += gpsSpeed;
        speedCount++;
        maxSpeed = Math.max(maxSpeed, gpsSpeed);
      }
    }

    const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
    const avgSpeedKmh = totalDistance > 0 && timeSpan > 0 ? (totalDistance / timeSpan) * 3.6 : 0;
    const finalSpeed = Math.max(avgSpeed, avgSpeedKmh);

    if (speeds.length > 1) {
      const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      speedVariance = speeds.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / speeds.length;
    }

    let activity = 'stationary';
    let confidence = 0;
    let reason = '';
    let icon = '📍';
    let color = '#64748b';

    if (finalSpeed < 1) {
      activity = 'stationary';
      confidence = 95;
      reason = 'Yerinde duruyor';
      icon = '📍';
      color = '#64748b';
    } else if (finalSpeed >= 1 && finalSpeed < 8) {
      activity = 'walking';
      confidence = Math.min(90, 60 + (finalSpeed - 1) * 4);
      reason = `Yürüyor: ${finalSpeed.toFixed(1)} km/h`;
      icon = '🚶';
      color = '#06b6d4';
    } else if (finalSpeed >= 8 && finalSpeed < 25) {
      if (speedVariance > 50 && accelerationCount > decelerationCount) {
        activity = 'motorcycle';
        confidence = Math.min(85, 70 + (finalSpeed - 8) * 0.8);
        reason = `Motor kullanıyor: ${finalSpeed.toFixed(1)} km/h`;
        icon = '🏍️';
        color = '#f59e0b';
      } else {
        activity = 'cycling';
        confidence = Math.min(80, 65 + (finalSpeed - 8) * 0.9);
        reason = `Bisiklet: ${finalSpeed.toFixed(1)} km/h`;
        icon = '🚴';
        color = '#10b981';
      }
    } else if (finalSpeed >= 25 && finalSpeed < 60) {
      if (speedVariance < 30 && accelerationCount < 3) {
        activity = 'driving';
        confidence = Math.min(92, 75 + (finalSpeed - 25) * 0.5);
        reason = `Araba kullanıyor: ${finalSpeed.toFixed(1)} km/h`;
        icon = '🚗';
        color = '#3b82f6';
      } else {
        activity = 'motorcycle';
        confidence = Math.min(88, 70 + (finalSpeed - 25) * 0.6);
        reason = `Motor kullanıyor: ${finalSpeed.toFixed(1)} km/h`;
        icon = '🏍️';
        color = '#f59e0b';
      }
    } else if (finalSpeed >= 60) {
      activity = 'driving';
      confidence = Math.min(95, 85 + (finalSpeed - 60) * 0.2);
      reason = `Hızlı araba: ${finalSpeed.toFixed(1)} km/h`;
      icon = '🚗';
      color = '#ef4444';
    }

    return {
      activity,
      confidence: Math.round(confidence),
      speed: finalSpeed,
      maxSpeed,
      avgSpeed: avgSpeed,
      distance: totalDistance,
      timeSpan: timeSpan,
      reason,
      icon,
      color,
      speedVariance: Math.round(speedVariance),
      accelerationCount,
      decelerationCount,
      locationCount: recentLocations.length
    };
  }

  async trackVehicle(req, res) {
    const startTime = Date.now();
    try {
      const { deviceId, groupId } = req.query;

      if (!deviceId) {
        throw createError('Device ID gereklidir', 400, 'MISSING_DEVICE_ID');
      }

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      if (deviceId !== userId) {
        const group = groupId ? db.getGroupById(groupId) : null;
        if (group) {
          const members = db.getMembers(groupId) || [];
          const isMember = Array.isArray(members) && members.some(m => m.userId === userId);
          if (!isMember) {
            throw createError('Bu grup için yetkiniz yok', 403, 'GROUP_ACCESS_DENIED');
          }
        } else {
          throw createError('Bu cihaz için yetkiniz yok', 403, 'DEVICE_ACCESS_DENIED');
        }
      }

      const locations = db.getStore(deviceId);
      if (!locations || locations.length < 2) {
        return res.json(ResponseFormatter.success({
          isInVehicle: false,
          confidence: 0,
          reason: 'Yetersiz konum verisi',
          locations: locations || [],
          _performance: {
            boost: planLimits.performanceBoost,
            planId
          }
        }));
      }

      const detection = this.detectVehicleUsage(locations);
      const latestLocation = locations[locations.length - 1];

      if (!db.data.vehicleTracking) {
        db.data.vehicleTracking = {};
      }

      const vehicleId = `vehicle_${deviceId}_${Date.now()}`;
      const vehicleData = {
        vehicleId,
        deviceId,
        userId: deviceId,
        isInVehicle: detection.isInVehicle,
        confidence: detection.confidence,
        speed: detection.speed || 0,
        location: {
          lat: latestLocation.coords.latitude,
          lng: latestLocation.coords.longitude,
          accuracy: latestLocation.coords.accuracy,
          timestamp: latestLocation.timestamp
        },
        detection: {
          reason: detection.reason,
          indicators: detection.indicators,
          avgSpeed: detection.avgSpeed,
          distance: detection.distance,
          timeSpan: detection.timeSpan
        },
        groupId: groupId || null,
        planId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      if (detection.isInVehicle && detection.confidence > 70) {
        db.data.vehicleTracking[vehicleId] = vehicleData;
        db.scheduleSave();

        try {
          await notificationService.send(deviceId, {
            title: '🚗 Araç Kullanımı Tespit Edildi',
            message: `Araç kullanımı tespit edildi. Hız: ${detection.speed?.toFixed(1) || 0} km/h`,
            type: 'info',
            deepLink: `bavaxe://track?vehicleId=${vehicleId}`,
            data: {
              type: 'vehicle_detected',
              vehicleId,
              speed: detection.speed,
              confidence: detection.confidence
            }
          }, ['database', 'onesignal']);
        } catch (notifError) {
          logger.error('[LocationController] Vehicle notification error:', notifError);
        }
      }

      const processingTime = Date.now() - startTime;
      trackRequest('trackVehicle', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'track_vehicle', {
        deviceId,
        isInVehicle: detection.isInVehicle,
        confidence: detection.confidence,
        planId,
        path: req.path
      });

      logger.info('Vehicle tracking completed', { deviceId, isInVehicle: detection.isInVehicle, confidence: detection.confidence, planId, processingTime });

      return res.json(ResponseFormatter.success({
        ...vehicleData,
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('trackVehicle', 'unknown', processingTime, false);
      trackError('trackVehicle', 'unknown', error.code || 'UNKNOWN_ERROR');

      if (error.isOperational) {
        logger.warn('Track vehicle validation error', { error: error.message, code: error.code });
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Track vehicle error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Araç takibi yapılamadı', 'VEHICLE_TRACKING_ERROR'));
    }
  }

  async getVehicleStatus(req, res) {
    const startTime = Date.now();
    try {
      const { deviceId, groupId } = req.query;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      if (!deviceId) {
        throw createError('Device ID gereklidir', 400, 'MISSING_DEVICE_ID');
      }

      if (deviceId !== userId) {
        if (groupId) {
          checkGroupAccess(userId, groupId);
        } else {
          throw createError('Bu cihaz için yetkiniz yok', 403, 'DEVICE_ACCESS_DENIED');
        }
      }

      const locations = db.getStore(deviceId);
      if (!locations || locations.length < 2) {
        return res.json(ResponseFormatter.success({
          isInVehicle: false,
          confidence: 0,
          status: 'unknown',
          activity: 'stationary',
          reason: 'Yetersiz konum verisi',
          _performance: {
            boost: planLimits.performanceBoost,
            planId
          }
        }));
      }

      const detection = this.detectVehicleUsage(locations);
      const activity = this.detectActivityType(locations);
      const latestLocation = locations[locations.length - 1];

      let status = 'parked';
      if (detection.isInVehicle) {
        if (detection.speed > 50) {
          status = 'driving_fast';
        } else if (detection.speed > 20) {
          status = 'driving';
        } else {
          status = 'driving_slow';
        }
      } else if (detection.speed > 0 && detection.speed < 10) {
        status = 'walking';
      }

      const processingTime = Date.now() - startTime;
      trackRequest('getVehicleStatus', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'view_vehicle_status', {
        deviceId,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        isInVehicle: detection.isInVehicle,
        confidence: detection.confidence,
        status,
        activity: activity.activity,
        activityIcon: activity.icon,
        activityColor: activity.color,
        speed: detection.speed || 0,
        location: {
          lat: latestLocation.coords.latitude,
          lng: latestLocation.coords.longitude,
          accuracy: latestLocation.coords.accuracy,
          timestamp: latestLocation.timestamp
        },
        detection: {
          reason: activity.reason,
          indicators: detection.indicators,
          avgSpeed: detection.avgSpeed
        },
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getVehicleStatus', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get vehicle status error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Araç durumu alınamadı', 'VEHICLE_STATUS_ERROR'));
    }
  }

  async getActivityStatus(req, res) {
    const startTime = Date.now();
    try {
      const { deviceId, groupId } = req.query;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      if (!deviceId) {
        throw createError('Device ID gereklidir', 400, 'MISSING_DEVICE_ID');
      }

      if (deviceId !== userId) {
        if (groupId) {
          checkGroupAccess(userId, groupId);
        } else {
          throw createError('Bu cihaz için yetkiniz yok', 403, 'DEVICE_ACCESS_DENIED');
        }
      }

      const locationActivityService = require('../services/locationActivityService');
      const locations = db.getStore(deviceId);
      if (!locations || locations.length < 2) {
        return res.json(ResponseFormatter.success({
          activity: 'stationary',
          confidence: 0,
          speed: 0,
          reason: 'Yetersiz konum verisi',
          icon: '📍',
          color: '#64748b',
          _performance: {
            boost: planLimits.performanceBoost,
            planId
          }
        }));
      }

      const latestLocation = locations[locations.length - 1];
      const previousLocation = locations.length > 1 ? locations[locations.length - 2] : null;
      const activity = locationActivityService.detectActivityType(latestLocation, previousLocation);

      const speedKmh = latestLocation.coords?.speed ? latestLocation.coords.speed * 3.6 : 0;
      const colorMap = {
        'home': '#8b5cf6',
        'stationary': '#64748b',
        'walking': '#10b981',
        'cycling': '#06b6d4',
        'motorcycle': '#f59e0b',
        'driving': '#ef4444'
      };

      const processingTime = Date.now() - startTime;
      trackRequest('getActivityStatus', planId, processingTime, true);

      activityLogService.logActivity(userId, 'location', 'view_activity_status', {
        deviceId,
        activity: activity.activity,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success({
        activity: activity.type,
        confidence: activity.confidence,
        speed: speedKmh,
        reason: activity.name,
        icon: activity.icon,
        color: colorMap[activity.type] || '#64748b',
        location: {
          lat: latestLocation.coords.latitude,
          lng: latestLocation.coords.longitude,
          accuracy: latestLocation.coords.accuracy,
          timestamp: latestLocation.timestamp
        },
        _performance: {
          boost: planLimits.performanceBoost,
          processingTime: `${processingTime}ms`,
          planId
        }
      }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getActivityStatus', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get activity status error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Aktivite durumu alınamadı', 'ACTIVITY_STATUS_ERROR'));
    }
  }

  async getVehicleHistory(req, res) {
    const startTime = Date.now();
    try {
      const { deviceId, groupId, limit = 50, offset = 0 } = req.query;

      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);

      if (!deviceId) {
        throw createError('Device ID gereklidir', 400, 'MISSING_DEVICE_ID');
      }

      if (deviceId !== userId) {
        if (groupId) {
          checkGroupAccess(userId, groupId);
        } else {
          throw createError('Bu cihaz için yetkiniz yok', 403, 'DEVICE_ACCESS_DENIED');
        }
      }

      const cacheKey = `vehicle_history:${deviceId}:${groupId || 'all'}:${limit}:${offset}`;

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, userId);
        if (cached) {
          return res.json(ResponseFormatter.success({
            ...cached,
            cached: true,
            _performance: {
              boost: planLimits.performanceBoost,
              cached: true,
              planId
            }
          }));
        }
      }

      if (!db.data.vehicleTracking) {
        return res.json(ResponseFormatter.success({
          vehicles: [],
          count: 0,
          _performance: {
            boost: planLimits.performanceBoost,
            planId
          }
        }));
      }

      let vehicles = Object.values(db.data.vehicleTracking || {}).filter(
        v => v.deviceId === deviceId && v.isInVehicle
      );

      if (groupId) {
        vehicles = vehicles.filter(v => v.groupId === groupId);
      }

      const total = vehicles.length;
      const paginated = vehicles
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      const response = await processWithPlanOptimization(req, res, planLimits, async () => ({
        vehicles: paginated,
        count: total,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        },
        performance: {
          boost: planLimits.performanceBoost,
          queryOptimization: planLimits.queryOptimization,
          smartCaching: planLimits.smartCaching
        }
      }), 'getVehicleHistory');

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, planLimits.cacheTTL, userId);
      }

      return res.json(ResponseFormatter.success(response));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getVehicleHistory', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get vehicle history error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Araç geçmişi alınamadı', 'VEHICLE_HISTORY_ERROR'));
    }
  }

  async getGroupVehicles(req, res) {
    const startTime = Date.now();
    try {
      const { groupId } = req.query;

      if (!groupId) {
        throw createError('Grup ID gereklidir', 400, 'MISSING_GROUP_ID');
      }

      const userId = getUserIdFromToken(req);
      checkGroupAccess(userId, groupId);

      const { planId, planLimits } = getUserPlan(userId);

      const cacheKey = `group_vehicles:${groupId}`;

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        const cached = cacheService.get(cacheKey, userId);
        if (cached) {
          return res.json(ResponseFormatter.success({
            ...cached,
            cached: true,
            _performance: {
              boost: planLimits.performanceBoost,
              cached: true,
              planId
            }
          }));
        }
      }

      const members = db.getMembers(groupId) || [];
      const vehicles = [];

      for (const member of (Array.isArray(members) ? members : [])) {
        if (!member || !member.userId) continue;
        const locations = db.getStore(member.userId);
        if (locations && locations.length >= 2) {
          const detection = this.detectVehicleUsage(locations);
          if (detection.isInVehicle && detection.confidence > 60) {
            const latestLocation = locations[locations.length - 1];
            const user = db.findUserById(member.userId);
            vehicles.push({
              userId: member.userId,
              name: user?.name || user?.displayName || 'Bilinmeyen',
              phone: user?.phone || null,
              isInVehicle: true,
              confidence: detection.confidence,
              speed: detection.speed || 0,
              status: detection.speed > 50 ? 'driving_fast' : detection.speed > 20 ? 'driving' : 'driving_slow',
              location: {
                lat: latestLocation.coords.latitude,
                lng: latestLocation.coords.longitude,
                accuracy: latestLocation.coords.accuracy,
                timestamp: latestLocation.timestamp
              },
              detection: {
                reason: detection.reason,
                avgSpeed: detection.avgSpeed
              }
            });
          }
        }
      }

      const response = await processWithPlanOptimization(req, res, planLimits, async () => ({
        vehicles,
        count: vehicles.length,
        groupId,
        performance: {
          boost: planLimits.performanceBoost,
          parallelProcessing: planLimits.parallelProcessing,
          smartCaching: planLimits.smartCaching
        }
      }), 'getGroupVehicles');

      if (planLimits.smartCaching || planLimits.cacheEnabled) {
        cacheService.set(cacheKey, response, planLimits.cacheTTL, userId);
      }

      activityLogService.logActivity(userId, 'location', 'view_group_vehicles', {
        groupId,
        vehicleCount: vehicles.length,
        planId,
        path: req.path
      });

      return res.json(ResponseFormatter.success(response));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getGroupVehicles', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get group vehicles error', error, { processingTime });
    }
  }

  // Start vehicle session
  async startVehicleSession(req, res) {
    const startTime = Date.now();
    try {
      const userId = getUserIdFromToken(req);
      const { planId, planLimits } = getUserPlan(userId);
      const { groupId, vehicleType = 'car' } = req.body;

      if (!groupId) {
        return res.status(400).json(ResponseFormatter.error('groupId gereklidir', 'MISSING_GROUP_ID'));
      }

      // Check group access
      checkGroupAccess(userId, groupId);

      // Initialize vehicle sessions if not exists
      if (!db.data.vehicleSessions) {
        db.data.vehicleSessions = {};
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const session = {
        id: sessionId,
        userId,
        groupId,
        vehicleType,
        startTime: Date.now(),
        endTime: null,
        status: 'active',
        maxSpeed: 0,
        avgSpeed: 0,
        distance: 0,
        violations: []
      };

      db.data.vehicleSessions[sessionId] = session;
      db.scheduleSave();

      const processingTime = Date.now() - startTime;
      trackRequest('startVehicleSession', planId, processingTime, true);

      activityLogService.logActivity(userId, 'vehicle', 'start_session', {
        sessionId,
        groupId,
        vehicleType,
        path: req.path
      });

      return res.json(ResponseFormatter.success({ session }, 'Araç oturumu başlatıldı', 201));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('startVehicleSession', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Start vehicle session error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Araç oturumu başlatılamadı', 'VEHICLE_SESSION_START_ERROR'));
    }
  }

  // End vehicle session
  async endVehicleSession(req, res) {
    const startTime = Date.now();
    try {
      const userId = getUserIdFromToken(req);
      const { planId } = getUserPlan(userId);
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json(ResponseFormatter.error('sessionId gereklidir', 'MISSING_SESSION_ID'));
      }

      const session = db.data.vehicleSessions?.[sessionId];
      if (!session) {
        return res.status(404).json(ResponseFormatter.error('Oturum bulunamadı', 'SESSION_NOT_FOUND'));
      }

      if (session.userId !== userId) {
        return res.status(403).json(ResponseFormatter.error('Bu oturuma erişim yetkiniz yok', 'SESSION_ACCESS_DENIED'));
      }

      session.endTime = Date.now();
      session.status = 'completed';
      session.duration = session.endTime - session.startTime;

      db.scheduleSave();

      const processingTime = Date.now() - startTime;
      trackRequest('endVehicleSession', planId, processingTime, true);

      activityLogService.logActivity(userId, 'vehicle', 'end_session', {
        sessionId,
        duration: session.duration,
        path: req.path
      });

      return res.json(ResponseFormatter.success({ session }, 'Araç oturumu sonlandırıldı'));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('endVehicleSession', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('End vehicle session error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Araç oturumu sonlandırılamadı', 'VEHICLE_SESSION_END_ERROR'));
    }
  }

  // Record speed violation
  async recordSpeedViolation(req, res) {
    const startTime = Date.now();
    try {
      const userId = getUserIdFromToken(req);
      const { planId } = getUserPlan(userId);
      const { sessionId, speed, speedLimit, location } = req.body;

      if (!sessionId || !speed || !speedLimit) {
        return res.status(400).json(ResponseFormatter.error('sessionId, speed ve speedLimit gereklidir', 'MISSING_FIELDS'));
      }

      const session = db.data.vehicleSessions?.[sessionId];
      if (!session) {
        return res.status(404).json(ResponseFormatter.error('Oturum bulunamadı', 'SESSION_NOT_FOUND'));
      }

      if (session.userId !== userId) {
        return res.status(403).json(ResponseFormatter.error('Bu oturuma erişim yetkiniz yok', 'SESSION_ACCESS_DENIED'));
      }

      const violation = {
        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        speed,
        speedLimit,
        excess: speed - speedLimit,
        location: location || null
      };

      if (!session.violations) {
        session.violations = [];
      }
      session.violations.push(violation);

      db.scheduleSave();

      // Send notification
      try {
        await notificationService.send(userId, {
          title: '⚠️ Hız Limiti Aşıldı',
          message: `${speed} km/h hızla ${speedLimit} km/h limitini aştınız!`,
          type: 'warning',
          data: { sessionId, violationId: violation.id, type: 'speed_violation' }
        }, ['database', 'onesignal']);
      } catch (notifError) {
        logger.warn('Speed violation notification error', { error: notifError.message });
      }

      const processingTime = Date.now() - startTime;
      trackRequest('recordSpeedViolation', planId, processingTime, true);

      activityLogService.logActivity(userId, 'vehicle', 'speed_violation', {
        sessionId,
        speed,
        speedLimit,
        excess: violation.excess,
        path: req.path
      });

      return res.json(ResponseFormatter.success({ violation }, 'Hız ihlali kaydedildi', 201));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('recordSpeedViolation', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Record speed violation error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Hız ihlali kaydedilemedi', 'SPEED_VIOLATION_ERROR'));
    }
  }

  // Get vehicle sessions
  async getVehicleSessions(req, res) {
    const startTime = Date.now();
    try {
      const userId = getUserIdFromToken(req);
      const { planId } = getUserPlan(userId);
      const { groupId, status } = req.query;

      let sessions = Object.values(db.data.vehicleSessions || {});

      // Filter by user
      sessions = sessions.filter(s => s.userId === userId);

      // Filter by group if specified
      if (groupId) {
        sessions = sessions.filter(s => s.groupId === groupId);
      }

      // Filter by status if specified
      if (status) {
        sessions = sessions.filter(s => s.status === status);
      }

      // Sort by start time (newest first)
      sessions.sort((a, b) => b.startTime - a.startTime);

      const processingTime = Date.now() - startTime;
      trackRequest('getVehicleSessions', planId, processingTime, true);

      activityLogService.logActivity(userId, 'vehicle', 'view_sessions', {
        count: sessions.length,
        groupId,
        status,
        path: req.path
      });

      return res.json(ResponseFormatter.success({ sessions, count: sessions.length }));
    } catch (error) {
      const processingTime = Date.now() - startTime;
      trackRequest('getVehicleSessions', 'unknown', processingTime, false);

      if (error.isOperational) {
        return res.status(error.statusCode).json(ResponseFormatter.error(error.message, error.code, error.details));
      }

      logger.error('Get vehicle sessions error', error, { processingTime });
      return res.status(500).json(ResponseFormatter.error('Araç oturumları alınamadı', 'VEHICLE_SESSIONS_ERROR'));
    }
  }
}

module.exports = new LocationController();
