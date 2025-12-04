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

router.use(tracingMiddleware);
router.use(securityMiddleware);
router.use(performanceMiddleware);
router.use(requestLogger);

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

router.use('/auth', require('../modules/auth/auth.routes'));

const locationController = require('../controllers/locationController');
router.post('/location/store', locationController.storeLocation.bind(locationController));
router.post('/locations', locationController.storeLocation.bind(locationController));
router.get('/location/:deviceId', locationController.getLocationHistory.bind(locationController));
router.get('/locations/:deviceId/recent', locationController.getRecentLocations.bind(locationController));
router.get('/location/:deviceId/latest', locationController.getLatestLocation.bind(locationController));
router.get('/locations/latest', locationController.getLatestLocations.bind(locationController));
router.get('/location/:deviceId/stats', locationController.getLocationStats.bind(locationController));
router.get('/location/:deviceId/route-optimized', locationController.getRouteOptimized.bind(locationController));
router.get('/location/:deviceId/geofence', locationController.checkGeofence.bind(locationController));
router.get('/location/:deviceId/recommendations', locationController.getTrackingRecommendations.bind(locationController));
router.get('/active', locationController.getActiveDevices.bind(locationController));
router.delete('/location/:deviceId', locationController.deleteLocationData.bind(locationController));
router.get('/devices', locationController.getAllDevices.bind(locationController));

const analyticsController = require('../controllers/analyticsController');
router.get('/analytics/:deviceId/daily', analyticsController.getDailyStats.bind(analyticsController));
router.get('/analytics/:deviceId/weekly', analyticsController.getWeeklyStats.bind(analyticsController));
router.get('/analytics/:deviceId/monthly', analyticsController.getMonthlyStats.bind(analyticsController));
router.get('/analytics/:deviceId/heatmap', analyticsController.getHeatmapData.bind(analyticsController));
router.get('/analytics/:deviceId/speed', analyticsController.getSpeedAnalysis.bind(analyticsController));

router.get('/location/:deviceId/analytics', locationController.getLocationAnalytics.bind(locationController));
router.get('/location/:deviceId/route-metrics', locationController.getRouteMetrics.bind(locationController));
router.get('/location/:deviceId/quality', locationController.getLocationQuality.bind(locationController));
router.get('/location/:deviceId/prediction', locationController.getLocationPrediction.bind(locationController));

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
router.get('/dashboard/:userId', dashboardController.getDashboard.bind(dashboardController));
router.get('/dashboard', dashboardController.getDashboard.bind(dashboardController));
router.get('/activities', dashboardController.getActivities.bind(dashboardController));
router.get('/stats', dashboardController.getStats.bind(dashboardController));

const notificationsController = require('../controllers/notificationsController');
router.get('/notifications', notificationsController.list.bind(notificationsController));
router.post('/notifications/read-all', notificationsController.markAllRead.bind(notificationsController));
router.post('/notifications/:id/read', notificationsController.markRead.bind(notificationsController));
router.post('/notifications/push', notificationsController.sendPush.bind(notificationsController));

const billingController = require('../controllers/billingController');
router.get('/plans', billingController.getPlans.bind(billingController));
router.get('/billing/plans', billingController.getPlans.bind(billingController));
router.get('/me/subscription', billingController.getMySubscription.bind(billingController));
router.post('/me/subscription/cancel', billingController.cancelSubscription.bind(billingController));
router.post('/me/subscription/renew', billingController.renewSubscription.bind(billingController));
router.put('/me/subscription/change-plan', billingController.changePlan.bind(billingController));
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
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), billingController.handleStripeWebhook.bind(billingController));

const { checkLimit } = require('../core/middleware/subscriptionCheck');
const groupController = require('../controllers/groupController');
router.post('/groups', checkLimit('maxGroups'), groupController.createGroup.bind(groupController));
router.get('/groups/user/:userId/admin', groupController.getGroupsByAdmin.bind(groupController));
router.get('/groups/user/:userId/active', groupController.getActiveGroupsForUser.bind(groupController));
router.get('/groups/:groupId/requests', groupController.getRequests.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/approve', groupController.approveRequest.bind(groupController));
router.post('/groups/:groupId/requests/:requestId/reject', groupController.rejectRequest.bind(groupController));
router.get('/groups/:groupId/members-with-locations', groupController.getMembersWithLocations.bind(groupController));
router.get('/groups/:groupId/members', groupController.getMembers.bind(groupController));
router.post('/groups/:groupId/locations', groupController.recordGroupLocation.bind(groupController));
router.post('/groups/:groupId/leave', groupController.leaveGroup.bind(groupController));
router.post('/groups/:groupId/transfer-admin', groupController.transferAdmin.bind(groupController));
router.delete('/groups/:groupId', groupController.deleteGroup.bind(groupController));
router.get('/groups/:code/info', groupController.getGroupInfoByCode.bind(groupController));
router.post('/groups/:code/join-request', groupController.createJoinRequestByCode.bind(groupController));
router.post('/groups/user/:userId/leave-all', groupController.leaveAllGroups.bind(groupController));
router.post('/user/:userId/purge', groupController.purgeUserData.bind(groupController));

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

const { handleError } = require('../core/utils/errorHandler');
router.use(handleError);

router.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = router;
