const db = require('../../config/database');
const locationService = require('../../services/locationService');
let logger;
try {
  const { getLogger } = require('../utils/loggerHelper');
  logger = getLogger('LocationAnalytics');
} catch (err) {
  logger = {
    warn: (...args) => console.warn('[LocationAnalytics]', ...args),
    error: (...args) => console.error('[LocationAnalytics]', ...args),
    info: (...args) => console.log('[LocationAnalytics]', ...args),
    debug: (...args) => console.debug('[LocationAnalytics]', ...args)
  };
}

class LocationAnalyticsService {
  calculateRouteMetrics(deviceId, startTime = null, endTime = null) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        movingTime: 0,
        stoppedTime: 0,
        stops: 0,
        route: []
      };
    }

    const validLocations = locations.filter(loc => {
      if (!loc || !loc.coords) return false;
      const lat = parseFloat(loc.coords.latitude);
      const lng = parseFloat(loc.coords.longitude);
      return isFinite(lat) && isFinite(lng) && 
             lat >= -90 && lat <= 90 && 
             lng >= -180 && lng <= 180 &&
             loc.timestamp && typeof loc.timestamp === 'number' && loc.timestamp > 0;
    });

    if (validLocations.length < 2) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        movingTime: 0,
        stoppedTime: 0,
        stops: 0,
        route: []
      };
    }

    let filtered = validLocations;
    if (startTime || endTime) {
      filtered = validLocations.filter(loc => {
        if (startTime && loc.timestamp < startTime) return false;
        if (endTime && loc.timestamp > endTime) return false;
        return true;
      });
    }

    if (filtered.length < 2) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        movingTime: 0,
        stoppedTime: 0,
        stops: 0,
        route: []
      };
    }

    const totalDistance = locationService.calculateRouteDistance(filtered);
    const averageSpeed = locationService.calculateAverageSpeed(filtered);
    const maxSpeed = locationService.getMaxSpeed(filtered);
    
    let movingTime = 0;
    let stoppedTime = 0;
    let stops = 0;
    const STOP_THRESHOLD = 50;
    const STOP_TIME_THRESHOLD = 60000;

    for (let i = 1; i < filtered.length; i++) {
      const prev = filtered[i - 1];
      const curr = filtered[i];
      if (!prev || !prev.coords || !curr || !curr.coords || !prev.timestamp || !curr.timestamp) continue;
      
      const timeDiff = curr.timestamp - prev.timestamp;
      if (timeDiff <= 0) continue;
      
      const distance = locationService.haversineDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );

      if (distance < STOP_THRESHOLD && timeDiff > STOP_TIME_THRESHOLD) {
        stoppedTime += timeDiff;
        stops++;
      } else {
        movingTime += timeDiff;
      }
    }

    return {
      totalDistance,
      averageSpeed,
      maxSpeed,
      movingTime,
      stoppedTime,
      stops,
      route: filtered.map(loc => ({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        timestamp: loc.timestamp,
        speed: loc.coords.speed ? loc.coords.speed * 3.6 : null,
        heading: loc.coords.heading || null
      }))
    };
  }

  detectGeofenceEvents(deviceId, geofences) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return [];
    }

    const events = [];
    let lastState = {};

    for (const geofence of geofences) {
      lastState[geofence.id] = null;
    }

    for (const location of locations) {
      for (const geofence of geofences) {
        const isInside = locationService.checkGeofence(
          location.coords.latitude,
          location.coords.longitude,
          geofence.centerLat,
          geofence.centerLng,
          geofence.radiusMeters
        );

        if (lastState[geofence.id] === null) {
          lastState[geofence.id] = isInside;
        } else if (lastState[geofence.id] !== isInside) {
          events.push({
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            event: isInside ? 'enter' : 'exit',
            timestamp: location.timestamp,
            location: {
              lat: location.coords.latitude,
              lng: location.coords.longitude
            }
          });
          lastState[geofence.id] = isInside;
        }
      }
    }

    return events;
  }

  calculateSpeedZones(deviceId) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        zones: {},
        distribution: {}
      };
    }

    const validLocations = locations.filter(loc => {
      if (!loc || !loc.coords) return false;
      const lat = parseFloat(loc.coords.latitude);
      const lng = parseFloat(loc.coords.longitude);
      return isFinite(lat) && isFinite(lng) && 
             lat >= -90 && lat <= 90 && 
             lng >= -180 && lng <= 180 &&
             loc.timestamp && typeof loc.timestamp === 'number' && loc.timestamp > 0;
    });

    if (validLocations.length < 2) {
      return {
        zones: {},
        distribution: {}
      };
    }

    const zones = {
      stopped: 0,
      slow: 0,
      normal: 0,
      fast: 0,
      veryFast: 0
    };

    for (let i = 1; i < validLocations.length; i++) {
      const prev = validLocations[i - 1];
      const curr = validLocations[i];
      
      if (!prev || !prev.coords || !curr || !curr.coords || !prev.timestamp || !curr.timestamp) continue;
      
      const distance = locationService.haversineDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );
      
      const time = (curr.timestamp - prev.timestamp) / 1000;
      if (time <= 0) continue;
      
      const speedKmh = (distance / time) * 3.6;

      if (speedKmh < 5) zones.stopped++;
      else if (speedKmh < 30) zones.slow++;
      else if (speedKmh < 60) zones.normal++;
      else if (speedKmh < 100) zones.fast++;
      else zones.veryFast++;
    }

    const total = zones.stopped + zones.slow + zones.normal + zones.fast + zones.veryFast;
    return {
      zones,
      distribution: total > 0 ? {
        stopped: (zones.stopped / total) * 100,
        slow: (zones.slow / total) * 100,
        normal: (zones.normal / total) * 100,
        fast: (zones.fast / total) * 100,
        veryFast: (zones.veryFast / total) * 100
      } : {}
    };
  }

  getLocationHeatmap(deviceId, gridSize = 0.01) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return [];
    }

    const validLocations = locations.filter(loc => {
      if (!loc || !loc.coords) return false;
      const lat = parseFloat(loc.coords.latitude);
      const lng = parseFloat(loc.coords.longitude);
      return isFinite(lat) && isFinite(lng) && 
             lat >= -90 && lat <= 90 && 
             lng >= -180 && lng <= 180;
    });

    if (validLocations.length === 0) {
      return [];
    }

    const grid = new Map();

    for (const location of validLocations) {
      const gridLat = Math.floor(location.coords.latitude / gridSize) * gridSize;
      const gridLng = Math.floor(location.coords.longitude / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;
      
      grid.set(key, (grid.get(key) || 0) + 1);
    }

    const heatmap = [];
    for (const [key, count] of grid.entries()) {
      const [lat, lng] = key.split(',').map(Number);
      heatmap.push({
        lat,
        lng,
        intensity: count,
        weight: count / validLocations.length
      });
    }

    return heatmap.sort((a, b) => b.intensity - a.intensity);
  }

  predictNextLocation(deviceId, lookbackMinutes = 5) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return null;
    }

    const validLocations = locations.filter(loc => {
      if (!loc || !loc.coords) return false;
      const lat = parseFloat(loc.coords.latitude);
      const lng = parseFloat(loc.coords.longitude);
      return isFinite(lat) && isFinite(lng) && 
             lat >= -90 && lat <= 90 && 
             lng >= -180 && lng <= 180 &&
             loc.timestamp && typeof loc.timestamp === 'number' && loc.timestamp > 0;
    });

    if (validLocations.length < 3) {
      return null;
    }

    const now = Date.now();
    const cutoff = now - (lookbackMinutes * 60 * 1000);
    const recent = validLocations.filter(loc => loc.timestamp >= cutoff);

    if (recent.length < 3) return null;

    const last = recent[recent.length - 1];
    const prev = recent[recent.length - 2];
    const prev2 = recent[recent.length - 3];

    const latDiff1 = last.coords.latitude - prev.coords.latitude;
    const lngDiff1 = last.coords.longitude - prev.coords.longitude;
    const timeDiff1 = (last.timestamp - prev.timestamp) / 1000;

    const latDiff2 = prev.coords.latitude - prev2.coords.latitude;
    const lngDiff2 = prev.coords.longitude - prev2.coords.longitude;
    const timeDiff2 = (prev.timestamp - prev2.timestamp) / 1000;

    const avgLatSpeed = ((latDiff1 / timeDiff1) + (latDiff2 / timeDiff2)) / 2;
    const avgLngSpeed = ((lngDiff1 / timeDiff1) + (lngDiff2 / timeDiff2)) / 2;

    const predictionTime = 60;
    const predictedLat = last.coords.latitude + (avgLatSpeed * predictionTime);
    const predictedLng = last.coords.longitude + (avgLngSpeed * predictionTime);

    return {
      lat: predictedLat,
      lng: predictedLng,
      confidence: 0.7,
      timestamp: now + (predictionTime * 1000)
    };
  }

  getLocationQuality(deviceId) {
    const locations = db.getStore(deviceId);
    if (!Array.isArray(locations) || locations.length === 0) {
      return {
        score: 0,
        accuracy: 0,
        consistency: 0,
        frequency: 0,
        issues: ['Yetersiz konum verisi']
      };
    }

    const validLocations = locations.filter(loc => {
      if (!loc || !loc.coords) return false;
      const lat = parseFloat(loc.coords.latitude);
      const lng = parseFloat(loc.coords.longitude);
      return isFinite(lat) && isFinite(lng) && 
             lat >= -90 && lat <= 90 && 
             lng >= -180 && lng <= 180 &&
             loc.timestamp && typeof loc.timestamp === 'number' && loc.timestamp > 0;
    });

    if (validLocations.length === 0) {
      return {
        score: 0,
        accuracy: 0,
        consistency: 0,
        frequency: 0,
        issues: ['Geçerli konum verisi yok']
      };
    }

    const recent = validLocations.slice(-100);
    let totalAccuracy = 0;
    let accuracyCount = 0;
    let gaps = 0;
    let lastTimestamp = null;

    for (const location of recent) {
      if (location.coords.accuracy) {
        totalAccuracy += location.coords.accuracy;
        accuracyCount++;
      }

      if (lastTimestamp) {
        const gap = location.timestamp - lastTimestamp;
        if (gap > 300000) {
          gaps++;
        }
      }
      lastTimestamp = location.timestamp;
    }

    const avgAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : 0;
    const accuracyScore = Math.max(0, 100 - (avgAccuracy / 10));
    const consistencyScore = Math.max(0, 100 - (gaps * 10));
    const frequencyScore = recent.length >= 50 ? 100 : (recent.length / 50) * 100;

    const score = (accuracyScore + consistencyScore + frequencyScore) / 3;
    const issues = [];

    if (avgAccuracy > 50) issues.push('Yüksek doğruluk hatası');
    if (gaps > 5) issues.push('Sık kesintiler');
    if (recent.length < 20) issues.push('Yetersiz veri noktası');

    return {
      score: Math.round(score),
      accuracy: Math.round(accuracyScore),
      consistency: Math.round(consistencyScore),
      frequency: Math.round(frequencyScore),
      issues
    };
  }
}

module.exports = new LocationAnalyticsService();

