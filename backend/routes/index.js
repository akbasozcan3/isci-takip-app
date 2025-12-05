const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');

const router = express.Router();

router.use(helmet());
router.use(compression());
router.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
router.use(bodyParser.json({ limit: '10mb' }));
router.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

const requestLogger = require('../core/middleware/requestLogger');
const performanceMiddleware = require('../core/middleware/performance.middleware');
const tracingMiddleware = require('../core/middleware/tracing.middleware');
const securityMiddleware = require('../core/middleware/security.middleware');
const responseMiddleware = require('../core/middleware/response.middleware');

router.use(tracingMiddleware);
router.use(securityMiddleware);
router.use(performanceMiddleware);
router.use(requestLogger);
router.use(responseMiddleware);

const { attachSubscription } = require('../core/middleware/subscriptionCheck');
router.use(attachSubscription);

router.get('/health', (req, res) => {
  const db = require('../config/database');
  const metricsService = require('../core/services/metrics.service');
  const performanceService = require('../core/services/performance.service');
  const circuitBreakerService = require('../core/services/circuitBreaker.service');
  const advancedCacheService = require('../core/services/advancedCache.service');
  
  const metrics = metricsService.getMetrics();
  const health = performanceService.getHealthStatus();
  const cacheStats = advancedCacheService.getStats();
  
  res.json({ 
    status: health.status,
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime: metrics.uptime,
    issues: health.issues,
    performance: {
      memory: health.metrics.memory,
      cpu: health.metrics.cpu,
      eventLoop: health.metrics.eventLoop
    },
    database: {
      users: Object.keys(db.data.users || {}).length,
      devices: Object.keys(db.data.store || {}).length,
      groups: Object.keys(db.data.groups || {}).length
    },
    metrics: {
      requests: {
        total: metrics.requests.total,
        errors: metrics.requests.errors,
        success: metrics.requests.success,
        active: health.metrics.requests.active
      },
      responseTime: {
        average: Math.round(metrics.responseTime.average),
        min: metrics.responseTime.min === Infinity ? 0 : metrics.responseTime.min,
        max: metrics.responseTime.max
      }
    },
    cache: cacheStats,
    circuitBreakers: circuitBreakerService.getAllStates()
  });
});

router.get('/metrics', (req, res) => {
  const metricsService = require('../core/services/metrics.service');
  const metrics = metricsService.getMetrics();
  res.json(metrics);
});

const { requireAuth } = require('../core/middleware/auth.middleware');

router.use('/auth', require('../modules/auth/auth.routes'));

router.get('/users/me', requireAuth, require('../modules/auth/auth.controller').getProfile.bind(require('../modules/auth/auth.controller')));

const locationController = require('../controllers/locationController');
router.post('/location/store', requireAuth, locationController.storeLocation.bind(locationController));
router.post('/locations', requireAuth, locationController.storeLocation.bind(locationController));
router.get('/location/analytics/advanced', requireAuth, locationController.getAdvancedAnalytics.bind(locationController));
router.post('/location/share', requireAuth, locationController.createShareLink.bind(locationController));
router.get('/location/find-by-phone', requireAuth, locationController.findLocationByPhone.bind(locationController));
router.get('/location/:deviceId', requireAuth, locationController.getLocationHistory.bind(locationController));
router.get('/locations/:deviceId/recent', requireAuth, locationController.getRecentLocations.bind(locationController));
router.get('/location/:deviceId/latest', requireAuth, locationController.getLatestLocation.bind(locationController));
router.get('/locations/latest', requireAuth, locationController.getLatestLocations.bind(locationController));
router.get('/location/:deviceId/stats', requireAuth, locationController.getLocationStats.bind(locationController));
router.get('/location/:deviceId/route-optimized', requireAuth, locationController.getRouteOptimized.bind(locationController));
router.get('/location/:deviceId/geofence', requireAuth, locationController.checkGeofence.bind(locationController));
router.get('/location/:deviceId/recommendations', requireAuth, locationController.getTrackingRecommendations.bind(locationController));
router.get('/active', requireAuth, locationController.getActiveDevices.bind(locationController));
router.delete('/location/:deviceId', requireAuth, locationController.deleteLocationData.bind(locationController));
router.get('/devices', requireAuth, locationController.getAllDevices.bind(locationController));

const analyticsController = require('../controllers/analyticsController');
router.get('/analytics/:deviceId/daily', analyticsController.getDailyStats.bind(analyticsController));
router.get('/analytics/:deviceId/weekly', analyticsController.getWeeklyStats.bind(analyticsController));
router.get('/analytics/:deviceId/monthly', analyticsController.getMonthlyStats.bind(analyticsController));
router.get('/analytics/:deviceId/heatmap', analyticsController.getHeatmapData.bind(analyticsController));
router.get('/analytics/:deviceId/speed', analyticsController.getSpeedAnalysis.bind(analyticsController));

router.get('/location/:deviceId/analytics', requireAuth, locationController.getLocationAnalytics.bind(locationController));
router.get('/location/:deviceId/route-metrics', requireAuth, locationController.getRouteMetrics.bind(locationController));
router.get('/location/:deviceId/quality', requireAuth, locationController.getLocationQuality.bind(locationController));
router.get('/location/:deviceId/prediction', requireAuth, locationController.getLocationPrediction.bind(locationController));
router.get('/location/share/:shareToken', locationController.getSharedLocation.bind(locationController));
router.post('/location/live/start', requireAuth, locationController.startLiveLocation.bind(locationController));
router.post('/location/family/add', requireAuth, locationController.addFamilyMember.bind(locationController));
router.get('/location/family', requireAuth, locationController.getFamilyLocations.bind(locationController));
router.post('/location/delivery/create', requireAuth, locationController.createDelivery.bind(locationController));
router.get('/location/deliveries', requireAuth, locationController.getDeliveries.bind(locationController));
router.put('/location/delivery/:deliveryId/status', requireAuth, locationController.updateDeliveryStatus.bind(locationController));
router.post('/location/route/save', requireAuth, locationController.saveRoute.bind(locationController));
router.get('/location/routes', requireAuth, locationController.listRoutes.bind(locationController));
router.post('/location/validate-input', requireAuth, locationController.validateInput.bind(locationController));
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

const systemController = require('../controllers/systemController');
router.get('/system/info', systemController.getSystemInfo.bind(systemController));
router.post('/system/backup', systemController.createBackup.bind(systemController));
router.get('/system/backups', systemController.listBackups.bind(systemController));

const adminController = require('../controllers/adminController');
router.post('/admin/reset-all', adminController.resetAllData.bind(adminController));

const blogController = require('../controllers/blogController');
router.get('/articles', blogController.getAllArticles.bind(blogController));
router.get('/articles/:id', blogController.getArticleById.bind(blogController));
router.post('/articles', blogController.createArticle.bind(blogController));
router.put('/articles/:id', blogController.updateArticle.bind(blogController));
router.delete('/articles/:id', blogController.deleteArticle.bind(blogController));

const dashboardController = require('../controllers/dashboardController');
router.get('/dashboard/:userId', requireAuth, dashboardController.getDashboard.bind(dashboardController));
router.get('/dashboard', requireAuth, dashboardController.getDashboard.bind(dashboardController));
router.get('/activities', requireAuth, dashboardController.getActivities.bind(dashboardController));
router.get('/stats', requireAuth, dashboardController.getStats.bind(dashboardController));

const notificationsController = require('../controllers/notificationsController');
router.get('/notifications', notificationsController.list.bind(notificationsController));
router.post('/notifications/read-all', notificationsController.markAllRead.bind(notificationsController));
router.post('/notifications/:id/read', notificationsController.markRead.bind(notificationsController));
router.post('/notifications/push', notificationsController.sendPush.bind(notificationsController));

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
router.get('/payment/:paymentId/status', billingController.getPaymentStatus.bind(billingController));
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
router.post('/groups', requireAuth, checkLimit('maxGroups'), groupController.createGroup.bind(groupController));
router.get('/groups/user/:userId/admin', requireAuth, groupController.getGroupsByAdmin.bind(groupController));
router.get('/groups/user/:userId/active', requireAuth, groupController.getActiveGroupsForUser.bind(groupController));
router.get('/groups/:groupId/requests', requireAuth, groupController.getRequests.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/approve', requireAuth, groupController.approveRequest.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/reject', requireAuth, groupController.rejectRequest.bind(groupController));
router.get('/groups/:groupId/members-with-locations', requireAuth, groupController.getMembersWithLocations.bind(groupController));
router.get('/groups/:groupId/members', requireAuth, groupController.getMembers.bind(groupController));
router.post('/groups/:groupId/locations', requireAuth, groupController.recordGroupLocation.bind(groupController));
router.get('/groups/:groupId/locations', requireAuth, groupController.getGroupLocations.bind(groupController));
router.post('/groups/:groupId/leave', requireAuth, groupController.leaveGroup.bind(groupController));
router.post('/groups/:groupId/transfer-admin', requireAuth, groupController.transferAdmin.bind(groupController));
router.delete('/groups/:groupId', requireAuth, groupController.deleteGroup.bind(groupController));
router.get('/groups/:code/info', groupController.getGroupInfoByCode.bind(groupController));
router.post('/groups/:code/join-request', requireAuth, groupController.createJoinRequestByCode.bind(groupController));
router.post('/groups/user/:userId/leave-all', requireAuth, groupController.leaveAllGroups.bind(groupController));
router.post('/user/:userId/purge', requireAuth, groupController.purgeUserData.bind(groupController));

const microservicesController = require('../controllers/microservicesController');
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

module.exports = router;
