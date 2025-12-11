/**
 * Inactivity Notification Routes
 * API endpoints for inactivity notification management
 */

const express = require('express');
const router = express.Router();
const inactivityNotificationService = require('../services/inactivityNotification.service');
const { asyncHandler } = require('../core/middleware/errorHandler.middleware');
const { requireAuth } = require('../core/middleware/auth.middleware');

/**
 * GET /api/inactivity/status
 * Get inactivity notification service status (admin only)
 */
router.get('/status', requireAuth, asyncHandler(async (req, res) => {
  const user = req.user;
  
  // Check if user is admin (you can customize this check)
  if (user.role !== 'admin' && user.email !== 'admin@bavaxe.com') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  const status = inactivityNotificationService.getStatus();
  
  res.json({
    success: true,
    data: status,
  });
}));

/**
 * POST /api/inactivity/check
 * Manually trigger inactivity check (admin only)
 */
router.post('/check', requireAuth, asyncHandler(async (req, res) => {
  const user = req.user;
  
  // Check if user is admin
  if (user.role !== 'admin' && user.email !== 'admin@bavaxe.com') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  await inactivityNotificationService.manualCheck();
  
  res.json({
    success: true,
    message: 'Inactivity check triggered',
  });
}));

module.exports = router;

