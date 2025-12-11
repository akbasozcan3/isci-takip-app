const { createError } = require('../utils/errorHandler');

function validateCoordinates(req, res, next) {
  if (req.body.coords) {
    const { latitude, longitude } = req.body.coords;
    
    if (latitude === undefined || longitude === undefined) {
      return next(createError('Koordinatlar gereklidir', 400, 'MISSING_COORDINATES'));
    }
    
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (!isFinite(lat) || !isFinite(lng)) {
      return next(createError('Geçersiz koordinat formatı', 400, 'INVALID_COORDINATES'));
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return next(createError('Koordinatlar geçerli aralıkta değil', 400, 'COORDINATES_OUT_OF_RANGE'));
    }
    
    req.body.coords = {
      latitude: lat,
      longitude: lng,
      accuracy: req.body.coords.accuracy ? parseFloat(req.body.coords.accuracy) : null,
      heading: req.body.coords.heading ? parseFloat(req.body.coords.heading) : null,
      speed: req.body.coords.speed ? parseFloat(req.body.coords.speed) : null
    };
  }
  
  next();
}

function validateGroupId(req, res, next) {
  const { groupId } = req.params;
  
  if (!groupId || typeof groupId !== 'string' || groupId.trim().length === 0) {
    return next(createError('groupId gereklidir', 400, 'MISSING_GROUP_ID'));
  }
  
  next();
}

function validateDeviceId(req, res, next) {
  const { deviceId } = req.params;
  
  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    return next(createError('Device ID gereklidir', 400, 'MISSING_DEVICE_ID'));
  }
  
  next();
}

function validateUserId(req, res, next) {
  const { userId } = req.params;
  
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return next(createError('User ID gereklidir', 400, 'MISSING_USER_ID'));
  }
  
  next();
}

function validateDeliveryId(req, res, next) {
  const { deliveryId } = req.params;
  
  if (!deliveryId || typeof deliveryId !== 'string' || deliveryId.trim().length === 0) {
    return next(createError('Delivery ID gereklidir', 400, 'MISSING_DELIVERY_ID'));
  }
  
  next();
}

function validateRouteId(req, res, next) {
  const { routeId } = req.params;
  
  if (!routeId || typeof routeId !== 'string' || routeId.trim().length === 0) {
    return next(createError('Route ID gereklidir', 400, 'MISSING_ROUTE_ID'));
  }
  
  next();
}

function validateArticleId(req, res, next) {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return next(createError('Article ID gereklidir', 400, 'MISSING_ARTICLE_ID'));
  }
  
  next();
}

function validateReportId(req, res, next) {
  const { reportId } = req.params;
  
  if (!reportId || typeof reportId !== 'string' || reportId.trim().length === 0) {
    return next(createError('Report ID gereklidir', 400, 'MISSING_REPORT_ID'));
  }
  
  next();
}

function validatePaymentId(req, res, next) {
  const { paymentId } = req.params;
  
  if (!paymentId || typeof paymentId !== 'string' || paymentId.trim().length === 0) {
    return next(createError('Payment ID gereklidir', 400, 'MISSING_PAYMENT_ID'));
  }
  
  next();
}

function validateRequestId(req, res, next) {
  const { requestId } = req.params;
  
  if (!requestId || typeof requestId !== 'string' || requestId.trim().length === 0) {
    return next(createError('Request ID gereklidir', 400, 'MISSING_REQUEST_ID'));
  }
  
  next();
}

module.exports = {
  validateCoordinates,
  validateGroupId,
  validateDeviceId,
  validateUserId,
  validateDeliveryId,
  validateRouteId,
  validateArticleId,
  validateReportId,
  validatePaymentId,
  validateRequestId
};
