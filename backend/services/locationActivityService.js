let logger;
try {
  const { getLogger } = require('../core/utils/loggerHelper');
  logger = getLogger('LocationActivityService');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[LocationActivityService]', ...args),
    error: (...args) => console.error('[LocationActivityService]', ...args),
    info: (...args) => console.log('[LocationActivityService]', ...args),
    debug: (...args) => console.debug('[LocationActivityService]', ...args)
  };
}

const ACTIVITY_THRESHOLDS = {
  stationary: { maxSpeed: 2, maxAccuracy: 50 },
  walking: { minSpeed: 2, maxSpeed: 8, maxAccuracy: 30 },
  cycling: { minSpeed: 8, maxSpeed: 25, maxAccuracy: 20 },
  motorcycle: { minSpeed: 25, maxSpeed: 80, maxAccuracy: 15 },
  driving: { minSpeed: 20, maxSpeed: 200, maxAccuracy: 20 },
  home: { maxSpeed: 0.5, maxAccuracy: 20, minStayTime: 300000 }
};

function detectActivityType(locationData, previousLocation = null) {
  const speed = locationData.coords?.speed || 0;
  const speedKmh = speed * 3.6;
  const accuracy = locationData.coords?.accuracy || 100;
  const heading = locationData.coords?.heading || null;

  if (!previousLocation) {
    if (speedKmh < ACTIVITY_THRESHOLDS.stationary.maxSpeed && accuracy < ACTIVITY_THRESHOLDS.stationary.maxAccuracy) {
      return {
        type: 'home',
        icon: '🏠',
        name: 'Ev',
        confidence: 0.7
      };
    }
    return {
      type: 'stationary',
      icon: '📍',
      name: 'Duruyor',
      confidence: 0.6
    };
  }

  const timeDiff = locationData.timestamp - (previousLocation.timestamp || Date.now());
  const distance = calculateDistance(
    previousLocation.coords.latitude,
    previousLocation.coords.longitude,
    locationData.coords.latitude,
    locationData.coords.longitude
  );
  const calculatedSpeed = timeDiff > 0 ? (distance / (timeDiff / 1000)) * 3.6 : 0;
  const finalSpeed = speedKmh > 0 ? speedKmh : calculatedSpeed;

  if (finalSpeed < ACTIVITY_THRESHOLDS.stationary.maxSpeed && accuracy < ACTIVITY_THRESHOLDS.home.maxAccuracy && timeDiff > ACTIVITY_THRESHOLDS.home.minStayTime) {
    return {
      type: 'home',
      icon: '🏠',
      name: 'Ev',
      confidence: 0.9
    };
  }

  if (finalSpeed < ACTIVITY_THRESHOLDS.stationary.maxSpeed) {
    return {
      type: 'stationary',
      icon: '📍',
      name: 'Duruyor',
      confidence: 0.8
    };
  }

  if (finalSpeed >= ACTIVITY_THRESHOLDS.walking.minSpeed && finalSpeed < ACTIVITY_THRESHOLDS.walking.maxSpeed) {
    return {
      type: 'walking',
      icon: '🚶',
      name: 'Yürüyor',
      confidence: 0.8
    };
  }

  if (finalSpeed >= ACTIVITY_THRESHOLDS.cycling.minSpeed && finalSpeed < ACTIVITY_THRESHOLDS.cycling.maxSpeed) {
    return {
      type: 'cycling',
      icon: '🚴',
      name: 'Bisiklet',
      confidence: 0.7
    };
  }

  if (finalSpeed >= ACTIVITY_THRESHOLDS.motorcycle.minSpeed && finalSpeed < ACTIVITY_THRESHOLDS.motorcycle.maxSpeed) {
    return {
      type: 'motorcycle',
      icon: '🏍️',
      name: 'Motor',
      confidence: 0.85
    };
  }

  if (finalSpeed >= ACTIVITY_THRESHOLDS.driving.minSpeed) {
    return {
      type: 'driving',
      icon: '🚗',
      name: 'Araba',
      confidence: 0.9
    };
  }

  return {
    type: 'stationary',
    icon: '📍',
    name: 'Duruyor',
    confidence: 0.6
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

function getActivityForLocation(userId, locationData) {
  try {
    const db = require('../config/database');
    const locations = db.getStore(userId) || [];
    
    if (locations.length === 0) {
      return detectActivityType(locationData);
    }

    const previousLocation = locations[locations.length - 1];
    return detectActivityType(locationData, previousLocation);
  } catch (error) {
    logger.error(`Error detecting activity for user ${userId}:`, error);
    return {
      type: 'stationary',
      icon: '📍',
      name: 'Duruyor',
      confidence: 0.5
    };
  }
}

function updateLocationWithActivity(userId, locationData) {
  const activity = getActivityForLocation(userId, locationData);
  
  return {
    ...locationData,
    activity: {
      type: activity.type,
      icon: activity.icon,
      name: activity.name,
      confidence: activity.confidence,
      detectedAt: Date.now()
    }
  };
}

module.exports = {
  detectActivityType,
  getActivityForLocation,
  updateLocationWithActivity,
  ACTIVITY_THRESHOLDS
};
