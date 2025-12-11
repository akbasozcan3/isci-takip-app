const db = require('../config/database');
const locationService = require('./locationService');

class AnalyticsService {
  getDailyStats(deviceId, date) {
    const locations = db.getStore(deviceId);
    
    activityLogService.logActivity(deviceId, 'analytics', 'get_daily_stats', {
      deviceId,
      date
    });
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        date,
        totalLocations: 0,
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        activeTime: 0,
        stoppedTime: 0
      };
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayLocations = locations.filter(loc => {
      const locDate = new Date(loc.timestamp);
      return locDate >= targetDate && locDate < nextDate;
    });

    if (dayLocations.length === 0) {
      return {
        date,
        totalLocations: 0,
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        activeTime: 0,
        stoppedTime: 0
      };
    }

    const totalDistance = locationService.calculateRouteDistance(dayLocations);
    const averageSpeed = locationService.calculateAverageSpeed(dayLocations);
    const maxSpeed = locationService.getMaxSpeed(dayLocations);
    const isMoving = !locationService.detectStopped(dayLocations);

    const firstTime = dayLocations[0].timestamp;
    const lastTime = dayLocations[dayLocations.length - 1].timestamp;
    const activeTime = (lastTime - firstTime) / 1000;

    return {
      date,
      totalLocations: dayLocations.length,
      totalDistance,
      averageSpeed,
      maxSpeed,
      activeTime,
      stoppedTime: isMoving ? 0 : activeTime,
      isMoving
    };
  }

  getWeeklyStats(deviceId, weekStartDate) {
    const stats = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      stats.push(this.getDailyStats(deviceId, date.toISOString().split('T')[0]));
    }
    return stats;
  }

  getMonthlyStats(deviceId, year, month) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        year,
        month,
        totalLocations: 0,
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        activeDays: 0
      };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const monthLocations = locations.filter(loc => {
      const locDate = new Date(loc.timestamp);
      return locDate >= startDate && locDate <= endDate;
    });

    if (monthLocations.length === 0) {
      return {
        year,
        month,
        totalLocations: 0,
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        activeDays: 0
      };
    }

    const totalDistance = locationService.calculateRouteDistance(monthLocations);
    const averageSpeed = locationService.calculateAverageSpeed(monthLocations);
    const maxSpeed = locationService.getMaxSpeed(monthLocations);

    const activeDaysSet = new Set();
    monthLocations.forEach(loc => {
      const date = new Date(loc.timestamp);
      activeDaysSet.add(date.toISOString().split('T')[0]);
    });

    return {
      year,
      month,
      totalLocations: monthLocations.length,
      totalDistance,
      averageSpeed,
      maxSpeed,
      activeDays: activeDaysSet.size
    };
  }

  getHeatmapData(deviceId, startDate, endDate) {
    const locations = db.getStore(deviceId);
    
    activityLogService.logActivity(deviceId, 'analytics', 'get_heatmap_data', {
      deviceId,
      startDate,
      endDate
    });
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return [];
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    const filtered = locations.filter(loc => {
      return loc.timestamp >= start && loc.timestamp <= end;
    });

    const heatmap = {};
    filtered.forEach(loc => {
      if (!loc.coords) return;
      const lat = Math.round(loc.coords.latitude * 1000) / 1000;
      const lng = Math.round(loc.coords.longitude * 1000) / 1000;
      const key = `${lat},${lng}`;
      heatmap[key] = (heatmap[key] || 0) + 1;
    });

    return Object.entries(heatmap).map(([key, count]) => {
      const [lat, lng] = key.split(',').map(Number);
      return { lat, lng, intensity: count };
    });
  }

  getSpeedAnalysis(deviceId, timeWindowMs = 3600000) {
    const locations = db.getStore(deviceId);
    
    activityLogService.logActivity(deviceId, 'analytics', 'get_speed_analysis', {
      deviceId,
      timeWindowMs
    });
    
    if (!Array.isArray(locations) || locations.length < 2) {
      return {
        average: 0,
        max: 0,
        min: 0,
        distribution: []
      };
    }

    const now = Date.now();
    const windowStart = now - timeWindowMs;
    const recent = locations.filter(loc => loc.timestamp >= windowStart);

    const speeds = [];
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      if (prev.coords && curr.coords && prev.timestamp && curr.timestamp) {
        const dist = locationService.haversineDistance(
          prev.coords.latitude,
          prev.coords.longitude,
          curr.coords.latitude,
          curr.coords.longitude
        );
        const time = (curr.timestamp - prev.timestamp) / 1000;
        if (time > 0) {
          const speed = (dist / time) * 3.6;
          speeds.push(speed);
        }
      }
    }

    if (speeds.length === 0) {
      return {
        average: 0,
        max: 0,
        min: 0,
        distribution: []
      };
    }

    const sum = speeds.reduce((a, b) => a + b, 0);
    const average = sum / speeds.length;
    const max = Math.max(...speeds);
    const min = Math.min(...speeds);

    const distribution = [0, 10, 20, 30, 40, 50, 60, 80, 100, 120].map(threshold => {
      return {
        range: `${threshold} km/h`,
        count: speeds.filter(s => s >= threshold && s < threshold + 20).length
      };
    });

    return {
      average,
      max,
      min,
      distribution
    };
  }
}

module.exports = new AnalyticsService();

