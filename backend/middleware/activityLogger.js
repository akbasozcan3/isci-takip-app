const activityLogService = require('../services/activityLogService');

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
}

function getActivityType(method, path) {
  if (path.includes('/groups')) return 'group';
  if (path.includes('/location')) return 'location';
  if (path.includes('/dashboard')) return 'dashboard';
  if (path.includes('/analytics')) return 'analytics';
  if (path.includes('/steps')) return 'steps';
  if (path.includes('/billing') || path.includes('/payment')) return 'billing';
  if (path.includes('/auth')) return 'auth';
  return 'api';
}

function getActivityAction(method, path) {
  if (method === 'GET') {
    if (path.includes('/locations')) return 'view_locations';
    if (path.includes('/members')) return 'view_members';
    if (path.includes('/dashboard')) return 'view_dashboard';
    if (path.includes('/analytics')) return 'view_analytics';
    return 'view';
  }
  if (method === 'POST') {
    if (path.includes('/groups')) return 'create_group';
    if (path.includes('/join')) return 'join_group';
    if (path.includes('/locations')) return 'share_location';
    if (path.includes('/payment')) return 'make_payment';
    return 'create';
  }
  if (method === 'PUT' || method === 'PATCH') {
    return 'update';
  }
  if (method === 'DELETE') {
    return 'delete';
  }
  return 'unknown';
}

function activityLogger(req, res, next) {
  const userId = req.user?.id || req.subscription?.userId || null;
  
  if (!userId) {
    return next();
  }

  const originalSend = res.send;
  res.send = function(data) {
    const activityType = getActivityType(req.method, req.path);
    const activityAction = getActivityAction(req.method, req.path);
    
    const metadata = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      deviceId: req.headers['x-device-id'] || null,
      groupId: req.body?.groupId || req.params?.groupId || null,
      locationId: req.body?.locationId || req.params?.locationId || null
    };

    if (res.statusCode >= 200 && res.statusCode < 300) {
      activityLogService.logActivity(userId, activityType, activityAction, metadata);
    }

    return originalSend.call(this, data);
  };

  next();
}

module.exports = activityLogger;

