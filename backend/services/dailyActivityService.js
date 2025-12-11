const db = require('../config/database');
const locationService = require('./locationService');
let logger;
try {
  const { getLogger } = require('../core/utils/loggerHelper');
  logger = getLogger('DailyActivityService');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[DailyActivityService]', ...args),
    error: (...args) => console.error('[DailyActivityService]', ...args),
    info: (...args) => console.log('[DailyActivityService]', ...args),
    debug: (...args) => console.debug('[DailyActivityService]', ...args)
  };
}

function calculateDailyDistance(userId, date = null) {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const locations = db.getStore(userId);
  if (!locations || locations.length === 0) {
    return { distance: 0, locations: 0, date: targetDate.toISOString().split('T')[0] };
  }

  const dayLocations = locations.filter(loc => {
    const locTime = new Date(loc.timestamp || loc.createdAt || loc.time);
    return locTime >= startOfDay && locTime <= endOfDay;
  });

  if (dayLocations.length < 2) {
    return { 
      distance: 0, 
      locations: dayLocations.length, 
      date: targetDate.toISOString().split('T')[0] 
    };
  }

  let totalDistance = 0;
  for (let i = 1; i < dayLocations.length; i++) {
    const prev = dayLocations[i - 1];
    const curr = dayLocations[i];
    
    if (prev.coords && curr.coords) {
      const distanceMeters = locationService.haversineDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );
      const distanceKm = distanceMeters / 1000;
      totalDistance += distanceKm;
    }
  }

  return {
    distance: Math.round(totalDistance * 100) / 100,
    locations: dayLocations.length,
    date: targetDate.toISOString().split('T')[0]
  };
}

function getUserDailyActivity(userId) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayActivity = calculateDailyDistance(userId, today);
  const yesterdayActivity = calculateDailyDistance(userId, yesterday);

  return {
    today: todayActivity,
    yesterday: yesterdayActivity,
    userId
  };
}

function getAllUsersDailyActivity() {
  const users = Object.values(db.data.users || {});
  const activities = [];

  for (const user of users) {
    try {
      const activity = getUserDailyActivity(user.id);
      activities.push(activity);
    } catch (error) {
      logger.error(`Error calculating activity for user ${user.id}:`, error);
    }
  }

  return activities;
}

function checkActivityThresholds(activity, thresholds = {}) {
  const {
    minDistance = 5,
    maxDistance = 50
  } = thresholds;

  const checks = {
    reachedMin: activity.today.distance >= minDistance,
    exceededMax: activity.today.distance > maxDistance,
    hasActivity: activity.today.distance > 0,
    improved: activity.today.distance > activity.yesterday.distance
  };

  return checks;
}

module.exports = {
  calculateDailyDistance,
  getUserDailyActivity,
  getAllUsersDailyActivity,
  checkActivityThresholds
};
