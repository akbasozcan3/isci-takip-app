const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');

const router = express.Router();

// API Versioning Middleware (optional, can be enabled per route)
const { apiVersionMiddleware } = require('../core/middleware/apiVersion.middleware');

router.use(helmet());
router.use(compression());
router.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
router.use(bodyParser.json({ limit: '10mb' }));
router.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// API Versioning (optional - can be enabled for specific routes)
// router.use(apiVersionMiddleware);

const requestLogger = require('../core/middleware/requestLogger');
const performanceMiddleware = require('../core/middleware/performance.middleware');
const tracingMiddleware = require('../core/middleware/tracing.middleware');
const securityMiddleware = require('../core/middleware/security.middleware');
const responseMiddleware = require('../core/middleware/response.middleware');
const inputSanitizer = require('../core/middleware/inputSanitizer.middleware');
const { asyncHandler } = require('../core/middleware/errorHandler.middleware');
const { validateCoordinates, validateGroupId, validateDeviceId, validateUserId, validateDeliveryId, validateRouteId, validateArticleId, validateReportId, validatePaymentId, validateRequestId } = require('../core/middleware/requestValidator.middleware');
const rateLimiter = require('../core/middleware/rateLimiter');

router.use(require('../core/middleware/requestId.middleware'));
router.use(require('../core/middleware/startupCheck.middleware'));
router.use(tracingMiddleware);
router.use(securityMiddleware);
router.use(require('../core/middleware/securityEnhancer.middleware'));
router.use(inputSanitizer);
router.use(performanceMiddleware);
router.use(require('../core/middleware/performanceOptimizer.middleware'));
router.use(require('../core/middleware/monitoring.middleware'));
router.use(require('../core/middleware/performanceTracking.middleware'));
router.use(require('../core/middleware/queryOptimizer.middleware'));
router.use(require('../core/middleware/database.middleware'));
router.use(require('../core/middleware/auditLog.middleware'));
router.use(require('../core/middleware/responseOptimizer.middleware'));
router.use(requestLogger);
router.use(responseMiddleware);

// API Response Caching (for GET requests)
const apiResponseCache = require('../core/middleware/apiResponseCache.middleware');
router.use(apiResponseCache());

router.use(rateLimiter());

const { attachSubscription } = require('../core/middleware/subscriptionCheck');
router.use(attachSubscription);

const activityLogger = require('../middleware/activityLogger');
router.use(activityLogger);

// Professional Health Check
const { healthCheckMiddleware } = require('../core/middleware/healthCheck.middleware');
router.get('/health', healthCheckMiddleware);
router.get('/api/health', healthCheckMiddleware); // Alias for consistency

// System Status Controller
const systemStatusController = require('../controllers/systemStatusController');
router.get('/system/status', require('../core/middleware/auth.middleware').requireAuth, systemStatusController.getSystemStatus.bind(systemStatusController));
router.get('/system/health', systemStatusController.getHealthCheck.bind(systemStatusController));
router.get('/system/version', systemStatusController.getApiVersion.bind(systemStatusController));

// Import requireAuth early to avoid hoisting issues
const { requireAuth } = require('../core/middleware/auth.middleware');

// API Metrics Endpoint
router.get('/metrics', requireAuth, (req, res) => {
  try {
    const apiMetrics = require('../core/utils/apiMetrics');
    const databaseService = require('../core/services/database.service');
    const backupService = require('../core/services/backup.service');
    
    const metrics = apiMetrics.getMetrics();
    const dbStats = databaseService.getStats();
    const backupStats = backupService.getStats();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        topEndpoints: apiMetrics.getTopEndpoints(10),
        errorRate: apiMetrics.getErrorRate(),
        database: dbStats,
        backups: backupStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Metrics unavailable',
      message: error.message
    });
  }
});

// Database Backup Endpoints
router.post('/admin/backup/create', requireAuth, async (req, res) => {
  try {
    const backupService = require('../core/services/backup.service');
    const result = await backupService.createBackup({ 
      type: 'manual', 
      userId: req.user?.id,
      trigger: 'api'
    });
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Backup created successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Backup creation failed',
      message: error.message
    });
  }
});

router.get('/admin/backups', requireAuth, (req, res) => {
  try {
    const backupService = require('../core/services/backup.service');
    const backups = backupService.listBackups();
    const stats = backupService.getStats();
    
    res.json({
      success: true,
      data: {
        backups,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      message: error.message
    });
  }
});

router.use('/auth', require('../modules/auth/auth.routes'));

router.get('/users/me', requireAuth, require('../modules/auth/auth.controller').getProfile.bind(require('../modules/auth/auth.controller')));
router.post('/users/update-onesignal-id', requireAuth, require('../modules/auth/auth.controller').updateOnesignalPlayerId.bind(require('../modules/auth/auth.controller')));

const locationController = require('../controllers/locationController');
// Import validation schemas
const { schemas, validate } = require('../core/schemas/apiSchemas');

router.post('/location/store', 
  requireAuth, 
  validate(schemas.storeLocation), 
  asyncHandler(locationController.storeLocation.bind(locationController))
);
router.post('/locations', 
  requireAuth, 
  validate(schemas.storeLocation), 
  asyncHandler(locationController.storeLocation.bind(locationController))
);
router.get('/location/analytics/advanced', locationController.getAdvancedAnalytics.bind(locationController));
router.post('/location/share', requireAuth, locationController.createShareLink.bind(locationController));
router.get('/location/find-by-phone', requireAuth, locationController.findLocationByPhone.bind(locationController));
router.get('/location/:deviceId', requireAuth, validateDeviceId, asyncHandler(locationController.getLocationHistory.bind(locationController)));
router.get('/locations/:deviceId/recent', requireAuth, validateDeviceId, asyncHandler(locationController.getRecentLocations.bind(locationController)));
router.get('/location/:deviceId/latest', requireAuth, validateDeviceId, asyncHandler(locationController.getLatestLocation.bind(locationController)));
router.get('/locations/latest', requireAuth, locationController.getLatestLocations.bind(locationController));
router.get('/location/:deviceId/stats', requireAuth, locationController.getLocationStats.bind(locationController));
router.get('/location/:deviceId/route-optimized', requireAuth, locationController.getRouteOptimized.bind(locationController));
router.get('/location/:deviceId/geofence', requireAuth, locationController.checkGeofence.bind(locationController));
router.get('/location/:deviceId/recommendations', requireAuth, locationController.getTrackingRecommendations.bind(locationController));
router.get('/active', requireAuth, locationController.getActiveDevices.bind(locationController));
router.delete('/location/:deviceId', requireAuth, locationController.deleteLocationData.bind(locationController));
router.get('/devices', requireAuth, locationController.getAllDevices.bind(locationController));

const analyticsController = require('../controllers/analyticsController');
const { requirePremium, requireBusiness, checkFeature } = require('../middleware/premiumCheck');
router.get('/analytics/:deviceId/daily', requireAuth, validateDeviceId, analyticsController.getDailyStats.bind(analyticsController));
router.get('/analytics/:deviceId/weekly', requireAuth, validateDeviceId, analyticsController.getWeeklyStats.bind(analyticsController));
router.get('/analytics/:deviceId/monthly', requireAuth, validateDeviceId, analyticsController.getMonthlyStats.bind(analyticsController));
router.get('/analytics/:deviceId/heatmap', requireAuth, validateDeviceId, requirePremium('Heatmap analytics'), analyticsController.getHeatmapData.bind(analyticsController));
router.get('/analytics/:deviceId/speed', requireAuth, validateDeviceId, requirePremium('Speed analysis'), analyticsController.getSpeedAnalysis.bind(analyticsController));

router.get('/location/:deviceId/analytics', requireAuth, requirePremium('Location analytics'), locationController.getLocationAnalytics.bind(locationController));
router.get('/location/:deviceId/route-metrics', requireAuth, requirePremium('Route metrics'), locationController.getRouteMetrics.bind(locationController));
router.get('/location/:deviceId/quality', requireAuth, locationController.getLocationQuality.bind(locationController));
router.get('/location/:deviceId/prediction', requireAuth, requirePremium('Location prediction'), locationController.getLocationPrediction.bind(locationController));
router.get('/location/share/:shareToken', locationController.getSharedLocation.bind(locationController));
router.post('/location/live/start', requireAuth, locationController.startLiveLocation.bind(locationController));
router.post('/location/family/add', requireAuth, locationController.addFamilyMember.bind(locationController));
router.get('/location/family', requireAuth, locationController.getFamilyLocations.bind(locationController));
router.post('/location/delivery/create', requireAuth, locationController.createDelivery.bind(locationController));
router.get('/location/deliveries', requireAuth, locationController.getDeliveries.bind(locationController));
router.put('/location/delivery/:deliveryId/status', requireAuth, validateDeliveryId, locationController.updateDeliveryStatus.bind(locationController));
router.post('/location/route/save', requireAuth, locationController.saveRoute.bind(locationController));
router.get('/location/routes', requireAuth, locationController.listRoutes.bind(locationController));
router.post('/location/validate-input', requireAuth, locationController.validateInput.bind(locationController));
// Messaging Controller
const messagingController = require('../controllers/messagingController');
router.post('/messages/send', 
  requireAuth, 
  validate(schemas.sendMessage), 
  asyncHandler(messagingController.sendMessage.bind(messagingController))
);
router.get('/messages', requireAuth, asyncHandler(messagingController.getMessages.bind(messagingController)));
router.get('/messages/conversations', requireAuth, asyncHandler(messagingController.getConversations.bind(messagingController)));
router.put('/messages/:messageId/read', requireAuth, asyncHandler(messagingController.markAsRead.bind(messagingController)));
router.put('/messages/read-all', requireAuth, asyncHandler(messagingController.markAllAsRead.bind(messagingController)));
router.delete('/messages/:messageId', requireAuth, asyncHandler(messagingController.deleteMessage.bind(messagingController)));

// Legacy location message endpoints (kept for backward compatibility)
router.post('/location/message/send', requireAuth, locationController.sendMessage.bind(locationController));
router.get('/location/messages', requireAuth, locationController.getMessages.bind(locationController));
router.post('/location/message/location', requireAuth, locationController.sendLocationMessage.bind(locationController));
router.get('/location/metrics', requireAuth, locationController.getMetrics.bind(locationController));
router.get('/location/health', requireAuth, locationController.getHealthStatus.bind(locationController));
router.get('/location/performance', requireAuth, locationController.getPerformanceStats.bind(locationController));
router.get('/location/vehicle/track', requireAuth, locationController.trackVehicle.bind(locationController));
router.get('/location/vehicle/status', requireAuth, locationController.getVehicleStatus.bind(locationController));
router.get('/location/vehicle/history', requireAuth, locationController.getVehicleHistory.bind(locationController));
router.get('/location/vehicle/group', requireAuth, locationController.getGroupVehicles.bind(locationController));
router.get('/location/activity/status', requireAuth, locationController.getActivityStatus.bind(locationController));
router.post('/location/geocode', requireAuth, locationController.geocodeAddress.bind(locationController));
router.get('/location/geocode', requireAuth, asyncHandler(locationController.reverseGeocode.bind(locationController)));

const stepController = require('../controllers/stepController');
router.post('/steps/store', requireAuth, asyncHandler(stepController.storeSteps.bind(stepController)));
router.get('/steps/today', requireAuth, asyncHandler(stepController.getTodaySteps.bind(stepController)));
router.get('/steps/history', requireAuth, asyncHandler(stepController.getStepsHistory.bind(stepController)));
router.get('/steps/stats', requireAuth, asyncHandler(stepController.getStepsStats.bind(stepController)));
router.post('/steps/goal', requireAuth, asyncHandler(stepController.setGoal.bind(stepController)));
router.get('/steps/goal', requireAuth, asyncHandler(stepController.getGoal.bind(stepController)));
router.delete('/steps/goal', requireAuth, asyncHandler(stepController.deleteGoal.bind(stepController)));
router.get('/steps/achievements', requireAuth, asyncHandler(stepController.getAchievements.bind(stepController)));
router.get('/steps/streak', requireAuth, asyncHandler(stepController.getStreak.bind(stepController)));
router.post('/steps/start-tracking', requireAuth, asyncHandler(stepController.startTracking.bind(stepController)));
router.post('/steps/stop-tracking', requireAuth, asyncHandler(stepController.stopTracking.bind(stepController)));

const systemController = require('../controllers/systemController');
router.get('/system/info', systemController.getSystemInfo.bind(systemController));
router.post('/system/backup', systemController.createBackup.bind(systemController));
router.get('/system/backups', systemController.listBackups.bind(systemController));

const adminController = require('../controllers/adminController');
router.post('/admin/reset-all', adminController.resetAllData.bind(adminController));

const blogController = require('../controllers/blogController');
router.get('/articles', blogController.getAllArticles.bind(blogController));
router.get('/articles/search', blogController.searchArticles.bind(blogController));
router.get('/articles/categories', blogController.getCategories.bind(blogController));
router.get('/articles/tags', blogController.getTags.bind(blogController));
router.get('/articles/featured', blogController.getFeaturedArticles.bind(blogController));
router.get('/articles/popular', blogController.getPopularArticles.bind(blogController));
router.get('/articles/slug/:slug', blogController.getArticleBySlug.bind(blogController));
router.get('/articles/:id', validateArticleId, blogController.getArticleById.bind(blogController));
router.post('/articles', blogController.createArticle.bind(blogController));
router.put('/articles/:id', validateArticleId, blogController.updateArticle.bind(blogController));
router.delete('/articles/:id', validateArticleId, blogController.deleteArticle.bind(blogController));

const dashboardController = require('../controllers/dashboardController');
router.get('/dashboard/:userId', requireAuth, validateUserId, dashboardController.getDashboard.bind(dashboardController));
router.get('/dashboard', requireAuth, dashboardController.getDashboard.bind(dashboardController));
router.get('/stats', requireAuth, dashboardController.getStats.bind(dashboardController));

const notificationsController = require('../controllers/notificationsController');
router.get('/notifications', notificationsController.list.bind(notificationsController));
router.post('/notifications/read-all', notificationsController.markAllRead.bind(notificationsController));
router.post('/notifications/:id/read', notificationsController.markRead.bind(notificationsController));
router.post('/notifications/push', notificationsController.sendPush.bind(notificationsController));
router.post('/notifications/test-onesignal', requireAuth, notificationsController.testOneSignal.bind(notificationsController));
router.get('/notifications/onesignal-status', requireAuth, notificationsController.getOneSignalStatus.bind(notificationsController));

const billingController = require('../controllers/billingController');
router.get('/plans', billingController.getPlans.bind(billingController)); // Public endpoint
router.get('/billing/plans', billingController.getPlans.bind(billingController)); // Public endpoint
router.get('/me/subscription', requireAuth, billingController.getMySubscription.bind(billingController));
router.post('/me/subscription/cancel', requireAuth, billingController.cancelSubscription.bind(billingController));
router.post('/me/subscription/renew', requireAuth, billingController.renewSubscription.bind(billingController));
router.put('/me/subscription/change-plan', requireAuth, billingController.changePlan.bind(billingController));
router.post('/checkout', billingController.checkout.bind(billingController));
router.post('/billing/checkout', billingController.checkout.bind(billingController));
router.post('/billing/subscribe', billingController.subscribe.bind(billingController));
const { validatePaymentRequest } = require('../middleware/paymentValidation');
const { paymentRateLimiter, sanitizeCardData } = require('../middleware/paymentSecurity');
router.post('/payment/process', paymentRateLimiter, sanitizeCardData, validatePaymentRequest, billingController.processPayment.bind(billingController));
router.get('/payment/:paymentId/status', validatePaymentId, billingController.getPaymentStatus.bind(billingController));
router.get('/billing/history', billingController.getHistory.bind(billingController));
router.get('/billing/receipts', billingController.getReceipts.bind(billingController));
router.get('/billing/receipt/:receiptNumber', billingController.getReceipt.bind(billingController));
router.get('/checkout/mock/:sessionId', billingController.mockCheckoutPage.bind(billingController));
router.post('/payment/callback', billingController.paymentCallback.bind(billingController));
router.get('/payment/callback', billingController.paymentCallback.bind(billingController));
router.get('/payment/callback/:type', billingController.paymentCallback.bind(billingController));
router.post('/webhook/payment', billingController.handleWebhook.bind(billingController));

const { checkLimit } = require('../core/middleware/subscriptionCheck');
const groupController = require('../controllers/groupController');
router.post('/groups', 
  requireAuth, 
  checkLimit('maxGroups'), 
  validate(schemas.createGroup), 
  asyncHandler(groupController.createGroup.bind(groupController))
);
router.get('/groups/user/:userId/admin', requireAuth, validateUserId, groupController.getGroupsByAdmin.bind(groupController));
router.get('/groups/user/:userId/active', requireAuth, validateUserId, groupController.getActiveGroupsForUser.bind(groupController));
router.get('/groups/:groupId/requests', requireAuth, groupController.getRequests.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/approve', requireAuth, validateGroupId, validateRequestId, groupController.approveRequest.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/reject', requireAuth, validateGroupId, validateRequestId, groupController.rejectRequest.bind(groupController));
router.get('/groups/:groupId/members-with-locations', requireAuth, validateGroupId, asyncHandler(groupController.getMembersWithLocations.bind(groupController)));
router.get('/groups/:groupId/members', requireAuth, validateGroupId, asyncHandler(groupController.getMembers.bind(groupController)));
router.post('/groups/:groupId/locations', requireAuth, validateGroupId, validateCoordinates, asyncHandler(groupController.recordGroupLocation.bind(groupController)));
router.get('/groups/:groupId/locations', requireAuth, validateGroupId, asyncHandler(groupController.getGroupLocations.bind(groupController)));
router.post('/groups/:groupId/leave', requireAuth, groupController.leaveGroup.bind(groupController));
router.post('/groups/:groupId/transfer-admin', requireAuth, groupController.transferAdmin.bind(groupController));
router.delete('/groups/:groupId', requireAuth, groupController.deleteGroup.bind(groupController));
router.get('/groups/:code/info', groupController.getGroupInfoByCode.bind(groupController));
router.post('/groups/:code/join-request', requireAuth, groupController.createJoinRequestByCode.bind(groupController));
router.post('/groups/user/:userId/leave-all', requireAuth, validateUserId, groupController.leaveAllGroups.bind(groupController));
router.post('/user/:userId/purge', requireAuth, groupController.purgeUserData.bind(groupController));

const mapController = require('../controllers/mapController');
router.get('/map/features', requireAuth, mapController.getMapFeatures.bind(mapController));
router.get('/map/layers', requireAuth, mapController.getMapLayers.bind(mapController));
router.post('/map/export', requireAuth, mapController.exportMap.bind(mapController));

const activityController = require('../controllers/activityController');
router.get('/activities', requireAuth, activityController.getActivities.bind(activityController));
router.get('/activities/stats', requireAuth, activityController.getActivityStats.bind(activityController));
router.get('/groups/:groupId/activities', requireAuth, activityController.getGroupActivities.bind(activityController));

const microservicesController = require('../controllers/microservicesController');
const analyticsProcessingService = require('../services/analyticsProcessingService');
const reportsService = require('../services/reportsService');

router.get('/microservices/status', microservicesController.getServiceStatus.bind(microservicesController));
router.get('/microservices/analytics/:userId', microservicesController.getAnalytics.bind(microservicesController));
router.post('/microservices/reports/:userId', microservicesController.generateReport.bind(microservicesController));
router.post('/microservices/location/batch', microservicesController.processLocationBatch.bind(microservicesController));
router.post('/microservices/notifications/process', microservicesController.processNotifications.bind(microservicesController));
router.get('/microservices/notifications/stats/:userId', microservicesController.getNotificationStats.bind(microservicesController));
router.post('/microservices/billing/process', microservicesController.processBilling.bind(microservicesController));
router.get('/microservices/billing/history/:userId', microservicesController.getBillingHistory.bind(microservicesController));
router.post('/microservices/reports/generate', microservicesController.generateReportNew.bind(microservicesController));
router.get('/microservices/reports/list/:userId', microservicesController.listReports.bind(microservicesController));

router.get('/api/analytics/:user_id', requireAuth, requirePremium('Analytics'), async (req, res) => {
  try {
    const { user_id } = req.params;
    const userId = req.user?.id;
    const dateRange = req.query.date_range || req.headers['x-date-range'] || '7d';
    const analytics = await analyticsProcessingService.fetchAnalyticsData(user_id, dateRange);
    
    const activityLogService = require('../services/activityLogService');
    if (userId) {
      activityLogService.logActivity(userId, 'analytics', 'view_analytics', {
        targetUserId: user_id,
        dateRange,
        path: req.path
      });
    }
    
    res.json({
      user_id,
      date_range: dateRange,
      summary: analytics.summary || {},
      trends: analytics.trends || {},
      predictions: analytics.predictions || {},
      insights: analytics.insights || [],
      anomalies: analytics.anomalies || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/analytics/predict', requireAuth, requirePremium('Route prediction'), async (req, res) => {
  try {
    const { user_id, locations, prediction_type = 'route' } = req.body;
    const userId = req.user?.id;
    const predictions = await analyticsProcessingService.mlPredictRoute(user_id, locations || [], prediction_type);
    
    const activityLogService = require('../services/activityLogService');
    if (userId) {
      activityLogService.logActivity(userId, 'analytics', 'predict_route', {
        targetUserId: user_id,
        prediction_type,
        locationCount: locations?.length || 0,
        path: req.path
      });
    }
    
    res.json({
      user_id,
      prediction_type,
      predictions,
      confidence: predictions.confidence || 0.0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/analytics/insights/:user_id', requireAuth, requirePremium('Analytics insights'), async (req, res) => {
  try {
    const { user_id } = req.params;
    const userId = req.user?.id;
    const dateRange = req.query.date_range || '30d';
    const analytics = await analyticsProcessingService.fetchAnalyticsData(user_id, dateRange);
    const insights = await analyticsProcessingService.generateInsights(user_id, analytics);
    const recommendations = await analyticsProcessingService.generateRecommendations(user_id, insights);
    
    const activityLogService = require('../services/activityLogService');
    if (userId) {
      activityLogService.logActivity(userId, 'analytics', 'view_insights', {
        targetUserId: user_id,
        dateRange,
        path: req.path
      });
    }
    
    res.json({
      user_id,
      insights,
      recommendations,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/reports/generate', requireAuth, requirePremium('Report generation'), async (req, res) => {
  try {
    const { user_id, report_type, date_range, format } = req.body;
    const userId = req.user?.id;
    
    if (!user_id || !report_type) {
      return res.status(400).json({ error: 'user_id and report_type required' });
    }
    
    const report = await reportsService.generateReport(user_id, report_type, date_range, format);
    
    const activityLogService = require('../services/activityLogService');
    if (userId) {
      activityLogService.logActivity(userId, 'reports', 'generate_report', {
        targetUserId: user_id,
        report_type,
        format,
        path: req.path
      });
    }
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/reports/list', requireAuth, async (req, res) => {
  try {
    const { user_id } = req.query;
    const userId = req.user?.id;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }
    
    const reports = await reportsService.listReports(user_id);
    
    const activityLogService = require('../services/activityLogService');
    if (userId) {
      activityLogService.logActivity(userId, 'reports', 'view_reports', {
        targetUserId: user_id,
        reportCount: reports.length,
        path: req.path
      });
    }
    
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/reports/download/:reportId', requireAuth, validateReportId, async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user?.id;
    const reportData = await reportsService.downloadReport(reportId);
    
    const activityLogService = require('../services/activityLogService');
    if (userId) {
      activityLogService.logActivity(userId, 'reports', 'download_report', {
        reportId,
        path: req.path
      });
    }
    
    res.json(reportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const crossPageController = require('../controllers/crossPageController');
router.get('/navigation/data', requireAuth, crossPageController.getNavigationData.bind(crossPageController));
router.get('/page/context', requireAuth, crossPageController.getPageContext.bind(crossPageController));
router.post('/pages/share', requireAuth, crossPageController.shareDataBetweenPages.bind(crossPageController));
router.get('/pages/shared', requireAuth, crossPageController.getSharedData.bind(crossPageController));

const appConfigController = require('../controllers/appConfigController');
router.get('/app/config', appConfigController.getAppConfig.bind(appConfigController));
router.get('/app/splash', appConfigController.getSplashConfig.bind(appConfigController));

const uiController = require('../controllers/uiController');
router.post('/ui/preference', requireAuth, uiController.updateUIPreference.bind(uiController));

const scheduledTasksController = require('../controllers/scheduledTasksController');
router.post('/scheduled/trigger-check', requireAuth, scheduledTasksController.triggerManualCheck.bind(scheduledTasksController));
router.get('/scheduled/activity/:userId', requireAuth, scheduledTasksController.getUserActivity.bind(scheduledTasksController));
router.get('/scheduled/activities', requireAuth, scheduledTasksController.getAllActivities.bind(scheduledTasksController));
router.post('/scheduled/test-notification', requireAuth, scheduledTasksController.sendTestNotification.bind(scheduledTasksController));

router.use((req, res, next) => {
  const ResponseFormatter = require('../core/utils/responseFormatter');
  res.status(404).json(ResponseFormatter.error('Endpoint not found', 'NOT_FOUND', { path: req.path }));
});

const { handleError } = require('../core/utils/errorHandler');
router.use(handleError);

// Inactivity notification routes
router.use('/inactivity', require('./inactivity'));

module.exports = router;
