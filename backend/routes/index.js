// Routes Configuration
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');

const authController = require('../controllers/authController');
const locationController = require('../controllers/locationController');
const blogController = require('../controllers/blogController');
const groupController = require('../controllers/groupController');
const dashboardController = require('../controllers/dashboardController');
const notificationsController = require('../controllers/notificationsController');
const billingController = require('../controllers/billingController');
// const authService = require('../services/authService');

const router = express.Router();

// Middleware
router.use(helmet());
router.use(compression());
router.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
router.use(bodyParser.json({ limit: '10mb' }));
router.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Authentication routes
router.post('/auth/pre-verify-email', authController.preVerifyEmail.bind(authController));
router.post('/auth/pre-verify-email/verify', authController.verifyEmailCode.bind(authController));
router.post('/auth/register', authController.register.bind(authController));
router.post('/auth/login', authController.login.bind(authController));
router.post('/auth/logout', authController.logout.bind(authController));
router.get('/auth/profile', authController.getProfile.bind(authController));
router.put('/auth/profile', authController.updateProfile.bind(authController));
router.post('/auth/profile/send-password-code', authController.sendPasswordChangeCode.bind(authController));
router.post('/auth/profile/verify-password-code', authController.verifyPasswordChangeCode.bind(authController));
router.delete('/auth/account', authController.deleteAccount.bind(authController));
router.post('/auth/reset/request', authController.requestPasswordReset.bind(authController));
router.get('/auth/reset/verify', authController.verifyResetToken.bind(authController));
router.post('/auth/reset/confirm', authController.confirmPasswordReset.bind(authController));
// Alias for frontend compatibility
router.get('/users/me', authController.getProfile.bind(authController));

// Location tracking routes
router.post('/location/store', locationController.storeLocation.bind(locationController));
router.post('/locations', locationController.storeLocation.bind(locationController)); // alias used by mobile app
router.get('/location/:deviceId', locationController.getLocationHistory.bind(locationController));
router.get('/locations/:deviceId/recent', locationController.getRecentLocations.bind(locationController));
router.get('/location/:deviceId/latest', locationController.getLatestLocation.bind(locationController));
router.get('/locations/latest', locationController.getLatestLocations.bind(locationController));
router.get('/location/:deviceId/stats', locationController.getLocationStats.bind(locationController));
router.get('/active', locationController.getActiveDevices.bind(locationController));
router.delete('/location/:deviceId', locationController.deleteLocationData.bind(locationController));
router.get('/devices', locationController.getAllDevices.bind(locationController));

// Blog/Article routes
router.get('/articles', blogController.getAllArticles.bind(blogController));
router.get('/articles/:id', blogController.getArticleById.bind(blogController));
router.post('/articles', blogController.createArticle.bind(blogController));
router.put('/articles/:id', blogController.updateArticle.bind(blogController));
router.delete('/articles/:id', blogController.deleteArticle.bind(blogController));

// Dashboard routes (safe defaults to prevent 404s)
router.get('/dashboard/:userId', dashboardController.getDashboard.bind(dashboardController));
router.get('/activities', dashboardController.getActivities.bind(dashboardController));

// Notifications
router.get('/notifications', notificationsController.list.bind(notificationsController));
router.post('/notifications/read-all', notificationsController.markAllRead.bind(notificationsController));
router.post('/notifications/:id/read', notificationsController.markRead.bind(notificationsController));

// Billing / Plans
router.get('/billing/plans', billingController.getPlans.bind(billingController));
router.post('/billing/checkout', billingController.checkout.bind(billingController));
router.post('/billing/subscribe', billingController.subscribe.bind(billingController));
router.get('/billing/history', billingController.getHistory.bind(billingController));

// Groups routes
router.post('/groups', groupController.createGroup.bind(groupController));
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

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

router.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = router;
