const locationService = require('./locationService');
const db = require('../config/database');

class SmartTrackingService {
  constructor() {
    this.deviceProfiles = new Map();
    this.anomalyThresholds = {
      maxSpeed: 200,
      maxAcceleration: 50,
      maxJumpDistance: 1000
    };
  }

  getDeviceProfile(deviceId) {
    if (!this.deviceProfiles.has(deviceId)) {
      this.deviceProfiles.set(deviceId, {
        lastSpeed: 0,
        lastLocation: null,
        movementPattern: 'stationary',
        updateCount: 0,
        lastUpdateTime: Date.now()
      });
    }
    return this.deviceProfiles.get(deviceId);
  }

  calculateOptimalInterval(currentSpeed, planId) {
    const baseIntervals = {
      free: { min: 5000, max: 30000 },
      plus: { min: 1000, max: 15000 },
      business: { min: 500, max: 10000 }
    };
    const intervals = baseIntervals[planId] || baseIntervals.free;

    if (currentSpeed === 0 || currentSpeed < 1) {
      return intervals.max;
    }

    if (currentSpeed > 80) {
      return intervals.min;
    }

    const ratio = currentSpeed / 80;
    return Math.round(intervals.max - (intervals.max - intervals.min) * ratio);
  }

  calculateOptimalDistanceInterval(currentSpeed, planId) {
    const baseIntervals = {
      free: { min: 10, max: 50 },
      plus: { min: 3, max: 30 },
      business: { min: 1, max: 20 }
    };
    const intervals = baseIntervals[planId] || baseIntervals.free;

    if (currentSpeed === 0 || currentSpeed < 1) {
      return intervals.max;
    }

    if (currentSpeed > 60) {
      return intervals.min;
    }

    const ratio = currentSpeed / 60;
    return Math.round(intervals.max - (intervals.max - intervals.min) * ratio);
  }

  detectAnomaly(newLocation, deviceId) {
    const profile = this.getDeviceProfile(deviceId);
    const locations = db.getStore(deviceId);
    
    if (!profile.lastLocation || locations.length < 2) {
      profile.lastLocation = newLocation;
      return { isAnomaly: false, reason: null };
    }

    const lastLoc = profile.lastLocation;
    const distance = locationService.haversineDistance(
      lastLoc.coords.latitude,
      lastLoc.coords.longitude,
      newLocation.coords.latitude,
      newLocation.coords.longitude
    );

    const timeDiff = (newLocation.timestamp - lastLoc.timestamp) / 1000;
    
    if (timeDiff <= 0) {
      return { isAnomaly: true, reason: 'invalid_timestamp' };
    }

    const speed = (distance / timeDiff) * 3.6;

    if (speed > this.anomalyThresholds.maxSpeed) {
      return { isAnomaly: true, reason: 'excessive_speed', speed };
    }

    if (distance > this.anomalyThresholds.maxJumpDistance) {
      return { isAnomaly: true, reason: 'jump_detected', distance };
    }

    if (profile.lastSpeed > 0) {
      const acceleration = Math.abs(speed - profile.lastSpeed) / timeDiff;
      if (acceleration > this.anomalyThresholds.maxAcceleration) {
        return { isAnomaly: true, reason: 'excessive_acceleration', acceleration };
      }
    }

    profile.lastSpeed = speed;
    profile.lastLocation = newLocation;
    profile.updateCount++;
    profile.lastUpdateTime = Date.now();

    return { isAnomaly: false, reason: null, speed, distance };
  }

  determineMovementPattern(locations, windowSize = 10) {
    if (!Array.isArray(locations) || locations.length < 2) {
      return 'stationary';
    }

    const recent = locations.slice(-windowSize);
    if (recent.length < 2) return 'stationary';

    let totalDistance = 0;
    let speeds = [];

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      
      if (!prev.coords || !curr.coords) continue;

      const dist = locationService.haversineDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );

      totalDistance += dist;

      const timeDiff = (curr.timestamp - prev.timestamp) / 1000;
      if (timeDiff > 0) {
        const speed = (dist / timeDiff) * 3.6;
        speeds.push(speed);
      }
    }

    const avgSpeed = speeds.length > 0 
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length 
      : 0;

    if (avgSpeed < 1) return 'stationary';
    if (avgSpeed < 10) return 'walking';
    if (avgSpeed < 50) return 'driving';
    return 'fast_moving';
  }

  shouldUpdateLocation(newLocation, deviceId, planId) {
    const profile = this.getDeviceProfile(deviceId);
    const locations = db.getStore(deviceId);

    if (locations.length === 0) {
      return { shouldUpdate: true, reason: 'first_location' };
    }

    const lastLoc = locations[locations.length - 1];
    const distance = locationService.haversineDistance(
      lastLoc.coords.latitude,
      lastLoc.coords.longitude,
      newLocation.coords.latitude,
      newLocation.coords.longitude
    );

    const timeDiff = newLocation.timestamp - lastLoc.timestamp;
    const movementPattern = this.determineMovementPattern(locations);

    const minDistance = {
      free: 10,
      plus: 5,
      business: 3
    }[planId] || 10;

    const minTime = {
      free: 3000,
      plus: 1000,
      business: 500
    }[planId] || 3000;

    if (movementPattern === 'stationary' && distance < minDistance * 2) {
      return { shouldUpdate: false, reason: 'stationary_no_change' };
    }

    if (distance < minDistance && timeDiff < minTime) {
      return { shouldUpdate: false, reason: 'insufficient_change' };
    }

    const anomaly = this.detectAnomaly(newLocation, deviceId);
    if (anomaly.isAnomaly) {
      return { shouldUpdate: false, reason: anomaly.reason, anomaly };
    }

    return { shouldUpdate: true, reason: 'valid_update', distance, timeDiff };
  }

  optimizeLocationData(locations) {
    if (!Array.isArray(locations) || locations.length < 2) {
      return locations;
    }

    const filtered = locationService.filterValidLocations(locations);
    if (filtered.length < 2) return filtered;

    const optimized = [filtered[0]];
    const minDistance = 5;

    for (let i = 1; i < filtered.length; i++) {
      const prev = optimized[optimized.length - 1];
      const curr = filtered[i];
      
      const dist = locationService.haversineDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );

      const timeDiff = curr.timestamp - prev.timestamp;

      if (dist >= minDistance || timeDiff >= 30000) {
        optimized.push(curr);
      }
    }

    return optimized;
  }

  getTrackingRecommendations(deviceId, planId) {
    const profile = this.getDeviceProfile(deviceId);
    const locations = db.getStore(deviceId);
    
    if (locations.length < 2) {
      return {
        recommendedInterval: this.calculateOptimalInterval(0, planId),
        recommendedDistance: this.calculateOptimalDistanceInterval(0, planId),
        movementPattern: 'unknown',
        batteryOptimization: false
      };
    }

    const movementPattern = this.determineMovementPattern(locations);
    const lastLoc = locations[locations.length - 1];
    const speed = lastLoc.coords?.speed ? lastLoc.coords.speed * 3.6 : 0;

    const recommendedInterval = this.calculateOptimalInterval(speed, planId);
    const recommendedDistance = this.calculateOptimalDistanceInterval(speed, planId);

    return {
      recommendedInterval,
      recommendedDistance,
      movementPattern,
      currentSpeed: speed,
      batteryOptimization: movementPattern === 'stationary',
      updateFrequency: profile.updateCount
    };
  }

  resetDeviceProfile(deviceId) {
    this.deviceProfiles.delete(deviceId);
  }
}

module.exports = new SmartTrackingService();

